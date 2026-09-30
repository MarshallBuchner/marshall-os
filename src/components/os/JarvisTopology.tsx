"use client";

import { useMemo } from "react";
import { useJarvis } from "@/components/jarvis/JarvisProvider";
import {
  AGENT_ORBIT,
  CORE_NODE,
  SYSTEM_ORBIT,
  polarToXY,
  systemStatusLabel,
} from "@/lib/registry/projects";

function statusStroke(status: string): string {
  if (status === "degraded") return "rgba(252, 211, 77, 0.85)";
  if (status === "not_configured" || status === "offline") return "rgba(125, 145, 168, 0.55)";
  if (status === "online") return "rgba(110, 231, 183, 0.75)";
  return "rgba(125, 211, 252, 0.7)";
}

export function JarvisTopology() {
  const { focus, setFocus, clearFocus, busy, activeCommandId } = useJarvis();
  const focusedId = focus?.id ?? null;
  const inFocus = Boolean(focus);

  const systems = useMemo(
    () =>
      SYSTEM_ORBIT.map((n) => ({
        ...n,
        ...polarToXY(n.angle, n.radius),
      })),
    [],
  );

  const agents = useMemo(
    () =>
      AGENT_ORBIT.map((n) => ({
        ...n,
        ...polarToXY(n.angle, n.radius),
      })),
    [],
  );

  return (
    <section className="glass relative overflow-hidden p-3 md:p-4" aria-label="Jarvis topology">
      <div className="mb-2 flex items-center justify-between px-1">
        <div>
          <h2 className="display-font text-[11px] text-[var(--electric)]">JARVIS CORE</h2>
          <p className="mono text-[10px] text-[var(--text-muted)]">
            OPERATING LAYER · SYSTEM + AGENT ORBIT
          </p>
        </div>
        {inFocus && (
          <button type="button" className="btn-ghost" onClick={clearFocus}>
            Exit focus
          </button>
        )}
      </div>

      <div className="relative mx-auto aspect-square w-full max-w-[640px]">
        <svg viewBox="0 0 100 100" className="h-full w-full" role="img" aria-label="Jarvis neural orbit">
          <defs>
            <radialGradient id="coreEnergy" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(94,234,212,0.55)" />
              <stop offset="40%" stopColor="rgba(56,189,248,0.18)" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
            <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.2" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* ambient rings */}
          <circle
            cx="50"
            cy="50"
            r="38"
            fill="none"
            stroke="rgba(125,211,252,0.1)"
            strokeWidth="0.2"
            className="ring-rotate"
            strokeDasharray="2 4"
          />
          <circle
            cx="50"
            cy="50"
            r="20"
            fill="none"
            stroke="rgba(94,234,212,0.12)"
            strokeWidth="0.2"
            className="ring-rotate-rev"
            strokeDasharray="1 3"
          />

          <circle
            cx="50"
            cy="50"
            r={busy || activeCommandId ? 26 : 22}
            fill="url(#coreEnergy)"
            className="core-pulse os-fade"
            style={{ opacity: inFocus && focus?.kind !== "system" ? 0.85 : 1 }}
          />

          {/* system links */}
          {systems.map((n) => {
            const dimmed = inFocus && focusedId !== n.id;
            const hot = focusedId === n.id;
            return (
              <line
                key={`sl-${n.id}`}
                x1={CORE_NODE.x}
                y1={CORE_NODE.y}
                x2={n.x}
                y2={n.y}
                stroke={hot ? statusStroke(n.status) : "rgba(125,211,252,0.22)"}
                strokeWidth={hot ? 0.55 : 0.28}
                className={`orbit-line os-fade ${dimmed ? "opacity-15" : "opacity-100"}`}
                style={{ opacity: dimmed ? 0.12 : 1 }}
              />
            );
          })}

          {/* agent links */}
          {agents.map((n) => {
            const dimmed = inFocus && !(focus?.kind === "agent" && focus.id === n.id);
            const hot = focus?.kind === "agent" && focus.id === n.id;
            return (
              <line
                key={`al-${n.id}`}
                x1={CORE_NODE.x}
                y1={CORE_NODE.y}
                x2={n.x}
                y2={n.y}
                stroke={hot ? "rgba(94,234,212,0.8)" : "rgba(94,234,212,0.2)"}
                strokeWidth={hot ? 0.45 : 0.22}
                className="os-fade"
                style={{ opacity: dimmed ? 0.1 : 0.85 }}
              />
            );
          })}

          {/* core */}
          <g
            filter="url(#softGlow)"
            className="cursor-pointer"
            onClick={() => clearFocus()}
            role="button"
            aria-label="Jarvis core"
          >
            <circle
              cx={CORE_NODE.x}
              cy={CORE_NODE.y}
              r="8"
              fill="rgba(2,4,10,0.92)"
              stroke="rgba(94,234,212,0.9)"
              strokeWidth="0.65"
            />
            <circle
              cx={CORE_NODE.x}
              cy={CORE_NODE.y}
              r="5.2"
              fill="none"
              stroke="rgba(125,211,252,0.35)"
              strokeWidth="0.3"
            />
            <text
              x={CORE_NODE.x}
              y={CORE_NODE.y + 1.4}
              textAnchor="middle"
              fill="#5eead4"
              fontSize="3.4"
              fontFamily="var(--font-orbitron)"
            >
              J
            </text>
          </g>

          {/* agents */}
          {agents.map((n) => {
            const hot = focus?.kind === "agent" && focus.id === n.id;
            const dimmed = inFocus && !hot;
            return (
              <g
                key={n.id}
                className="cursor-pointer os-fade"
                style={{ opacity: dimmed ? 0.18 : 1 }}
                onClick={() => setFocus({ kind: "agent", id: n.id })}
              >
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={hot ? 3.6 : 2.8}
                  fill={hot ? "rgba(94,234,212,0.25)" : "rgba(8,14,28,0.95)"}
                  stroke={hot ? "#5eead4" : "rgba(94,234,212,0.45)"}
                  strokeWidth={hot ? 0.55 : 0.3}
                />
                <text
                  x={n.x}
                  y={n.y + 5.8}
                  textAnchor="middle"
                  fill={hot ? "#e6eef8" : "#7d91a8"}
                  fontSize="2.4"
                >
                  {n.label}
                </text>
              </g>
            );
          })}

          {/* systems */}
          {systems.map((n) => {
            const hot = focus?.kind === "system" && focus.id === n.id;
            const dimmed = inFocus && !hot;
            return (
              <g
                key={n.id}
                className="cursor-pointer os-fade"
                style={{ opacity: dimmed ? 0.14 : 1 }}
                onClick={() => setFocus({ kind: "system", id: n.id })}
              >
                <rect
                  x={n.x - 3.2}
                  y={n.y - 3.2}
                  width="6.4"
                  height="6.4"
                  rx="0.6"
                  fill={hot ? "rgba(56,189,248,0.22)" : "rgba(8,14,28,0.95)"}
                  stroke={hot ? statusStroke(n.status) : statusStroke(n.status)}
                  strokeWidth={hot ? 0.55 : 0.32}
                  transform={`rotate(45 ${n.x} ${n.y})`}
                />
                <text
                  x={n.x}
                  y={n.y + 7.8}
                  textAnchor="middle"
                  fill={hot ? "#e6eef8" : "#9fb2c7"}
                  fontSize="2.6"
                >
                  {n.label}
                </text>
                <text
                  x={n.x}
                  y={n.y + 10.4}
                  textAnchor="middle"
                  fill="#7d91a8"
                  fontSize="1.9"
                >
                  {systemStatusLabel(n.status)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}
