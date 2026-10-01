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
  reducedMotion: boolean;
  onSelect: () => void;
};

/** Agent chip — only when associated/focused (contextual routing) */
export function AgentChip({
  node,
  focused,
  associated,
  reducedMotion,
  onSelect,
}: Props) {
  const group = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const bodyGeo = useMemo(() => new THREE.BoxGeometry(0.7, 0.34, 0.028), []);
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

  const show = focused || associated;

  useFrame((_, dt) => {
    if (!group.current) return;
    const target = focused
      ? new THREE.Vector3(1.55, 1.05, 1.0)
      : associated
        ? new THREE.Vector3(1.35, 0.95, 0.55)
        : new THREE.Vector3(...node.restPosition);
    if (!show) target.set(2.5, 2, -3);

    const lerp = reducedMotion ? 1 : 1 - Math.exp(-dt * 5.5);
    group.current.position.lerp(target, lerp);
    // Keep Object3D visible so drei <Html> portals are not torn down (removeChild glitch)
    group.current.visible = true;

    const camPos = camera.position.clone();
    camPos.y = group.current.position.y;
    group.current.lookAt(camPos);

    const scaleTarget = show ? (focused ? 1.1 : 1) : 0.01;
    const s = THREE.MathUtils.lerp(group.current.scale.x || 0.01, scaleTarget, lerp);
    group.current.scale.setScalar(Math.max(0.01, s));
  });

  return (
    <group
      ref={group}
      position={node.restPosition}
      scale={0.01}
      onClick={(e) => {
        if (!show) return;
        e.stopPropagation();
        onSelect();
      }}
    >
      <mesh geometry={bodyGeo}>
        <meshPhysicalMaterial
          color="#0a1520"
          emissive="#38bdf8"
          emissiveIntensity={associated || focused ? 0.25 : 0.05}
          transmission={0.35}
          roughness={0.22}
          transparent
          opacity={show ? 0.9 : 0.05}
          thickness={0.2}
        />
      </mesh>
      <mesh position={[0, 0, 0.016]}>
        <planeGeometry args={[0.64, 0.3]} />
        <meshBasicMaterial map={faceTex} transparent opacity={show ? 0.92 : 0.05} depthWrite={false} />
      </mesh>
      <lineSegments geometry={edgeGeo}>
        <lineBasicMaterial color="#7dd3fc" transparent opacity={show ? 0.7 : 0.05} />
      </lineSegments>
      <Html center style={{ pointerEvents: show ? "auto" : "none" }}>
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
            width: 64,
            height: 32,
            opacity: 0,
            border: 0,
            padding: 0,
            background: "transparent",
          }}
        />
      </Html>
    </group>
  );
}
