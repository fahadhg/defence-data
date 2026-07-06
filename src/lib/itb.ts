/**
 * itb.ts - Industrial & Technological Benefits (ITB) obligation data from ISED.
 *
 * When a prime contractor wins a major defence/security procurement, the ITB Policy requires
 * it to undertake Canadian industrial activity equal to the contract's value - work it typically
 * fulfills by subcontracting to Canadian SMEs. For a dual-use manufacturer that will never win a
 * multi-billion-dollar platform contract directly, this is the real path in: find which primes
 * still owe obligations in your capability area, and approach them as a subcontractor.
 *
 * ISED publishes the live per-contractor breakdown as a `companyJson` array embedded in a
 * <script> tag on this page (no CSV/API) - refreshed periodically as contractors report progress.
 */
import { classifyDefence } from "./defence-filter";

export const ITB_PAGE_URL =
  "https://ised-isde.canada.ca/site/industrial-technological-benefits/en/projects-and-obligations/report-contractor-progress/breakdown-current-obligations-contractor";

interface RawItbRow {
  Contractor: string;
  Project: string;
  " Obligation ": string;
  " Completed to date ": string;
  " In progress ": string;
  " To be identified "?: string;
  "Contract Award Date": string;
  "Estimated Timeframe": string;
  "Company Contact and Email"?: string;
  "Project Description"?: string;
}

export interface ItbObligation {
  contractor: string;
  project: string;
  obligation: number;
  completedToDate: number;
  inProgress: number;
  toBeIdentified: number;
  contractAwardDate: string;
  estimatedTimeframe: string;
  projectDescription: string;
  // enrichment
  categories: string[];
  remainingObligation: number; // obligation - completedToDate, the size of the still-open opportunity
  percentComplete: number | null;
}

function parseMoney(s: string): number {
  const n = Number(String(s ?? "").replace(/[^0-9.-]/g, ""));
  return isFinite(n) ? n : 0;
}

/**
 * Extract a bracketed JSON array starting at `openIdx` by walking bracket depth, respecting
 * quoted strings (so "]" inside a description string doesn't end the array early). A naive
 * regex here is unsafe: the array's true closing "]" isn't followed by a literal ";" (ASI), so
 * "up to the first ];" over-matches into unrelated later inline scripts on the same page.
 */
function extractBracketedJson(text: string, openIdx: number): string {
  let depth = 0;
  let inString = false;
  let quote = "";
  for (let i = openIdx; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === "\\") {
        i++; // skip escaped char
      } else if (c === quote) {
        inString = false;
      }
      continue;
    }
    if (c === '"' || c === "'") {
      inString = true;
      quote = c;
    } else if (c === "[") {
      depth++;
    } else if (c === "]") {
      depth--;
      if (depth === 0) return text.slice(openIdx, i + 1);
    }
  }
  throw new Error("Unterminated JSON array while scanning companyJson");
}

/** Fetch ISED's ITB contractor-progress page and extract the embedded companyJson array. */
export async function fetchItbObligations(): Promise<RawItbRow[]> {
  const resp = await fetch(ITB_PAGE_URL, {
    headers: { "User-Agent": "defence-data/1.0 (research; contact: fahadgondal2001@gmail.com)" },
  });
  if (!resp.ok) throw new Error(`Fetch ITB page failed: ${resp.status} ${resp.statusText}`);
  const html = await resp.text();
  const varIdx = html.indexOf("var companyJson");
  if (varIdx === -1) throw new Error("companyJson not found in ITB page - page structure may have changed");
  const openIdx = html.indexOf("[", varIdx);
  const json = extractBracketedJson(html, openIdx);
  return JSON.parse(json) as RawItbRow[];
}

export function enrichItbRow(raw: RawItbRow): ItbObligation {
  const obligation = parseMoney(raw[" Obligation "]);
  const completedToDate = parseMoney(raw[" Completed to date "]);
  const inProgress = parseMoney(raw[" In progress "]);
  const toBeIdentified = parseMoney(raw[" To be identified "] ?? "0");
  const description = raw["Project Description"] ?? "";

  const m = classifyDefence({ title: raw.Project, description });

  return {
    contractor: raw.Contractor?.trim() ?? "",
    project: raw.Project?.trim() ?? "",
    obligation,
    completedToDate,
    inProgress,
    toBeIdentified,
    contractAwardDate: raw["Contract Award Date"] ?? "",
    estimatedTimeframe: raw["Estimated Timeframe"] ?? "",
    projectDescription: description.trim(),
    categories: m.categories,
    remainingObligation: Math.max(0, obligation - completedToDate),
    percentComplete: obligation > 0 ? completedToDate / obligation : null,
  };
}

export interface ContractorSummary {
  contractor: string;
  totalObligation: number;
  totalCompleted: number;
  totalRemaining: number;
  projectCount: number;
  categories: { name: string; count: number }[];
}

export function summarizeContractors(rows: ItbObligation[]): ContractorSummary[] {
  const map = new Map<string, ItbObligation[]>();
  for (const r of rows) {
    if (!r.contractor) continue;
    const arr = map.get(r.contractor) ?? [];
    arr.push(r);
    map.set(r.contractor, arr);
  }
  return [...map.entries()]
    .map(([contractor, projects]) => {
      const catCounts = new Map<string, number>();
      for (const p of projects) for (const c of p.categories) catCounts.set(c, (catCounts.get(c) ?? 0) + 1);
      return {
        contractor,
        totalObligation: projects.reduce((s, p) => s + p.obligation, 0),
        totalCompleted: projects.reduce((s, p) => s + p.completedToDate, 0),
        totalRemaining: projects.reduce((s, p) => s + p.remainingObligation, 0),
        projectCount: projects.length,
        categories: [...catCounts.entries()]
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count),
      };
    })
    .sort((a, b) => b.totalObligation - a.totalObligation);
}

export interface ItbFilters {
  q?: string;
  category?: string;
  page?: number;
  pageSize?: number;
}

export interface ItbQueryResult {
  rows: ItbObligation[];
  total: number;
  page: number;
  pageSize: number;
  facets: { categories: { name: string; count: number }[] };
}

export function queryItb(all: ItbObligation[], f: ItbFilters): ItbQueryResult {
  const page = f.page ?? 1;
  const pageSize = f.pageSize ?? 25;

  let rows = all;
  if (f.q) {
    const q = f.q.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.contractor.toLowerCase().includes(q) ||
        r.project.toLowerCase().includes(q) ||
        r.projectDescription.toLowerCase().includes(q),
    );
  }
  if (f.category) rows = rows.filter((r) => r.categories.includes(f.category!));

  const catCounts = new Map<string, number>();
  for (const r of rows) for (const c of r.categories) catCounts.set(c, (catCounts.get(c) ?? 0) + 1);
  const facets = {
    categories: [...catCounts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
  };

  rows = [...rows].sort((a, b) => b.remainingObligation - a.remainingObligation);

  const total = rows.length;
  const start = (page - 1) * pageSize;
  return { rows: rows.slice(start, start + pageSize), total, page, pageSize, facets };
}
