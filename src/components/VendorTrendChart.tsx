/**
 * Bar-per-year trend, single hue (magnitude over an ordered dimension: fiscal year).
 * Server component: no interaction needed. Bars have a fixed width rather than flex-1, so a
 * long-running department (decades of fiscal years) scrolls horizontally within its own box
 * instead of overflowing into neighboring UI.
 */
import { fmtMoney } from "@/lib/format";

export function VendorTrendChart({ data }: { data: { fiscalYear: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="overflow-x-auto">
      <div className="flex items-end gap-3 h-40 pt-4 min-w-min">
        {data.map((d) => (
          <div key={d.fiscalYear} className="w-16 shrink-0 flex flex-col items-center gap-2 h-full justify-end">
            <div className="text-xs mono text-muted-2 whitespace-nowrap">{fmtMoney(d.value)}</div>
            <div
              className="w-full rounded-t-[4px]"
              style={{
                height: `${Math.max((d.value / max) * 100, 3)}%`,
                background: "#3987e5",
                minHeight: 4,
              }}
            />
            <div className="text-xs text-muted-2 mono whitespace-nowrap">{d.fiscalYear}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
