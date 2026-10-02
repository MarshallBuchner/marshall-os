"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  visualAccent,
  type JarvisVisualState,
} from "@/lib/jarvis/visualState";

type Props = {
  state: JarvisVisualState;
  reducedMotion: boolean;
  audioLevel?: number;
  awake?: boolean;
  /** 0 = full core, 1 = fully dissolved into humanoid particles */
  dissolve?: number;
};

/**
 * 14-layer engineered Jarvis core — density target vs circular reference.
 * Distinct radii / Z / opacity / motion per layer. Not identical circles.
 */
export function JarvisCircularCore({
  state,
  reducedMotion,
  audioLevel = 0,
  awake = false,
  dissolve = 0,
}: Props) {
  const root = useRef<THREE.Group>(null);
  const wake = useRef(0);
  const wasAwake = useRef(false);
  const spinA = useRef<THREE.Group>(null);
  const spinB = useRef<THREE.Group>(null);
  const spinC = useRef<THREE.Group>(null);
  const wave = useRef<THREE.Mesh>(null);
  const dots = useRef<THREE.Points>(null);
  const nucleus = useRef<THREE.MeshPhysicalMaterial>(null);
  const { pointer } = useThree();

  const accent = visualAccent(state);
  const primary = useMemo(() => new THREE.Color(accent.primary), [accent.primary]);
  const secondary = useMemo(
    () => new THREE.Color(accent.secondary),
    [accent.secondary],
  );

  const tickGeo = useMemo(() => buildTicks(1.62, 120), []);
  const capsuleGeo = useMemo(() => buildCapsules(1.28, 36), []);
  const squareGeo = useMemo(() => buildSquares(1.48, 16), []);
  const dotField = useMemo(() => buildDotRing(0.95, 80), []);

  useFrame((st, dt) => {
    if (awake && !wasAwake.current) wake.current = 1;
    wasAwake.current = awake;
    if (wake.current > 0) wake.current = Math.max(0, wake.current - dt * (reducedMotion ? 8 : 1.15));

    const t = st.clock.elapsedTime;
    const w = wake.current;
    const audio = audioLevel;
    const level = accent.intensity + w * 0.35;
    const hide = THREE.MathUtils.clamp(dissolve, 0, 1);
    const visibleCore = 1 - hide;

    if (root.current) {
      root.current.visible = visibleCore > 0.02;
      const targetScale = (1 + w * 0.05 + (reducedMotion ? 0 : Math.sin(t * 0.65) * 0.01)) * (0.85 + visibleCore * 0.15);
      root.current.scale.setScalar(THREE.MathUtils.lerp(root.current.scale.x || 1, targetScale, 0.08));
      if (!reducedMotion) {
        root.current.rotation.y = THREE.MathUtils.lerp(root.current.rotation.y, pointer.x * 0.14, 0.04);
        root.current.rotation.x = THREE.MathUtils.lerp(root.current.rotation.x, -pointer.y * 0.1, 0.04);
      }
      root.current.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = (obj as THREE.Mesh).material as THREE.Material & { opacity?: number };
          if (m && "opacity" in m && typeof m.userData.baseOpacity === "number") {
            m.opacity = m.userData.baseOpacity * visibleCore;
          }
        }
      });
    }

    if (!reducedMotion) {
      if (spinA.current) spinA.current.rotation.z += dt * (accent.spin * 0.4);
      if (spinB.current) spinB.current.rotation.z -= dt * (accent.spin * 0.7 + (state === "UNDERSTANDING" ? 0.1 : 0));
      if (spinC.current) spinC.current.rotation.z += dt * (accent.spin * 1.1);
    }

    if (wave.current) {
      const live = state === "LISTENING" || state === "SPEAKING";
      wave.current.visible = live && visibleCore > 0.2;
      if (live) {
        wave.current.scale.setScalar(1 + audio * 0.5 + Math.sin(t * 7) * 0.03);
        const mat = wave.current.material as THREE.MeshBasicMaterial;
        mat.opacity = (0.3 + audio * 0.45) * visibleCore;
        mat.color.lerp(state === "SPEAKING" ? secondary : primary, 0.2);
      }
    }

    if (dots.current) {
      const mat = dots.current.material as THREE.PointsMaterial;
      mat.opacity = (0.25 + level * 0.4) * visibleCore;
      mat.color.lerp(primary, 0.1);
      if (!reducedMotion) dots.current.rotation.z -= dt * 0.04;
    }

    if (nucleus.current) {
      nucleus.current.emissive.copy(primary);
      nucleus.current.emissiveIntensity = (0.35 + level * 0.75 + audio * 0.35) * visibleCore;
      nucleus.current.opacity = 0.9 * visibleCore;
    }
  });

  const isApproval = state === "WAITING_APPROVAL";

  return (
    <group ref={root} position={[0, 0.1, 0]}>
      {/* L1 ambient glow */}
      <mesh position={[0, 0, -0.4]}>
        <circleGeometry args={[2.55, 64]} />
        <meshBasicMaterial
          color={accent.primary}
          transparent
          opacity={0.12}
          depthWrite={false}
          onUpdate={(m) => {
            m.userData.baseOpacity = 0.12;
          }}
        />
      </mesh>

      {/* L2 depth halo */}
      <mesh position={[0, 0, -0.25]}>
        <ringGeometry args={[1.75, 2.15, 64]} />
        <meshBasicMaterial
          color="#0a1522"
          transparent
          opacity={0.5}
          side={THREE.DoubleSide}
          depthWrite={false}
          onUpdate={(m) => {
            m.userData.baseOpacity = 0.5;
          }}
        />
      </mesh>

      {/* L3 outer ticks */}
      <lineSegments geometry={tickGeo}>
        <lineBasicMaterial color="#e8f1ff" transparent opacity={0.32} />
      </lineSegments>

      {/* L4 outer structural */}
      <group ref={spinA}>
        <Ring r={1.58} w={0.016} z={-0.08} color={accent.primary} opacity={0.35} />
        <Ring r={1.46} w={0.012} z={-0.05} color={accent.primary} opacity={0.28} />
      </group>

      {/* L5 square accents */}
      <lineSegments geometry={squareGeo}>
        <lineBasicMaterial color={accent.primary} transparent opacity={0.4} />
      </lineSegments>

      {/* L6 segmented / capsule band */}
      <group ref={spinB}>
        <lineSegments geometry={capsuleGeo}>
          <lineBasicMaterial color={accent.primary} transparent opacity={0.55} />
        </lineSegments>
      </group>

      {/* L7 mid procedural arc */}
      <group ref={spinC}>
        <mesh position={[0, 0, 0.05]}>
          <ringGeometry args={[1.12, 1.18, 64, 1, 0, Math.PI * 1.4]} />
          <meshBasicMaterial
            color={isApproval ? accent.primary : accent.primary}
            transparent
            opacity={0.55}
            side={THREE.DoubleSide}
            depthWrite={false}
            onUpdate={(m) => {
              m.userData.baseOpacity = 0.55;
            }}
          />
        </mesh>
      </group>

      {/* L8 violet + subtle amber accent arcs (HUD DNA — original, not MCU clone) */}
      <mesh position={[0, 0, 0.06]} rotation={[0, 0, 0.9]}>
        <ringGeometry args={[1.0, 1.04, 48, 1, 0, Math.PI * 0.55]} />
        <meshBasicMaterial
          color="#a78bfa"
          transparent
          opacity={0.22}
          side={THREE.DoubleSide}
          depthWrite={false}
          onUpdate={(m) => {
            m.userData.baseOpacity = 0.22;
          }}
        />
      </mesh>
      <mesh position={[0, 0, 0.065]} rotation={[0, 0, -0.4]}>
        <ringGeometry args={[1.66, 1.695, 64, 1, 0, Math.PI * 0.42]} />
        <meshBasicMaterial
          color="#fbbf24"
          transparent
          opacity={0.16}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          onUpdate={(m) => {
            m.userData.baseOpacity = 0.16;
          }}
        />
      </mesh>
      <mesh position={[0, 0, 0.065]} rotation={[0, 0, 2.4]}>
        <ringGeometry args={[1.34, 1.365, 48, 1, 0, Math.PI * 0.35]} />
        <meshBasicMaterial
          color="#f59e0b"
          transparent
          opacity={0.12}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          onUpdate={(m) => {
            m.userData.baseOpacity = 0.12;
          }}
        />
      </mesh>

      {/* L9 dotted data ring */}
      <points ref={dots}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[dotField, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.018} color={accent.primary} transparent opacity={0.4} sizeAttenuation depthWrite={false} />
      </points>

      {/* L10 inner luminous */}
      <Ring r={0.78} w={0.02} z={0.02} color={accent.primary} opacity={0.5} />
      <Ring r={0.62} w={0.014} z={0.03} color={accent.secondary} opacity={0.35} />

      {/* L11 waveform */}
      <mesh ref={wave} visible={false} position={[0, 0, 0.08]}>
        <ringGeometry args={[0.48, 0.56, 64]} />
        <meshBasicMaterial color={accent.primary} transparent opacity={0.35} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {/* L12 nucleus wash */}
      <mesh position={[0, 0, -0.02]}>
        <circleGeometry args={[0.42, 48]} />
        <meshBasicMaterial
          color={accent.primary}
          transparent
          opacity={0.08}
          depthWrite={false}
          onUpdate={(m) => {
            m.userData.baseOpacity = 0.08;
          }}
        />
      </mesh>

      {/* L13 nucleus */}
      <mesh>
        <sphereGeometry args={[0.24, 48, 48]} />
        <meshPhysicalMaterial
          ref={nucleus}
          color="#071420"
          emissive={accent.primary}
          emissiveIntensity={0.5}
          roughness={0.18}
          metalness={0.15}
          transmission={0.5}
          thickness={0.45}
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* L14 precision diamond */}
      <mesh rotation={[0, 0, Math.PI / 4]}>
        <ringGeometry args={[0.3, 0.318, 4]} />
        <meshBasicMaterial
          color="#f0f7ff"
          transparent
          opacity={0.28}
          side={THREE.DoubleSide}
          onUpdate={(m) => {
            m.userData.baseOpacity = 0.28;
          }}
        />
      </mesh>
    </group>
  );
}

