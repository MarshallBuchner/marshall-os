/**
 * Jarvis visual presence states — one coherent core, many expressions.
 * Driven by app/command/voice state; never a separate fake status system.
 */

import type { JarvisCommand } from "@/types";

export type JarvisVisualState =
  | "IDLE"
  | "AWAKE"
  | "LISTENING"
  | "UNDERSTANDING"
  | "ROUTING"
  | "WAITING_APPROVAL"
  | "EXECUTING"
  | "VERIFYING"
  | "SPEAKING"
  | "COMPLETE"
  | "ERROR";

export type VoiceMode = "idle" | "listening" | "unavailable";

export type VisualStateInput = {
  listening: boolean;
  speaking: boolean;
  busy: boolean;
  voiceAvailable: boolean;
  activeCommand: JarvisCommand | null;
  /** User focused the ask surface without a command */
  awake: boolean;
};

export function deriveJarvisVisualState(input: VisualStateInput): JarvisVisualState {
  if (input.listening) return "LISTENING";
  if (input.speaking) return "SPEAKING";

  const cmd = input.activeCommand;
  if (cmd) {
    switch (cmd.status) {
      case "WAITING_APPROVAL":
        return "WAITING_APPROVAL";
      case "RUNNING":
        return input.busy ? "EXECUTING" : "VERIFYING";
      case "COMPLETED":
        return "COMPLETE";
      case "FAILED":
        return "ERROR";
      case "PLANNED":
        return input.busy ? "ROUTING" : "UNDERSTANDING";
      default:
        break;
    }
  }

  if (input.busy) return "UNDERSTANDING";
  if (input.awake) return "AWAKE";
  return "IDLE";
}

/** Accent / material cues per state — ice-blue default, amber for approval */
export function visualAccent(state: JarvisVisualState): {
  primary: string;
  secondary: string;
  intensity: number;
  pulse: number;
  particle: number;
  spin: number;
} {
  switch (state) {
    case "IDLE":
      return {
        primary: "#7dd3fc",
        secondary: "#64748b",
        intensity: 0.22,
        pulse: 0.02,
        particle: 0.12,
        spin: 0.02,
      };
    case "AWAKE":
      return {
        primary: "#a5f3fc",
        secondary: "#818cf8",
        intensity: 0.38,
        pulse: 0.05,
        particle: 0.22,
        spin: 0.04,
      };
    case "LISTENING":
      return {
        primary: "#67e8f9",
        secondary: "#c4b5fd",
        intensity: 0.72,
        pulse: 0.18,
        particle: 0.55,
        spin: 0.08,
      };
    case "UNDERSTANDING":
      return {
        primary: "#7dd3fc",
        secondary: "#a78bfa",
        intensity: 0.58,
        pulse: 0.12,
        particle: 0.4,
        spin: 0.14,
      };
    case "ROUTING":
      return {
        primary: "#5eead4",
        secondary: "#38bdf8",
        intensity: 0.65,
        pulse: 0.14,
        particle: 0.48,
        spin: 0.2,
      };
    case "WAITING_APPROVAL":
      return {
        primary: "#fbbf24",
        secondary: "#f59e0b",
        intensity: 0.55,
        pulse: 0.04,
        particle: 0.2,
        spin: 0.015,
      };
    case "EXECUTING":
      return {
        primary: "#5eead4",
        secondary: "#22d3ee",
        intensity: 0.7,
        pulse: 0.16,
        particle: 0.5,
        spin: 0.18,
      };
    case "VERIFYING":
      return {
        primary: "#a5f3fc",
        secondary: "#818cf8",
        intensity: 0.5,
        pulse: 0.08,
        particle: 0.32,
        spin: 0.1,
      };
    case "SPEAKING":
      return {
        primary: "#c4b5fd",
        secondary: "#7dd3fc",
        intensity: 0.68,
        pulse: 0.22,
        particle: 0.45,
        spin: 0.06,
      };
    case "COMPLETE":
      return {
        primary: "#6ee7b7",
        secondary: "#5eead4",
        intensity: 0.45,
        pulse: 0.03,
        particle: 0.18,
        spin: 0.03,
      };
    case "ERROR":
      return {
        primary: "#fca5a5",
        secondary: "#f87171",
        intensity: 0.6,
        pulse: 0.1,
        particle: 0.28,
        spin: 0.05,
      };
    default:
      return {
        primary: "#7dd3fc",
        secondary: "#64748b",
        intensity: 0.22,
        pulse: 0.02,
        particle: 0.12,
        spin: 0.02,
      };
  }
}

export function visualStateLabel(state: JarvisVisualState): string {
  return state.replace(/_/g, " ");
}
