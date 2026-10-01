"use client";

import dynamic from "next/dynamic";
import { useJarvis } from "@/components/jarvis/JarvisProvider";

const SpatialScene = dynamic(
  () =>
    import("@/components/os/spatial/SpatialScene").then((m) => m.SpatialScene),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center mono text-[11px] text-[var(--text-muted)]">
        Opening command environment…
      </div>
    ),
  },
);

/**
 * Immersive spatial command viewport — glass modules in a dark computational room.
 * Not a boxed diagram. Detail/metrics remain in DOM FocusPanel.
 */
export function SpatialCore() {
  const { focus, clearFocus, activeCommandId, commands } = useJarvis();
  const active = commands.find((c) => c.id === activeCommandId);

  return (
    <section
      className="spatial-viewport relative w-full overflow-hidden"
      aria-label="Jarvis spatial command environment"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between px-4 pt-3 md:px-5">
        <div>
          <h2 className="display-font text-[11px] text-[var(--electric)]">
            JARVIS ENVIRONMENT
          </h2>
          <p className="mono text-[10px] text-[var(--text-muted)]">
            SPATIAL COMMAND · APPROACH TO INSPECT
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

      {active && (
        <div className="pointer-events-none absolute left-4 top-14 z-10 max-w-sm border border-[var(--border)] bg-[rgba(3,6,12,0.72)] px-3 py-2 backdrop-blur-md">
          <div className="badge-demo mb-1">SIMULATED ROUTE</div>
          <p className="mono text-[10px] text-[var(--text-muted)]">
            {active.intent?.type ?? "CMD"} → {active.routedProjectId ?? "—"} via{" "}
            {active.routedAgentId ?? "internal"} · {active.status.replace(/_/g, " ")}
          </p>
        </div>
      )}

      <div className="spatial-canvas-host absolute inset-0">
        <SpatialScene />
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-[rgba(2,5,10,0.9)] to-transparent px-4 pb-3 pt-14">
        <p className="mono text-[10px] text-[var(--text-muted)]">
          Modules rest distant · select to approach · Jarvis is the field, not a logo
        </p>
      </div>
    </section>
  );
}
