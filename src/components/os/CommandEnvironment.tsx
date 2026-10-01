"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SpatialCore } from "@/components/os/spatial/SpatialCore";
import { AskJarvisBar } from "@/components/os/AskJarvisBar";
import { AttentionDot } from "@/components/os/AttentionDot";
import { ContextualDrawer } from "@/components/os/ContextualDrawer";
import { MobileRemote } from "@/components/os/MobileRemote";
import { useJarvis } from "@/components/jarvis/JarvisProvider";
import { useIsDesktopLg } from "@/lib/useMediaQuery";
import type { ActivityEvent, Project } from "@/types";

/**
 * V0.25 cinematic Overview — Jarvis owns the screen.
 * Initial: brand + large core + prompt + ask/mic + attention dot.
 *
 * Desktop WebGL (SpatialCore) must not mount on phones: CSS `hidden lg:block`
 * still initializes R3F/WebGL and can hard-crash iPhone Safari WebKit
 * ("This page couldn't load"). Gate via mount-safe useIsDesktopLg (never throws).
 */
export function CommandEnvironment({
  activitySeed,
}: {
  projects: Project[];
  systemsOnline: number;
  activitySeed: ActivityEvent[];
}) {
  const { focus, clearFocus, setAwake } = useJarvis();
  const [menuOpen, setMenuOpen] = useState(false);
  // false until after mount — SSR/hydration safe; phones stay false
  const isDesktop = useIsDesktopLg();

  useEffect(() => {
    document.documentElement.classList.add("overview-cinematic");
    return () => document.documentElement.classList.remove("overview-cinematic");
  }, []);

  return (
    <div className="jarvis-home cinematic-home">
      <MobileRemote activitySeed={activitySeed} />

      {/* Keep desktop chrome in the tree for CSS layout; gate WebGL mount only. */}
      <div className="hidden lg:block desktop-cinematic">
        <div className="desktop-hero">
          <div className="desktop-hero-chrome">
            <p className="hero-brand">Marshall // OS</p>
            <div className="desktop-hero-actions">
              <AttentionDot />
              <button
                type="button"
                className="ghost-menu-btn"
                aria-label="Open navigation"
                onClick={() => setMenuOpen((v) => !v)}
              >
                Menu
              </button>
              {focus && (
                <button type="button" className="ask-text-btn" onClick={clearFocus}>
                  Return
                </button>
              )}
            </div>
          </div>

          {menuOpen && (
            <nav className="hero-flyout" aria-label="Primary">
              {[
                ["/", "Overview"],
                ["/projects", "Projects"],
                ["/agents", "Agents"],
                ["/automations", "Automations"],
                ["/systems", "Systems"],
                ["/knowledge", "Knowledge"],
              ].map(([href, label]) => (
                <Link key={href} href={href} className="hero-flyout-link">
                  {label}
                </Link>
              ))}
              <button
                type="button"
                className="hero-flyout-link"
                onClick={() => {
                  setMenuOpen(false);
                  setAwake(true);
                }}
              >
                Close
              </button>
            </nav>
          )}

          <div className="desktop-core-stage">
            {isDesktop ? <SpatialCore /> : null}
          </div>

          <div className="desktop-ask-overlay">
            <AskJarvisBar cinematic showPrompt />
          </div>
        </div>
      </div>

      <ContextualDrawer activitySeed={activitySeed} />
    </div>
  );
}
