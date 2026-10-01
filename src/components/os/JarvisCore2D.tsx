"use client";

import { useEffect, useRef } from "react";
import { useJarvis } from "@/components/jarvis/JarvisProvider";
import { visualAccent } from "@/lib/jarvis/visualState";

/**
 * Multi-layer Canvas2D Jarvis core for mobile / lightweight contexts.
 * Same 12-layer anatomy as R3F core — not two CSS circles.
 */
export function JarvisCore2D({
  size = 320,
  onWake,
}: {
  size?: number;
  onWake?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { visualState, audioLevel, setAwake } = useJarvis();
  const wakeRef = useRef(0);
  const reducedRef = useRef(false);

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

    const draw = (now: number) => {
      const t = (now - t0) / 1000;
      const accent = visualAccent(visualState);
      const wake = wakeRef.current;
      wakeRef.current = Math.max(0, wake - (reducedRef.current ? 1 : 0.016));
      const audio = audioLevel;
      const level = accent.intensity + wake * 0.4;
      const cx = size / 2;
      const cy = size / 2;
      const R = size * 0.42;

      ctx.clearRect(0, 0, size, size);

      // 1 ambient glow
      const g1 = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R * 1.35);
      g1.addColorStop(0, hexAlpha(accent.primary, 0.18 + level * 0.2));
      g1.addColorStop(0.55, hexAlpha(accent.primary, 0.05));
      g1.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g1;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.35, 0, Math.PI * 2);
      ctx.fill();

      // 2 depth halo
      ctx.strokeStyle = hexAlpha("#0a1828", 0.7);
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.05, 0, Math.PI * 2);
      ctx.stroke();

      // 3 outer ticks
      ctx.strokeStyle = hexAlpha("#e8f1ff", 0.25 + level * 0.2);
      ctx.lineWidth = 1;
      for (let i = 0; i < 72; i++) {
        const a = (i / 72) * Math.PI * 2 - Math.PI / 2;
        const len = i % 6 === 0 ? 10 : 5;
        const r0 = R * 0.98;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        ctx.lineTo(cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len));
        ctx.stroke();
      }

      const spin = reducedRef.current ? 0 : t * (0.15 + accent.spin);

      // 4 outer structural rings
      for (const [rr, op] of [
        [0.95, 0.35],
        [0.88, 0.28],
      ] as const) {
        ctx.strokeStyle = hexAlpha(accent.primary, op + level * 0.25);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, R * rr, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 5 segmented data band
      ctx.strokeStyle = hexAlpha(accent.primary, 0.45 + level * 0.3);
      ctx.lineWidth = 2.5;
      ctx.lineCap = "butt";
      for (let i = 0; i < 28; i++) {
        if (i % 5 === 0) continue;
        const a0 = (i / 28) * Math.PI * 2 + spin * 0.6;
        const a1 = a0 + (0.7 / 28) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.78, a0, a1);
        ctx.stroke();
      }

      // 6 mid procedural arc
      ctx.strokeStyle = hexAlpha(accent.primary, 0.55 + level * 0.3);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.68, -spin, -spin + Math.PI * 1.2);
      ctx.stroke();

      // 7 violet accent
      ctx.strokeStyle = hexAlpha("#a78bfa", 0.2 + level * 0.2);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.58, spin * 0.5 + 1, spin * 0.5 + 1 + Math.PI * 0.5);
      ctx.stroke();

      // 8 inner luminous ring
      ctx.strokeStyle = hexAlpha(accent.primary, 0.4 + level * 0.35 + audio * 0.15);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.45, 0, Math.PI * 2);
      ctx.stroke();

      // 9 waveform
      if (visualState === "LISTENING" || visualState === "SPEAKING") {
        const wr = R * (0.36 + audio * 0.08 + Math.sin(t * 7) * 0.01);
        ctx.strokeStyle = hexAlpha(
          visualState === "SPEAKING" ? accent.secondary : accent.primary,
          0.35 + audio * 0.4,
        );
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(cx, cy, wr, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 10 particles
      let seed = 17 + Math.floor(t * 2);
      const rnd = () => {
        seed = (seed * 16807) % 2147483647;
        return (seed - 1) / 2147483646;
      };
      const count = 40 + Math.floor(level * 30);
      for (let i = 0; i < count; i++) {
        const a = rnd() * Math.PI * 2 + spin * 0.2;
        const r = R * (0.2 + rnd() * 0.7);
        ctx.fillStyle = hexAlpha(accent.primary, 0.15 + level * 0.35);
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1 + rnd(), 0, Math.PI * 2);
        ctx.fill();
      }

      // 11 nucleus
      const ng = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.22);
      ng.addColorStop(0, hexAlpha(accent.primary, 0.55 + level * 0.35 + audio * 0.2));
      ng.addColorStop(0.5, hexAlpha(accent.primary, 0.2));
      ng.addColorStop(1, "rgba(7,20,32,0.1)");
      ctx.fillStyle = ng;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.22 * (1 + wake * 0.08), 0, Math.PI * 2);
      ctx.fill();

      // 12 precision mark
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.PI / 4);
      ctx.strokeStyle = hexAlpha("#f0f7ff", 0.18 + level * 0.25);
      ctx.lineWidth = 1.2;
      ctx.strokeRect(-R * 0.16, -R * 0.16, R * 0.32, R * 0.32);
      ctx.restore();

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [size, visualState, audioLevel]);

  return (
    <button
      type="button"
      className="jarvis-core-2d"
      aria-label="Jarvis core — tap to wake"
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

function hexAlpha(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`;
}
