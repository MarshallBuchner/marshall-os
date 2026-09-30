"use client";

import { StatusStrip } from "@/components/os/StatusStrip";
import { CommandConsole } from "@/components/os/CommandConsole";
import { JarvisTopology } from "@/components/os/JarvisTopology";
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

      {/* Mobile: Jarvis remote — no giant topology */}
      <MobileRemote activitySeed={activitySeed} />

      {/* Desktop / tablet: full OS composition */}
      <div className="hidden space-y-5 lg:block">
        <CommandConsole />

        <div
          className={`grid gap-4 transition-[grid-template-columns] duration-500 ${
            focus ? "xl:grid-cols-[1.35fr_0.85fr]" : "xl:grid-cols-[1.5fr_0.7fr]"
          }`}
        >
          <JarvisTopology />
          <FocusPanel />
        </div>

        <div className="grid gap-4 lg:grid-cols-2" id="system-activity">
          <AttentionBoard />
          <SystemActivity seed={activitySeed} />
        </div>

        <CommandAudit />
        <ApprovalCenter />
      </div>

      {/* Focus panel on tablet when selected from mobile systems list */}
      <div className="lg:hidden">{focus && <FocusPanel />}</div>
    </div>
  );
}
