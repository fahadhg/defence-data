import Link from "next/link";
import { getTenders, getItbRows, getStandingOffers } from "@/lib/data";
import { searchNgenCompanies, getNgenCompanyById, classifyCompanyCategories } from "@/lib/ngen-members";
import { TenderCard } from "@/components/TenderCard";
import { ItbRow } from "@/components/ItbRow";
import { StandingOfferRow } from "@/components/StandingOfferRow";
import { Chip } from "@/components/Chip";
import { categoryTone } from "@/lib/format";

export const metadata = { title: "Opportunity Finder | Defence Procurement Intelligence" };

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function OpportunityFinderPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const q = first(sp.q);
  const companyId = first(sp.company);

  const company = companyId ? await getNgenCompanyById(companyId) : undefined;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Opportunity Finder</h1>
        <p className="text-sm text-muted mt-0.5 max-w-2xl">
          Find your company, and see the open tenders, ITB subcontracting opportunities, and
          standing offers that match what you build - matched by capability category, the same
          taxonomy used everywhere else on this site.
        </p>
      </div>

      <form action="/opportunity-finder" method="GET" className="flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search your company name..."
          className="flex-1 bg-panel-2 border border-line rounded-md px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
        />
        <button type="submit" className="px-4 py-2 rounded-md bg-accent text-accent-ink text-sm font-medium">
          Search
        </button>
      </form>

      {!company && q && <SearchResults q={q} />}

      {!company && !q && (
        <p className="text-xs text-muted-2">
          Company profiles are sourced from the{" "}
          <a href="https://ngen-connect-web.vercel.app" target="_blank" rel="noopener noreferrer" className="link-accent">
            NGen Connect
          </a>{" "}
          member directory. Descriptions are AI-extracted from public websites and may
          occasionally be inaccurate - if your matches look off, it&apos;s worth checking what
          your company&apos;s website actually says about its capabilities.
        </p>
      )}

      {company && <CompanyMatches company={company} />}
    </div>
  );
}

async function SearchResults({ q }: { q: string }) {
  const results = await searchNgenCompanies(q, 20);
  if (results.length === 0) {
    return <div className="panel p-6 text-center text-muted text-sm">No member companies match &quot;{q}&quot;.</div>;
  }
  return (
    <div className="panel divide-y divide-line">
      {results.map((c) => (
        <Link
          key={c.id}
          href={`/opportunity-finder?company=${encodeURIComponent(c.id)}`}
          className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-panel-2 transition-colors"
        >
          <span className="truncate">{c.companyName}</span>
          <span className="text-xs text-muted-2 shrink-0">{c.site}</span>
        </Link>
      ))}
    </div>
  );
}

async function CompanyMatches({ company }: { company: { id: string; companyName: string; site: string; homepage: string; capabilities: string[]; products: string[] } }) {
  const categories = classifyCompanyCategories(company);

  if (categories.length === 0) {
    return (
      <div className="panel p-6">
        <h2 className="font-medium">{company.companyName}</h2>
        <p className="mt-2 text-sm text-muted">
          No capability category was detected from this company&apos;s profile, so there&apos;s
          nothing to match against yet. This usually means the extracted profile doesn&apos;t
          mention specific capabilities or products in a way the matcher recognizes.
        </p>
        <Link href="/opportunity-finder" className="mt-3 inline-block text-sm link-accent">
          ← Search a different company
        </Link>
      </div>
    );
  }

  const tenders = getTenders()
    .filter((t) => t.categories.some((c) => categories.includes(c)))
    .sort((a, b) => (a.daysToClose ?? Infinity) - (b.daysToClose ?? Infinity))
    .slice(0, 9);

  const itbRows = getItbRows()
    .filter((r) => r.categories.some((c) => categories.includes(c)))
    .sort((a, b) => b.remainingObligation - a.remainingObligation)
    .slice(0, 6);

  const standingOffers = getStandingOffers()
    .filter((o) => o.categories.some((c) => categories.includes(c)) && !o.isExpired)
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="panel p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-medium">{company.companyName}</h2>
            <a href={company.homepage || `https://${company.site}`} target="_blank" rel="noopener noreferrer" className="text-xs link-accent">
              {company.site}
            </a>
          </div>
          <Link href="/opportunity-finder" className="text-xs text-muted hover:text-foreground shrink-0">
            change company
          </Link>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <Chip key={c} tone={categoryTone(c)}>{c}</Chip>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-medium text-muted">Open tenders matching your capabilities</h2>
          <Link href="/tenders" className="text-xs link-accent">browse all →</Link>
        </div>
        {tenders.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {tenders.map((t) => (
              <TenderCard key={t.ref} tender={t} />
            ))}
          </div>
        ) : (
          <div className="panel p-6 text-center text-muted text-sm">No open tenders currently match these categories.</div>
        )}
      </div>

      <div>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-medium text-muted">
            ITB subcontracting opportunities <span className="text-muted-2 font-normal">: primes that owe work in your space</span>
          </h2>
          <Link href="/industrial-benefits" className="text-xs link-accent">browse all →</Link>
        </div>
        {itbRows.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {itbRows.map((r, i) => (
              <ItbRow key={`${r.contractor}-${r.project}-${i}`} row={r} />
            ))}
          </div>
        ) : (
          <div className="panel p-6 text-center text-muted text-sm">No ITB obligations currently match these categories.</div>
        )}
      </div>

      <div>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-medium text-muted">Active standing offers &amp; supply arrangements</h2>
          <Link href="/standing-offers" className="text-xs link-accent">browse all →</Link>
        </div>
        {standingOffers.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {standingOffers.map((o, i) => (
              <StandingOfferRow key={`${o.agreementNumber}-${o.supplierName}-${i}`} offer={o} />
            ))}
          </div>
        ) : (
          <div className="panel p-6 text-center text-muted text-sm">No active standing offers currently match these categories.</div>
        )}
      </div>

      <p className="text-xs text-muted-2">
        Matches are keyword-based on this company&apos;s self-described capabilities and products,
        the same taxonomy used to classify every tender, award, and ITB project on this site.
        Company data is AI-extracted from public websites and may occasionally be inaccurate.
      </p>
    </div>
  );
}
