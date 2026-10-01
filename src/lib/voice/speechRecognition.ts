/**
 * Browser SpeechRecognition STT — explicit user gesture only.
 * Feature-detects webkitSpeechRecognition / SpeechRecognition.
 * Supports a single-instance continuous voice session with safe Safari restarts.
 */

import type { SpeechRecognitionResult, SpeechToTextAdapter } from "@/lib/voice/types";

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
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<{
    isFinal: boolean;
    length: number;
    0: { transcript: string; confidence: number };
  }>;
  resultIndex: number;
};

export type SttSessionOptions = {
  /** Keep recognition alive across Safari onend while session is active */
  continuousSession?: boolean;
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
  /** Whether a voice session wants recognition kept alive */
  sessionActive: boolean;
  setSessionActive(active: boolean): void;
  /** Pause recognition without ending the logical session (e.g. during TTS) */
  pauseForTts(): void;
  /** Resume recognition if session still active */
  resumeAfterTts(): void;
};

export function createBrowserSttAdapter(): BrowserSttAdapter {
  const Ctor = getSpeechRecognitionCtor();
  let recognition: BrowserSpeechRecognition | null = null;
  let sessionActive = false;
  let pausingForTts = false;
  let userStopping = false;
  let running = false;
  let restartTimer: ReturnType<typeof setTimeout> | null = null;
  let restartAttempts = 0;
  const MAX_RESTARTS_BURST = 8;

  const clearRestart = () => {
    if (restartTimer != null) {
      clearTimeout(restartTimer);
      restartTimer = null;
    }
  };

  const ensureInstance = () => {
    if (!Ctor) return null;
    if (recognition) return recognition;
    recognition = new Ctor();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;
    if (typeof recognition.maxAlternatives === "number") {
      recognition.maxAlternatives = 1;
    }

    recognition.onstart = () => {
      running = true;
      restartAttempts = 0;
    };

    recognition.onresult = (ev) => {
      // Prefer latest result chunk; accumulate finals for continuous mode
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
        const payload: SpeechRecognitionResult = {
          transcript: finalPiece,
          confidence: confidence || 0.85,
          isFinal: true,
        };
        adapter.onResult?.(payload);
      } else if (interim) {
        adapter.onResult?.({
          transcript: interim,
          confidence: confidence || 0.4,
          isFinal: false,
        });
      }
    };

    recognition.onerror = (ev) => {
      const err = ev.error || "recognition error";
      // Benign / recoverable while session active
      if (err === "aborted") {
        running = false;
        return;
      }
      if (err === "no-speech" || err === "audio-capture") {
        running = false;
        // Let onend handle session restart
        return;
      }
      if (err === "not-allowed" || err === "service-not-allowed") {
        running = false;
        sessionActive = false;
        clearRestart();
        adapter.onError?.("VOICE INPUT NOT AVAILABLE");
        return;
      }
      if (err === "network") {
        running = false;
        adapter.onError?.(`Voice error: ${err}`);
        return;
      }
      // Other errors — report but allow session end handler to decide
      running = false;
      if (!sessionActive) {
        adapter.onError?.(err);
      }
    };

    recognition.onend = () => {
      running = false;
      if (userStopping || pausingForTts) {
        adapter.onEnd?.();
        return;
      }
      if (sessionActive) {
        // Safari often ends recognition after a phrase — safe restart
        scheduleRestart();
        adapter.onEnd?.();
        return;
      }
      adapter.onEnd?.();
    };

    return recognition;
  };

  const scheduleRestart = () => {
    if (!sessionActive || pausingForTts || userStopping) return;
    if (restartAttempts >= MAX_RESTARTS_BURST) {
      sessionActive = false;
      adapter.onError?.("Voice session ended — tap mic to resume.");
      return;
    }
    clearRestart();
    const delay = Math.min(1200, 180 + restartAttempts * 120);
    restartAttempts += 1;
    restartTimer = setTimeout(() => {
      restartTimer = null;
      if (!sessionActive || pausingForTts || userStopping || running) return;
      try {
        const rec = ensureInstance();
        rec?.start();
      } catch {
        // InvalidStateError if already started — ignore
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
    setSessionActive(active: boolean) {
      sessionActive = active;
      if (!active) {
        clearRestart();
        restartAttempts = 0;
      }
    },
    pauseForTts() {
      pausingForTts = true;
      clearRestart();
      userStopping = false;
      try {
        recognition?.stop();
      } catch {
        /* ignore */
      }
    },
    resumeAfterTts() {
      pausingForTts = false;
      if (!sessionActive) return;
      restartAttempts = 0;
      scheduleRestart();
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
      const rec = ensureInstance();
      if (!rec) {
        adapter.onError?.("VOICE INPUT NOT AVAILABLE");
        return;
      }
      if (running) return;
      try {
        rec.start();
      } catch {
        // Already started
        scheduleRestart();
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
    },
    abort() {
      userStopping = true;
      sessionActive = false;
      pausingForTts = false;
      clearRestart();
      try {
        recognition?.abort();
      } catch {
        /* ignore */
      }
      running = false;
    },
  };

  return adapter;
}
