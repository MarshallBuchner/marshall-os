/**
 * Jarvis orchestration pipeline (server-safe module):
 * User → Command → Intent Parser → Router → Permission Check → (Approval) → Simulated Execution → Result → Activity Log
 *
 * Never pretends real external execution occurred.
 * L4 SENSITIVE is always blocked from execution in V0.
 */

import type {
  ApprovalRequest,
  ExecutionResult,
  JarvisCommand,
} from "@/types";
import { parseIntent } from "@/lib/jarvis/intent";
import { routeCommand } from "@/lib/jarvis/router";
import {
  isLevel4Blocked,
  mayAutoExecute,
  requiresApproval,
} from "@/lib/jarvis/permissions";
import { appendActivity } from "@/lib/jarvis/activity";
import { getAdapter } from "@/lib/adapters";
import { DEMO_PENDING_APPROVALS } from "@/lib/demo/fixtures";
import { getProject, listProjects } from "@/lib/registry/projects";
import { DEMO_SCHEDULE } from "@/lib/demo/fixtures";

let commands: JarvisCommand[] = [];
let approvals: ApprovalRequest[] = [...DEMO_PENDING_APPROVALS];

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function listCommands(): JarvisCommand[] {
  return [...commands].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function listApprovals(): ApprovalRequest[] {
  return [...approvals].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

function buildSimulatedResult(command: JarvisCommand): ExecutionResult {
  const intent = command.intent;
  const project = command.routedProjectId
    ? getProject(command.routedProjectId)
    : undefined;

  let message = "Simulated result complete.";
  const details: Record<string, string> = {
    mode: "SIMULATED",
    note: "No external API or agent was invoked.",
  };

  if (intent?.type === "ATTENTION") {
    const degraded = listProjects().filter((p) => p.status === "degraded");
    const busy = listProjects().filter((p) => p.demoMetrics.openItems > 4);
    message = `Attention brief (demo): ${degraded.length} degraded, ${busy.length} high open-item projects.`;
    details.degraded = degraded.map((p) => p.name).join(", ") || "none";
  } else if (intent?.type === "STATUS_CHECK" && project) {
    message = `${project.name} health ${project.demoMetrics.health}% (DEMO_FIXTURE). ${project.demoMetrics.primaryMetricLabel}: ${project.demoMetrics.primaryMetricValue}.`;
  } else if (intent?.type === "SUMMARIZE") {
    message =
      "Today’s progress (demo): POWR healthy, QuantLab research-only, Northstar needs attention, Build Lab quiet.";
  } else if (intent?.type === "SCHEDULE_QUERY") {
    message = `Schedule (DEMO_FIXTURE): ${DEMO_SCHEDULE.length} items. Google Calendar not configured.`;
  } else if (intent?.type === "CODE_TASK") {
    message = `Plan ready for ${command.routedAgentId ?? "agent"} on ${project?.name ?? "target"}. Simulated only — approve to mark complete, no live execution.`;
  } else if (project) {
    message = `Routed to ${project.name} registry entry (demo).`;
  }

  return {
    executionId: uid("exec"),
    success: true,
    message,
    simulated: true,
    details,
    completedAt: new Date().toISOString(),
  };
}

async function runSimulatedExecution(command: JarvisCommand): Promise<JarvisCommand> {
  if (command.permissionLevel && isLevel4Blocked(command.permissionLevel)) {
    const failed: JarvisCommand = {
      ...command,
      status: "FAILED",
      result: {
        executionId: uid("exec"),
        success: false,
        message:
          "L4 SENSITIVE actions are blocked in V0. No execution performed.",
        simulated: true,
        completedAt: new Date().toISOString(),
      },
    };
    upsertCommand(failed);
    appendActivity({
      what: "Blocked L4 execution attempt",
      who: "jarvis",
      why: command.input,
      whatChanged: "Command marked FAILED — Level 4 not executed",
      approved: false,
      severity: "critical",
      projectId: command.routedProjectId,
      source: "SYSTEM",
    });
    return failed;
  }

  const running: JarvisCommand = { ...command, status: "RUNNING" };
  upsertCommand(running);

  // Optional adapter touch — always placeholder / not configured
  if (command.routedAgentId) {
    const adapter = getAdapter(command.routedAgentId);
    if (adapter) {
      await adapter.execute({
        action: command.proposedAction?.label ?? "simulate",
        payload: { commandId: command.id },
      });
    }
  }

  const result = buildSimulatedResult(running);
  const completed: JarvisCommand = {
    ...running,
    status: "COMPLETED",
    result,
  };
  upsertCommand(completed);

  appendActivity({
    what: completed.proposedAction?.label ?? "Jarvis command",
    who: "jarvis",
    why: completed.input,
    whatChanged: result.message,
    approved: completed.requiresApproval ? true : null,
    severity: "success",
    projectId: completed.routedProjectId,
    source: "SIMULATED",
  });

  return completed;
}

function upsertCommand(cmd: JarvisCommand) {
  const idx = commands.findIndex((c) => c.id === cmd.id);
  if (idx >= 0) commands[idx] = cmd;
  else commands = [cmd, ...commands];
}

function upsertApproval(apr: ApprovalRequest) {
  const idx = approvals.findIndex((a) => a.id === apr.id);
  if (idx >= 0) approvals[idx] = apr;
  else approvals = [apr, ...approvals];
}

export async function submitCommand(input: string): Promise<JarvisCommand> {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Empty command");
  }

  const intent = parseIntent(trimmed);
  const plan = routeCommand(intent);
  const needsApproval = requiresApproval(plan.permissionLevel);

  const command: JarvisCommand = {
    id: uid("cmd"),
    input: trimmed,
    createdAt: new Date().toISOString(),
    intent,
    proposedAction: plan.action,
    routedAgentId: plan.agentId,
    routedProjectId: plan.projectId,
    permissionLevel: plan.permissionLevel,
    requiresApproval: needsApproval,
    status: needsApproval ? "WAITING_APPROVAL" : "PLANNED",
    result: null,
    approvalId: null,
  };

  appendActivity({
    what: `Command received: ${plan.action.label}`,
    who: "marshall",
    why: trimmed,
    whatChanged: `Intent ${intent.type}, permission ${plan.permissionLevel}`,
    approved: null,
    severity: "info",
    projectId: plan.projectId,
    source: "SIMULATED",
  });

  if (needsApproval) {
    const approval: ApprovalRequest = {
      id: uid("apr"),
      commandId: command.id,
      actionLabel: plan.action.label,
      agentId: plan.agentId,
      projectId: plan.projectId,
      permissionLevel: plan.permissionLevel,
      description: plan.action.description,
      effect: plan.action.effect,
      timestamp: new Date().toISOString(),
      status: "pending",
      resolvedAt: null,
    };
    command.approvalId = approval.id;
    upsertApproval(approval);
    upsertCommand(command);
    return command;
  }

  upsertCommand(command);

  if (mayAutoExecute(plan.permissionLevel)) {
    return runSimulatedExecution(command);
  }

  // L2: mark planned then simulate run for V0 clarity
  return runSimulatedExecution({ ...command, status: "PLANNED" });
}

export async function resolveApproval(
  approvalId: string,
  decision: "approved" | "rejected",
): Promise<{ approval: ApprovalRequest; command: JarvisCommand | null }> {
  const approval = approvals.find((a) => a.id === approvalId);
  if (!approval) throw new Error("Approval not found");
  if (approval.status !== "pending") throw new Error("Approval already resolved");

  const resolved: ApprovalRequest = {
    ...approval,
    status: decision,
    resolvedAt: new Date().toISOString(),
  };
  upsertApproval(resolved);

  let command = commands.find((c) => c.id === approval.commandId) ?? null;

  // Demo seed approval may not have a live command — create a stub for UX
  if (!command && approval.commandId.startsWith("cmd-demo")) {
    command = {
      id: approval.commandId,
      input: approval.description,
      createdAt: approval.timestamp,
      intent: {
        type: "CODE_TASK",
        confidence: 0.9,
        targetProjectId: approval.projectId,
        targetAgentId: approval.agentId,
        summary: approval.actionLabel,
        rawInput: approval.description,
      },
      proposedAction: {
        id: "act-demo",
        label: approval.actionLabel,
        description: approval.description,
        effect: approval.effect,
        permissionLevel: approval.permissionLevel,
        reversible: false,
      },
      routedAgentId: approval.agentId,
      routedProjectId: approval.projectId,
      permissionLevel: approval.permissionLevel,
      requiresApproval: true,
      status: "WAITING_APPROVAL",
      result: null,
      approvalId: approval.id,
    };
    upsertCommand(command);
  }

  if (!command) {
    return { approval: resolved, command: null };
  }

  if (decision === "rejected") {
    const rejected: JarvisCommand = {
      ...command,
      status: "FAILED",
      result: {
        executionId: uid("exec"),
        success: false,
        message: "Rejected by operator. No execution performed.",
        simulated: true,
        completedAt: new Date().toISOString(),
      },
    };
    upsertCommand(rejected);
    appendActivity({
      what: `Rejected: ${approval.actionLabel}`,
      who: "marshall",
      why: "Operator rejected approval",
      whatChanged: "Command marked FAILED",
      approved: false,
      severity: "warning",
      projectId: approval.projectId,
      source: "SIMULATED",
    });
    return { approval: resolved, command: rejected };
  }

  const executed = await runSimulatedExecution({
    ...command,
    status: "WAITING_APPROVAL",
  });
  return { approval: resolved, command: executed };
}
