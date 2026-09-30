"use client";

import { useJarvis } from "@/components/jarvis/JarvisProvider";
import { timeGreeting } from "@/lib/utils";

type Props = {
  systemsOnline: number;
  systemsTotal: number;
  attention: number;
};

const SUGGESTIONS = [
  "What needs my attention?",
  "Check QuantLab performance",
  "Show new POWR activity",
  "Summarize today's progress",
];

export function HeroCommand({ systemsOnline, systemsTotal, attention }: Props) {
  const { submit, setPanelOpen, busy } = useJarvis();

  return (
    <section className="glass p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="display-font text-lg text-[var(--text)] md:text-2xl">
            {timeGreeting()}
          </p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            <span className="health-text mono">{systemsOnline}</span>
            <span className="mono text-[var(--text-muted)]">/{systemsTotal}</span> systems
            online
            <span className="mx-2 text-[var(--border-strong)]">·</span>
            <span className="mono text-[var(--warn)]">{attention}</span> items need attention
            <span className="badge-demo ml-2">Demo metrics</span>
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setPanelOpen(true)}>
          Open Jarvis
        </button>
      </div>

      <form
        className="mt-5"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const input = String(fd.get("q") ?? "");
          e.currentTarget.reset();
          void submit(input).then(() => setPanelOpen(true));
        }}
      >
        <label className="mono mb-2 block text-[10px] tracking-[0.18em] text-[var(--text-muted)]">
          PRIMARY COMMAND FIELD
        </label>
        <input
          name="q"
          className="input-command"
          placeholder="Ask Jarvis anything…"
          disabled={busy}
        />
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            className="chip"
            disabled={busy}
            onClick={() => {
              void submit(s).then(() => setPanelOpen(true));
            }}
          >
            {s}
          </button>
        ))}
      </div>
    </section>
  );
}
