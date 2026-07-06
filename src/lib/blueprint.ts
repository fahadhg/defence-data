/**
 * blueprint.ts - Types + capability-category mapping for DND's Defence Capabilities Blueprint
 * (apps.forces.gc.ca) - the public pipeline of major defence capital/IT/infrastructure projects
 * and significant in-service-support contracts, with funding ranges and phase timelines.
 *
 * This is DND's own forward demand signal: a project appearing here today, with an
 * "Implementation Start" 2-5 years out, is future tender volume in that capability area,
 * exactly the lead time an SME needs to position itself (partner with a prime, build the
 * relevant qualification, watch for the eventual RFP).
 */

export interface BlueprintProject {
  id: number;
  title: string;
  projectType: string; // "New" | "Replace" | "Upgrade" | ...
  objective: string;
  fundingRange: string;
  timeline: { phase: string; value: string }[];
  dcas: { code: string; label: string }[]; // Defence Capability Areas (DND's own top-level taxonomy)
  dcias: { id: number; label: string }[]; // Defence Capability Investment Areas
  kics: { id: number; label: string }[]; // Key Industrial Capabilities
  lastModified: string;
  url: string;
  // enrichment
  categories: string[]; // mapped onto this app's existing capability taxonomy
  nextMilestoneYear: number | null; // earliest parseable year across timeline phases not yet "Complete"
  nextMilestoneLabel: string | null;
}

/**
 * DND's Defence Capability Area labels → this app's existing capability-category taxonomy.
 * Confirmed against the real label set returned by the live crawl (see build-blueprint-snapshot.ts).
 * "Emerging Technology" and "Real Property (INFRA)" are deliberately left unmapped - too vague
 * (former) or not a manufacturing capability signal (latter, it's construction/facilities).
 */
const DCA_TO_CATEGORY: Record<string, string> = {
  "Command, Control, Communications, Computers and Intelligence": "C4ISR & Communications",
  Space: "Space & Satellite",
  Air: "Aerospace & Aircraft",
  Sea: "Maritime & Naval",
  Land: "Land Systems & Vehicles",
  "Personal Equipment and Protection Systems": "CBRN, Medical & Protective",
  "Surveillance & Reconnaissance": "Sensors, Radar & EW",
  "Training and Simulation": "Training & Simulation",
  "Missiles, Rockets, Ammunition & Other Munitions": "Weapons & Munitions",
  "Cyber, Electronic And Irregular Warfare": "Cyber & Security",
  "Joint Support & Sustainment": "Defence & National Security",
};

export function mapDcaToCategories(dcas: { label: string }[]): string[] {
  const cats = new Set<string>();
  for (const d of dcas) {
    const mapped = DCA_TO_CATEGORY[d.label];
    if (mapped) cats.add(mapped);
  }
  return [...cats];
}

/** Parse a timeline phase value like "2028/2029", "Beyond 2035", "In Progress", "Complete". */
export function parseTimelineYear(value: string): number | null {
  const m = value.match(/(\d{4})/);
  if (m) return Number(m[1]);
  if (/beyond/i.test(value)) return 9999;
  return null;
}

export function nextMilestone(
  timeline: { phase: string; value: string }[],
): { year: number | null; label: string | null } {
  const upcoming = timeline
    .map((t) => ({ ...t, year: parseTimelineYear(t.value) }))
    .filter((t) => t.year !== null && !/in progress|complete/i.test(t.value));
  if (upcoming.length === 0) {
    const inProgress = timeline.find((t) => /in progress/i.test(t.value));
    if (inProgress) return { year: null, label: `${inProgress.phase} (in progress)` };
    return { year: null, label: null };
  }
  upcoming.sort((a, b) => (a.year ?? Infinity) - (b.year ?? Infinity));
  return { year: upcoming[0].year, label: upcoming[0].phase };
}

export interface BlueprintFilters {
  q?: string;
  category?: string;
  page?: number;
  pageSize?: number;
}

export interface BlueprintQueryResult {
  rows: BlueprintProject[];
  total: number;
  page: number;
  pageSize: number;
  facets: { categories: { name: string; count: number }[] };
}

export function queryBlueprint(all: BlueprintProject[], f: BlueprintFilters): BlueprintQueryResult {
  const page = f.page ?? 1;
  const pageSize = f.pageSize ?? 24;

  let rows = all;
  if (f.q) {
    const q = f.q.toLowerCase();
    rows = rows.filter((p) => p.title.toLowerCase().includes(q) || p.objective.toLowerCase().includes(q));
  }
  if (f.category) rows = rows.filter((p) => p.categories.includes(f.category!));

  const catCounts = new Map<string, number>();
  for (const p of rows) for (const c of p.categories) catCounts.set(c, (catCounts.get(c) ?? 0) + 1);
  const facets = {
    categories: [...catCounts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
  };

  rows = [...rows].sort((a, b) => (a.nextMilestoneYear ?? Infinity) - (b.nextMilestoneYear ?? Infinity));

  const total = rows.length;
  const start = (page - 1) * pageSize;
  return { rows: rows.slice(start, start + pageSize), total, page, pageSize, facets };
}
