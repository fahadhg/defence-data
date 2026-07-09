import type { ItbObligation } from "@/lib/itb";
import type { NgenCompany } from "@/lib/ngen-members";
import { fmtMoney, categoryTone } from "@/lib/format";
import { Chip } from "./Chip";

export function ItbRow({ row, leads }: { row: ItbObligation; leads?: NgenCompany[] }) {
  const pct = row.percentComplete !== null ? Math.round(row.percentComplete * 100) : null;
  return (
    <div className="panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-medium leading-snug text-[0.95rem] truncate">{row.project}</h3>
          <div className="mt-1 text-sm text-muted">{row.contractor}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="mono font-semibold text-accent">{fmtMoney(row.remainingObligation)}</div>
          <div className="text-xs text-muted-2 mt-0.5">still to be discharged</div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {row.categories.map((c) => (
          <Chip key={c} tone={categoryTone(c)}>{c}</Chip>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3 text-xs text-muted-2 mono">
        <span>Total obligation {fmtMoney(row.obligation)}</span>
        {pct !== null && <span>{pct}% complete</span>}
        {row.estimatedTimeframe && <span>{row.estimatedTimeframe}</span>}
      </div>

      {leads && leads.length > 0 && (
        <div className="mt-3 pt-3 border-t border-line">
          <div className="text-xs text-muted-2">
            {row.toBeIdentified > 0 ? (
              <>{fmtMoney(row.toBeIdentified)} of this is still unidentified. Potential subcontracting leads:</>
            ) : (
              "NGen members in this capability area:"
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            {leads.map((c) => (
              <a
                key={c.id}
                href={c.homepage || `https://${c.site}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs link-accent"
              >
                {c.companyName}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
