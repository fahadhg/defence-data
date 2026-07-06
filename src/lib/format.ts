/** Small presentation helpers shared by server & client components. */

export function fmtDate(s: string): string {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s.slice(0, 10);
  return d.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

export function closeBadge(daysToClose: number | null): { label: string; tone: "red" | "accent" | "green" | "muted" } {
  if (daysToClose === null) return { label: "No close date", tone: "muted" };
  if (daysToClose < 0) return { label: "Closed", tone: "muted" };
  if (daysToClose === 0) return { label: "Closes today", tone: "red" };
  if (daysToClose <= 14) return { label: `${daysToClose}d left`, tone: "red" };
  if (daysToClose <= 30) return { label: `${daysToClose}d left`, tone: "accent" };
  return { label: `${daysToClose}d left`, tone: "green" };
}

/** Deterministic tone per capability category, for chip coloring. */
export function categoryTone(cat: string): "accent" | "blue" | "green" | "" {
  const map: Record<string, "accent" | "blue" | "green"> = {
    "Defence & National Security": "accent",
    "Weapons & Munitions": "accent",
    "Aerospace & Aircraft": "blue",
    "Maritime & Naval": "blue",
    "Space & Satellite": "blue",
    "C4ISR & Communications": "green",
    "Sensors, Radar & EW": "green",
    "Cyber & Security": "green",
    "AI & Autonomy": "green",
  };
  return map[cat] ?? "";
}

export function fmtMoney(n: number): string {
  if (!isFinite(n)) return "—";
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}
