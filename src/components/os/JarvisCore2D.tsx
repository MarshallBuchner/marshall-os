"use client";

import { useEffect, useMemo, useRef } from "react";
import { useJarvis } from "@/components/jarvis/JarvisProvider";
import { visualAccent, type JarvisVisualState, type PresenceMode } from "@/lib/jarvis/visualState";
import {
  buildCoreTargets,
  buildHumanoidTargets,
  lerpArrays,
} from "@/lib/jarvis/presenceGeometry";

/** Reduced particle count for Canvas2D — still enough for a readable bust */
const MOBILE_PARTICLES = 220;
const EYE_COUNT = 24;

/**
 * Multi-layer Canvas2D Jarvis core for mobile / lightweight contexts.
 * Same engineered ring anatomy as R3F core, plus a deliberate reduced-quality
 * CORE ↔ HUMANOID particle morph (shared target geometry with desktop).
 */
export function JarvisCore2D({
  size = 320,
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
  const presenceRef = useRef<PresenceMode>(presence);
  const progressRef = useRef(transformProgress);
  const stateRef = useRef<JarvisVisualState>(visualState);
  const audioRef = useRef(audioLevel);

  const coreTargets = useMemo(() => buildCoreTargets(MOBILE_PARTICLES), []);
  const humanTargets = useMemo(() => buildHumanoidTargets(MOBILE_PARTICLES), []);

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
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const t0 = performance.now();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (!workRef.current || workRef.current.length !== MOBILE_PARTICLES * 3) {
      workRef.current = new Float32Array(MOBILE_PARTICLES * 3);
    }
    const work = workRef.current;

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
      const R = size * 0.42;

      let morph = 0;
      if (presenceNow === "transforming") morph = clamp01(progressNow);
      else if (presenceNow === "humanoid") morph = 1;
      else if (presenceNow === "returning") morph = 1 - clamp01(progressNow);
      else morph = 0;

      const ease = morph * morph * (3 - 2 * morph);
      const coreFade = 1 - ease;
      const eyeReveal = smoothstep(ease, 0.78, 1);

      ctx.clearRect(0, 0, size, size);

      const g1 = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R * 1.35);
      g1.addColorStop(0, hexAlpha(accent.primary, (0.12 + level * 0.15) * (0.35 + coreFade * 0.65)));
      g1.addColorStop(0.55, hexAlpha(accent.primary, 0.04 * coreFade));
      g1.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g1;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.35, 0, Math.PI * 2);
      ctx.fill();

      if (coreFade > 0.04) {
        drawCoreRings(ctx, {
          cx,
          cy,
          R,
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

      lerpArrays(coreTargets, humanTargets, ease, work);

      if (ease > 0.5 && !reducedRef.current) {
        const jaw =
          visualNow === "SPEAKING" ? audio * 0.045 : Math.sin(t * 1.2) * 0.008;
        for (let i = 0; i < MOBILE_PARTICLES - EYE_COUNT; i++) {
          const y = work[i * 3 + 1];
          if (y < 0.55 && y > 0.2) {
            work[i * 3 + 1] = y - jaw * (0.55 - y);
          }
        }
      }

      const scale = R * (0.72 + ease * 0.12);
      const yBias = ease * R * 0.12;
      const particleAlpha =
        presenceNow === "core"
          ? 0.12 + accent.particle * 0.2
          : 0.28 + accent.particle * 0.45;

      ctx.fillStyle = hexAlpha(accent.primary, particleAlpha * (0.55 + ease * 0.45));
      for (let i = 0; i < MOBILE_PARTICLES - EYE_COUNT; i++) {
        const x = cx + work[i * 3] * scale;
        const y = cy - work[i * 3 + 1] * scale + yBias;
        const z = work[i * 3 + 2];
        const r = 1.1 + Math.max(0, 0.55 + z) * 1.1;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (eyeReveal > 0.05) {
        ctx.fillStyle = hexAlpha("#e0f2fe", eyeReveal * 0.95);
        for (let e = MOBILE_PARTICLES - EYE_COUNT; e < MOBILE_PARTICLES; e++) {
          const x = cx + work[e * 3] * scale;
          const y = cy - work[e * 3 + 1] * scale + yBias;
          ctx.beginPath();
          ctx.arc(x, y, 1.8 + audio * 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [size, coreTargets, humanTargets]);

  return (
    <button
      type="button"
      className="jarvis-core-2d"
      aria-label="Jarvis core — tap to wake"
      data-presence={presence}
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

function smoothstep(x: number, edge0: number, edge1: number) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function hexAlpha(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`;
}
