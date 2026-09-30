"use client";

import Link from "next/link";
import { useJarvis } from "@/components/jarvis/JarvisProvider";
import {
  SYSTEM_ORBIT,
  agentConnectionLabel,
  getAgent,
  getProject,
  systemStatusLabel,
} from "@/lib/registry/projects";
import { PERMISSION_LABELS } from "@/lib/jarvis/permissions";
import { formatTime } from "@/lib/utils";

export function FocusPanel() {
  const { focus, clearFocus, submit, setConsoleOpen, busy } = useJarvis();

  if (!focus) {
    return (
      <aside className="glass hidden h-full flex-col p-4 lg:flex">
        <h2 className="display-font text-[11px] text-[var(--electric)]">CONTEXT</h2>
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          Select a system or agent node to enter focus mode. Jarvis stays centered.
        </p>
        <p className="mt-4 mono text-[10px] text-[var(--text-muted)]">
          Overview answers: what&apos;s happening · what needs you · what Jarvis can handle
        </p>
      </aside>
    );
  }

  if (focus.kind === "system") {
    const orbit = SYSTEM_ORBIT.find((n) => n.id === focus.id);
    const project = orbit?.projectId ? getProject(orbit.projectId) : undefined;

    return (
      <aside className="glass flex h-full flex-col p-4">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h2 className="display-font text-[11px] text-[var(--electric)]">SYSTEM FOCUS</h2>
            <p className="mt-1 text-lg text-[var(--text)]">{orbit?.label ?? focus.id}</p>
            <p className="mono text-[10px] text-[var(--text-muted)]">
              {orbit?.category} · {orbit ? systemStatusLabel(orbit.status) : "—"}
            </p>
          </div>
          <button type="button" className="btn-ghost" onClick={clearFocus}>
            Close
          </button>
        </div>

        {project ? (
          <>
            <p className="text-xs text-[var(--text-muted)]">{project.description}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="border border-[var(--border)] p-2">
                <div className="mono text-[9px] text-[var(--text-muted)]">Health</div>
                <div className="text-lg text-[var(--health)]">{project.demoMetrics.health}%</div>
                <span className="badge-demo">DEMO</span>
              </div>
              <div className="border border-[var(--border)] p-2">
                <div className="mono text-[9px] text-[var(--text-muted)]">Open items</div>
                <div className="text-lg">{project.demoMetrics.openItems}</div>
                <span className="badge-demo">DEMO</span>
              </div>
            </div>
            <div className="mt-3 mono text-[10px] text-[var(--text-muted)]">
              {project.demoMetrics.primaryMetricLabel}: {project.demoMetrics.primaryMetricValue}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="chip"
                disabled={busy}
                onClick={() => {
                  setConsoleOpen(true);
                  void submit(`Check ${project.name} status`);
                }}
              >
                Status brief
              </button>
              <button
                type="button"
                className="chip"
                disabled={busy}
                onClick={() => {
                  setConsoleOpen(true);
                  void submit(`What needs attention on ${project.name}?`);
                }}
              >
                Attention
              </button>
              {project.id === "quantlab" && (
                <button
                  type="button"
                  className="chip"
                  disabled={busy}
                  onClick={() => {
                    setConsoleOpen(true);
                    void submit("Have Cursor investigate QuantLab's mobile dashboard.");
                  }}
                >
                  Cursor investigate
                </button>
              )}
            </div>
            <Link href={`/projects/${project.id}`} className="btn-primary mt-4 self-start">
              Open project
            </Link>
          </>
        ) : (
          <>
            <p className="text-xs text-[var(--text-muted)]">
              Integration node — adapter placeholder. No live connection in V0.2.
            </p>
            <p className="mt-3 text-xs text-[var(--warn)]">NOT CONFIGURED</p>
            <Link href="/systems" className="btn-ghost mt-4 self-start">
              View systems
            </Link>
          </>
        )}
      </aside>
    );
  }

  const agent = getAgent(focus.id);
  if (!agent) return null;

  return (
    <aside className="glass flex h-full flex-col p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="display-font text-[11px] text-[var(--electric)]">AGENT FOCUS</h2>
          <p className="mt-1 text-lg">{agent.name}</p>
          <p className="mono text-[10px] text-[var(--text-muted)]">
            {agent.provider} · {agent.role}
          </p>
        </div>
        <button type="button" className="btn-ghost" onClick={clearFocus}>
          Close
        </button>
      </div>

      <dl className="space-y-2 text-xs">
        <div className="flex justify-between gap-3 border-b border-[var(--border)] py-2">
          <dt className="muted">Connection</dt>
          <dd className="mono text-[var(--warn)]">{agentConnectionLabel(agent)}</dd>
        </div>
        <div className="flex justify-between gap-3 border-b border-[var(--border)] py-2">
          <dt className="muted">Permission</dt>
          <dd className="mono">{PERMISSION_LABELS[agent.permissionLevel]}</dd>
        </div>
        <div className="flex justify-between gap-3 border-b border-[var(--border)] py-2">
          <dt className="muted">Last activity</dt>
          <dd className="mono text-[var(--text-muted)]">
            {agent.lastActivity.includes("T") ? formatTime(agent.lastActivity) : agent.lastActivity}
          </dd>
        </div>
      </dl>

      <div className="mt-3">
        <h3 className="mono text-[10px] tracking-widest text-[var(--text-muted)]">CAPABILITIES</h3>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {agent.capabilities.map((c) => (
            <span key={c} className="chip pointer-events-none">
              {c}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <h3 className="mono text-[10px] tracking-widest text-[var(--text-muted)]">RECENT TASKS</h3>
        {agent.recentTasks.length === 0 ? (
          <p className="mt-2 text-xs text-[var(--text-muted)]">None — not connected.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-xs text-[var(--text-muted)]">
            {agent.recentTasks.map((t) => (
              <li key={t}>· {t}</li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-auto pt-4 text-[10px] text-[var(--text-muted)]">
        Never shown as ONLINE/CONNECTED — adapter not live.
      </p>
    </aside>
  );
}
