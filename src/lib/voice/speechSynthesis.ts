/**
 * Web Speech TTS adapter — short phrases, mute/unmute, interruptible.
 * Isolated behind interface for future cloud TTS swap.
 */

import type { TextToSpeechAdapter } from "@/lib/voice/types";

export function isSpeechSynthesisAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function createBrowserTtsAdapter(): TextToSpeechAdapter {
  let muted = false;

  const adapter: TextToSpeechAdapter = {
    available: isSpeechSynthesisAvailable(),
    get muted() {
      return muted;
    },
    set muted(v: boolean) {
      muted = v;
      if (v) adapter.stop();
    },
    setMuted(v: boolean) {
      adapter.muted = v;
    },
    stop() {
      if (typeof window === "undefined") return;
      window.speechSynthesis?.cancel();
    },
    speak(text: string) {
      return new Promise((resolve) => {
        if (!adapter.available || muted) {
          resolve();
          return;
        }
        const trimmed = text.trim().slice(0, 220);
        if (!trimmed) {
          resolve();
          return;
        }
        adapter.stop();
        const u = new SpeechSynthesisUtterance(trimmed);
        u.rate = 1.02;
        u.pitch = 1;
        u.volume = 0.9;
        u.onend = () => resolve();
        u.onerror = () => resolve();
        window.speechSynthesis.speak(u);
      });
    },
  };

  return adapter;
}

/** Short Jarvis phrases — never verbose narration */
export function jarvisPhraseFor(
  kind: "ack" | "approval" | "complete" | "error" | "listening",
): string {
  switch (kind) {
    case "ack":
      return "On it.";
    case "approval":
      return "This needs your approval.";
    case "complete":
      return "Done. Simulated result ready.";
    case "error":
      return "That didn't work.";
    case "listening":
      return "";
    default:
      return "";
  }
}
