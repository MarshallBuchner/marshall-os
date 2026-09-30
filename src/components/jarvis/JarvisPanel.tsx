"use client";

import { useEffect, useState } from "react";
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

function CommandCard({ command }: { command: JarvisCommand }) {
  return (
    <article className="glass mb-3 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span
          className="mono text-[10px] tracking-wider"
          style={{ color: statusColor(command.status) }}
        >
          {command.status.replace("_", " ")}
        </span>
        {command.permissionLevel && (
          <span className="mono text-[10px] text-[var(--text-muted)]">
            {PERMISSION_LABELS[command.permissionLevel]}
          </span>
        )}
        {command.requiresApproval && (
          <span className="badge-demo border-[var(--warn)]!">Approval</span>
        )}
        <span className="ml-auto mono text-[10px] text-[var(--text-muted)]">
          {formatTime(command.createdAt)}
        </span>
      </div>
      <p className="text-sm text-[var(--text)]">{command.input}</p>
      {command.intent && (
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
          <dt className="muted">Intent</dt>
          <dd className="mono text-[var(--electric)]">{command.intent.type}</dd>
          <dt className="muted">Target</dt>
          <dd className="mono">{command.routedProjectId ?? "—"}</dd>
          <dt className="muted">Agent</dt>
          <dd className="mono">{command.routedAgentId ?? "—"}</dd>
          <dt className="muted">Action</dt>
          <dd>{command.proposedAction?.label ?? "—"}</dd>
        </dl>
      )}
      {command.result && (
        <p className="mt-2 border-t border-[var(--border)] pt-2 text-[12px] text-[var(--text-muted)]">
          <span className="badge-demo mr-2">Simulated</span>
          {command.result.message}
        </p>
      )}
    </article>
  );
}

export function JarvisPanel() {
  const { panelOpen, setPanelOpen, submit, commands, busy } = useJarvis();
  const [input, setInput] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPanelOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setPanelOpen]);

  if (!panelOpen) return null;

  async function onSubmit(value: string) {
    const v = value.trim();
    if (!v) return;
    setInput("");
    await submit(v);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-[2px]">
      <button
        type="button"
        className="flex-1 cursor-default"
        aria-label="Close overlay"
        onClick={() => setPanelOpen(false)}
      />
      <aside className="glass-strong flex h-full w-full max-w-md flex-col border-l border-[var(--border-strong)] shadow-[-12px_0_40px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <div>
            <div className="display-font text-xs text-[var(--electric)]">JARVIS</div>
            <div className="mono text-[10px] text-[var(--text-muted)]">
              COMMAND INTERFACE · SIMULATED PIPELINE
            </div>
          </div>
          <button type="button" className="btn-ghost" onClick={() => setPanelOpen(false)}>
            Close
          </button>
        </div>

        <div className="border-b border-[var(--border)] p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void onSubmit(input);
            }}
          >
            <label className="mb-2 block mono text-[10px] tracking-widest text-[var(--text-muted)]">
              ASK JARVIS ANYTHING…
            </label>
            <input
              className="input-command"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Have Cursor investigate QuantLab's mobile dashboard."
              disabled={busy}
              autoFocus
            />
            <div className="mt-2 flex justify-end">
              <button type="submit" className="btn-primary" disabled={busy}>
                {busy ? "Routing…" : "Send"}
              </button>
            </div>
          </form>
          <div className="mt-3 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                className="chip"
                disabled={busy}
                onClick={() => void onSubmit(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
          <div className="mb-2 mono text-[10px] tracking-widest text-[var(--text-muted)]">
            HISTORY
          </div>
          {commands.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              No commands yet. Try a suggestion above.
            </p>
          ) : (
            commands.map((c) => <CommandCard key={c.id} command={c} />)
          )}
        </div>
      </aside>
    </div>
  );
}
