"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { useJarvis } from "@/components/jarvis/JarvisProvider";
import {
  FOCUS_SLOT,
  getSpatialAgents,
  getSpatialSystems,
} from "@/lib/registry/spatial";
import type { JarvisVisualState, PresenceMode } from "@/lib/jarvis/visualState";
import { EnvironmentRoom, RoomDust } from "@/components/os/spatial/EnvironmentRoom";
import { JarvisCircularCore } from "@/components/os/spatial/JarvisCircularCore";
import { JarvisPresenceMorph } from "@/components/os/spatial/JarvisPresenceMorph";
import { GlassModule } from "@/components/os/spatial/GlassModule";
import { AgentChip } from "@/components/os/spatial/AgentChip";

type CameraMode =
  | "HERO"
  | "LISTENING"
  | "SYSTEM_FOCUS"
  | "AGENT_ROUTING"
  | "APPROVAL"
  | "TRANSFORM"
  | "HUMANOID";

function usePrefersReducedMotion() {
  return useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);
}

/**
 * Desktop-only: scale the Jarvis core group so it floats as a centerpiece
 * (~55–65vh, capped ~720–760px) with negative space for surrounding modules.
 * Does not change camera FOV. Mobile uses Canvas2D and never mounts this scene.
 */
// Outer soft disc in JarvisCircularCore is circleGeometry radius 2.55
const CORE_WORLD_DIAMETER = 5.1;
const HERO_CAM_Z = 3.7;
const HERO_FOV_DEG = 36;

function useDesktopCoreScale(): number {
  const { size } = useThree();
  return useMemo(() => {
    // R3F `size` is CSS pixels of the canvas
    const h = Math.max(1, size.height);
    // Target on-screen diameter ≈ 60vh, hard-capped at 720px (MacBook-friendly)
    const targetPx = Math.min(720, Math.max(460, h * 0.6));
    const fraction = targetPx / h;
    const worldH = 2 * HERO_CAM_Z * Math.tan((HERO_FOV_DEG * Math.PI) / 360);
    const scale = (fraction * worldH) / CORE_WORLD_DIAMETER;
    // scale=1 put outer disc at ~212vh (heavily cropped); land near 0.28–0.35
    return THREE.MathUtils.clamp(scale, 0.26, 0.42);
  }, [size.height]);
}

function cameraFor(mode: CameraMode) {
  switch (mode) {
    case "LISTENING":
      return { pos: new THREE.Vector3(0, 0.2, 3.4), look: new THREE.Vector3(0, 0.05, 0) };
    case "SYSTEM_FOCUS":
      return {
        pos: new THREE.Vector3(-0.25, 0.28, 3.25),
        look: new THREE.Vector3(...FOCUS_SLOT).multiply(new THREE.Vector3(0.45, 1, 0.35)),
      };
    case "AGENT_ROUTING":
      return { pos: new THREE.Vector3(0.2, 0.35, 3.55), look: new THREE.Vector3(0.5, 0.4, 0.15) };
    case "APPROVAL":
      return { pos: new THREE.Vector3(0, 0.18, 3.6), look: new THREE.Vector3(0, 0.05, 0) };
    case "TRANSFORM":
      return { pos: new THREE.Vector3(0.1, 0.45, 4.1), look: new THREE.Vector3(0, 0.35, 0) };
    case "HUMANOID":
      return { pos: new THREE.Vector3(0, 0.55, 3.7), look: new THREE.Vector3(0, 0.55, 0) };
    case "HERO":
    default:
      return { pos: new THREE.Vector3(0, 0.15, 3.7), look: new THREE.Vector3(0, 0.05, 0) };
  }
}

