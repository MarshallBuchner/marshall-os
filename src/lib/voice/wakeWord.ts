/**
 * Wake-word architecture stub ONLY.
 * No always-listening / no fake wake word in V0.31.
 * Mic remains explicit click-to-talk; after that a voice *session* may continue
 * until the user stops it. Future: plug a wake engine that gates startListening()
 * behind user consent without changing the command pipeline.
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
