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
  dimmed: boolean;
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
  grad.addColorStop(0.5, "rgba(8, 16, 28, 0.88)");
  grad.addColorStop(1, "rgba(6, 12, 22, 0.94)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const vig = ctx.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, h * 0.7);
  vig.addColorStop(0, "rgba(125, 211, 252, 0.06)");
  vig.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = vig;
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
    const x = 40 + i * 52;
    const y = 280 + Math.sin(i * 0.9) * (18 + (i % 3) * 8);
    ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.fillStyle = "rgba(148, 163, 184, 0.45)";
  ctx.font = "400 18px ui-monospace, monospace";
  ctx.fillText("MODULE SURFACE · DEMO", 40, 640);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Portrait glass surface — faces camera, approaches focus slot.
 * Face content is baked texture; focused detail lives in DOM FocusPanel.
 */
export function GlassModule({
  node,
  focused,
  associated,
  dimmed,
  reducedMotion,
  onSelect,
}: Props) {
  const group = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const accentHex = statusAccent(node.status);
  const accent = useMemo(() => new THREE.Color(accentHex), [accentHex]);
  const isAttention = node.status === "degraded";
  const isDormant = node.status === "not_configured" || node.status === "offline";

  const w = 1.05;
  const h = 1.48;
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
    const target = focused
      ? new THREE.Vector3(...FOCUS_SLOT)
      : new THREE.Vector3(...node.restPosition);

    if (associated && !focused) {
      target.y += 0.1;
      target.z += 0.4;
    }

    const lerp = reducedMotion ? 1 : 1 - Math.exp(-dt * 6.5);
    group.current.position.lerp(target, lerp);

    const camPos = camera.position.clone();
    camPos.y = group.current.position.y;
    group.current.lookAt(camPos);

    const scaleTarget = focused
      ? 1.28
      : associated
        ? node.restScale * 1.08
        : isDormant
          ? node.restScale * 0.92
          : node.restScale;
    const s = THREE.MathUtils.lerp(group.current.scale.x, scaleTarget, lerp);
    group.current.scale.setScalar(s);
  });

  const opacity = dimmed
    ? 0.08
    : focused
      ? 0.95
      : associated
        ? 0.78
        : node.dormancy * (isDormant ? 0.55 : 0.9);

  return (
    <group
      ref={group}
      position={node.restPosition}
      scale={node.restScale}
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
          color={isDormant ? "#0c1218" : "#0a1420"}
          emissive={accent}
          emissiveIntensity={
            focused ? 0.18 : isAttention ? 0.28 : associated ? 0.14 : isDormant ? 0.02 : 0.06
          }
          roughness={0.1}
          metalness={0.08}
          transmission={isDormant ? 0.08 : 0.55}
          thickness={0.6}
          transparent
          opacity={opacity}
          reflectivity={0.55}
          ior={1.45}
        />
      </mesh>

      <mesh position={[0, 0, d * 0.52 + 0.001]}>
        <planeGeometry args={[w * 0.92, h * 0.92]} />
        <meshBasicMaterial
          map={faceTex}
          transparent
          opacity={dimmed ? 0.12 : focused ? 0.95 : associated ? 0.85 : isDormant ? 0.4 : 0.72}
          depthWrite={false}
        />
      </mesh>

      <lineSegments geometry={edgeGeo}>
        <lineBasicMaterial
          color={accent}
          transparent
          opacity={dimmed ? 0.05 : focused ? 0.95 : isAttention ? 0.88 : isDormant ? 0.15 : 0.42}
        />
      </lineSegments>

      {/* DOM hook for tests / assistive click — visually hidden, sized for hit */}
      <Html center style={{ pointerEvents: "auto" }}>
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
            width: 88,
            height: 120,
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
