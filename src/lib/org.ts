/**
 * org.ts - Shared helper for resolving the real organization behind a contract.
 *
 * PSPC is very often the contracting authority-of-record for defence procurement while the
 * using department (DND, Coast Guard, RCMP, ...) is the actual end user - grouping by the raw
 * `buyer` field alone misattributes billions in spend to PSPC. Prefer `endUser`, fall back to
 * `buyer`. Some awards list several end-user departments jointly ("DND / RCMP / NRC / Transport
 * Canada"); each named organization gets credit. Name variants ("Department of National Defence"
 * vs "...(DND)") are normalized to one canonical key by stripping the trailing abbreviation.
 */

function normalizeOrgName(name: string): string {
  return name.replace(/\s*\([A-Za-z0-9&.'\- ]{2,40}\)\s*$/, "").trim();
}

/** The organization(s) a record is really "for" - end user(s), falling back to buyer. */
export function effectiveOrgs(rec: { buyer?: string; endUser?: string }): string[] {
  const raw = rec.endUser?.trim() || rec.buyer?.trim() || "";
  if (!raw) return [];
  return raw
    .split("/")
    .map((s) => normalizeOrgName(s))
    .filter(Boolean);
}
