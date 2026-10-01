"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  buildCoreTargets,
  buildHumanoidTargets,
  lerpArrays,
} from "@/lib/jarvis/presenceGeometry";
import {
  visualAccent,
  type JarvisVisualState,
  type PresenceMode,
} from "@/lib/jarvis/visualState";

const COUNT = 900;

type Props = {
  presence: PresenceMode;
  progress: number;
  state: JarvisVisualState;
  audioLevel: number;
  reducedMotion: boolean;
};

/**
 * Continuous particle ownership CORE ↔ abstract humanoid bust.
 * Same cloud morphs — not a crossfade of separate assets.
 */
export function JarvisPresenceMorph({
  presence,
  progress,
  state,
  audioLevel,
  reducedMotion,
}: Props) {
  const points = useRef<THREE.Points>(null);
  const eyes = useRef<THREE.Points>(null);
  const core = useMemo(() => buildCoreTargets(COUNT), []);
  const human = useMemo(() => buildHumanoidTargets(COUNT), []);
  const initial = useMemo(() => {
    const buf = new Float32Array(COUNT * 3);
    buf.set(core);
    return buf;
  }, [core]);
  const work = useRef<Float32Array>(null);

  const accent = visualAccent(state);
  const color = useMemo(() => new THREE.Color(accent.primary), [accent.primary]);

  const eyePos = useMemo(() => {
    const e = new Float32Array(24 * 3);
    e.set(human.subarray((COUNT - 24) * 3));
    return e;
  }, [human]);

  useFrame((st) => {
    if (!points.current) return;
    if (!work.current) work.current = new Float32Array(COUNT * 3);
    const t = st.clock.elapsedTime;
    const current = work.current;
    let morph = 0;
    if (presence === "transforming") morph = progress;
    else if (presence === "humanoid") morph = 1;
    else if (presence === "returning") morph = 1 - progress;
    else morph = 0;

    const eyeReveal = THREE.MathUtils.smoothstep(morph, 0.78, 1);
    lerpArrays(core, human, morph, current);

    if (morph > 0.5 && !reducedMotion) {
      const jaw = state === "SPEAKING" ? audioLevel * 0.04 : Math.sin(t * 1.2) * 0.006;
      for (let i = 0; i < COUNT - 24; i++) {
        const y = current[i * 3 + 1];
        if (y < 0.55 && y > 0.2) {
          current[i * 3 + 1] = y - jaw * (0.55 - y);
        }
      }
    }

    const attr = points.current.geometry.getAttribute("position") as THREE.BufferAttribute;
    (attr.array as Float32Array).set(current);
    attr.needsUpdate = true;

    const mat = points.current.material as THREE.PointsMaterial;
    mat.color.lerp(color, 0.15);
    mat.size = 0.018 + accent.intensity * 0.01 + (presence === "transforming" ? 0.008 : 0);
    mat.opacity =
      presence === "core" ? 0.15 + accent.particle * 0.25 : 0.35 + accent.particle * 0.45;

    if (eyes.current) {
      eyes.current.visible = eyeReveal > 0.05;
      const em = eyes.current.material as THREE.PointsMaterial;
      em.opacity = eyeReveal * 0.95;
      em.size = 0.03 + audioLevel * 0.02;
    }

    const s = presence === "humanoid" ? 1.05 : 1;
    points.current.scale.setScalar(
      THREE.MathUtils.lerp(points.current.scale.x || 1, s, 0.06),
    );
  });

  return (
    <group
      position={[
        0,
        presence === "humanoid" || presence === "transforming" || presence === "returning"
          ? -0.15
          : 0.1,
        0,
      ]}
    >
      <points ref={points}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[initial, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.02}
          color={accent.primary}
          transparent
          opacity={0.5}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
      <points ref={eyes} visible={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[eyePos, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.035}
          color="#e0f2fe"
          transparent
          opacity={0}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
    </group>
  );
}
