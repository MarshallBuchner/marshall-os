/**
 * Shared particle layouts for CORE ↔ HUMANOID morph (V2).
 * Samples an invisible neutral anatomical scaffold — computational reconstruction,
 * not a likeness clone. Populations: A surface / B internal / C atmospheric.
 */

import {
  isFaceLandmark,
  isSilhouetteHeavy,
  makeScaffoldRnd,
  sampleScaffoldAtmosphere,
  sampleScaffoldInternal,
  sampleScaffoldSurface,
  scaffoldRegionToPresence,
  type ScaffoldRegion,
} from "@/lib/jarvis/anatomyScaffold";

export type PresenceQuality = "HIGH" | "MEDIUM" | "MOBILE";

/** Particle budgets — Reznikov-class density; mobile protects face + iOS budget */
export const PRESENCE_COUNTS: Record<PresenceQuality, number> = {
  HIGH: 90000,
  MEDIUM: 42000,
  MOBILE: 14000,
};

export const Region = {
  TORSO: 0,
  SHOULDER: 1,
  NECK: 2,
  CRANIUM: 3,
  BROW: 4,
  ORBIT: 5,
  NOSE: 6,
  CHEEK: 7,
  JAW: 8,
  MOUTH: 9,
  ENERGY: 10,
  SILHOUETTE: 11,
  DRIFT: 12,
  EYE: 13,
} as const;

export type RegionId = (typeof Region)[keyof typeof Region];

/** Size class: 0 micro (~70%), 1 medium (~20%), 2 highlight (~10%) */
export type SizeClass = 0 | 1 | 2;

/** Population: 0 = A surface, 1 = B internal, 2 = C atmospheric */
export type Population = 0 | 1 | 2;

export type PresenceLayout = {
  count: number;
  core: Float32Array;
  humanoid: Float32Array;
  /** Mid-control points for curved force-field morph (xyz per particle) */
  curve: Float32Array;
  sizes: Float32Array;
  delays: Float32Array;
  regions: Uint8Array;
  populations: Uint8Array;
  /** Streamline flow angle (radians) — vertical wireframe aesthetic */
  flow: Float32Array;
  /** Streamline stretch 0–1 (higher = longer thin streaks) */
  stretch: Float32Array;
  eyeStart: number;
  eyeCount: number;
  /** Indices for face warm-core energy (SPEAKING) */
  faceEnergyStart: number;
  faceEnergyCount: number;
  /** Indices for throat cyan hotspot */
  throatStart: number;
  throatCount: number;
};

