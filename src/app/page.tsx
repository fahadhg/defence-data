import Link from "next/link";
import { getTenders, getSnapshot, getAwards } from "@/lib/data";
import { queryTenders } from "@/lib/tenders";
import { queryAwards } from "@/lib/awards";
import { StatTile } from "@/components/StatTile";
import { CategoryBarChart } from "@/components/CategoryBarChart";
import { TenderCard } from "@/components/TenderCard";
import { fmtMoney } from "@/lib/format";

export default function OverviewPage() {
  const all = getTenders();
  const snapshot = getSnapshot();
  const result = queryTenders(all, { pageSize: 1000 });

  const awards = getAwards();
  const awardResult = queryAwards(awards, { pageSize: 1000 });

  const closingSoon = all.filter((t) => t.closingSoon);
  const openCount = all.filter((t) => t.daysToClose === null || t.daysToClose >= 0).length;
  const distinctBuyers = new Set(all.map((t) => t.buyer).filter(Boolean)).size;

  const closingSoonestFirst = [...closingSoon].sort(
    (a, b) => (a.daysToClose ?? Infinity) - (b.daysToClose ?? Infinity),
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Canada Defence Procurement Intelligence</h1>
        <p className="mt-1.5 text-muted max-w-2xl">
          Live tenders and federal contracting history for defence & dual-use manufacturers — filtered from
          the full CanadaBuys open-data feed by buyer, GSIN classification, and capability keywords.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Open defence tenders" value={String(openCount)} tone="accent" />
        <StatTile
          label="Closing within 14 days"
          value={String(closingSoon.length)}
          tone="red"
          sub={closingSoon.length > 0 ? "act soon" : undefined}
        />
        <StatTile label="Capability categories" value={String(result.facets.categories.length)} tone="blue" />
        <StatTile label="Distinct buyers" value={String(distinctBuyers)} tone="green" />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-sm font-medium text-muted">Open tenders by capability category</h2>
            <Link href="/tenders" className="text-xs link-accent">
              browse all →
            </Link>
          </div>
          <div className="panel p-4">
            <CategoryBarChart data={result.facets.categories} />
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-sm font-medium text-muted">Top defence contractors by contract value</h2>
            <Link href="/awards" className="text-xs link-accent">
              browse all →
            </Link>
          </div>
          <div className="panel p-4 space-y-2">
            {awardResult.facets.topVendors.slice(0, 10).map((v) => (
              <Link
                key={v.name}
                href={`/vendors/${encodeURIComponent(v.name)}`}
                className="flex items-center justify-between text-sm py-1 hover:text-accent transition-colors"
              >
                <span className="truncate pr-3 text-muted">{v.name}</span>
                <span className="mono text-xs text-muted-2 shrink-0">{fmtMoney(v.totalValue)}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatTile label="Total defence contract value (FY22–present)" value={fmtMoney(awardResult.totalValue)} tone="accent" />
        <StatTile label="Defence contracts awarded" value={awardResult.total.toLocaleString()} tone="blue" />
        <StatTile label="Distinct defence contractors" value={String(awardResult.facets.topVendors.length > 0 ? new Set(awards.map((a) => a.vendor).filter(Boolean)).size : 0)} tone="green" />
      </div>

      <div>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-medium text-muted">Closing soonest</h2>
          <Link href="/tenders?closingSoon=1" className="text-xs link-accent">
            view all →
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {closingSoonestFirst.slice(0, 6).map((t) => (
            <TenderCard key={t.ref} tender={t} />
          ))}
        </div>
        {closingSoonestFirst.length === 0 && (
          <div className="panel p-8 text-center text-muted text-sm">
            No tenders closing in the next 14 days.
          </div>
        )}
      </div>

      {snapshot.generatedAt && (
        <p className="text-xs text-muted-2">
          Snapshot generated {new Date(snapshot.generatedAt).toLocaleString("en-CA")} from CanadaBuys open
          tender notices.
        </p>
      )}
    </div>
  );
}
