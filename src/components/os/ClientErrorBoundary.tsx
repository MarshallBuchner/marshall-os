"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Optional fallback UI; default = render nothing */
  fallback?: ReactNode;
  /** Label for console diagnostics */
  name?: string;
};

type State = { hasError: boolean };

/**
 * Isolates non-critical client subsystems (voice HUD, etc.) so a throw
 * cannot blank the Marshall OS shell.
 */
export class ClientErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const label = this.props.name ?? "ClientErrorBoundary";
    console.warn(`[${label}] isolated error:`, error?.message ?? error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) return this.props.fallback ?? null;
    return this.props.children;
  }
}
