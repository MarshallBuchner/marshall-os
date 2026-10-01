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
  type PresenceMode,
} from "@/lib/jarvis/visualState";
import { jarvisMotionClock } from "@/lib/jarvis/motionClock";
import { jarvisExperienceClock } from "@/lib/jarvis/experienceClock";
import {
  createBrowserSttAdapter,
  type BrowserSttAdapter,
} from "@/lib/voice/speechRecognition";
import {
  createBrowserTtsAdapter,
  jarvisPhraseFor,
} from "@/lib/voice/speechSynthesis";
import { WAKE_WORD_CONFIG } from "@/lib/voice/wakeWord";
import { cleanTranscriptDisplay } from "@/lib/voice/normalizeTranscript";
import {
  isNonDestructiveVoiceIntent,
  isStableInterim,
  parseVoiceIntent,
} from "@/lib/voice/voiceIntents";
import { getAgent, getProject } from "@/lib/registry/projects";

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
  /** True after explicit mic start until user stops — hands-free chain */
  voiceSessionActive: boolean;
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
  presence: PresenceMode;
  transformProgress: number;
  beginTransform: () => void;
  returnToCore: () => void;
  /** Soft non-blocking note when presence construction fails */
  presenceDiagnostic: string | null;
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
  const [presence, setPresence] = useState<PresenceMode>("core");
  const [transformProgress, setTransformProgress] = useState(0);
  const [presenceDiagnostic, setPresenceDiagnostic] = useState<string | null>(null);
  const [voiceSessionActive, setVoiceSessionActive] = useState(false);

  const sttRef = useRef<BrowserSttAdapter | null>(null);
  const ttsRef = useRef<ReturnType<typeof createBrowserTtsAdapter> | null>(null);
  const pendingTranscript = useRef("");
  const finalTranscript = useRef("");
  const presenceRef = useRef<PresenceMode>("core");
  const approvalsRef = useRef(approvals);
  const lastInterimRef = useRef({ text: "", since: 0 });
  const lastExecutedRef = useRef({ key: "", at: 0 });
  const executeVoiceRef = useRef<(raw: string, fromFinal: boolean) => void>(() => {});
  const speakChainRef = useRef(Promise.resolve());
  const speakingRef = useRef(false);

  useEffect(() => {
    presenceRef.current = presence;
    approvalsRef.current = approvals;
  }, [presence, approvals]);

  useEffect(() => {
    sttRef.current = createBrowserSttAdapter();
    ttsRef.current = createBrowserTtsAdapter();
    setVoiceInputAvailable(sttRef.current.available);
    setVoiceOutputAvailable(ttsRef.current.available);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    jarvisMotionClock.setReducedMotion(reduced);
    jarvisExperienceClock.setReducedMotion(reduced);

    const unsub = jarvisExperienceClock.subscribe((phase, progress) => {
      setTransformProgress(progress);
      if (phase === "transform") setPresence("transforming");
      else if (phase === "humanoid") setPresence("humanoid");
      else if (phase === "return") setPresence("returning");
      else if (phase === "idle") setPresence("core");
    });

    return () => {
      unsub();
      sttRef.current?.abort();
      ttsRef.current?.stop();
      jarvisMotionClock.interrupt("idle");
      jarvisExperienceClock.interrupt("idle");
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

  /**
   * First-class spoken response — serialised queue.
   * Pauses STT for the whole utterance so Jarvis never hears himself,
   * drives SPEAKING + audioLevel, then resumes LISTENING if session active.
   */
  const speak = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return Promise.resolve();

    const run = async () => {
      const tts = ttsRef.current;
      if (!tts?.available || tts.muted) return;
      const stt = sttRef.current;
      // Prevent SpeechRecognition from capturing Jarvis's own voice
      stt?.pauseForTts();
      setListening(false);
      speakingRef.current = true;
      setSpeaking(true);
      setAudioLevel(0.45);
      try {
        await tts.speak(trimmed, {
          onEnergy: (level) => {
            if (speakingRef.current) setAudioLevel(level);
          },
        });
      } finally {
        speakingRef.current = false;
        setSpeaking(false);
        setAudioLevel(0);
        if (stt?.sessionActive) {
          setListening(true);
          stt.resumeAfterTts();
        }
      }
    };

    const next = speakChainRef.current.then(run, run);
    speakChainRef.current = next.catch(() => undefined);
    return next;
  }, []);

  const setVoiceMuted = useCallback((muted: boolean) => {
    setVoiceMutedState(muted);
    ttsRef.current?.setMuted(muted);
    if (muted) {
      ttsRef.current?.stop();
      setSpeaking(false);
    }
  }, []);

  const startTransformPresence = useCallback(() => {
    setPresenceDiagnostic(null);
    setPresence((p) => {
      if (p === "humanoid" || p === "transforming") return p;
      return "transforming";
    });
  }, []);

  const startReturnPresence = useCallback(() => {
    setPresence((p) => {
      if (p === "core" || p === "returning") return p;
      return "returning";
    });
  }, []);

  /** User-facing transform: short ack → action → "Presence online." (via clock) */
  const beginTransform = useCallback(() => {
    if (
      presenceRef.current === "humanoid" ||
      presenceRef.current === "transforming"
    ) {
      return;
    }
    void (async () => {
      await speak(jarvisPhraseFor("transform_ack"));
      startTransformPresence();
    })();
  }, [speak, startTransformPresence]);

  /** User-facing return: "Returning." → action → "Core online." (via clock) */
  const returnToCore = useCallback(() => {
    if (presenceRef.current === "core" || presenceRef.current === "returning") {
      return;
    }
    void (async () => {
      await speak(jarvisPhraseFor("returning"));
      startReturnPresence();
    })();
  }, [speak, startReturnPresence]);

  // Drive experience clock from presence transitions
  useEffect(() => {
    if (presence === "transforming" && jarvisExperienceClock.getPhase() !== "transform") {
      jarvisExperienceClock.beginTransform(() => {
        setPresence("humanoid");
        setPresenceDiagnostic(null);
        void speak(jarvisPhraseFor("presence_online"));
      });
    }
    if (presence === "returning" && jarvisExperienceClock.getPhase() !== "return") {
      jarvisExperienceClock.beginReturn(() => {
        setPresence("core");
        setTransformProgress(0);
        void speak(jarvisPhraseFor("core_online"));
      });
    }
  }, [presence, speak]);

  // Bounded fail-safe: never leave TRANSFORMING indefinitely (iOS rAF stalls, remount races)
  useEffect(() => {
    if (presence !== "transforming" && presence !== "returning") return;
    const ms = presence === "transforming" ? 6500 : 5500;
    const id = window.setTimeout(() => {
      const phase = jarvisExperienceClock.getPhase();
      if (presence === "transforming" && (phase === "transform" || phase === "humanoid")) {
        // Clock may have completed visually but React state lagged — force settle
        if (phase === "humanoid") {
          setPresence("humanoid");
          setTransformProgress(1);
          setPresenceDiagnostic(null);
          return;
        }
        jarvisExperienceClock.interrupt("idle");
        setPresence("core");
        setTransformProgress(0);
        setPresenceDiagnostic("Presence construction timed out — returned to core.");
        return;
      }
      if (presence === "returning" && phase === "return") {
        jarvisExperienceClock.interrupt("idle");
        setPresence("core");
        setTransformProgress(0);
        setPresenceDiagnostic("Return timed out — restored core.");
      }
    }, ms);
    return () => window.clearTimeout(id);
  }, [presence]);

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
      const trimmed = cleanTranscriptDisplay(input);
      if (!trimmed) return null;

      // Local presence / show intents — shared with voice path (same pipeline entry)
      const voiceIntent = parseVoiceIntent(trimmed);
      if (voiceIntent.kind === "TRANSFORM_HUMANOID") {
        beginTransform();
        return null;
      }
      if (voiceIntent.kind === "RETURN_TO_CORE") {
        returnToCore();
        return null;
      }
      if (voiceIntent.kind === "SHOW_SYSTEM") {
        const project = getProject(voiceIntent.projectId);
        setFocus({ kind: "system", id: voiceIntent.projectId });
        setContextPanel("focus");
        setAwake(true);
        void speak(
          jarvisPhraseFor("opening_system", {
            name: project?.name ?? voiceIntent.projectId,
          }),
        );
        return null;
      }

      const pipelineInput =
        voiceIntent.kind === "PIPELINE" && voiceIntent.displayText
          ? voiceIntent.displayText
          : trimmed;
      const lower = pipelineInput.toLowerCase();
      setBusy(true);
      setAwake(true);
      setVoiceError(null);
      jarvisMotionClock.beginCommandFlow({
        requiresApproval: /approve|cursor|investigate|deploy/i.test(pipelineInput),
      });
      try {
        const res = await fetch("/api/jarvis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: pipelineInput }),
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

        // Spoken result — same path for typed and voice-submitted commands
        if (cmd.status === "WAITING_APPROVAL") {
          jarvisMotionClock.settleApproval();
          setContextPanel("approvals");
          if (cmd.routedAgentId) {
            const agent = getAgent(cmd.routedAgentId);
            const short =
              cmd.routedAgentId === "cursor"
                ? "Cursor"
                : (agent?.name ?? cmd.routedAgentId);
            await speak(jarvisPhraseFor("routing_agent", { name: short }));
          }
          await speak(jarvisPhraseFor("approval"));
        } else if (cmd.status === "COMPLETED") {
          if (cmd.routedAgentId) {
            const agent = getAgent(cmd.routedAgentId);
            const short =
              cmd.routedAgentId === "cursor"
                ? "Cursor"
                : (agent?.name ?? cmd.routedAgentId);
            await speak(jarvisPhraseFor("routing_agent", { name: short }));
          }
          jarvisMotionClock.beginApprovedFlow({
            onSpeak: () => {
              void speak(jarvisPhraseFor("complete"));
            },
          });
          jarvisMotionClock.returnIdle(2800);
        } else if (cmd.status === "FAILED") {
          await speak(jarvisPhraseFor("error"));
        } else {
          await speak(jarvisPhraseFor("ack"));
        }

        if (lower.includes("attention")) setContextPanel("attention");
        if (lower.includes("activity") || lower.includes("progress")) {
          setContextPanel("activity");
        }

        return cmd;
      } catch {
        jarvisMotionClock.markError();
        await speak(jarvisPhraseFor("error"));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [speak, beginTransform, returnToCore],
  );

  const resolve = useCallback(
    async (approvalId: string, decision: "approved" | "rejected") => {
      setBusy(true);
      try {
        if (decision === "approved") {
          await speak(jarvisPhraseFor("approved"));
          jarvisMotionClock.beginApprovedFlow({
            onSpeak: () => {
              void speak(jarvisPhraseFor("complete"));
            },
          });
        } else {
          await speak(jarvisPhraseFor("rejected"));
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
      } catch {
        await speak(jarvisPhraseFor("error"));
      } finally {
        setBusy(false);
      }
    },
    [refresh, speak],
  );

  const executeVoiceCommand = useCallback(
    (raw: string, fromFinal: boolean) => {
      const display = cleanTranscriptDisplay(raw);
      if (!display) return;
      const intent = parseVoiceIntent(display);
      if (!intent.normalized && intent.kind === "PIPELINE") return;

      // Consequential actions require finalized transcripts
      if (!fromFinal && !isNonDestructiveVoiceIntent(intent.kind)) return;
      if (!fromFinal && intent.confidence < 0.85) return;

      const key = `${intent.kind}:${intent.normalized}`;
      const now = Date.now();
      if (lastExecutedRef.current.key === key && now - lastExecutedRef.current.at < 2200) {
        return;
      }
      lastExecutedRef.current = { key, at: now };

      setTranscript(display);
      finalTranscript.current = "";
      pendingTranscript.current = "";
      lastInterimRef.current = { text: "", since: 0 };

      // Same handlers as typed submit — no approval/safety bypass
      if (intent.kind === "TRANSFORM_HUMANOID") {
        beginTransform();
        return;
      }
      if (intent.kind === "RETURN_TO_CORE") {
        returnToCore();
        return;
      }
      if (intent.kind === "SHOW_SYSTEM") {
        void submit(display);
        return;
      }
      if (intent.kind === "APPROVE" || intent.kind === "REJECT") {
        if (!fromFinal) return;
        const pending = approvalsRef.current.filter((a) => a.status === "pending");
        if (pending.length !== 1) return;
        void resolve(
          pending[0].id,
          intent.kind === "APPROVE" ? "approved" : "rejected",
        );
        return;
      }
      if (intent.kind === "PIPELINE" && fromFinal) {
        void submit(intent.displayText || display);
      }
    },
    [beginTransform, returnToCore, resolve, submit],
  );

  useEffect(() => {
    executeVoiceRef.current = executeVoiceCommand;
  }, [executeVoiceCommand]);

  const stopListening = useCallback(() => {
    sttRef.current?.stop();
    setVoiceSessionActive(false);
    setListening(false);
    setAudioLevel(0);
    pendingTranscript.current = "";
    finalTranscript.current = "";
    lastInterimRef.current = { text: "", since: 0 };
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
    lastInterimRef.current = { text: "", since: 0 };
    setListening(true);
    setVoiceSessionActive(true);
    setAwake(true);
    setAudioLevel(0.35);

    stt.onResult = (r) => {
      // Hard ignore while Jarvis is speaking (belt + pauseForTts)
      if (speakingRef.current) return;

      const text = cleanTranscriptDisplay(r.transcript);
      setTranscript(text);
      pendingTranscript.current = text;
      setAudioLevel(0.3 + Math.min(0.5, text.length / 80));

      if (r.isFinal) {
        finalTranscript.current = text;
        executeVoiceRef.current(text, true);
        return;
      }

      // Stable interim → non-destructive UI intents only (transform/return/show)
      const now = Date.now();
      const prev = lastInterimRef.current;
      if (text && text === prev.text) {
        if (isStableInterim(text, prev.text, now - prev.since)) {
          const intent = parseVoiceIntent(text);
          if (isNonDestructiveVoiceIntent(intent.kind) && intent.confidence >= 0.85) {
            executeVoiceRef.current(text, false);
          }
        }
      } else {
        lastInterimRef.current = { text, since: now };
      }
    };
    stt.onError = (message) => {
      if (message === "VOICE INPUT NOT AVAILABLE") {
        setVoiceSessionActive(false);
        setListening(false);
        setAudioLevel(0);
        setVoiceError(message);
        return;
      }
      if (message.startsWith("Voice session ended")) {
        setVoiceSessionActive(false);
        setListening(false);
        setAudioLevel(0);
        setVoiceError(message);
        return;
      }
      // Soft errors while session may still restart
      setVoiceError(`Voice error: ${message}`);
    };
    stt.onEnd = () => {
      // Continuous session: adapter restarts recognition; keep Listening UI if session live
      if (stt.sessionActive) {
        setListening(true);
        setAudioLevel(0.28);
        return;
      }
      setListening(false);
      setAudioLevel(0);
      setVoiceSessionActive(false);
      const text = finalTranscript.current.trim();
      finalTranscript.current = "";
      pendingTranscript.current = "";
      if (text) executeVoiceRef.current(text, true);
    };

    try {
      await stt.start();
    } catch {
      setListening(false);
      setVoiceSessionActive(false);
      setVoiceError("VOICE INPUT NOT AVAILABLE");
    }
  }, []);

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
        presence,
        transformProgress,
      }),
    [
      listening,
      speaking,
      busy,
      voiceInputAvailable,
      activeCommand,
      awake,
      presence,
      transformProgress,
    ],
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
      voiceSessionActive,
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
      presence,
      transformProgress,
      beginTransform,
      returnToCore,
      presenceDiagnostic,
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
      voiceSessionActive,
      transcript,
      voiceError,
      audioLevel,
      awake,
      contextPanel,
      showAttention,
      speak,
      presence,
      transformProgress,
      beginTransform,
      returnToCore,
      presenceDiagnostic,
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
