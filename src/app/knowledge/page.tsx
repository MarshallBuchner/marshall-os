import { DEMO_KNOWLEDGE } from "@/lib/demo/fixtures";
import { formatTime } from "@/lib/utils";

export default function KnowledgePage() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="display-font text-xl text-[var(--electric)]">KNOWLEDGE</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          UI and types for a future knowledge layer. Demo nodes only — no vector DB wired yet.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {DEMO_KNOWLEDGE.map((k) => (
          <article key={k.id} className="glass p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="chip pointer-events-none">{k.kind}</span>
              <span className="badge-demo">{k.source}</span>
            </div>
            <h2 className="mt-3 text-sm font-medium">{k.title}</h2>
            <p className="mt-2 text-xs text-[var(--text-muted)]">{k.summary}</p>
            <div className="mt-3 flex flex-wrap gap-1">
              {k.tags.map((t) => (
                <span key={t} className="mono text-[10px] text-[var(--cyan)]">
                  #{t}
                </span>
              ))}
            </div>
            <p className="mt-3 mono text-[10px] text-[var(--text-muted)]">
              {k.projectId ?? "global"} · {formatTime(k.updatedAt)}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
