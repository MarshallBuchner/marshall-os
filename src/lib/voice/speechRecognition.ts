/**
 * Browser SpeechRecognition STT — explicit user gesture only.
 *
 * iOS/WebKit strategy (post-regression): turn-based by default.
 *   tap → start → interim/final → clean stop → command → (optional TTS) → new instance
 * Desktop may use light session restart; never tight-loop after TTS on iOS.
 */

import type { SpeechToTextAdapter } from "@/lib/voice/types";
import {
  isIosWebKit,
  voiceDiag,
} from "@/lib/voice/voiceDiagnostics";

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives?: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  onaudiostart?: (() => void) | null;
  onspeechstart?: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<{
    isFinal: boolean;
    length: number;
    0: { transcript: string; confidence: number };
  }>;
  resultIndex: number;
};

function getSpeechRecognitionCtor():
  | (new () => BrowserSpeechRecognition)
  | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionAvailable(): boolean {
  return getSpeechRecognitionCtor() !== null;
}

export type BrowserSttAdapter = SpeechToTextAdapter & {
  sessionActive: boolean;
  setSessionActive(active: boolean): void;
  /** True while TTS owns the audio path */
  isPausedForTts(): boolean;
  pauseForTts(): void;
  /**
   * Attempt to resume listening after TTS.
   * On iOS: creates a fresh instance once; reports failure instead of looping.
   */
  resumeAfterTts(): { attempted: boolean; ok: boolean; reason?: string };
  /** Platform mode for diagnostics */
  getMode(): "ios-turn" | "desktop-session";
};

