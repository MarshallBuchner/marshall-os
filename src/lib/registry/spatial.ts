/**
 * Contextual spatial placements — modules appear when focused/routed.
 * Not permanent orbits around Jarvis.
 */

import {
  AGENT_ORBIT,
  SYSTEM_ORBIT,
  type AgentOrbitNode,
  type OrbitSystemNode,
} from "@/lib/registry/projects";

export type Vec3 = [number, number, number];

/** Reading slot — approached module settles here (right of core) */
export const FOCUS_SLOT: Vec3 = [1.55, 0.2, 1.1];

/** Jarvis circular core sits at scene origin (slightly forward) */
export const JARVIS_CORE: Vec3 = [0, 0.1, 0.2];

export type SpatialSystemNode = OrbitSystemNode & {
  restPosition: Vec3;
  restScale: number;
  dormancy: number;
};

export type SpatialAgentNode = AgentOrbitNode & {
  restPosition: Vec3;
};

/** Resting hold positions — off to the sides/back when contextual */
const SYSTEM_REST: Record<string, { pos: Vec3; scale: number }> = {
  powr: { pos: [-2.4, 0.35, -1.2], scale: 0.72 },
  quantlab: { pos: [2.35, 0.3, -1.0], scale: 0.75 },
  northstar: { pos: [-1.9, -0.2, -1.6], scale: 0.7 },
  "build-lab": { pos: [2.6, -0.15, -1.8], scale: 0.68 },
  personal: { pos: [1.4, -0.45, -2.1], scale: 0.65 },
  github: { pos: [-0.9, 0.4, -2.4], scale: 0.62 },
};

const AGENT_REST: Record<string, Vec3> = {
  openai: [-2.0, 1.3, -1.8],
  cursor: [2.0, 1.2, -1.5],
  claude: [-1.2, 1.45, -2.2],
  grok: [1.6, 1.1, -2.0],
};

export function getSpatialSystems(): SpatialSystemNode[] {
  return SYSTEM_ORBIT.map((node) => {
    const rest = SYSTEM_REST[node.id] ?? { pos: [0, 0, -2] as Vec3, scale: 0.7 };
    const dormancy =
      node.status === "not_configured" || node.status === "offline" ? 0.2 : 0.5;
    return {
      ...node,
      restPosition: rest.pos,
      restScale: rest.scale,
      dormancy,
    };
  });
}

export function getSpatialAgents(): SpatialAgentNode[] {
  return AGENT_ORBIT.map((node) => ({
    ...node,
    restPosition: AGENT_REST[node.id] ?? [0, 1.2, -2],
  }));
}

export function statusAccent(status: OrbitSystemNode["status"]): string {
  switch (status) {
    case "degraded":
      return "#fbbf24";
    case "not_configured":
    case "offline":
      return "#475569";
    case "maintenance":
      return "#7dd3fc";
    case "online":
    default:
      return "#7dd3fc";
  }
}
