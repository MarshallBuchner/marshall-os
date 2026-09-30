"use client";

import { useJarvis } from "@/components/jarvis/JarvisProvider";
import { formatTime } from "@/lib/utils";
import type { ActivityEvent } from "@/types";

export function ActivityFeed({ seed }: { seed: ActivityEvent[] }) {
  const { activity } = useJarvis();
  const items = (activity.length ? activity : seed).slice(0, 12);

  return (
    <section className="glass flex h-full flex-col p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="display-font text-sm text-[var(--electric)]">LIVE ACTIVITY</h2>
        <span className="badge-demo">Fixtures + sim</span>
      </div>
      <ul className="flex-1 space-y-3 overflow-y-auto scrollbar-thin">
        {items.map((e) => (
          <li key={e.id} className="border-l-2 border-[var(--border-strong)] pl-3">
            <div className="flex items-center gap-2">
              <span
                className={`status-dot ${
                  e.severity === "success"
                    ? "bg-[var(--health)]"
                    : e.severity === "warning"
                      ? "bg-[var(--warn)]"
                      : e.severity === "critical"
                        ? "bg-[var(--danger)]"
                        : "bg-[var(--cyan)]"
                }`}
              />
              <span className="text-xs text-[var(--text)]">{e.what}</span>
            </div>
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">
              {e.who} · {e.why}
            </p>
            <p className="mono text-[10px] text-[var(--text-muted)]">
              {formatTime(e.timestamp)} · {e.source}
              {e.approved !== null && ` · approved=${e.approved}`}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
