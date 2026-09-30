"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ActivityEvent, ApprovalRequest, JarvisCommand } from "@/types";
import { DEMO_ACTIVITY, DEMO_PENDING_APPROVALS } from "@/lib/demo/fixtures";

type JarvisContextValue = {
  commands: JarvisCommand[];
  approvals: ApprovalRequest[];
  activity: ActivityEvent[];
  busy: boolean;
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  submit: (input: string) => Promise<JarvisCommand | null>;
  resolve: (
    approvalId: string,
    decision: "approved" | "rejected",
  ) => Promise<void>;
  refresh: () => Promise<void>;
};

const JarvisContext = createContext<JarvisContextValue | null>(null);

export function JarvisProvider({ children }: { children: ReactNode }) {
  // Seed from DEMO fixtures (client-visible, non-secret). Server remains source of truth after mutations.
  const [commands, setCommands] = useState<JarvisCommand[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>(DEMO_PENDING_APPROVALS);
  const [activity, setActivity] = useState<ActivityEvent[]>(DEMO_ACTIVITY);
  const [busy, setBusy] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  const refresh = useCallback(async () => {
    const [j, a] = await Promise.all([
      fetch("/api/jarvis").then((r) => r.json()),
      fetch("/api/approvals").then((r) => r.json()),
    ]);
    setCommands(j.commands ?? []);
    if (j.activity) setActivity(j.activity);
    setApprovals(a.approvals ?? []);
  }, []);

  const submit = useCallback(
    async (input: string) => {
      setBusy(true);
      try {
        const res = await fetch("/api/jarvis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed");
        setCommands((prev) => {
          const next = [
            data.command as JarvisCommand,
            ...prev.filter((c) => c.id !== data.command.id),
          ];
          return next;
        });
        if (data.activity) setActivity(data.activity);
        await refresh();
        return data.command as JarvisCommand;
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const resolve = useCallback(
    async (approvalId: string, decision: "approved" | "rejected") => {
      setBusy(true);
      try {
        const res = await fetch("/api/approvals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approvalId, decision }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed");
        if (data.activity) setActivity(data.activity);
        await refresh();
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const value = useMemo(
    () => ({
      commands,
      approvals,
      activity,
      busy,
      panelOpen,
      setPanelOpen,
      submit,
      resolve,
      refresh,
    }),
    [commands, approvals, activity, busy, panelOpen, submit, resolve, refresh],
  );

  return (
    <JarvisContext.Provider value={value}>{children}</JarvisContext.Provider>
  );
}

export function useJarvis() {
  const ctx = useContext(JarvisContext);
  if (!ctx) throw new Error("useJarvis must be used within JarvisProvider");
  return ctx;
}
