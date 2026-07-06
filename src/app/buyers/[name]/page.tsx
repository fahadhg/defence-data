import { notFound } from "next/navigation";
import Link from "next/link";
import { getAwards } from "@/lib/data";
import { summarizeBuyer } from "@/lib/buyers";
import { fmtMoney, categoryTone } from "@/lib/format";
import { Chip } from "@/components/Chip";
import { StatTile } from "@/components/StatTile";
import { VendorTrendChart } from "@/components/VendorTrendChart";

type Params = Promise<{ name: string }>;

function pct(n: number | null): string {
  return n === null ? "N/A" : `${Math.round(n * 100)}%`;
}

export default async function BuyerPage({ params }: { params: Params }) {
  const { name } = await params;
  const buyerName = decodeURIComponent(name);
  const awards = getAwards();
  const summary = summarizeBuyer(buyerName, awards);

  if (summary.awardCount === 0) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/buyers" className="text-sm text-muted hover:text-foreground">
          ← Back to buyers
        </Link>
        <h1 className="text-xl font-semibold mt-2">{summary.name}</h1>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Total defence spend" value={fmtMoney(summary.totalValue)} tone="accent" />
        <StatTile label="Contracts awarded" value={String(summary.awardCount)} tone="blue" />
        <StatTile
          label="Sole-source rate"
          value={pct(summary.soleSourceRate)}
          tone={summary.soleSourceRate !== null && summary.soleSourceRate > 0.5 ? "red" : "green"}
          sub={`${summary.soleSourceCount} of ${summary.methodKnownCount} with known method`}
        />
        <StatTile
          label="Top-3 vendor concentration"
          value={pct(summary.top3Share)}
          tone={summary.top3Share !== null && summary.top3Share > 0.6 ? "red" : "green"}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div>
          <h2 className="text-sm font-medium text-muted mb-3">Spend by fiscal year</h2>
          <div className="panel p-4">
            <VendorTrendChart data={summary.byFiscalYear} />
          </div>
        </div>
        <div>
          <h2 className="text-sm font-medium text-muted mb-3">Top vendors (incumbency concentration)</h2>
          <div className="panel p-4 space-y-2">
            {summary.topVendors.slice(0, 8).map((v) => (
              <Link
                key={v.name}
                href={`/vendors/${encodeURIComponent(v.name)}`}
                className="flex items-center justify-between text-sm py-1 hover:text-accent transition-colors"
              >
                <span className="truncate pr-3 text-muted">{v.name || "N/A"}</span>
                <span className="mono text-xs text-muted-2 shrink-0">
                  {fmtMoney(v.value)} · {Math.round(v.share * 100)}%
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-medium text-muted mb-3">Capability categories</h2>
        <div className="flex flex-wrap gap-1.5">
          {summary.categories.map((c) => (
            <Chip key={c.name} tone={categoryTone(c.name)}>
              {c.name} <span className="text-muted-2 ml-1">{c.count}</span>
            </Chip>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-2 max-w-2xl">
        Sole-source rate is the share of awards using non-competitive, limited-tendering, or
        advance contract award notice (ACAN) methods, among awards with a known procurement
        method. CanadaBuys open data does not publish bid counts or losing bidders, so this
        measures how open a buyer&apos;s competitions are. It is not a literal win rate.
      </p>
    </div>
  );
}
