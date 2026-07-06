import { notFound } from "next/navigation";
import Link from "next/link";
import { getTenderByRef } from "@/lib/data";
import { fmtDate, closeBadge, categoryTone } from "@/lib/format";
import { Chip } from "@/components/Chip";

type Params = Promise<{ ref: string }>;

export default async function TenderDetailPage({ params }: { params: Params }) {
  const { ref } = await params;
  const tender = getTenderByRef(decodeURIComponent(ref));
  if (!tender) notFound();

  const badge = closeBadge(tender.daysToClose);

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/tenders" className="text-sm text-muted hover:text-foreground">
        ← Back to tenders
      </Link>

      <div>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl font-semibold leading-snug">{tender.title}</h1>
          <Chip tone={badge.tone}>{badge.label}</Chip>
        </div>
        <p className="mt-1 text-muted">{tender.buyer}</p>
        {tender.endUser && <p className="text-sm text-muted-2">End user: {tender.endUser}</p>}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {tender.categories.map((c) => (
          <Chip key={c} tone={categoryTone(c)}>{c}</Chip>
        ))}
        <Chip>{tender.categoryLabel}</Chip>
        <Chip>{tender.status}</Chip>
      </div>

      <div className="panel p-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
        <Field label="Published" value={fmtDate(tender.published)} />
        <Field label="Closes" value={fmtDate(tender.closes)} />
        <Field label="Reference #" value={tender.ref} mono />
        <Field label="Notice type" value={tender.noticeType} />
        <Field label="Procurement method" value={tender.method} />
        <Field label="Delivery region" value={tender.delivery || tender.regions || "—"} />
        {tender.gsin && <Field label="GSIN" value={`${tender.gsinCode ? tender.gsinCode + " — " : ""}${tender.gsin}`} />}
        {tender.unspsc && <Field label="UNSPSC" value={tender.unspsc} />}
      </div>

      {tender.description && (
        <div>
          <h2 className="text-sm font-medium text-muted mb-2">Description</h2>
          <div className="panel p-4 text-sm leading-relaxed whitespace-pre-wrap">{tender.description}</div>
        </div>
      )}

      <div>
        <h2 className="text-sm font-medium text-muted mb-2">Why this matched</h2>
        <ul className="panel p-4 text-sm space-y-1.5">
          {tender.matchReasons.map((r, i) => (
            <li key={i} className="text-muted flex gap-2">
              <span className="text-accent">›</span> {r}
            </li>
          ))}
        </ul>
      </div>

      {(tender.contactName || tender.contactEmail) && (
        <div>
          <h2 className="text-sm font-medium text-muted mb-2">Contact</h2>
          <div className="panel p-4 text-sm">
            {tender.contactName && <div>{tender.contactName}</div>}
            {tender.contactEmail && (
              <a href={`mailto:${tender.contactEmail}`} className="link-accent">
                {tender.contactEmail}
              </a>
            )}
          </div>
        </div>
      )}

      {tender.url && (
        <a
          href={tender.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-4 py-2 rounded-md bg-accent text-accent-ink text-sm font-medium"
        >
          View & bid on CanadaBuys →
        </a>
      )}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-2 uppercase tracking-wide">{label}</div>
      <div className={mono ? "mono text-xs mt-0.5" : "mt-0.5"}>{value || "—"}</div>
    </div>
  );
}
