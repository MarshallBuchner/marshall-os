/**
 * Marshall OS / JARVIS — core domain types
 * V0 orchestration layer contracts
 */

export type PermissionLevel = "L1_READ" | "L2_REVERSIBLE" | "L3_IMPORTANT" | "L4_SENSITIVE";

export type CommandStatus =
  | "PLANNED"
  | "WAITING_APPROVAL"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED";

export type IntentType =
  | "CODE_TASK"
  | "STATUS_CHECK"
  | "SUMMARIZE"
  | "DEPLOY_INFO"
  | "SCHEDULE_QUERY"
  | "AGENT_QUERY"
  | "ATTENTION"
  | "UNKNOWN";

export type ProjectStatus = "online" | "degraded" | "offline" | "maintenance";
export type AgentStatus = "ready" | "busy" | "offline" | "needs_config";
export type ConnectionStatus = "not_configured" | "demo" | "connected" | "error";
export type ActivitySeverity = "info" | "success" | "warning" | "critical";

export interface Project {
  id: string;
  name: string;
  description: string;
  category: string;
  repository: string | null;
  deployment: string | null;
  database: string | null;
  status: ProjectStatus;
  tools: string[];
  permissions: PermissionLevel[];
  metadata: Record<string, string | number | boolean>;
  /** Demo metrics — clearly marked; not live production data */
  demoMetrics: {
    source: "DEMO_FIXTURE";
    health: number;
    openItems: number;
    lastDeploy: string;
    primaryMetricLabel: string;
    primaryMetricValue: string;
  };
}

export interface Agent {
  id: string;
  name: string;
  provider: string;
  role: string;
  status: AgentStatus;
  capabilities: string[];
  permissionLevel: PermissionLevel;
  lastActivity: string;
  recentTasks: string[];
}

export interface Tool {
  id: string;
  name: string;
  category: string;
  description: string;
  connectionStatus: ConnectionStatus;
}

export interface CommandIntent {
  type: IntentType;
  confidence: number;
  targetProjectId: string | null;
  targetAgentId: string | null;
  summary: string;
  rawInput: string;
}

export interface Action {
  id: string;
  label: string;
  description: string;
  effect: string;
  permissionLevel: PermissionLevel;
  reversible: boolean;
}

export interface JarvisCommand {
  id: string;
  input: string;
  createdAt: string;
  intent: CommandIntent | null;
  proposedAction: Action | null;
  routedAgentId: string | null;
  routedProjectId: string | null;
  permissionLevel: PermissionLevel | null;
  requiresApproval: boolean;
  status: CommandStatus;
  result: ExecutionResult | null;
  approvalId: string | null;
}

export interface Execution {
  id: string;
  commandId: string;
  startedAt: string;
  finishedAt: string | null;
  simulated: true;
  adapterId: string | null;
}

export interface ExecutionResult {
  executionId: string;
  success: boolean;
  message: string;
  /** Always true in V0 — no real external execution */
  simulated: true;
  details?: Record<string, string>;
  completedAt: string;
}

export interface ApprovalRequest {
  id: string;
  commandId: string;
  actionLabel: string;
  agentId: string | null;
  projectId: string | null;
  permissionLevel: PermissionLevel;
  description: string;
  effect: string;
  timestamp: string;
  status: "pending" | "approved" | "rejected";
  resolvedAt: string | null;
}

export interface ActivityEvent {
  id: string;
  timestamp: string;
  what: string;
  who: string;
  why: string;
  whatChanged: string;
  approved: boolean | null;
  severity: ActivitySeverity;
  projectId: string | null;
  source: "DEMO_FIXTURE" | "SIMULATED" | "SYSTEM";
}

export interface ScheduleItem {
  id: string;
  title: string;
  start: string;
  end: string;
  projectId: string | null;
  source: "DEMO_FIXTURE";
}

export interface AutomationDefinition {
  id: string;
  name: string;
  type: "scheduled" | "event" | "condition";
  description: string;
  trigger: string;
  action: string;
  enabled: boolean;
  exampleOnly: true;
  projectId: string | null;
}

export interface KnowledgeNode {
  id: string;
  title: string;
  kind: "note" | "doc" | "decision" | "runbook";
  summary: string;
  projectId: string | null;
  tags: string[];
  updatedAt: string;
  source: "DEMO_FIXTURE";
}

export interface AttentionItem {
  id: string;
  severity: "low" | "medium" | "high" | "critical";
  systemId: string;
  systemName: string;
  reason: string;
  recommendedAction: string;
  /** Whether Jarvis can handle via simulated/read path in V0 */
  jarvisCanHandle: boolean;
  handleNote: string;
  source: "DEMO_FIXTURE";
  timestamp: string;
}

export interface IntegrationAdapterMeta {
  id: string;
  name: string;
  capabilities: string[];
  connectionStatus: ConnectionStatus;
}

export type AdapterExecuteInput = {
  action: string;
  payload?: Record<string, unknown>;
};

export type AdapterExecuteOutput = {
  ok: boolean;
  simulated: true;
  message: string;
  data?: Record<string, unknown>;
};
