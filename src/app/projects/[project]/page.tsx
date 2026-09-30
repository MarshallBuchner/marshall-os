import Link from "next/link";
import { notFound } from "next/navigation";
import { getProject, listProjects } from "@/lib/registry/projects";
import { PERMISSION_LABELS } from "@/lib/jarvis/permissions";
import { ProjectCommandPad } from "@/components/dashboard/ProjectCommandPad";

type Props = { params: Promise<{ project: string }> };

export function generateStaticParams() {
  return listProjects().map((p) => ({ project: p.id }));
}

export default async function ProjectDetailPage({ params }: Props) {
  const { project: id } = await params;
  const project = getProject(id);
  if (!project) notFound();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/projects" className="btn-ghost">
          ← Registry
        </Link>
        <span className="badge-demo">PROJECT MINI COMMAND CENTER</span>
      </div>

      <header className="glass p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="display-font text-2xl text-[var(--electric)]">{project.name}</h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">{project.description}</p>
            <p className="mt-2 mono text-[11px] text-[var(--text-muted)]">
              {project.category} · id:{project.id}
            </p>
          </div>
          <div className="text-right">
            <div
              className={`mono text-xs uppercase ${
                project.status === "online"
                  ? "text-[var(--health)]"
                  : project.status === "degraded"
                    ? "text-[var(--warn)]"
                    : "text-[var(--danger)]"
              }`}
            >
              {project.status}
            </div>
            <div className="mt-1 text-2xl text-[var(--health)] mono">
              {project.demoMetrics.health}%
            </div>
            <div className="badge-demo">DEMO METRICS</div>
          </div>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="glass p-4">
          <h2 className="display-font mb-3 text-sm text-[var(--electric)]">INFRASTRUCTURE</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4 border-b border-[var(--border)] py-2">
              <dt className="muted">Repository</dt>
              <dd className="mono text-xs">{project.repository ?? "Not linked"}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-[var(--border)] py-2">
              <dt className="muted">Deployment</dt>
              <dd className="mono text-xs">{project.deployment ?? "None"}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-[var(--border)] py-2">
              <dt className="muted">Database</dt>
              <dd className="mono text-xs">{project.database ?? "None"}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-[var(--border)] py-2">
              <dt className="muted">Tools</dt>
              <dd className="mono text-xs">{project.tools.join(", ")}</dd>
            </div>
            <div className="flex justify-between gap-4 py-2">
              <dt className="muted">Permissions</dt>
              <dd className="mono text-xs">
                {project.permissions.map((p) => PERMISSION_LABELS[p]).join(" · ")}
              </dd>
            </div>
          </dl>
          {project.id === "quantlab" && (
            <p className="mt-3 border border-[var(--warn)]/40 bg-[rgba(251,191,36,0.06)] p-3 text-xs text-[var(--warn)]">
              QuantLab: research / read-only posture. No live trading. Level 4 execution disabled in V0.
            </p>
          )}
        </section>

        <section className="glass p-4">
          <h2 className="display-font mb-3 text-sm text-[var(--electric)]">DEMO METRICS</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="border border-[var(--border)] p-3">
              <div className="mono text-[10px] text-[var(--text-muted)]">Open items</div>
              <div className="text-xl">{project.demoMetrics.openItems}</div>
            </div>
            <div className="border border-[var(--border)] p-3">
              <div className="mono text-[10px] text-[var(--text-muted)]">
                {project.demoMetrics.primaryMetricLabel}
              </div>
              <div className="text-xl text-[var(--electric)]">
                {project.demoMetrics.primaryMetricValue}
              </div>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-[var(--text-muted)]">
            Source: {project.demoMetrics.source} — distinguishable from production.
          </p>
        </section>
      </div>

      <ProjectCommandPad projectId={project.id} projectName={project.name} />
    </div>
  );
}
