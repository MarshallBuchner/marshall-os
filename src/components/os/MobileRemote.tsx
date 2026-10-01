"use client";

import { useState } from "react";
import { useJarvis } from "@/components/jarvis/JarvisProvider";
import { AttentionBoard } from "@/components/os/AttentionBoard";
import { SystemActivity } from "@/components/os/SystemActivity";
import { ApprovalCenter } from "@/components/jarvis/ApprovalCenter";
import { SYSTEM_ORBIT, systemStatusLabel } from "@/lib/registry/projects";
import { visualStateLabel } from "@/lib/jarvis/visualState";
import type { ActivityEvent } from "@/types";

const TABS = [
  { id: "ask", label: "Ask" },
  { id: "attention", label: "Attention" },
  { id: "systems", label: "Systems" },
  { id: "activity", label: "Activity" },
  { id: "approvals", label: "Approvals" },
] as const;

/** Practical mobile remote — simplified Jarvis, no full cinematic desktop */
export function MobileRemote({ activitySeed }: { activitySeed: ActivityEvent[] }) {
  const {
    mobileTab,
    setMobileTab,
    setFocus,
    submit,
    busy,
    visualState,
    listening,
    startListening,
    stopListening,
    voiceInputAvailable,
    voiceError,
    transcript,
    voiceMuted,
    setVoiceMuted,
  } = useJarvis();
  const [input, setInput] = useState("");

  return (
    <div className="lg:hidden">
      <header className="mb-3 text-center">
        <h1 className="display-font text-xs tracking-[0.22em] text-[var(--electric)]">
          MARSHALL // OS
        </h1>
        <p className="mt-1 text-sm text-[var(--text)]">What can I do for you?</p>
        <div className="mx-auto mt-3 flex h-24 w-24 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[rgba(8,20,36,0.8)]">
          <div
            className="h-14 w-14 rounded-full border border-[var(--cyan)]"
            style={{
              boxShadow: `0 0 24px ${
                visualState === "WAITING_APPROVAL"
                  ? "rgba(251,191,36,0.35)"
                  : "rgba(125,211,252,0.25)"
              }`,
              opacity: visualState === "IDLE" ? 0.55 : 0.95,
            }}
            aria-hidden
          />
        </div>
        <p className="mt-2 mono text-[10px] text-[var(--text-muted)]">
          JARVIS · {visualStateLabel(visualState)} · DEMO
        </p>
      </header>

      <div className="glass sticky top-[52px] z-30 mb-3 flex gap-1 overflow-x-auto p-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`shrink-0 px-3 py-1.5 text-xs ${
              mobileTab === t.id
                ? "border border-[var(--border-strong)] text-[var(--electric)]"
                : "text-[var(--text-muted)]"
            }`}
            onClick={() => setMobileTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {mobileTab === "ask" && (
        <section className="glass p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const v = input.trim();
              if (!v) return;
              setInput("");
              void submit(v);
            }}
          >
            <input
              className="input-command"
              value={listening && transcript ? transcript : input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Jarvis…"
              disabled={busy || listening}
              aria-label="Ask Jarvis"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className={`mic-btn ${listening ? "mic-btn-live" : ""}`}
                aria-label={listening ? "Stop listening" : "Start voice input"}
                aria-pressed={listening}
                disabled={!voiceInputAvailable}
                onClick={() => {
                  if (listening) stopListening();
                  else void startListening();
                }}
              >
                Mic
              </button>
              <button type="submit" className="btn-primary" disabled={busy}>
                Ask
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setVoiceMuted(!voiceMuted)}
              >
                {voiceMuted ? "Unmute" : "Mute"}
              </button>
            </div>
          </form>
          {!voiceInputAvailable && (
            <p className="mt-2 mono text-[10px] text-[var(--warn)]">
              VOICE INPUT NOT AVAILABLE
            </p>
          )}
          {voiceError && (
            <p className="mt-2 mono text-[10px] text-[var(--warn)]">{voiceError}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {["What needs my attention?", "Check QuantLab performance"].map((s) => (
              <button
                key={s}
                type="button"
                className="chip"
                disabled={busy}
                onClick={() => void submit(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </section>
      )}
      {mobileTab === "attention" && <AttentionBoard />}
      {mobileTab === "systems" && (
        <section className="glass p-4">
          <h2 className="display-font text-[11px] text-[var(--electric)]">SYSTEMS</h2>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Mobile remote — tap for context (no full 3D).
          </p>
          <ul className="mt-3 space-y-2">
            {SYSTEM_ORBIT.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between border border-[var(--border)] px-3 py-2 text-left"
                  onClick={() => setFocus({ kind: "system", id: s.id })}
                >
                  <span>
                    <span className="text-sm">{s.label}</span>
                    <span className="ml-2 mono text-[10px] text-[var(--text-muted)]">
                      {s.category}
                    </span>
                  </span>
                  <span className="mono text-[10px]">{systemStatusLabel(s.status)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {mobileTab === "activity" && <SystemActivity seed={activitySeed} />}
      {mobileTab === "approvals" && <ApprovalCenter />}
    </div>
  );
}
