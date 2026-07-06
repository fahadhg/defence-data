import { Suspense } from "react";
import Link from "next/link";
import { queryContracts, getContractStats, getCategoryBreakdown, getTopVendors } from "@/lib/contract-history";
import { ContractRow } from "@/components/ContractRow";
import { ContractFiltersBar } from "@/components/ContractFiltersBar";
import { StatTile } from "@/components/StatTile";
import { fmtMoney, fmtDate } from "@/lib/format";

export const metadata = { title: "Deep Contract History | Defence Procurement Intelligence" };

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function ContractHistoryPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const page = Number(first(sp.page) ?? "1") || 1;

  const [result, stats, categories, topVendors] = await Promise.all([
    queryContracts({ q: first(sp.q), category: first(sp.category), page, pageSize: 20 }),
    getContractStats(),
    getCategoryBreakdown(),
    getTopVendors(10),
  ]);

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Deep Contract History</h1>
        <p className="text-sm text-muted mt-0.5 max-w-2xl">
          This is the government-wide proactive disclosure of contracts over $10,000, covering
          every federal department, {stats.earliestDate ? `back to ${fmtDate(stats.earliestDate)}` : "historical"}.
          It is the pre-CanadaBuys record. CanadaBuys award notices (see the Contract History page)
          are the system of record from August 2022 onward.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Defence-relevant contracts" value={stats.total.toLocaleString()} tone="accent" />
        <StatTile label="Total value" value={fmtMoney(stats.totalValue)} tone="green" />
        <StatTile label="Distinct vendors" value={stats.distinctVendors.toLocaleString()} tone="blue" />
        <StatTile label="Distinct departments" value={stats.distinctOrgs.toLocaleString()} tone="red" />
      </div>

      <div>
        <h2 className="text-sm font-medium text-muted mb-3">Top vendors by total contract value</h2>
        <div className="panel p-4 space-y-2">
          {topVendors.map((v) => (
            <Link
              key={v.vendorName}
              href={`/vendors/${encodeURIComponent(v.vendorName ?? "")}`}
              className="flex items-center justify-between text-sm py-0.5 hover:text-accent transition-colors"
            >
              <span className="truncate pr-3 text-muted">{v.vendorName}</span>
              <span className="mono text-xs text-muted-2 shrink-0">
                {fmtMoney(v.totalValue)} · {v.count} contracts
              </span>
            </Link>
          ))}
        </div>
      </div>

      <Suspense>
        <ContractFiltersBar categories={categories} />
      </Suspense>

      <div className="text-sm text-muted-2">
        {result.total.toLocaleString()} result{result.total === 1 ? "" : "s"}, sorted by value
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {result.rows.map((c) => (
          <ContractRow key={c.id} contract={c} />
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
