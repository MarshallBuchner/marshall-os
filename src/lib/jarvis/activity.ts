import type { ActivityEvent } from "@/types";
import { DEMO_ACTIVITY } from "@/lib/demo/fixtures";

/** In-memory activity log for this process (demo + simulated events). */
let events: ActivityEvent[] = [...DEMO_ACTIVITY];

export function listActivity(): ActivityEvent[] {
  return [...events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

export function appendActivity(
  partial: Omit<ActivityEvent, "id" | "timestamp"> & { timestamp?: string },
): ActivityEvent {
  const event: ActivityEvent = {
    id: `act-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: partial.timestamp ?? new Date().toISOString(),
    what: partial.what,
    who: partial.who,
    why: partial.why,
    whatChanged: partial.whatChanged,
    approved: partial.approved,
    severity: partial.severity,
    projectId: partial.projectId,
    source: partial.source,
  };
  events = [event, ...events];
  return event;
}
