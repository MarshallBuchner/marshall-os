"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/** Dark computational room — depth floor + fog. Not outer space / galaxy. */
export function EnvironmentRoom({ reducedMotion }: { reducedMotion: boolean }) {
  const floorMat = useRef<THREE.MeshBasicMaterial>(null);
  const pulse = useRef(0);

  const gridTex = useMemo(() => {
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#03070e";
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = "rgba(100, 180, 230, 0.08)";
    ctx.lineWidth = 1;
    const step = 48;
    for (let i = 0; i <= size; i += step) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(size, i);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 6);
    return tex;
  }, []);

  useFrame((_, dt) => {
    if (reducedMotion || !floorMat.current) return;
    pulse.current += dt * 0.05;
    floorMat.current.opacity = 0.32 + Math.sin(pulse.current) * 0.02;
  });

  return (
    <group>
      <color attach="background" args={["#02050a"]} />
      <fog attach="fog" args={["#02050a", 6, 16]} />

      <ambientLight intensity={0.16} />
      <directionalLight position={[2, 6, 4]} intensity={0.25} color="#d4eaff" />
      <pointLight position={[0, 2.2, 1.5]} intensity={0.55} color="#7dd3fc" distance={10} />
      <pointLight position={[-2, 1.5, -1]} intensity={0.12} color="#a78bfa" distance={8} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.35, -0.5]}>
        <planeGeometry args={[36, 36]} />
        <meshBasicMaterial ref={floorMat} map={gridTex} transparent opacity={0.34} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.34, 0.3]}>
        <circleGeometry args={[2.4, 64]} />
        <meshBasicMaterial color="#071420" transparent opacity={0.4} depthWrite={false} />
      </mesh>

      <mesh position={[0, 1.4, -8]}>
        <planeGeometry args={[30, 10]} />
        <meshBasicMaterial color="#040a12" transparent opacity={0.92} />
      </mesh>
    </group>
  );
}

export function RoomDust({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const count = 48;
    const pos = new Float32Array(count * 3);
    let seed = 17;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rnd() - 0.5) * 8;
      pos[i * 3 + 1] = rnd() * 2.4 - 0.2;
      pos[i * 3 + 2] = -rnd() * 5 + 0.5;
    }
    return pos;
  }, []);

  useFrame((_, dt) => {
    if (!ref.current || reducedMotion) return;
    ref.current.rotation.y += dt * 0.004;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.009}
        color="#8ecae6"
        transparent
        opacity={0.18}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}
