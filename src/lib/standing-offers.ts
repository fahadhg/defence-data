/**
 * standing-offers.ts - Enrich raw SOSA (Standing Offers & Supply Arrangements) records.
 *
 * Being pre-qualified on a standing offer/supply arrangement is often the entry ticket to
 * federal defence work - many buys happen only against holders of an existing vehicle rather
 * than through a fresh open tender. This feed has no GSIN and no distinct buyer/end-user split
 * (the "end-user-entity" field is usually the contracting authority, e.g. PSPC, not the using
 * department), so classification here leans on the commodity/title keyword signal.
 */
import type { RawStandingOffer } from "./canadabuys";
import { classifyDefence } from "./defence-filter";

export interface StandingOffer {
  title: string;
  commodityCode: string;
  commodity: string;
  supplierName: string;
  supplierLegalName: string;
  endUser: string;
  awardDate: string;
  expiryDate: string;
  deliveryPoint: string;
  agreementType: string;
  agreementNumber: string;
  // enrichment
  categories: string[];
  matchReasons: string[];
  strength: "buyer" | "gsin" | "keyword" | null;
  daysToExpiry: number | null;
  isExpired: boolean;
}

function daysUntil(dateStr: string): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function enrichStandingOffer(raw: RawStandingOffer): StandingOffer | null {
  const m = classifyDefence({
    title: raw.title,
    description: raw.commodity,
    unspsc: raw.commodity,
    buyer: raw.endUser,
    endUser: raw.endUser,
  });
  if (!m.isDefence) return null;
  const daysToExpiry = daysUntil(raw.expiryDate);
  return {
    ...raw,
    categories: m.categories,
    matchReasons: m.matchReasons,
    strength: m.strength,
    daysToExpiry,
    isExpired: daysToExpiry !== null && daysToExpiry < 0,
  };
}

export interface StandingOfferFilters {
  q?: string;
  category?: string;
  activeOnly?: boolean;
  page?: number;
  pageSize?: number;
}

export interface StandingOfferQueryResult {
  rows: StandingOffer[];
  total: number;
  page: number;
  pageSize: number;
  facets: {
    categories: { name: string; count: number }[];
    topSuppliers: { name: string; count: number }[];
  };
}

export function queryStandingOffers(all: StandingOffer[], f: StandingOfferFilters): StandingOfferQueryResult {
  const page = f.page ?? 1;
  const pageSize = f.pageSize ?? 25;

  let rows = all;
  if (f.q) {
    const q = f.q.toLowerCase();
    rows = rows.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.commodity.toLowerCase().includes(q) ||
        s.supplierName.toLowerCase().includes(q),
    );
  }
  if (f.category) rows = rows.filter((s) => s.categories.includes(f.category!));
  if (f.activeOnly) rows = rows.filter((s) => !s.isExpired);

  const facets = {
    categories: countBy(rows.flatMap((s) => s.categories)),
    topSuppliers: countBy(rows.map((s) => s.supplierName)).slice(0, 15),
  };

  rows = [...rows].sort((a, b) => (a.daysToExpiry ?? Infinity) - (b.daysToExpiry ?? Infinity));

  const total = rows.length;
  const start = (page - 1) * pageSize;
  return { rows: rows.slice(start, start + pageSize), total, page, pageSize, facets };
}

function countBy(values: string[]): { name: string; count: number }[] {
  const m = new Map<string, number>();
  for (const v of values) {
    if (!v) continue;
    m.set(v, (m.get(v) ?? 0) + 1);
  }
  return [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}
