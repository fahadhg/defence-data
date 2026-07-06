# Project Notes

Working notes on how this app is put together, why certain non-obvious calls were made, and what
to check first when something looks wrong. README.md covers what the app does; this covers how
and why, for whoever maintains it next.

## Data sources and refresh schedule

| Source | Feeds | Refresh | Storage |
|---|---|---|---|
| CanadaBuys open tenders | `/tenders` | daily, 13:00 UTC | `data/defence-tenders.json` |
| CanadaBuys award notices | `/awards`, `/vendors`, `/buyers` | weekly (Mon 13:00 UTC) | `data/defence-awards.json` |
| CanadaBuys standing offers (SOSA) | `/standing-offers` | weekly (Mon 14:00 UTC) | `data/defence-standing-offers.json` |
| ISED ITB contractor progress | `/industrial-benefits` | monthly (15th, 15:00 UTC) | `data/defence-itb-obligations.json` |
| DND Defence Capabilities Blueprint | `/investment-plan` | monthly (1st, 15:00 UTC) | `data/defence-investment-plan.json` |
| Proactive disclosure (contracts >$10K, all depts, 2000-present) | `/contract-history` | monthly (1st, 16:00 UTC) | Postgres (Neon), not a JSON snapshot |

All six are GitHub Actions workflows (`.github/workflows/refresh-*.yml`), triggered on schedule
or manually via "Run workflow" on GitHub. The five JSON-snapshot workflows commit the updated
file and push, which triggers Vercel's git integration to redeploy automatically. The Postgres
one writes directly to Neon and needs no redeploy since `/contract-history` queries live.

**`refresh-contract-history.yml` requires a `DATABASE_URL` repository secret** (Settings →
Secrets and variables → Actions). Without it the job fails fast (~20s) with exit code 1. This
was missing initially and only caught by manually triggering the workflow via
`workflow_dispatch` rather than waiting for its monthly schedule; verify this stays set if the
Neon project or connection string ever changes.

## Why two different storage strategies

Tenders/awards/standing-offers/ITB/investment-plan are small enough (hundreds to ~10K records)
to commit as JSON and load into memory per request. Contract history is ~1.3M raw rows a month
(~400MB+ CSV), of which ~376K are defence-relevant, too large for a snapshot, so it lives in
Postgres and is queried with real `WHERE`/`ORDER BY`/`LIMIT` (see `src/lib/contract-history.ts`).
Don't be tempted to move contract-history to a JSON snapshot for consistency; it won't fit.

## The defence classifier (`src/lib/defence-filter.ts`)

A record is defence-relevant if any of three signals fires: buyer/end-user org match, military
GSIN family, or dual-use keyword. Every match records *why* it fired (`matchReasons`), shown on
detail pages. Tuning notes, found by testing against live data rather than guessing:

- **Bare `"cyber"` and `"warfare"` are excluded.** Generic federal IT-staffing vehicles (TBIPS/
  SBIPS) list "Cyber Security" and "Electronic Warfare" as staff specializations in boilerplate
  service-category text, not because the contract is about either. `HARD_EXCLUDE` also filters
  TBIPS/SBIPS titles outright.
- **`"LEO"` was removed** from the Space & Satellite keywords: it collided with "Level" (e.g.
  "P.6 Project Administrator (Level 1)") far more often than it meant Low Earth Orbit.
- **Buyer-org matching also scans the tender/award *title***, not just the buyer field, because
  Shared Services Canada often contracts on DND's behalf with DND named only in the title.

## Buyer/vendor attribution (`src/lib/org.ts`)

PSPC is frequently the contracting authority-of-record for defence procurement while DND (or
Coast Guard, RCMP, etc.) is the actual end user. Grouping by the raw `buyer` field alone
misattributes tens of billions in spend to PSPC and understates DND to a few hundred million.
`effectiveOrgs()` prefers `endUser`, falls back to `buyer`, splits joint requirements ("DND /
RCMP / NRC / Transport Canada") so each named org gets credit, and normalizes name variants
("Department of National Defence" vs "...(DND)") to one key. This is used for Buyer Intelligence
and for vendor pages' "top buying departments." Don't reintroduce a raw `buyer`-only groupby.

**Known remaining gap:** vendor names themselves aren't normalized the same way ("Irving
Shipbuilding Inc" and "Irving Shipbuilding Inc." appear as separate top-vendor rows in Deep
Contract History). Flagged, not fixed. The same fix pattern as `org.ts` would apply if prioritized.

## Deep Contract History specifics

- **`ORDER BY contract_value DESC` needs `NULLS LAST` explicitly.** Postgres defaults to NULLs
  first on a DESC sort, so contracts with no recorded value (a real gap in the government's own
  disclosure, not a bug) were appearing mixed in among the highest-value real contracts instead
  of at the bottom. Fixed in `queryContracts()`.
- **Generic descriptions are cross-referenced against ITB data** (`src/lib/itb-match.ts`). The
  government's own `description_en` is often just a commodity category ("Other professional
  services not elsewhere specified") even for multi-billion-dollar contracts. When a contract's
  vendor and dollar value closely match (within 2%) an ITB obligation record, the real project
  name is shown instead, with the original government text kept visible underneath. Confirmed
  against SkyAlyne's $11.2B "Future Aircrew Training" contract. Only covers vendors with known
  ITB obligations (~117 records), so most rows still show the raw government description.

## Timestamps

Snapshot "updated" timestamps render on Vercel's server (App Router pages have no `"use client"`),
so a bare `toLocaleString()` reflects the server's clock (UTC) with no timezone label, reading as
if it were the visitor's local time. `fmtUpdatedAt()` in `src/lib/format.ts` explicitly converts
to and labels Eastern Time (what CanadaBuys itself uses) so it's unambiguous everywhere.

## Copy and style

User-facing copy follows NGen's institutional voice per the 2024-25 Annual Report (full
declarative sentences, active verbs, "Canada's advanced manufacturing sector" framing). No
em-dashes in app copy or code comments. The upstream government source *data* itself (tender/
award descriptions, ITB project names) still contains em-dashes since it's quoted verbatim; the
one exception is ITB project names shown as a contract-history enrichment, which are stripped at
display time only (`stripEmDash()`) since that's newly-built UI, not a quoted record.

## Nav layout

Header nav wraps onto a second row (flex-wrap, auto header height) rather than scrolling
horizontally. An earlier horizontal-scroll version hid the last nav items off-screen with no
visible scrollbar, which looked like a missing feature rather than a nav item needing a scroll.
If adding more nav items, wrapping is the safer default than hidden overflow.

## Legacy

`legacy/tender-pipeline/` is the original Python bid-scoring pipeline this project grew out of
(Claude-scored tender digest via Slack/email for one SME's capabilities). Not used by the current
app; kept for reference only.
