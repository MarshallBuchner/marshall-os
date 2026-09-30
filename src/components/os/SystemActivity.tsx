"use client";

import { useJarvis } from "@/components/jarvis/JarvisProvider";
import { formatTime } from "@/lib/utils";
import type { ActivityEvent } from "@/types";

export function SystemActivity({ seed }: { seed: ActivityEvent[] }) {
  const { activity } = useJarvis();
  const items = (activity.length ? activity : seed).slice(0, 14);

  return (
    <section className="glass flex h-full flex-col p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="display-font text-[11px] text-[var(--electric)]">SYSTEM ACTIVITY</h2>
          <p className="mono text-[10px] text-[var(--text-muted)]">EVENT BUS · AUDIT STREAM</p>
        </div>
        <span className="badge-demo">DEMO / SIM</span>
      </div>
      <ul className="flex-1 space-y-0 overflow-y-auto scrollbar-thin">
        {items.map((e) => (
          <li
            key={e.id}
            className="border-b border-[var(--border)]/70 py-2.5 first:pt-0 last:border-0"
          >
            <div className="flex items-start gap-2">
              <span
                className={`mt-1.5 status-dot shrink-0 ${
                  e.severity === "success"
                    ? "bg-[var(--health)]"
                    : e.severity === "warning"
                      ? "bg-[var(--warn)]"
                      : e.severity === "critical"
                        ? "bg-[var(--danger)]"
                        : "bg-[var(--cyan)]"
                }`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-[var(--text)]">{e.what}</span>
                  <span className="badge-demo">{e.source}</span>
                </div>
                <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                  {e.who} · {e.why}
                </p>
                <p className="mono text-[10px] text-[var(--text-muted)]">
                  Δ {e.whatChanged}
                  {e.approved !== null ? ` · approved=${e.approved}` : ""} ·{" "}
                  {formatTime(e.timestamp)}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
