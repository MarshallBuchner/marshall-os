"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  visualAccent,
  type JarvisVisualState,
} from "@/lib/jarvis/visualState";

type Props = {
  state: JarvisVisualState;
  reducedMotion: boolean;
  /** 0–1 mic level / waveform energy */
  audioLevel?: number;
};

/**
 * Original circular computational JARVIS — precision instrument aesthetic.
 * Concentric rings, segmented radials, ticks, arcs, layered translucency.
 * Not Marvel artwork. Not a glowing planet. Not a human bust.
 */
export function JarvisCircularCore({
  state,
  reducedMotion,
  audioLevel = 0,
}: Props) {
  const group = useRef<THREE.Group>(null);
  const ringGroup = useRef<THREE.Group>(null);
  const arcRef = useRef<THREE.Mesh>(null);
  const waveRef = useRef<THREE.Mesh>(null);
  const particles = useRef<THREE.Points>(null);

  const accent = visualAccent(state);
  const primary = useMemo(() => new THREE.Color(accent.primary), [accent.primary]);
  const secondary = useMemo(
    () => new THREE.Color(accent.secondary),
    [accent.secondary],
  );

  const tickPositions = useMemo(() => {
    const positions: number[] = [];
    const outer = 1.42;
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const len = i % 6 === 0 ? 0.08 : 0.04;
      positions.push(
        Math.cos(a) * outer,
        Math.sin(a) * outer,
        0,
        Math.cos(a) * (outer + len),
        Math.sin(a) * (outer + len),
        0,
      );
    }
    return new Float32Array(positions);
  }, []);

  const segmentPositions = useMemo(() => {
    const positions: number[] = [];
    const r = 1.18;
    for (let i = 0; i < 24; i++) {
      if (i % 5 === 0) continue; // gaps — segmented band
      const a0 = (i / 24) * Math.PI * 2;
      const a1 = ((i + 0.7) / 24) * Math.PI * 2;
      const steps = 6;
      for (let s = 0; s < steps; s++) {
        const t0 = a0 + ((a1 - a0) * s) / steps;
        const t1 = a0 + ((a1 - a0) * (s + 1)) / steps;
        positions.push(
          Math.cos(t0) * r,
          Math.sin(t0) * r,
          0.01,
          Math.cos(t1) * r,
          Math.sin(t1) * r,
          0.01,
        );
      }
    }
    return new Float32Array(positions);
  }, []);

  const fieldPos = useMemo(() => {
    const count = 120;
    const pos = new Float32Array(count * 3);
    let seed = 41;
    const rnd = () => {
      seed = (seed * 48271) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < count; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 0.35 + rnd() * 1.1;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = Math.sin(a) * r;
      pos[i * 3 + 2] = (rnd() - 0.5) * 0.25;
    }
    return pos;
  }, []);

  useFrame((clockState, dt) => {
    const t = clockState.clock.elapsedTime;
    const level = accent.intensity;
    const pulse =
      1 +
      Math.sin(t * (1.2 + accent.pulse * 8)) * accent.pulse +
      audioLevel * 0.08;

    if (group.current && !reducedMotion) {
      group.current.scale.setScalar(pulse);
    }

    if (ringGroup.current && !reducedMotion) {
      ringGroup.current.rotation.z += dt * accent.spin;
    }

    if (arcRef.current) {
      const mat = arcRef.current.material as THREE.MeshBasicMaterial;
      mat.color.lerp(primary, 0.15);
      mat.opacity = 0.15 + level * 0.45;
      if (!reducedMotion) {
        arcRef.current.rotation.z = -t * (0.15 + accent.spin);
      }
    }

    if (waveRef.current) {
      const listening = state === "LISTENING" || state === "SPEAKING";
      waveRef.current.visible = listening;
      if (listening) {
        const s = 1 + audioLevel * 0.35 + Math.sin(t * 6) * 0.03;
        waveRef.current.scale.setScalar(s);
        const mat = waveRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.2 + audioLevel * 0.35;
        mat.color.lerp(state === "SPEAKING" ? secondary : primary, 0.2);
      }
    }

    if (particles.current) {
      const mat = particles.current.material as THREE.PointsMaterial;
      mat.opacity = accent.particle * (0.5 + level * 0.5);
      mat.size = 0.012 + level * 0.012;
      mat.color.lerp(primary, 0.1);
      if (!reducedMotion) {
        particles.current.rotation.z += dt * 0.03;
      }
    }
  });

  const isApproval = state === "WAITING_APPROVAL";
  const discOpacity = 0.04 + accent.intensity * 0.08;

  return (
    <group ref={group} position={[0, 0.15, 0]}>
      {/* Soft depth disc */}
      <mesh position={[0, 0, -0.08]}>
        <circleGeometry args={[1.65, 64]} />
        <meshBasicMaterial
          color={isApproval ? "#1a1208" : "#061018"}
          transparent
          opacity={0.55}
          depthWrite={false}
        />
      </mesh>

      {/* Inner luminous plate */}
      <mesh position={[0, 0, -0.02]}>
        <circleGeometry args={[0.55, 48]} />
        <meshBasicMaterial
          color={accent.primary}
          transparent
          opacity={discOpacity}
          depthWrite={false}
        />
      </mesh>

      {/* Layered translucent rings */}
      <group ref={ringGroup}>
        {[0.72, 0.95, 1.22, 1.48].map((r, i) => (
          <mesh key={r} position={[0, 0, i * 0.012]}>
            <ringGeometry args={[r - 0.012, r, 96]} />
            <meshBasicMaterial
              color={i === 2 && isApproval ? accent.primary : i % 2 ? accent.secondary : accent.primary}
              transparent
              opacity={0.18 + accent.intensity * 0.25 - i * 0.02}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>

      {/* Segmented radial band */}
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[segmentPositions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          color={accent.primary}
          transparent
          opacity={0.35 + accent.intensity * 0.3}
        />
      </lineSegments>

      {/* Fine tick marks */}
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[tickPositions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#e8f1ff" transparent opacity={0.22 + accent.intensity * 0.15} />
      </lineSegments>

      {/* Procedural arc — data band */}
      <mesh ref={arcRef} position={[0, 0, 0.03]}>
        <ringGeometry args={[1.3, 1.34, 64, 1, 0, Math.PI * 1.2]} />
        <meshBasicMaterial
          color={accent.primary}
          transparent
          opacity={0.35}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Secondary violet accent arc — occasional, restrained */}
      <mesh position={[0, 0, 0.04]} rotation={[0, 0, Math.PI * 0.6]}>
        <ringGeometry args={[1.05, 1.07, 48, 1, 0, Math.PI * 0.45]} />
        <meshBasicMaterial
          color="#a78bfa"
          transparent
          opacity={0.12 + accent.intensity * 0.15}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Listening / speaking waveform ring */}
      <mesh ref={waveRef} visible={false} position={[0, 0, 0.05]}>
        <ringGeometry args={[0.62, 0.68, 64]} />
        <meshBasicMaterial
          color={accent.primary}
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Core nucleus — translucent computational field, not a logo sphere */}
      <mesh>
        <sphereGeometry args={[0.22, 32, 32]} />
        <meshPhysicalMaterial
          color="#0a1622"
          emissive={accent.primary}
          emissiveIntensity={0.25 + accent.intensity * 0.55}
          roughness={0.25}
          metalness={0.15}
          transmission={0.45}
          thickness={0.4}
          transparent
          opacity={0.85}
        />
      </mesh>

      {/* Inner crosshair — precision instrument cue */}
      <mesh rotation={[0, 0, Math.PI / 4]}>
        <ringGeometry args={[0.28, 0.295, 4]} />
        <meshBasicMaterial
          color="#e8f1ff"
          transparent
          opacity={0.15 + accent.intensity * 0.2}
          side={THREE.DoubleSide}
        />
      </mesh>

      <points ref={particles}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[fieldPos, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.014}
          color={accent.primary}
          transparent
          opacity={0.2}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
    </group>
  );
}
