"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  getVoiceDiagLog,
  isVoiceDebugEnabled,
  type VoiceDiagEntry,
} from "@/lib/voice/voiceDiagnostics";

function subscribeDiag(cb: () => void) {
  window.addEventListener("jarvis-voice-diag", cb);
  const id = window.setInterval(cb, 500);
  return () => {
    window.removeEventListener("jarvis-voice-diag", cb);
    window.clearInterval(id);
  };
}

function getDiagSnapshot(): VoiceDiagEntry[] {
  return getVoiceDiagLog().slice(-12);
}

function getServerSnapshot(): VoiceDiagEntry[] {
  return [];
}

/**
 * Dev-only event strip for real-iPhone verification.
 * Visible only when ?voiceDebug=1 / localStorage.jarvisVoiceDebug=1.
 */
export function VoiceDebugHud() {
  const [enabled] = useState(() =>
    typeof window !== "undefined" ? isVoiceDebugEnabled() : false,
  );
  const lines = useSyncExternalStore(subscribeDiag, getDiagSnapshot, getServerSnapshot);

  useEffect(() => {
    // Ensure globals exist when HUD mounts with debug already on
    if (enabled) {
      void import("@/lib/voice/voiceDiagnostics").then((m) => m.installVoiceDiagGlobals());
    }
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      className="voice-debug-hud"
      role="status"
      aria-label="Voice debug log"
      style={{
        position: "fixed",
        left: 8,
        right: 8,
        bottom: 8,
        zIndex: 9999,
        maxHeight: "28vh",
        overflow: "auto",
        padding: "8px 10px",
        borderRadius: 8,
        background: "rgba(4,10,18,0.88)",
        color: "#9fefc3",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 10,
        lineHeight: 1.35,
        pointerEvents: "none",
        border: "1px solid rgba(159,239,195,0.25)",
      }}
    >
      <div style={{ opacity: 0.7, marginBottom: 4 }}>
        jarvis voiceDebug — console: __jarvisVoiceDiag()
      </div>
      {lines.length === 0 && <div>(waiting for events)</div>}
      {lines.map((e, i) => (
        <div key={`${e.t}-${i}`}>
          {e.event}
          {e.detail ? ` · ${e.detail}` : ""}
        </div>
      ))}
    </div>
  );
}
