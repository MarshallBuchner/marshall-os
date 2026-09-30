"use client";

import { DEMO_ATTENTION } from "@/lib/demo/fixtures";
import { useJarvis } from "@/components/jarvis/JarvisProvider";
import { formatTime } from "@/lib/utils";

function severityColor(s: string) {
  switch (s) {
    case "critical":
    case "high":
      return "var(--danger)";
    case "medium":
      return "var(--warn)";
    default:
      return "var(--cyan)";
  }
}

export function AttentionBoard() {
  const { submit, setConsoleOpen, setFocus, busy } = useJarvis();
  const items = DEMO_ATTENTION;

  return (
    <section className="glass p-4" id="attention">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="display-font text-[11px] text-[var(--electric)]">
            JARVIS <span className="text-[var(--text-muted)]">{"//"}</span> ATTENTION
          </h2>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            What needs you — severity, system, reason, recommended action, Jarvis capability.
          </p>
        </div>
        <span className="badge-demo">DEMO FIXTURES</span>
      </div>

      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className="border border-[var(--border)] bg-[rgba(2,4,10,0.35)] p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="mono text-[10px] uppercase tracking-wider"
                style={{ color: severityColor(item.severity) }}
              >
                {item.severity}
              </span>
              <button
                type="button"
                className="text-sm text-[var(--electric)] hover:underline"
                onClick={() => setFocus({ kind: "system", id: item.systemId })}
              >
                {item.systemName}
              </button>
              <span className="ml-auto mono text-[10px] text-[var(--text-muted)]">
                {formatTime(item.timestamp)}
              </span>
            </div>
            <p className="mt-2 text-xs text-[var(--text)]">{item.reason}</p>
            <p className="mt-2 text-[11px] text-[var(--text-muted)]">
              <span className="text-[var(--cyan)]">Recommended:</span> {item.recommendedAction}
            </p>
            <p className="mt-1 text-[11px]">
              <span className={item.jarvisCanHandle ? "text-[var(--health)]" : "text-[var(--warn)]"}>
                {item.jarvisCanHandle ? "Jarvis can handle" : "Needs you"}
              </span>
              <span className="text-[var(--text-muted)]"> — {item.handleNote}</span>
            </p>
            {item.jarvisCanHandle && (
              <button
                type="button"
                className="chip mt-2"
                disabled={busy}
                onClick={() => {
                  setConsoleOpen(true);
                  void submit(
                    item.systemId === "quantlab"
                      ? "Have Cursor investigate QuantLab's mobile dashboard."
                      : `Check ${item.systemName} status`,
                  );
                }}
              >
                Ask Jarvis
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
