/**
 * build-awards-snapshot.ts — Fetch all fiscal-year award notices, keep defence/dual-use
 * matches, write snapshot. Run: npx tsx scripts/build-awards-snapshot.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fetchAllAwards } from "../src/lib/canadabuys";
import { enrichAward, type Award } from "../src/lib/awards";

async function main() {
  const raw = await fetchAllAwards();
  const awards: Award[] = [];
  for (const r of raw) {
    const a = enrichAward(r);
    if (a) awards.push(a);
  }

  const dir = join(process.cwd(), "data");
  mkdirSync(dir, { recursive: true });
  const payload = {
    generatedAt: new Date().toISOString(),
    source: "CanadaBuys award notices (fiscal years 2022-2023 to present)",
    feedTotal: raw.length,
    matched: awards.length,
    awards,
  };
  writeFileSync(join(dir, "defence-awards.json"), JSON.stringify(payload));
  console.log(`Snapshot written: ${awards.length}/${raw.length} defence awards → data/defence-awards.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
