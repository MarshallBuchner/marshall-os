/**
 * Wake-word architecture stub ONLY.
 * No always-listening. Mic remains explicit click-to-talk.
 * Future: plug a wake engine that gates startListening() behind user consent.
 */

export type WakeWordConfig = {
  enabled: false;
  phrase: "hey jarvis";
  /** Always false in V0 — hard safety rail */
  alwaysListening: false;
};

export const WAKE_WORD_CONFIG: WakeWordConfig = {
  enabled: false,
  phrase: "hey jarvis",
  alwaysListening: false,
};

export function canEnableWakeWord(): false {
  return false;
}
