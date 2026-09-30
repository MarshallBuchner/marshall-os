"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useJarvis } from "@/components/jarvis/JarvisProvider";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/projects", label: "Projects" },
  { href: "/agents", label: "Agents" },
  { href: "/automations", label: "Automations" },
  { href: "/systems", label: "Systems" },
  { href: "/knowledge", label: "Knowledge" },
];

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { setConsoleOpen, setMobileTab, approvals } = useJarvis();
  const pending = approvals.filter((a) => a.status === "pending").length;

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[rgba(2,4,10,0.72)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1600px] items-center gap-4 px-4 py-2.5 md:px-6">
        <Link href="/" className="shrink-0">
          <div className="display-font text-sm text-[var(--electric)] md:text-[15px]">
            MARSHALL <span className="text-[var(--text-muted)]">{"//"}</span> OS
          </div>
          <div className="mono text-[9px] tracking-[0.22em] text-[var(--text-muted)]">
            PERSONAL AI OPERATING ENVIRONMENT
          </div>
        </Link>

        <nav className="ml-2 hidden flex-1 items-center gap-0.5 overflow-x-auto lg:flex">
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-2.5 py-1 text-[11px] tracking-wide transition-colors ${
                  active
                    ? "text-[var(--electric)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                {active ? `[ ${item.label} ]` : item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setMobileTab("ask");
              setConsoleOpen(true);
              if (pathname !== "/") {
                router.push("/");
              } else {
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            }}
          >
            Ask Jarvis
            {pending > 0 && (
              <span className="ml-1 bg-[var(--warn)]/15 px-1.5 text-[10px] text-[var(--warn)]">
                {pending}
              </span>
            )}
          </button>
          <div className="hidden items-center gap-2 border border-[var(--border)] px-2 py-1 sm:flex">
            <span className="status-dot bg-[var(--health)]" />
            <span className="mono text-[10px] text-[var(--text-muted)]">MARSHALL</span>
          </div>
        </div>
      </div>
    </header>
  );
}
