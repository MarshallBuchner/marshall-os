import { listAdapters } from "@/lib/adapters";

export default function SystemsPage() {
  const adapters = listAdapters();

  return (
    <div className="space-y-5">
      <header>
        <h1 className="display-font text-xl text-[var(--electric)]">SYSTEMS</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Integration adapters and health. V0 is honest: most integrations are not configured.
        </p>
      </header>

      <div className="glass p-4 text-xs text-[var(--text-muted)]">
        Privileged credentials must never appear in client code. Adapter <span className="mono">execute()</span>{" "}
        and <span className="mono">healthCheck()</span> run server-side and refuse live calls until configured.
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {adapters.map((a) => (
          <article key={a.id} className="glass p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm">{a.name}</h2>
              <span className="mono text-[10px] uppercase text-[var(--warn)]">
                {a.connectionStatus.replace("_", " ")}
              </span>
            </div>
            <p className="mt-2 text-[11px] text-[var(--text-muted)]">
              Capabilities: {a.capabilities.join(", ")}
            </p>
            <p className="mt-3 text-xs text-[var(--warn)]">Not configured</p>
          </article>
        ))}
      </div>
    </div>
  );
}
