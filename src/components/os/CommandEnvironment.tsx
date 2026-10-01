"use client";

import { SpatialCore } from "@/components/os/spatial/SpatialCore";
import { AskJarvisBar } from "@/components/os/AskJarvisBar";
import { MinimalStatus } from "@/components/os/MinimalStatus";
import { ContextualDrawer } from "@/components/os/ContextualDrawer";
import { MobileRemote } from "@/components/os/MobileRemote";
import type { ActivityEvent, Project } from "@/types";

/**
 * Clean Overview home — Marshall // OS, Jarvis core, ask, minimal status.
 * Attention / Activity / Audit / Approvals appear on demand only.
 */
export function CommandEnvironment({
  projects,
  systemsOnline,
  activitySeed,
}: {
  projects: Project[];
  systemsOnline: number;
  activitySeed: ActivityEvent[];
}) {
  return (
    <div className="jarvis-home">
      {/* Mobile practical remote */}
      <MobileRemote activitySeed={activitySeed} />

      {/* Desktop: one composition — JARVIS is the interface */}
      <div className="hidden lg:block">
        <header className="mb-2 text-center">
          <h1 className="display-font text-sm tracking-[0.28em] text-[var(--electric)] md:text-base">
            MARSHALL // OS
          </h1>
          <p className="mt-1 mono text-[10px] text-[var(--text-muted)]">
            PERSONAL AI OPERATING ENVIRONMENT
          </p>
        </header>

        <div className="mb-3">
          <MinimalStatus
            systemsOnline={systemsOnline}
            totalSystems={projects.length}
          />
        </div>

        <div className="jarvis-hero-stage relative overflow-hidden border border-[var(--border)] bg-[rgba(2,4,10,0.5)]">
          <SpatialCore />
          <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-[rgba(2,5,10,0.95)] via-[rgba(2,5,10,0.75)] to-transparent pb-5 pt-24">
            <AskJarvisBar />
          </div>
        </div>
      </div>

      <ContextualDrawer activitySeed={activitySeed} />
    </div>
  );
}
