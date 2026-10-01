/**
 * Dev-only voice lifecycle diagnostics for real-device iPhone traces.
 * Enable: ?voiceDebug=1 (required every visit — not sticky).
 * Absent / other values: disabled. Clears any legacy localStorage flag.
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
  | "TTS_VOICE"
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
/** Bumped whenever the log changes — stabilizes useSyncExternalStore snapshots */
let diagVersion = 0;
let cachedSnapshot: VoiceDiagEntry[] = [];
let cachedSnapshotVersion = -1;

function bumpDiagVersion() {
  diagVersion += 1;
}

export function getVoiceDiagVersion(): number {
  return diagVersion;
}

/** True only when the URL explicitly has ?voiceDebug=1 (or true). */
function urlVoiceDebugEnabled(): boolean {
  try {
    const q = new URLSearchParams(window.location.search).get("voiceDebug");
    return q === "1" || q === "true";
  } catch {
    return false;
  }
}

/** Drop legacy sticky flag so bare production visits stay clean. */
function clearLegacyVoiceDebugStorage() {
  try {
    if (localStorage.getItem("jarvisVoiceDebug") != null) {
      localStorage.removeItem("jarvisVoiceDebug");
    }
  } catch {
    /* ignore */
  }
}

/** Pure read for useSyncExternalStore — no storage writes. */
export function peekVoiceDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (enabledCache != null) return enabledCache;
  return urlVoiceDebugEnabled();
}

export function isVoiceDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (enabledCache != null) return enabledCache;
  clearLegacyVoiceDebugStorage();
  enabledCache = urlVoiceDebugEnabled();
  return enabledCache;
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
  bumpDiagVersion();
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

/** Stable snapshot for useSyncExternalStore — same array ref until version bumps */
export function getVoiceDiagSnapshot(limit = 12): VoiceDiagEntry[] {
  if (cachedSnapshotVersion !== diagVersion) {
    cachedSnapshot = buffer.slice(-limit);
    cachedSnapshotVersion = diagVersion;
  }
  return cachedSnapshot;
}

export function clearVoiceDiagLog() {
  buffer.length = 0;
  bumpDiagVersion();
}

export function isIosWebKit(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
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
