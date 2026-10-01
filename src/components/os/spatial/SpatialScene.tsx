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
import { EnvironmentRoom, RoomDust } from "@/components/os/spatial/EnvironmentRoom";
import { JarvisCircularCore } from "@/components/os/spatial/JarvisCircularCore";
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
  const pos = useRef(new THREE.Vector3(0, 0.35, 4.2));
  const look = useRef(new THREE.Vector3(0, 0.15, 0));

  useFrame((_, dt) => {
    const desiredPos = focusing
      ? new THREE.Vector3(-0.15, 0.35, 3.55)
      : new THREE.Vector3(0, 0.4, 4.35);
    const desiredLook = focusing
      ? new THREE.Vector3(...FOCUS_SLOT).multiply(new THREE.Vector3(0.35, 1, 0.4))
      : new THREE.Vector3(0, 0.12, 0);

    const lerp = reducedMotion ? 1 : 1 - Math.exp(-dt * 3.2);
    pos.current.lerp(desiredPos, lerp);
    look.current.lerp(desiredLook, lerp);
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
    const t = (Math.sin(state.clock.elapsedTime * 2.6) + 1) / 2;
    ref.current.position.lerpVectors(
      new THREE.Vector3(...from),
      new THREE.Vector3(...to),
      t,
    );
  });

  return (
    <mesh ref={ref} visible={false}>
      <sphereGeometry args={[0.025, 12, 12]} />
      <meshBasicMaterial color="#7dd3fc" transparent opacity={0.7} />
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

  const associatedSystem = systems.find((s) => s.id === associatedSystemId);
  const associatedAgent = agents.find((a) => a.id === associatedAgentId);

  return (
    <>
      <EnvironmentRoom reducedMotion={reducedMotion} />
      <RoomDust reducedMotion={reducedMotion} />

      <JarvisCircularCore
        state={visualState}
        reducedMotion={reducedMotion}
        audioLevel={audioLevel}
      />

      {systems.map((node) => {
        const focused = focus?.kind === "system" && focusedId === node.id;
        const associated = associatedSystemId === node.id;
        const attention = node.status === "degraded";
        // Contextual only — not permanent orbits
        // Contextual only — attention surfaces when actively relevant
        const visible =
          focused || associated || (attention && (inFocus || Boolean(activeCmd)));
        return (
          <GlassModule
            key={node.id}
            node={node}
            focused={focused}
            associated={associated}
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
          focused={focus?.kind === "agent" && focusedId === node.id}
          associated={associatedAgentId === node.id}
          reducedMotion={reducedMotion}
          onSelect={() => setFocus({ kind: "agent", id: node.id })}
        />
      ))}

      {associatedSystem && associatedAgent && (
        <RoutePulse
          active={Boolean(activeCmd)}
          from={[0, 0.15, 0.2]}
          to={
            focus?.kind === "system" && focus.id === associatedSystem.id
              ? FOCUS_SLOT
              : associatedSystem.restPosition
          }
        />
      )}

      <CameraDirector focusing={inFocus} reducedMotion={reducedMotion} />

      <EffectComposer multisampling={0}>
        <Bloom
          intensity={0.32}
          luminanceThreshold={0.48}
          luminanceSmoothing={0.8}
          mipmapBlur
        />
        <Vignette eskil={false} offset={0.15} darkness={0.72} />
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
      dpr={[1, 1.5]}
      camera={{ position: [0, 0.4, 4.35], fov: 38, near: 0.1, far: 40 }}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      onPointerMissed={() => clearFocus()}
      style={{ width: "100%", height: "100%", display: "block" }}
    >
      <SceneContent reducedMotion={reducedMotion} />
    </Canvas>
  );
}
