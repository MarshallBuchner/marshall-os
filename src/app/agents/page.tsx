import { listAgents } from "@/lib/registry/projects";
import { PERMISSION_LABELS } from "@/lib/jarvis/permissions";
import { formatTime } from "@/lib/utils";

export default function AgentsPage() {
  const agents = listAgents();

  return (
    <div className="space-y-5">
      <header>
        <h1 className="display-font text-xl text-[var(--electric)]">AI AGENTS</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Agent registry — roles, capabilities, permission levels. Not connected to live provider APIs in V0.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {agents.map((a) => (
          <article key={a.id} className="glass p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg text-[var(--text)]">{a.name}</h2>
                <p className="mono text-[11px] text-[var(--text-muted)]">
                  {a.provider} · {a.role}
                </p>
              </div>
              <span
                className={`mono text-[10px] uppercase ${
                  a.status === "ready"
                    ? "text-[var(--health)]"
                    : "text-[var(--warn)]"
                }`}
              >
                {a.status.replace("_", " ")}
              </span>
            </div>

            <div className="mt-4">
              <h3 className="mono text-[10px] tracking-widest text-[var(--text-muted)]">
                CAPABILITIES
              </h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {a.capabilities.map((c) => (
                  <span key={c} className="chip pointer-events-none">
                    {c}
                  </span>
                ))}
              </div>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="muted">Permission</dt>
                <dd className="mono text-[var(--cyan)]">
                  {PERMISSION_LABELS[a.permissionLevel]}
                </dd>
              </div>
              <div>
                <dt className="muted">Last activity</dt>
                <dd className="mono text-[var(--text-muted)]">
                  {a.lastActivity.includes("T")
                    ? formatTime(a.lastActivity)
                    : a.lastActivity}
                </dd>
              </div>
            </dl>

            <div className="mt-4 border-t border-[var(--border)] pt-3">
              <h3 className="mono text-[10px] tracking-widest text-[var(--text-muted)]">
                RECENT TASKS
              </h3>
              {a.recentTasks.length === 0 ? (
                <p className="mt-2 text-xs text-[var(--text-muted)]">None recorded.</p>
              ) : (
                <ul className="mt-2 space-y-1 text-xs text-[var(--text-muted)]">
                  {a.recentTasks.map((t) => (
                    <li key={t}>· {t}</li>
                  ))}
                </ul>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
