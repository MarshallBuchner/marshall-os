"use client";

import dynamic from "next/dynamic";
import { useJarvis } from "@/components/jarvis/JarvisProvider";
import { visualStateLabel } from "@/lib/jarvis/visualState";

const SpatialScene = dynamic(
  () =>
    import("@/components/os/spatial/SpatialScene").then((m) => m.SpatialScene),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center mono text-[11px] text-[var(--text-muted)]">
        Initializing Jarvis…
      </div>
    ),
  },
);

/** Hero Jarvis environment — circular core dominant; modules contextual */
export function SpatialCore() {
  const { visualState, clearFocus, focus, activeCommandId, commands } = useJarvis();
  const active = commands.find((c) => c.id === activeCommandId);

  return (
    <section
      className="jarvis-hero-viewport relative w-full overflow-hidden"
      aria-label="Jarvis core environment"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between px-4 pt-3">
        <div>
          <p className="display-font text-[10px] text-[var(--electric)]">JARVIS</p>
          <p className="mono text-[9px] text-[var(--text-muted)]">
            {visualStateLabel(visualState)} · LOCAL / DEMO
          </p>
        </div>
        {focus && (
          <button
            type="button"
            className="btn-ghost pointer-events-auto bg-[rgba(2,4,10,0.55)]"
            onClick={clearFocus}
          >
            Return
          </button>
        )}
      </div>

      {active && activeCommandId && (
        <div className="pointer-events-none absolute left-4 top-12 z-10 max-w-xs border border-[var(--border)] bg-[rgba(3,6,12,0.75)] px-3 py-2 backdrop-blur-md">
          <div className="badge-demo mb-1">SIMULATED</div>
          <p className="mono text-[10px] text-[var(--text-muted)]">
            {active.intent?.type ?? "CMD"} → {active.routedProjectId ?? "—"}
            {active.routedAgentId ? ` via ${active.routedAgentId}` : ""} ·{" "}
            {active.status.replace(/_/g, " ")}
          </p>
        </div>
      )}

      <div className="absolute inset-0">
        <SpatialScene />
      </div>
    </section>
  );
}
