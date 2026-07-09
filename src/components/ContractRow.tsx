import Link from "next/link";
import type { Contract } from "@/db/schema";
import type { ItbMatch } from "@/lib/itb-match";
import { fmtDate, fmtMoney, categoryTone, stripEmDash } from "@/lib/format";
import { Chip } from "./Chip";

type ContractWithItbMatch = Contract & { itbMatch: ItbMatch | null };

export function ContractRow({ contract }: { contract: ContractWithItbMatch }) {
  const title = contract.itbMatch ? stripEmDash(contract.itbMatch.project) : contract.descriptionEn || "(no description)";
  return (
    <div className="panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-medium leading-snug text-[0.95rem] truncate">
            <Link href={`/contract-history/${encodeURIComponent(contract.id)}`} className="hover:text-accent transition-colors">
              {title}
            </Link>
          </h3>
          {contract.itbMatch && contract.descriptionEn && (
            <div className="text-xs text-muted-2 mt-0.5 truncate">
              Government record says: {contract.descriptionEn}
            </div>
          )}
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
        {contract.itbMatch && <Chip tone="accent">ITB cross-reference</Chip>}
        {contract.categories.map((c) => (
          <Chip key={c} tone={categoryTone(c)}>{c}</Chip>
        ))}
      </div>
      <div className="mt-3 text-xs text-muted-2 mono">{contract.id}</div>
    </div>
  );
}
