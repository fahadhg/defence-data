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
import { unstable_cache } from "next/cache";

// This data only changes on the monthly ingest refresh, but the aggregate queries below scan the
// full ~376K-row table (the vendor-name normalization in particular has no index to lean on, since
// it's a computed expression). Recomputing them on every single page view was measured at 2.6s+ for
// getTopVendors alone, risking timeouts under load. Cache for 6 hours; a stale leaderboard for a few
// hours between refreshes is a fine trade for not scanning the whole table on every visit.
const CONTRACT_HISTORY_CACHE_SECONDS = 21600;

/**
 * The government's own disclosure has no vendor ID, only free-text names, so the same legal
 * entity shows up under dozens of cosmetic variants (case, stray whitespace, trailing periods,
 * "Inc" vs "Ltd" vs no suffix at all) - verified against real data: "MDA Geospatial Services
 * Inc." alone had 14 such variants worth $850M combined, all clearly one company. This strips
 * only case, punctuation, whitespace, and common legal-entity suffix words - it deliberately does
 * NOT fuzzy-match spelling (typos like "Geosptatial") or merge on a shared word (the dataset also
 * contains an unrelated person, an architecture firm, and unrelated small businesses that all
 * happen to contain "MDA" as a substring). Order matters: lowercase before stripping suffix words,
 * since Postgres regex is case-sensitive by default.
 */
function vendorNormSql(expr: SQL) {
  return sql`
    trim(
      regexp_replace(
        regexp_replace(
          regexp_replace(lower(trim(${expr})), '[.,]', '', 'g'),
          '\\s+', ' ', 'g'
        ),
        '\\y(inc|incorporated|ltd|limited|corp|corporation|co|company|llc|lp|llp|plc)\\y', '', 'g'
      )
    )
  `;
}

const VENDOR_NORM_SQL = vendorNormSql(sql`${contracts.vendorName}`);

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
  // Normalized match, not exact string equality, so filtering by one spelling of a vendor
  // ("MDA Geospatial Services Inc.") also picks up its cosmetic variants ("MDA GEOSPATIAL
  // SERVICES INC", trailing whitespace, etc.) rather than only that one exact spelling.
  if (f.vendorName) clauses.push(sql`${VENDOR_NORM_SQL} = ${vendorNormSql(sql`${f.vendorName}`)}`);
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

export async function getContractById(id: string) {
  const [row] = await db.select().from(contracts).where(sql`${contracts.id} = ${id}`).limit(1);
  if (!row) return undefined;
  return { ...row, itbMatch: matchItbProject(row.vendorName, row.contractValue) };
}

export const getContractStats = unstable_cache(
  async () => {
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
  },
  ["contract-history-stats"],
  { revalidate: CONTRACT_HISTORY_CACHE_SECONDS },
);

export const getCategoryBreakdown = unstable_cache(
  async () => {
    return db
      .select({
        category: sql<string>`unnest(${contracts.categories})`,
        count: sql<number>`count(*)::int`,
      })
      .from(contracts)
      .groupBy(sql`unnest(${contracts.categories})`)
      .orderBy(desc(sql`count(*)`));
  },
  ["contract-history-category-breakdown"],
  { revalidate: CONTRACT_HISTORY_CACHE_SECONDS },
);

export interface TopVendor {
  vendorName: string;
  normKey: string;
  totalValue: number;
  count: number;
}

export const getTopVendors = unstable_cache(
  async (limit = 15): Promise<TopVendor[]> => {
    const result = await db.execute<{ vendor_name: string; norm_key: string; total_value: number; count: number }>(sql`
      WITH normalized AS (
        SELECT vendor_name, ${VENDOR_NORM_SQL} as norm_key, contract_value
        FROM contracts
        WHERE vendor_name IS NOT NULL AND vendor_name != ''
      ),
      grouped AS (
        SELECT norm_key, coalesce(sum(contract_value), 0)::float as total_value, count(*)::int as count
        FROM normalized
        GROUP BY norm_key
      ),
      ranked_names AS (
        SELECT norm_key, vendor_name,
          row_number() OVER (PARTITION BY norm_key ORDER BY count(*) DESC) as rn
        FROM normalized
        GROUP BY norm_key, vendor_name
      )
      SELECT g.norm_key, rn.vendor_name, g.total_value, g.count
      FROM grouped g
      JOIN ranked_names rn ON rn.norm_key = g.norm_key AND rn.rn = 1
      ORDER BY g.total_value DESC
      LIMIT ${limit}
    `);

    return result.rows.map((r) => ({
      vendorName: r.vendor_name,
      normKey: r.norm_key,
      totalValue: Number(r.total_value),
      count: Number(r.count),
    }));
  },
  ["contract-history-top-vendors"],
  { revalidate: CONTRACT_HISTORY_CACHE_SECONDS },
);

/** All contracts for a vendor, matched by normalized name so cosmetic variants of the same
 * legal entity (see VENDOR_NORM_SQL) are grouped as one vendor rather than split apart. */
export async function getVendorHistory(vendorName: string) {
  const normMatch = sql`${VENDOR_NORM_SQL} = ${vendorNormSql(sql`${vendorName}`)}`;

  const [summary] = await db
    .select({
      totalValue: sql<number>`coalesce(sum(${contracts.contractValue}), 0)::float`,
      count: sql<number>`count(*)::int`,
      earliestDate: sql<string>`min(${contracts.contractDate})`,
      latestDate: sql<string>`max(${contracts.contractDate})`,
    })
    .from(contracts)
    .where(normMatch);

  const recent = await db
    .select()
    .from(contracts)
    .where(normMatch)
    .orderBy(desc(contracts.contractDate))
    .limit(20);

  return { summary, recent };
}
