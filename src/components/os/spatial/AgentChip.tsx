"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { SpatialAgentNode } from "@/lib/registry/spatial";

type Props = {
  node: SpatialAgentNode;
  focused: boolean;
  associated: boolean;
  dimmed: boolean;
  reducedMotion: boolean;
  onSelect: () => void;
};

/** Quiet agent surfaces — secondary glass chips in upper air */
export function AgentChip({
  node,
  focused,
  associated,
  dimmed,
  reducedMotion,
  onSelect,
}: Props) {
  const group = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const bodyGeo = useMemo(() => new THREE.BoxGeometry(0.72, 0.36, 0.028), []);
  const edgeGeo = useMemo(() => new THREE.EdgesGeometry(bodyGeo), [bodyGeo]);

  const faceTex = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 160;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "rgba(8, 16, 26, 0.9)";
    ctx.fillRect(0, 0, 320, 160);
    ctx.fillStyle = "rgba(125, 211, 252, 0.25)";
    ctx.fillRect(16, 14, 288, 2);
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "600 28px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(node.label, 20, 70);
    ctx.fillStyle = "#64748b";
    ctx.font = "400 16px ui-monospace, monospace";
    ctx.fillText(node.role.toUpperCase(), 20, 110);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [node.label, node.role]);

  useFrame((_, dt) => {
    if (!group.current) return;
    const target = new THREE.Vector3(...node.restPosition);
    if (associated && !focused) {
      target.y -= 0.12;
      target.z += 0.55;
    }
    if (focused) {
      target.set(1.05, 0.45, 1.35);
    }
    const lerp = reducedMotion ? 1 : 1 - Math.exp(-dt * 5.2);
    group.current.position.lerp(target, lerp);

    const camPos = camera.position.clone();
    camPos.y = group.current.position.y;
    group.current.lookAt(camPos);

    const scaleTarget = focused ? 1.15 : associated ? 1.05 : 0.92;
    const s = THREE.MathUtils.lerp(group.current.scale.x, scaleTarget, lerp);
    group.current.scale.setScalar(s);
  });

  const opacity = dimmed ? 0.08 : focused || associated ? 0.9 : 0.35;

  return (
    <group
      ref={group}
      position={node.restPosition}
      scale={0.92}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onPointerOver={() => {
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
      }}
    >
      <mesh geometry={bodyGeo}>
        <meshPhysicalMaterial
          color="#0a1520"
          emissive="#38bdf8"
          emissiveIntensity={focused || associated ? 0.22 : 0.04}
          transmission={0.35}
          roughness={0.22}
          transparent
          opacity={opacity}
          thickness={0.2}
        />
      </mesh>
      <mesh position={[0, 0, 0.016]}>
        <planeGeometry args={[0.66, 0.32]} />
        <meshBasicMaterial
          map={faceTex}
          transparent
          opacity={dimmed ? 0.1 : focused || associated ? 0.92 : 0.55}
          depthWrite={false}
        />
      </mesh>
      <lineSegments geometry={edgeGeo}>
        <lineBasicMaterial
          color="#7dd3fc"
          transparent
          opacity={dimmed ? 0.06 : focused || associated ? 0.75 : 0.22}
        />
      </lineSegments>
      <Html center style={{ pointerEvents: "auto" }}>
        <button
          type="button"
          aria-label={`Focus agent ${node.label}`}
          data-spatial-node={node.id}
          data-spatial-kind="agent"
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          style={{
            width: 72,
            height: 36,
            opacity: 0,
            border: 0,
            padding: 0,
            cursor: "pointer",
            background: "transparent",
          }}
        />
      </Html>
    </group>
  );
}
