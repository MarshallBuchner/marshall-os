/**
 * Shared particle target layouts for CORE ↔ HUMANOID morph.
 * Original abstract bust — no facial likeness / no Marvel clone.
 */

function makeRnd(seed0: number) {
  let s = seed0;
  return () => {
    s = (s * 48271) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Sample points on concentric core rings (engineered density) */
export function buildCoreTargets(count: number): Float32Array {
  const out = new Float32Array(count * 3);
  const rnd = makeRnd(91);
  const rings = [0.35, 0.55, 0.72, 0.9, 1.08, 1.25, 1.42];
  for (let i = 0; i < count; i++) {
    const ring = rings[i % rings.length];
    const a = (i / count) * Math.PI * 2 + rnd() * 0.2;
    const jitter = (rnd() - 0.5) * 0.06;
    const r = ring + jitter;
    out[i * 3] = Math.cos(a) * r;
    out[i * 3 + 1] = Math.sin(a) * r;
    out[i * 3 + 2] = (rnd() - 0.5) * 0.12;
  }
  return out;
}

/**
 * Abstract humanoid bust targets: head ellipsoid + neck + shoulders/chest.
 * Featureless — eyes reserved as last indices.
 */
export function buildHumanoidTargets(count: number): Float32Array {
  const out = new Float32Array(count * 3);
  const rnd = makeRnd(113);
  const eyeCount = 24;
  const bodyCount = count - eyeCount;

  for (let i = 0; i < bodyCount; i++) {
    const u = rnd();
    let x = 0;
    let y = 0;
    let z = 0;
    if (u < 0.55) {
      const theta = rnd() * Math.PI * 2;
      const phi = Math.acos(2 * rnd() - 1);
      x = 0.38 * Math.sin(phi) * Math.cos(theta);
      y = 0.85 + 0.48 * Math.cos(phi);
      z = 0.34 * Math.sin(phi) * Math.sin(theta);
    } else if (u < 0.68) {
      const a = rnd() * Math.PI * 2;
      const r = 0.12 + rnd() * 0.06;
      x = Math.cos(a) * r;
      y = 0.35 + rnd() * 0.25;
      z = Math.sin(a) * r * 0.7;
    } else {
      const a = rnd() * Math.PI * 2;
      const r = 0.35 + rnd() * 0.55;
      x = Math.cos(a) * r * 1.15;
      y = -0.05 + rnd() * 0.35;
      z = Math.sin(a) * r * 0.45 - 0.05;
    }
    out[i * 3] = x;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = z;
  }

  for (let e = 0; e < eyeCount; e++) {
    const i = bodyCount + e;
    const left = e < eyeCount / 2;
    out[i * 3] = (left ? -0.12 : 0.12) + (rnd() - 0.5) * 0.03;
    out[i * 3 + 1] = 0.95 + (rnd() - 0.5) * 0.04;
    out[i * 3 + 2] = 0.28 + (rnd() - 0.5) * 0.02;
  }

  return out;
}

export function lerpArrays(
  from: Float32Array,
  to: Float32Array,
  t: number,
  out: Float32Array,
) {
  const n = Math.min(from.length, to.length, out.length);
  const e = t * t * (3 - 2 * t);
  for (let i = 0; i < n; i++) {
    out[i] = from[i] + (to[i] - from[i]) * e;
  }
}
