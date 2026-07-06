/**
 * buyers.ts - Procurement-pattern intelligence per *organization*, derived from awards.
 *
 * CanadaBuys open data doesn't publish bid counts or losing bidders, so a literal "win rate"
 * isn't computable from public data. What is real and useful: how much a buyer relies on
 * non-competitive/limited-tendering awards (sole-source rate) and how concentrated its awarded
 * value is among a small number of vendors (incumbency concentration) - both signal how open
 * a buyer's competitions actually are.
 *
 * Grouping is by ORGANIZATION, not the raw `buyer` field: PSPC is very often the contracting
 * authority-of-record for defence procurement while DND is the actual end user (e.g. $32B+ of
 * defence spend is attributed to PSPC-as-buyer but DND-as-end-user in this data) - grouping by
 * `buyer` alone would show DND as a tiny player and PSPC as an implausibly huge one. So we prefer
 * `endUser` and fall back to `buyer`. Some awards also list several end-user departments jointly
 * (e.g. "DND / RCMP / NRC / Transport Canada" for shared requirements) - each named organization
 * gets credit, and name variants ("Department of National Defence" vs "...(DND)") are normalized
 * to one canonical key by stripping the trailing abbreviation.
 */
import type { Award } from "./awards";
import { effectiveOrgs } from "./org";

export { effectiveOrgs };

export interface BuyerSummary {
  name: string;
  totalValue: number;
  awardCount: number;
  soleSourceRate: number | null; // share of awards (with a known method) that are non-competitive/limited/ACAN
  soleSourceCount: number;
  methodKnownCount: number;
  topVendors: { name: string; value: number; count: number; share: number }[];
  top3Share: number | null; // share of total value captured by the top 3 vendors
  categories: { name: string; count: number }[];
  byFiscalYear: { fiscalYear: string; value: number; count: number }[];
}

export function summarizeBuyer(name: string, awards: Award[]): BuyerSummary {
  const orgAwards = awards.filter((a) => effectiveOrgs(a).includes(name));
  const vendorMap = new Map<string, { value: number; count: number }>();
  const catMap = new Map<string, number>();
  const fyMap = new Map<string, { value: number; count: number }>();

  let totalValue = 0;
  let soleSourceCount = 0;
  let methodKnownCount = 0;

  for (const a of orgAwards) {
    totalValue += a.value;
    const v = vendorMap.get(a.vendor) ?? { value: 0, count: 0 };
    v.value += a.value;
    v.count += 1;
    vendorMap.set(a.vendor, v);

    for (const c of a.categories) catMap.set(c, (catMap.get(c) ?? 0) + 1);

    const fy = fyMap.get(a.fiscalYear) ?? { value: 0, count: 0 };
    fy.value += a.value;
    fy.count += 1;
    fyMap.set(a.fiscalYear, fy);

    if (a.method) {
      methodKnownCount += 1;
      if (a.isSoleSource) soleSourceCount += 1;
    }
  }

  const topVendors = [...vendorMap.entries()]
    .filter(([n]) => n)
    .map(([n, v]) => ({ name: n, ...v, share: totalValue > 0 ? v.value / totalValue : 0 }))
    .sort((a, b) => b.value - a.value);

  const top3Share = totalValue > 0 ? topVendors.slice(0, 3).reduce((s, v) => s + v.value, 0) / totalValue : null;

  return {
    name,
    totalValue,
    awardCount: orgAwards.length,
    soleSourceRate: methodKnownCount > 0 ? soleSourceCount / methodKnownCount : null,
    soleSourceCount,
    methodKnownCount,
    topVendors,
    top3Share,
    categories: [...catMap.entries()]
      .map(([n, count]) => ({ name: n, count }))
      .sort((a, b) => b.count - a.count),
    byFiscalYear: [...fyMap.entries()]
      .map(([fiscalYear, v]) => ({ fiscalYear, ...v }))
      .sort((a, b) => a.fiscalYear.localeCompare(b.fiscalYear)),
  };
}

export interface BuyerLeaderboardRow {
  name: string;
  totalValue: number;
  awardCount: number;
  soleSourceRate: number | null;
}

/** All organizations ranked by total awarded defence value, with sole-source rate for comparison. */
export function buyerLeaderboard(awards: Award[]): BuyerLeaderboardRow[] {
  const names = new Set(awards.flatMap((a) => effectiveOrgs(a)));
  return [...names]
    .map((name) => {
      const s = summarizeBuyer(name, awards);
      return { name, totalValue: s.totalValue, awardCount: s.awardCount, soleSourceRate: s.soleSourceRate };
    })
    .sort((a, b) => b.totalValue - a.totalValue);
}
