"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CORE_NODE, TOPOLOGY_NODES, getProject } from "@/lib/registry/projects";

type Props = {
  onAsk?: (prompt: string) => void;
};

export function JarvisCore({ onAsk }: Props) {
  const [active, setActive] = useState<string | null>(null);
  const detail = useMemo(() => {
    if (!active || active === "jarvis" || active === "github") {
      if (active === "github") {
        return {
          title: "GitHub",
          body: "Integration adapter placeholder — Not configured. No API calls.",
          href: "/systems",
        };
      }
      if (active === "jarvis") {
        return {
          title: "JARVIS Core",
          body: "Orchestration nucleus. Routes commands through intent → permission → simulated adapters.",
          href: undefined,
        };
      }
      return null;
    }
    const p = getProject(active);
    if (!p) return null;
    return {
      title: p.name,
      body: `${p.category} · ${p.status} · health ${p.demoMetrics.health}% (demo)`,
      href: `/projects/${p.id}`,
    };
  }, [active]);

  return (
    <section className="glass relative overflow-hidden p-4 md:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="display-font text-sm text-[var(--electric)]">JARVIS CORE</h2>
        <span className="mono text-[10px] text-[var(--text-muted)]">TOPOLOGY · CSS/SVG</span>
      </div>

      <div className="relative mx-auto aspect-[4/3] w-full max-w-xl">
        <svg viewBox="0 0 100 100" className="h-full w-full" role="img" aria-label="Jarvis topology">
          <defs>
            <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(34,211,238,0.45)" />
              <stop offset="70%" stopColor="rgba(14,165,233,0.08)" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
          </defs>

          <circle cx="50" cy="50" r="28" fill="url(#coreGlow)" className="core-pulse" />

          {TOPOLOGY_NODES.map((n) => (
            <line
              key={`l-${n.id}`}
              x1={CORE_NODE.x}
              y1={CORE_NODE.y}
              x2={n.x}
              y2={n.y}
              stroke={active === n.id ? "rgba(34,211,238,0.85)" : "rgba(56,189,248,0.28)"}
              strokeWidth={active === n.id ? 0.6 : 0.35}
              className="orbit-line"
            />
          ))}

          <g
            className="cursor-pointer"
            onClick={() => setActive("jarvis")}
            onMouseEnter={() => setActive("jarvis")}
          >
            <circle
              cx={CORE_NODE.x}
              cy={CORE_NODE.y}
              r="7"
              fill="rgba(3,6,13,0.9)"
              stroke="rgba(34,211,238,0.9)"
              strokeWidth="0.7"
            />
            <text
              x={CORE_NODE.x}
              y={CORE_NODE.y + 1.2}
              textAnchor="middle"
              fill="#22d3ee"
              fontSize="3.2"
              fontFamily="var(--font-orbitron)"
            >
              J
            </text>
          </g>

          {TOPOLOGY_NODES.map((n) => {
            const highlighted = active === n.id;
            return (
              <g
                key={n.id}
                className="cursor-pointer"
                onClick={() => setActive(n.id)}
                onMouseEnter={() => setActive(n.id)}
                onMouseLeave={() => setActive((a) => (a === n.id ? a : a))}
              >
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={highlighted ? 4.2 : 3.4}
                  fill={highlighted ? "rgba(14,165,233,0.35)" : "rgba(10,18,36,0.95)"}
                  stroke={highlighted ? "#22d3ee" : "rgba(56,189,248,0.55)"}
                  strokeWidth={highlighted ? 0.7 : 0.4}
                />
                <text
                  x={n.x}
                  y={n.y + 7.5}
                  textAnchor="middle"
                  fill={highlighted ? "#e8f1ff" : "#8ba3c7"}
                  fontSize="3"
                >
                  {n.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {detail && (
        <div className="mt-2 border border-[var(--border)] bg-[rgba(3,6,13,0.5)] p-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm text-[var(--electric)]">{detail.title}</h3>
            {detail.href && (
              <Link href={detail.href} className="btn-ghost">
                Open
              </Link>
            )}
          </div>
          <p className="mt-1 text-xs text-[var(--text-muted)]">{detail.body}</p>
          {onAsk && detail.title !== "JARVIS Core" && (
            <button
              type="button"
              className="chip mt-2"
              onClick={() => onAsk(`Check ${detail.title} status`)}
            >
              Ask Jarvis about {detail.title}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
