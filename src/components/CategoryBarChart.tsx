"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * Horizontal bar chart, single-series magnitude encoding (tender count by category).
 * One hue (sequential blue), sorted descending, direct end-labels, row hover.
 * Dark-surface steps from the validated reference palette (references/palette.md).
 */
export function CategoryBarChart({ data }: { data: { name: string; count: number }[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(1, ...data.map((d) => d.count));

  return (
    <div className="space-y-1.5" role="table" aria-label="Open tenders by capability category">
      {data.map((d) => {
        const pct = (d.count / max) * 100;
        const isHover = hover === d.name;
        return (
          <Link
            key={d.name}
            href={`/tenders?category=${encodeURIComponent(d.name)}`}
            onMouseEnter={() => setHover(d.name)}
            onMouseLeave={() => setHover(null)}
            className="flex items-center gap-3 group py-1 rounded-md px-1.5 -mx-1.5 transition-colors"
            style={{ background: isHover ? "var(--panel-2)" : "transparent" }}
          >
            <div className="w-44 shrink-0 text-xs text-muted truncate">{d.name}</div>
            <div className="flex-1 h-4 relative">
              <div
                className="h-full rounded-[4px] transition-[width] duration-150"
                style={{
                  width: `${Math.max(pct, 3)}%`,
                  background: isHover ? "#5598e7" : "#3987e5",
                }}
              />
            </div>
            <div className="w-10 shrink-0 text-xs mono text-right text-muted-2 group-hover:text-foreground transition-colors">
              {d.count}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
