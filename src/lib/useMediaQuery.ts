"use client";

import { useEffect, useState } from "react";

/**
 * Tailwind `lg` breakpoint — keep in sync with theme screens.
 * Used to avoid mounting desktop-only WebGL on phones (iOS WebKit crash).
 */
export const LG_MIN_WIDTH_QUERY = "(min-width: 1024px)";

type MediaQueryListLike = {
  matches: boolean;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
  addListener?: (listener: () => void) => void;
  removeListener?: (listener: () => void) => void;
};

function subscribeMatchMedia(query: string, onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  let mq: MediaQueryListLike;
  try {
    mq = window.matchMedia(query) as MediaQueryListLike;
  } catch {
    return () => {};
  }

  // Safari < 14 / some WebKit builds only expose addListener — addEventListener throws.
  if (typeof mq.addEventListener === "function") {
    mq.addEventListener("change", onChange);
    return () => {
      try {
        mq.removeEventListener?.("change", onChange);
      } catch {
        /* ignore */
      }
    };
  }
  if (typeof mq.addListener === "function") {
    mq.addListener(onChange);
    return () => {
      try {
        mq.removeListener?.(onChange);
      } catch {
        /* ignore */
      }
    };
  }
  return () => {};
}

/**
 * Desktop gate for WebGL mount.
 * Always starts `false` (SSR + first client paint) so hydration matches and
 * phones never mount SpatialCore. Switches after mount via matchMedia.
 * Must never throw — a failure here previously blanked the whole Overview.
 */
export function useIsDesktopLg(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const update = () => {
      if (cancelled) return;
      try {
        setIsDesktop(window.matchMedia(LG_MIN_WIDTH_QUERY).matches);
      } catch {
        setIsDesktop(false);
      }
    };
    update();
    const unsubscribe = subscribeMatchMedia(LG_MIN_WIDTH_QUERY, update);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return isDesktop;
}
