import type { PermissionLevel } from "@/types";

/**
 * Permission model:
 * L1 READ — may auto-execute later; V0 still logs
 * L2 REVERSIBLE — low-risk reversible actions
 * L3 IMPORTANT — explicit approval required
 * L4 SENSITIVE — always approval; V0 NEVER executes Level 4
 */

export const PERMISSION_LABELS: Record<PermissionLevel, string> = {
  L1_READ: "L1 READ",
  L2_REVERSIBLE: "L2 REVERSIBLE",
  L3_IMPORTANT: "L3 IMPORTANT",
  L4_SENSITIVE: "L4 SENSITIVE",
};

export function requiresApproval(level: PermissionLevel): boolean {
  return level === "L3_IMPORTANT" || level === "L4_SENSITIVE";
}

export function mayAutoExecute(level: PermissionLevel): boolean {
  // V0: only L1 may auto-complete as simulated read. L2 still goes through planned→running for clarity.
  return level === "L1_READ";
}

export function isLevel4Blocked(level: PermissionLevel): boolean {
  return level === "L4_SENSITIVE";
}

export function permissionForIntent(
  intentType: string,
  preferred?: PermissionLevel | null,
): PermissionLevel {
  if (preferred) return preferred;
  switch (intentType) {
    case "CODE_TASK":
      return "L3_IMPORTANT";
    case "STATUS_CHECK":
    case "SUMMARIZE":
    case "SCHEDULE_QUERY":
    case "AGENT_QUERY":
    case "ATTENTION":
    case "DEPLOY_INFO":
      return "L1_READ";
    default:
      return "L2_REVERSIBLE";
  }
}
