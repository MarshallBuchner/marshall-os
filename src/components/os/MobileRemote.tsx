"use client";

import { useEffect, useState } from "react";
import { useJarvis } from "@/components/jarvis/JarvisProvider";
import { JarvisCore2D } from "@/components/os/JarvisCore2D";
import { AskJarvisBar } from "@/components/os/AskJarvisBar";
import { AttentionDot } from "@/components/os/AttentionDot";
import { AttentionBoard } from "@/components/os/AttentionBoard";
import { SystemActivity } from "@/components/os/SystemActivity";
import { ApprovalCenter } from "@/components/jarvis/ApprovalCenter";
import { SYSTEM_ORBIT, systemStatusLabel } from "@/lib/registry/projects";
import type { ActivityEvent } from "@/types";

type Sheet = "none" | "menu" | "attention" | "systems" | "activity" | "approvals";

/**
 * Cinematic mobile first impression — Jarvis owns the screen.
 * Tabs / forms / debug chrome are contextual, not permanent.
 */
export function MobileRemote({ activitySeed }: { activitySeed: ActivityEvent[] }) {
  const { setFocus, setContextPanel } = useJarvis();
  const [sheet, setSheet] = useState<Sheet>("none");
  const [coreSize, setCoreSize] = useState(300);

  useEffect(() => {
    const update = () => setCoreSize(Math.min(360, Math.floor(window.innerWidth * 0.82)));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <div className="lg:hidden mobile-cinematic">
      <div className="mobile-hero">
        <div className="mobile-hero-top">
          <p className="hero-brand">Marshall // OS</p>
          <div className="mobile-hero-actions">
            <AttentionDot />
            <button
              type="button"
              className="ghost-menu-btn"
              aria-label="Open menu"
              onClick={() => setSheet(sheet === "menu" ? "none" : "menu")}
            >
              ···
            </button>
          </div>
        </div>

        <div className="mobile-core-wrap">
          <JarvisCore2D size={coreSize} />
        </div>

        <div className="mobile-ask-wrap">
          <AskJarvisBar cinematic showPrompt />
        </div>
      </div>

      {sheet === "menu" && (
        <div className="mobile-sheet" role="dialog" aria-label="More">
          <div className="mobile-sheet-head">
            <span>More</span>
            <button type="button" className="ask-text-btn" onClick={() => setSheet("none")}>
              Close
            </button>
          </div>
          <div className="mobile-sheet-list">
            {(
              [
                ["attention", "Attention"],
                ["systems", "Systems"],
                ["activity", "Activity"],
                ["approvals", "Approvals"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className="mobile-sheet-item"
                onClick={() => {
                  setSheet(id);
                  if (id === "approvals") setContextPanel("approvals");
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {sheet === "attention" && (
        <SheetFrame title="Attention" onClose={() => setSheet("none")}>
          <AttentionBoard />
        </SheetFrame>
      )}
      {sheet === "activity" && (
        <SheetFrame title="Activity" onClose={() => setSheet("none")}>
          <SystemActivity seed={activitySeed} />
        </SheetFrame>
      )}
      {sheet === "approvals" && (
        <SheetFrame title="Approvals" onClose={() => setSheet("none")}>
          <ApprovalCenter />
        </SheetFrame>
      )}
      {sheet === "systems" && (
        <SheetFrame title="Systems" onClose={() => setSheet("none")}>
          <ul className="space-y-2 p-2">
            {SYSTEM_ORBIT.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="mobile-sheet-item w-full text-left"
                  onClick={() => {
                    setFocus({ kind: "system", id: s.id });
                    setSheet("none");
                  }}
                >
                  <span>{s.label}</span>
                  <span className="mono text-[10px] text-[var(--text-muted)]">
                    {systemStatusLabel(s.status)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </SheetFrame>
      )}
    </div>
  );
}

function SheetFrame({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mobile-sheet" role="dialog" aria-label={title}>
      <div className="mobile-sheet-head">
        <span>{title}</span>
        <button type="button" className="ask-text-btn" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="mobile-sheet-body">{children}</div>
    </div>
  );
}
