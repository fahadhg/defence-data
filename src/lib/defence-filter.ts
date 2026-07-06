/**
 * defence-filter.ts — Transparent, tunable classifier for defence / dual-use procurement.
 *
 * A record is DEFENCE-relevant if ANY signal fires:
 *   1. Buyer / end-user is a defence or national-security organization.
 *   2. GSIN falls in a military Federal-Supply-Classification family.
 *   3. Title / description / GSIN text hits a curated dual-use keyword.
 *
 * We keep every matched reason so the UI can show WHY a tender surfaced, and we tag a
 * capability CATEGORY so users can facet by domain (Aerospace, Maritime, Cyber, …).
 *
 * Edit the tables below to tighten or loosen coverage — this is the single source of truth.
 */

/** Signal for anything with these org names as buyer or end user. */
const DEFENCE_ORGS: { pattern: RegExp; label: string }[] = [
  { pattern: /\bnational defence\b|d[eé]fence nationale|\bDND\b/i, label: "National Defence (DND)" },
  { pattern: /canadian armed forces|\bCAF\b|canadian forces/i, label: "Canadian Armed Forces" },
  { pattern: /defen[cs]e research|\bDRDC\b/i, label: "Defence R&D Canada (DRDC)" },
  { pattern: /communications security establishment|\bCSE\b/i, label: "Communications Security Establishment" },
  { pattern: /canadian security intelligence|\bCSIS\b/i, label: "CSIS" },
  { pattern: /canadian coast guard|\bCCG\b/i, label: "Canadian Coast Guard" },
  { pattern: /royal canadian mounted police|\bRCMP\b/i, label: "RCMP" },
  { pattern: /defence construction canada/i, label: "Defence Construction Canada" },
];

/**
 * Military Federal Supply Classification families (first two digits of the GSIN goods code).
 * Canadian goods GSIN are typically N-prefixed (e.g. N1560); we read the numeric family.
 */
const MILITARY_FSC: Record<string, string> = {
  "10": "Weapons",
  "11": "Nuclear ordnance",
  "12": "Fire control equipment",
  "13": "Ammunition & explosives",
  "14": "Guided missiles & rockets",
  "15": "Aircraft & airframe structural components",
  "16": "Aircraft components & accessories",
  "17": "Aircraft launching, landing & ground handling",
  "19": "Ships, small craft & floating docks",
  "20": "Ship & marine equipment",
  "58": "Communications, detection & coherent radiation (radar/EW/crypto)",
};

/** Dual-use keyword taxonomy → capability category. Word-boundary matched, case-insensitive. */
const KEYWORD_CATEGORIES: { category: string; terms: string[] }[] = [
  { category: "Defence & National Security", terms: [
    "\\bmilitary\\b", "\\bdefence\\b", "\\bdefense\\b", "warfighter", "national security",
    "\\bNORAD\\b", "\\bNATO\\b", "\\bIDEaS\\b", "soldier", "expeditionary",
  ]},
  { category: "Aerospace & Aircraft", terms: [
    "aircraft", "avionics", "aircrew", "helicopter", "rotary wing",
    "fixed wing", "fighter jet", "aerospace", "aircraft maintenance", "military aviation",
  ]},
  { category: "Maritime & Naval", terms: [
    "naval", "warship", "frigate", "submarine", "sonar", "torpedo", "shipbuilding",
    "marine propulsion", "coast guard vessel", "patrol vessel", "combat ship",
  ]},
  { category: "Land Systems & Vehicles", terms: [
    "armoured", "armored", "armour", "combat vehicle", "military vehicle",
    "light armoured", "\\bLAV\\b", "tactical vehicle", "battle tank", "mine resistant",
  ]},
  { category: "Weapons & Munitions", terms: [
    "ammunition", "munitions", "small arms", "firearm", "artillery", "\\b155mm\\b",
    "ordnance", "explosive", "warhead", "missile", "grenade", "weapon system", "gunnery",
  ]},
  { category: "C4ISR & Communications", terms: [
    "\\bC4ISR\\b", "\\bISR\\b", "\\bC2\\b", "command and control", "tactical radio",
    "military communications", "secure communications", "satellite communications", "\\bSATCOM\\b",
  ]},
  { category: "Sensors, Radar & EW", terms: [
    "radar", "electronic warfare", "\\bEW\\b", "signals intelligence", "\\bSIGINT\\b",
    "electro-optical", "infrared sensor", "surveillance system", "target acquisition", "jamming",
  ]},
  { category: "Cyber & Security", terms: [
    "cybersecurity", "cyber security", "cyber warfare", "cyber operations", "cyber defence",
    "cyber threat intelligence", "national cyber", "cryptographic", "penetration testing",
  ]},
  { category: "Space & Satellite", terms: [
    "satellite", "space-based", "low earth orbit", "space domain awareness", "ground station",
  ]},
  { category: "AI & Autonomy", terms: [
    "autonomous system", "unmanned aerial", "\\bUAV\\b", "\\bUAS\\b", "\\bUGV\\b", "drone",
    "remotely piloted", "machine learning", "artificial intelligence", "counter-drone", "counter-uas",
  ]},
  { category: "Advanced Materials & Manufacturing", terms: [
    "additive manufacturing", "\\b3d printing\\b", "composite material", "titanium",
    "advanced materials", "rare earth", "ballistic protection",
  ]},
  { category: "CBRN, Medical & Protective", terms: [
    "\\bCBRN\\b", "chemical biological", "body armour", "body armor",
    "night vision", "ballistic vest", "cbrn decontamination",
  ]},
  { category: "Training & Simulation", terms: [
    "military training", "combat simulation", "flight simulator", "live fire",
    "war\\s?game", "synthetic training", "range operations",
  ]},
];

