/**
 * Shared particle layouts for CORE ↔ HUMANOID morph.
 * Original abstract bust — computational reconstruction, not a likeness clone.
 */

export type PresenceQuality = "HIGH" | "MEDIUM" | "MOBILE";

/** Particle budgets by quality tier (before ≈ desktop 900 / mobile 220) */
export const PRESENCE_COUNTS: Record<PresenceQuality, number> = {
  HIGH: 5200,
  MEDIUM: 3000,
  MOBILE: 2000,
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

export type PresenceLayout = {
  count: number;
  core: Float32Array;
  humanoid: Float32Array;
  sizes: Float32Array;
  delays: Float32Array;
  regions: Uint8Array;
  eyeStart: number;
  eyeCount: number;
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

function write(
  buf: Float32Array,
  i: number,
  x: number,
  y: number,
  z: number,
) {
  const o = i * 3;
  buf[o] = finite(x);
  buf[o + 1] = finite(y);
  buf[o + 2] = finite(z);
}

function sizeFor(u: number, preferHighlight = false): SizeClass {
  // Target global mix ≈ 70% micro / 20% medium / 10% highlight
  if (preferHighlight) {
    if (u < 0.35) return 2;
    if (u < 0.7) return 1;
    return 0;
  }
  if (u < 0.78) return 0;
  if (u < 0.94) return 1;
  return 2;
}

/** Sample on ellipsoid surface (theta azimuth, phi polar from +Y) */
function sampleEllipsoid(
  rnd: () => number,
  cx: number,
  cy: number,
  cz: number,
  rx: number,
  ry: number,
  rz: number,
  surfaceBias = 0.92,
) {
  const theta = rnd() * Math.PI * 2;
  const phi = Math.acos(2 * rnd() - 1);
  const shell = surfaceBias + (1 - surfaceBias) * rnd();
  const sx = Math.sin(phi) * Math.cos(theta);
  const sy = Math.cos(phi);
  const sz = Math.sin(phi) * Math.sin(theta);
  return {
    x: cx + sx * rx * shell,
    y: cy + sy * ry * shell,
    z: cz + sz * rz * shell,
  };
}

/**
 * Build paired CORE / HUMANOID targets with shared particle ownership,
 * non-uniform anatomy density, size hierarchy, and staggered assembly delays.
 */
export function buildPresenceLayout(count: number): PresenceLayout {
  const n = Math.max(128, count | 0);
  const core = new Float32Array(n * 3);
  const humanoid = new Float32Array(n * 3);
  const sizes = new Float32Array(n);
  const delays = new Float32Array(n);
  const regions = new Uint8Array(n);
  const rnd = makeRnd(113);

  // Budget split — eyes last; denser face + volume-filled cranium/chest
  const eyeCount = Math.min(48, Math.max(20, Math.floor(n * 0.028)));
  const driftCount = Math.floor(n * 0.045);
  const energyCount = Math.floor(n * 0.035);
  const bodyCount = n - eyeCount - driftCount - energyCount;

  // Regional body weights (sum ≈ 1) — face landmarks denser than sparse scan
  const weights: { region: RegionId; w: number; delay0: number; delay1: number }[] = [
    { region: Region.TORSO, w: 0.15, delay0: 0.0, delay1: 0.14 },
    { region: Region.SHOULDER, w: 0.13, delay0: 0.04, delay1: 0.18 },
    { region: Region.NECK, w: 0.07, delay0: 0.12, delay1: 0.28 },
    { region: Region.CRANIUM, w: 0.24, delay0: 0.18, delay1: 0.42 },
    { region: Region.SILHOUETTE, w: 0.08, delay0: 0.22, delay1: 0.46 },
    { region: Region.BROW, w: 0.07, delay0: 0.4, delay1: 0.58 },
    { region: Region.ORBIT, w: 0.07, delay0: 0.44, delay1: 0.62 },
    { region: Region.CHEEK, w: 0.07, delay0: 0.42, delay1: 0.6 },
    { region: Region.JAW, w: 0.06, delay0: 0.46, delay1: 0.64 },
    { region: Region.NOSE, w: 0.04, delay0: 0.55, delay1: 0.72 },
    { region: Region.MOUTH, w: 0.02, delay0: 0.58, delay1: 0.74 },
  ];

  let cursor = 0;
  const assignBody = (region: RegionId, countR: number, d0: number, d1: number) => {
    for (let k = 0; k < countR && cursor < bodyCount; k++, cursor++) {
      const i = cursor;
      regions[i] = region;
      delays[i] = d0 + rnd() * (d1 - d0);
      const p = sampleHumanoidRegion(region, rnd);
      write(humanoid, i, p.x, p.y, p.z);
      sizes[i] = sizeFor(
        rnd(),
        region === Region.BROW ||
          region === Region.NOSE ||
          region === Region.JAW ||
          region === Region.ORBIT ||
          region === Region.SILHOUETTE,
      );
      const c = sampleCore(i, n, rnd);
      write(core, i, c.x, c.y, c.z);
    }
  };

  let allocated = 0;
  for (let wi = 0; wi < weights.length; wi++) {
    const spec = weights[wi];
    const isLast = wi === weights.length - 1;
    const countR = isLast
      ? bodyCount - allocated
      : Math.max(1, Math.floor(bodyCount * spec.w));
    allocated += countR;
    assignBody(spec.region, countR, spec.delay0, spec.delay1);
  }

  // Internal energy — sternum / neck column / cranial core (restrained)
  const energyStart = bodyCount;
  for (let k = 0; k < energyCount; k++) {
    const i = energyStart + k;
    regions[i] = Region.ENERGY;
    delays[i] = 0.48 + rnd() * 0.18;
    sizes[i] = sizeFor(rnd(), true);
    const u = rnd();
    let x = 0;
    let y = 0;
    let z = 0;
    if (u < 0.4) {
      // sternum ember
      x = (rnd() - 0.5) * 0.08;
      y = 0.08 + rnd() * 0.18;
      z = 0.06 + rnd() * 0.1;
    } else if (u < 0.7) {
      // neck filament
      x = (rnd() - 0.5) * 0.05;
      y = 0.35 + rnd() * 0.28;
      z = (rnd() - 0.5) * 0.06;
    } else {
      // cranial ember
      x = (rnd() - 0.5) * 0.1;
      y = 0.9 + rnd() * 0.2;
      z = (rnd() - 0.5) * 0.08;
    }
    write(humanoid, i, x, y, z);
    const c = sampleCore(i, n, rnd);
    write(core, i, c.x, c.y, c.z);
  }

  // Sparse ambient drift cloud around bust
  const driftStart = energyStart + energyCount;
  for (let k = 0; k < driftCount; k++) {
    const i = driftStart + k;
    regions[i] = Region.DRIFT;
    delays[i] = 0.28 + rnd() * 0.5;
    sizes[i] = 0;
    const a = rnd() * Math.PI * 2;
    const r = 0.55 + rnd() * 0.95;
    const y = -0.15 + rnd() * 1.55;
    write(humanoid, i, Math.cos(a) * r, y, Math.sin(a) * r * 0.55 - 0.05);
    const c = sampleCore(i, n, rnd);
    write(core, i, c.x * 1.15, c.y * 1.15, c.z);
  }

  // Eyes last — small precise dual clusters (pinpoint + tight iris, not blobs)
  const eyeStart = driftStart + driftCount;
  for (let e = 0; e < eyeCount; e++) {
    const i = eyeStart + e;
    regions[i] = Region.EYE;
    delays[i] = 0.86 + rnd() * 0.1;
    sizes[i] = e % 6 === 0 ? 2 : 1;
    const left = e < eyeCount / 2;
    const ex = left ? -0.125 : 0.125;
    const ey = 0.985;
    const ez = 0.32;
    const local = e % Math.max(1, Math.floor(eyeCount / 2));
    const ang = (local / Math.max(1, eyeCount / 2)) * Math.PI * 2;
    // Majority on tight ring; every 4th is core pinpoint
    const isCore = local % 4 === 0;
    const rad = isCore ? 0.002 : 0.016 + (local % 3) * 0.004;
    write(
      humanoid,
      i,
      ex + Math.cos(ang) * rad,
      ey + Math.sin(ang) * rad * 0.55,
      ez + (isCore ? 0.012 : 0),
    );
    const c = sampleCore(i, n, rnd);
    write(core, i, c.x * 0.3, c.y * 0.3, c.z);
  }

  return { count: n, core, humanoid, sizes, delays, regions, eyeStart, eyeCount };
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

function sampleHumanoidRegion(region: RegionId, rnd: () => number) {
  switch (region) {
    case Region.CRANIUM: {
      // Volume-filled vault (not hollow shell) + slight face-forward bias
      const p = sampleEllipsoid(rnd, 0, 0.95, 0.04, 0.35, 0.45, 0.32, 0.55);
      if (p.z < 0) p.z *= 0.7;
      else p.z += 0.02;
      return p;
    }
    case Region.BROW: {
      // Soft arched brow — avoid blocky rectangles
      const side = rnd() < 0.5 ? -1 : 1;
      const along = rnd();
      const x = side * (0.04 + along * 0.15);
      const arch = Math.sin(along * Math.PI) * 0.025;
      const y = 1.06 + arch + (rnd() - 0.5) * 0.02;
      const z = 0.25 + rnd() * 0.07 - along * 0.02;
      return { x, y, z };
    }
    case Region.ORBIT: {
      // Lid/socket rim — dense ring, not empty dark void
      const left = rnd() < 0.5;
      const ex = left ? -0.125 : 0.125;
      const a = rnd() * Math.PI * 2;
      const r = 0.045 + rnd() * 0.028;
      return {
        x: ex + Math.cos(a) * r,
        y: 0.985 + Math.sin(a) * r * 0.55,
        z: 0.28 + rnd() * 0.05,
      };
    }
    case Region.NOSE: {
      const t = rnd();
      return {
        x: (rnd() - 0.5) * 0.04,
        y: 0.88 + t * 0.12,
        z: 0.28 + t * 0.14,
      };
    }
    case Region.CHEEK: {
      const side = rnd() < 0.5 ? -1 : 1;
      return {
        x: side * (0.14 + rnd() * 0.14),
        y: 0.82 + rnd() * 0.16,
        z: 0.12 + rnd() * 0.14,
      };
    }
    case Region.JAW: {
      const a = -0.15 + rnd() * (Math.PI + 0.3);
      const r = 0.18 + rnd() * 0.12;
      return {
        x: Math.cos(a) * r,
        y: 0.62 + Math.sin(a) * 0.08 + rnd() * 0.06,
        z: 0.1 + rnd() * 0.12,
      };
    }
    case Region.MOUTH: {
      const x = (rnd() - 0.5) * 0.14;
      return {
        x,
        y: 0.72 + (rnd() - 0.5) * 0.03,
        z: 0.22 + rnd() * 0.06 - Math.abs(x) * 0.15,
      };
    }
    case Region.NECK: {
      const a = rnd() * Math.PI * 2;
      const r = 0.08 + rnd() * 0.07;
      return {
        x: Math.cos(a) * r,
        y: 0.38 + rnd() * 0.28,
        z: Math.sin(a) * r * 0.65,
      };
    }
    case Region.SHOULDER: {
      const a = rnd() * Math.PI * 2;
      const r = 0.35 + rnd() * 0.55;
      return {
        x: Math.cos(a) * r * 1.2,
        y: -0.02 + rnd() * 0.28,
        z: Math.sin(a) * r * 0.42 - 0.04,
      };
    }
    case Region.TORSO: {
      // Filled clavicle/chest volume
      const a = rnd() * Math.PI * 2;
      const r = 0.12 + rnd() * 0.4;
      const shell = 0.45 + rnd() * 0.55;
      return {
        x: Math.cos(a) * r * 0.95 * shell,
        y: -0.1 + rnd() * 0.34,
        z: (Math.sin(a) * r * 0.42 - 0.02) * shell,
      };
    }
    case Region.SILHOUETTE: {
      // Contour samples — head oval + shoulder line
      const u = rnd();
      if (u < 0.62) {
        const a = rnd() * Math.PI * 2;
        return {
          x: Math.cos(a) * 0.36,
          y: 0.95 + Math.sin(a) * 0.46,
          z: Math.cos(a + 1.2) * 0.28,
        };
      }
      const side = rnd() < 0.5 ? -1 : 1;
      return {
        x: side * (0.45 + rnd() * 0.4),
        y: 0.02 + rnd() * 0.22,
        z: (rnd() - 0.5) * 0.2,
      };
    }
    default: {
      return sampleEllipsoid(rnd, 0, 0.9, 0, 0.34, 0.42, 0.3);
    }
  }
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
 * Staggered CORE↔HUMANOID interpolation. Preserves continuous ownership.
 * When globalT decreases, high-delay particles (eyes) collapse first — deliberate reverse.
 */
export function morphPresence(
  from: Float32Array,
  to: Float32Array,
  globalT: number,
  delays: Float32Array,
  out: Float32Array,
) {
  const n = Math.min(from.length, to.length, out.length) / 3;
  const g = Math.max(0, Math.min(1, Number.isFinite(globalT) ? globalT : 0));
  for (let i = 0; i < n; i++) {
    const e = particleMorphT(g, delays[i] ?? 0);
    const o = i * 3;
    out[o] = from[o] + (to[o] - from[o]) * e;
    out[o + 1] = from[o + 1] + (to[o + 1] - from[o + 1]) * e;
    out[o + 2] = from[o + 2] + (to[o + 2] - from[o + 2]) * e;
  }
}

/** Compatibility helpers — paired from one layout so ownership stays coherent */
export function buildCoreTargets(count: number): Float32Array {
  return buildPresenceLayout(count).core;
}

export function buildHumanoidTargets(count: number): Float32Array {
  // Same seed/layout path as buildCoreTargets for matching indices when called with same count
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
