import { Suspense } from "react";
import Link from "next/link";
import { getStandingOffers, getStandingOfferSnapshot } from "@/lib/data";
import { queryStandingOffers, groupArrangements } from "@/lib/standing-offers";
import { StandingOfferRow } from "@/components/StandingOfferRow";
import { ArrangementCard } from "@/components/ArrangementCard";
import { StandingOfferFiltersBar } from "@/components/StandingOfferFiltersBar";
import { StatTile } from "@/components/StatTile";
import { fmtUpdatedAt } from "@/lib/format";

export const metadata = { title: "Standing Offers | Defence Procurement Intelligence" };

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function StandingOffersPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const page = Number(first(sp.page) ?? "1") || 1;
  const view = first(sp.view) === "arrangements" ? "arrangements" : "supplier";

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

  const q = first(sp.q)?.toLowerCase();
  const category = first(sp.category);
  const arrangements = groupArrangements(
    all.filter(
      (o) =>
        (!q || o.title.toLowerCase().includes(q) || o.commodity.toLowerCase().includes(q) || o.supplierName.toLowerCase().includes(q)) &&
        (!category || o.categories.includes(category)),
    ),
  ).sort((a, b) => (a.agreementType === "SA" ? -1 : 0) - (b.agreementType === "SA" ? -1 : 0) || b.supplierCount - a.supplierCount);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Standing Offers & Supply Arrangements</h1>
        <p className="text-sm text-muted mt-0.5 max-w-2xl">
          Pre-qualified supplier vehicles for defence and dual-use categories. These are often the
          entry ticket to federal defence work, since many buys happen only against existing
          holders rather than through a fresh open tender.
          {snapshot.generatedAt && <> · updated {fmtUpdatedAt(snapshot.generatedAt)}</>}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatTile label="Defence-relevant vehicles" value={String(all.length)} tone="accent" />
        <StatTile label="Currently active" value={String(activeCount)} tone="green" />
        <StatTile label="Distinct suppliers" value={String(new Set(all.map((o) => o.supplierName).filter(Boolean)).size)} tone="blue" />
      </div>

      <div className="flex items-center gap-1 text-sm border-b border-line">
        <Link
          href={`?${new URLSearchParams({ ...sp, view: "supplier" } as Record<string, string>).toString()}`}
          className={`px-3 py-2 -mb-px border-b-2 ${view === "supplier" ? "border-accent text-foreground" : "border-transparent text-muted hover:text-foreground"}`}
        >
          By supplier
        </Link>
        <Link
          href={`?${new URLSearchParams({ ...sp, view: "arrangements" } as Record<string, string>).toString()}`}
          className={`px-3 py-2 -mb-px border-b-2 ${view === "arrangements" ? "border-accent text-foreground" : "border-transparent text-muted hover:text-foreground"}`}
        >
          First-time bidder pathways
        </Link>
      </div>

      <Suspense>
        <StandingOfferFiltersBar categories={result.facets.categories} />
      </Suspense>

      {view === "arrangements" ? (
        <>
          <p className="text-xs text-muted-2 max-w-2xl">
            Grouped by vehicle rather than by supplier. Supply Arrangements are the vehicle type PSPC
            generally keeps open to new suppliers qualifying on an ongoing basis; Standing Offers are
            typically a fixed roster set at competition time. Supplier count is a useful signal, not a
            live read of whether a vehicle is accepting applications today.
          </p>
          <div className="text-sm text-muted-2">
            {arrangements.length.toLocaleString()} arrangement{arrangements.length === 1 ? "" : "s"}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {arrangements.map((a) => (
              <ArrangementCard key={a.title} arrangement={a} />
            ))}
          </div>
          {arrangements.length === 0 && (
            <div className="panel p-8 text-center text-muted">No arrangements match these filters.</div>
          )}
        </>
      ) : (
        <>
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
        </>
      )}

      {view === "supplier" && totalPages > 1 && (
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
