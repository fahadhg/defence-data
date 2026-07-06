import Link from "next/link";
import type { Award } from "@/lib/awards";
import { fmtDate, fmtMoney, categoryTone } from "@/lib/format";
import { Chip } from "./Chip";

export function AwardRow({ award }: { award: Award }) {
  return (
    <div className="panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-medium leading-snug text-[0.95rem] truncate">{award.title}</h3>
          <div className="mt-1 text-sm">
            <Link href={`/vendors/${encodeURIComponent(award.vendor)}`} className="link-accent">
              {award.vendor || "Unknown vendor"}
            </Link>
            <span className="text-muted"> — {award.buyer || "—"}</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="mono font-semibold">{fmtMoney(award.value)}</div>
          <div className="text-xs text-muted-2 mt-0.5">{award.fiscalYear}</div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {award.categories.slice(0, 4).map((c) => (
          <Chip key={c} tone={categoryTone(c)}>{c}</Chip>
        ))}
      </div>
      <div className="mt-3 text-xs text-muted-2 mono">
        Awarded {fmtDate(award.awardDate)} · {award.ref}
      </div>
    </div>
  );
}