function resolveCameraMode(
  visualState: JarvisVisualState,
  presence: PresenceMode,
  focusing: boolean,
  hasAgent: boolean,
): CameraMode {
  if (presence === "transforming" || visualState === "TRANSFORM_START" || visualState === "TRANSFORM_MORPH") {
    return "TRANSFORM";
  }
  if (presence === "returning") return "TRANSFORM";
  if (presence === "humanoid" || visualState === "HUMANOID_ACTIVE") return "HUMANOID";
  if (visualState === "WAITING_APPROVAL") return "APPROVAL";
  if (focusing) return "SYSTEM_FOCUS";
  if (visualState === "LISTENING" || visualState === "SPEAKING") return "LISTENING";
  if (hasAgent && (visualState === "ROUTING" || visualState === "UNDERSTANDING" || visualState === "EXECUTING")) {
    return "AGENT_ROUTING";
  }
  return "HERO";
}

function CameraDirector({ mode, reducedMotion }: { mode: CameraMode; reducedMotion: boolean }) {
  const { camera } = useThree();
  const pos = useRef(new THREE.Vector3(0, 0.15, 3.7));
  const look = useRef(new THREE.Vector3(0, 0.05, 0));

  useFrame((_, dt) => {
    const desired = cameraFor(mode);
    const speed = reducedMotion ? 18 : mode === "TRANSFORM" || mode === "HUMANOID" ? 2.4 : 4.2;
    const lerp = reducedMotion ? 1 : 1 - Math.exp(-dt * speed);
    pos.current.lerp(desired.pos, lerp);
    look.current.lerp(desired.look, lerp);
    camera.position.copy(pos.current);
    camera.lookAt(look.current);
  });

  return null;
}

function RoutePulse({
  from,
  to,
  active,
}: {
  from: [number, number, number];
  to: [number, number, number];
  active: boolean;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current || !active) {
      if (ref.current) ref.current.visible = false;
      return;
    }
    ref.current.visible = true;
    const t = (Math.sin(state.clock.elapsedTime * 2.4) + 1) / 2;
    ref.current.position.lerpVectors(
      new THREE.Vector3(...from),
      new THREE.Vector3(...to),
      t,
    );
  });
  return (
    <mesh ref={ref} visible={false}>
      <sphereGeometry args={[0.03, 12, 12]} />
      <meshBasicMaterial color="#7dd3fc" transparent opacity={0.8} />
    </mesh>
  );
}

