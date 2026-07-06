import { Suspense } from "react";
import Link from "next/link";
import { getBlueprintProjects, getBlueprintSnapshot } from "@/lib/data";
import { queryBlueprint } from "@/lib/blueprint";
import { BlueprintProjectCard } from "@/components/BlueprintProjectCard";
import { BlueprintFiltersBar } from "@/components/BlueprintFiltersBar";
import { StatTile } from "@/components/StatTile";

export const metadata = { title: "Defence Investment Plan | Defence Procurement Intelligence" };

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function InvestmentPlanPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const page = Number(first(sp.page) ?? "1") || 1;

  const all = getBlueprintProjects();
  const result = queryBlueprint(all, { q: first(sp.q), category: first(sp.category), page, pageSize: 24 });
  const snapshot = getBlueprintSnapshot();
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Defence Investment Plan</h1>
        <p className="text-sm text-muted mt-0.5 max-w-2xl">
          This is DND&apos;s own published pipeline of major capital, IT, and infrastructure
          projects and significant in-service-support contracts: the demand signal that precedes a
          tender, often by years. From the{" "}
          <a
            href="https://apps.forces.gc.ca/en/defence-capabilities-blueprint/index.asp"
            target="_blank"
            rel="noopener noreferrer"
            className="link-accent"
          >
            Defence Capabilities Blueprint
          </a>
          .{snapshot.generatedAt && <> · updated {new Date(snapshot.generatedAt).toLocaleString("en-CA")}</>}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatTile label="Published projects" value={String(all.length)} tone="accent" />
        <StatTile
          label="Starting within 2 years"
          value={String(all.filter((p) => p.nextMilestoneYear && p.nextMilestoneYear <= new Date().getFullYear() + 2).length)}
          tone="red"
        />
        <StatTile label="Capability categories" value={String(result.facets.categories.length)} tone="blue" />
      </div>

      <Suspense>
        <BlueprintFiltersBar categories={result.facets.categories} />
      </Suspense>

      <div className="text-sm text-muted-2">
        {result.total.toLocaleString()} project{result.total === 1 ? "" : "s"}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {result.rows.map((p) => (
          <BlueprintProjectCard key={p.id} project={p} />
        ))}
      </div>

      {result.rows.length === 0 && (
        <div className="panel p-8 text-center text-muted">No projects match these filters.</div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2 text-sm">
          {page > 1 && (
            <Link className="chip" href={`?${new URLSearchParams({ ...sp, page: String(page - 1) } as Record<string, string>).toString()}`}>
              ← Previous
            </Link>
          )}
          <span className="text-muted-2 mono">
            page {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link className="chip" href={`?${new URLSearchParams({ ...sp, page: String(page + 1) } as Record<string, string>).toString()}`}>
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
