/**
 * Deterministic voice UI intents — transport into existing Jarvis pipeline / presence.
 * Not brittle exact-string; normalized fuzzy phrase families.
 */

import { normalizeTranscript } from "@/lib/voice/normalizeTranscript";
import { listProjects } from "@/lib/registry/projects";

export type VoiceUiIntentKind =
  | "TRANSFORM_HUMANOID"
  | "RETURN_TO_CORE"
  | "SHOW_SYSTEM"
  | "APPROVE"
  | "REJECT"
  | "WAKE_ONLY"
  | "PIPELINE";

export type VoiceUiIntent =
  | { kind: "TRANSFORM_HUMANOID"; confidence: number; normalized: string }
  | { kind: "RETURN_TO_CORE"; confidence: number; normalized: string }
  | {
      kind: "SHOW_SYSTEM";
      confidence: number;
      normalized: string;
      projectId: string;
      displayText: string;
    }
  | { kind: "APPROVE"; confidence: number; normalized: string }
  | { kind: "REJECT"; confidence: number; normalized: string }
  | { kind: "WAKE_ONLY"; confidence: number; normalized: string }
  | { kind: "PIPELINE"; confidence: number; normalized: string; displayText: string };

/** Non-destructive UI intents may resolve from stable interim transcripts */
export function isNonDestructiveVoiceIntent(kind: VoiceUiIntentKind): boolean {
  return (
    kind === "TRANSFORM_HUMANOID" ||
    kind === "RETURN_TO_CORE" ||
    kind === "SHOW_SYSTEM"
  );
}

/** STT often hears "core" as car/court/corps in return phrases */
const CORE_TOKEN = "(?:core|car|court|corps)";

const TRANSFORM_PATTERNS: RegExp[] = [
  // "transformed into a human", "transform into human form", "turn into a humanoid"
  /\b(?:transform(?:ed|s|ing)?|turn(?:ed)?)\s+(?:in(?:to)?|to)\s+(?:an?\s+)?human(?:oid)?(?:\s+form|\s+being)?\b/,
  /\btransform(?:ing|ed)?\s+into\s+human(?:\s+form)?\b/,
  /\btransform(?:ing|ed)?\s+to\s+human(?:\s+form)?\b/,
  /\btake\s+(?:on\s+)?(?:an?\s+)?human(?:oid)?\s+form\b/,
  /\bbecome\s+(?:an?\s+)?human(?:oid)?(?:\s+form)?\b/,
  /\bhuman\s+form\b/,
  /\bshow\s+(?:me\s+)?(?:your\s+)?(?:human|humanoid)\s+(?:form|self|presence)?\b/,
  /\bappear\s+as\s+(?:an?\s+)?human(?:oid)?\b/,
  /\bshow\s+yourself\b/,
  /\bhumanoid\s+(?:form|mode|presence)\b/,
  /\benter\s+human(?:oid)?\s+(?:form|mode)\b/,
];

const RETURN_PATTERNS: RegExp[] = [
  new RegExp(`\\breturn\\s+to\\s+(?:the\\s+)?(?:jarvis\\s+)?${CORE_TOKEN}\\b`),
  new RegExp(`\\bback\\s+to\\s+(?:the\\s+)?(?:jarvis\\s+)?${CORE_TOKEN}\\b`),
  new RegExp(`\\bgo\\s+back\\s+to\\s+(?:the\\s+)?${CORE_TOKEN}\\b`),
  new RegExp(`\\brevert\\s+to\\s+(?:the\\s+)?${CORE_TOKEN}\\b`),
  new RegExp(`\\bcollapse\\s+(?:to\\s+)?${CORE_TOKEN}\\b`),
  /\bdismiss\s+(?:the\s+)?(?:presence|humanoid|human(?:oid)?\s+form)\b/,
  /\bexit\s+(?:the\s+)?human(?:oid)?\s+(?:form|mode)\b/,
  /\bexit\s+humanoid\s+mode\b/,
];

const APPROVE_PATTERNS: RegExp[] = [
  /^(approve|yes|confirm|do\s+it|go\s+ahead)(?:\s+it)?$/,
  /^(approve|confirm)\s+(?:the\s+)?(?:request|action|command)$/,
];

const REJECT_PATTERNS: RegExp[] = [
  /^(cancel|reject|no|deny|stop)(?:\s+it)?$/,
  /^(cancel|reject)\s+(?:the\s+)?(?:request|action|command)$/,
];

const PROJECT_ALIASES: Record<string, string[]> = {
  powr: ["powr"],
  quantlab: ["quantlab", "quant lab", "trading"],
  northstar: ["northstar", "north star", "machine shop"],
  "build-lab": ["build lab", "buildlab", "experiments"],
  personal: ["personal", "life os", "life"],
};

function detectShowSystem(normalized: string): { projectId: string; display: string } | null {
  const showLike =
    /\b(?:show|open|focus|pull\s+up|bring\s+up|display)\b/.test(normalized) ||
    /\b(?:show\s+me)\b/.test(normalized);
  if (!showLike) return null;

  for (const project of listProjects()) {
    const aliases = PROJECT_ALIASES[project.id] ?? [project.name.toLowerCase()];
    if (aliases.some((a) => normalized.includes(a))) {
      return {
        projectId: project.id,
        display: `Show me ${project.name}.`,
      };
    }
  }
  return null;
}

/**
 * Parse a (possibly already normalized) transcript into a voice UI intent.
 * RETURN is checked before TRANSFORM so "exit human form" is not swallowed.
 */
export function parseVoiceIntent(rawOrNormalized: string): VoiceUiIntent {
  const normalized = normalizeTranscript(rawOrNormalized);
  if (!normalized) {
    return { kind: "PIPELINE", confidence: 0, normalized: "", displayText: "" };
  }

  // Bare wake after normalize strips "jarvis " — empty means wake-only, or raw was only jarvis
  const rawNorm = (rawOrNormalized ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  if (/^(hey\s+)?jarvis[.!?]*$/.test(rawNorm) || normalized === "jarvis") {
    return { kind: "WAKE_ONLY", confidence: 0.95, normalized: "jarvis" };
  }

  // Return BEFORE transform — "exit/dismiss human form" must not match TRANSFORM
  if (RETURN_PATTERNS.some((re) => re.test(normalized))) {
    return { kind: "RETURN_TO_CORE", confidence: 0.92, normalized };
  }
  if (TRANSFORM_PATTERNS.some((re) => re.test(normalized))) {
    return { kind: "TRANSFORM_HUMANOID", confidence: 0.92, normalized };
  }

  const show = detectShowSystem(normalized);
  if (show) {
    return {
      kind: "SHOW_SYSTEM",
      confidence: 0.88,
      normalized,
      projectId: show.projectId,
      displayText: show.display,
    };
  }

  if (APPROVE_PATTERNS.some((re) => re.test(normalized))) {
    return { kind: "APPROVE", confidence: 0.9, normalized };
  }
  if (REJECT_PATTERNS.some((re) => re.test(normalized))) {
    return { kind: "REJECT", confidence: 0.9, normalized };
  }

  return {
    kind: "PIPELINE",
    confidence: 0.7,
    normalized,
    displayText: rawOrNormalized.trim(),
  };
}

/** Stable interim: same normalized text held long enough + min length */
export function isStableInterim(
  current: string,
  previous: string,
  heldMs: number,
  minHoldMs = 650,
): boolean {
  const a = normalizeTranscript(current);
  const b = normalizeTranscript(previous);
  if (!a || a !== b) return false;
  if (a.split(" ").length < 2 && a.length < 10) return false;
  return heldMs >= minHoldMs;
}
