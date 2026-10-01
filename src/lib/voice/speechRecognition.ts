/**
 * Browser SpeechRecognition STT — explicit user gesture only.
 * Feature-detects; never claims availability when missing.
 */

import type { SpeechRecognitionResult, SpeechToTextAdapter } from "@/lib/voice/types";

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string; confidence: number } }>;
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

export function createBrowserSttAdapter(): SpeechToTextAdapter {
  const Ctor = getSpeechRecognitionCtor();
  let recognition: BrowserSpeechRecognition | null = null;

  const adapter: SpeechToTextAdapter = {
    available: Ctor !== null,
    onResult: null,
    onEnd: null,
    onError: null,
    async start() {
      if (!Ctor) {
        adapter.onError?.("VOICE INPUT NOT AVAILABLE");
        return;
      }
      recognition = new Ctor();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.onresult = (ev) => {
        const result = ev.results[ev.results.length - 1];
        if (!result) return;
        const payload: SpeechRecognitionResult = {
          transcript: result[0].transcript,
          confidence: result[0].confidence ?? 0,
          isFinal: result.isFinal,
        };
        adapter.onResult?.(payload);
      };
      recognition.onerror = (ev) => {
        if (ev.error === "aborted" || ev.error === "no-speech") {
          adapter.onEnd?.();
          return;
        }
        adapter.onError?.(ev.error || "recognition error");
      };
      recognition.onend = () => {
        adapter.onEnd?.();
      };
      recognition.start();
    },
    stop() {
      recognition?.stop();
    },
    abort() {
      try {
        recognition?.abort();
      } catch {
        /* ignore */
      }
    },
  };

  return adapter;
}
