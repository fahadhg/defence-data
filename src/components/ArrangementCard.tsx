import type { SupplierArrangement } from "@/lib/standing-offers";
import { categoryTone } from "@/lib/format";
import { Chip } from "./Chip";

export function ArrangementCard({ arrangement }: { arrangement: SupplierArrangement }) {
  const a = arrangement;
  return (
    <div className="panel p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium leading-snug text-[0.95rem] min-w-0">{a.title}</h3>
        <Chip tone={a.anyActive ? "green" : "muted"}>{a.anyActive ? "Active" : "Expired"}</Chip>
      </div>
      <div className="mt-1 text-sm text-muted">{a.endUser}</div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Chip tone={a.agreementType === "SA" ? "accent" : ""}>{a.agreementTypeLabel}</Chip>
        {a.categories.slice(0, 3).map((c) => (
          <Chip key={c} tone={categoryTone(c)}>{c}</Chip>
        ))}
      </div>

      <div className="mt-3 text-sm">{a.opennessLabel}</div>

      <div className="mt-2 text-xs text-muted-2 leading-relaxed">
        {a.suppliers.slice(0, 6).join(", ")}
        {a.suppliers.length > 6 && ` +${a.suppliers.length - 6} more`}
      </div>
    </div>
  );
}
