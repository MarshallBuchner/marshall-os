/**
 * Web Speech TTS adapter — short phrases, mute/unmute, interruptible.
 * Prefers a calm British English system voice when the platform provides one.
 * Never blocks speaking if the preferred voice is unavailable.
 *
 * Authoritative speak path: createBrowserTtsAdapter().speak → speechSynthesis.speak.
 * Voice selection re-resolves a live SpeechSynthesisVoice from getVoices() at speak time
 * (iOS Safari stale voice objects otherwise silently fall back to a non-British default).
 */

import type { TextToSpeechAdapter, SpeakOptions } from "@/lib/voice/types";
import { voiceDiag } from "@/lib/voice/voiceDiagnostics";

/** Calm, understated British AI character — platform voice only, never a likeness clone. */
export const JARVIS_TTS_RATE = 0.93;
export const JARVIS_TTS_PITCH = 0.94;
export const JARVIS_TTS_VOLUME = 1;

/** Preference label — not proof the engine used this voice. */
export const TTS_VOICE_REQUESTED = "Daniel en-GB (British male system voice)";

export type TtsVoiceDebug = {
  /** Stated preference (never proof of engine selection). */
  requested: string;
  /** en-GB voice names present in the last getVoices() snapshot. */
  availableEnGb: string[];
  /** Voice chosen by pickJarvisTtsVoice from that snapshot. */
  selectedName: string;
  selectedLang: string;
  /**
   * utterance.voice immediately before speechSynthesis.speak.
   * If "(undefined)" / empty — the bug: engine will use platform default.
   */
  actualName: string;
  actualLang: string;
  lang: string;
  rate: number;
  pitch: number;
  volume: number;
  /** HUD shorthand — mirrors ACTUAL when known, else SELECTED. */
  name: string;
};

const emptyDebug = (): TtsVoiceDebug => ({
  requested: TTS_VOICE_REQUESTED,
  availableEnGb: [],
  selectedName: "(none)",
  selectedLang: "",
  actualName: "(undefined)",
  actualLang: "",
  lang: "en-GB",
  rate: JARVIS_TTS_RATE,
  pitch: JARVIS_TTS_PITCH,
  volume: JARVIS_TTS_VOLUME,
  name: "(pending)",
});

let voiceDebug: TtsVoiceDebug = emptyDebug();
let voicesListenerInstalled = false;

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
  if (/\bmale\b/i.test(n)) return 3;
  if (MALE_NAME_HINTS.test(n)) return 2;
  return 0;
}

function isDanielEnGb(v: SpeechSynthesisVoice): boolean {
  return isEnGb(v) && /\bdaniel\b/i.test(v.name || "");
}

/**
 * Preference: real Daniel en-GB → best en-GB male (known names) → best en-GB → English → null.
 * Always returns a real SpeechSynthesisVoice from the provided list, or null.
 * Never fabricates a voice object from a name string.
 */
