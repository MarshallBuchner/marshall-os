"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  getVoiceDiagSnapshot,
  getVoiceDiagVersion,
  isVoiceDebugEnabled,
  peekVoiceDebugEnabled,
  type VoiceDiagEntry,
} from "@/lib/voice/voiceDiagnostics";
import { getTtsVoiceDebug } from "@/lib/voice/speechSynthesis";

function subscribeDiag(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("jarvis-voice-diag", cb);
  const id = window.setInterval(cb, 1000);
  return () => {
    window.removeEventListener("jarvis-voice-diag", cb);
    window.clearInterval(id);
  };
}

function getDiagSnapshot(): VoiceDiagEntry[] {
  void getVoiceDiagVersion();
  return getVoiceDiagSnapshot(12);
}

const EMPTY_SNAP: VoiceDiagEntry[] = [];

function getServerDiagSnapshot(): VoiceDiagEntry[] {
  return EMPTY_SNAP;
}

function subscribeDebugFlag(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

function getDebugFlagSnapshot(): boolean {
  try {
    return peekVoiceDebugEnabled();
  } catch {
    return false;
  }
}

function getServerDebugFlagSnapshot(): boolean {
  return false;
}

function subscribeTtsVoice(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("jarvis-voice-diag", cb);
  try {
    window.speechSynthesis?.addEventListener?.("voiceschanged", cb);
  } catch {
    /* ignore */
  }
  const id = window.setInterval(cb, 1500);
  return () => {
    window.removeEventListener("jarvis-voice-diag", cb);
    try {
      window.speechSynthesis?.removeEventListener?.("voiceschanged", cb);
    } catch {
      /* ignore */
    }
    window.clearInterval(id);
  };
}

let cachedTtsLabel = "TTS voice · (pending)";

function getTtsLabelSnapshot(): string {
  try {
    const v = getTtsVoiceDebug();
    const label = `TTS voice · ${v.name} · ${v.lang} · rate=${v.rate} pitch=${v.pitch}`;
    if (label !== cachedTtsLabel) cachedTtsLabel = label;
    return cachedTtsLabel;
  } catch {
    return cachedTtsLabel;
  }
}

function getServerTtsLabelSnapshot(): string {
  return "TTS voice · (pending)";
}

function VoiceDebugHudActive() {
  const lines = useSyncExternalStore(subscribeDiag, getDiagSnapshot, getServerDiagSnapshot);
  const ttsLine = useSyncExternalStore(
    subscribeTtsVoice,
    getTtsLabelSnapshot,
    getServerTtsLabelSnapshot,
  );

  useEffect(() => {
    try {
      void isVoiceDebugEnabled();
    } catch {
      /* ignore */
    }
    void import("@/lib/voice/voiceDiagnostics").then((m) => m.installVoiceDiagGlobals());
  }, []);

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
      <div style={{ opacity: 0.85, marginBottom: 4 }}>{ttsLine}</div>
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

/**
 * Dev-only event strip for real-iPhone verification.
 * Visible only when ?voiceDebug=1 / localStorage.jarvisVoiceDebug=1.
 */
export function VoiceDebugHud() {
  const enabled = useSyncExternalStore(
    subscribeDebugFlag,
    getDebugFlagSnapshot,
    getServerDebugFlagSnapshot,
  );

  if (!enabled) return null;
  return <VoiceDebugHudActive />;
}
