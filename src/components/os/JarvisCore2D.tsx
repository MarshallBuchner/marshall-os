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

      morphPresence(layout.core, layout.humanoid, morph, layout.delays, work);

      // Idle / speak articulation
      if (morph > 0.35 && !reducedRef.current) {
        const breath = Math.sin(t * 1.15) * 0.012;
        const headYaw = Math.sin(t * 0.35) * 0.014;
        const speaking = visualNow === "SPEAKING";
        const jaw = speaking ? audio * 0.055 : Math.sin(t * 1.4) * 0.006;
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
            region === Region.EYE
          ) {
            const z2 = x * Math.sin(headYaw) + z * Math.cos(headYaw);
            x = x * Math.cos(headYaw) - z * Math.sin(headYaw);
            z = z2;
          }
          if (region === Region.TORSO || region === Region.SHOULDER) y += breath;
          if (region === Region.JAW || region === Region.MOUTH) {
            y -= jaw * (region === Region.MOUTH ? 1.25 : 0.75);
          }
          if (region === Region.ENERGY) {
            const pulse = speaking ? 0.3 + audio * 0.45 : 0.12 + Math.sin(t * 2) * 0.04;
            y += pulse * 0.02;
            z += pulse * 0.015;
          }
          if (region === Region.DRIFT) {
            x += Math.sin(t * 0.4 + i * 0.17) * 0.025;
            y += Math.cos(t * 0.33 + i * 0.13) * 0.018;
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

      // Residual Jarvis halo when humanoid
      if (humanoidAmt > 0.4) {
        const haloA = (presenceNow === "humanoid" ? 0.16 : humanoidAmt * 0.12) *
          (0.85 + Math.sin(t * 0.9) * 0.08);
        ctx.strokeStyle = hexAlpha(accent.primary, haloA);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(cx, cy + R * 0.02, R * 0.78, R * 0.52, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = hexAlpha("#a5d8ff", haloA * 0.45);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(cx, cy + R * 0.02, R * 0.9, R * 0.6, Math.sin(t * 0.08) * 0.05, 0, Math.PI * 2);
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

      // Fit humanoid in frame: shrink + shift down while morphing so cranium stays on-canvas
      const baseScale = R * (0.82 - humanoidAmt * 0.14);
      const yBias = humanoidAmt * R * 0.22;
      const persp = 2.45;

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
          sizeClass >= 1.5 ? 2.4 : sizeClass >= 0.5 ? 1.75 : 1.35;
        rad *= depthScale * (0.95 + localT * 0.12);
        if (region === Region.DRIFT) rad *= 0.7;
        if (region === Region.ENERGY) rad *= 1.2 + Math.sin(t * 2.2 + i) * 0.08;
        if (region === Region.CRANIUM || region === Region.CHEEK) rad *= 1.05;

        const front = clamp01((z + 0.45) / 0.95);
        let alpha =
          (presenceNow === "core" ? 0.14 : 0.32 + accent.particle * 0.4) *
          (0.5 + front * 0.55) *
          localT;
        if (region === Region.ENERGY) alpha *= 1.25;
        if (region === Region.DRIFT) alpha *= 0.45;
        if (region === Region.SILHOUETTE) alpha *= 1.1;

        if (region === Region.EYE) {
          if (eyeReveal < 0.04) continue;
          alpha = eyeReveal * (0.85 + front * 0.15 + (visualNow === "SPEAKING" ? audio * 0.12 : 0));
          rad = (0.85 + sizeClass * 0.2) * depthScale;
          ctx.fillStyle = `rgba(${eyeRgb.r},${eyeRgb.g},${eyeRgb.b},${clamp01(alpha)})`;
        } else if (sizeClass >= 1.5 || region === Region.ENERGY) {
          const lift = 0.15 + front * 0.25;
          ctx.fillStyle = `rgba(${Math.min(255, hiRgb.r + lift * 40)},${Math.min(255, hiRgb.g + lift * 20)},${hiRgb.b},${clamp01(alpha)})`;
        } else {
          const lr = Math.min(255, rgb.r + front * 50);
          const lg = Math.min(255, rgb.g + front * 40);
          const lb = Math.min(255, rgb.b + front * 30);
          ctx.fillStyle = `rgba(${lr | 0},${lg | 0},${lb | 0},${clamp01(alpha)})`;
        }

        ctx.beginPath();
        ctx.arc(sx, sy, rad, 0, Math.PI * 2);
        ctx.fill();
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
