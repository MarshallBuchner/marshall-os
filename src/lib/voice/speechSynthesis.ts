/**
 * Web Speech TTS adapter — short phrases, mute/unmute, interruptible.
 * Prefers a calm British English system voice when the platform provides one.
 * Never blocks speaking if the preferred voice is unavailable.
 */

import type { TextToSpeechAdapter, SpeakOptions } from "@/lib/voice/types";
import { voiceDiag } from "@/lib/voice/voiceDiagnostics";

/** Calm, understated British AI character — platform voice only, never a likeness clone. */
export const JARVIS_TTS_RATE = 0.93;
export const JARVIS_TTS_PITCH = 0.94;
export const JARVIS_TTS_VOLUME = 1;

export type TtsVoiceDebug = {
  name: string;
  lang: string;
  rate: number;
  pitch: number;
  volume: number;
};

let selectedVoice: SpeechSynthesisVoice | null = null;
let voiceDebug: TtsVoiceDebug = {
  name: "(default)",
  lang: "en",
  rate: JARVIS_TTS_RATE,
  pitch: JARVIS_TTS_PITCH,
  volume: JARVIS_TTS_VOLUME,
};

export function getTtsVoiceDebug(): TtsVoiceDebug {
  return voiceDebug;
}

export function isSpeechSynthesisAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Known male-coded en-GB / UK English system voice name fragments (platform metadata only). */
const MALE_NAME_HINTS =
  /\b(daniel|arthur|oliver|george|ryan|thomas|james|rishi|male|man)\b/i;
const FEMALE_NAME_HINTS =
  /\b(female|woman|fiona|kate|serena|martha|moira|tessa|samantha|karen|susan)\b/i;

function isEnGb(v: SpeechSynthesisVoice): boolean {
  const lang = (v.lang || "").toLowerCase();
  return lang === "en-gb" || lang.startsWith("en-gb") || /uk\s*english/i.test(v.name);
}

function isEnglish(v: SpeechSynthesisVoice): boolean {
  const lang = (v.lang || "").toLowerCase();
  return lang === "en" || lang.startsWith("en-") || /\benglish\b/i.test(v.name);
}

function maleScore(v: SpeechSynthesisVoice): number {
  const n = v.name || "";
  if (FEMALE_NAME_HINTS.test(n)) return -2;
  if (MALE_NAME_HINTS.test(n)) return 2;
  // Some engines expose gender in name as "Google UK English Male"
  if (/\bmale\b/i.test(n)) return 3;
  return 0;
}

/**
 * Preference: en-GB male → any en-GB → any English → null (platform default).
 */
export function pickJarvisTtsVoice(
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  const enGb = voices.filter(isEnGb);
  if (enGb.length) {
    const ranked = [...enGb].sort((a, b) => maleScore(b) - maleScore(a));
    if (maleScore(ranked[0]) > 0) return ranked[0];
    return ranked[0];
  }
  const en = voices.filter(isEnglish);
  if (en.length) {
    const ranked = [...en].sort((a, b) => maleScore(b) - maleScore(a));
    return ranked[0];
  }
  return null;
}

function applyVoiceDebug(voice: SpeechSynthesisVoice | null) {
  voiceDebug = {
    name: voice?.name || "(default)",
    lang: voice?.lang || "en",
    rate: JARVIS_TTS_RATE,
    pitch: JARVIS_TTS_PITCH,
    volume: JARVIS_TTS_VOLUME,
  };
}

function refreshVoices(): SpeechSynthesisVoice | null {
  if (!isSpeechSynthesisAvailable()) {
    selectedVoice = null;
    applyVoiceDebug(null);
    return null;
  }
  try {
    const list = window.speechSynthesis.getVoices() || [];
    selectedVoice = pickJarvisTtsVoice(list);
    applyVoiceDebug(selectedVoice);
    if (list.length) {
      voiceDiag(
        "TTS_VOICE",
        `${voiceDebug.name} · ${voiceDebug.lang} · rate=${voiceDebug.rate} pitch=${voiceDebug.pitch}`,
      );
    }
    return selectedVoice;
  } catch {
    selectedVoice = null;
    applyVoiceDebug(null);
    return null;
  }
}

function ensureVoicesListener() {
  if (typeof window === "undefined" || !isSpeechSynthesisAvailable()) return;
  try {
    refreshVoices();
    // Chrome/Safari often populate voices asynchronously
    window.speechSynthesis.addEventListener?.("voiceschanged", () => {
      refreshVoices();
    });
    // Legacy Safari
    const synth = window.speechSynthesis as SpeechSynthesis & {
      onvoiceschanged?: (() => void) | null;
    };
    const prev = synth.onvoiceschanged;
    synth.onvoiceschanged = () => {
      try {
        prev?.();
      } catch {
        /* ignore */
      }
      refreshVoices();
    };
  } catch {
    /* never block TTS */
  }
}

export function createBrowserTtsAdapter(): TextToSpeechAdapter {
  let muted = false;
  ensureVoicesListener();

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

        // Re-pick if voices arrived after adapter create
        if (!selectedVoice) {
          try {
            refreshVoices();
          } catch {
            /* ignore */
          }
        }
        try {
          if (selectedVoice) u.voice = selectedVoice;
          if (selectedVoice?.lang) u.lang = selectedVoice.lang;
          else u.lang = "en-GB";
        } catch {
          /* speak with platform default */
        }

        u.rate = JARVIS_TTS_RATE;
        u.pitch = JARVIS_TTS_PITCH;
        u.volume = JARVIS_TTS_VOLUME;
        applyVoiceDebug(selectedVoice);
        voiceDiag(
          "TTS_VOICE",
          `${voiceDebug.name} · ${voiceDebug.lang} · rate=${voiceDebug.rate} pitch=${voiceDebug.pitch}`,
        );

        let settled = false;
        let pulse: ReturnType<typeof setInterval> | null = null;
        const clearPulse = () => {
          if (pulse != null) {
            clearInterval(pulse);
            pulse = null;
          }
        };

        const done = () => {
          if (settled) return;
          settled = true;
          window.clearTimeout(guard);
          clearPulse();
          opts?.onEnergy?.(0);
          resolve();
        };

        // iOS Safari often never fires utterance onend — must not stall transform/return
        const guard = window.setTimeout(
          done,
          Math.min(6000, 600 + trimmed.length * 90),
        );

        const bump = (level: number) => {
          if (settled) return;
          opts?.onEnergy?.(Math.max(0, Math.min(1, level)));
        };

        bump(0.42);
        pulse = setInterval(() => {
          bump(0.32 + Math.random() * 0.4);
        }, 90);

        u.onboundary = () => {
          bump(0.55 + Math.random() * 0.35);
        };
        u.onend = () => done();
        u.onerror = () => done();
        try {
          window.speechSynthesis.speak(u);
        } catch {
          done();
        }
      });
    },
  };

  return adapter;
}

/** Concise OS voice — never chatbot paragraphs */
export type JarvisPhraseKind =
  | "ack"
  | "wake_ack"
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
    case "wake_ack":
      return "Yes?";
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
