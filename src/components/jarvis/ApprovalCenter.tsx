"use client";

import { useJarvis } from "@/components/jarvis/JarvisProvider";
import { PERMISSION_LABELS } from "@/lib/jarvis/permissions";
import { formatTime } from "@/lib/utils";

export function ApprovalCenter() {
  const { approvals, resolve, busy } = useJarvis();
  const pending = approvals.filter((a) => a.status === "pending");
  const history = approvals.filter((a) => a.status !== "pending").slice(0, 5);

  return (
    <section className="glass mt-6 p-4 md:p-5" id="approval-center">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="display-font text-[11px] text-[var(--electric)]">APPROVAL CENTER</h2>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Simulated state machine only — Approve/Cancel never claims live execution.
          </p>
        </div>
        <span className="badge-demo">DEMO / SIMULATED</span>
      </div>

      {pending.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">No pending approvals.</p>
      ) : (
        <div className="space-y-3">
          {pending.map((a) => (
            <article
              key={a.id}
              className="border border-[var(--border)] bg-[rgba(3,6,13,0.45)] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-medium text-[var(--text)]">{a.actionLabel}</h3>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{a.description}</p>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] sm:grid-cols-4">
                    <div>
                      <dt className="muted">Agent</dt>
                      <dd className="mono">{a.agentId ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="muted">Project</dt>
                      <dd className="mono">{a.projectId ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="muted">Level</dt>
                      <dd className="mono text-[var(--warn)]">
                        {PERMISSION_LABELS[a.permissionLevel]}
                      </dd>
                    </div>
                    <div>
                      <dt className="muted">When</dt>
                      <dd className="mono">{formatTime(a.timestamp)}</dd>
                    </div>
                  </dl>
                  <p className="mt-2 text-[11px] text-[var(--text-muted)]">
                    Effect: {a.effect}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={busy}
                    onClick={() => void resolve(a.id, "approved")}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="btn-danger"
                    disabled={busy}
                    onClick={() => void resolve(a.id, "rejected")}
                  >
                    Reject
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-5 border-t border-[var(--border)] pt-4">
          <h3 className="mono mb-2 text-[10px] tracking-widest text-[var(--text-muted)]">
            HISTORY
          </h3>
          <ul className="space-y-2">
            {history.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <span>{a.actionLabel}</span>
                <span
                  className={`mono ${
                    a.status === "approved" ? "text-[var(--health)]" : "text-[var(--danger)]"
                  }`}
                >
                  {a.status.toUpperCase()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
