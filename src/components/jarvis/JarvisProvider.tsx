"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ActivityEvent, ApprovalRequest, JarvisCommand } from "@/types";
import { DEMO_ACTIVITY, DEMO_PENDING_APPROVALS } from "@/lib/demo/fixtures";
import {
  deriveJarvisVisualState,
  type JarvisVisualState,
} from "@/lib/jarvis/visualState";
import { jarvisMotionClock } from "@/lib/jarvis/motionClock";
import { createBrowserSttAdapter } from "@/lib/voice/speechRecognition";
import {
  createBrowserTtsAdapter,
  jarvisPhraseFor,
} from "@/lib/voice/speechSynthesis";
import { WAKE_WORD_CONFIG } from "@/lib/voice/wakeWord";

export type FocusTarget =
  | { kind: "system"; id: string }
  | { kind: "agent"; id: string }
  | null;

export type MobileTab = "ask" | "attention" | "systems" | "activity" | "approvals";

export type ContextPanel =
  | "none"
  | "focus"
  | "attention"
  | "activity"
  | "audit"
  | "approvals";

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
  /** Visual / voice experience */
  visualState: JarvisVisualState;
  listening: boolean;
  speaking: boolean;
  voiceInputAvailable: boolean;
  voiceOutputAvailable: boolean;
  voiceMuted: boolean;
  setVoiceMuted: (muted: boolean) => void;
  startListening: () => Promise<void>;
  stopListening: () => void;
  transcript: string;
  voiceError: string | null;
  audioLevel: number;
  awake: boolean;
  setAwake: (v: boolean) => void;
  contextPanel: ContextPanel;
  setContextPanel: (p: ContextPanel) => void;
  showAttention: () => void;
  speak: (text: string) => Promise<void>;
  wakeWordEnabled: false;
};

const JarvisContext = createContext<JarvisContextValue | null>(null);

