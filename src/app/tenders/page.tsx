import { Suspense } from "react";
import { getTenders, getSnapshot } from "@/lib/data";
import { queryTenders } from "@/lib/tenders";
import { TenderCard } from "@/components/TenderCard";
import { TenderFiltersBar } from "@/components/TenderFiltersBar";
import Link from "next/link";

export const metadata = { title: "Tenders | Defence Procurement Intelligence" };

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function TendersPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const page = Number(first(sp.page) ?? "1") || 1;

  const result = queryTenders(getTenders(), {
    q: first(sp.q),
    category: first(sp.category),
    procurement: first(sp.procurement),
    closingSoon: first(sp.closingSoon) === "1",
    page,
    pageSize: 24,
  });
  const snapshot = getSnapshot();

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-semibold">Open Defence & Dual-Use Tenders</h1>
          <p className="text-sm text-muted mt-0.5">
            {snapshot.matched} of {snapshot.feedTotal} open tenders on CanadaBuys match defence/dual-use signals
            {snapshot.generatedAt && (
              <> · updated {new Date(snapshot.generatedAt).toLocaleString("en-CA")}</>
            )}
          </p>
        </div>
      </div>

      <Suspense>
        <TenderFiltersBar categories={result.facets.categories} procurementTypes={result.facets.procurement} />
      </Suspense>

      <div className="text-sm text-muted-2">
        {result.total} result{result.total === 1 ? "" : "s"}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {result.rows.map((t) => (
          <TenderCard key={t.ref} tender={t} />
        ))}
      </div>

      {result.rows.length === 0 && (
        <div className="panel p-8 text-center text-muted">No tenders match these filters.</div>
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
