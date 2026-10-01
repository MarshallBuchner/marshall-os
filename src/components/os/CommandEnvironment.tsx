"use client";

import { StatusStrip } from "@/components/os/StatusStrip";
import { CommandConsole } from "@/components/os/CommandConsole";
import { SpatialCore } from "@/components/os/spatial/SpatialCore";
import { FocusPanel } from "@/components/os/FocusPanel";
import { AttentionBoard } from "@/components/os/AttentionBoard";
import { SystemActivity } from "@/components/os/SystemActivity";
import { CommandAudit } from "@/components/os/CommandAudit";
import { MobileRemote } from "@/components/os/MobileRemote";
import { ApprovalCenter } from "@/components/jarvis/ApprovalCenter";
import { useJarvis } from "@/components/jarvis/JarvisProvider";
import type { ActivityEvent, Project } from "@/types";

export function CommandEnvironment({
  projects,
  systemsOnline,
  activitySeed,
}: {
  projects: Project[];
  systemsOnline: number;
  activitySeed: ActivityEvent[];
}) {
  const { focus } = useJarvis();

  return (
    <div className="space-y-4 md:space-y-5">
      <StatusStrip projects={projects} systemsOnline={systemsOnline} />

      {/* Mobile: Jarvis remote — no giant 3D topology */}
      <MobileRemote activitySeed={activitySeed} />

      {/* Desktop / tablet */}
      <div className="hidden space-y-5 lg:block">
        <CommandConsole />

        {/* Immersive spatial window + DOM context panel */}
        <div
          className={`spatial-stage grid gap-0 overflow-hidden border border-[var(--border)] bg-[rgba(2,4,10,0.4)] transition-[grid-template-columns] duration-500 ${
            focus ? "xl:grid-cols-[minmax(0,1fr)_320px]" : "xl:grid-cols-[minmax(0,1fr)_280px]"
          }`}
        >
          <SpatialCore />
          <div className="border-l border-[var(--border)] bg-[rgba(6,10,20,0.72)] backdrop-blur-md">
            <FocusPanel />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2" id="system-activity">
          <AttentionBoard />
          <SystemActivity seed={activitySeed} />
        </div>

        <CommandAudit />
        <ApprovalCenter />
      </div>

      <div className="lg:hidden">{focus && <FocusPanel />}</div>
    </div>
  );
}
