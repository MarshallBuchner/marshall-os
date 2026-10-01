"use client";

import { useSyncExternalStore } from "react";

/**
 * Tailwind `lg` breakpoint — keep in sync with theme screens.
 * Used to avoid mounting desktop-only WebGL on phones (iOS WebKit crash).
 */
export const LG_MIN_WIDTH_QUERY = "(min-width: 1024px)";

function subscribeMediaQuery(query: string, onStoreChange: () => void) {
  const mq = window.matchMedia(query);
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

/** Client media query; SSR / first server snapshot is always `false`. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onStoreChange) => subscribeMediaQuery(query, onStoreChange),
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export function useIsDesktopLg(): boolean {
  return useMediaQuery(LG_MIN_WIDTH_QUERY);
}
