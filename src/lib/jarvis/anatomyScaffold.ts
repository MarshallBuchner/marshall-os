/**
 * Original neutral humanoid scaffold — head / neck / upper torso.
 * Invisible particle-emission geometry only (never rendered as skin).
 * No celebrity or fictional likeness — generic adult proportions.
 *
 * Design: continuous bust volume (face plate + cranial vault + thick neck +
 * connected shoulder girdle) rather than disconnected ellipsoid blobs.
 */

export type ScaffoldRegion =
  | "skull"
  | "brow"
  | "orbit"
  | "lid"
  | "nose"
  | "cheek"
  | "lips"
  | "jaw"
  | "ear"
  | "neck"
  | "clavicle"
  | "shoulder"
  | "chest";

export type ScaffoldSample = {
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
  region: ScaffoldRegion;
};

type Tri = {
  ax: number;
  ay: number;
  az: number;
  bx: number;
  by: number;
  bz: number;
  cx: number;
  cy: number;
  cz: number;
  region: ScaffoldRegion;
  area: number;
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

function triArea(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  cx: number,
  cy: number,
  cz: number,
) {
  const abx = bx - ax;
  const aby = by - ay;
  const abz = bz - az;
  const acx = cx - ax;
  const acy = cy - ay;
  const acz = cz - az;
  const nx = aby * acz - abz * acy;
  const ny = abz * acx - abx * acz;
  const nz = abx * acy - aby * acx;
  return 0.5 * Math.sqrt(nx * nx + ny * ny + nz * nz);
}

function pushTri(
  out: Tri[],
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  cx: number,
  cy: number,
  cz: number,
  region: ScaffoldRegion,
) {
  const area = triArea(ax, ay, az, bx, by, bz, cx, cy, cz);
  if (area < 1e-8) return;
  out.push({ ax, ay, az, bx, by, bz, cx, cy, cz, region, area });
}

/** Lathe a profile ring into a tube/strip of triangles. */
function latheProfile(
  tris: Tri[],
  profile: { y: number; r: number; zBias?: number }[],
  segs: number,
  region: ScaffoldRegion,
  rxScale = 1,
  rzScale = 0.78,
) {
  for (let ih = 0; ih < profile.length - 1; ih++) {
    const p0 = profile[ih];
    const p1 = profile[ih + 1];
    for (let iu = 0; iu < segs; iu++) {
      const u0 = (iu / segs) * Math.PI * 2;
      const u1 = ((iu + 1) / segs) * Math.PI * 2;
      const a = {
        x: Math.cos(u0) * p0.r * rxScale,
        y: p0.y,
        z: Math.sin(u0) * p0.r * rzScale + (p0.zBias ?? 0),
      };
      const b = {
        x: Math.cos(u1) * p0.r * rxScale,
        y: p0.y,
        z: Math.sin(u1) * p0.r * rzScale + (p0.zBias ?? 0),
      };
      const c = {
        x: Math.cos(u0) * p1.r * rxScale,
        y: p1.y,
        z: Math.sin(u0) * p1.r * rzScale + (p1.zBias ?? 0),
      };
      const d = {
        x: Math.cos(u1) * p1.r * rxScale,
        y: p1.y,
        z: Math.sin(u1) * p1.r * rzScale + (p1.zBias ?? 0),
      };
      pushTri(tris, a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, region);
      pushTri(tris, b.x, b.y, b.z, d.x, d.y, d.z, c.x, c.y, c.z, region);
    }
  }
}

/** Build triangulated emission mesh for a continuous neutral bust. */
export function buildAnatomyTris(): Tri[] {
  const tris: Tri[] = [];

  // --- Cranial vault (dense ellipsoid, face-forward bias via later face plate) ---
  const skullSegU = 36;
  const skullSegV = 24;
  const sx = 0.34;
  const sy = 0.42;
  const sz = 0.32;
  const cy = 1.0;
  for (let iv = 0; iv < skullSegV; iv++) {
    const v0 = iv / skullSegV;
    const v1 = (iv + 1) / skullSegV;
    const phi0 = v0 * Math.PI * 0.95;
    const phi1 = v1 * Math.PI * 0.95;
    for (let iu = 0; iu < skullSegU; iu++) {
      const u0 = (iu / skullSegU) * Math.PI * 2;
      const u1 = ((iu + 1) / skullSegU) * Math.PI * 2;
      const p = (phi: number, th: number) => {
        // Flatten front slightly so face plate sits cleanly
        const face = Math.sin(th); // +Z forward in our convention (sin of azimuth)
        const flatten = face > 0 ? 0.88 : 1;
        return {
          x: Math.sin(phi) * Math.cos(th) * sx,
          y: cy + Math.cos(phi) * sy,
          z: Math.sin(phi) * Math.sin(th) * sz * flatten + 0.04,
        };
      };
      const a = p(phi0, u0);
      const b = p(phi0, u1);
      const c = p(phi1, u0);
      const d = p(phi1, u1);
      pushTri(tris, a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, "skull");
      pushTri(tris, b.x, b.y, b.z, d.x, d.y, d.z, c.x, c.y, c.z, "skull");
    }
  }

  // --- Front face plate (dense grid) — primary facial readability ---
  const faceCols = 22;
  const faceRows = 26;
  for (let iy = 0; iy < faceRows; iy++) {
    for (let ix = 0; ix < faceCols; ix++) {
      const u0 = ix / faceCols;
      const u1 = (ix + 1) / faceCols;
      const v0 = iy / faceRows;
      const v1 = (iy + 1) / faceRows;
      // Face oval mask
      const fx = (u: number) => (u - 0.5) * 0.52;
      const fy = (v: number) => 0.72 + v * 0.52;
      const faceZ = (x: number, y: number) => {
        const nx = x / 0.26;
        const ny = (y - 0.98) / 0.28;
        const r2 = nx * nx + ny * ny;
        if (r2 > 1.05) return null;
        // Nose bridge protrusion
        const nose = Math.exp(-((x * x) / 0.004 + ((y - 0.92) * (y - 0.92)) / 0.02)) * 0.11;
        // Cheek puff
        const cheek = Math.exp(-((Math.abs(x) - 0.14) ** 2) / 0.01 - ((y - 0.9) ** 2) / 0.02) * 0.04;
        return 0.26 + (1 - r2) * 0.06 + nose + cheek;
      };
      const corners = [
        [fx(u0), fy(v0)],
        [fx(u1), fy(v0)],
        [fx(u0), fy(v1)],
        [fx(u1), fy(v1)],
      ] as const;
      const zs = corners.map(([x, y]) => faceZ(x, y));
      if (zs.some((z) => z == null)) continue;
      const [x0, y0] = corners[0];
      const [x1, y1] = corners[1];
      const [x2, y2] = corners[2];
      const [x3, y3] = corners[3];
      // Region tagging by face location
      const midY = (y0 + y3) * 0.5;
      const midX = Math.abs((x0 + x3) * 0.5);
      let region: ScaffoldRegion = "cheek";
      if (midY > 1.08 && midY < 1.14 && midX < 0.2) region = "brow";
      else if (midY > 0.95 && midY < 1.05 && midX > 0.06 && midX < 0.2) region = "orbit";
      else if (midY > 0.84 && midY < 1.05 && midX < 0.05) region = "nose";
      else if (midY > 0.68 && midY < 0.78 && midX < 0.12) region = "lips";
      else if (midY < 0.82) region = "jaw";
      else if (midY > 1.12) region = "skull";
      pushTri(tris, x0, y0, zs[0]!, x1, y1, zs[1]!, x2, y2, zs[2]!, region);
      pushTri(tris, x1, y1, zs[1]!, x3, y3, zs[3]!, x2, y2, zs[2]!, region);
    }
  }

  // --- Extra brow arches ---
  for (const side of [-1, 1]) {
    for (let i = 0; i < 16; i++) {
      const t0 = i / 16;
      const t1 = (i + 1) / 16;
      const arch = (t: number) => Math.sin(t * Math.PI) * 0.03;
      const x0 = side * (0.04 + t0 * 0.16);
      const x1 = side * (0.04 + t1 * 0.16);
      const y0 = 1.085 + arch(t0);
      const y1 = 1.085 + arch(t1);
      const z0 = 0.32 - t0 * 0.015;
      const z1 = 0.32 - t1 * 0.015;
      pushTri(tris, x0, y0, z0, x1, y1, z1, x0, y0 + 0.028, z0 + 0.01, "brow");
      pushTri(tris, x1, y1, z1, x1, y1 + 0.028, z1 + 0.01, x0, y0 + 0.028, z0 + 0.01, "brow");
    }
  }

  // Fill orbital disc lightly so eyes aren't dark voids + lid/rim rings
  for (const ex of [-0.12, 0.12]) {
    for (let i = 0; i < 10; i++) {
      const a0 = (i / 10) * Math.PI * 2;
      const a1 = ((i + 1) / 10) * Math.PI * 2;
      const rr = 0.028;
      pushTri(
        tris,
        ex,
        0.99,
        0.3,
        ex + Math.cos(a0) * rr,
        0.99 + Math.sin(a0) * rr * 0.55,
        0.318,
        ex + Math.cos(a1) * rr,
        0.99 + Math.sin(a1) * rr * 0.55,
        0.318,
        "orbit",
      );
    }
    const ring = 18;
    for (let i = 0; i < ring; i++) {
      const a0 = (i / ring) * Math.PI * 2;
      const a1 = ((i + 1) / ring) * Math.PI * 2;
      const rx = 0.048;
      const ry = 0.028;
      const oy = 0.99;
      const oz = 0.31;
      const px0 = ex + Math.cos(a0) * rx;
      const py0 = oy + Math.sin(a0) * ry;
      const px1 = ex + Math.cos(a1) * rx;
      const py1 = oy + Math.sin(a1) * ry;
      pushTri(tris, ex, oy, oz - 0.02, px0, py0, oz, px1, py1, oz, "orbit");
      const lid: ScaffoldRegion = Math.sin(a0) > 0.1 ? "lid" : "orbit";
      pushTri(
        tris,
        px0,
        py0,
        oz + 0.012,
        px1,
        py1,
        oz + 0.012,
        px0,
        py0 + Math.sin(a0) * 0.01,
        oz + 0.02,
        lid,
      );
    }
  }

  // --- Nose fan ---
  for (let i = 0; i < 12; i++) {
    const t = i / 12;
    const y = 1.05 - t * 0.2;
    const z = 0.3 + t * 0.14;
    const w = 0.01 + t * 0.028;
    pushTri(tris, -w, y, z, w, y, z, 0, y - 0.018, z + 0.025, "nose");
  }

  // --- Lips ribbon ---
  for (let i = 0; i < 18; i++) {
    const t0 = i / 18;
    const t1 = (i + 1) / 18;
    const x0 = (t0 - 0.5) * 0.15;
    const x1 = (t1 - 0.5) * 0.15;
    const cupid = (t: number) => 0.745 + Math.sin(Math.abs(t - 0.5) * Math.PI * 2) * 0.01;
    const zLip = (x: number) => 0.28 - Math.abs(x) * 0.3;
    pushTri(tris, x0, cupid(t0), zLip(x0), x1, cupid(t1), zLip(x1), x0, 0.725, zLip(x0) - 0.01, "lips");
    pushTri(tris, x0, 0.725, zLip(x0) - 0.01, x1, cupid(t1), zLip(x1), x1, 0.71, zLip(x1) - 0.012, "lips");
  }

  // --- Jaw band ---
  for (let i = 0; i < 24; i++) {
    const a0 = -0.15 + (i / 24) * (Math.PI + 0.3);
    const a1 = -0.15 + ((i + 1) / 24) * (Math.PI + 0.3);
    const r = 0.2;
    const x0 = Math.cos(a0) * r;
    const x1 = Math.cos(a1) * r;
    const y0 = 0.66 + Math.sin(a0) * 0.06;
    const y1 = 0.66 + Math.sin(a1) * 0.06;
    const z0 = 0.12 + Math.max(0, Math.sin(a0)) * 0.08;
    const z1 = 0.12 + Math.max(0, Math.sin(a1)) * 0.08;
    pushTri(tris, x0, y0, z0, x1, y1, z1, 0, 0.62, 0.08, "jaw");
    pushTri(tris, x0, y0 + 0.045, z0 + 0.02, x1, y1 + 0.045, z1 + 0.02, x0, y0, z0, "jaw");
  }

  // --- Ears ---
  for (const side of [-1, 1]) {
    const ex = side * 0.33;
    for (let i = 0; i < 12; i++) {
      const a0 = -0.5 + (i / 12) * 1.7;
      const a1 = -0.5 + ((i + 1) / 12) * 1.7;
      pushTri(
        tris,
        ex,
        0.96,
        0.02,
        ex + side * 0.025,
        0.96 + Math.sin(a0) * 0.07,
        Math.cos(a0) * 0.03 - 0.01,
        ex + side * 0.025,
        0.96 + Math.sin(a1) * 0.07,
        Math.cos(a1) * 0.03 - 0.01,
        "ear",
      );
    }
  }

  // --- Thick neck (continuous lathe) ---
  latheProfile(
    tris,
    [
      { y: 0.36, r: 0.13 },
      { y: 0.42, r: 0.115 },
      { y: 0.5, r: 0.108 },
      { y: 0.58, r: 0.105 },
      { y: 0.66, r: 0.12 },
    ],
    24,
    "neck",
    1,
    0.8,
  );

  // --- Connected shoulder girdle (continuous torso top, not two blobs) ---
  // Clavicle bridge + shoulder caps as one surface
  const girdleCols = 36;
  const girdleRows = 14;
  for (let iy = 0; iy < girdleRows; iy++) {
    for (let ix = 0; ix < girdleCols; ix++) {
      const u0 = ix / girdleCols;
      const u1 = (ix + 1) / girdleCols;
      const v0 = iy / girdleRows;
      const v1 = (iy + 1) / girdleRows;
      const sample = (u: number, v: number) => {
        // u around torso, v from chest bottom to clavicle top
        const ang = u * Math.PI * 2;
        const y = -0.02 + v * 0.34;
        // Width expands at shoulders (v~0.55)
        const shoulderBoost = Math.exp(-((v - 0.55) ** 2) / 0.05) * 0.22;
        const chest = 0.32 + v * 0.08 + shoulderBoost;
        const depth = 0.18 + v * 0.04;
        return {
          x: Math.cos(ang) * chest,
          y,
          z: Math.sin(ang) * depth - 0.02,
        };
      };
      const a = sample(u0, v0);
      const b = sample(u1, v0);
      const c = sample(u0, v1);
      const d = sample(u1, v1);
      const midX = Math.abs((a.x + d.x) * 0.5);
      const midY = (a.y + d.y) * 0.5;
      let region: ScaffoldRegion = "chest";
      if (midY > 0.2 && midX > 0.22) region = "shoulder";
      else if (midY > 0.22 && midX <= 0.22) region = "clavicle";
      pushTri(tris, a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, region);
      pushTri(tris, b.x, b.y, b.z, d.x, d.y, d.z, c.x, c.y, c.z, region);
    }
  }

  // Soft shoulder caps (connected, closer in)
  for (const side of [-1, 1]) {
    const scx = side * 0.42;
    const scy = 0.16;
    const scz = -0.02;
    const srx = 0.16;
    const sry = 0.11;
    const srz = 0.12;
    const su = 14;
    const sv = 10;
    for (let iv = 0; iv < sv; iv++) {
      const v0 = (iv / sv) * Math.PI;
      const v1 = ((iv + 1) / sv) * Math.PI;
      for (let iu = 0; iu < su; iu++) {
        const u0 = (iu / su) * Math.PI * 2;
        const u1 = ((iu + 1) / su) * Math.PI * 2;
        const p = (phi: number, th: number) => ({
          x: scx + Math.sin(phi) * Math.cos(th) * srx,
          y: scy + Math.cos(phi) * sry,
          z: scz + Math.sin(phi) * Math.sin(th) * srz,
        });
        const a = p(v0, u0);
        const b = p(v0, u1);
        const c = p(v1, u0);
        const d = p(v1, u1);
        pushTri(tris, a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, "shoulder");
        pushTri(tris, b.x, b.y, b.z, d.x, d.y, d.z, c.x, c.y, c.z, "shoulder");
      }
    }
  }

  return tris;
}

const REGION_WEIGHT: Record<ScaffoldRegion, number> = {
  skull: 1.05,
  brow: 4.5,
  orbit: 5.0,
  lid: 4.0,
  nose: 5.5,
  cheek: 3.0,
  lips: 5.8,
  jaw: 3.2,
  ear: 1.6,
  neck: 2.0,
  clavicle: 2.4,
  shoulder: 1.35,
  chest: 1.15,
};

type WeightedTri = Tri & { cumulative: number };

let cachedWeighted: { tris: WeightedTri[]; total: number } | null = null;

function weightedTris() {
  if (cachedWeighted) return cachedWeighted;
  const raw = buildAnatomyTris();
  const tris: WeightedTri[] = [];
  let total = 0;
  for (const t of raw) {
    const w = t.area * REGION_WEIGHT[t.region];
    total += w;
    tris.push({ ...t, cumulative: total });
  }
  cachedWeighted = { tris, total };
  return cachedWeighted;
}

function sampleTriangle(t: Tri, rnd: () => number): ScaffoldSample {
  let r1 = rnd();
  let r2 = rnd();
  if (r1 + r2 > 1) {
    r1 = 1 - r1;
    r2 = 1 - r2;
  }
  const r3 = 1 - r1 - r2;
  const x = finite(r1 * t.ax + r2 * t.bx + r3 * t.cx);
  const y = finite(r1 * t.ay + r2 * t.by + r3 * t.cy);
  const z = finite(r1 * t.az + r2 * t.bz + r3 * t.cz);
  const abx = t.bx - t.ax;
  const aby = t.by - t.ay;
  const abz = t.bz - t.az;
  const acx = t.cx - t.ax;
  const acy = t.cy - t.ay;
  const acz = t.cz - t.az;
  let nx = aby * acz - abz * acy;
  let ny = abz * acx - abx * acz;
  let nz = abx * acy - aby * acx;
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
  nx /= len;
  ny /= len;
  nz /= len;
  return { x, y, z, nx, ny, nz, region: t.region };
}

function pickTri(rnd: () => number, filter?: (r: ScaffoldRegion) => boolean): Tri {
  const { tris, total } = weightedTris();
  if (!filter) {
    const target = rnd() * total;
    let lo = 0;
    let hi = tris.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (tris[mid].cumulative < target) lo = mid + 1;
      else hi = mid;
    }
    return tris[lo];
  }
  for (let attempt = 0; attempt < 28; attempt++) {
    const target = rnd() * total;
    let lo = 0;
    let hi = tris.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (tris[mid].cumulative < target) lo = mid + 1;
      else hi = mid;
    }
    if (filter(tris[lo].region)) return tris[lo];
  }
  const candidates = tris.filter((t) => filter(t.region));
  return candidates[Math.floor(rnd() * candidates.length)] ?? tris[0];
}

