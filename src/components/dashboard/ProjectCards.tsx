import Link from "next/link";
import type { Project } from "@/types";
import { formatTime } from "@/lib/utils";

export function ProjectCards({ projects }: { projects: Project[] }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="display-font text-sm text-[var(--electric)]">PROJECTS</h2>
        <Link href="/projects" className="btn-ghost">
          Registry
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {projects.map((p) => (
          <Link
            key={p.id}
            href={`/projects/${p.id}`}
            className="glass block p-4 transition-colors hover:border-[var(--border-strong)]"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-medium">{p.name}</h3>
                <p className="mono text-[10px] text-[var(--text-muted)]">{p.category}</p>
              </div>
              <span
                className={`mono text-[10px] uppercase ${
                  p.status === "online"
                    ? "text-[var(--health)]"
                    : p.status === "degraded"
                      ? "text-[var(--warn)]"
                      : "text-[var(--danger)]"
                }`}
              >
                {p.status}
              </span>
            </div>
            <p className="mt-2 line-clamp-2 text-xs text-[var(--text-muted)]">
              {p.description}
            </p>
            <div className="mt-3 flex items-end justify-between border-t border-[var(--border)] pt-3">
              <div>
                <div className="mono text-[10px] text-[var(--text-muted)]">
                  {p.demoMetrics.primaryMetricLabel}
                </div>
                <div className="text-sm text-[var(--electric)]">
                  {p.demoMetrics.primaryMetricValue}
                </div>
              </div>
              <div className="text-right">
                <div className="badge-demo">DEMO</div>
                <div className="mt-1 mono text-[10px] text-[var(--health)]">
                  {p.demoMetrics.health}%
                </div>
              </div>
            </div>
            <div className="mt-2 mono text-[10px] text-[var(--text-muted)]">
              Last deploy:{" "}
              {p.demoMetrics.lastDeploy === "n/a"
                ? "n/a"
                : formatTime(p.demoMetrics.lastDeploy)}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
