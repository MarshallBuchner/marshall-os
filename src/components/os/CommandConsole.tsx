"use client";

import { useMemo, useState } from "react";
import { useJarvis } from "@/components/jarvis/JarvisProvider";
import { PERMISSION_LABELS } from "@/lib/jarvis/permissions";
import { formatTime, statusColor } from "@/lib/utils";
import type { JarvisCommand } from "@/types";

const SUGGESTIONS = [
  "What needs my attention?",
  "Check QuantLab performance",
  "Show new POWR activity",
  "Summarize today's progress",
  "Have Cursor investigate QuantLab's mobile dashboard.",
];

const PIPELINE = [
  "UNDERSTANDING",
  "TARGET",
  "INTENT",
  "ROUTE",
  "PERMISSION",
  "STATUS",
] as const;

function pipelineValues(cmd: JarvisCommand | null) {
  if (!cmd) {
    return {
      UNDERSTANDING: "—",
      TARGET: "—",
      INTENT: "—",
      ROUTE: "—",
      PERMISSION: "—",
      STATUS: "IDLE",
    };
  }
  return {
    UNDERSTANDING: cmd.intent?.summary ?? "Parsing…",
    TARGET: cmd.routedProjectId ?? "environment",
    INTENT: cmd.intent?.type ?? "UNKNOWN",
    ROUTE: cmd.routedAgentId
      ? `agent:${cmd.routedAgentId}`
      : cmd.proposedAction?.label ?? "internal",
    PERMISSION: cmd.permissionLevel
      ? PERMISSION_LABELS[cmd.permissionLevel]
      : "—",
    STATUS: cmd.status.replace(/_/g, " "),
  };
}

export function CommandConsole() {
  const {
    consoleOpen,
    setConsoleOpen,
    submit,
    busy,
    commands,
    activeCommandId,
    setActiveCommandId,
    approvals,
    resolve,
  } = useJarvis();
  const [input, setInput] = useState("");

  const active = useMemo(() => {
    if (!activeCommandId) {
      return (
        commands.find((c) => c.status === "WAITING_APPROVAL") ?? commands[0] ?? null
      );
    }
    return commands.find((c) => c.id === activeCommandId) ?? commands[0] ?? null;
  }, [commands, activeCommandId]);

  const values = pipelineValues(active);

  const pendingApproval =
    active?.approvalId
      ? approvals.find((a) => a.id === active.approvalId && a.status === "pending")
      : active?.status === "WAITING_APPROVAL"
        ? approvals.find(
            (a) =>
              a.status === "pending" &&
              a.projectId === active.routedProjectId &&
              a.agentId === active.routedAgentId,
          )
        : null;

  async function onSend(value: string) {
    const v = value.trim();
    if (!v) return;
    setInput("");
    setConsoleOpen(true);
    const cmd = await submit(v);
    if (cmd) setActiveCommandId(cmd.id);
  }

  return (
    <section className="glass p-4 md:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="display-font text-[11px] text-[var(--electric)]">ASK JARVIS</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Primary command surface — expands into the orchestration console.
          </p>
        </div>
        <span className="badge-demo">SIMULATED PIPELINE</span>
      </div>

      <form
        className="mt-4"
        onSubmit={(e) => {
          e.preventDefault();
          void onSend(input);
        }}
      >
        <input
          className="input-command"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => setConsoleOpen(true)}
          placeholder="ASK JARVIS…"
          disabled={busy}
          aria-label="Ask Jarvis"
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.slice(0, consoleOpen ? 5 : 3).map((s) => (
              <button
                key={s}
                type="button"
                className="chip"
                disabled={busy}
                onClick={() => void onSend(s)}
              >
                {s}
              </button>
            ))}
          </div>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? "Routing…" : "Send"}
          </button>
        </div>
      </form>

      <div
        className="os-fade overflow-hidden"
        style={{
          maxHeight: consoleOpen ? 720 : 0,
          opacity: consoleOpen ? 1 : 0,
          marginTop: consoleOpen ? 16 : 0,
        }}
      >
        <div className="border-t border-[var(--border)] pt-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="mono text-[10px] tracking-[0.18em] text-[var(--text-muted)]">
              COMMAND VISUALIZATION
            </h3>
            <button type="button" className="btn-ghost" onClick={() => setConsoleOpen(false)}>
              Collapse
            </button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {PIPELINE.map((step, idx) => (
              <div
                key={`${active?.id ?? "idle"}-${step}`}
                className="pipeline-step done border border-[var(--border)] bg-[rgba(2,4,10,0.45)] p-3 pipeline-step-anim"
                style={{ animationDelay: `${idx * 90}ms` }}
              >
                <div className="mono text-[9px] tracking-widest text-[var(--text-muted)]">
                  {step}
                </div>
                <div
                  className="mt-1 text-xs"
                  style={{
                    color:
                      step === "STATUS" && active
                        ? statusColor(active.status)
                        : "var(--text)",
                  }}
                >
                  {values[step]}
                </div>
              </div>
            ))}
          </div>

          {active && (
            <div className="mt-4 border border-[var(--border)] p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge-demo">SIMULATED / DEMO</span>
                <span className="mono text-[10px] text-[var(--text-muted)]">
                  {formatTime(active.createdAt)}
                </span>
              </div>
              <p className="mt-2 text-sm">{active.input}</p>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                Action: {active.proposedAction?.label ?? "—"} · Effect:{" "}
                {active.proposedAction?.effect ?? "—"}
              </p>
              {active.result && (
                <p className="mt-2 text-xs text-[var(--electric)]">{active.result.message}</p>
              )}

              {pendingApproval && (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--border)] pt-3">
                  <span className="mono text-[10px] text-[var(--warn)]">APPROVAL REQUIRED</span>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={busy}
                    onClick={() => void resolve(pendingApproval.id, "approved")}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="btn-danger"
                    disabled={busy}
                    onClick={() => void resolve(pendingApproval.id, "rejected")}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
