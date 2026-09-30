"use client";

import { timeGreeting } from "@/lib/utils";
import { DEMO_ATTENTION } from "@/lib/demo/fixtures";
import { useJarvis } from "@/components/jarvis/JarvisProvider";
import type { Project } from "@/types";

export function StatusStrip({
  projects,
  systemsOnline,
}: {
  projects: Project[];
  systemsOnline: number;
}) {
  const { approvals, setMobileTab, setConsoleOpen } = useJarvis();
  const attention = DEMO_ATTENTION.length;
  const pending = approvals.filter((a) => a.status === "pending").length;
  const jarvisCan = DEMO_ATTENTION.filter((a) => a.jarvisCanHandle).length;
  const degraded = projects.filter((p) => p.status === "degraded").length;

  return (
    <section className="glass px-4 py-4 md:px-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="display-font text-base text-[var(--text)] md:text-xl">
            {timeGreeting()}
          </p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Personal AI operating environment — Jarvis is the layer, not a module.
          </p>
        </div>
        <span className="badge-demo">DEMO_MODE</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <button
          type="button"
          className="border border-[var(--border)] p-3 text-left"
          onClick={() => {
            setMobileTab("activity");
            document.getElementById("system-activity")?.scrollIntoView({ behavior: "smooth" });
          }}
        >
          <div className="mono text-[9px] tracking-widest text-[var(--text-muted)]">HAPPENING</div>
          <div className="mt-1 text-sm">
            {systemsOnline}/{projects.length} systems nominal-or-watched
          </div>
          <div className="mono text-[10px] text-[var(--text-muted)]">
            {degraded} degraded (demo)
          </div>
        </button>
        <button
          type="button"
          className="border border-[var(--border)] p-3 text-left"
          onClick={() => {
            setMobileTab("attention");
            document.getElementById("attention")?.scrollIntoView({ behavior: "smooth" });
          }}
        >
          <div className="mono text-[9px] tracking-widest text-[var(--text-muted)]">NEEDS YOU</div>
          <div className="mt-1 text-sm text-[var(--warn)]">{attention} attention items</div>
          <div className="mono text-[10px] text-[var(--text-muted)]">{pending} approvals</div>
        </button>
        <button
          type="button"
          className="border border-[var(--border)] p-3 text-left"
          onClick={() => setConsoleOpen(true)}
        >
          <div className="mono text-[9px] tracking-widest text-[var(--text-muted)]">
            JARVIS CAN HANDLE
          </div>
          <div className="mt-1 text-sm text-[var(--health)]">{jarvisCan} of {attention}</div>
          <div className="mono text-[10px] text-[var(--text-muted)]">read / route / simulate</div>
        </button>
        <div className="border border-[var(--border)] p-3">
          <div className="mono text-[9px] tracking-widest text-[var(--text-muted)]">
            SYSTEMS DOING
          </div>
          <div className="mt-1 text-sm">Registry + demo fixtures</div>
          <div className="mono text-[10px] text-[var(--text-muted)]">
            No live adapters connected
          </div>
        </div>
      </div>
    </section>
  );
}
