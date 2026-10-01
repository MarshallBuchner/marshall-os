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

export type FocusTarget =
  | { kind: "system"; id: string }
  | { kind: "agent"; id: string }
  | null;

export type MobileTab = "ask" | "attention" | "systems" | "activity" | "approvals";

type JarvisContextValue = {
  commands: JarvisCommand[];
  approvals: ApprovalRequest[];
  activity: ActivityEvent[];
  busy: boolean;
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  consoleOpen: boolean;
  setConsoleOpen: (open: boolean) => void;
  focus: FocusTarget;
  setFocus: (focus: FocusTarget) => void;
  clearFocus: () => void;
  activeCommandId: string | null;
  setActiveCommandId: (id: string | null) => void;
  mobileTab: MobileTab;
  setMobileTab: (tab: MobileTab) => void;
  submit: (input: string) => Promise<JarvisCommand | null>;
  resolve: (
    approvalId: string,
    decision: "approved" | "rejected",
  ) => Promise<void>;
  refresh: () => Promise<void>;
};

const JarvisContext = createContext<JarvisContextValue | null>(null);

/** Client seed matching server DEMO_COMMAND / DEMO_PENDING_APPROVALS — simulated */
const DEMO_COMMAND_SEED: JarvisCommand = {
  id: "cmd-demo-1",
  input: "Have Cursor investigate QuantLab's mobile dashboard.",
  createdAt: "2026-09-29T23:10:00Z",
  intent: {
    type: "CODE_TASK",
    confidence: 0.9,
    targetProjectId: "quantlab",
    targetAgentId: "cursor",
    summary: "code task → quantlab via cursor",
    rawInput: "Have Cursor investigate QuantLab's mobile dashboard.",
  },
  proposedAction: {
    id: "act-demo-1",
    label: "Investigate QuantLab mobile dashboard",
    description:
      "Have Cursor Agent inspect QuantLab mobile dashboard issues and return findings.",
    effect:
      "Simulated handoff only — no repo writes, no external API calls in V0.",
    permissionLevel: "L3_IMPORTANT",
    reversible: false,
  },
  routedAgentId: "cursor",
  routedProjectId: "quantlab",
  permissionLevel: "L3_IMPORTANT",
  requiresApproval: true,
  status: "WAITING_APPROVAL",
  result: null,
  approvalId: "apr-demo-1",
};

export function JarvisProvider({ children }: { children: ReactNode }) {
  const [commands, setCommands] = useState<JarvisCommand[]>([DEMO_COMMAND_SEED]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>(DEMO_PENDING_APPROVALS);
  const [activity, setActivity] = useState<ActivityEvent[]>(DEMO_ACTIVITY);
  const [busy, setBusy] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [focus, setFocus] = useState<FocusTarget>(null);
  const [activeCommandId, setActiveCommandId] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>("ask");

  const clearFocus = useCallback(() => setFocus(null), []);

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
      setConsoleOpen(true);
      try {
        const res = await fetch("/api/jarvis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed");
        const cmd = data.command as JarvisCommand;
        setCommands((prev) => [cmd, ...prev.filter((c) => c.id !== cmd.id)]);
        setActiveCommandId(cmd.id);
        if (data.activity) setActivity(data.activity);
        // Refresh approvals without wiping the just-submitted command if server lags
        const a = await fetch("/api/approvals").then((r) => r.json());
        setApprovals(a.approvals ?? []);
        return cmd;
      } finally {
        setBusy(false);
      }
    },
    [],
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
        if (data.command) {
          const cmd = data.command as JarvisCommand;
          setCommands((prev) => [cmd, ...prev.filter((c) => c.id !== cmd.id)]);
          setActiveCommandId(cmd.id);
        }
        if (data.approvals) setApprovals(data.approvals);
        else await refresh();
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
      consoleOpen,
      setConsoleOpen,
      focus,
      setFocus,
      clearFocus,
      activeCommandId,
      setActiveCommandId,
      mobileTab,
      setMobileTab,
      submit,
      resolve,
      refresh,
    }),
    [
      commands,
      approvals,
      activity,
      busy,
      panelOpen,
      consoleOpen,
      focus,
      clearFocus,
      activeCommandId,
      mobileTab,
      submit,
      resolve,
      refresh,
    ],
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
