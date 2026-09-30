import type { Agent } from "@/types";
import { PERMISSION_LABELS } from "@/lib/jarvis/permissions";
import Link from "next/link";

export function AgentsPanel({ agents }: { agents: Agent[] }) {
  return (
    <section className="glass p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="display-font text-sm text-[var(--electric)]">AI AGENTS</h2>
        <Link href="/agents" className="btn-ghost">
          Registry
        </Link>
      </div>
      <p className="mb-3 text-[11px] text-[var(--text-muted)]">
        Registry only — not live APIs. Connection requires server-side configuration later.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {agents.map((a) => (
          <article key={a.id} className="border border-[var(--border)] p-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm">{a.name}</h3>
              <span
                className={`mono text-[10px] uppercase ${
                  a.status === "ready"
                    ? "text-[var(--health)]"
                    : a.status === "needs_config"
                      ? "text-[var(--warn)]"
                      : "text-[var(--text-muted)]"
                }`}
              >
                {a.status.replace("_", " ")}
              </span>
            </div>
            <p className="mono text-[10px] text-[var(--text-muted)]">
              {a.provider} · {a.role}
            </p>
            <p className="mt-2 text-[11px] text-[var(--text-muted)]">
              {a.capabilities.join(" · ")}
            </p>
            <p className="mt-1 mono text-[10px] text-[var(--cyan)]">
              {PERMISSION_LABELS[a.permissionLevel]}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
