"use client";

import { useState } from "react";
import { useJarvis } from "@/components/jarvis/JarvisProvider";

type Props = {
  showPrompt?: boolean;
  cinematic?: boolean;
};

/** Elegant ask + mic. Presence commands available as quiet text actions. */
export function AskJarvisBar({ showPrompt = true, cinematic = true }: Props) {
  const {
    submit,
    busy,
    listening,
    speaking,
    startListening,
    stopListening,
    voiceSessionActive,
    voiceInputAvailable,
    voiceError,
    transcript,
    visualState,
    setAwake,
    approvals,
    resolve,
    presence,
    transformProgress,
    beginTransform,
    returnToCore,
    presenceDiagnostic,
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
    <div
      className={`ask-jarvis-bar ${cinematic ? "ask-jarvis-cinematic" : ""}`}
      data-presence={presence}
      data-transform-progress={transformProgress.toFixed(3)}
    >
      {showPrompt && <p className="ask-prompt">What can I do for you?</p>}

      <form
        className="ask-form"
        onSubmit={(e) => {
          e.preventDefault();
          void onSend(input);
        }}
      >
        <input
          className="ask-input"
          value={(listening || voiceSessionActive) && transcript ? transcript : input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => setAwake(true)}
          placeholder="Ask Jarvis"
          disabled={
            busy ||
            listening ||
            voiceSessionActive ||
            presence === "transforming" ||
            presence === "returning"
          }
          aria-label="Ask Jarvis"
        />
        <button
          type="button"
          className={`mic-orb ${listening || voiceSessionActive ? "mic-orb-live" : ""} ${
            !voiceInputAvailable ? "mic-orb-off" : ""
          }`}
          aria-label={
            !voiceInputAvailable
              ? "Voice input not available"
              : listening
                ? "Stop voice session"
                : "Start voice session"
          }
          aria-pressed={listening}
          onClick={() => {
            if (!voiceInputAvailable) return;
            // Use listening only — after TTS continue prompt, session may be inactive
            // and a single tap must start the next turn (not stopListening).
            if (listening) stopListening();
            else void startListening();
          }}
        >
          <MicIcon />
        </button>
      </form>

      {voiceError && (
        <p className="ask-status warn" role="status">
          {voiceError}
        </p>
      )}
      {speaking && (
        <p className="ask-status" role="status">
          Speaking
        </p>
      )}
      {(listening || voiceSessionActive) && !voiceError && !speaking && (
        <p className="ask-status" role="status">
          {listening ? "Listening" : "Voice session"}
        </p>
      )}
      {(presence === "transforming" || presence === "returning") && !speaking && (
        <p className="ask-status" role="status">
          {presence === "transforming"
            ? transformProgress < 0.55
              ? "Resolving form"
              : "Assembling…"
            : "Returning"}
        </p>
      )}
      {presence === "humanoid" && !speaking && !listening && (
        <p className="ask-status" role="status">
          Presence online
        </p>
      )}
      {presenceDiagnostic && (
        <p className="ask-status warn" role="status">
          {presenceDiagnostic}
        </p>
      )}

      <div className="ask-quiet-actions">
        {presence === "core" && (
          <button type="button" className="ask-text-btn" onClick={() => beginTransform()}>
            Transform
          </button>
        )}
        {(presence === "humanoid" || presence === "transforming") && (
          <button type="button" className="ask-text-btn" onClick={() => returnToCore()}>
            Return to core
          </button>
        )}
      </div>

      {visualState === "WAITING_APPROVAL" && pending.length === 1 && (
        <div className="ask-approval-row">
          <button
            type="button"
            className="ask-text-btn primary"
            disabled={busy}
            aria-label={`Approve ${pending[0].actionLabel}`}
            onClick={() => void resolve(pending[0].id, "approved")}
          >
            Approve
          </button>
          <button
            type="button"
            className="ask-text-btn"
            disabled={busy}
            aria-label={`Cancel ${pending[0].actionLabel}`}
            onClick={() => void resolve(pending[0].id, "rejected")}
          >
            Cancel
          </button>
        </div>
      )}
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
