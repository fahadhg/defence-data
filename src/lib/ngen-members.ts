/**
 * ngen-members.ts - NGen member companies, sourced from the NGen Connect project's Supabase
 * database (a separate internal tool: AI-extracted company profiles from public websites, not
 * self-reported by companies). Read-only here; this project never writes to that database.
 *
 * Used to power the Subcontracting Opportunity Finder: ITB obligations name which primes still
 * owe Canadian industrial activity and how much of it is unidentified, but not who could actually
 * do the work. Cross-referencing against member capabilities turns that into an actual lead list.
 *
 * Company text is AI-extracted from public sites and occasionally mismatched or wrong (confirmed
 * during scoping: one row's declared name and its extracted content described two different
 * companies entirely). Categorization here is keyword-based, same taxonomy as the rest of the
 * app, and results should read as "companies that mention this capability," not a verified
 * directory - said so wherever this is shown.
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

const PAGE_SIZE = 1000;

// Matching only on self-described capabilities/products, not industries_served or
// certifications - tested against real data: including industries_served alone triples the
// Aerospace & Aircraft match count (232 -> 849) by pulling in anything that merely lists
// "Aerospace" among many customer industries it sells into, rather than companies that actually
// describe building the thing. Those unused fields aren't fetched at all, which also keeps the
// cached payload well under Next's 2MB per-entry cache limit (the full field set was 2.9MB-7MB
// and silently failed to cache at all).
async function fetchAllRows(): Promise<SupabaseRow[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];

  const select = "id,company_name,site,homepage,capabilities,capabilities_enhanced,products";
  const rows: SupabaseRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const resp = await fetch(`${url}/rest/v1/companies?select=${select}&limit=${PAGE_SIZE}&offset=${offset}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!resp.ok) throw new Error(`NGen Connect fetch failed: ${resp.status} ${resp.statusText}`);
    const page = (await resp.json()) as SupabaseRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

/** This dataset is refreshed independently by the NGen Connect pipeline, not by anything in this
 * project. Cache for a day so the finder doesn't hit Supabase on every single page view. */
const getNgenCompanies = unstable_cache(
  async (): Promise<NgenCompany[]> => {
    const rows = await fetchAllRows();
    return rows.map((r) => ({
      id: r.id,
      companyName: r.company_name,
      site: r.site,
      homepage: r.homepage,
      capabilities: [...new Set([...(r.capabilities ?? []), ...(r.capabilities_enhanced ?? [])])],
      products: r.products ?? [],
    }));
  },
  ["ngen-member-companies"],
  { revalidate: 86400 },
);

function companyTextBlob(c: NgenCompany): string {
  return [c.companyName, ...c.capabilities, ...c.products].join(" | ");
}

/** Same keyword taxonomy the rest of the app classifies tenders/awards/ITB projects with, so a
 * company tagged "Aerospace & Aircraft" here means the same thing it means everywhere else. */
function classifyCompanyCategories(c: NgenCompany): string[] {
  const text = companyTextBlob(c);
  const categories: string[] = [];
  for (const { category, terms } of KEYWORD_CATEGORIES) {
    if (terms.some((term) => compile(term).test(text))) categories.push(category);
  }
  return categories;
}

/**
 * Cached per category rather than as one combined index - a company can match several
 * categories, so a single combined blob duplicates full company objects across every category
 * it's tagged with, which pushed the cached size to 7MB and silently failed to cache at all
 * (same 2MB-per-entry limit as above). Splitting by category keeps each entry small; unstable_cache
 * keys automatically include the function arguments, so each category gets its own cache slot.
 */
const getNgenCompaniesForCategory = unstable_cache(
  async (category: string): Promise<NgenCompany[]> => {
    const companies = await getNgenCompanies();
    return companies.filter((c) => classifyCompanyCategories(c).includes(category));
  },
  ["ngen-companies-by-category"],
  { revalidate: 86400 },
);

export async function matchCompaniesForCategories(categories: string[], limit = 6): Promise<NgenCompany[]> {
  const seen = new Set<string>();
  const matches: NgenCompany[] = [];
  for (const category of categories) {
    for (const c of await getNgenCompaniesForCategory(category)) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      matches.push(c);
      if (matches.length >= limit) return matches;
    }
  }
  return matches;
}
