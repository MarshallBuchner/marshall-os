"use client";

import { useEffect, useMemo, useRef } from "react";
import { useJarvis } from "@/components/jarvis/JarvisProvider";
import { visualAccent, type JarvisVisualState, type PresenceMode } from "@/lib/jarvis/visualState";
import {
  PRESENCE_COUNTS,
  Region,
  buildPresenceLayout,
  morphPresence,
} from "@/lib/jarvis/presenceGeometry";

/** Mobile tier — ~7× prior 220 count for denser apparent reconstruction */
const MOBILE_PARTICLES = PRESENCE_COUNTS.MOBILE;

/**
 * Multi-layer Canvas2D Jarvis core for mobile / lightweight contexts.
 * Same design language as desktop morph: staggered regional assembly,
 * depth-aware projection, size hierarchy, precise late eyes.
 */
export function JarvisCore2D({
  size = 340,
  onWake,
}: {
  size?: number;
  onWake?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const {
    visualState,
    audioLevel,
    setAwake,
    presence,
    transformProgress,
  } = useJarvis();
  const wakeRef = useRef(0);
  const reducedRef = useRef(false);
  const workRef = useRef<Float32Array | null>(null);
  const orderRef = useRef<Uint16Array | null>(null);
  const presenceRef = useRef<PresenceMode>(presence);
  const progressRef = useRef(transformProgress);
  const stateRef = useRef<JarvisVisualState>(visualState);
  const audioRef = useRef(audioLevel);

  const layout = useMemo(() => buildPresenceLayout(MOBILE_PARTICLES), []);

  useEffect(() => {
    presenceRef.current = presence;
    progressRef.current = transformProgress;
    stateRef.current = visualState;
    audioRef.current = audioLevel;
  }, [presence, transformProgress, visualState, audioLevel]);

  useEffect(() => {
    reducedRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let raf = 0;
    const t0 = performance.now();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const n = layout.count;
    if (!workRef.current || workRef.current.length !== n * 3) {
      workRef.current = new Float32Array(n * 3);
    }
    if (!orderRef.current || orderRef.current.length !== n) {
      orderRef.current = new Uint16Array(n);
      for (let i = 0; i < n; i++) orderRef.current[i] = i;
    }
    const work = workRef.current;
    const order = orderRef.current;

    const draw = (now: number) => {
      const t = (now - t0) / 1000;
      const presenceNow = presenceRef.current;
      const progressNow = progressRef.current;
      const visualNow = stateRef.current;
      const audio = audioRef.current;
      const accent = visualAccent(visualNow);
      const wake = wakeRef.current;
      wakeRef.current = Math.max(0, wake - (reducedRef.current ? 1 : 0.016));
      const level = accent.intensity + wake * 0.4;
      const cx = size / 2;
      const cy = size / 2;
      const R = size * 0.46;

      let morph = 0;
      if (presenceNow === "transforming") morph = clamp01(progressNow);
      else if (presenceNow === "humanoid") morph = 1;
      else if (presenceNow === "returning") morph = 1 - clamp01(progressNow);
      else morph = 0;

      const coreFade = 1 - smoothstep(morph, 0.05, 0.55);
      const eyeReveal = smoothstep(morph, 0.86, 0.98);
      const humanoidAmt = smoothstep(morph, 0.08, 1);

      morphPresence(layout.core, layout.humanoid, morph, layout.delays, work, layout.curve);

      // Idle / speak / blink articulation
      if (morph > 0.35 && !reducedRef.current) {
        const breath = Math.sin(t * 1.1) * 0.012;
        const headYaw = Math.sin(t * 0.32) * 0.014;
        const speaking = visualNow === "SPEAKING";
        const jaw = speaking ? audio * 0.05 : Math.sin(t * 1.35) * 0.005;
        const blinkPhase = (Math.sin(t * 0.45) * 0.5 + 0.5) ** 12;
        const lidClose = blinkPhase > 0.85 ? (blinkPhase - 0.85) / 0.15 : 0;
        const gazeX = Math.sin(t * 0.17) * 0.005;
        for (let i = 0; i < n; i++) {
          const o = i * 3;
          const region = layout.regions[i];
          let x = work[o];
          let y = work[o + 1];
          let z = work[o + 2];

          if (
            region === Region.CRANIUM ||
            region === Region.BROW ||
            region === Region.ORBIT ||
            region === Region.NOSE ||
            region === Region.CHEEK ||
            region === Region.JAW ||
            region === Region.MOUTH ||
            region === Region.EYE ||
            region === Region.SILHOUETTE
          ) {
            const z2 = x * Math.sin(headYaw) + z * Math.cos(headYaw);
            x = x * Math.cos(headYaw) - z * Math.sin(headYaw);
            z = z2;
          }
          if (region === Region.TORSO || region === Region.SHOULDER) y += breath;
          if (region === Region.JAW || region === Region.MOUTH) {
            y -= jaw * (region === Region.MOUTH ? 1.2 : 0.7);
          }
          if (region === Region.ENERGY) {
            const pulse = speaking ? 0.28 + audio * 0.4 : 0.1 + Math.sin(t * 2) * 0.035;
            y += pulse * 0.018;
            z += pulse * 0.012;
          }
          if (region === Region.DRIFT) {
            x += Math.sin(t * 0.38 + i * 0.17) * 0.022;
            y += Math.cos(t * 0.31 + i * 0.13) * 0.016;
          }
          if (region === Region.EYE) {
            x += gazeX;
            y -= lidClose * 0.01;
          }
          if (region === Region.ORBIT && lidClose > 0.01) {
            y -= lidClose * 0.014;
          }
          work[o] = x;
          work[o + 1] = y;
          work[o + 2] = z;
        }
      }

      // Depth sort (back → front) for correct occlusion cues
      order.sort((a, b) => work[a * 3 + 2] - work[b * 3 + 2]);

      ctx.clearRect(0, 0, size, size);

      // Residual / ambient field
      const g1 = ctx.createRadialGradient(cx, cy, R * 0.08, cx, cy, R * 1.25);
      g1.addColorStop(
        0,
        hexAlpha(accent.primary, (0.1 + level * 0.12) * (0.25 + coreFade * 0.75 + humanoidAmt * 0.15)),
      );
      g1.addColorStop(0.55, hexAlpha(accent.primary, 0.035 * (coreFade + humanoidAmt * 0.25)));
      g1.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g1;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.25, 0, Math.PI * 2);
      ctx.fill();

      // Residual Jarvis DNA halo — denser rings + amber accents behind humanoid
      if (humanoidAmt > 0.35) {
        const haloA =
          (presenceNow === "humanoid" ? 0.18 : humanoidAmt * 0.14) *
          (0.85 + Math.sin(t * 0.9) * 0.08);
        const rot = Math.sin(t * 0.08) * 0.05;
        for (const [rx, ry, op, w] of [
          [0.72, 0.48, 1, 1.4],
          [0.82, 0.55, 0.7, 1.1],
          [0.94, 0.62, 0.45, 0.9],
        ] as const) {
          ctx.strokeStyle = hexAlpha(accent.primary, haloA * op);
          ctx.lineWidth = w;
          ctx.beginPath();
          ctx.ellipse(cx, cy + R * 0.02, R * rx, R * ry, rot, 0, Math.PI * 2);
          ctx.stroke();
        }
        // Tick marks
        ctx.strokeStyle = hexAlpha("#a5f3fc", haloA * 0.55);
        ctx.lineWidth = 1;
        for (let i = 0; i < 48; i++) {
          const a = (i / 48) * Math.PI * 2 + rot;
          const len = i % 6 === 0 ? 7 : 3.5;
          const r0 = R * 0.86;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 0.68 + R * 0.02);
          ctx.lineTo(
            cx + Math.cos(a) * (r0 + len),
            cy + Math.sin(a) * (r0 + len) * 0.68 + R * 0.02,
          );
          ctx.stroke();
        }
        // Amber accent arcs
        ctx.strokeStyle = hexAlpha("#fbbf24", haloA * 0.55);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(cx, cy + R * 0.02, R * 0.98, R * 0.66, rot, 0.3, 1.2);
        ctx.stroke();
        ctx.strokeStyle = hexAlpha("#f59e0b", haloA * 0.4);
        ctx.beginPath();
        ctx.ellipse(cx, cy + R * 0.02, R * 0.98, R * 0.66, rot, 3.4, 4.1);
        ctx.stroke();
      }

      if (coreFade > 0.04) {
        drawCoreRings(ctx, {
          cx,
          cy,
          R: R * 0.95,
          accentPrimary: accent.primary,
          level,
          audio,
          visualState: visualNow,
          t,
          reduced: reducedRef.current,
          spinMul: accent.spin,
          alphaMul: coreFade,
        });
      }

      // Mobile: head-and-shoulders — keep crown on-canvas, enlarge vs core diameter
      const baseScale = R * (0.88 + humanoidAmt * 0.22);
      const yBias = humanoidAmt * R * 0.12;
      const persp = 2.55;

      // Precompute RGB once per accent
      const rgb = hexToRgb(accent.primary);
      const eyeRgb = { r: 232, g: 244, b: 255 };
      const hiRgb = { r: 196, g: 232, b: 255 };

      // Batch draw — minimize fillStyle churn by size/region buckets in one pass
      for (let k = 0; k < n; k++) {
        const i = order[k];
        const region = layout.regions[i];
        const o = i * 3;
        const x = work[o];
        const y = work[o + 1];
        const z = work[o + 2];

        // Local morph visibility for sparse early assembly
        const localT = particleLocal(morph, layout.delays[i]);
        if (localT < 0.02 && morph < 0.98) continue;

        const depthScale = persp / (persp - z);
        const sx = cx + x * baseScale * depthScale;
        const sy = cy - y * baseScale * depthScale + yBias;

        const sizeClass = layout.sizes[i];
        let rad =
          sizeClass >= 1.5 ? 2.9 : sizeClass >= 0.5 ? 2.15 : 1.7;
        rad *= depthScale * (0.95 + localT * 0.12);
        if (region === Region.DRIFT) rad *= 0.65;
        if (region === Region.ENERGY) rad *= 1.25 + Math.sin(t * 2.2 + i) * 0.08;
        if (region === Region.CRANIUM || region === Region.CHEEK) rad *= 1.08;
        if (region === Region.NOSE || region === Region.BROW || region === Region.MOUTH) rad *= 1.12;

        const front = clamp01((z + 0.45) / 0.95);
        let alpha =
          (presenceNow === "core" ? 0.14 : 0.42 + accent.particle * 0.4) *
          (0.55 + front * 0.55) *
          localT;
        if (region === Region.ENERGY) alpha *= 1.25;
        if (region === Region.DRIFT) alpha *= 0.45;
        if (region === Region.SILHOUETTE) alpha *= 1.1;

        const speaking = visualNow === "SPEAKING";
        // Face warm core while speaking — orange energy overlay (not giant eyes)
        const faceWarm =
          region === Region.ENERGY &&
          y > 0.78 &&
          y < 1.05 &&
          Math.hypot(x, z - 0.28) < 0.14;
        const throatHot =
          region === Region.ENERGY && y > 0.35 && y < 0.48 && Math.abs(x) < 0.06;

        if (region === Region.EYE) {
          if (eyeReveal < 0.04 || speaking) continue;
          alpha = eyeReveal * (0.7 + front * 0.15);
          rad = (0.75 + sizeClass * 0.15) * depthScale;
          ctx.fillStyle = `rgba(${eyeRgb.r},${eyeRgb.g},${eyeRgb.b},${clamp01(alpha)})`;
        } else if (faceWarm && speaking) {
          const warm = 0.45 + audio * 0.45;
          alpha = warm * (0.5 + front * 0.4);
          rad *= 1.35;
          ctx.fillStyle = `rgba(251,${140 + (audio * 40) | 0},60,${clamp01(alpha)})`;
        } else if (throatHot) {
          alpha = 0.55 + Math.sin(t * 2.8) * 0.12 + (speaking ? audio * 0.15 : 0);
          rad *= 1.5;
          ctx.fillStyle = `rgba(103,232,249,${clamp01(alpha)})`;
        } else if (sizeClass >= 1.5 || region === Region.ENERGY) {
          const lift = 0.15 + front * 0.25;
          ctx.fillStyle = `rgba(${Math.min(255, hiRgb.r + lift * 40)},${Math.min(255, hiRgb.g + lift * 20)},${hiRgb.b},${clamp01(alpha)})`;
        } else {
          const lr = Math.min(255, rgb.r + front * 50);
          const lg = Math.min(255, rgb.g + front * 40);
          const lb = Math.min(255, rgb.b + front * 30);
          // Grainy semi-transparent bust during assemble
          const assembleFade = presenceNow === "transforming" ? 0.85 : 1;
          ctx.fillStyle = `rgba(${lr | 0},${lg | 0},${lb | 0},${clamp01(alpha * assembleFade)})`;
        }

        // Streamline streak for high-stretch silhouette / shoulder particles
        const streak =
          (region === Region.SHOULDER || region === Region.NECK || region === Region.SILHOUETTE) &&
          layout.stretch[i] > 0.5;
        if (streak) {
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(-0.15);
          ctx.fillStyle = ctx.fillStyle;
          ctx.beginPath();
          ctx.ellipse(0, 0, rad * 0.45, rad * 1.8, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(sx, sy, rad, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Thin facial reticle while resolving
      if (humanoidAmt > 0.35 && humanoidAmt < 0.98) {
        const rx = cx;
        const ry = cy - 0.96 * baseScale + yBias;
        const rr = baseScale * 0.06;
        ctx.strokeStyle = hexAlpha("#7dd3fc", 0.25 * humanoidAmt);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(rx, ry, rr, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(rx - rr * 0.7, ry);
        ctx.lineTo(rx + rr * 0.7, ry);
        ctx.moveTo(rx, ry - rr * 0.7);
        ctx.lineTo(rx, ry + rr * 0.7);
        ctx.stroke();
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [size, layout]);

  return (
    <button
      type="button"
      className="jarvis-core-2d"
      aria-label="Jarvis core — tap to wake"
      data-presence={presence}
      data-quality="MOBILE"
      onClick={() => {
        wakeRef.current = 1;
        setAwake(true);
        onWake?.();
        window.setTimeout(() => setAwake(false), 800);
      }}
      style={{ width: size, height: size, border: "none", background: "transparent", padding: 0 }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size, display: "block" }}
        aria-hidden
      />
    </button>
  );
}

function particleLocal(globalT: number, delay: number) {
  return smoothstep((globalT - delay) / 0.22, 0, 1);
}

function drawCoreRings(
  ctx: CanvasRenderingContext2D,
  opts: {
    cx: number;
    cy: number;
    R: number;
    accentPrimary: string;
    level: number;
    audio: number;
    visualState: string;
    t: number;
    reduced: boolean;
    spinMul: number;
    alphaMul: number;
  },
) {
  const { cx, cy, R, accentPrimary, level, audio, visualState, t, reduced, spinMul, alphaMul } =
    opts;
  const a = (v: number) => v * alphaMul;

  ctx.strokeStyle = hexAlpha("#0a1828", a(0.7));
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 1.05, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = hexAlpha("#e8f1ff", a(0.25 + level * 0.2));
  ctx.lineWidth = 1;
  for (let i = 0; i < 72; i++) {
    const ang = (i / 72) * Math.PI * 2 - Math.PI / 2;
    const len = i % 6 === 0 ? 10 : 5;
    const r0 = R * 0.98;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
    ctx.lineTo(cx + Math.cos(ang) * (r0 + len), cy + Math.sin(ang) * (r0 + len));
    ctx.stroke();
  }

  const spin = reduced ? 0 : t * (0.15 + spinMul);

  for (const [rr, op] of [
    [0.95, 0.35],
    [0.88, 0.28],
  ] as const) {
    ctx.strokeStyle = hexAlpha(accentPrimary, a(op + level * 0.25));
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, R * rr, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.strokeStyle = hexAlpha(accentPrimary, a(0.45 + level * 0.3));
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 28; i++) {
    if (i % 5 === 0) continue;
    const a0 = (i / 28) * Math.PI * 2 + spin * 0.6;
    const a1 = a0 + (0.7 / 28) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.78, a0, a1);
    ctx.stroke();
  }

  ctx.strokeStyle = hexAlpha(accentPrimary, a(0.55 + level * 0.3));
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.68, -spin, -spin + Math.PI * 1.2);
  ctx.stroke();

  ctx.strokeStyle = hexAlpha("#a78bfa", a(0.2 + level * 0.2));
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.58, spin * 0.5 + 1, spin * 0.5 + 1 + Math.PI * 0.5);
  ctx.stroke();

  ctx.strokeStyle = hexAlpha(accentPrimary, a(0.4 + level * 0.35 + audio * 0.15));
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.45, 0, Math.PI * 2);
  ctx.stroke();

  if (visualState === "LISTENING" || visualState === "SPEAKING") {
    const wr = R * (0.36 + audio * 0.08 + Math.sin(t * 7) * 0.01);
    ctx.strokeStyle = hexAlpha(
      visualState === "SPEAKING" ? "#c4b5fd" : accentPrimary,
      a(0.35 + audio * 0.4),
    );
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, wr, 0, Math.PI * 2);
    ctx.stroke();
  }

  const ng = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.22);
  ng.addColorStop(0, hexAlpha(accentPrimary, a(0.55 + level * 0.35 + audio * 0.2)));
  ng.addColorStop(0.5, hexAlpha(accentPrimary, a(0.2)));
  ng.addColorStop(1, "rgba(7,20,32,0.1)");
  ctx.fillStyle = ng;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.22, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.globalAlpha = alphaMul;
  ctx.translate(cx, cy);
  ctx.rotate(Math.PI / 4);
  ctx.strokeStyle = hexAlpha("#f0f7ff", 0.18 + level * 0.25);
  ctx.lineWidth = 1.2;
  ctx.strokeRect(-R * 0.16, -R * 0.16, R * 0.32, R * 0.32);
  ctx.restore();
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
}

function smoothstep(x: number, edge0 = 0, edge1 = 1) {
  const t = clamp01((x - edge0) / (edge1 - edge0 || 1));
  return t * t * (3 - 2 * t);
}

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function hexAlpha(hex: string, a: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`;
}
