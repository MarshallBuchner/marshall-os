import Link from "next/link";
import { listProjects } from "@/lib/registry/projects";

export default function ProjectsPage() {
  const projects = listProjects();

  return (
    <div className="space-y-5">
      <header>
        <h1 className="display-font text-xl text-[var(--electric)]">PROJECT REGISTRY</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Source of truth for projects. Components read from the registry — logic is not hardwired in UI.
        </p>
      </header>

      <div className="overflow-x-auto glass">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Repo</th>
              <th className="px-4 py-3">Deploy</th>
              <th className="px-4 py-3">Health</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id} className="border-b border-[var(--border)]/60 hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <Link href={`/projects/${p.id}`} className="text-[var(--electric)] hover:underline">
                    {p.name}
                  </Link>
                  <div className="text-[11px] text-[var(--text-muted)]">{p.description}</div>
                </td>
                <td className="px-4 py-3 mono text-xs">{p.category}</td>
                <td className="px-4 py-3 mono text-xs uppercase">{p.status}</td>
                <td className="px-4 py-3 mono text-[11px] text-[var(--text-muted)]">
                  {p.repository ?? "—"}
                </td>
                <td className="px-4 py-3 mono text-[11px] text-[var(--text-muted)]">
                  {p.deployment ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <span className="health-text mono text-xs">{p.demoMetrics.health}%</span>
                  <span className="badge-demo ml-2">DEMO</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
