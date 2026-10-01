"use client";

import { useJarvis } from "@/components/jarvis/JarvisProvider";
import { FocusPanel } from "@/components/os/FocusPanel";
import { AttentionBoard } from "@/components/os/AttentionBoard";
import { SystemActivity } from "@/components/os/SystemActivity";
import { CommandAudit } from "@/components/os/CommandAudit";
import { ApprovalCenter } from "@/components/jarvis/ApprovalCenter";
import type { ActivityEvent } from "@/types";

/** On-demand surfaces — never permanent home furniture */
export function ContextualDrawer({ activitySeed }: { activitySeed: ActivityEvent[] }) {
  const { contextPanel, setContextPanel, focus, clearFocus } = useJarvis();

  if (contextPanel === "none") return null;

  const title =
    contextPanel === "focus"
      ? "CONTEXT"
      : contextPanel === "attention"
        ? "ATTENTION"
        : contextPanel === "activity"
          ? "ACTIVITY"
          : contextPanel === "audit"
            ? "AUDIT"
            : "APPROVALS";

  return (
    <aside
      className="contextual-drawer glass-strong fixed bottom-0 right-0 top-[52px] z-40 flex w-full max-w-md flex-col overflow-y-auto border-l border-[var(--border)] shadow-2xl md:top-[56px]"
      aria-label={title}
    >
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <h2 className="display-font text-[11px] text-[var(--electric)]">{title}</h2>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => {
            setContextPanel("none");
            if (focus) clearFocus();
          }}
        >
          Close
        </button>
      </div>
      <div className="flex-1 p-2">
        {contextPanel === "focus" && <FocusPanel />}
        {contextPanel === "attention" && <AttentionBoard />}
        {contextPanel === "activity" && <SystemActivity seed={activitySeed} />}
        {contextPanel === "audit" && <CommandAudit />}
        {contextPanel === "approvals" && <ApprovalCenter />}
      </div>
    </aside>
  );
}