/** Dense surface sample (population A). Prefer front hemisphere. */
export function sampleScaffoldSurface(
  rnd: () => number,
  regionFilter?: (r: ScaffoldRegion) => boolean,
): ScaffoldSample {
  let best = sampleTriangle(pickTri(rnd, regionFilter), rnd);
  // Mild front bias: retry a few times if back-facing
  if (best.z < 0.02 && rnd() < 0.65) {
    const alt = sampleTriangle(pickTri(rnd, regionFilter), rnd);
    if (alt.z > best.z) best = alt;
  }
  return best;
}

/** Internal depth sample (population B) — inset along normal. */
export function sampleScaffoldInternal(rnd: () => number): ScaffoldSample {
  const s = sampleScaffoldSurface(rnd);
  const inset = 0.015 + rnd() * 0.09;
  return {
    x: s.x - s.nx * inset,
    y: s.y - s.ny * inset,
    z: s.z - s.nz * inset,
    nx: s.nx,
    ny: s.ny,
    nz: s.nz,
    region: s.region,
  };
}

/** Atmospheric drift around silhouette (population C). */
export function sampleScaffoldAtmosphere(rnd: () => number): ScaffoldSample {
  const s = sampleScaffoldSurface(rnd);
  const outward = 0.06 + rnd() * 0.4;
  return {
    x: s.x + s.nx * outward + (rnd() - 0.5) * 0.06,
    y: s.y + s.ny * outward * 0.55 + (rnd() - 0.5) * 0.08,
    z: s.z + s.nz * outward * 0.65 + (rnd() - 0.5) * 0.05,
    nx: s.nx,
    ny: s.ny,
    nz: s.nz,
    region: s.region,
  };
}

export function scaffoldRegionToPresence(region: ScaffoldRegion): number {
  switch (region) {
    case "skull":
      return 3;
    case "brow":
      return 4;
    case "orbit":
    case "lid":
      return 5;
    case "nose":
      return 6;
    case "cheek":
      return 7;
    case "jaw":
      return 8;
    case "lips":
      return 9;
    case "neck":
      return 2;
    case "clavicle":
    case "chest":
      return 0;
    case "shoulder":
      return 1;
    case "ear":
      return 11;
    default:
      return 3;
  }
}

export const FACE_LANDMARKS: ScaffoldRegion[] = [
  "brow",
  "orbit",
  "lid",
  "nose",
  "cheek",
  "lips",
  "jaw",
];

export function isFaceLandmark(r: ScaffoldRegion) {
  return FACE_LANDMARKS.includes(r);
}

export function isSilhouetteHeavy(r: ScaffoldRegion) {
  return r === "skull" || r === "ear" || r === "shoulder" || r === "jaw";
}

export function makeScaffoldRnd(seed = 211) {
  return makeRnd(seed);
}
