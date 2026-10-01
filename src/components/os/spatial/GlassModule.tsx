"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { systemStatusLabel } from "@/lib/registry/projects";
import {
  FOCUS_SLOT,
  statusAccent,
  type SpatialSystemNode,
} from "@/lib/registry/spatial";

type Props = {
  node: SpatialSystemNode;
  focused: boolean;
  associated: boolean;
  /** When false, module stays far/invisible — contextual only */
  visible: boolean;
  reducedMotion: boolean;
  onSelect: () => void;
};

function makeFaceTexture(
  label: string,
  status: string,
  accent: string,
  attention: boolean,
): THREE.CanvasTexture {
  const w = 512;
  const h = 720;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "rgba(12, 24, 40, 0.92)");
  grad.addColorStop(1, "rgba(6, 12, 22, 0.94)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = attention ? "rgba(251, 191, 36, 0.35)" : `${accent}33`;
  ctx.fillRect(24, 28, w - 48, 3);
  ctx.font = "500 22px ui-sans-serif, system-ui, sans-serif";
  ctx.fillStyle = attention ? "#fbbf24" : accent;
  ctx.fillText(status.toUpperCase(), 40, 90);
  ctx.font = "600 52px ui-sans-serif, system-ui, sans-serif";
  ctx.fillStyle = "#e8f1ff";
  ctx.fillText(label, 40, 160);
  ctx.strokeStyle = "rgba(125, 211, 252, 0.15)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(40, 280);
  for (let i = 0; i < 8; i++) {
    ctx.lineTo(40 + i * 52, 280 + Math.sin(i * 0.9) * 20);
  }
  ctx.stroke();
  ctx.fillStyle = "rgba(148, 163, 184, 0.45)";
  ctx.font = "400 18px ui-monospace, monospace";
  ctx.fillText("CONTEXTUAL SURFACE · DEMO", 40, 640);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Contextual glass surface — only material when focused / routed / attention */
export function GlassModule({
  node,
  focused,
  associated,
  visible,
  reducedMotion,
  onSelect,
}: Props) {
  const group = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const accentHex = statusAccent(node.status);
  const accent = useMemo(() => new THREE.Color(accentHex), [accentHex]);
  const isAttention = node.status === "degraded";
  const isDormant = node.status === "not_configured" || node.status === "offline";

  const w = 0.95;
  const h = 1.35;
  const d = 0.04;
  const bodyGeo = useMemo(() => new THREE.BoxGeometry(w, h, d), []);
  const edgeGeo = useMemo(() => new THREE.EdgesGeometry(bodyGeo), [bodyGeo]);
  const faceTex = useMemo(
    () =>
      makeFaceTexture(
        node.label,
        systemStatusLabel(node.status),
        accentHex,
        isAttention,
      ),
    [node.label, node.status, accentHex, isAttention],
  );

  useFrame((_, dt) => {
    if (!group.current) return;
    const show = visible || focused || associated;
    const target = focused
      ? new THREE.Vector3(...FOCUS_SLOT)
      : associated
        ? new THREE.Vector3(...node.restPosition).add(new THREE.Vector3(0, 0.1, 0.8))
        : new THREE.Vector3(...node.restPosition);

    if (!show) {
      target.z -= 2;
      target.y -= 0.5;
    }

    const lerp = reducedMotion ? 1 : 1 - Math.exp(-dt * 6);
    group.current.position.lerp(target, lerp);
    // Keep Object3D visible so drei <Html> portals are not torn down (removeChild glitch)
    group.current.visible = true;

    const camPos = camera.position.clone();
    camPos.y = group.current.position.y;
    group.current.lookAt(camPos);

    const scaleTarget = focused
      ? 1.15
      : associated
        ? node.restScale * 1.05
        : show
          ? node.restScale
          : 0.01;
    const s = THREE.MathUtils.lerp(group.current.scale.x || 0.01, scaleTarget, lerp);
    group.current.scale.setScalar(Math.max(0.01, s));
  });

  if (!visible && !focused && !associated) {
    // Still mount for animation out, but skip heavy interaction
  }

  const opacity = focused ? 0.94 : associated ? 0.75 : visible ? 0.55 : 0.05;

  return (
    <group
      ref={group}
      position={node.restPosition}
      scale={0.01}
      onClick={(e) => {
        if (!visible && !focused && !associated) return;
        e.stopPropagation();
        onSelect();
      }}
      onPointerOver={() => {
        if (visible || focused || associated) document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
      }}
    >
      <mesh geometry={bodyGeo}>
        <meshPhysicalMaterial
          color={isDormant ? "#0c1218" : "#0a1420"}
          emissive={accent}
          emissiveIntensity={focused ? 0.2 : isAttention ? 0.28 : 0.08}
          roughness={0.1}
          metalness={0.08}
          transmission={0.5}
          thickness={0.55}
          transparent
          opacity={opacity}
          reflectivity={0.5}
          ior={1.45}
        />
      </mesh>
      <mesh position={[0, 0, d * 0.52 + 0.001]}>
        <planeGeometry args={[w * 0.92, h * 0.92]} />
        <meshBasicMaterial
          map={faceTex}
          transparent
          opacity={focused ? 0.95 : 0.7}
          depthWrite={false}
        />
      </mesh>
      <lineSegments geometry={edgeGeo}>
        <lineBasicMaterial
          color={accent}
          transparent
          opacity={focused ? 0.95 : isAttention ? 0.85 : 0.35}
        />
      </lineSegments>
      <Html
        center
        style={{
          pointerEvents: visible || focused || associated ? "auto" : "none",
          opacity: visible || focused || associated ? 1 : 0,
        }}
      >
        <button
          type="button"
          aria-label={`Focus ${node.label}`}
          data-spatial-node={node.id}
          data-spatial-kind="system"
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          style={{
            width: 80,
            height: 110,
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
