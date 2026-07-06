"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useTransition } from "react";

export function TenderFiltersBar({
  categories,
  procurementTypes,
}: {
  categories: { name: string; count: number }[];
  procurementTypes: { name: string; count: number }[];
}) {
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
  const activeProcurement = searchParams.get("procurement") ?? "";
  const closingSoon = searchParams.get("closingSoon") === "1";

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
          placeholder="Search title, description, buyer, GSIN…"
          className="flex-1 bg-panel-2 border border-line rounded-md px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
        />
        <button type="submit" className="px-4 py-2 rounded-md bg-accent text-accent-ink text-sm font-medium">
          Search
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button
          onClick={() => update({ closingSoon: closingSoon ? null : "1" })}
          className={`chip cursor-pointer ${closingSoon ? "chip-red" : ""}`}
        >
          Closing within 14 days
        </button>
        <span className="w-px h-4 bg-line mx-1" />
        {procurementTypes.map((p) => (
          <button
            key={p.name}
            onClick={() => update({ procurement: activeProcurement === p.name ? null : p.name })}
            className={`chip cursor-pointer ${activeProcurement === p.name ? "chip-accent" : ""}`}
          >
            {p.name} <span className="text-muted-2">{p.count}</span>
          </button>
        ))}
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
