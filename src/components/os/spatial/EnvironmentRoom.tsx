"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/** Full-screen computational chamber — graphite depth, not outer space */
export function EnvironmentRoom({ reducedMotion }: { reducedMotion: boolean }) {
  const floorMat = useRef<THREE.MeshBasicMaterial>(null);
  const pulse = useRef(0);

  const floorTex = useMemo(() => {
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#05070c";
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = "rgba(120, 160, 190, 0.07)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= size; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(size, i);
      ctx.stroke();
    }
    // faint horizon band cue
    ctx.strokeStyle = "rgba(125, 211, 252, 0.12)";
    ctx.beginPath();
    ctx.moveTo(0, size * 0.72);
    ctx.lineTo(size, size * 0.72);
    ctx.stroke();
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(8, 8);
    return tex;
  }, []);

  useFrame((_, dt) => {
    if (reducedMotion || !floorMat.current) return;
    pulse.current += dt * 0.04;
    floorMat.current.opacity = 0.38 + Math.sin(pulse.current) * 0.02;
  });

  return (
    <group>
      <color attach="background" args={["#03050a"]} />
      <fog attach="fog" args={["#03050a", 7, 22]} />

      <ambientLight intensity={0.14} />
      <directionalLight position={[3, 8, 4]} intensity={0.22} color="#dcecff" />
      <pointLight position={[0, 3.5, 1.2]} intensity={0.85} color="#7dd3fc" distance={16} />
      <pointLight position={[-3, 2, -2]} intensity={0.18} color="#a78bfa" distance={10} />
      <spotLight
        position={[0, 6, 2]}
        angle={0.45}
        penumbra={0.8}
        intensity={0.35}
        color="#b8e7ff"
        castShadow={false}
      />

      {/* FG floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.55, 0]}>
        <planeGeometry args={[48, 48]} />
        <meshBasicMaterial ref={floorMat} map={floorTex} transparent opacity={0.4} />
      </mesh>

      {/* Soft stage disc under Jarvis */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.54, 0.2]}>
        <circleGeometry args={[3.6, 64]} />
        <meshBasicMaterial color="#081422" transparent opacity={0.55} depthWrite={false} />
      </mesh>

      {/* MG / BG wall planes for chamber enclosure */}
      <mesh position={[0, 1.6, -12]}>
        <planeGeometry args={[40, 14]} />
        <meshBasicMaterial color="#060a12" transparent opacity={0.95} />
      </mesh>
      <mesh position={[-10, 1.2, -4]} rotation={[0, Math.PI / 2.6, 0]}>
        <planeGeometry args={[16, 10]} />
        <meshBasicMaterial color="#050910" transparent opacity={0.55} />
      </mesh>
      <mesh position={[10, 1.2, -4]} rotation={[0, -Math.PI / 2.6, 0]}>
        <planeGeometry args={[16, 10]} />
        <meshBasicMaterial color="#050910" transparent opacity={0.55} />
      </mesh>

      {/* Light shafts */}
      <mesh position={[-0.6, 2.2, -1.5]} rotation={[0.2, 0.15, 0.05]}>
        <planeGeometry args={[0.28, 5.5]} />
        <meshBasicMaterial
          color="#7dd3fc"
          transparent
          opacity={0.028}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

export function RoomDust({
  reducedMotion,
  density = 1,
}: {
  reducedMotion: boolean;
  density?: number;
}) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const count = Math.floor(70 * density);
    const pos = new Float32Array(count * 3);
    let seed = 19;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rnd() - 0.5) * 12;
      pos[i * 3 + 1] = rnd() * 3.5 - 0.4;
      pos[i * 3 + 2] = -rnd() * 8 + 1;
    }
    return pos;
  }, [density]);

  useFrame((_, dt) => {
    if (!ref.current || reducedMotion) return;
    ref.current.rotation.y += dt * 0.003;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.01}
        color="#8ecae6"
        transparent
        opacity={0.2}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}
