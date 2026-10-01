"use client";

import { useJarvis } from "@/components/jarvis/JarvisProvider";
import { SYSTEM_ORBIT } from "@/lib/registry/projects";
import { visualStateLabel } from "@/lib/jarvis/visualState";

/** Sparse home status — not a permanent dashboard strip */
export function MinimalStatus({
  systemsOnline,
  totalSystems,
}: {
  systemsOnline: number;
  totalSystems: number;
}) {
  const { approvals, visualState, showAttention, setContextPanel } = useJarvis();
  const pending = approvals.filter((a) => a.status === "pending").length;
  const attention = SYSTEM_ORBIT.filter((s) => s.status === "degraded").length;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3">
      <span className="badge-demo">DEMO_MODE</span>
      <span className="mono text-[10px] text-[var(--text-muted)]">
        {visualStateLabel(visualState)}
      </span>
      <button
        type="button"
        className="chip"
        onClick={() => void showAttention()}
      >
        {attention} attention
      </button>
      <button
        type="button"
        className="chip"
        onClick={() => setContextPanel("focus")}
      >
        {systemsOnline}/{totalSystems} systems
      </button>
      {pending > 0 && (
        <button
          type="button"
          className="chip text-[var(--warn)]"
          onClick={() => setContextPanel("approvals")}
        >
          {pending} approval{pending === 1 ? "" : "s"}
        </button>
      )}
    </div>
  );
}
