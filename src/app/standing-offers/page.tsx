import { Suspense } from "react";
import Link from "next/link";
import { getStandingOffers, getStandingOfferSnapshot } from "@/lib/data";
import { queryStandingOffers } from "@/lib/standing-offers";
import { StandingOfferRow } from "@/components/StandingOfferRow";
import { StandingOfferFiltersBar } from "@/components/StandingOfferFiltersBar";
import { StatTile } from "@/components/StatTile";

export const metadata = { title: "Standing Offers | Defence Procurement Intelligence" };

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function StandingOffersPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const page = Number(first(sp.page) ?? "1") || 1;

  const all = getStandingOffers();
  const result = queryStandingOffers(all, {
    q: first(sp.q),
    category: first(sp.category),
    activeOnly: first(sp.activeOnly) === "1",
    page,
    pageSize: 24,
  });
  const snapshot = getStandingOfferSnapshot();
  const activeCount = all.filter((o) => !o.isExpired).length;
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Standing Offers & Supply Arrangements</h1>
        <p className="text-sm text-muted mt-0.5 max-w-2xl">
          Pre-qualified supplier vehicles for defence and dual-use categories. These are often the
          entry ticket to federal defence work, since many buys happen only against existing
          holders rather than through a fresh open tender.
          {snapshot.generatedAt && <> · updated {new Date(snapshot.generatedAt).toLocaleString("en-CA")}</>}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatTile label="Defence-relevant vehicles" value={String(all.length)} tone="accent" />
        <StatTile label="Currently active" value={String(activeCount)} tone="green" />
        <StatTile label="Distinct suppliers" value={String(new Set(all.map((o) => o.supplierName).filter(Boolean)).size)} tone="blue" />
      </div>

      <Suspense>
        <StandingOfferFiltersBar categories={result.facets.categories} />
      </Suspense>

      <div className="text-sm text-muted-2">
        {result.total.toLocaleString()} result{result.total === 1 ? "" : "s"}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {result.rows.map((o, i) => (
          <StandingOfferRow key={`${o.agreementNumber}-${o.supplierName}-${i}`} offer={o} />
        ))}
      </div>

      {result.rows.length === 0 && (
        <div className="panel p-8 text-center text-muted">No standing offers match these filters.</div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2 text-sm">
          {page > 1 && (
            <Link className="chip" href={`?${new URLSearchParams({ ...sp, page: String(page - 1) } as Record<string, string>).toString()}`}>
              ← Previous
            </Link>
          )}
          <span className="text-muted-2 mono">
            page {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link className="chip" href={`?${new URLSearchParams({ ...sp, page: String(page + 1) } as Record<string, string>).toString()}`}>
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