/**
 * Obvious non-defence categories — drop these even if a weak keyword accidentally matched.
 * Includes generic federal IT-staffing vehicles (TBIPS/SBIPS) whose skill-category lists
 * ("Electronic Warfare", "Cyber Security", …) describe staff specializations, not the
 * contract's actual subject — a real source of false positives at corpus scale.
 */
const HARD_EXCLUDE = new RegExp(
  [
    "laundry", "catering", "cafeteria", "food service", "janitorial", "grounds maintenance",
    "groundskeeping", "snow removal", "landscaping", "pest control", "furniture", "uniform cleaning",
    "\\bTBIPS\\b", "\\bSBIPS\\b", "task-based informatics", "task and solutions professional services",
    "cableway repair",
  ].join("|"),
  "i",
);

function numericFsc(gsinCode: string): string | null {
  const digits = gsinCode.replace(/\D/g, "");
  return digits.length >= 2 ? digits.slice(0, 2) : null;
}

function compile(term: string): RegExp {
  // Terms already containing regex tokens (\b…) are used as-is; plain words get word boundaries.
  return /\\/.test(term) ? new RegExp(term, "i") : new RegExp(`\\b${term}\\b`, "i");
}

export interface DefenceMatch {
  isDefence: boolean;
  matchReasons: string[];
  categories: string[];
  /** strongest signal: "buyer" | "gsin" | "keyword" | null */
  strength: "buyer" | "gsin" | "keyword" | null;
}

export interface Classifiable {
  title?: string;
  description?: string;
  gsin?: string;
  unspsc?: string;
  gsinCode?: string;
  buyer?: string;
  endUser?: string;
}

/** Classify a record. Pure function — no I/O. */
export function classifyDefence(rec: Classifiable): DefenceMatch {
  const reasons: string[] = [];
  const categories = new Set<string>();
  let strength: DefenceMatch["strength"] = null;

  // 1. Buyer / end-user organization (also scan title — e.g. "… for Department of National Defence")
  const orgText = `${rec.buyer ?? ""} ${rec.endUser ?? ""} ${rec.title ?? ""}`;
  for (const { pattern, label } of DEFENCE_ORGS) {
    if (pattern.test(orgText)) {
      reasons.push(`Buyer: ${label}`);
      strength = "buyer";
    }
  }

  // 2. Military GSIN family
  const fsc = numericFsc(rec.gsinCode ?? "");
  if (fsc && MILITARY_FSC[fsc]) {
    reasons.push(`GSIN ${fsc}xx — ${MILITARY_FSC[fsc]}`);
    if (strength !== "buyer") strength = "gsin";
  }

  // 3. Dual-use keywords
  const text = `${rec.title ?? ""} ${rec.description ?? ""} ${rec.gsin ?? ""} ${rec.unspsc ?? ""}`;
  for (const { category, terms } of KEYWORD_CATEGORIES) {
    for (const term of terms) {
      if (compile(term).test(text)) {
        categories.add(category);
        reasons.push(`Keyword: ${term.replace(/\\b/g, "")} (${category})`);
        if (!strength) strength = "keyword";
        break; // one hit per category is enough
      }
    }
  }

  let isDefence = reasons.length > 0;

  // Drop obvious junk when the ONLY signal was a weak keyword.
  if (isDefence && strength === "keyword" && HARD_EXCLUDE.test(text)) {
    isDefence = false;
  }

  return { isDefence, matchReasons: reasons, categories: [...categories], strength };
}
