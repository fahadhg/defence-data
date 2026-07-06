/**
 * build-standing-offers-snapshot.ts - Fetch SOSA feed, keep defence/dual-use matches, write snapshot.
 * Run: npx tsx scripts/build-standing-offers-snapshot.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fetchStandingOffers } from "../src/lib/canadabuys";
import { enrichStandingOffer, type StandingOffer } from "../src/lib/standing-offers";

async function main() {
  const raw = await fetchStandingOffers();
  const offers: StandingOffer[] = [];
  for (const r of raw) {
    const s = enrichStandingOffer(r);
    if (s) offers.push(s);
  }

  const dir = join(process.cwd(), "data");
  mkdirSync(dir, { recursive: true });
  const payload = {
    generatedAt: new Date().toISOString(),
    source: "CanadaBuys Standing Offers and Supply Arrangements (SOSA)",
    feedTotal: raw.length,
    matched: offers.length,
    offers,
  };
  writeFileSync(join(dir, "defence-standing-offers.json"), JSON.stringify(payload));
  console.log(`Snapshot written: ${offers.length}/${raw.length} defence standing offers → data/defence-standing-offers.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
