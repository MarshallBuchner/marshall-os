/**
 * Dev-only voice lifecycle diagnostics for real-device iPhone traces.
 * Enable: ?voiceDebug=1  OR  localStorage.jarvisVoiceDebug = "1"
 * Disable: ?voiceDebug=0 OR localStorage remove / "0"
 */

export type VoiceDiagEvent =
  | "VOICE_SESSION_REQUESTED"
  | "STT_INSTANCE_CREATED"
  | "STT_START_CALLED"
  | "STT_ONSTART"
  | "STT_AUDIOSTART"
  | "STT_SPEECHSTART"
  | "STT_INTERIM_RESULT"
  | "STT_FINAL_RESULT"
  | "STT_ONEND"
  | "STT_ERROR"
  | "STT_RESULT_DISCARDED_SPEAKING"
  | "TTS_START"
  | "TTS_END"
  | "TTS_CANCEL"
  | "STT_PAUSE_FOR_TTS"
  | "STT_RESTART_REQUESTED"
  | "STT_RESTART_SUCCESS"
  | "STT_RESTART_FAILURE"
  | "STT_TURN_COMPLETE"
  | "VOICE_MODE";

export type VoiceDiagEntry = {
  t: number;
  iso: string;
  event: VoiceDiagEvent;
  detail?: string;
};

const MAX = 200;
const buffer: VoiceDiagEntry[] = [];
let enabledCache: boolean | null = null;

export function isVoiceDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (enabledCache != null) return enabledCache;
  try {
    const q = new URLSearchParams(window.location.search).get("voiceDebug");
    if (q === "1" || q === "true") {
      enabledCache = true;
      localStorage.setItem("jarvisVoiceDebug", "1");
      return true;
    }
    if (q === "0" || q === "false") {
      enabledCache = false;
      localStorage.setItem("jarvisVoiceDebug", "0");
      return false;
    }
    enabledCache = localStorage.getItem("jarvisVoiceDebug") === "1";
    return enabledCache;
  } catch {
    enabledCache = false;
    return false;
  }
}

export function voiceDiag(event: VoiceDiagEvent, detail?: string) {
  if (typeof window === "undefined") return;
  if (!isVoiceDebugEnabled()) return;
  const entry: VoiceDiagEntry = {
    t: performance.now(),
    iso: new Date().toISOString(),
    event,
    detail,
  };
  buffer.push(entry);
  if (buffer.length > MAX) buffer.shift();
  console.info(`[jarvis-voice] ${event}${detail ? ` | ${detail}` : ""}`);
  try {
    window.dispatchEvent(new CustomEvent("jarvis-voice-diag", { detail: entry }));
  } catch {
    /* ignore */
  }
}

export function getVoiceDiagLog(): VoiceDiagEntry[] {
  return [...buffer];
}

export function clearVoiceDiagLog() {
  buffer.length = 0;
}

export function isIosWebKit(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const webkit = /WebKit/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return iOS && (webkit || /Safari/.test(ua) || /iPhone|iPad/.test(ua));
}

/** Expose helpers on window when debug enabled (for Safari console copy). */
export function installVoiceDiagGlobals() {
  if (typeof window === "undefined" || !isVoiceDebugEnabled()) return;
  const w = window as unknown as {
    __jarvisVoiceDiag?: () => VoiceDiagEntry[];
    __jarvisVoiceDiagClear?: () => void;
  };
  w.__jarvisVoiceDiag = () => getVoiceDiagLog();
  w.__jarvisVoiceDiagClear = () => clearVoiceDiagLog();
}
