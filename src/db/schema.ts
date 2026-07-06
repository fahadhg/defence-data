/**
 * schema.ts - Drizzle schema for the proactive-disclosure contract-history table.
 *
 * Source: Government of Canada proactive publication of contracts over $10,000, all
 * departments, back to ~2011 (quarterly reporting). This is the pre-CanadaBuys historical
 * tail - CanadaBuys itself is the system of record from Aug 2022 onward (see lib/awards.ts).
 * The full feed is 400MB+ across all departments; only defence/dual-use matches are stored.
 */
import { pgTable, text, integer, doublePrecision, boolean, index } from "drizzle-orm/pg-core";

export const contracts = pgTable(
  "contracts",
  {
    id: text("id").primaryKey(), // referenceNumber, unique per disclosure record
    procurementId: text("procurement_id"),
    vendorName: text("vendor_name"),
    vendorPostalCode: text("vendor_postal_code"),
    countryOfVendor: text("country_of_vendor"),
    buyerName: text("buyer_name"),
    contractingEntity: text("contracting_entity"),
    ownerOrg: text("owner_org"),
    ownerOrgTitle: text("owner_org_title"),
    contractDate: text("contract_date"),
    contractPeriodStart: text("contract_period_start"),
    deliveryDate: text("delivery_date"),
    contractValue: doublePrecision("contract_value"),
    originalValue: doublePrecision("original_value"),
    amendmentValue: doublePrecision("amendment_value"),
    descriptionEn: text("description_en"),
    commentsEn: text("comments_en"),
    commodityType: text("commodity_type"),
    commodityCode: text("commodity_code"),
    agreementTypeCode: text("agreement_type_code"),
    instrumentType: text("instrument_type"),
    solicitationProcedure: text("solicitation_procedure"),
    limitedTenderingReason: text("limited_tendering_reason"),
    standingOfferNumber: text("standing_offer_number"),
    numberOfBids: integer("number_of_bids"),
    reportingPeriod: text("reporting_period"),
    // enrichment (computed at ingest time, same taxonomy as lib/defence-filter.ts)
    isDefence: boolean("is_defence").notNull().default(false),
    categories: text("categories").array().notNull().default([]),
    matchStrength: text("match_strength"),
  },
  (table) => [
    index("contracts_owner_org_idx").on(table.ownerOrg),
    index("contracts_vendor_name_idx").on(table.vendorName),
    index("contracts_contract_date_idx").on(table.contractDate),
  ],
);

export type Contract = typeof contracts.$inferSelect;
export type NewContract = typeof contracts.$inferInsert;
