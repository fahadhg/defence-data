/**
 * awards.ts — Enrich raw CanadaBuys award notices with defence classification + derived fields.
 * Mirrors tenders.ts; awards additionally carry contract value and vendor identity.
 */
import type { RawAward } from "./canadabuys";
import { classifyDefence } from "./defence-filter";
import { PROCUREMENT_CATEGORY_LABELS } from "./tenders";

export interface Award {
  ref: string;
  title: string;
  contractNumber: string;
  vendor: string;
  vendorProvince: string;
  vendorCountry: string;
  buyer: string;
  endUser: string;
  gsinCode: string;
  gsin: string;
  unspsc: string;
  category: string;
  categoryLabel: string;
  method: string;
  status: string;
  instrumentType: string;
  awardDate: string;
  contractStart: string;
  contractEnd: string;
  value: number; // parsed from totalContractValue, falling back to contractAmount
  currency: string;
  description: string;
  fiscalYear: string;
  // enrichment
  categories: string[];
  matchReasons: string[];
  strength: "buyer" | "gsin" | "keyword" | null;
}

function parseMoney(s: string): number {
  const n = Number(String(s).replace(/[^0-9.-]/g, ""));
  return isFinite(n) ? n : 0;
}

function fiscalYearOf(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "unknown";
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1; // Canadian FY: Apr 1 – Mar 31
  return m >= 4 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

export function enrichAward(raw: RawAward): Award | null {
  const m = classifyDefence(raw);
  if (!m.isDefence) return null;
  const totalValue = parseMoney(raw.totalContractValue);
  const baseValue = parseMoney(raw.contractAmount);
  const value = totalValue > 0 ? totalValue : baseValue;
  return {
    ...raw,
    categoryLabel: PROCUREMENT_CATEGORY_LABELS[raw.category.replace(/^\*/, "")] ?? raw.category,
    value,
    fiscalYear: fiscalYearOf(raw.awardDate),
    categories: m.categories,
    matchReasons: m.matchReasons,
    strength: m.strength,
  };
}

export interface VendorSummary {
  name: string;
  totalValue: number;
  awardCount: number;
  topBuyers: { name: string; count: number; value: number }[];
  categories: { name: string; count: number }[];
  byFiscalYear: { fiscalYear: string; value: number; count: number }[];
}

export function summarizeVendor(name: string, awards: Award[]): VendorSummary {
  const vendorAwards = awards.filter((a) => a.vendor === name);
  const buyerMap = new Map<string, { count: number; value: number }>();
  const catMap = new Map<string, number>();
  const fyMap = new Map<string, { value: number; count: number }>();

  let totalValue = 0;
  for (const a of vendorAwards) {
    totalValue += a.value;
    const b = buyerMap.get(a.buyer) ?? { count: 0, value: 0 };
    b.count += 1;
    b.value += a.value;
    buyerMap.set(a.buyer, b);

    for (const c of a.categories) catMap.set(c, (catMap.get(c) ?? 0) + 1);

    const fy = fyMap.get(a.fiscalYear) ?? { value: 0, count: 0 };
    fy.value += a.value;
    fy.count += 1;
    fyMap.set(a.fiscalYear, fy);
  }

  return {
    name,
    totalValue,
    awardCount: vendorAwards.length,
    topBuyers: [...buyerMap.entries()]
      .map(([n, v]) => ({ name: n, ...v }))
      .sort((a, b) => b.value - a.value),
    categories: [...catMap.entries()]
      .map(([n, count]) => ({ name: n, count }))
      .sort((a, b) => b.count - a.count),
    byFiscalYear: [...fyMap.entries()]
      .map(([fiscalYear, v]) => ({ fiscalYear, ...v }))
      .sort((a, b) => a.fiscalYear.localeCompare(b.fiscalYear)),
  };
}

export interface AwardFilters {
  q?: string;
  vendor?: string;
  buyer?: string;
  category?: string;
  fiscalYear?: string;
  page?: number;
  pageSize?: number;
}

export interface AwardQueryResult {
  rows: Award[];
  total: number;
  page: number;
  pageSize: number;
  totalValue: number;
  facets: {
    categories: { name: string; count: number }[];
    fiscalYears: { name: string; count: number }[];
    topVendors: { name: string; totalValue: number; count: number }[];
  };
}

export function queryAwards(all: Award[], f: AwardFilters): AwardQueryResult {
  const page = f.page ?? 1;
  const pageSize = f.pageSize ?? 25;

  let rows = all;
  if (f.q) {
    const q = f.q.toLowerCase();
    rows = rows.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.vendor.toLowerCase().includes(q) ||
        a.buyer.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q),
    );
  }
  if (f.vendor) rows = rows.filter((a) => a.vendor === f.vendor);
  if (f.buyer) rows = rows.filter((a) => a.buyer === f.buyer);
  if (f.category) rows = rows.filter((a) => a.categories.includes(f.category!));
  if (f.fiscalYear) rows = rows.filter((a) => a.fiscalYear === f.fiscalYear);

  const vendorMap = new Map<string, { totalValue: number; count: number }>();
  for (const a of rows) {
    const v = vendorMap.get(a.vendor) ?? { totalValue: 0, count: 0 };
    v.totalValue += a.value;
    v.count += 1;
    vendorMap.set(a.vendor, v);
  }

  const facets = {
    categories: countBy(rows.flatMap((a) => a.categories)),
    fiscalYears: countBy(rows.map((a) => a.fiscalYear)).sort((a, b) => b.name.localeCompare(a.name)),
    topVendors: [...vendorMap.entries()]
      .filter(([name]) => name)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 15),
  };

  rows = [...rows].sort((a, b) => b.value - a.value);

  const totalValue = rows.reduce((sum, a) => sum + a.value, 0);
  const total = rows.length;
  const start = (page - 1) * pageSize;
  return { rows: rows.slice(start, start + pageSize), total, page, pageSize, totalValue, facets };
}

function countBy(values: string[]): { name: string; count: number }[] {
  const m = new Map<string, number>();
  for (const v of values) {
    if (!v) continue;
    m.set(v, (m.get(v) ?? 0) + 1);
  }
  return [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}
