/**
 * contract-history.ts - Query layer over the Postgres `contracts` table (proactive disclosure,
 * ~2011→present, all departments). This is the pre-CanadaBuys historical tail; CanadaBuys award
 * notices (lib/awards.ts) are the system of record from Aug 2022 onward.
 *
 * Unlike the JSON-snapshot-backed tenders/awards, this dataset is too large to load into memory.
 * Every query here runs as SQL against Neon, with server-side pagination and aggregation.
 */
import { db } from "@/db/client";
import { contracts } from "@/db/schema";
import { sql, desc, and, ilike, or, type SQL } from "drizzle-orm";
import { matchItbProject } from "./itb-match";

export interface ContractFilters {
  q?: string;
  ownerOrg?: string;
  vendorName?: string;
  category?: string;
  page?: number;
  pageSize?: number;
}

function buildWhere(f: ContractFilters): SQL | undefined {
  const clauses: SQL[] = [];
  if (f.q) {
    const like = `%${f.q}%`;
    clauses.push(
      or(
        ilike(contracts.descriptionEn, like),
        ilike(contracts.vendorName, like),
        ilike(contracts.ownerOrgTitle, like),
      )!,
    );
  }
  if (f.ownerOrg) clauses.push(ilike(contracts.ownerOrgTitle, `%${f.ownerOrg}%`));
  if (f.vendorName) clauses.push(sql`${contracts.vendorName} = ${f.vendorName}`);
  if (f.category) clauses.push(sql`${f.category} = ANY(${contracts.categories})`);
  return clauses.length ? and(...clauses) : undefined;
}

export async function queryContracts(f: ContractFilters) {
  const page = f.page ?? 1;
  const pageSize = f.pageSize ?? 20;
  const where = buildWhere(f);

  const [rawRows, totalRow] = await Promise.all([
    db
      .select()
      .from(contracts)
      .where(where)
      // Postgres puts NULLs first in a DESC sort by default, which would mix unknown-value
      // contracts in among the highest real ones in a "sorted by value" view. Force them last.
      .orderBy(sql`${contracts.contractValue} DESC NULLS LAST`)
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(contracts).where(where),
  ]);

  // The government's own description is often a generic commodity category rather than the real
  // project name, even for multi-billion-dollar contracts. Cross-reference against ITB obligations
  // (same vendor, matching dollar value) to surface the actual project name when we have one.
  const rows = rawRows.map((row) => ({
    ...row,
    itbMatch: matchItbProject(row.vendorName, row.contractValue),
  }));

  return { rows, total: totalRow[0]?.count ?? 0, page, pageSize };
}

export async function getContractStats() {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      totalValue: sql<number>`coalesce(sum(${contracts.contractValue}), 0)::float`,
      distinctVendors: sql<number>`count(distinct ${contracts.vendorName})::int`,
      distinctOrgs: sql<number>`count(distinct ${contracts.ownerOrgTitle})::int`,
      earliestDate: sql<string>`min(${contracts.contractDate})`,
    })
    .from(contracts);
  return row;
}

export async function getCategoryBreakdown() {
  return db
    .select({
      category: sql<string>`unnest(${contracts.categories})`,
      count: sql<number>`count(*)::int`,
    })
    .from(contracts)
    .groupBy(sql`unnest(${contracts.categories})`)
    .orderBy(desc(sql`count(*)`));
}

export async function getTopVendors(limit = 15) {
  return db
    .select({
      vendorName: contracts.vendorName,
      totalValue: sql<number>`coalesce(sum(${contracts.contractValue}), 0)::float`,
      count: sql<number>`count(*)::int`,
    })
    .from(contracts)
    .where(sql`${contracts.vendorName} is not null and ${contracts.vendorName} != ''`)
    .groupBy(contracts.vendorName)
    .orderBy(desc(sql`sum(${contracts.contractValue})`))
    .limit(limit);
}

export async function getVendorHistory(vendorName: string) {
  const [summary] = await db
    .select({
      totalValue: sql<number>`coalesce(sum(${contracts.contractValue}), 0)::float`,
      count: sql<number>`count(*)::int`,
      earliestDate: sql<string>`min(${contracts.contractDate})`,
      latestDate: sql<string>`max(${contracts.contractDate})`,
    })
    .from(contracts)
    .where(sql`${contracts.vendorName} = ${vendorName}`);

  const recent = await db
    .select()
    .from(contracts)
    .where(sql`${contracts.vendorName} = ${vendorName}`)
    .orderBy(desc(contracts.contractDate))
    .limit(20);

  return { summary, recent };
}
