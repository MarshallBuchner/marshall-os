"use client";

import { useJarvis } from "@/components/jarvis/JarvisProvider";
import { CommandConsole } from "@/components/os/CommandConsole";
import { AttentionBoard } from "@/components/os/AttentionBoard";
import { SystemActivity } from "@/components/os/SystemActivity";
import { ApprovalCenter } from "@/components/jarvis/ApprovalCenter";
import { SYSTEM_ORBIT, systemStatusLabel } from "@/lib/registry/projects";
import type { ActivityEvent } from "@/types";

const TABS = [
  { id: "ask", label: "Ask" },
  { id: "attention", label: "Attention" },
  { id: "systems", label: "Systems" },
  { id: "activity", label: "Activity" },
  { id: "approvals", label: "Approvals" },
] as const;

export function MobileRemote({ activitySeed }: { activitySeed: ActivityEvent[] }) {
  const { mobileTab, setMobileTab, setFocus } = useJarvis();

  return (
    <div className="lg:hidden">
      <div className="glass sticky top-[52px] z-30 mb-3 flex gap-1 overflow-x-auto p-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`shrink-0 px-3 py-1.5 text-xs ${
              mobileTab === t.id
                ? "border border-[var(--border-strong)] text-[var(--electric)]"
                : "text-[var(--text-muted)]"
            }`}
            onClick={() => setMobileTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {mobileTab === "ask" && <CommandConsole />}
      {mobileTab === "attention" && <AttentionBoard />}
      {mobileTab === "systems" && (
        <section className="glass p-4">
          <h2 className="display-font text-[11px] text-[var(--electric)]">SYSTEMS</h2>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Mobile remote — tap to focus (topology hidden).
          </p>
          <ul className="mt-3 space-y-2">
            {SYSTEM_ORBIT.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between border border-[var(--border)] px-3 py-2 text-left"
                  onClick={() => setFocus({ kind: "system", id: s.id })}
                >
                  <span>
                    <span className="text-sm">{s.label}</span>
                    <span className="ml-2 mono text-[10px] text-[var(--text-muted)]">
                      {s.category}
                    </span>
                  </span>
                  <span className="mono text-[10px]">{systemStatusLabel(s.status)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {mobileTab === "activity" && <SystemActivity seed={activitySeed} />}
      {mobileTab === "approvals" && <ApprovalCenter />}
    </div>
  );
}
