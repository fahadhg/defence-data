/**
 * build-itb-snapshot.ts - Fetch ISED's ITB contractor-progress data, enrich, write snapshot.
 * Run: npx tsx scripts/build-itb-snapshot.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fetchItbObligations, enrichItbRow, type ItbObligation } from "../src/lib/itb";

async function main() {
  const raw = await fetchItbObligations();
  const rows: ItbObligation[] = raw.map(enrichItbRow);

  const dir = join(process.cwd(), "data");
  mkdirSync(dir, { recursive: true });
  const payload = {
    generatedAt: new Date().toISOString(),
    source: "ISED Industrial and Technological Benefits (ITB) - Report on Contractor Progress",
    total: rows.length,
    rows,
  };
  writeFileSync(join(dir, "defence-itb-obligations.json"), JSON.stringify(payload));
  console.log(`Snapshot written: ${rows.length} ITB obligation records → data/defence-itb-obligations.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
