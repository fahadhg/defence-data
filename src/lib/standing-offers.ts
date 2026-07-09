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

/**
 * The raw SOSA feed publishes one row per delivery point for the same underlying arrangement -
 * verified against real data: 164 of 847 arrangement/supplier groups differ in nothing except
 * `deliveryPoint` (one row says "Canada", another "United States", everything else byte-identical).
 * Left alone, browsing shows what looks like meaningless duplicate cards. Merge those into one row
 * with a combined delivery point list.
 */
export function dedupeByDeliveryPoint(offers: StandingOffer[]): StandingOffer[] {
  const groups = new Map<string, StandingOffer[]>();
  for (const o of offers) {
    const key = [o.title, o.supplierName, o.agreementNumber, o.awardDate].join("|");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(o);
  }

  const result: StandingOffer[] = [];
  for (const rows of groups.values()) {
    if (rows.length === 1) {
      result.push(rows[0]);
      continue;
    }
    const points = [...new Set(rows.map((r) => r.deliveryPoint).filter(Boolean))].sort();
    result.push({ ...rows[0], deliveryPoint: points.join(", ") });
  }
  return result;
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

/** Plain-language label for the government's own agreement-type codes. */
export const AGREEMENT_TYPE_LABELS: Record<string, string> = {
  SA: "Supply Arrangement",
  NMSO: "National Master Standing Offer",
  RMSO: "Regional Master Standing Offer",
  NISO: "National Individual Standing Offer",
  RISO: "Regional Individual Standing Offer",
  DISO: "Departmental Individual Standing Offer",
};

export interface SupplierArrangement {
  title: string;
  agreementType: string;
  agreementTypeLabel: string;
  supplierCount: number;
  suppliers: string[];
  categories: string[];
  endUser: string;
  earliestExpiry: number | null;
  latestExpiry: number | null;
  anyActive: boolean;
  /** Descriptive only, not a claim about a live application window - see the page's own caveat. */
  opennessLabel: string;
}

/**
 * Group individual supplier rows into their parent arrangement, so "how many suppliers hold
 * this vehicle" becomes visible. Supply Arrangements (type "SA") are the vehicle type PSPC
 * generally keeps open to periodic new-supplier qualification; Standing Offers (the SO variants)
 * are typically a fixed roster set at competition time. This is real, useful context but not a
 * live read of whether a given vehicle is accepting applications today - said so on the page.
 */
export function groupArrangements(offers: StandingOffer[]): SupplierArrangement[] {
  const byTitle = new Map<string, StandingOffer[]>();
  for (const o of offers) {
    if (!byTitle.has(o.title)) byTitle.set(o.title, []);
    byTitle.get(o.title)!.push(o);
  }

  const arrangements: SupplierArrangement[] = [];
  for (const [title, rows] of byTitle) {
    const suppliers = [...new Set(rows.map((r) => r.supplierLegalName || r.supplierName).filter(Boolean))];
    const categories = [...new Set(rows.flatMap((r) => r.categories))];
    const expiries = rows.map((r) => r.daysToExpiry).filter((d): d is number => d !== null);
    const agreementType = rows[0].agreementType;
    const anyActive = rows.some((r) => !r.isExpired);

    let opennessLabel: string;
    if (agreementType === "SA") {
      opennessLabel = suppliers.length === 1 ? "Supply Arrangement, 1 qualified supplier so far" : `Supply Arrangement, ${suppliers.length} qualified suppliers`;
    } else if (suppliers.length === 1) {
      opennessLabel = "Single-supplier arrangement";
    } else {
      opennessLabel = `Multi-supplier pool (${suppliers.length} suppliers)`;
    }

    arrangements.push({
      title,
      agreementType,
      agreementTypeLabel: AGREEMENT_TYPE_LABELS[agreementType] ?? agreementType,
      supplierCount: suppliers.length,
      suppliers,
      categories,
      endUser: rows[0].endUser,
      earliestExpiry: expiries.length ? Math.min(...expiries) : null,
      latestExpiry: expiries.length ? Math.max(...expiries) : null,
      anyActive,
      opennessLabel,
    });
  }

  return arrangements;
}

function countBy(values: string[]): { name: string; count: number }[] {
  const m = new Map<string, number>();
  for (const v of values) {
    if (!v) continue;
    m.set(v, (m.get(v) ?? 0) + 1);
  }
  return [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}
