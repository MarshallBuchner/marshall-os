export function timeGreeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return "Good morning, Marshall.";
  if (h < 17) return "Good afternoon, Marshall.";
  return "Good evening, Marshall.";
}

export function formatTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      month: "short",
      day: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function statusColor(status: string): string {
  switch (status) {
    case "online":
    case "ready":
    case "COMPLETED":
    case "success":
      return "var(--health)";
    case "degraded":
    case "busy":
    case "WAITING_APPROVAL":
    case "warning":
    case "PLANNED":
    case "RUNNING":
      return "var(--warn)";
    case "offline":
    case "FAILED":
    case "critical":
    case "error":
      return "var(--danger)";
    default:
      return "var(--cyan)";
  }
}
