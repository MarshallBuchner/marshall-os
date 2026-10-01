/**
 * Jarvis visual presence — one intelligence, many expressions including transform.
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
  | "ERROR"
  | "TRANSFORM_START"
  | "TRANSFORM_MORPH"
  | "HUMANOID_ACTIVE"
  | "RETURNING";

export type PresenceMode = "core" | "transforming" | "humanoid" | "returning";

export type VisualStateInput = {
  listening: boolean;
  speaking: boolean;
  busy: boolean;
  voiceAvailable: boolean;
  activeCommand: JarvisCommand | null;
  awake: boolean;
  presence: PresenceMode;
  transformProgress: number; // 0–1
};

export function deriveJarvisVisualState(input: VisualStateInput): JarvisVisualState {
  if (input.presence === "transforming") {
    return input.transformProgress < 0.45 ? "TRANSFORM_START" : "TRANSFORM_MORPH";
  }
  if (input.presence === "returning") return "RETURNING";
  if (input.presence === "humanoid") {
    if (input.listening) return "LISTENING";
    if (input.speaking) return "SPEAKING";
    return "HUMANOID_ACTIVE";
  }

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
      return { primary: "#7dd3fc", secondary: "#64748b", intensity: 0.28, pulse: 0.02, particle: 0.18, spin: 0.025 };
    case "AWAKE":
      return { primary: "#a5f3fc", secondary: "#818cf8", intensity: 0.42, pulse: 0.05, particle: 0.28, spin: 0.045 };
    case "LISTENING":
      return { primary: "#67e8f9", secondary: "#c4b5fd", intensity: 0.78, pulse: 0.2, particle: 0.62, spin: 0.09 };
    case "UNDERSTANDING":
      return { primary: "#7dd3fc", secondary: "#a78bfa", intensity: 0.62, pulse: 0.12, particle: 0.45, spin: 0.16 };
    case "ROUTING":
      return { primary: "#5eead4", secondary: "#38bdf8", intensity: 0.7, pulse: 0.14, particle: 0.52, spin: 0.22 };
    case "WAITING_APPROVAL":
      return { primary: "#fbbf24", secondary: "#f59e0b", intensity: 0.58, pulse: 0.04, particle: 0.25, spin: 0.012 };
    case "EXECUTING":
      return { primary: "#5eead4", secondary: "#22d3ee", intensity: 0.72, pulse: 0.16, particle: 0.55, spin: 0.2 };
    case "VERIFYING":
      return { primary: "#a5f3fc", secondary: "#818cf8", intensity: 0.52, pulse: 0.08, particle: 0.35, spin: 0.11 };
    case "SPEAKING":
      return { primary: "#c4b5fd", secondary: "#7dd3fc", intensity: 0.72, pulse: 0.24, particle: 0.5, spin: 0.07 };
    case "COMPLETE":
      return { primary: "#6ee7b7", secondary: "#5eead4", intensity: 0.48, pulse: 0.03, particle: 0.22, spin: 0.03 };
    case "ERROR":
      return { primary: "#fca5a5", secondary: "#f87171", intensity: 0.62, pulse: 0.1, particle: 0.3, spin: 0.05 };
    case "TRANSFORM_START":
      return { primary: "#67e8f9", secondary: "#a78bfa", intensity: 0.85, pulse: 0.15, particle: 0.9, spin: 0.35 };
    case "TRANSFORM_MORPH":
      return { primary: "#38bdf8", secondary: "#c4b5fd", intensity: 0.9, pulse: 0.1, particle: 1, spin: 0.12 };
    case "HUMANOID_ACTIVE":
      return { primary: "#7dd3fc", secondary: "#a78bfa", intensity: 0.65, pulse: 0.06, particle: 0.55, spin: 0.02 };
    case "RETURNING":
      return { primary: "#67e8f9", secondary: "#818cf8", intensity: 0.8, pulse: 0.12, particle: 0.85, spin: 0.28 };
    default:
      return { primary: "#7dd3fc", secondary: "#64748b", intensity: 0.28, pulse: 0.02, particle: 0.18, spin: 0.025 };
  }
}

export function visualStateLabel(state: JarvisVisualState): string {
  return state.replace(/_/g, " ");
}
