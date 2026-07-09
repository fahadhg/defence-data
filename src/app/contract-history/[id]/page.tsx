import { notFound } from "next/navigation";
import Link from "next/link";
import { getContractById } from "@/lib/contract-history";
import { fmtDate, fmtMoney, categoryTone, stripEmDash } from "@/lib/format";
import { Chip } from "@/components/Chip";

type Params = Promise<{ id: string }>;

export default async function ContractDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const contract = await getContractById(decodeURIComponent(id));
  if (!contract) notFound();

  const title = contract.itbMatch ? stripEmDash(contract.itbMatch.project) : contract.descriptionEn || "(no description)";

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/contract-history" className="text-sm text-muted hover:text-foreground">
        ← Back to Deep Contract History
      </Link>

      <div>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl font-semibold leading-snug">{title}</h1>
          <div className="text-right shrink-0">
            <div className="mono font-semibold text-lg">{contract.contractValue ? fmtMoney(contract.contractValue) : "N/A"}</div>
          </div>
        </div>
        {contract.itbMatch && contract.descriptionEn && (
          <p className="mt-1 text-sm text-muted-2">Government record says: {contract.descriptionEn}</p>
        )}
        <p className="mt-1 text-muted">
          {contract.vendorName ? (
            <Link
              href={`/contract-history?vendorName=${encodeURIComponent(contract.vendorName)}`}
              className="link-accent"
            >
              {contract.vendorName}
            </Link>
          ) : (
            "Unknown vendor"
          )}
          {" · "}
          {contract.ownerOrgTitle || contract.buyerName || "N/A"}
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {contract.itbMatch && <Chip tone="accent">ITB cross-reference</Chip>}
        {contract.categories.map((c) => (
          <Chip key={c} tone={categoryTone(c)}>
            {c}
          </Chip>
        ))}
      </div>

      {contract.itbMatch && (
        <div>
          <h2 className="text-sm font-medium text-muted mb-2">ITB project match</h2>
          <div className="panel p-4 text-sm leading-relaxed">
            <p className="font-medium">{stripEmDash(contract.itbMatch.project)}</p>
            <p className="mt-1 text-muted">{stripEmDash(contract.itbMatch.projectDescription)}</p>
            <p className="mt-2 text-xs text-muted-2">
              Matched by vendor name and contract value against the{" "}
              <Link href="/industrial-benefits" className="link-accent">
                Industrial &amp; Technological Benefits
              </Link>{" "}
              dataset. The government&apos;s own disclosure record for this contract only carries a generic
              commodity description; this is a separately-sourced match, not part of the original record.
            </p>
          </div>
        </div>
      )}

      {contract.commentsEn && (
        <div>
          <h2 className="text-sm font-medium text-muted mb-2">Comments</h2>
          <div className="panel p-4 text-sm leading-relaxed whitespace-pre-wrap">{contract.commentsEn}</div>
        </div>
      )}

      <div>
        <h2 className="text-sm font-medium text-muted mb-2">Value</h2>
        <div className="panel p-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <Field label="Contract value" value={contract.contractValue ? fmtMoney(contract.contractValue) : "N/A"} />
          <Field label="Original value" value={contract.originalValue ? fmtMoney(contract.originalValue) : "N/A"} />
          <Field label="Amendment value" value={contract.amendmentValue ? fmtMoney(contract.amendmentValue) : "N/A"} />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-medium text-muted mb-2">Dates</h2>
        <div className="panel p-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <Field label="Contract date" value={fmtDate(contract.contractDate ?? "")} />
          <Field label="Contract period start" value={fmtDate(contract.contractPeriodStart ?? "")} />
          <Field label="Delivery date" value={fmtDate(contract.deliveryDate ?? "")} />
          <Field label="Reporting period" value={contract.reportingPeriod || "N/A"} />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-medium text-muted mb-2">Procurement details</h2>
        <div className="panel p-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <Field label="Reference number" value={contract.id} mono />
          <Field label="Procurement ID" value={contract.procurementId || "N/A"} mono />
          <Field label="Commodity type" value={contract.commodityType || "N/A"} />
          <Field label="Commodity code" value={contract.commodityCode || "N/A"} mono />
          <Field label="Instrument type" value={contract.instrumentType || "N/A"} />
          <Field label="Agreement type code" value={contract.agreementTypeCode || "N/A"} mono />
          <Field label="Solicitation procedure" value={contract.solicitationProcedure || "N/A"} />
          <Field label="Limited tendering reason" value={contract.limitedTenderingReason || "N/A"} />
          <Field label="Standing offer number" value={contract.standingOfferNumber || "N/A"} mono />
          <Field label="Number of bids" value={contract.numberOfBids != null ? String(contract.numberOfBids) : "N/A"} />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-medium text-muted mb-2">Vendor &amp; buyer</h2>
        <div className="panel p-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <Field label="Vendor" value={contract.vendorName || "N/A"} />
          <Field label="Vendor postal code" value={contract.vendorPostalCode || "N/A"} mono />
          <Field label="Country of vendor" value={contract.countryOfVendor || "N/A"} />
          <Field label="Owner organization" value={contract.ownerOrgTitle || "N/A"} />
          <Field label="Buyer name" value={contract.buyerName || "N/A"} />
          <Field label="Contracting entity" value={contract.contractingEntity || "N/A"} />
        </div>
      </div>

      <p className="text-xs text-muted-2 max-w-2xl">
        Source: Government of Canada proactive disclosure of contracts over $10,000. This is the
        pre-CanadaBuys historical record; it has no public web page of its own to link to.
      </p>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-2 uppercase tracking-wide">{label}</div>
      <div className={mono ? "mono text-xs mt-0.5" : "mt-0.5"}>{value || "N/A"}</div>
    </div>
  );
}
