/**
 * ingest-contract-history.ts - Stream the Government of Canada proactive-disclosure
 * "contracts over $10,000" feed (all departments, ~2011→present, 400MB+) and upsert only
 * defence/dual-use matches into Postgres. Never loads the full file into memory.
 *
 * This is the pre-CanadaBuys historical tail; CanadaBuys itself is the system of record from
 * Aug 2022 onward (see lib/awards.ts / the `awards` table's separate ingest).
 *
 * Run: npx tsx scripts/ingest-contract-history.ts
 */
import { Readable } from "node:stream";
import { parse } from "csv-parse";
import { db } from "../src/db/client";
import { contracts, type NewContract } from "../src/db/schema";
import { classifyDefence } from "../src/lib/defence-filter";
import { sql } from "drizzle-orm";

const CSV_URL =
  "https://open.canada.ca/data/dataset/d8f85d91-7dec-4fd1-8055-483b77225d8b/resource/fac950c0-00d5-4ec1-a4d3-9cbebf98a305/download/contracts.csv";
const HEADERS = { "User-Agent": "Mozilla/5.0 (defence-data research; contact: fahadgondal2001@gmail.com)" };
const BATCH_SIZE = 500;
const MAX_RETRIES = 5;

function parseMoney(s: string): number | null {
  if (!s) return null;
  const n = Number(String(s).replace(/[^0-9.-]/g, ""));
  return isFinite(n) ? n : null;
}

async function fetchWithRetry(url: string): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const resp = await fetch(url, { headers: HEADERS });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      // The site's WAF occasionally returns a small HTML rejection page with a 200 status.
      const contentType = resp.headers.get("content-type") ?? "";
      if (contentType.includes("text/html")) throw new Error("Got HTML (likely WAF block), retrying");
      return resp;
    } catch (e) {
      lastErr = e;
      const delay = 2000 * attempt;
      console.log(`  fetch attempt ${attempt} failed (${(e as Error).message}), retrying in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

/** A single INSERT ... ON CONFLICT DO UPDATE cannot touch the same row twice (Postgres 21000).
 * The source feed can repeat a reference_number within one batch (e.g. amendments) - keep the
 * last occurrence per id. */
function dedupeById(batch: NewContract[]): NewContract[] {
  const byId = new Map<string, NewContract>();
  for (const row of batch) byId.set(row.id, row);
  return [...byId.values()];
}

async function flushBatch(batch: NewContract[]) {
  if (batch.length === 0) return;
  await db
    .insert(contracts)
    .values(dedupeById(batch))
    .onConflictDoUpdate({
      target: contracts.id,
      set: {
        contractValue: sql`excluded.contract_value`,
        isDefence: sql`excluded.is_defence`,
        categories: sql`excluded.categories`,
      },
    });
}

async function main() {
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const rowLimit = limitArg ? Number(limitArg.split("=")[1]) : Infinity;

  console.log("Fetching contract-history CSV (this file is 400MB+, streaming - will take a while)...");
  if (rowLimit < Infinity) console.log(`  (test mode: stopping after ${rowLimit} rows)`);
  const resp = await fetchWithRetry(CSV_URL);
  const nodeStream = Readable.fromWeb(resp.body as never);
  const parser = parse({ columns: true, skip_empty_lines: true, relax_quotes: true, relax_column_count: true, bom: true });

  let total = 0;
  let matched = 0;
  let batch: NewContract[] = [];
  const startTime = Date.now();

  for await (const row of nodeStream.pipe(parser)) {
    total += 1;
    const r = row as Record<string, string>;

    const classification = classifyDefence({
      title: r.description_en ?? "",
      description: r.comments_en ?? "",
      gsin: r.commodity_type ?? "",
      gsinCode: r.commodity_code ?? "",
      unspsc: "",
      buyer: r.owner_org_title || r.owner_org || r.buyer_name || "",
      endUser: r.contracting_entity ?? "",
    });

    if (classification.isDefence) {
      matched += 1;
      const id = r.reference_number || `${r.procurement_id ?? "unknown"}-${total}`;
      batch.push({
        id,
        procurementId: r.procurement_id ?? null,
        vendorName: r.vendor_name ?? null,
        vendorPostalCode: r.vendor_postal_code ?? null,
        countryOfVendor: r.country_of_vendor ?? null,
        buyerName: r.buyer_name ?? null,
        contractingEntity: r.contracting_entity ?? null,
        ownerOrg: r.owner_org ?? null,
        ownerOrgTitle: r.owner_org_title ?? null,
        contractDate: r.contract_date ?? null,
        contractPeriodStart: r.contract_period_start ?? null,
        deliveryDate: r.delivery_date ?? null,
        contractValue: parseMoney(r.contract_value),
        originalValue: parseMoney(r.original_value),
        amendmentValue: parseMoney(r.amendment_value),
        descriptionEn: r.description_en ?? null,
        commentsEn: r.comments_en ?? null,
        commodityType: r.commodity_type ?? null,
        commodityCode: r.commodity_code ?? null,
        agreementTypeCode: r.agreement_type_code ?? null,
        instrumentType: r.instrument_type ?? null,
        solicitationProcedure: r.solicitation_procedure ?? null,
        limitedTenderingReason: r.limited_tendering_reason ?? null,
        standingOfferNumber: r.standing_offer_number ?? null,
        numberOfBids: r.number_of_bids ? Number(r.number_of_bids) || null : null,
        reportingPeriod: r.reporting_period ?? null,
        isDefence: true,
        categories: classification.categories,
        matchStrength: classification.strength,
      });
    }

    if (batch.length >= BATCH_SIZE) {
      await flushBatch(batch);
      batch = [];
    }

    if (total % 50000 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      console.log(`  processed ${total.toLocaleString()} rows, ${matched.toLocaleString()} matched (${elapsed}s elapsed)`);
    }

    if (total >= rowLimit) {
      console.log(`  reached --limit=${rowLimit}, stopping early.`);
      break;
    }
  }

  await flushBatch(batch);

  console.log(`\nDone. ${total.toLocaleString()} total rows, ${matched.toLocaleString()} defence/dual-use matches upserted.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
