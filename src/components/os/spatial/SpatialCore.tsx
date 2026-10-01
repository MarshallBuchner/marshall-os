"use client";

import dynamic from "next/dynamic";
import { useJarvis } from "@/components/jarvis/JarvisProvider";

const SpatialScene = dynamic(
  () =>
    import("@/components/os/spatial/SpatialScene").then((m) => m.SpatialScene),
  {
    ssr: false,
    loading: () => <div className="h-full w-full bg-[#02050a]" />,
  },
);

/** Full-bleed Jarvis environment — no debug chrome on idle */
export function SpatialCore() {
  const { activeCommandId, commands, visualState } = useJarvis();
  const active = commands.find((c) => c.id === activeCommandId);
  const showRoute =
    Boolean(active && activeCommandId) &&
    (visualState === "ROUTING" ||
      visualState === "WAITING_APPROVAL" ||
      visualState === "EXECUTING" ||
      visualState === "UNDERSTANDING");

  return (
    <section className="jarvis-hero-viewport" aria-label="Jarvis core environment">
      {showRoute && active && (
        <div className="route-whisper" aria-live="polite">
          <span className="mono text-[9px] tracking-[0.14em] text-[var(--text-muted)]">
            {active.routedProjectId ?? "—"}
            {active.routedAgentId ? ` · ${active.routedAgentId}` : ""}
          </span>
        </div>
      )}
      <div className="absolute inset-0">
        <SpatialScene />
      </div>
    </section>
  );
}
