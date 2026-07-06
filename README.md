# Defence Procurement Intelligence for Canada's Advanced Manufacturing Sector

A platform built for Canada's dual-use manufacturers and defence companies, giving them the
intelligence they need to find and pursue procurement opportunities across the Government of
Canada's contracting system.

## What it does

- **Tenders** (`/tenders`): open bid opportunities, filtered from the full CanadaBuys feed down
  to defence and dual-use relevance, with closing-date urgency and capability-category facets.
- **Awards** (`/awards`): awarded contracts since FY2022-2023, searchable by vendor, buyer,
  category, and fiscal year, with total contract value.
- **Deep contract history** (`/contract-history`): the government-wide proactive disclosure of
  contracts over $10,000, all federal departments, back to 2000. This is the pre-CanadaBuys
  historical record, backed by Postgres given its scale.
- **Contract expiry radar** (`/expiring`): defence contracts whose current term is ending soon,
  the leading indicator of a recompete tender, often surfacing 6 to 18 months before the RFP.
- **Standing offers** (`/standing-offers`): pre-qualified supplier vehicles for defence and
  dual-use categories, often the entry point to federal defence work.
- **Buyer intelligence** (`/buyers`): sole-source rates and vendor concentration by buying
  department, so companies can see how open a given buyer's competitions really are.
- **Defence Investment Plan** (`/investment-plan`): DND's own published pipeline of major capital
  projects, the demand signal that precedes a tender by years.
- **Industrial and Technological Benefits** (`/industrial-benefits`): the ITB obligations a prime
  contractor still owes to Canadian industry, and how much of that work remains to be placed.
- **Vendor profiles** (`/vendors/[name]`): a contractor's full defence award history, including
  total value, top buying departments, capability mix, and spend by fiscal year.
- **Overview** (`/`): key indicators and category and vendor breakdowns across every dataset.

## Why a tender or award is here

Every match is classified transparently by `src/lib/defence-filter.ts`. A record is included if
any of these signals fires:

1. **Buyer or end user** is a defence or security organization (DND, CAF, DRDC, CSE, CSIS, RCMP,
   Coast Guard, Defence Construction Canada).
2. **GSIN** falls in a military Federal Supply Classification family (weapons, aircraft, ships,
   munitions, radar and electronic warfare, and so on).
3. **Keyword** hit on title or description against a curated dual-use taxonomy (aerospace,
   maritime, land systems, C4ISR, cyber, space, AI and autonomy, advanced materials, CBRN,
   training).

Every tender and award detail page shows its `matchReasons`, the specific signal or signals that
surfaced it. The classifier is tuned against known false-positive patterns (generic IT-staffing
vehicles like TBIPS/SBIPS that merely list "Cyber Security" as a staff specialization, ambiguous
abbreviation collisions, and similar cases). See the `HARD_EXCLUDE` list and comments in that
file before loosening it.

## Data sources

All data is Government of Canada open data.

| Feed | Used for | Upstream refresh |
|---|---|---|
| [Open tender notices](https://open.canada.ca/data/en/dataset/6abd20d4-7a1c-4b38-baa2-9525d0bb2fd2) | `/tenders` | every morning |
| [Award notices](https://open.canada.ca/data/en/dataset/a1acb126-9ce8-40a9-b889-5da2b1dd20cb) (fiscal-year files, FY2022-23 to present) | `/awards`, `/vendors`, `/buyers` | every morning (current FY); monthly (past years) |
| [Proactive disclosure of contracts over $10,000](https://open.canada.ca/data/en/dataset/d8f85d91-7dec-4fd1-8055-483b77225d8b) | `/contract-history` | quarterly |
| [Standing Offers and Supply Arrangements](https://open.canada.ca/data/en/dataset/f5c8a5a0-354d-455a-99ab-8276aa38032e) | `/standing-offers` | weekly |
| [DND Defence Capabilities Blueprint](https://apps.forces.gc.ca/en/defence-capabilities-blueprint/index.asp) | `/investment-plan` | annual cycle |
| [ISED Industrial and Technological Benefits](https://ised-isde.canada.ca/site/industrial-technological-benefits/en/projects-and-obligations/report-contractor-progress/breakdown-current-obligations-contractor) | `/industrial-benefits` | periodic |

## Architecture

Most datasets are fetched, classified, and written to committed JSON snapshots (`data/*.json`).
These are small enough (hundreds of tenders, tens of thousands of awards) to keep the stack
simple. GitHub Actions (`.github/workflows/refresh-*.yml`) regenerate each snapshot on its own
schedule and push; Vercel's git integration redeploys automatically.

Deep contract history is the exception. At more than 370,000 defence-relevant records drawn from
1.29 million government-wide disclosures, it lives in Postgres (Neon, provisioned through the
Vercel Marketplace) and is queried live rather than loaded into memory. See `src/db/schema.ts`
and `scripts/ingest-contract-history.ts`.

## Local development

```bash
npm install
npm run snapshot                  # fetch + classify open tenders
npm run snapshot:awards           # fetch + classify all fiscal-year awards
npm run snapshot:standing-offers  # fetch + classify standing offers
npm run snapshot:blueprint        # crawl the Defence Capabilities Blueprint
npm run snapshot:itb              # fetch ITB obligations
npx tsx scripts/ingest-contract-history.ts  # requires DATABASE_URL
npm run dev
```

`scripts/test-filter.ts` is a standalone diagnostic. Run `npx tsx scripts/test-filter.ts` to see
match rate, category breakdown, and sample matches and non-matches against the live open-tenders
feed, without touching the committed snapshot.

## Prior art

`legacy/tender-pipeline/` is the original Python bid-scoring pipeline this project grew out of.
It fetches open tenders and uses Claude to score bid-worthiness for a specific SME's capabilities,
then sends a Slack or email digest. Not used by the current app, kept for reference.
