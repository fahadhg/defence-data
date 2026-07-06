/**
 * Simple bar-per-year trend, single hue (magnitude over an ordered dimension — fiscal year).
 * Server component: no interaction needed for a small, fixed set of years.
 */
import { fmtMoney } from "@/lib/format";

export function VendorTrendChart({ data }: { data: { fiscalYear: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-3 h-40 pt-4">
      {data.map((d) => (
        <div key={d.fiscalYear} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
          <div className="text-xs mono text-muted-2">{fmtMoney(d.value)}</div>
          <div
            className="w-full rounded-t-[4px]"
            style={{
              height: `${Math.max((d.value / max) * 100, 3)}%`,
              background: "#3987e5",
              minHeight: 4,
            }}
          />
          <div className="text-xs text-muted-2 mono">{d.fiscalYear}</div>
        </div>
      ))}
    </div>
  );
}
