/**
 * itb-match.ts - Cross-reference a contract-history record against the ITB obligations dataset.
 *
 * The government's own proactive-disclosure descriptions are often a generic commodity category
 * ("Other professional services not elsewhere specified") rather than the real project name, even
 * for multi-billion-dollar contracts. The ITB dataset, scraped separately from ISED, names the
 * actual project (e.g. "Future Aircrew Training") for major defence primes. When a contract's
 * vendor and dollar value match an ITB project closely enough, we surface that real name instead.
 *
 * Matching on vendor name alone is too loose (a vendor can have several ITB projects); matching on
 * value alone risks coincidental collisions. Vendor plus a tight value tolerance together are a
 * strong combined fingerprint, confirmed against the SkyAlyne "Future Aircrew Training" contract.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

interface ItbRow {
  contractor: string;
  project: string;
  projectDescription: string;
  obligation: number;
}

let itbRows: ItbRow[] | null = null;

function normalizeOrgName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,]/g, "")
    .replace(/\b(inc|ltd|limited|corp|corporation|llc|lp|llp|co|company|plc|gmbh|group|canada|of canada)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function loadItbRows(): ItbRow[] {
  if (itbRows) return itbRows;
  try {
    const raw = readFileSync(join(process.cwd(), "data", "defence-itb-obligations.json"), "utf-8");
    const parsed = JSON.parse(raw) as { rows: ItbRow[] };
    itbRows = parsed.rows;
  } catch {
    itbRows = [];
  }
  return itbRows;
}

export interface ItbMatch {
  project: string;
  projectDescription: string;
}

/** Find the ITB project this contract most likely belongs to, if any. */
export function matchItbProject(vendorName: string | null, contractValue: number | null): ItbMatch | null {
  if (!vendorName || !contractValue || contractValue <= 0) return null;
  const normalizedVendor = normalizeOrgName(vendorName);
  if (!normalizedVendor) return null;

  let best: { row: ItbRow; diff: number } | null = null;
  for (const row of loadItbRows()) {
    const normalizedContractor = normalizeOrgName(row.contractor);
    const vendorMatches =
      normalizedVendor === normalizedContractor ||
      normalizedVendor.includes(normalizedContractor) ||
      normalizedContractor.includes(normalizedVendor);
    if (!vendorMatches) continue;

    const diff = Math.abs(row.obligation - contractValue) / row.obligation;
    if (diff > 0.02) continue; // within 2%: same combined vendor+value fingerprint
    if (!best || diff < best.diff) best = { row, diff };
  }

  return best ? { project: best.row.project, projectDescription: best.row.projectDescription } : null;
}
