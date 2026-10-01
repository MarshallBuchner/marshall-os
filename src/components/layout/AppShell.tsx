"use client";

import { usePathname } from "next/navigation";
import { TopNav } from "@/components/layout/TopNav";
import { JarvisProvider } from "@/components/jarvis/JarvisProvider";
import { ApprovalCenter } from "@/components/jarvis/ApprovalCenter";
import { ClientErrorBoundary } from "@/components/os/ClientErrorBoundary";
import { VoiceDebugHud } from "@/components/os/VoiceDebugHud";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isOverview = pathname === "/";

  return (
    <JarvisProvider>
      <div className={`mos-shell flex min-h-screen flex-col ${isOverview ? "shell-overview" : ""}`}>
        {/* Overview hides chrome — brand lives in the hero */}
        {!isOverview && <TopNav />}
        <main
          className={
            isOverview
              ? "flex-1"
              : "mx-auto w-full max-w-[1600px] flex-1 px-3 py-4 md:px-6 md:py-5"
          }
        >
          {children}
        </main>
        {!isOverview && (
          <div className="mx-auto w-full max-w-[1600px] px-3 pb-8 md:px-6">
            <ApprovalCenter />
          </div>
        )}
        {!isOverview && (
          <footer className="border-t border-[var(--border)] px-4 py-3 text-center mono text-[10px] text-[var(--text-muted)]">
            MARSHALL OS · DEMO_MODE · JARVIS layer (simulated) · Voice LOCAL browser only · No live
            trading · No L4 · Adapters NOT CONFIGURED
          </footer>
        )}
        <ClientErrorBoundary name="VoiceDebugHud">
          <VoiceDebugHud />
        </ClientErrorBoundary>
      </div>
    </JarvisProvider>
  );
}
