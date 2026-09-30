import { DEMO_AUTOMATIONS } from "@/lib/demo/fixtures";

export default function AutomationsPage() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="display-font text-xl text-[var(--electric)]">AUTOMATIONS</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Example scheduled / event / condition tasks only. No unrestricted autonomous scheduler in V0.
        </p>
      </header>

      <div className="glass border-[var(--warn)]/30 p-4 text-xs text-[var(--warn)]">
        All automations are <strong>exampleOnly</strong> and disabled. Enabling unrestricted autonomous
        control is out of scope for V0.
      </div>

      <div className="grid gap-4">
        {DEMO_AUTOMATIONS.map((a) => (
          <article key={a.id} className="glass p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-medium">{a.name}</h2>
              <div className="flex items-center gap-2">
                <span className="chip pointer-events-none">{a.type}</span>
                <span className="badge-demo">EXAMPLE ONLY</span>
                <span className="mono text-[10px] text-[var(--text-muted)]">
                  {a.enabled ? "enabled" : "disabled"}
                </span>
              </div>
            </div>
            <p className="mt-2 text-xs text-[var(--text-muted)]">{a.description}</p>
            <dl className="mt-3 grid gap-2 text-[11px] sm:grid-cols-2">
              <div>
                <dt className="muted">Trigger</dt>
                <dd className="mono">{a.trigger}</dd>
              </div>
              <div>
                <dt className="muted">Action</dt>
                <dd className="mono">{a.action}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </div>
  );
}
