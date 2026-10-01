"use client";

import { useJarvis } from "@/components/jarvis/JarvisProvider";
import { SYSTEM_ORBIT } from "@/lib/registry/projects";

/** Single subtle attention indicator — not a status strip */
export function AttentionDot() {
  const { approvals, setContextPanel, showAttention } = useJarvis();
  const attention = SYSTEM_ORBIT.filter((s) => s.status === "degraded").length;
  const pending = approvals.filter((a) => a.status === "pending").length;
  const count = attention + pending;
  if (count === 0) return null;

  return (
    <button
      type="button"
      className="attention-dot"
      aria-label={`${count} items need attention`}
      onClick={() => {
        if (pending > 0) setContextPanel("approvals");
        else void showAttention();
      }}
    >
      <span className="attention-dot-mark" />
      <span className="attention-dot-count">{count}</span>
    </button>
  );
}