export function createBrowserSttAdapter(): BrowserSttAdapter {
  const Ctor = getSpeechRecognitionCtor();
  const ios = typeof navigator !== "undefined" ? isIosWebKit() : false;
  /** iOS: turn-based continuous=false, fresh instance every start */
  const turnBased = ios;

  let recognition: BrowserSpeechRecognition | null = null;
  let sessionActive = false;
  let pausingForTts = false;
  let userStopping = false;
  let running = false;
  let restartTimer: ReturnType<typeof setTimeout> | null = null;
  let restartAttempts = 0;
  const MAX_POST_TTS_RESTART = 1;

  voiceDiag("VOICE_MODE", turnBased ? "ios-turn" : "desktop-session");

  const clearRestart = () => {
    if (restartTimer != null) {
      clearTimeout(restartTimer);
      restartTimer = null;
    }
  };

  const destroyInstance = () => {
    if (!recognition) return;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    recognition.onstart = null;
    if (recognition.onaudiostart) recognition.onaudiostart = null;
    if (recognition.onspeechstart) recognition.onspeechstart = null;
    try {
      recognition.abort();
    } catch {
      /* ignore */
    }
    recognition = null;
    running = false;
  };

  const bindInstance = (rec: BrowserSpeechRecognition) => {
    rec.lang = "en-US";
    rec.interimResults = true;
    // iOS WebKit: continuous=true is unreliable and can suppress results
    rec.continuous = turnBased ? false : true;
    if (typeof rec.maxAlternatives === "number") rec.maxAlternatives = 1;

    rec.onstart = () => {
      running = true;
      voiceDiag("STT_ONSTART");
    };
    rec.onaudiostart = () => voiceDiag("STT_AUDIOSTART");
    rec.onspeechstart = () => voiceDiag("STT_SPEECHSTART");

    rec.onresult = (ev) => {
      let interim = "";
      let finalPiece = "";
      let confidence = 0;
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const piece = ev.results[i];
        if (!piece?.[0]) continue;
        confidence = piece[0].confidence ?? confidence;
        if (piece.isFinal) finalPiece += piece[0].transcript;
        else interim += piece[0].transcript;
      }
      if (finalPiece) {
        voiceDiag("STT_FINAL_RESULT", finalPiece.slice(0, 80));
        adapter.onResult?.({
          transcript: finalPiece,
          confidence: confidence || 0.85,
          isFinal: true,
        });
      } else if (interim) {
        voiceDiag("STT_INTERIM_RESULT", interim.slice(0, 80));
        adapter.onResult?.({
          transcript: interim,
          confidence: confidence || 0.4,
          isFinal: false,
        });
      }
    };

    rec.onerror = (ev) => {
      const err = ev.error || "recognition error";
      running = false;
      voiceDiag("STT_ERROR", err);
      if (err === "aborted") return;
      if (err === "no-speech") {
        // Turn ends; let onend fire
        return;
      }
      if (err === "not-allowed" || err === "service-not-allowed") {
        sessionActive = false;
        clearRestart();
        adapter.onError?.("VOICE INPUT NOT AVAILABLE");
        return;
      }
      if (err === "network" || err === "audio-capture") {
        adapter.onError?.(`Voice error: ${err}`);
        return;
      }
      if (!sessionActive) adapter.onError?.(err);
    };

    rec.onend = () => {
      running = false;
      voiceDiag("STT_ONEND", `pausingForTts=${pausingForTts} session=${sessionActive}`);
      if (userStopping || pausingForTts) {
        adapter.onEnd?.();
        return;
      }
      // Turn-based: one shot complete — do not auto-loop (provider runs command)
      if (turnBased) {
        voiceDiag("STT_TURN_COMPLETE");
        adapter.onEnd?.();
        return;
      }
      // Desktop session: gentle restart between phrases (not after TTS — see resumeAfterTts)
      if (sessionActive) {
        scheduleDesktopRestart();
      }
      adapter.onEnd?.();
    };
  };

  const createFreshInstance = () => {
    if (!Ctor) return null;
    destroyInstance();
    recognition = new Ctor();
    voiceDiag("STT_INSTANCE_CREATED", turnBased ? "turn-based" : "session");
    bindInstance(recognition);
    return recognition;
  };

  const scheduleDesktopRestart = () => {
    if (turnBased || !sessionActive || pausingForTts || userStopping) return;
    if (restartAttempts >= 4) {
      sessionActive = false;
      adapter.onError?.("Voice session ended — tap mic to resume.");
      return;
    }
    clearRestart();
    const delay = Math.min(800, 200 + restartAttempts * 100);
    restartAttempts += 1;
    voiceDiag("STT_RESTART_REQUESTED", `desktop delay=${delay}`);
    restartTimer = setTimeout(() => {
      restartTimer = null;
      if (!sessionActive || pausingForTts || userStopping || running) return;
      try {
        const rec = createFreshInstance();
        voiceDiag("STT_START_CALLED", "desktop-restart");
        rec?.start();
        voiceDiag("STT_RESTART_SUCCESS", "desktop");
      } catch (e) {
        voiceDiag("STT_RESTART_FAILURE", String(e));
      }
    }, delay);
  };

  const adapter: BrowserSttAdapter = {
    available: Ctor !== null,
    onResult: null,
    onEnd: null,
    onError: null,
    get sessionActive() {
      return sessionActive;
    },
    getMode() {
      return turnBased ? "ios-turn" : "desktop-session";
    },
    setSessionActive(active: boolean) {
      sessionActive = active;
      if (!active) {
        clearRestart();
        restartAttempts = 0;
      }
    },
    isPausedForTts() {
      return pausingForTts;
    },
    pauseForTts() {
      pausingForTts = true;
      clearRestart();
      voiceDiag("STT_PAUSE_FOR_TTS");
      try {
        recognition?.stop();
      } catch {
        /* ignore */
      }
      // iOS: destroy instance so next start is a clean WebKit object
      if (turnBased) {
        destroyInstance();
      }
    },
    resumeAfterTts() {
      pausingForTts = false;
      if (!sessionActive) {
        return { attempted: false, ok: false, reason: "session-inactive" };
      }
      // iOS: auto-restart after TTS is the known WebKit failure mode.
      // Attempt at most once with a fresh instance; caller should fall back to "tap mic".
      if (turnBased) {
        if (restartAttempts >= MAX_POST_TTS_RESTART) {
          voiceDiag("STT_RESTART_FAILURE", "ios-post-tts-cap");
          return { attempted: false, ok: false, reason: "ios-needs-gesture" };
        }
        restartAttempts += 1;
        voiceDiag("STT_RESTART_REQUESTED", "ios-post-tts-once");
        try {
          const rec = createFreshInstance();
          if (!rec) {
            voiceDiag("STT_RESTART_FAILURE", "no-ctor");
            return { attempted: true, ok: false, reason: "no-ctor" };
          }
          voiceDiag("STT_START_CALLED", "ios-post-tts");
          rec.start();
          voiceDiag("STT_RESTART_SUCCESS", "ios-post-tts");
          return { attempted: true, ok: true };
        } catch (e) {
          voiceDiag("STT_RESTART_FAILURE", String(e));
          return { attempted: true, ok: false, reason: String(e) };
        }
      }
      restartAttempts = 0;
      scheduleDesktopRestart();
      return { attempted: true, ok: true };
    },
    async start() {
      if (!Ctor) {
        adapter.onError?.("VOICE INPUT NOT AVAILABLE");
        return;
      }
      userStopping = false;
      pausingForTts = false;
      sessionActive = true;
      clearRestart();
      restartAttempts = 0;
      voiceDiag("VOICE_SESSION_REQUESTED", turnBased ? "ios-turn" : "desktop-session");
      // Always fresh instance — restores pre-regression reliability on iOS
      const rec = createFreshInstance();
      if (!rec) {
        adapter.onError?.("VOICE INPUT NOT AVAILABLE");
        return;
      }
      if (running) return;
      try {
        voiceDiag("STT_START_CALLED", "user-gesture");
        rec.start();
      } catch (e) {
        voiceDiag("STT_ERROR", `start-threw ${String(e)}`);
        adapter.onError?.("VOICE INPUT NOT AVAILABLE");
      }
    },
    stop() {
      userStopping = true;
      sessionActive = false;
      pausingForTts = false;
      clearRestart();
      try {
        recognition?.stop();
      } catch {
        /* ignore */
      }
      if (turnBased) destroyInstance();
    },
    abort() {
      userStopping = true;
      sessionActive = false;
      pausingForTts = false;
      clearRestart();
      destroyInstance();
    },
  };

  return adapter;
}
