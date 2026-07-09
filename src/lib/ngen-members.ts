/**
 * ngen-members.ts - NGen member companies, sourced from the NGen Connect project's Supabase
 * database (a separate internal tool: AI-extracted company profiles from public websites, not
 * self-reported by companies). Read-only here; this project never writes to that database.
 *
 * Powers the Opportunity Finder: a member finds their own company, and this classifies its
 * capability categories (same taxonomy as the rest of the app) so the finder can show matching
 * open tenders, ITB subcontracting opportunities, and standing offers - opportunities FOR that
 * company, not a leads list for someone else.
 *
 * Company text is AI-extracted from public sites and occasionally mismatched or wrong (confirmed
 * during scoping: one row's declared name and its extracted content described two different
 * companies entirely). Categorization here is keyword-based and results should read as "this
 * company mentions this capability," not a verified fact - said so wherever this is shown.
 *
 * Search and lookup are pushed down to Supabase's own query filtering (ilike / eq) rather than
 * fetching all ~5,127 companies into Node and filtering in memory. That's not just more correct
 * (a live query, not whatever's in a stale cache) - fetching and caching the full list was
 * measured at 5.5MB, well over Next's 2MB per-cache-entry limit, and failed to cache at all
 * (silently at first, then as an actual unhandled rejection that broke the rest of the page).
 * Per-search-term and per-id caching below stays naturally small.
 */
import { unstable_cache } from "next/cache";
import { KEYWORD_CATEGORIES, compile } from "./defence-filter";

export interface NgenCompany {
  id: string;
  companyName: string;
  site: string;
  homepage: string;
  capabilities: string[];
  products: string[];
}

interface SupabaseRow {
  id: string;
  company_name: string;
  site: string;
  homepage: string;
  capabilities: string[] | null;
  capabilities_enhanced: string[] | null;
  products: string[] | null;
}

// Only capabilities/products are fetched, not industries_served/certifications/tagline/etc -
// tested against real data: including industries_served alone triples false-positive category
// matches by pulling in anything that merely lists a sector among many it sells into, rather than
// companies that describe building the thing.
const SELECT = "id,company_name,site,homepage,capabilities,capabilities_enhanced,products";

function toCompany(r: SupabaseRow): NgenCompany {
  return {
    id: r.id,
    companyName: r.company_name,
    site: r.site,
    homepage: r.homepage,
    capabilities: [...new Set([...(r.capabilities ?? []), ...(r.capabilities_enhanced ?? [])])],
    products: r.products ?? [],
  };
}

function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, key } : null;
}

export const searchNgenCompanies = unstable_cache(
  async (query: string, limit = 20): Promise<NgenCompany[]> => {
    const q = query.trim();
    const cfg = supabaseConfig();
    if (!q || !cfg) return [];
    const resp = await fetch(
      `${cfg.url}/rest/v1/companies?select=${SELECT}&company_name=ilike.*${encodeURIComponent(q)}*&limit=${limit}`,
      { headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` } },
    );
    if (!resp.ok) throw new Error(`NGen Connect search failed: ${resp.status} ${resp.statusText}`);
    const rows = (await resp.json()) as SupabaseRow[];
    return rows.map(toCompany);
  },
  ["ngen-company-search"],
  { revalidate: 86400 },
);

export const getNgenCompanyById = unstable_cache(
  async (id: string): Promise<NgenCompany | undefined> => {
    const cfg = supabaseConfig();
    if (!cfg) return undefined;
    const resp = await fetch(`${cfg.url}/rest/v1/companies?select=${SELECT}&id=eq.${encodeURIComponent(id)}&limit=1`, {
      headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` },
    });
    if (!resp.ok) throw new Error(`NGen Connect lookup failed: ${resp.status} ${resp.statusText}`);
    const rows = (await resp.json()) as SupabaseRow[];
    return rows[0] ? toCompany(rows[0]) : undefined;
  },
  ["ngen-company-by-id"],
  { revalidate: 86400 },
);

function companyTextBlob(c: NgenCompany): string {
  return [c.companyName, ...c.capabilities, ...c.products].join(" | ");
}

/** Same keyword taxonomy the rest of the app classifies tenders/awards/ITB projects with, so a
 * company tagged "Aerospace & Aircraft" here means the same thing it means everywhere else. */
export function classifyCompanyCategories(c: NgenCompany): string[] {
  const text = companyTextBlob(c);
  const categories: string[] = [];
  for (const { category, terms } of KEYWORD_CATEGORIES) {
    if (terms.some((term) => compile(term).test(text))) categories.push(category);
  }
  return categories;
}
