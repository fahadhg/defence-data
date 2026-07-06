import { Suspense } from "react";
import Link from "next/link";
import { getAwards } from "@/lib/data";
import { queryExpiring } from "@/lib/awards";
import { StatTile } from "@/components/StatTile";
import { ExpiringFiltersBar } from "@/components/ExpiringFiltersBar";
import { ExpiringRow } from "@/components/ExpiringRow";
import { fmtMoney } from "@/lib/format";

export const metadata = { title: "Contract Expiry Radar | Defence Procurement Intelligence" };

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function ExpiringPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const page = Number(first(sp.page) ?? "1") || 1;
  const window = first(sp.window) as "imminent" | "near" | undefined;

  const result = queryExpiring(getAwards(), {
    q: first(sp.q),
    category: first(sp.category),
    window,
    page,
    pageSize: 20,
  });
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Contract Expiry Radar</h1>
        <p className="text-sm text-muted mt-0.5 max-w-2xl">
          These are defence contracts whose current term is ending soon, historically the leading
          indicator of a recompete tender, often appearing 6 to 18 months before an RFP is
          published. An expiring contract names today&apos;s incumbent. It does not guarantee a
          re-tender.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Imminent (≤6 months)" value={String(result.imminentCount)} tone="red" />
        <StatTile label="Imminent value" value={fmtMoney(result.imminentValue)} tone="red" />
        <StatTile label="Near-term (6–18 months)" value={String(result.nearCount)} tone="accent" />
        <StatTile label="Near-term value" value={fmtMoney(result.nearValue)} tone="accent" />
      </div>

      <Suspense>
        <ExpiringFiltersBar categories={result.facets.categories} />
      </Suspense>

      <div className="text-sm text-muted-2">
        {result.total.toLocaleString()} contract{result.total === 1 ? "" : "s"}
      </div>

      <div className="grid gap-3">
        {result.rows.map((a) => (
          <ExpiringRow key={`${a.ref}-${a.contractNumber}`} award={a} />
        ))}
      </div>

      {result.rows.length === 0 && (
        <div className="panel p-8 text-center text-muted">No contracts match these filters.</div>
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
