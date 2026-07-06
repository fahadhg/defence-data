import { Suspense } from "react";
import Link from "next/link";
import { getAwards, getAwardSnapshot } from "@/lib/data";
import { queryAwards } from "@/lib/awards";
import { AwardRow } from "@/components/AwardRow";
import { AwardFiltersBar } from "@/components/AwardFiltersBar";
import { fmtMoney, fmtUpdatedAt } from "@/lib/format";

export const metadata = { title: "Contract History | Defence Procurement Intelligence" };

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function AwardsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const page = Number(first(sp.page) ?? "1") || 1;

  const result = queryAwards(getAwards(), {
    q: first(sp.q),
    category: first(sp.category),
    fiscalYear: first(sp.fiscalYear),
    page,
    pageSize: 20,
  });
  const snapshot = getAwardSnapshot();
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Defence Contract History</h1>
        <p className="text-sm text-muted mt-0.5">
          {snapshot.matched.toLocaleString()} of {snapshot.feedTotal.toLocaleString()} awarded contracts (FY
          2022-2023 – present) match defence/dual-use signals
          {snapshot.generatedAt && <> · updated {fmtUpdatedAt(snapshot.generatedAt)}</>}
        </p>
      </div>

      <Suspense>
        <AwardFiltersBar categories={result.facets.categories} fiscalYears={result.facets.fiscalYears} />
      </Suspense>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-2">
          {result.total.toLocaleString()} result{result.total === 1 ? "" : "s"}
        </span>
        <span className="mono text-muted">Total value: {fmtMoney(result.totalValue)}</span>
      </div>

      <div className="grid gap-3">
        {result.rows.map((a) => (
          <AwardRow key={`${a.ref}-${a.contractNumber}`} award={a} />
        ))}
      </div>

      {result.rows.length === 0 && (
        <div className="panel p-8 text-center text-muted">No awards match these filters.</div>
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
