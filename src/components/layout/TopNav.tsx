"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useJarvis } from "@/components/jarvis/JarvisProvider";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/projects", label: "Projects" },
  { href: "/agents", label: "AI Agents" },
  { href: "/automations", label: "Automations" },
  { href: "/systems", label: "Systems" },
  { href: "/knowledge", label: "Knowledge" },
];

export function TopNav() {
  const pathname = usePathname();
  const { setPanelOpen, approvals } = useJarvis();
  const pending = approvals.filter((a) => a.status === "pending").length;

  return (
    <header className="glass sticky top-0 z-40 border-b border-[var(--border)]">
      <div className="mx-auto flex max-w-[1600px] items-center gap-4 px-4 py-3 md:px-6">
        <Link href="/" className="shrink-0">
          <div className="display-font text-sm text-[var(--electric)] md:text-base">
            MARSHALL <span className="text-[var(--text-muted)]">{"//"}</span> OS
          </div>
          <div className="mono text-[10px] tracking-[0.2em] text-[var(--text-muted)]">
            AI COMMAND CENTER
          </div>
        </Link>

        <nav className="ml-2 hidden flex-1 items-center gap-1 overflow-x-auto lg:flex">
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 text-xs tracking-wide transition-colors ${
                  active
                    ? "border border-[var(--border-strong)] bg-[rgba(34,211,238,0.1)] text-[var(--electric)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className="btn-primary"
            onClick={() => setPanelOpen(true)}
          >
            Ask Jarvis
            {pending > 0 && (
              <span className="ml-1 rounded-sm bg-[var(--warn)]/20 px-1.5 text-[10px] text-[var(--warn)]">
                {pending}
              </span>
            )}
          </button>
          <button type="button" className="btn-ghost hidden sm:inline-flex" aria-label="Notifications">
            Alerts
          </button>
          <div className="hidden items-center gap-2 border border-[var(--border)] px-2 py-1 sm:flex">
            <span className="status-dot bg-[var(--health)]" />
            <span className="mono text-[10px] text-[var(--text-muted)]">MARSHALL</span>
          </div>
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto border-t border-[var(--border)] px-3 py-2 lg:hidden">
        {NAV.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`shrink-0 px-2.5 py-1 text-[11px] ${
                active ? "text-[var(--electric)]" : "text-[var(--text-muted)]"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
