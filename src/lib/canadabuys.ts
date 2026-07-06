/**
 * canadabuys.ts — Download & parse CanadaBuys open-data CSV feeds.
 *
 * Ports the field map from the legacy Python pipeline (legacy/tender-pipeline/fetch.py)
 * to TypeScript, and adds the GSIN code + end-user-entity fields the defence filter needs.
 *
 * Feeds (bilingual columns, English suffix `-eng`):
 *   Open tenders   — refreshed each morning
 *   Award notices  — winners + contract value, Aug 2022 → now
 */
import { parse } from "csv-parse/sync";

export const OPEN_TENDERS_CSV =
  "https://canadabuys.canada.ca/opendata/pub/openTenderNotice-ouvertAvisAppelOffres.csv";
export const AWARDS_CSV =
  "https://canadabuys.canada.ca/opendata/pub/awardNoticeComplete-avisAttributionComplet.csv";

const HEADERS = {
  "User-Agent":
    "defence-data/1.0 (defence procurement intelligence; contact: fahadgondal2001@gmail.com)",
};

/** friendly key → CSV column name, for the OPEN TENDERS feed. */
const TENDER_FIELD_MAP: Record<string, string> = {
  title: "title-titre-eng",
  ref: "referenceNumber-numeroReference",
  amendment: "amendmentNumber-numeroModification",
  solicitation: "solicitationNumber-numeroSollicitation",
  published: "publicationDate-datePublication",
  closes: "tenderClosingDate-appelOffresDateCloture",
  contractStart: "expectedContractStartDate-dateDebutContratPrevue",
  gsinCode: "gsin-nibs",
  gsin: "gsinDescription-nibsDescription-eng",
  unspsc: "unspscDescription-eng",
  category: "procurementCategory-categorieApprovisionnement",
  noticeType: "noticeType-avisType-eng",
  method: "procurementMethod-methodeApprovisionnement-eng",
  status: "tenderStatus-appelOffresStatut-eng",
  buyer: "contractingEntityName-nomEntitContractante-eng",
  endUser: "endUserEntitiesName-nomEntitesUtilisateurFinal-eng",
  regions: "regionsOfOpportunity-regionAppelOffres-eng",
  delivery: "regionsOfDelivery-regionsLivraison-eng",
  contactName: "contactInfoName-informationsContactNom",
  contactEmail: "contactInfoEmail-informationsContactCourriel",
  url: "noticeURL-URLavis-eng",
  description: "tenderDescription-descriptionAppelOffres-eng",
};

export interface RawTender {
  title: string;
  ref: string;
  amendment: string;
  solicitation: string;
  published: string;
  closes: string;
  contractStart: string;
  gsinCode: string;
  gsin: string;
  unspsc: string;
  category: string;
  noticeType: string;
  method: string;
  status: string;
  buyer: string;
  endUser: string;
  regions: string;
  delivery: string;
  contactName: string;
  contactEmail: string;
  url: string;
  description: string;
}

async function fetchCsvRows(url: string): Promise<Record<string, string>[]> {
  const resp = await fetch(url, { headers: HEADERS });
  if (!resp.ok) throw new Error(`Fetch ${url} failed: ${resp.status} ${resp.statusText}`);
  const buf = Buffer.from(await resp.arrayBuffer());
  // strip UTF-8 BOM if present
  const text = buf.toString("utf-8").replace(/^﻿/, "");
  return parse(text, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
    bom: true,
  }) as Record<string, string>[];
}

function project<T>(row: Record<string, string>, map: Record<string, string>): T {
  const out: Record<string, string> = {};
  for (const [key, col] of Object.entries(map)) {
    out[key] = (row[col] ?? "").trim();
  }
  return out as T;
}

