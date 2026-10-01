"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { useJarvis } from "@/components/jarvis/JarvisProvider";
import {
  FOCUS_SLOT,
  JARVIS_PRESENCE,
  getSpatialAgents,
  getSpatialSystems,
} from "@/lib/registry/spatial";
import { EnvironmentRoom, RoomDust } from "@/components/os/spatial/EnvironmentRoom";
import { JarvisPresence } from "@/components/os/spatial/JarvisPresence";
import { GlassModule } from "@/components/os/spatial/GlassModule";
import { AgentChip } from "@/components/os/spatial/AgentChip";

function usePrefersReducedMotion() {
  return useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);
}

function CameraDirector({
  focusing,
  reducedMotion,
}: {
  focusing: boolean;
  reducedMotion: boolean;
}) {
  const { camera } = useThree();
  const pos = useRef(new THREE.Vector3(0, 1.1, 5.1));
  const look = useRef(new THREE.Vector3(0, 0.2, -0.6));

  useFrame((_, dt) => {
    const desiredPos = focusing
      ? new THREE.Vector3(0.1, 0.7, 3.35)
      : new THREE.Vector3(0, 1.2, 5.25);
    const desiredLook = focusing
      ? new THREE.Vector3(...FOCUS_SLOT).add(new THREE.Vector3(0.15, 0.05, -0.2))
      : new THREE.Vector3(0.05, 0.15, -1.1);

    const lerp = reducedMotion ? 1 : 1 - Math.exp(-dt * 3.4);
    pos.current.lerp(desiredPos, lerp);
    look.current.lerp(desiredLook, lerp);
    camera.position.copy(pos.current);
    camera.lookAt(look.current);
  });

  return null;
}

/** Restrained route pulse — causality cue, not a flowchart edge */
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
    const t = (Math.sin(state.clock.elapsedTime * 2.8) + 1) / 2;
    ref.current.position.lerpVectors(
      new THREE.Vector3(...from),
      new THREE.Vector3(...to),
      t,
    );
    const s = 0.8 + t * 0.4;
    ref.current.scale.setScalar(s);
  });

  return (
    <mesh ref={ref} visible={false}>
      <sphereGeometry args={[0.028, 12, 12]} />
      <meshBasicMaterial color="#7dd3fc" transparent opacity={0.75} />
    </mesh>
  );
}

function SceneContent({ reducedMotion }: { reducedMotion: boolean }) {
  const { focus, setFocus, busy, activeCommandId, commands } = useJarvis();
  const systems = useMemo(() => getSpatialSystems(), []);
  const agents = useMemo(() => getSpatialAgents(), []);

  const activeCmd = useMemo(() => {
    if (!activeCommandId) return null;
    return commands.find((c) => c.id === activeCommandId) ?? null;
  }, [commands, activeCommandId]);

  const mounted = useRef(false);

  // Command → environment: focus target when a *new* command routes (not seed on load)
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (!activeCmd?.routedProjectId) return;
    if (activeCmd.id === "cmd-demo-1") return;
    const exists = systems.some((s) => s.id === activeCmd.routedProjectId);
    if (!exists) return;
    const id = window.setTimeout(() => {
      setFocus({ kind: "system", id: activeCmd.routedProjectId! });
    }, 0);
    return () => window.clearTimeout(id);
  }, [activeCmd?.id, activeCmd?.routedProjectId, setFocus, systems]);

  const focusedId = focus?.id ?? null;
  const inFocus = Boolean(focus);
  const associatedSystemId = activeCmd?.routedProjectId ?? null;
  const associatedAgentId = activeCmd?.routedAgentId ?? null;

  const jarvisIntensity =
    (busy ? 0.8 : 0) +
    (activeCmd ? 0.5 : 0.08) +
    (activeCmd?.status === "WAITING_APPROVAL" ? 0.3 : 0) +
    (activeCmd?.status === "RUNNING" ? 0.5 : 0);

  const associatedSystem = systems.find((s) => s.id === associatedSystemId);
  const associatedAgent = agents.find((a) => a.id === associatedAgentId);

  return (
    <>
      <EnvironmentRoom reducedMotion={reducedMotion} />
      <RoomDust reducedMotion={reducedMotion} />

      <JarvisPresence
        intensity={Math.min(1, jarvisIntensity)}
        reducedMotion={reducedMotion}
      />

      {systems.map((node) => (
        <GlassModule
          key={node.id}
          node={node}
          focused={focus?.kind === "system" && focusedId === node.id}
          associated={associatedSystemId === node.id}
          dimmed={
            inFocus &&
            !(focus?.kind === "system" && focusedId === node.id) &&
            associatedSystemId !== node.id
          }
          reducedMotion={reducedMotion}
          onSelect={() => setFocus({ kind: "system", id: node.id })}
        />
      ))}

      {agents.map((node) => (
        <AgentChip
          key={node.id}
          node={node}
          focused={focus?.kind === "agent" && focusedId === node.id}
          associated={associatedAgentId === node.id}
          dimmed={
            inFocus &&
            !(focus?.kind === "agent" && focusedId === node.id) &&
            associatedAgentId !== node.id
          }
          reducedMotion={reducedMotion}
          onSelect={() => setFocus({ kind: "agent", id: node.id })}
        />
      ))}

      {associatedSystem && associatedAgent && (
        <RoutePulse
          active={Boolean(activeCmd)}
          from={associatedAgent.restPosition}
          to={
            focus?.kind === "system" && focus.id === associatedSystem.id
              ? FOCUS_SLOT
              : associatedSystem.restPosition
          }
        />
      )}

      {/* Soft glow near Jarvis when active — no logo sphere */}
      {jarvisIntensity > 0.35 && (
        <pointLight
          position={JARVIS_PRESENCE}
          intensity={0.35 + jarvisIntensity * 0.4}
          color="#7dd3fc"
          distance={5}
        />
      )}

      <CameraDirector focusing={inFocus} reducedMotion={reducedMotion} />

      <EffectComposer multisampling={0}>
        <Bloom
          intensity={0.35}
          luminanceThreshold={0.5}
          luminanceSmoothing={0.8}
          mipmapBlur
        />
        <Vignette eskil={false} offset={0.18} darkness={0.7} />
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
      camera={{ position: [0, 1.2, 5.25], fov: 36, near: 0.1, far: 40 }}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      onPointerMissed={() => clearFocus()}
      style={{ width: "100%", height: "100%", display: "block" }}
    >
      <SceneContent reducedMotion={reducedMotion} />
    </Canvas>
  );
}
