/**
 * build-snapshot.ts — Fetch live open tenders, keep defence/dual-use matches, write snapshot.
 * Run: npx tsx scripts/build-snapshot.ts   (the daily cron does the same in production)
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fetchOpenTenders } from "../src/lib/canadabuys";
import { enrichTender, type Tender } from "../src/lib/tenders";

async function main() {
  const raw = await fetchOpenTenders();
  const tenders: Tender[] = [];
  for (const r of raw) {
    const t = enrichTender(r);
    if (t) tenders.push(t);
  }

  const dir = join(process.cwd(), "data");
  mkdirSync(dir, { recursive: true });
  const payload = {
    generatedAt: new Date().toISOString(),
    source: "CanadaBuys open tender notices",
    feedTotal: raw.length,
    matched: tenders.length,
    tenders,
  };
  writeFileSync(join(dir, "defence-tenders.json"), JSON.stringify(payload));
  console.log(`Snapshot written: ${tenders.length}/${raw.length} defence tenders → data/defence-tenders.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