/** Seed kept for demo approvals list — not auto-activated on load */
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
  const [awake, setAwake] = useState(false);
  const [contextPanel, setContextPanel] = useState<ContextPanel>("none");

  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceMuted, setVoiceMutedState] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [voiceInputAvailable, setVoiceInputAvailable] = useState(false);
  const [voiceOutputAvailable, setVoiceOutputAvailable] = useState(false);

  const sttRef = useRef<ReturnType<typeof createBrowserSttAdapter> | null>(null);
  const ttsRef = useRef<ReturnType<typeof createBrowserTtsAdapter> | null>(null);
  const pendingTranscript = useRef("");
  const finalTranscript = useRef("");

  useEffect(() => {
    sttRef.current = createBrowserSttAdapter();
    ttsRef.current = createBrowserTtsAdapter();
    setVoiceInputAvailable(sttRef.current.available);
    setVoiceOutputAvailable(ttsRef.current.available);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    jarvisMotionClock.setReducedMotion(reduced);

    return () => {
      sttRef.current?.abort();
      ttsRef.current?.stop();
      jarvisMotionClock.interrupt("idle");
    };
  }, []);

  const clearFocus = useCallback(() => {
    setFocus(null);
    if (contextPanel === "focus") setContextPanel("none");
  }, [contextPanel]);

  const setFocusWrapped = useCallback((f: FocusTarget) => {
    setFocus(f);
    if (f) setContextPanel("focus");
  }, []);

  const speak = useCallback(async (text: string) => {
    const tts = ttsRef.current;
    if (!tts?.available || tts.muted || !text) return;
    setSpeaking(true);
    setAudioLevel(0.45);
    try {
      await tts.speak(text);
    } finally {
      setSpeaking(false);
      setAudioLevel(0);
    }
  }, []);

  const setVoiceMuted = useCallback((muted: boolean) => {
    setVoiceMutedState(muted);
    ttsRef.current?.setMuted(muted);
    if (muted) {
      ttsRef.current?.stop();
      setSpeaking(false);
    }
  }, []);

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
      const trimmed = input.trim();
      if (!trimmed) return null;
      setBusy(true);
      setAwake(true);
      setVoiceError(null);
      jarvisMotionClock.beginCommandFlow({
        requiresApproval: /approve|cursor|investigate|deploy/i.test(trimmed),
      });
      try {
        const res = await fetch("/api/jarvis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: trimmed }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed");
        const cmd = data.command as JarvisCommand;
        setCommands((prev) => [cmd, ...prev.filter((c) => c.id !== cmd.id)]);
        setActiveCommandId(cmd.id);
        if (data.activity) setActivity(data.activity);
        const a = await fetch("/api/approvals").then((r) => r.json());
        setApprovals(a.approvals ?? []);

        if (cmd.routedProjectId) {
          setFocus({ kind: "system", id: cmd.routedProjectId });
          setContextPanel("focus");
        }
        if (cmd.status === "WAITING_APPROVAL") {
          jarvisMotionClock.settleApproval();
          setContextPanel("approvals");
          void speak(jarvisPhraseFor("approval"));
        } else if (cmd.status === "COMPLETED") {
          jarvisMotionClock.beginApprovedFlow({
            onSpeak: () => {
              void speak(jarvisPhraseFor("complete"));
            },
          });
          jarvisMotionClock.returnIdle(2800);
        } else {
          void speak(jarvisPhraseFor("ack"));
        }

        // Attention / activity queries open contextual panels
        const lower = trimmed.toLowerCase();
        if (lower.includes("attention")) setContextPanel("attention");
        if (lower.includes("activity") || lower.includes("progress")) {
          setContextPanel("activity");
        }

        return cmd;
      } catch {
        jarvisMotionClock.markError();
        void speak(jarvisPhraseFor("error"));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [speak],
  );

  const resolve = useCallback(
    async (approvalId: string, decision: "approved" | "rejected") => {
      setBusy(true);
      try {
        if (decision === "approved") {
          jarvisMotionClock.beginApprovedFlow({
            onSpeak: () => {
              void speak(jarvisPhraseFor("complete"));
            },
          });
        } else {
          jarvisMotionClock.interrupt("idle");
        }
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
        jarvisMotionClock.returnIdle(2200);
      } finally {
        setBusy(false);
      }
    },
    [refresh, speak],
  );

  const stopListening = useCallback(() => {
    sttRef.current?.stop();
    setListening(false);
    setAudioLevel(0);
  }, []);

  const startListening = useCallback(async () => {
    const stt = sttRef.current;
    if (!stt?.available) {
      setVoiceError("VOICE INPUT NOT AVAILABLE");
      return;
    }
    // Interrupt TTS when user takes mic
    ttsRef.current?.stop();
    setSpeaking(false);
    setVoiceError(null);
    setTranscript("");
    pendingTranscript.current = "";
    finalTranscript.current = "";
    setListening(true);
    setAwake(true);
    setAudioLevel(0.35);

    stt.onResult = (r) => {
      setTranscript(r.transcript);
      pendingTranscript.current = r.transcript;
      setAudioLevel(0.3 + Math.min(0.5, r.transcript.length / 80));
      // Only commit commands from final results — never interim drafts
      if (r.isFinal) {
        finalTranscript.current = r.transcript;
      }
    };
    stt.onError = (message) => {
      setListening(false);
      setAudioLevel(0);
      if (message === "VOICE INPUT NOT AVAILABLE") {
        setVoiceError(message);
      } else {
        setVoiceError(`Voice error: ${message}`);
      }
    };
    stt.onEnd = () => {
      setListening(false);
      setAudioLevel(0);
      const text = finalTranscript.current.trim();
      finalTranscript.current = "";
      pendingTranscript.current = "";
      if (text) {
        // Voice approve/cancel only when exactly one unambiguous pending approval
        const pending = approvals.filter((a) => a.status === "pending");
        const lower = text.toLowerCase();
        if (pending.length === 1) {
          if (/^(approve|yes|confirm)\b/.test(lower)) {
            void resolve(pending[0].id, "approved");
            return;
          }
          if (/^(cancel|reject|no)\b/.test(lower)) {
            void resolve(pending[0].id, "rejected");
            return;
          }
        }
        void submit(text);
      }
    };

    try {
      await stt.start();
    } catch {
      setListening(false);
      setVoiceError("VOICE INPUT NOT AVAILABLE");
    }
  }, [approvals, resolve, submit]);

  const showAttention = useCallback(() => {
    setContextPanel("attention");
    void submit("What needs my attention?");
  }, [submit]);

  const activeCommand = useMemo(() => {
    if (!activeCommandId) return null;
    return commands.find((c) => c.id === activeCommandId) ?? null;
  }, [commands, activeCommandId]);

  const visualState = useMemo(
    () =>
      deriveJarvisVisualState({
        listening,
        speaking,
        busy,
        voiceAvailable: voiceInputAvailable,
        activeCommand,
        awake,
      }),
    [listening, speaking, busy, voiceInputAvailable, activeCommand, awake],
  );

  // Keep motion clock in sync with approval settle when visual is WAITING_APPROVAL
  useEffect(() => {
    if (visualState === "WAITING_APPROVAL") {
      jarvisMotionClock.settleApproval();
    }
  }, [visualState]);

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
      setFocus: setFocusWrapped,
      clearFocus,
      activeCommandId,
      setActiveCommandId,
      mobileTab,
      setMobileTab,
      submit,
      resolve,
      refresh,
      visualState,
      listening,
      speaking,
      voiceInputAvailable,
      voiceOutputAvailable,
      voiceMuted,
      setVoiceMuted,
      startListening,
      stopListening,
      transcript,
      voiceError,
      audioLevel,
      awake,
      setAwake,
      contextPanel,
      setContextPanel,
      showAttention,
      speak,
      wakeWordEnabled: WAKE_WORD_CONFIG.enabled,
    }),
    [
      commands,
      approvals,
      activity,
      busy,
      panelOpen,
      consoleOpen,
      focus,
      setFocusWrapped,
      clearFocus,
      activeCommandId,
      mobileTab,
      submit,
      resolve,
      refresh,
      visualState,
      listening,
      speaking,
      voiceInputAvailable,
      voiceOutputAvailable,
      voiceMuted,
      setVoiceMuted,
      startListening,
      stopListening,
      transcript,
      voiceError,
      audioLevel,
      awake,
      contextPanel,
      showAttention,
      speak,
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
