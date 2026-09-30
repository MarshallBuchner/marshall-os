"use client";

import { useJarvis } from "@/components/jarvis/JarvisProvider";

export function ProjectCommandPad({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const { submit, setPanelOpen, busy } = useJarvis();

  const prompts = [
    `Check ${projectName} status`,
    `Summarize ${projectName} progress`,
    `What needs attention on ${projectName}?`,
  ];

  if (projectId === "quantlab") {
    prompts.push("Have Cursor investigate QuantLab's mobile dashboard.");
  }

  return (
    <section className="glass p-4">
      <h2 className="display-font mb-2 text-sm text-[var(--electric)]">PROJECT JARVIS</h2>
      <p className="mb-3 text-xs text-[var(--text-muted)]">
        Commands route through the shared Jarvis pipeline (server-side). Simulated results only.
      </p>
      <div className="flex flex-wrap gap-2">
        {prompts.map((p) => (
          <button
            key={p}
            type="button"
            className="chip"
            disabled={busy}
            onClick={() => {
              void submit(p).then(() => setPanelOpen(true));
            }}
          >
            {p}
          </button>
        ))}
      </div>
    </section>
  );
}
