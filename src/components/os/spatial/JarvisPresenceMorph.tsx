"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  PRESENCE_COUNTS,
  Region,
  buildPresenceLayout,
  morphPresence,
  resolvePresenceQuality,
  type PresenceQuality,
} from "@/lib/jarvis/presenceGeometry";
import {
  visualAccent,
  type JarvisVisualState,
  type PresenceMode,
} from "@/lib/jarvis/visualState";

type Props = {
  presence: PresenceMode;
  progress: number;
  state: JarvisVisualState;
  audioLevel: number;
  reducedMotion: boolean;
  quality?: PresenceQuality;
};

/**
 * Continuous particle ownership CORE ↔ abstract humanoid bust.
 * Dense computational reconstruction — staggered regional assembly, eyes last.
 */
export function JarvisPresenceMorph({
  presence,
  progress,
  state,
  audioLevel,
  reducedMotion,
  quality,
}: Props) {
  const tier = useMemo(
    () => quality ?? resolvePresenceQuality("auto"),
    [quality],
  );
  const count = PRESENCE_COUNTS[tier] ?? PRESENCE_COUNTS.HIGH;

  const layout = useMemo(() => buildPresenceLayout(count), [count]);
  const work = useRef<Float32Array | null>(null);
  const group = useRef<THREE.Group>(null);
  const micro = useRef<THREE.Points>(null);
  const medium = useRef<THREE.Points>(null);
  const highlight = useRef<THREE.Points>(null);
  const eyes = useRef<THREE.Points>(null);
  const halo = useRef<THREE.Mesh>(null);
  const energyPulse = useRef(0);

  const layers = useMemo(() => partitionLayers(layout), [layout]);

  const accent = visualAccent(state);
  const color = useMemo(() => new THREE.Color(accent.primary), [accent.primary]);
  const hiColor = useMemo(() => new THREE.Color("#c4e8ff"), []);
  const eyeColor = useMemo(() => new THREE.Color("#e8f4ff"), []);

  useFrame((st) => {
    if (!work.current || work.current.length !== layout.count * 3) {
      work.current = new Float32Array(layout.count * 3);
    }
    const t = st.clock.elapsedTime;
    const current = work.current;

    let morph = 0;
    if (presence === "transforming") morph = progress;
    else if (presence === "humanoid") morph = 1;
    else if (presence === "returning") morph = 1 - progress;
    else morph = 0;

    morphPresence(layout.core, layout.humanoid, morph, layout.delays, current);

    // Idle life + speaking articulation (restrained)
    if (morph > 0.35 && !reducedMotion) {
      const breath = Math.sin(t * 1.15) * 0.01;
      const headYaw = Math.sin(t * 0.35) * 0.012;
      const headPitch = Math.sin(t * 0.28) * 0.008;
      const speaking = state === "SPEAKING";
      const jaw = speaking ? audioLevel * 0.05 : Math.sin(t * 1.4) * 0.005;
      const sternum = speaking ? audioLevel * 0.03 : breath * 0.6;
      energyPulse.current = THREE.MathUtils.lerp(
        energyPulse.current,
        speaking ? 0.35 + audioLevel * 0.5 : 0.12 + Math.sin(t * 2.1) * 0.04,
        0.08,
      );

      for (let i = 0; i < layout.count; i++) {
        const o = i * 3;
        const region = layout.regions[i];
        let x = current[o];
        let y = current[o + 1];
        let z = current[o + 2];

        // Head micro orientation
        if (
          region === Region.CRANIUM ||
          region === Region.BROW ||
          region === Region.ORBIT ||
          region === Region.NOSE ||
          region === Region.CHEEK ||
          region === Region.JAW ||
          region === Region.MOUTH ||
          region === Region.EYE
        ) {
          const y0 = y - 0.85;
          const xz = x;
          x = xz * Math.cos(headYaw) - z * Math.sin(headYaw);
          z = xz * Math.sin(headYaw) + z * Math.cos(headYaw);
          y = 0.85 + y0 * Math.cos(headPitch) - z * Math.sin(headPitch) * 0.15;
        }

        if (region === Region.TORSO || region === Region.SHOULDER) {
          y += breath;
        }
        if (region === Region.JAW || region === Region.MOUTH) {
          y -= jaw * (region === Region.MOUTH ? 1.2 : 0.7);
          if (speaking && region === Region.MOUTH) {
            z += audioLevel * 0.015;
          }
        }
        if (region === Region.ENERGY) {
          const pulse = energyPulse.current;
          x *= 1 + pulse * 0.04;
          y += sternum * 0.4;
          z += pulse * 0.02;
        }
        if (region === Region.DRIFT) {
          const di = i * 0.17;
          x += Math.sin(t * 0.4 + di) * 0.02;
          y += Math.cos(t * 0.33 + di) * 0.015;
        }
        if (region === Region.EYE && speaking) {
          // micro flicker
          y += Math.sin(t * 18 + i) * 0.0015 * audioLevel;
        }

        current[o] = x;
        current[o + 1] = y;
        current[o + 2] = z;
      }
    }

    pushLayer(micro.current, layers.micro, current);
    pushLayer(medium.current, layers.medium, current);
    pushLayer(highlight.current, layers.highlight, current);

    const eyeReveal = THREE.MathUtils.smoothstep(morph, 0.86, 0.98);
    if (eyes.current) {
      eyes.current.visible = eyeReveal > 0.04;
      const em = eyes.current.material as THREE.PointsMaterial;
      em.opacity = eyeReveal * (0.9 + (state === "SPEAKING" ? audioLevel * 0.15 : 0.05));
      em.size = 0.015 + (state === "SPEAKING" ? audioLevel * 0.005 : 0);
      pushLayer(eyes.current, layers.eyes, current);
    }

    const bodyOpacity =
      presence === "core"
        ? 0.12 + accent.particle * 0.2
        : 0.55 + accent.particle * 0.3 + (presence === "transforming" ? 0.08 : 0);

    tintPoints(micro.current, color, bodyOpacity * 0.95, 0.016 + accent.intensity * 0.003);
    tintPoints(medium.current, color, bodyOpacity, 0.024 + accent.intensity * 0.004);
    tintPoints(highlight.current, hiColor, Math.min(0.85, bodyOpacity * 1.05), 0.034);

    // Residual Jarvis halo when humanoid active
    if (halo.current) {
      const haloOn = presence === "humanoid" || (presence === "transforming" && morph > 0.55);
      halo.current.visible = haloOn;
      const hm = halo.current.material as THREE.MeshBasicMaterial;
      hm.opacity = haloOn
        ? presence === "humanoid"
          ? 0.1 + Math.sin(t * 0.9) * 0.02
          : morph * 0.08
        : 0;
      halo.current.rotation.z = t * 0.08;
      const hs = presence === "humanoid" ? 1.02 + Math.sin(t * 0.7) * 0.015 : 0.95 + morph * 0.08;
      halo.current.scale.setScalar(hs);
    }

    if (group.current) {
      const targetY =
        presence === "humanoid" || presence === "transforming" || presence === "returning"
          ? -0.12
          : 0.1;
      group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, targetY, 0.06);
      const s = presence === "humanoid" ? 1.14 : morph > 0.3 ? 1.06 : 1;
      const cur = group.current.scale.x || 1;
      group.current.scale.setScalar(THREE.MathUtils.lerp(cur, s, 0.05));
    }
  });

  return (
    <group ref={group}>
      <points ref={micro}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[layers.micro.seed, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.016}
          color={accent.primary}
          transparent
          opacity={0.72}
          depthWrite={false}
          sizeAttenuation
          blending={THREE.NormalBlending}
        />
      </points>
      <points ref={medium}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[layers.medium.seed, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.024}
          color={accent.primary}
          transparent
          opacity={0.78}
          depthWrite={false}
          sizeAttenuation
          blending={THREE.NormalBlending}
        />
      </points>
      <points ref={highlight}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[layers.highlight.seed, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.034}
          color="#c4e8ff"
          transparent
          opacity={0.7}
          depthWrite={false}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
        />
      </points>
      <points ref={eyes} visible={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[layers.eyes.seed, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.018}
          color={eyeColor}
          transparent
          opacity={0}
          depthWrite={false}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
        />
      </points>
      <mesh ref={halo} rotation={[Math.PI / 2.15, 0, 0]} position={[0, 0.2, -0.12]} visible={false}>
        <ringGeometry args={[0.95, 1.12, 72]} />
        <meshBasicMaterial
          color="#7dd3fc"
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

type Layer = { indices: number[]; seed: Float32Array };

function partitionLayers(layout: ReturnType<typeof buildPresenceLayout>) {
  const microIdx: number[] = [];
  const medIdx: number[] = [];
  const hiIdx: number[] = [];
  const eyeIdx: number[] = [];

  for (let i = 0; i < layout.count; i++) {
    if (layout.regions[i] === Region.EYE) {
      eyeIdx.push(i);
      continue;
    }
    const s = layout.sizes[i];
    if (s >= 1.5) hiIdx.push(i);
    else if (s >= 0.5) medIdx.push(i);
    else microIdx.push(i);
  }

  return {
    micro: makeLayer(microIdx, layout.core),
    medium: makeLayer(medIdx, layout.core),
    highlight: makeLayer(hiIdx, layout.core),
    eyes: makeLayer(eyeIdx, layout.core),
  };
}

function makeLayer(indices: number[], source: Float32Array): Layer {
  const seed = new Float32Array(Math.max(1, indices.length) * 3);
  for (let k = 0; k < indices.length; k++) {
    const i = indices[k];
    seed[k * 3] = source[i * 3];
    seed[k * 3 + 1] = source[i * 3 + 1];
    seed[k * 3 + 2] = source[i * 3 + 2];
  }
  return { indices, seed };
}

function pushLayer(points: THREE.Points | null, layer: Layer, current: Float32Array) {
  if (!points || layer.indices.length === 0) return;
  const attr = points.geometry.getAttribute("position") as THREE.BufferAttribute;
  const arr = attr.array as Float32Array;
  for (let k = 0; k < layer.indices.length; k++) {
    const i = layer.indices[k];
    arr[k * 3] = current[i * 3];
    arr[k * 3 + 1] = current[i * 3 + 1];
    arr[k * 3 + 2] = current[i * 3 + 2];
  }
  attr.needsUpdate = true;
}

function tintPoints(
  points: THREE.Points | null,
  color: THREE.Color,
  opacity: number,
  size: number,
) {
  if (!points) return;
  const mat = points.material as THREE.PointsMaterial;
  mat.color.lerp(color, 0.12);
  mat.opacity = opacity;
  mat.size = size;
}
