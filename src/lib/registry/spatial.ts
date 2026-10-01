/**
 * Spatial layout — cinematic room placements (not orbital).
 * Registry-driven systems/agents only.
 *
 * Composition: shallow theatrical arc with FG / MG / BG depth.
 * Modules rest distant & subdued; focus brings one to FOCUS_SLOT.
 */

import {
  AGENT_ORBIT,
  SYSTEM_ORBIT,
  type AgentOrbitNode,
  type OrbitSystemNode,
} from "@/lib/registry/projects";

export type Vec3 = [number, number, number];

/** Primary reading slot — approached module settles here */
export const FOCUS_SLOT: Vec3 = [-0.2, 0.15, 1.35];

/** Jarvis volumetric presence — mid-depth, slightly elevated, not a centered logo */
export const JARVIS_PRESENCE: Vec3 = [0.15, 0.85, -2.4];

export type SpatialSystemNode = OrbitSystemNode & {
  restPosition: Vec3;
  restScale: number;
  dormancy: number;
};

export type SpatialAgentNode = AgentOrbitNode & {
  restPosition: Vec3;
};

/**
 * Theatrical placements — approachable glass surfaces, not orbit nodes.
 * Depth bands: FG (~z 0.4), MG (~z -0.8), BG (~z -2.2)
 */
const SYSTEM_REST: Record<string, { pos: Vec3; scale: number }> = {
  // Mid-left / mid-right — primary systems (more approachable)
  powr: { pos: [-1.85, 0.2, -0.55], scale: 0.92 },
  quantlab: { pos: [1.75, 0.25, -0.45], scale: 0.95 },
  // Lower FG accents
  northstar: { pos: [-1.05, -0.35, 0.25], scale: 0.88 },
  // Back / sides — quieter
  "build-lab": { pos: [2.45, 0.05, -1.55], scale: 0.82 },
  personal: { pos: [0.55, -0.4, -1.85], scale: 0.8 },
  github: { pos: [-0.35, 0.1, -2.75], scale: 0.75 },
};

/** Agents inhabit upper air — secondary chips, not beads on a ring */
const AGENT_REST: Record<string, Vec3> = {
  openai: [-2.15, 1.35, -2.05],
  cursor: [1.55, 1.25, -1.75],
  claude: [-0.65, 1.55, -2.55],
  grok: [2.35, 1.15, -2.35],
};

export function getSpatialSystems(): SpatialSystemNode[] {
  return SYSTEM_ORBIT.map((node) => {
    const rest = SYSTEM_REST[node.id] ?? { pos: [0, 0, -1.5] as Vec3, scale: 0.85 };
    const dormancy =
      node.status === "not_configured" || node.status === "offline" ? 0.22 : 0.55;
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