/** Download + parse the open-tenders feed into typed rows (skips rows missing ref/title). */
export async function fetchOpenTenders(): Promise<RawTender[]> {
  const rows = await fetchCsvRows(OPEN_TENDERS_CSV);
  const out: RawTender[] = [];
  for (const row of rows) {
    const t = project<RawTender>(row, TENDER_FIELD_MAP);
    if (t.ref && t.title) out.push(t);
  }
  return out;
}

/** friendly key → CSV column name, for the AWARD NOTICES feed (fiscal-year files). */
const AWARD_FIELD_MAP: Record<string, string> = {
  title: "title-titre-eng",
  ref: "referenceNumber-numeroReference",
  contractNumber: "contractNumber-numeroContrat",
  solicitation: "solicitationNumber-numeroSollicitation",
  awardDate: "contractAwardDate-dateAttributionContrat",
  contractStart: "contractStartDate-contratDateDebut",
  contractEnd: "contractEndDate-dateFinContrat",
  contractAmount: "contractAmount-montantContrat",
  totalContractValue: "totalContractValue-valeurTotaleContrat",
  currency: "contractCurrency-contratMonnaie",
  status: "awardStatus-attributionStatut-eng",
  instrumentType: "instrumentType-typeInstrument-eng",
  gsinCode: "gsin-nibs",
  gsin: "gsinDescription-nibsDescription-eng",
  unspsc: "unspscDescription-eng",
  category: "procurementCategory-categorieApprovisionnement",
  method: "procurementMethod-methodeApprovisionnement-eng",
  regions: "regionsOfDelivery-regionsLivraison-eng",
  vendor: "supplierLegalName-nomLegalFournisseur-eng",
  vendorCity: "supplierAddressCity-fournisseurAdresseVille-eng",
  vendorProvince: "supplierAddressProvince-fournisseurAdresseProvince-eng",
  vendorCountry: "supplierAddressCountry-fournisseurAdressePays-eng",
  buyer: "contractingEntityName-nomEntitContractante-eng",
  endUser: "endUserEntitiesName-nomEntitesUtilisateurFinal-eng",
  description: "awardDescription-descriptionAttribution-eng",
};

export interface RawAward {
  title: string;
  ref: string;
  contractNumber: string;
  solicitation: string;
  awardDate: string;
  contractStart: string;
  contractEnd: string;
  contractAmount: string;
  totalContractValue: string;
  currency: string;
  status: string;
  instrumentType: string;
  gsinCode: string;
  gsin: string;
  unspsc: string;
  category: string;
  method: string;
  regions: string;
  vendor: string;
  vendorCity: string;
  vendorProvince: string;
  vendorCountry: string;
  buyer: string;
  endUser: string;
  description: string;
}

/** Fiscal years covered by CanadaBuys award notices (system of record since Aug 8, 2022). */
export const AWARD_FISCAL_YEARS = ["2022-2023", "2023-2024", "2024-2025", "2025-2026", "2026-2027"];

export function awardCsvUrl(fiscalYear: string): string {
  return `https://canadabuys.canada.ca/opendata/pub/${fiscalYear}-awardNotice-avisAttribution.csv`;
}

/** Download + parse one fiscal-year award-notices file. */
export async function fetchAwardsForFiscalYear(fiscalYear: string): Promise<RawAward[]> {
  const rows = await fetchCsvRows(awardCsvUrl(fiscalYear));
  const out: RawAward[] = [];
  for (const row of rows) {
    const a = project<RawAward>(row, AWARD_FIELD_MAP);
    if (a.ref && a.title) out.push(a);
  }
  return out;
}

/** Download + parse all known fiscal years of award notices. */
export async function fetchAllAwards(): Promise<RawAward[]> {
  const all: RawAward[] = [];
  for (const fy of AWARD_FISCAL_YEARS) {
    try {
      all.push(...(await fetchAwardsForFiscalYear(fy)));
    } catch (e) {
      console.warn(`Skipping fiscal year ${fy}: ${(e as Error).message}`);
    }
  }
  return all;
}
