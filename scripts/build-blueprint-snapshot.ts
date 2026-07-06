/**
 * build-blueprint-snapshot.ts - Crawl DND's Defence Capabilities Blueprint (apps.forces.gc.ca).
 *
 * The site has no API/export, but is plain server-rendered HTML at predictable URLs:
 *   project-dcia.asp?id=N        - a capability-investment-area page listing project links
 *   project-details.asp?id=N     - a project's full record
 *
 * Strategy: crawl DCIA pages 1..DCIA_ID_MAX to discover every referenced project id (dedup),
 * then fetch each project's details page once. Paced with a delay to be polite to a gov server.
 *
 * Run: npx tsx scripts/build-blueprint-snapshot.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { mapDcaToCategories, nextMilestone, type BlueprintProject } from "../src/lib/blueprint";

const BASE = "https://apps.forces.gc.ca/en/defence-capabilities-blueprint";
const HEADERS = { "User-Agent": "Mozilla/5.0 (defence-data research; contact: fahadgondal2001@gmail.com)" };
const DCIA_ID_MAX = 170; // discovery range; docs describe "over 150" DCIAs
const DELAY_MS = 120;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url, { headers: HEADERS });
    if (!resp.ok) return null;
    return await resp.text();
  } catch {
    return null;
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/<[^>]+>/g, "")
    // Orphaned entity fragments where the source page is itself missing the leading "&"
    // (a real, observed authoring artifact on this site, e.g. "Type&nbsp;1" becomes "Typenbsp; 1";
    // note no word boundary between "Type" and "nbsp", so a \b-anchored regex would miss it).
    .replace(/nbsp;\s*/g, " ")
    .replace(/amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function extractProjectIds(html: string): number[] {
  const ids = new Set<number>();
  for (const m of html.matchAll(/project-details\.asp\?id=(\d+)/g)) ids.add(Number(m[1]));
  return [...ids];
}

function parseProject(id: number, html: string): BlueprintProject | null {
  const titleRaw = html.match(/<h1[^>]*id="wb-cont">([^<]+)<\/h1>/)?.[1]?.trim();
  if (!titleRaw) return null;
  const title = decodeEntities(titleRaw);

  const projectType = html.match(/Project Type<\/h2>\s*<p[^>]*>([\s\S]*?)<\/p>/)?.[1];
  const objective = html.match(/Objective<\/h2>\s*<p>([\s\S]*?)<\/p>/)?.[1];
  const fundingRange = html.match(/Funding Range<\/h2>\s*<p>([\s\S]*?)<\/p>/)?.[1];
  const lastModified = html.match(/property="dateModified">([^<]+)</)?.[1];

  const timeline: { phase: string; value: string }[] = [];
  const timelineBlock = html.match(/<dl id="defListTimeline"[^>]*>([\s\S]*?)<\/dl>/)?.[1] ?? "";
  for (const m of timelineBlock.matchAll(/<dt>([\s\S]*?)<\/dt>\s*<dd>([\s\S]*?)<\/dd>/g)) {
    timeline.push({ phase: decodeEntities(m[1]), value: decodeEntities(m[2]) });
  }

  function parseList(sectionTitle: string): { code: string; label: string }[] {
    const block = html.match(new RegExp(`${sectionTitle}</h2>\\s*<ul>([\\s\\S]*?)</ul>`))?.[1] ?? "";
    const out: { code: string; label: string }[] = [];
    for (const m of block.matchAll(/<a href="([^"]*)">([^<]*)<\/a>/g)) {
      out.push({ code: m[1], label: decodeEntities(m[2]) });
    }
    return out;
  }

  const dcaRaw = parseList("Defence Capability Areas");
  const dcas = dcaRaw.map((d) => ({ code: d.code.match(/dca=([^&"]+)/)?.[1] ?? d.code, label: d.label }));
  const dciaRaw = parseList("Defence Capability Investment Areas");
  const dcias = dciaRaw.map((d) => ({ id: Number(d.code.match(/id=(\d+)/)?.[1] ?? 0), label: d.label }));
  const kicRaw = parseList("Key Industrial Capabilities");
  const kics = kicRaw.map((d) => ({ id: Number(d.code.match(/id=(\d+)/)?.[1] ?? 0), label: d.label }));

  const categories = mapDcaToCategories(dcas);
  const milestone = nextMilestone(timeline);

  return {
    id,
    title,
    projectType: projectType ? decodeEntities(projectType) : "",
    objective: objective ? decodeEntities(objective) : "",
    fundingRange: fundingRange ? decodeEntities(fundingRange) : "",
    timeline,
    dcas,
    dcias,
    kics,
    lastModified: lastModified ?? "",
    url: `${BASE}/project-details.asp?id=${id}`,
    categories,
    nextMilestoneYear: milestone.year,
    nextMilestoneLabel: milestone.label,
  };
}

async function main() {
  console.log("Discovering project IDs from DCIA index pages...");
  const projectIds = new Set<number>();
  for (let dciaId = 1; dciaId <= DCIA_ID_MAX; dciaId++) {
    const html = await fetchText(`${BASE}/project-dcia.asp?id=${dciaId}`);
    if (html) for (const pid of extractProjectIds(html)) projectIds.add(pid);
    await sleep(DELAY_MS);
  }
  console.log(`Discovered ${projectIds.size} unique projects.`);

  const projects: BlueprintProject[] = [];
  let i = 0;
  for (const id of projectIds) {
    i++;
    const html = await fetchText(`${BASE}/project-details.asp?id=${id}`);
    if (html) {
      const p = parseProject(id, html);
      if (p) projects.push(p);
    }
    if (i % 20 === 0) console.log(`  fetched ${i}/${projectIds.size}...`);
    await sleep(DELAY_MS);
  }
  console.log(`Parsed ${projects.length} project records.`);

  const dir = join(process.cwd(), "data");
  mkdirSync(dir, { recursive: true });
  const payload = {
    generatedAt: new Date().toISOString(),
    source: "DND Defence Capabilities Blueprint (apps.forces.gc.ca)",
    total: projects.length,
    projects,
  };
  writeFileSync(join(dir, "defence-investment-plan.json"), JSON.stringify(payload));
  console.log(`Snapshot written: ${projects.length} projects → data/defence-investment-plan.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
