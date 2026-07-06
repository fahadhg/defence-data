import { Suspense } from "react";
import Link from "next/link";
import { getItbRows, getItbSnapshot } from "@/lib/data";
import { queryItb, summarizeContractors } from "@/lib/itb";
import { ItbRow } from "@/components/ItbRow";
import { ItbFiltersBar } from "@/components/ItbFiltersBar";
import { StatTile } from "@/components/StatTile";
import { fmtMoney } from "@/lib/format";

export const metadata = { title: "Industrial & Technological Benefits | Defence Procurement Intelligence" };

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function IndustrialBenefitsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const page = Number(first(sp.page) ?? "1") || 1;

  const all = getItbRows();
  const result = queryItb(all, { q: first(sp.q), category: first(sp.category), page, pageSize: 20 });
  const snapshot = getItbSnapshot();
  const contractors = summarizeContractors(all);
  const totalObligation = all.reduce((s, r) => s + r.obligation, 0);
  const totalRemaining = all.reduce((s, r) => s + r.remainingObligation, 0);
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Industrial & Technological Benefits</h1>
        <p className="text-sm text-muted mt-0.5 max-w-2xl">
          When a prime wins a major defence contract, the ITB Policy requires it to generate
          Canadian industrial activity equal to the contract&apos;s value. Primes typically
          discharge this obligation by subcontracting to Canadian SMEs. This page shows that
          obligation, by prime and project, and how much of it remains outstanding.
          {snapshot.generatedAt && <> · updated {new Date(snapshot.generatedAt).toLocaleString("en-CA")}</>}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Total ITB obligation" value={fmtMoney(totalObligation)} tone="accent" />
        <StatTile label="Still outstanding" value={fmtMoney(totalRemaining)} tone="red" />
        <StatTile label="Prime contractors" value={String(contractors.length)} tone="blue" />
        <StatTile label="Projects tracked" value={String(all.length)} tone="green" />
      </div>

      <div>
        <h2 className="text-sm font-medium text-muted mb-3">Primes with the largest remaining obligation</h2>
        <div className="panel p-4 space-y-2">
          {contractors.slice(0, 10).map((c) => (
            <div key={c.contractor} className="flex items-center justify-between text-sm py-0.5">
              <span className="truncate pr-3 text-muted">{c.contractor}</span>
              <span className="mono text-xs text-muted-2 shrink-0">
                {fmtMoney(c.totalRemaining)} remaining · {c.projectCount} project{c.projectCount === 1 ? "" : "s"}
              </span>
            </div>
          ))}
        </div>
      </div>

      <Suspense>
        <ItbFiltersBar categories={result.facets.categories} />
      </Suspense>

      <div className="text-sm text-muted-2">
        {result.total.toLocaleString()} project{result.total === 1 ? "" : "s"}, sorted by remaining obligation
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {result.rows.map((r, i) => (
          <ItbRow key={`${r.contractor}-${r.project}-${i}`} row={r} />
        ))}
      </div>

      {result.rows.length === 0 && (
        <div className="panel p-8 text-center text-muted">No ITB projects match these filters.</div>
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

      <p className="text-xs text-muted-2 max-w-2xl">
        Source:{" "}
        <a href="https://ised-isde.canada.ca/site/industrial-technological-benefits/en/projects-and-obligations/report-contractor-progress/breakdown-current-obligations-contractor" target="_blank" rel="noopener noreferrer" className="link-accent">
          ISED Report on Contractor Progress
        </a>
        . &quot;Remaining&quot; = total obligation minus completed-to-date; it does not distinguish
        work already subcontracted from work still open to bid.
      </p>
    </div>
  );
}
