"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useTransition } from "react";

export function ExpiringFiltersBar({ categories }: { categories: { name: string; count: number }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [, startTransition] = useTransition();

  function update(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") params.delete(k);
      else params.set(k, v);
    }
    params.delete("page");
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  const activeCategory = searchParams.get("category") ?? "";
  const activeWindow = searchParams.get("window") ?? "";

  return (
    <div className="panel p-4 space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          update({ q });
        }}
        className="flex gap-2"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title, incumbent vendor, buyer…"
          className="flex-1 bg-panel-2 border border-line rounded-md px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
        />
        <button type="submit" className="px-4 py-2 rounded-md bg-accent text-accent-ink text-sm font-medium">
          Search
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button
          onClick={() => update({ window: activeWindow === "imminent" ? null : "imminent" })}
          className={`chip cursor-pointer ${activeWindow === "imminent" ? "chip-red" : ""}`}
        >
          Imminent (≤6mo)
        </button>
        <button
          onClick={() => update({ window: activeWindow === "near" ? null : "near" })}
          className={`chip cursor-pointer ${activeWindow === "near" ? "chip-accent" : ""}`}
        >
          Near-term (6–18mo)
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {categories.map((c) => (
          <button
            key={c.name}
            onClick={() => update({ category: activeCategory === c.name ? null : c.name })}
            className={`chip cursor-pointer ${activeCategory === c.name ? "chip-blue" : ""}`}
          >
            {c.name} <span className="text-muted-2">{c.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
