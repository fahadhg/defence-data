import type { BlueprintProject } from "@/lib/blueprint";
import { categoryTone } from "@/lib/format";
import { Chip } from "./Chip";

export function BlueprintProjectCard({ project }: { project: BlueprintProject }) {
  return (
    <a
      href={project.url}
      target="_blank"
      rel="noopener noreferrer"
      className="panel block p-4 hover:border-line-strong transition-colors group"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium leading-snug text-[0.95rem] group-hover:text-accent transition-colors">
          {project.title}
        </h3>
        {project.fundingRange && <Chip tone="accent">{project.fundingRange}</Chip>}
      </div>
      {project.objective && (
        <p className="mt-2 text-sm text-muted line-clamp-2">{project.objective}</p>
      )}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {project.categories.map((c) => (
          <Chip key={c} tone={categoryTone(c)}>{c}</Chip>
        ))}
        {project.projectType && <Chip>{project.projectType}</Chip>}
      </div>
      <div className="mt-3 text-xs text-muted-2 mono">
        {project.nextMilestoneLabel
          ? `Next: ${project.nextMilestoneLabel}${project.nextMilestoneYear && project.nextMilestoneYear < 9999 ? ` (${project.nextMilestoneYear})` : ""}`
          : "Timeline not yet published"}
      </div>
    </a>
  );
}
