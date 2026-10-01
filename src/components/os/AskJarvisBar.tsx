"use client";

import { useState } from "react";
import { useJarvis } from "@/components/jarvis/JarvisProvider";
import { visualStateLabel } from "@/lib/jarvis/visualState";

const SUGGESTIONS = [
  "What needs my attention?",
  "Check QuantLab performance",
  "Have Cursor investigate QuantLab's mobile dashboard.",
];

/**
 * Primary Ask Jarvis surface — sits with the core + mic.
 * Subtle suggestions only; not a permanent command viz dashboard.
 */
export function AskJarvisBar() {
  const {
    submit,
    busy,
    listening,
    startListening,
    stopListening,
    voiceInputAvailable,
    voiceError,
    transcript,
    visualState,
    voiceMuted,
    setVoiceMuted,
    voiceOutputAvailable,
    setAwake,
    setContextPanel,
    approvals,
    resolve,
  } = useJarvis();
  const [input, setInput] = useState("");

  const pending = approvals.filter((a) => a.status === "pending");

  async function onSend(value: string) {
    const v = value.trim();
    if (!v) return;
    setInput("");
    await submit(v);
  }

  return (
    <div className="ask-jarvis-bar relative z-20 mx-auto w-full max-w-2xl px-4">
      <p className="mb-3 text-center text-lg text-[var(--text)] md:text-xl">
        What can I do for you?
      </p>

      <form
        className="flex items-stretch gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void onSend(input);
        }}
      >
        <div className="relative flex-1">
          <input
            className="input-command pr-12"
            value={listening && transcript ? transcript : input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setAwake(true)}
            placeholder="Ask Jarvis…"
            disabled={busy || listening}
            aria-label="Ask Jarvis"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 mono text-[9px] text-[var(--text-muted)]">
            {visualStateLabel(visualState)}
          </span>
        </div>

        <button
          type="button"
          className={`mic-btn ${listening ? "mic-btn-live" : ""} ${
            !voiceInputAvailable ? "mic-btn-unavailable" : ""
          }`}
          aria-label={
            !voiceInputAvailable
              ? "Voice input not available"
              : listening
                ? "Stop listening"
                : "Start voice input"
          }
          aria-pressed={listening}
          title={
            voiceInputAvailable
              ? listening
                ? "Stop listening"
                : "Click to speak"
              : "VOICE INPUT NOT AVAILABLE"
          }
          onClick={() => {
            if (!voiceInputAvailable) {
              return;
            }
            if (listening) stopListening();
            else void startListening();
          }}
        >
          <MicIcon />
        </button>

        <button type="submit" className="btn-primary shrink-0" disabled={busy || listening}>
          {busy ? "…" : "Ask"}
        </button>
      </form>

      {voiceError && (
        <p className="mt-2 text-center mono text-[10px] text-[var(--warn)]" role="status">
          {voiceError}
        </p>
      )}
      {listening && (
        <p className="mt-2 text-center mono text-[10px] text-[var(--electric)]" role="status">
          LISTENING · LOCAL BROWSER STT · click mic to stop
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        {SUGGESTIONS.map((s) => (
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

      <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
        {voiceOutputAvailable && (
          <button
            type="button"
            className="btn-ghost"
            aria-pressed={voiceMuted}
            onClick={() => setVoiceMuted(!voiceMuted)}
          >
            {voiceMuted ? "Unmute Jarvis" : "Mute Jarvis"}
          </button>
        )}
        <button
          type="button"
          className="btn-ghost"
          onClick={() => setContextPanel("activity")}
        >
          Activity
        </button>
        {pending.length > 0 && (
          <button
            type="button"
            className="btn-ghost text-[var(--warn)]"
            onClick={() => setContextPanel("approvals")}
          >
            Approvals ({pending.length})
          </button>
        )}
        {visualState === "WAITING_APPROVAL" && pending.length === 1 && (
          <>
            <span className="mono text-[9px] text-[var(--text-muted)]">
              Voice: say Approve or Cancel
            </span>
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              aria-label={`Approve ${pending[0].actionLabel}`}
              onClick={() => void resolve(pending[0].id, "approved")}
            >
              Approve
            </button>
            <button
              type="button"
              className="btn-danger"
              disabled={busy}
              aria-label={`Cancel ${pending[0].actionLabel}`}
              onClick={() => void resolve(pending[0].id, "rejected")}
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M5 11a7 7 0 0 0 14 0M12 18v3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
