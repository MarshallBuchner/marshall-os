import type { CommandIntent, IntentType } from "@/types";
import { listProjects } from "@/lib/registry/projects";

const PROJECT_ALIASES: Record<string, string[]> = {
  powr: ["powr"],
  quantlab: ["quantlab", "quant lab", "trading"],
  northstar: ["northstar", "north star", "machine shop"],
  "build-lab": ["build lab", "buildlab", "experiments"],
  personal: ["personal", "life", "planning"],
};

function detectProject(input: string): string | null {
  const lower = input.toLowerCase();
  for (const project of listProjects()) {
    const aliases = PROJECT_ALIASES[project.id] ?? [project.name.toLowerCase()];
    if (aliases.some((a) => lower.includes(a))) return project.id;
  }
  return null;
}

function detectAgent(input: string): string | null {
  const lower = input.toLowerCase();
  if (lower.includes("cursor")) return "cursor";
  if (lower.includes("claude")) return "claude";
  if (lower.includes("openai") || lower.includes("gpt")) return "openai";
  if (lower.includes("grok")) return "grok";
  return null;
}

function detectIntentType(input: string): IntentType {
  const lower = input.toLowerCase();
  if (
    lower.includes("attention") ||
    lower.includes("need my") ||
    lower.includes("needs my")
  ) {
    return "ATTENTION";
  }
  if (
    lower.includes("investigate") ||
    lower.includes("fix") ||
    lower.includes("implement") ||
    lower.includes("code") ||
    lower.includes("refactor")
  ) {
    return "CODE_TASK";
  }
  if (lower.includes("summarize") || lower.includes("summary") || lower.includes("progress")) {
    return "SUMMARIZE";
  }
  if (lower.includes("performance") || lower.includes("status") || lower.includes("health") || lower.includes("check")) {
    return "STATUS_CHECK";
  }
  if (lower.includes("deploy")) return "DEPLOY_INFO";
  if (lower.includes("calendar") || lower.includes("schedule") || lower.includes("today")) {
    return "SCHEDULE_QUERY";
  }
  if (lower.includes("agent")) return "AGENT_QUERY";
  if (lower.includes("activity") || lower.includes("powr")) return "STATUS_CHECK";
  return "UNKNOWN";
}

export function parseIntent(rawInput: string): CommandIntent {
  const type = detectIntentType(rawInput);
  const targetProjectId = detectProject(rawInput);
  let targetAgentId = detectAgent(rawInput);

  if (type === "CODE_TASK" && !targetAgentId) {
    targetAgentId = "cursor";
  }

  const confidence =
    type === "UNKNOWN" ? 0.35 : targetProjectId || targetAgentId ? 0.86 : 0.7;

  const summaryParts = [type.replace(/_/g, " ").toLowerCase()];
  if (targetProjectId) summaryParts.push(`→ ${targetProjectId}`);
  if (targetAgentId) summaryParts.push(`via ${targetAgentId}`);

  return {
    type,
    confidence,
    targetProjectId,
    targetAgentId,
    summary: summaryParts.join(" "),
    rawInput,
  };
}
