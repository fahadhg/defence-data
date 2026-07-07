/**
 * tenders.ts - Enrich raw CanadaBuys tenders with defence classification + derived fields,
 * and provide the query surface the UI uses.
 *
 * Phase 1 reads a committed JSON snapshot (small: ~850 open tenders). The daily cron
 * regenerates it; Phase 2 moves the heavy awards/contract-history data into Neon Postgres.
 */
import type { RawTender } from "./canadabuys";
import { classifyDefence } from "./defence-filter";

export const PROCUREMENT_CATEGORY_LABELS: Record<string, string> = {
  CNST: "Construction",
  GD: "Goods",
  SRV: "Services",
  SRVTGD: "Services (related to goods)",
};

export interface Tender {
  ref: string;
  title: string;
  buyer: string;
  endUser: string;
  gsinCode: string;
  gsin: string;
  unspsc: string;
  category: string; // raw code
  categoryLabel: string;
  noticeType: string;
  method: string;
  status: string;
  published: string;
  closes: string;
  delivery: string;
  regions: string;
  url: string;
  description: string;
  contactName: string;
  contactEmail: string;
  // enrichment
  categories: string[];
  matchReasons: string[];
  strength: "buyer" | "gsin" | "keyword" | null;
  daysToClose: number | null;
  closingSoon: boolean;
}

export function daysUntil(dateStr: string): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const ms = d.getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function closingSoonFor(daysToClose: number | null): boolean {
  return daysToClose !== null && daysToClose >= 0 && daysToClose <= 14;
}

/** Recompute the "as of now" fields on an already-enriched tender. `closes` never changes
 * between snapshot refreshes, but "how many days until it closes" does, every single day. */
export function refreshTenderTiming(t: Tender): Tender {
  const daysToClose = daysUntil(t.closes);
  return { ...t, daysToClose, closingSoon: closingSoonFor(daysToClose) };
}

/** Map a raw tender to enriched form; returns null if not defence-relevant. */
export function enrichTender(raw: RawTender): Tender | null {
  const m = classifyDefence(raw);
  if (!m.isDefence) return null;
  const daysToClose = daysUntil(raw.closes);
  return {
    ...raw,
    categoryLabel: PROCUREMENT_CATEGORY_LABELS[raw.category] ?? raw.category,
    categories: m.categories,
    matchReasons: m.matchReasons,
    strength: m.strength,
    daysToClose,
    closingSoon: daysToClose !== null && daysToClose >= 0 && daysToClose <= 14,
  };
}

export interface TenderFilters {
  q?: string;
  category?: string; // capability category
  procurement?: string; // CNST/GD/SRV/SRVTGD
  buyer?: string;
  closingSoon?: boolean;
  openOnly?: boolean; // hide already-closed
  sort?: "closing" | "published";
  page?: number;
  pageSize?: number;
}

export interface TenderQueryResult {
  rows: Tender[];
  total: number;
  page: number;
  pageSize: number;
  facets: {
    categories: { name: string; count: number }[];
    procurement: { name: string; count: number }[];
    topBuyers: { name: string; count: number }[];
  };
}

export function queryTenders(all: Tender[], f: TenderFilters): TenderQueryResult {
  const page = f.page ?? 1;
  const pageSize = f.pageSize ?? 25;

  let rows = all;
  if (f.q) {
    const q = f.q.toLowerCase();
    rows = rows.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.buyer.toLowerCase().includes(q) ||
        t.gsin.toLowerCase().includes(q),
    );
  }
  if (f.category) rows = rows.filter((t) => t.categories.includes(f.category!));
  if (f.procurement) rows = rows.filter((t) => t.category === f.procurement);
  if (f.buyer) rows = rows.filter((t) => t.buyer === f.buyer);
  if (f.closingSoon) rows = rows.filter((t) => t.closingSoon);
  if (f.openOnly) rows = rows.filter((t) => t.daysToClose === null || t.daysToClose >= 0);

  // facets computed over the filtered set (minus their own dimension would be nicer; keep simple)
  const facets = {
    categories: countBy(rows.flatMap((t) => t.categories)),
    procurement: countBy(rows.map((t) => t.categoryLabel)),
    topBuyers: countBy(rows.map((t) => t.buyer)).slice(0, 12),
  };

  rows = [...rows].sort((a, b) => {
    if (f.sort === "published") return (b.published || "").localeCompare(a.published || "");
    // default: closing soonest first, nulls/closed last
    const av = a.daysToClose ?? Infinity;
    const bv = b.daysToClose ?? Infinity;
    const an = av < 0 ? Infinity : av;
    const bn = bv < 0 ? Infinity : bv;
    return an - bn;
  });

  const total = rows.length;
  const start = (page - 1) * pageSize;
  return {
    rows: rows.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    facets,
  };
}

function countBy(values: string[]): { name: string; count: number }[] {
  const m = new Map<string, number>();
  for (const v of values) {
    if (!v) continue;
    m.set(v, (m.get(v) ?? 0) + 1);
  }
  return [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}