function SceneContent({ reducedMotion }: { reducedMotion: boolean }) {
  const {
    focus,
    setFocus,
    visualState,
    audioLevel,
    activeCommandId,
    commands,
    awake,
    setAwake,
    presence,
    transformProgress,
  } = useJarvis();

  const systems = useMemo(() => getSpatialSystems(), []);
  const agents = useMemo(() => getSpatialAgents(), []);
  const activeCmd = useMemo(() => {
    if (!activeCommandId) return null;
    return commands.find((c) => c.id === activeCommandId) ?? null;
  }, [commands, activeCommandId]);

  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (!activeCmd?.routedProjectId || activeCmd.id === "cmd-demo-1") return;
    if (!systems.some((s) => s.id === activeCmd.routedProjectId)) return;
    const id = window.setTimeout(() => {
      setFocus({ kind: "system", id: activeCmd.routedProjectId! });
    }, 0);
    return () => window.clearTimeout(id);
  }, [activeCmd?.id, activeCmd?.routedProjectId, setFocus, systems]);

  const focusedId = focus?.id ?? null;
  const inFocus = Boolean(focus);
  const associatedSystemId = activeCmd?.routedProjectId ?? null;
  const associatedAgentId = activeCmd?.routedAgentId ?? null;
  const associatedSystem = systems.find((s) => s.id === associatedSystemId);
  const associatedAgent = agents.find((a) => a.id === associatedAgentId);

  const camMode = resolveCameraMode(
    visualState,
    presence,
    inFocus,
    Boolean(associatedAgentId),
  );

  const dissolving =
    presence === "transforming" || presence === "humanoid" || presence === "returning";
  const dissolveAmt =
    presence === "humanoid"
      ? 1
      : presence === "transforming"
        ? transformProgress
        : presence === "returning"
          ? 1 - transformProgress
          : 0;

  // During transform freeze heavy module motion by hiding non-essential surfaces
  const freezeExtras = presence === "transforming" || presence === "returning";
  const humanoidSurfaceCap = presence === "humanoid";
  const coreScale = useDesktopCoreScale();

  return (
    <>
      <EnvironmentRoom reducedMotion={reducedMotion} />
      <RoomDust reducedMotion={reducedMotion} density={freezeExtras ? 0.4 : 1} />

      {/* Scale core+presence only — room/modules keep composition space around the centerpiece */}
      <group
        scale={[coreScale, coreScale, coreScale]}
        onClick={(e) => {
          e.stopPropagation();
          setAwake(true);
          window.setTimeout(() => setAwake(false), 800);
        }}
      >
        <JarvisCircularCore
          state={visualState}
          reducedMotion={reducedMotion}
          audioLevel={audioLevel}
          awake={awake}
          dissolve={dissolveAmt}
        />
        <JarvisPresenceMorph
          presence={presence}
          progress={transformProgress}
          state={visualState}
          audioLevel={audioLevel}
          reducedMotion={reducedMotion}
          quality="HIGH"
        />
      </group>

      {/* Keep modules mounted during transform — conditional unmount of <Html> caused removeChild */}
      {systems.map((node) => {
        const focused = focus?.kind === "system" && focusedId === node.id;
        const associated = associatedSystemId === node.id;
        const attention = node.status === "degraded";
        let visible =
          focused || associated || (attention && (inFocus || Boolean(activeCmd)));
        if (freezeExtras) visible = false;
        // Humanoid: max 1–2 surfaces
        if (humanoidSurfaceCap) {
          visible = focused || associated;
        }
        return (
          <GlassModule
            key={node.id}
            node={node}
            focused={focused && !freezeExtras}
            associated={associated && !freezeExtras}
            visible={visible}
            reducedMotion={reducedMotion}
            onSelect={() => setFocus({ kind: "system", id: node.id })}
          />
        );
      })}

      {agents.map((node) => (
        <AgentChip
          key={node.id}
          node={node}
          focused={!freezeExtras && focus?.kind === "agent" && focusedId === node.id}
          associated={!freezeExtras && associatedAgentId === node.id}
          reducedMotion={reducedMotion}
          onSelect={() => setFocus({ kind: "agent", id: node.id })}
        />
      ))}

      {associatedSystem && associatedAgent && (
        <RoutePulse
          active={!freezeExtras && Boolean(activeCmd) && camMode !== "HERO"}
          from={dissolving ? [0, 0.5, 0.1] : [0, 0.1, 0.15]}
          to={
            focus?.kind === "system" && focus.id === associatedSystem.id
              ? FOCUS_SLOT
              : associatedSystem.restPosition
          }
        />
      )}

      <CameraDirector mode={camMode} reducedMotion={reducedMotion} />

      <EffectComposer multisampling={0}>
        <Bloom
          intensity={freezeExtras ? 0.5 : 0.4}
          luminanceThreshold={0.4}
          luminanceSmoothing={0.75}
          mipmapBlur
        />
        <Vignette eskil={false} offset={0.1} darkness={0.78} />
      </EffectComposer>
    </>
  );
}

export function SpatialScene() {
  const reducedMotion = usePrefersReducedMotion();
  const { clearFocus } = useJarvis();

  useEffect(() => {
    return () => {
      document.body.style.cursor = "auto";
    };
  }, []);

  return (
    <Canvas
      dpr={[1, 1.6]}
      camera={{ position: [0, 0.15, 3.7], fov: 36, near: 0.1, far: 50 }}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      onPointerMissed={() => clearFocus()}
      style={{ width: "100%", height: "100%", display: "block" }}
    >
      <SceneContent reducedMotion={reducedMotion} />
    </Canvas>
  );
}
