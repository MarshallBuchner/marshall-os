"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { JARVIS_PRESENCE } from "@/lib/registry/spatial";

type Props = {
  /** Command processing / busy intensifies presence */
  intensity: number;
  reducedMotion: boolean;
};

/**
 * Abstract JARVIS presence — volumetric field inhabiting the room.
 * Not a planet, sphere logo, wireframe totem, or human form.
 * Nearly disappears when idle; denser when processing.
 */
export function JarvisPresence({ intensity, reducedMotion }: Props) {
  const group = useRef<THREE.Group>(null);
  const field = useRef<THREE.Points>(null);
  const glowA = useRef<THREE.MeshBasicMaterial>(null);
  const glowB = useRef<THREE.MeshBasicMaterial>(null);
  const ring = useRef<THREE.MeshBasicMaterial>(null);

  const fieldPos = useMemo(() => {
    const count = 160;
    const pos = new Float32Array(count * 3);
    let seed = 29;
    const rnd = () => {
      seed = (seed * 48271) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < count; i++) {
      // Soft elongated cloud — vertical computational field
      const r = 0.08 + rnd() * 0.55;
      const theta = rnd() * Math.PI * 2;
      const y = (rnd() - 0.5) * 1.4;
      const falloff = 1 - Math.abs(y) / 0.9;
      pos[i * 3] = Math.cos(theta) * r * Math.max(0.2, falloff);
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = Math.sin(theta) * r * Math.max(0.2, falloff) * 0.7;
    }
    return pos;
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const level = THREE.MathUtils.clamp(intensity, 0, 1);

    if (group.current && !reducedMotion) {
      // Slow breathing scale — stillness-biased
      const breathe = 1 + Math.sin(t * 0.45) * 0.015 * (0.3 + level);
      group.current.scale.setScalar(breathe);
    }

    if (field.current) {
      const mat = field.current.material as THREE.PointsMaterial;
      mat.opacity = 0.04 + level * 0.42;
      mat.size = 0.008 + level * 0.018;
      if (!reducedMotion) {
        field.current.rotation.y = t * (0.03 + level * 0.06);
      }
    }

    if (glowA.current) {
      glowA.current.opacity = 0.015 + level * 0.12;
    }
    if (glowB.current) {
      glowB.current.opacity = 0.01 + level * 0.09;
    }
    if (ring.current) {
      ring.current.opacity = 0.02 + level * 0.18;
    }
  });

  return (
    <group ref={group} position={JARVIS_PRESENCE}>
      {/* Soft volumetric plates — layered translucent geometry */}
      <mesh rotation={[0.4, 0.2, 0.1]}>
        <circleGeometry args={[0.55, 48]} />
        <meshBasicMaterial
          ref={glowA}
          color="#7dd3fc"
          transparent
          opacity={0.03}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh rotation={[-0.5, -0.3, 0.2]} position={[0.05, 0.1, 0.05]}>
        <circleGeometry args={[0.38, 48]} />
        <meshBasicMaterial
          ref={glowB}
          color="#a5f3fc"
          transparent
          opacity={0.02}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Thin holographic ring — spatial waveform cue */}
      <mesh rotation={[Math.PI / 2.2, 0, 0]} position={[0, -0.15, 0]}>
        <ringGeometry args={[0.32, 0.345, 64]} />
        <meshBasicMaterial
          ref={ring}
          color="#7dd3fc"
          transparent
          opacity={0.04}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Particle concentration */}
      <points ref={field}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[fieldPos, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.01}
          color="#c8eefe"
          transparent
          opacity={0.08}
          depthWrite={false}
          sizeAttenuation
        />
      </points>

      {/* Soft vertical light column — presence, not a logo */}
      <mesh>
        <cylinderGeometry args={[0.015, 0.06, 1.8, 16, 1, true]} />
        <meshBasicMaterial
          color="#7dd3fc"
          transparent
          opacity={0.025 + intensity * 0.1}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
