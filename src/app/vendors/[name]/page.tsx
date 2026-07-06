import { notFound } from "next/navigation";
import Link from "next/link";
import { getAwards } from "@/lib/data";
import { summarizeVendor } from "@/lib/awards";
import { fmtMoney, fmtDate, categoryTone } from "@/lib/format";
import { Chip } from "@/components/Chip";
import { StatTile } from "@/components/StatTile";
import { VendorTrendChart } from "@/components/VendorTrendChart";
import { ExpiringRow } from "@/components/ExpiringRow";

type Params = Promise<{ name: string }>;

export default async function VendorPage({ params }: { params: Params }) {
  const { name } = await params;
  const vendorName = decodeURIComponent(name);
  const awards = getAwards();
  const summary = summarizeVendor(vendorName, awards);

  if (summary.awardCount === 0) notFound();

  const recent = awards
    .filter((a) => a.vendor === vendorName)
    .sort((a, b) => (b.awardDate || "").localeCompare(a.awardDate || ""))
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/awards" className="text-sm text-muted hover:text-foreground">
          ← Back to contract history
        </Link>
        <h1 className="text-xl font-semibold mt-2">{summary.name}</h1>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatTile label="Total contract value" value={fmtMoney(summary.totalValue)} tone="accent" />
        <StatTile label="Defence contracts" value={String(summary.awardCount)} tone="blue" />
        <StatTile label="Buying departments" value={String(summary.topBuyers.length)} tone="green" />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div>
          <h2 className="text-sm font-medium text-muted mb-3">Contract value by fiscal year</h2>
          <div className="panel p-4">
            <VendorTrendChart data={summary.byFiscalYear} />
          </div>
        </div>
        <div>
          <h2 className="text-sm font-medium text-muted mb-3">Top buying departments</h2>
          <div className="panel p-4 space-y-2">
            {summary.topBuyers.slice(0, 8).map((b) =>
              b.name ? (
                <Link
                  key={b.name}
                  href={`/buyers/${encodeURIComponent(b.name)}`}
                  className="flex items-center justify-between text-sm py-0.5 hover:text-accent transition-colors"
                >
                  <span className="truncate pr-3 text-muted">{b.name}</span>
                  <span className="mono text-xs text-muted-2 shrink-0">{fmtMoney(b.value)}</span>
                </Link>
              ) : (
                <div key="unknown" className="flex items-center justify-between text-sm">
                  <span className="truncate pr-3 text-muted">N/A</span>
                  <span className="mono text-xs text-muted-2 shrink-0">{fmtMoney(b.value)}</span>
                </div>
              ),
            )}
          </div>
        </div>
      </div>

      {summary.expiringContracts.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-muted mb-3">
            Upcoming recompete windows <span className="text-muted-2">: contracts where this vendor is the incumbent</span>
          </h2>
          <div className="grid gap-3">
            {summary.expiringContracts.slice(0, 5).map((a) => (
              <ExpiringRow key={`${a.ref}-${a.contractNumber}`} award={a} />
            ))}
          </div>
        </div>
      )}

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

      <div>
        <h2 className="text-sm font-medium text-muted mb-3">Recent contracts</h2>
        <div className="panel divide-y divide-line">
          {recent.map((a) => (
            <div key={`${a.ref}-${a.contractNumber}`} className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{a.title}</div>
                <div className="text-xs text-muted mt-0.5">
                  {a.buyer || "N/A"} · {fmtDate(a.awardDate)}
                </div>
              </div>
              <div className="mono text-sm shrink-0">{fmtMoney(a.value)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
