import Link from "next/link";
import type { Tender } from "@/lib/tenders";
import { fmtDate, closeBadge, categoryTone } from "@/lib/format";
import { Chip } from "./Chip";

export function TenderCard({ tender }: { tender: Tender }) {
  const badge = closeBadge(tender.daysToClose);
  return (
    <Link
      href={`/tenders/${encodeURIComponent(tender.ref)}`}
      className="panel block p-4 hover:border-line-strong transition-colors group"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium leading-snug text-[0.95rem] group-hover:text-accent transition-colors">
          {tender.title}
        </h3>
        <Chip tone={badge.tone}>{badge.label}</Chip>
      </div>
      <div className="mt-1.5 text-sm text-muted">{tender.buyer || "N/A"}</div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {tender.categories.slice(0, 4).map((c) => (
          <Chip key={c} tone={categoryTone(c)}>{c}</Chip>
        ))}
        <Chip>{tender.categoryLabel}</Chip>
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-muted-2 mono">
        <span>Closes {fmtDate(tender.closes)}</span>
        <span className="truncate">{tender.ref}</span>
      </div>
    </Link>
  );
}
