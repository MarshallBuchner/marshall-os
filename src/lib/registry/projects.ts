import { DEMO_AGENTS, DEMO_PROJECTS } from "@/lib/demo/fixtures";
import type { Agent, Project } from "@/types";

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

export const TOPOLOGY_NODES = [
  { id: "powr", label: "POWR", x: 18, y: 28 },
  { id: "quantlab", label: "QuantLab", x: 82, y: 22 },
  { id: "northstar", label: "Northstar", x: 15, y: 72 },
  { id: "build-lab", label: "Build Lab", x: 85, y: 70 },
  { id: "github", label: "GitHub", x: 50, y: 12 },
  { id: "personal", label: "Personal", x: 50, y: 88 },
] as const;

export const CORE_NODE = { id: "jarvis", label: "JARVIS", x: 50, y: 50 } as const;
