import { DEMO_AGENTS, DEMO_PROJECTS } from "@/lib/demo/fixtures";
import type { Agent, Project, ProjectStatus } from "@/types";

/** Project registry — source of truth. Components should read via these helpers. */
export function listProjects(): Project[] {
  return DEMO_PROJECTS;
}

export function getProject(id: string): Project | undefined {
  return DEMO_PROJECTS.find((p) => p.id === id);
}

export function listAgents(): Agent[] {
  return DEMO_AGENTS;
}

export function getAgent(id: string): Agent | undefined {
  return DEMO_AGENTS.find((a) => a.id === id);
}

export type OrbitSystemNode = {
  id: string;
  label: string;
  category: string;
  kind: "project" | "tool";
  /** polar placement degrees (0 = top) */
  angle: number;
  radius: number;
  status: ProjectStatus | "not_configured";
  projectId: string | null;
};

const SYSTEM_ORBIT_SEED: OrbitSystemNode[] = [
  {
    id: "powr",
    label: "POWR",
    category: "Sports Tech",
    kind: "project",
    angle: -40,
    radius: 38,
    status: "online",
    projectId: "powr",
  },
  {
    id: "quantlab",
    label: "QuantLab",
    category: "AI Trading Research",
    kind: "project",
    angle: 40,
    radius: 38,
    status: "online",
    projectId: "quantlab",
  },
  {
    id: "github",
    label: "GitHub",
    category: "Source Control",
    kind: "tool",
    angle: 0,
    radius: 36,
    status: "not_configured",
    projectId: null,
  },
  {
    id: "northstar",
    label: "Northstar",
    category: "Machine Shop OS",
    kind: "project",
    angle: -140,
    radius: 38,
    status: "degraded",
    projectId: "northstar",
  },
  {
    id: "build-lab",
    label: "Build Lab",
    category: "Experiments",
    kind: "project",
    angle: 140,
    radius: 38,
    status: "online",
    projectId: "build-lab",
  },
  {
    id: "personal",
    label: "Personal",
    category: "Life & Planning",
    kind: "project",
    angle: 180,
    radius: 36,
    status: "online",
    projectId: "personal",
  },
];

/** Outer system orbit — registry-driven where possible */
export const SYSTEM_ORBIT: OrbitSystemNode[] = SYSTEM_ORBIT_SEED.map((node) => {
  if (!node.projectId) return node;
  const p = getProject(node.projectId);
  return p
    ? { ...node, status: p.status, category: p.category, label: p.name }
    : node;
});

export type AgentOrbitNode = {
  id: string;
  label: string;
  role: string;
  angle: number;
  radius: number;
};

/** Inner agent ring around Jarvis */
export const AGENT_ORBIT: AgentOrbitNode[] = [
  { id: "openai", label: "OpenAI", role: "Reasoning", angle: -50, radius: 20 },
  { id: "cursor", label: "Cursor", role: "Code", angle: 40, radius: 20 },
  { id: "claude", label: "Claude", role: "Analysis", angle: 130, radius: 20 },
  { id: "grok", label: "Grok", role: "Research", angle: -130, radius: 20 },
].map((n) => {
  const a = getAgent(n.id);
  return a ? { ...n, label: a.name.split(" ")[0] ?? n.label, role: a.role.split("&")[0]?.trim() ?? n.role } : n;
});

export const CORE_NODE = { id: "jarvis", label: "JARVIS", x: 50, y: 50 } as const;

export function polarToXY(angleDeg: number, radius: number, cx = 50, cy = 50) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
}

/** Honest agent connection label — never ONLINE/CONNECTED without a real link */
export function agentConnectionLabel(agent: Agent): string {
  if (agent.status === "needs_config" || agent.status === "offline") {
    return "NOT CONFIGURED";
  }
  // Registry entry exists but adapters are placeholders in V0/V0.2
  return "NOT CONFIGURED";
}

export function systemStatusLabel(status: ProjectStatus | "not_configured"): string {
  switch (status) {
    case "online":
      return "NOMINAL";
    case "degraded":
      return "ATTENTION";
    case "offline":
      return "OFFLINE";
    case "maintenance":
      return "MAINTENANCE";
    case "not_configured":
      return "NOT CONFIGURED";
    default:
      return status;
  }
}
