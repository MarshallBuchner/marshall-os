/**
 * Web Speech TTS adapter — short phrases, mute/unmute, interruptible.
 * Isolated behind interface for future cloud TTS swap.
 */

import type { TextToSpeechAdapter, SpeakOptions } from "@/lib/voice/types";

export function isSpeechSynthesisAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function createBrowserTtsAdapter(): TextToSpeechAdapter {
  let muted = false;

  const adapter: TextToSpeechAdapter = {
    available: (() => {
      try {
        return isSpeechSynthesisAvailable();
      } catch {
        return false;
      }
    })(),
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
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* ignore */
      }
    },
    speak(text: string, opts?: SpeakOptions) {
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
        try {
          adapter.stop();
        } catch {
          /* ignore */
        }
        let u: SpeechSynthesisUtterance;
        try {
          u = new SpeechSynthesisUtterance(trimmed);
        } catch {
          resolve();
          return;
        }
        u.rate = 1.02;
        u.pitch = 1;
        u.volume = 0.9;

        let pulse: ReturnType<typeof setInterval> | null = null;
        const clearPulse = () => {
          if (pulse != null) {
            clearInterval(pulse);
            pulse = null;
          }
        };

        const bump = (level: number) => {
          opts?.onEnergy?.(Math.max(0, Math.min(1, level)));
        };

        // Soft OS-voice energy while speaking (drives SPEAKING visuals / jaw)
        bump(0.42);
        pulse = setInterval(() => {
          bump(0.32 + Math.random() * 0.4);
        }, 90);

        u.onboundary = () => {
          bump(0.55 + Math.random() * 0.35);
        };
        u.onend = () => {
          clearPulse();
          bump(0);
          resolve();
        };
        u.onerror = () => {
          clearPulse();
          bump(0);
          resolve();
        };
        try {
          window.speechSynthesis.speak(u);
        } catch {
          clearPulse();
          bump(0);
          resolve();
        }
      });
    },
  };

  return adapter;
}

/** Concise OS voice — never chatbot paragraphs */
export type JarvisPhraseKind =
  | "ack"
  | "transform_ack"
  | "presence_online"
  | "returning"
  | "core_online"
  | "opening_system"
  | "routing_agent"
  | "approval"
  | "approved"
  | "rejected"
  | "complete"
  | "error"
  | "listening";

export function jarvisPhraseFor(
  kind: JarvisPhraseKind,
  ctx?: { name?: string },
): string {
  const name = (ctx?.name ?? "").trim();
  switch (kind) {
    case "ack":
      return "On it.";
    case "transform_ack":
      return "Of course.";
    case "presence_online":
      return "Presence online.";
    case "returning":
      return "Returning.";
    case "core_online":
      return "Core online.";
    case "opening_system":
      return name ? `Opening ${name}.` : "Opening that system.";
    case "routing_agent":
      return name ? `Routing that to ${name}.` : "Routing that.";
    case "approval":
      return "This requires your approval.";
    case "approved":
      return "Approved. Proceeding.";
    case "rejected":
      return "Cancelled.";
    case "complete":
      return "Done.";
    case "error":
      return "I couldn't complete that.";
    case "listening":
      return "";
    default:
      return "";
  }
}