function Ring({
  r,
  w,
  z,
  color,
  opacity,
}: {
  r: number;
  w: number;
  z: number;
  color: string;
  opacity: number;
}) {
  return (
    <mesh position={[0, 0, z]}>
      <ringGeometry args={[r - w, r, 96]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        side={THREE.DoubleSide}
        depthWrite={false}
        onUpdate={(m) => {
          m.userData.baseOpacity = opacity;
        }}
      />
    </mesh>
  );
}

function buildTicks(radius: number, count: number) {
  const pos: number[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const len = i % 10 === 0 ? 0.11 : i % 2 === 0 ? 0.06 : 0.03;
    pos.push(
      Math.cos(a) * radius,
      Math.sin(a) * radius,
      0.02,
      Math.cos(a) * (radius + len),
      Math.sin(a) * (radius + len),
      0.02,
    );
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  return geo;
}

function buildCapsules(radius: number, count: number) {
  const pos: number[] = [];
  for (let i = 0; i < count; i++) {
    if (i % 5 === 0) continue;
    const a0 = (i / count) * Math.PI * 2;
    const a1 = a0 + (0.55 / count) * Math.PI * 2;
    for (let s = 0; s < 4; s++) {
      const t0 = a0 + ((a1 - a0) * s) / 4;
      const t1 = a0 + ((a1 - a0) * (s + 1)) / 4;
      pos.push(
        Math.cos(t0) * radius,
        Math.sin(t0) * radius,
        0.04,
        Math.cos(t1) * radius,
        Math.sin(t1) * radius,
        0.04,
      );
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  return geo;
}

function buildSquares(radius: number, count: number) {
  const pos: number[] = [];
  const s = 0.035;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const cx = Math.cos(a) * radius;
    const cy = Math.sin(a) * radius;
    const corners: [number, number][] = [
      [-s, -s],
      [s, -s],
      [s, s],
      [-s, s],
      [-s, -s],
    ];
    for (let k = 0; k < 4; k++) {
      pos.push(cx + corners[k][0], cy + corners[k][1], 0.03, cx + corners[k + 1][0], cy + corners[k + 1][1], 0.03);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  return geo;
}

function buildDotRing(radius: number, count: number) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    pos[i * 3] = Math.cos(a) * radius;
    pos[i * 3 + 1] = Math.sin(a) * radius;
    pos[i * 3 + 2] = 0.05;
  }
  return pos;
}
