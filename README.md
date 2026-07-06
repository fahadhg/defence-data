# Canada Defence Procurement Intelligence

A searchable browser over **live CanadaBuys defence & dual-use tenders** and **federal defence
contract history**, built for dual-use manufacturers and defence companies tracking Government
of Canada procurement.

## What it does

- **Tenders** (`/tenders`) — open bid opportunities, filtered from the full CanadaBuys feed down
  to defence/dual-use relevance, with closing-date urgency and capability-category facets.
- **Contract history** (`/awards`) — awarded contracts since FY2022-2023, searchable by vendor,
  buyer, category, and fiscal year, with total contract value.
- **Vendor profiles** (`/vendors/[name]`) — a contractor's full defence award history: total
  value, top buying departments, capability mix, spend by fiscal year.
- **Overview** (`/`) — KPIs and category/vendor breakdowns across both datasets.

## Why a tender or award is here

Every match is classified transparently by `src/lib/defence-filter.ts` — a record is included if
**any** signal fires:

1. **Buyer or end user** is a defence/security organization (DND, CAF, DRDC, CSE, CSIS, RCMP,
   Coast Guard, Defence Construction Canada).
2. **GSIN** falls in a military Federal Supply Classification family (weapons, aircraft, ships,
   munitions, radar/EW, …).
3. **Keyword** hit on title/description against a curated dual-use taxonomy (aerospace, maritime,
   land systems, C4ISR, cyber, space, AI/autonomy, advanced materials, CBRN, training).

Every tender/award detail page shows its `matchReasons` — the specific signal(s) that surfaced it.
The classifier is tuned against known false-positive patterns (generic IT-staffing vehicles like
TBIPS/SBIPS that merely list "Cyber Security" as a staff specialization, ambiguous abbreviation
collisions, etc.) — see the `HARD_EXCLUDE` list and comments in that file before loosening it.

## Data sources

All data is Government of Canada open data, refreshed from CanadaBuys:

| Feed | Used for | Upstream refresh |
|---|---|---|
| [Open tender notices](https://open.canada.ca/data/en/dataset/6abd20d4-7a1c-4b38-baa2-9525d0bb2fd2) | `/tenders` | every morning |
| [Award notices](https://open.canada.ca/data/en/dataset/a1acb126-9ce8-40a9-b889-5da2b1dd20cb) (fiscal-year files, FY2022-23 → present) | `/awards`, `/vendors` | every morning (current FY); monthly (past years) |

## Architecture

Data is fetched, classified, and written to committed JSON snapshots (`data/defence-tenders.json`,
`data/defence-awards.json`) rather than a database — the filtered defence-only datasets are small
enough (hundreds of tenders, ~10K awards) that this keeps the stack simple. GitHub Actions
(`.github/workflows/refresh-tenders.yml` daily, `refresh-awards.yml` weekly) regenerate the
snapshots and push; Vercel's git integration redeploys automatically.

**Deferred to a later phase:** full historical contract history pre-dating CanadaBuys (PSPC
contract history since 2009, proactive disclosure of contracts >$10K) is much larger and would
move this to Postgres (Neon, via Vercel Marketplace) rather than committed JSON.

## Local development

```bash
npm install
npm run snapshot         # fetch + classify open tenders → data/defence-tenders.json
npm run snapshot:awards  # fetch + classify all fiscal-year awards → data/defence-awards.json
npm run dev
```

`scripts/test-filter.ts` is a standalone diagnostic — run `npx tsx scripts/test-filter.ts` to see
match rate, category breakdown, and sample matches/non-matches against the live open-tenders feed
without touching the committed snapshot.

## Prior art

`legacy/tender-pipeline/` is the original Python bid-scoring pipeline this project grew out of —
it fetches open tenders and uses Claude to score bid-worthiness for a specific SME's capabilities,
then sends a Slack/email digest. Not used by the current app, kept for reference.

<!-- verifying Vercel git auto-deploy wiring -->
