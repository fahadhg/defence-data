import Link from "next/link";
import type { Award } from "@/lib/awards";
import { effectiveOrgs } from "@/lib/org";
import { fmtDate, fmtMoney, categoryTone } from "@/lib/format";
import { Chip } from "./Chip";

const WINDOW_LABEL: Record<string, { label: string; tone: "red" | "accent" }> = {
  imminent: { label: "Recompete window: imminent", tone: "red" },
  near: { label: "Recompete window: near-term", tone: "accent" },
};

export function ExpiringRow({ award }: { award: Award }) {
  const w = award.expiryWindow ? WINDOW_LABEL[award.expiryWindow] : undefined;
  const orgs = effectiveOrgs(award);
  return (
    <div className="panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-medium leading-snug text-[0.95rem] truncate">{award.title}</h3>
          <div className="mt-1 text-sm">
            <span className="text-muted-2">Incumbent: </span>
            <Link href={`/vendors/${encodeURIComponent(award.vendor)}`} className="link-accent">
              {award.vendor || "Unknown vendor"}
            </Link>
            <span className="text-muted"> · </span>
            {orgs.length > 0 ? (
              <>
                <Link href={`/buyers/${encodeURIComponent(orgs[0])}`} className="text-muted hover:text-accent transition-colors">
                  {orgs[0]}
                </Link>
                {orgs.length > 1 && <span className="text-muted-2"> +{orgs.length - 1}</span>}
              </>
            ) : (
              <span className="text-muted">N/A</span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="mono font-semibold">{fmtMoney(award.value)}</div>
          {w && (
            <div className="mt-1">
              <Chip tone={w.tone}>{award.daysToExpiry}d left</Chip>
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {award.categories.slice(0, 4).map((c) => (
          <Chip key={c} tone={categoryTone(c)}>{c}</Chip>
        ))}
      </div>
      <div className="mt-3 text-xs text-muted-2 mono">
        Contract ends {fmtDate(award.contractEnd)} · awarded {fmtDate(award.awardDate)} · {award.ref}
      </div>
    </div>
  );
}
