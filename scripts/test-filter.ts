/* Quick live test: fetch open tenders, classify, print stats + samples. Run: npx tsx scripts/test-filter.ts */
import { fetchOpenTenders } from "../src/lib/canadabuys";
import { classifyDefence } from "../src/lib/defence-filter";

async function main() {
  console.log("Fetching open tenders from CanadaBuys…");
  const tenders = await fetchOpenTenders();
  console.log(`Total open tenders in feed: ${tenders.length}\n`);

  const matched = tenders
    .map((t) => ({ t, m: classifyDefence(t) }))
    .filter((x) => x.m.isDefence);

  console.log(`Defence/dual-use matches: ${matched.length} (${((matched.length / tenders.length) * 100).toFixed(1)}%)\n`);

  const byStrength: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  for (const { m } of matched) {
    byStrength[m.strength ?? "none"] = (byStrength[m.strength ?? "none"] ?? 0) + 1;
    for (const c of m.categories) byCategory[c] = (byCategory[c] ?? 0) + 1;
  }
  console.log("By strongest signal:", byStrength);
  console.log("\nBy category:");
  Object.entries(byCategory).sort((a, b) => b[1] - a[1]).forEach(([c, n]) => console.log(`  ${n.toString().padStart(4)}  ${c}`));

  console.log("\n=== 12 sample matches ===");
  for (const { t, m } of matched.slice(0, 12)) {
    console.log(`\n• ${t.title.slice(0, 90)}`);
    console.log(`  buyer: ${t.buyer.slice(0, 60)}  | end-user: ${t.endUser.slice(0, 40)}`);
    console.log(`  gsin: ${t.gsinCode} ${t.gsin.slice(0, 50)}`);
    console.log(`  reasons: ${m.matchReasons.slice(0, 4).join(" | ")}`);
  }

  console.log("\n=== 8 sample NON-matches (sanity) ===");
  const nonMatched = tenders.filter((t) => !classifyDefence(t).isDefence);
  for (const t of nonMatched.slice(0, 8)) {
    console.log(`  - ${t.title.slice(0, 70)}  [${t.buyer.slice(0, 30)}]`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
