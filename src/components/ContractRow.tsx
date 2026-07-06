import Link from "next/link";
import type { Contract } from "@/db/schema";
import { fmtDate, fmtMoney, categoryTone } from "@/lib/format";
import { Chip } from "./Chip";

export function ContractRow({ contract }: { contract: Contract }) {
  return (
    <div className="panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-medium leading-snug text-[0.95rem] truncate">
            {contract.descriptionEn || "(no description)"}
          </h3>
          <div className="mt-1 text-sm">
            {contract.vendorName ? (
              <Link href={`/vendors/${encodeURIComponent(contract.vendorName)}`} className="link-accent">
                {contract.vendorName}
              </Link>
            ) : (
              <span className="text-muted">Unknown vendor</span>
            )}
            <span className="text-muted"> · {contract.ownerOrgTitle || contract.buyerName || "N/A"}</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="mono font-semibold">{contract.contractValue ? fmtMoney(contract.contractValue) : "N/A"}</div>
          <div className="text-xs text-muted-2 mt-0.5">{fmtDate(contract.contractDate ?? "")}</div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {contract.categories.map((c) => (
          <Chip key={c} tone={categoryTone(c)}>{c}</Chip>
        ))}
      </div>
      <div className="mt-3 text-xs text-muted-2 mono">{contract.id}</div>
    </div>
  );
}
