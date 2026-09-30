"use client";

import { TopNav } from "@/components/layout/TopNav";
import { JarvisProvider } from "@/components/jarvis/JarvisProvider";
import { JarvisPanel } from "@/components/jarvis/JarvisPanel";
import { ApprovalCenter } from "@/components/jarvis/ApprovalCenter";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <JarvisProvider>
      <div className="mos-shell flex min-h-screen flex-col">
        <TopNav />
        <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-5 md:px-6 md:py-6">
          {children}
        </main>
        <JarvisPanel />
        <div className="mx-auto w-full max-w-[1600px] px-4 pb-8 md:px-6">
          <ApprovalCenter />
        </div>
        <footer className="border-t border-[var(--border)] px-4 py-3 text-center mono text-[10px] text-[var(--text-muted)]">
          MARSHALL OS V0 · DEMO_MODE · JARVIS orchestration (simulated) · No live trading · No L4 execution
        </footer>
      </div>
    </JarvisProvider>
  );
}
