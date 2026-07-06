const TONE_CLASS: Record<string, string> = {
  accent: "chip-accent",
  blue: "chip-blue",
  green: "chip-green",
  red: "chip-red",
  muted: "",
};

export function Chip({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "accent" | "blue" | "green" | "red" | "muted" | "";
}) {
  return <span className={`chip ${TONE_CLASS[tone] ?? ""}`}>{children}</span>;
}