function makeRnd(seed0: number) {
  let s = seed0;
  return () => {
    s = (s * 48271) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function finite(v: number) {
  return Number.isFinite(v) ? v : 0;
}

function smooth01(t: number) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

function write(buf: Float32Array, i: number, x: number, y: number, z: number) {
  const o = i * 3;
  buf[o] = finite(x);
  buf[o + 1] = finite(y);
  buf[o + 2] = finite(z);
}

function sizeFor(u: number, preferHighlight = false): SizeClass {
  if (preferHighlight) {
    if (u < 0.32) return 2;
    if (u < 0.68) return 1;
    return 0;
  }
  // Bias toward micro grain for denser luminous mass
  if (u < 0.84) return 0;
  if (u < 0.96) return 1;
  return 2;
}

/** Assembly delay by scaffold region — chest/shoulders → neck → skull → face → eyes */
function delayForScaffold(region: ScaffoldRegion, rnd: () => number): number {
  switch (region) {
    case "chest":
      return 0.0 + rnd() * 0.1;
    case "clavicle":
      return 0.04 + rnd() * 0.1;
    case "shoulder":
      return 0.06 + rnd() * 0.12;
    case "neck":
      return 0.14 + rnd() * 0.12;
    case "skull":
      return 0.22 + rnd() * 0.16;
    case "ear":
      return 0.28 + rnd() * 0.14;
    case "cheek":
      return 0.4 + rnd() * 0.14;
    case "brow":
      return 0.44 + rnd() * 0.12;
    case "orbit":
    case "lid":
      return 0.48 + rnd() * 0.12;
    case "jaw":
      return 0.5 + rnd() * 0.12;
    case "nose":
      return 0.56 + rnd() * 0.12;
    case "lips":
      return 0.6 + rnd() * 0.12;
    default:
      return 0.25 + rnd() * 0.3;
  }
}

function curveControl(
  cx: number,
  cy: number,
  cz: number,
  hx: number,
  hy: number,
  hz: number,
  rnd: () => number,
  region: RegionId,
) {
  // Midpoint + outward swirl (force-field arc) — stronger for torso release
  const mx = (cx + hx) * 0.5;
  const my = (cy + hy) * 0.5;
  const mz = (cz + hz) * 0.5;
  const dx = hx - cx;
  const dy = hy - cy;
  const dz = hz - cz;
  // Perpendicular swirl in XY
  const swirl = 0.35 + rnd() * 0.55;
  const px = -dy * swirl * (0.4 + rnd());
  const py = dx * swirl * (0.25 + rnd() * 0.4);
  const lift =
    region === Region.TORSO || region === Region.SHOULDER
      ? 0.35 + rnd() * 0.45
      : region === Region.NECK
        ? 0.2 + rnd() * 0.25
        : 0.08 + rnd() * 0.2;
  const outward = 0.15 + rnd() * 0.35;
  return {
    x: mx + px + (hx !== 0 ? Math.sign(hx) : rnd() - 0.5) * outward * 0.3,
    y: my + py + lift,
    z: mz + dz * 0.15 + (rnd() - 0.5) * 0.25,
  };
}

/**
 * Build paired CORE / HUMANOID targets with scaffold sampling,
 * A/B/C populations, size hierarchy, staggered delays, curved morph controls.
 */
export function buildPresenceLayout(count: number): PresenceLayout {
  const n = Math.max(128, count | 0);
  const core = new Float32Array(n * 3);
  const humanoid = new Float32Array(n * 3);
  const curve = new Float32Array(n * 3);
  const sizes = new Float32Array(n);
  const delays = new Float32Array(n);
  const regions = new Uint8Array(n);
  const populations = new Uint8Array(n);
  const flow = new Float32Array(n);
  const stretch = new Float32Array(n);
  const rnd = makeRnd(113);
  const srnd = makeScaffoldRnd(211);

  // Eyes last; face/throat energy reserved; A/B/C over remaining body
  const eyeCount = Math.min(96, Math.max(28, Math.floor(n * 0.012)));
  const faceEnergyCount = Math.min(220, Math.max(48, Math.floor(n * 0.022)));
  const throatCount = Math.min(72, Math.max(20, Math.floor(n * 0.009)));
  const filamentCount = Math.floor(n * 0.016);
  const reserved = eyeCount + faceEnergyCount + throatCount + filamentCount;
  const bodyCount = n - reserved;

  // A surface dense mass, B internal fill, C thinner atmosphere (less wispy)
  const countA = Math.floor(bodyCount * 0.74);
  const countB = Math.floor(bodyCount * 0.2);
  const countC = bodyCount - countA - countB;

  const landmarkChance = n <= PRESENCE_COUNTS.MOBILE ? 0.82 : 0.62;

  const assignScaffold = (
    i: number,
    pop: Population,
    sample: ReturnType<typeof sampleScaffoldSurface>,
    opts?: { stream?: boolean; delayBias?: number },
  ) => {
    populations[i] = pop;
    const regionId = scaffoldRegionToPresence(sample.region);
    regions[i] =
      pop === 2
        ? Region.DRIFT
        : isSilhouetteHeavy(sample.region) && pop === 0 && rnd() < 0.18
          ? Region.SILHOUETTE
          : regionId;
    let d =
      pop === 2
        ? 0.2 + rnd() * 0.45
        : delayForScaffold(sample.region, rnd);
    // Shoulder streams assemble later / dissolve first — “ASSEMBLING” feel
    if (sample.region === "shoulder" || opts?.stream) {
      d = Math.min(0.72, d + 0.08 + rnd() * 0.12);
    }
    delays[i] = d + (opts?.delayBias ?? 0);
    write(humanoid, i, sample.x, sample.y, sample.z);
    sizes[i] = sizeFor(
      rnd(),
      isFaceLandmark(sample.region) || sample.region === "skull",
    );
    // Vertical streamline bias (wireframe flow), stronger on silhouette/shoulders
    const vertical = Math.PI * 0.5 + (rnd() - 0.5) * 0.35;
    flow[i] = opts?.stream ? vertical + (rnd() - 0.5) * 0.15 : vertical + (rnd() - 0.5) * 0.55;
    stretch[i] =
      pop === 2
        ? 0.15 + rnd() * 0.25
        : opts?.stream || sample.region === "shoulder" || sample.region === "neck"
          ? 0.55 + rnd() * 0.4
          : 0.25 + rnd() * 0.45;
    const c = sampleCore(i, n, rnd);
    write(core, i, c.x, c.y, c.z);
    const ctrl = curveControl(c.x, c.y, c.z, sample.x, sample.y, sample.z, rnd, regions[i] as RegionId);
    write(curve, i, ctrl.x, ctrl.y, ctrl.z);
  };

  let cursor = 0;

  // Population A — dense surface + meridian streamlines
  const streamShare = Math.floor(countA * 0.28);
  for (let k = 0; k < streamShare && cursor < bodyCount; k++, cursor++) {
    // Prefer shoulders/neck/skull silhouette for flowing vertical streaks
    const sample = sampleScaffoldSurface(srnd, (r) =>
      r === "shoulder" || r === "neck" || r === "skull" || r === "chest" || r === "clavicle",
    );
    // Jitter along vertical to elongate perceived stream
    sample.y += (rnd() - 0.5) * 0.03;
    assignScaffold(cursor, 0, sample, { stream: true });
  }
  for (let k = streamShare; k < countA && cursor < bodyCount; k++, cursor++) {
    const wantFace = rnd() < landmarkChance;
    const sample = sampleScaffoldSurface(
      srnd,
      wantFace ? (r) => isFaceLandmark(r) || r === "skull" : undefined,
    );
    assignScaffold(cursor, 0, sample);
  }

  // Population B — internal depth
  for (let k = 0; k < countB && cursor < bodyCount; k++, cursor++) {
    const sample = sampleScaffoldInternal(srnd);
    assignScaffold(cursor, 1, sample);
  }

  // Population C — topographic atmosphere behind figure
  for (let k = 0; k < countC && cursor < bodyCount; k++, cursor++) {
    const sample = sampleScaffoldAtmosphere(srnd);
    // Push atmosphere slightly back for depth layers
    sample.z -= 0.15 + rnd() * 0.35;
    assignScaffold(cursor, 2, sample);
  }

  // Face warm-core energy (idle faint; SPEAKING drives orange overlay in renderer)
  const faceEnergyStart = bodyCount;
  for (let k = 0; k < faceEnergyCount; k++) {
    const i = faceEnergyStart + k;
    regions[i] = Region.ENERGY;
    populations[i] = 1;
    delays[i] = 0.55 + rnd() * 0.2;
    sizes[i] = sizeFor(rnd(), true);
    flow[i] = (rnd() - 0.5) * Math.PI;
    stretch[i] = 0.1 + rnd() * 0.2;
    const ang = rnd() * Math.PI * 2;
    const rad = rnd() * 0.09;
    const x = Math.cos(ang) * rad * 0.55;
    const y = 0.88 + Math.sin(ang) * rad * 0.45 + (rnd() - 0.5) * 0.04;
    const z = 0.28 + rnd() * 0.06;
    write(humanoid, i, x, y, z);
    const c = sampleCore(i, n, rnd);
    write(core, i, c.x * 0.4, c.y * 0.4, c.z);
    const ctrl = curveControl(c.x * 0.4, c.y * 0.4, c.z, x, y, z, rnd, Region.ENERGY);
    write(curve, i, ctrl.x, ctrl.y, ctrl.z);
  }

  // Throat cyan hotspot (base of neck)
  const throatStart = faceEnergyStart + faceEnergyCount;
  for (let k = 0; k < throatCount; k++) {
    const i = throatStart + k;
    regions[i] = Region.ENERGY;
    populations[i] = 1;
    delays[i] = 0.35 + rnd() * 0.15;
    sizes[i] = k % 4 === 0 ? 2 : 1;
    flow[i] = Math.PI * 0.5;
    stretch[i] = 0.08 + rnd() * 0.12;
    const ang = rnd() * Math.PI * 2;
    const rad = rnd() * 0.035;
    write(
      humanoid,
      i,
      Math.cos(ang) * rad,
      0.4 + (rnd() - 0.5) * 0.04,
      0.1 + Math.sin(ang) * rad * 0.6,
    );
    const c = sampleCore(i, n, rnd);
    write(core, i, c.x * 0.35, c.y * 0.35, c.z);
    const hx = humanoid[i * 3];
    const hy = humanoid[i * 3 + 1];
    const hz = humanoid[i * 3 + 2];
    const ctrl = curveControl(c.x * 0.35, c.y * 0.35, c.z, hx, hy, hz, rnd, Region.ENERGY);
    write(curve, i, ctrl.x, ctrl.y, ctrl.z);
  }

  // Sparse sternum/neck filaments
  const filamentStart = throatStart + throatCount;
  for (let k = 0; k < filamentCount; k++) {
    const i = filamentStart + k;
    regions[i] = Region.ENERGY;
    populations[i] = 1;
    delays[i] = 0.4 + rnd() * 0.2;
    sizes[i] = sizeFor(rnd(), true);
    flow[i] = Math.PI * 0.5 + (rnd() - 0.5) * 0.2;
    stretch[i] = 0.5 + rnd() * 0.35;
    const x = (rnd() - 0.5) * 0.06;
    const y = 0.15 + rnd() * 0.35;
    const z = 0.04 + rnd() * 0.08;
    write(humanoid, i, x, y, z);
    const c = sampleCore(i, n, rnd);
    write(core, i, c.x, c.y, c.z);
    const ctrl = curveControl(c.x, c.y, c.z, x, y, z, rnd, Region.ENERGY);
    write(curve, i, ctrl.x, ctrl.y, ctrl.z);
  }

  // Eyes last — restrained cyan-white dual cores (not giant discs)
  const eyeStart = filamentStart + filamentCount;
  for (let e = 0; e < eyeCount; e++) {
    const i = eyeStart + e;
    regions[i] = Region.EYE;
    populations[i] = 0;
    delays[i] = 0.86 + rnd() * 0.1;
    sizes[i] = e % 8 === 0 ? 2 : 1;
    flow[i] = 0;
    stretch[i] = 0.05;
    const left = e < eyeCount / 2;
    const ex = left ? -0.125 : 0.125;
    const ey = 0.985;
    const ez = 0.32;
    const local = e % Math.max(1, Math.floor(eyeCount / 2));
    const ang = (local / Math.max(1, eyeCount / 2)) * Math.PI * 2;
    const isCore = local % 5 === 0;
    const rad = isCore ? 0.003 : 0.014 + (local % 3) * 0.0035;
    const hx = ex + Math.cos(ang) * rad;
    const hy = ey + Math.sin(ang) * rad * 0.5;
    const hz = ez + 0.04 + (isCore ? 0.02 : 0.008);
    write(humanoid, i, hx, hy, hz);
    const c = sampleCore(i, n, rnd);
    write(core, i, c.x * 0.25, c.y * 0.25, c.z);
    const ctrl = curveControl(c.x * 0.25, c.y * 0.25, c.z, hx, hy, hz, rnd, Region.EYE);
    write(curve, i, ctrl.x, ctrl.y, ctrl.z);
  }

  return {
    count: n,
    core,
    humanoid,
    curve,
    sizes,
    delays,
    regions,
    populations,
    flow,
    stretch,
    eyeStart,
    eyeCount,
    faceEnergyStart,
    faceEnergyCount,
    throatStart,
    throatCount,
  };
}

function sampleCore(i: number, n: number, rnd: () => number) {
  const rings = [0.32, 0.48, 0.62, 0.78, 0.94, 1.1, 1.26, 1.4];
  const ring = rings[i % rings.length];
  const a = (i / n) * Math.PI * 2 + rnd() * 0.18;
  const jitter = (rnd() - 0.5) * 0.05;
  const r = ring + jitter;
  return {
    x: Math.cos(a) * r,
    y: Math.sin(a) * r,
    z: (rnd() - 0.5) * 0.14,
  };
}

/** Per-particle morph factor with staggered regional assembly / reverse dissolve */
export function particleMorphT(
  globalT: number,
  delay: number,
  span = 0.22,
): number {
  return smooth01((globalT - delay) / span);
}

/**
 * Curved force-field CORE↔HUMANOID interpolation (quadratic Bezier via `curve`).
 * Preserves continuous ownership. High-delay particles collapse first on reverse.
 */
export function morphPresence(
  from: Float32Array,
  to: Float32Array,
  globalT: number,
  delays: Float32Array,
  out: Float32Array,
  curve?: Float32Array,
) {
  const n = Math.min(from.length, to.length, out.length) / 3;
  const g = Math.max(0, Math.min(1, Number.isFinite(globalT) ? globalT : 0));
  const hasCurve = curve && curve.length >= n * 3;
  for (let i = 0; i < n; i++) {
    const e = particleMorphT(g, delays[i] ?? 0);
    const o = i * 3;
    if (hasCurve) {
      const inv = 1 - e;
      // Quadratic Bezier: (1-t)²P0 + 2(1-t)t P1 + t² P2
      out[o] =
        inv * inv * from[o] + 2 * inv * e * curve![o] + e * e * to[o];
      out[o + 1] =
        inv * inv * from[o + 1] + 2 * inv * e * curve![o + 1] + e * e * to[o + 1];
      out[o + 2] =
        inv * inv * from[o + 2] + 2 * inv * e * curve![o + 2] + e * e * to[o + 2];
    } else {
      out[o] = from[o] + (to[o] - from[o]) * e;
      out[o + 1] = from[o + 1] + (to[o + 1] - from[o + 1]) * e;
      out[o + 2] = from[o + 2] + (to[o + 2] - from[o + 2]) * e;
    }
  }
}

/** Compatibility helpers — paired from one layout so ownership stays coherent */
export function buildCoreTargets(count: number): Float32Array {
  return buildPresenceLayout(count).core;
}

export function buildHumanoidTargets(count: number): Float32Array {
  return buildPresenceLayout(count).humanoid;
}

export function lerpArrays(
  from: Float32Array,
  to: Float32Array,
  t: number,
  out: Float32Array,
) {
  const n = Math.min(from.length, to.length, out.length);
  const e = smooth01(t);
  for (let i = 0; i < n; i++) {
    out[i] = from[i] + (to[i] - from[i]) * e;
  }
}

export function resolvePresenceQuality(
  prefer: PresenceQuality | "auto" = "auto",
): PresenceQuality {
  if (prefer !== "auto") return prefer;
  if (typeof window === "undefined") return "HIGH";
  const ua = navigator.userAgent || "";
  const mobile = /iPhone|iPad|iPod|Android/i.test(ua) || window.innerWidth < 900;
  if (mobile) return "MOBILE";
  const cores = navigator.hardwareConcurrency || 4;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory || 4;
  if (cores <= 4 || mem <= 4) return "MEDIUM";
  return "HIGH";
}
