import type { StandingOffer } from "@/lib/standing-offers";
import { fmtDate, categoryTone } from "@/lib/format";
import { Chip } from "./Chip";

export function StandingOfferRow({ offer }: { offer: StandingOffer }) {
  return (
    <div className="panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-medium leading-snug text-[0.95rem] truncate">{offer.title}</h3>
          <div className="mt-1 text-sm text-muted">
            {offer.supplierName || "Unknown supplier"} <span className="text-muted-2">· {offer.endUser}</span>
          </div>
        </div>
        <Chip tone={offer.isExpired ? "muted" : "green"}>{offer.isExpired ? "Expired" : "Active"}</Chip>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {offer.categories.slice(0, 4).map((c) => (
          <Chip key={c} tone={categoryTone(c)}>{c}</Chip>
        ))}
        <Chip>{offer.agreementType}</Chip>
      </div>
      <div className="mt-3 text-xs text-muted-2 mono">
        {fmtDate(offer.awardDate)} → {fmtDate(offer.expiryDate)} · {offer.agreementNumber}
      </div>
    </div>
  );
}
