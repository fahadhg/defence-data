import Link from "next/link";
import { getAwards } from "@/lib/data";
import { buyerLeaderboard } from "@/lib/buyers";
import { fmtMoney } from "@/lib/format";
import { Chip } from "@/components/Chip";

export const metadata = { title: "Buyer Intelligence | Defence Procurement Intelligence" };

function pct(n: number | null): string {
  return n === null ? "N/A" : `${Math.round(n * 100)}%`;
}

export default function BuyersPage() {
  const rows = buyerLeaderboard(getAwards());

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Buyer Intelligence</h1>
        <p className="text-sm text-muted mt-0.5 max-w-2xl">
          Defence buying departments ranked by total awarded value, along with each buyer&apos;s
          sole-source rate. This is the share of its awards that bypass full open competition
          (non-competitive, limited tendering, or ACAN).
        </p>
      </div>

      <div className="panel divide-y divide-line">
        {rows.map((b) => (
          <Link
            key={b.name}
            href={`/buyers/${encodeURIComponent(b.name)}`}
            className="p-4 flex items-center justify-between gap-3 hover:bg-panel-2 transition-colors"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{b.name}</div>
              <div className="text-xs text-muted mt-0.5">{b.awardCount} defence contracts</div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {b.soleSourceRate !== null && (
                <Chip tone={b.soleSourceRate > 0.5 ? "red" : "green"}>
                  {pct(b.soleSourceRate)} sole-source
                </Chip>
              )}
              <span className="mono text-sm w-28 text-right">{fmtMoney(b.totalValue)}</span>
            </div>
          </Link>
        ))}
      </div>

      {rows.length === 0 && (
        <div className="panel p-8 text-center text-muted">No buyer data available.</div>
      )}
    </div>
  );
}
