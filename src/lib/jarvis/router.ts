import type { Action, CommandIntent, PermissionLevel } from "@/types";
import { getAgent, getProject } from "@/lib/registry/projects";
import { permissionForIntent } from "@/lib/jarvis/permissions";

export interface RoutePlan {
  intent: CommandIntent;
  agentId: string | null;
  projectId: string | null;
  adapterId: string | null;
  permissionLevel: PermissionLevel;
  action: Action;
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function routeCommand(intent: CommandIntent): RoutePlan {
  const projectId = intent.targetProjectId;
  const agentId =
    intent.targetAgentId ??
    (intent.type === "CODE_TASK" ? "cursor" : intent.type === "SUMMARIZE" ? "openai" : null);

  const project = projectId ? getProject(projectId) : undefined;
  const agent = agentId ? getAgent(agentId) : undefined;

  const permissionLevel = permissionForIntent(
    intent.type,
    agent?.permissionLevel === "L3_IMPORTANT" && intent.type === "CODE_TASK"
      ? "L3_IMPORTANT"
      : null,
  );

  const adapterId = agentId ?? (project?.tools[0] ?? null);

  let label = "Inspect system state";
  let description = intent.summary;
  let effect = "Simulated internal read — no external side effects.";

  switch (intent.type) {
    case "CODE_TASK":
      label = `Code task via ${agent?.name ?? "agent"}`;
      description = `Route investigation/work for ${project?.name ?? "target"} to ${agent?.name ?? "selected agent"}.`;
      effect =
        "Simulated agent handoff plan only. No repo mutation, no live Cursor/API execution in V0.";
      break;
    case "ATTENTION":
      label = "Compile attention brief";
      description = "Aggregate degraded systems and high open-item counts.";
      effect = "Returns demo attention summary from fixtures.";
      break;
    case "STATUS_CHECK":
      label = `Status check${project ? `: ${project.name}` : ""}`;
      description = `Report demo health for ${project?.name ?? "all projects"}.`;
      effect = "Reads project registry demo metrics only.";
      break;
    case "SUMMARIZE":
      label = "Summarize progress";
      description = "Produce a short progress summary from demo activity.";
      effect = "Simulated summary from demo fixtures.";
      break;
    case "SCHEDULE_QUERY":
      label = "Today at a glance";
      description = "List demo schedule items (Calendar adapter not configured).";
      effect = "Returns DEMO_FIXTURE schedule.";
      break;
    case "DEPLOY_INFO":
      label = "Deployment info";
      description = "Show last demo deploy metadata from registry.";
      effect = "No Vercel API call — registry metadata only.";
      break;
    default:
      label = "Clarify command";
      description = "Intent unclear; propose a safe read of command center state.";
      effect = "No privileged action.";
  }

  return {
    intent,
    agentId,
    projectId,
    adapterId,
    permissionLevel,
    action: {
      id: uid("act"),
      label,
      description,
      effect,
      permissionLevel,
      reversible: permissionLevel !== "L3_IMPORTANT" && permissionLevel !== "L4_SENSITIVE",
    },
  };
}
