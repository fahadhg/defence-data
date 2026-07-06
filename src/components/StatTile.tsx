export function StatTile({
  label,
  value,
  sub,
  tone = "muted",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "accent" | "blue" | "green" | "red" | "muted";
}) {
  const toneColor: Record<string, string> = {
    accent: "var(--accent)",
    blue: "var(--blue)",
    green: "var(--green)",
    red: "var(--red)",
    muted: "var(--foreground)",
  };
  return (
    <div className="panel p-4">
      <div className="text-xs text-muted-2 uppercase tracking-wide">{label}</div>
      <div className="mt-1.5 text-2xl font-semibold mono" style={{ color: toneColor[tone] }}>
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  );
}
