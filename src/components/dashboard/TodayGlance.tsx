import type { ScheduleItem } from "@/types";
import { formatTime } from "@/lib/utils";

export function TodayGlance({ items }: { items: ScheduleItem[] }) {
  return (
    <section className="glass p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="display-font text-sm text-[var(--electric)]">TODAY AT A GLANCE</h2>
        <span className="mono text-[10px] text-[var(--text-muted)]">
          Calendar adapter ready · not configured
        </span>
      </div>
      <ul className="space-y-2">
        {items.map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between gap-3 border border-[var(--border)] px-3 py-2"
          >
            <div>
              <div className="text-xs">{s.title}</div>
              <div className="mono text-[10px] text-[var(--text-muted)]">
                {s.projectId ?? "general"} · {s.source}
              </div>
            </div>
            <div className="mono shrink-0 text-[10px] text-[var(--cyan)]">
              {formatTime(s.start)}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
