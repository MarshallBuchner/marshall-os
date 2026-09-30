"use client";

import { useJarvis } from "@/components/jarvis/JarvisProvider";
import { PERMISSION_LABELS } from "@/lib/jarvis/permissions";
import { formatTime, statusColor } from "@/lib/utils";

/** Command history as audit trail — not chat bubbles */
export function CommandAudit() {
  const { commands, setActiveCommandId, setConsoleOpen } = useJarvis();

  return (
    <section className="glass p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="display-font text-[11px] text-[var(--electric)]">COMMAND AUDIT</h2>
          <p className="mono text-[10px] text-[var(--text-muted)]">
            REQUEST → INTERPRETATION → TARGET → AGENT → PERMISSION → RESULT
          </p>
        </div>
        <span className="badge-demo">TRAIL</span>
      </div>

      {commands.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">
          No commands yet. Ask Jarvis to begin the audit trail.
        </p>
      ) : (
        <div className="space-y-2">
          {commands.map((c) => (
            <button
              key={c.id}
              type="button"
              className="block w-full border border-[var(--border)] bg-[rgba(2,4,10,0.35)] p-3 text-left transition-colors hover:border-[var(--border-strong)]"
              onClick={() => {
                setActiveCommandId(c.id);
                setConsoleOpen(true);
              }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="mono text-[10px]" style={{ color: statusColor(c.status) }}>
                  {c.status.replace(/_/g, " ")}
                </span>
                {c.permissionLevel && (
                  <span className="mono text-[10px] text-[var(--text-muted)]">
                    {PERMISSION_LABELS[c.permissionLevel]}
                  </span>
                )}
                <span className="badge-demo">SIMULATED</span>
                <span className="ml-auto mono text-[10px] text-[var(--text-muted)]">
                  {formatTime(c.createdAt)}
                </span>
              </div>
              <p className="mt-1 text-xs">{c.input}</p>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] sm:grid-cols-4">
                <div>
                  <dt className="muted">Intent</dt>
                  <dd className="mono">{c.intent?.type ?? "—"}</dd>
                </div>
                <div>
                  <dt className="muted">Target</dt>
                  <dd className="mono">{c.routedProjectId ?? "—"}</dd>
                </div>
                <div>
                  <dt className="muted">Agent / tools</dt>
                  <dd className="mono">{c.routedAgentId ?? "internal"}</dd>
                </div>
                <div>
                  <dt className="muted">Approval</dt>
                  <dd className="mono">
                    {c.requiresApproval
                      ? c.status === "WAITING_APPROVAL"
                        ? "pending"
                        : c.status === "FAILED"
                          ? "rejected/failed"
                          : "resolved"
                      : "n/a"}
                  </dd>
                </div>
              </dl>
              {c.result && (
                <p className="mt-2 text-[11px] text-[var(--text-muted)]">
                  Result: {c.result.message}
                </p>
              )}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