export function pickJarvisTtsVoice(
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | null {
  if (!voices.length) return null;

  const daniel = voices.find(isDanielEnGb);
  if (daniel) return daniel;

  const enGb = voices.filter(isEnGb);
  if (enGb.length) {
    const males = [...enGb]
      .filter((v) => maleScore(v) > 0)
      .sort((a, b) => maleScore(b) - maleScore(a));
    if (males.length) return males[0];
    return enGb[0];
  }

  const en = voices.filter(isEnglish);
  if (en.length) {
    const males = [...en]
      .filter((v) => maleScore(v) > 0)
      .sort((a, b) => maleScore(b) - maleScore(a));
    if (males.length) return males[0];
    return en[0];
  }

  return null;
}

/** Re-resolve preferred voice against a fresh getVoices() list (iOS stale-object fix). */
function resolveLiveVoice(
  preferred: SpeechSynthesisVoice | null,
  liveList: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | null {
  if (!preferred || !liveList.length) return null;
  if (preferred.voiceURI) {
    const byUri = liveList.find((v) => v.voiceURI === preferred.voiceURI);
    if (byUri) return byUri;
  }
  const byNameLang = liveList.find(
    (v) => v.name === preferred.name && v.lang === preferred.lang,
  );
  if (byNameLang) return byNameLang;
  return liveList.find((v) => v.name === preferred.name) || null;
}

function readVoices(): SpeechSynthesisVoice[] {
  if (!isSpeechSynthesisAvailable()) return [];
  try {
    return window.speechSynthesis.getVoices() || [];
  } catch {
    return [];
  }
}

/**
 * Bounded wait for iOS/Chrome async voice population.
 * Resolves with whatever is available — never infinite, never blocks forever.
 */
function waitForVoices(maxMs = 1500): Promise<SpeechSynthesisVoice[]> {
  const immediate = readVoices();
  if (immediate.length) return Promise.resolve(immediate);
  if (!isSpeechSynthesisAvailable()) return Promise.resolve([]);

  return new Promise((resolve) => {
    let settled = false;
    let poll: ReturnType<typeof setInterval> | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const finish = (voices: SpeechSynthesisVoice[]) => {
      if (settled) return;
      settled = true;
      try {
        window.speechSynthesis.removeEventListener?.("voiceschanged", onChange);
      } catch {
        /* ignore */
      }
      if (poll != null) clearInterval(poll);
      if (timer != null) clearTimeout(timer);
      resolve(voices);
    };

    const onChange = () => {
      const list = readVoices();
      if (list.length) finish(list);
    };

    try {
      window.speechSynthesis.addEventListener?.("voiceschanged", onChange);
    } catch {
      /* ignore */
    }

    // Kick Chrome/Safari voice load
    try {
      void window.speechSynthesis.getVoices();
    } catch {
      /* ignore */
    }

    poll = setInterval(() => {
      const list = readVoices();
      if (list.length) finish(list);
    }, 100);

    timer = setTimeout(() => finish(readVoices()), maxMs);
  });
}

function ensureVoicesListener() {
  if (typeof window === "undefined" || !isSpeechSynthesisAvailable()) return;
  if (voicesListenerInstalled) return;
  voicesListenerInstalled = true;
  try {
    void window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener?.("voiceschanged", () => {
      // Warm cache only — speak() always re-reads live voices
      void readVoices();
    });
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
      void readVoices();
    };
  } catch {
    /* never block TTS */
  }
}

function formatVoiceLabel(v: SpeechSynthesisVoice | null | undefined): string {
  if (!v) return "(undefined)";
  return `${v.name || "(unnamed)"} · ${v.lang || "?"}`;
}

/**
 * Record REQUESTED / AVAILABLE / SELECTED / ACTUAL from the live utterance.
 * ACTUAL must come from utterance.voice — never from the preferred/selected cache alone.
 */
function commitUtteranceDebug(
  selected: SpeechSynthesisVoice | null,
  available: SpeechSynthesisVoice[],
  utterance: SpeechSynthesisUtterance,
) {
  const actual = utterance.voice ?? null;
  const enGbNames = available.filter(isEnGb).map((v) => `${v.name} (${v.lang})`);
  voiceDebug = {
    requested: TTS_VOICE_REQUESTED,
    availableEnGb: enGbNames,
    selectedName: selected?.name || "(none)",
    selectedLang: selected?.lang || "",
    actualName: actual?.name || "(undefined)",
    actualLang: actual?.lang || "",
    lang: utterance.lang || "",
    rate: utterance.rate,
    pitch: utterance.pitch,
    volume: utterance.volume,
    name: actual?.name || selected?.name || "(default)",
  };

  voiceDiag(
    "TTS_VOICE",
    [
      `REQUESTED=${TTS_VOICE_REQUESTED}`,
      `AVAILABLE_enGB=[${enGbNames.join(" | ") || "none"}]`,
      `SELECTED=${formatVoiceLabel(selected)}`,
      `ACTUAL=${formatVoiceLabel(actual)}`,
      `lang=${utterance.lang}`,
      `rate=${utterance.rate}`,
      `pitch=${utterance.pitch}`,
      `volume=${utterance.volume}`,
    ].join(" · "),
  );
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
      return (async () => {
        if (!adapter.available || muted) return;
        const trimmed = text.trim().slice(0, 220);
        if (!trimmed) return;

        try {
          adapter.stop();
        } catch {
          /* ignore */
        }

        // Bounded wait — never infinite; speak even if list stays empty
        let available: SpeechSynthesisVoice[] = [];
        try {
          available = await waitForVoices(1500);
        } catch {
          available = readVoices();
        }

        // Fresh snapshot again immediately before assign (iOS stale objects)
        const liveList = readVoices();
        const list = liveList.length ? liveList : available;
        const preferred = pickJarvisTtsVoice(list);
        const selected = resolveLiveVoice(preferred, list) || preferred;

        let u: SpeechSynthesisUtterance;
        try {
          u = new SpeechSynthesisUtterance(trimmed);
        } catch {
          return;
        }

        // Assign voice + lang first, then delivery params — do not recreate utterance after
        try {
          if (selected) {
            u.voice = selected;
            u.lang = selected.lang || "en-GB";
          } else {
            u.lang = "en-GB";
          }
        } catch {
          try {
            u.lang = "en-GB";
          } catch {
            /* platform default */
          }
        }

        u.rate = JARVIS_TTS_RATE;
        u.pitch = JARVIS_TTS_PITCH;
        u.volume = JARVIS_TTS_VOLUME;

        // Log ACTUAL utterance fields immediately BEFORE speak
        commitUtteranceDebug(selected, list, u);

        await new Promise<void>((resolve) => {
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
      })();
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
