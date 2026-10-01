"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/** Dark computational room — depth floor + fog. No stars / galaxy. */
export function EnvironmentRoom({ reducedMotion }: { reducedMotion: boolean }) {
  const floorMat = useRef<THREE.MeshBasicMaterial>(null);
  const pulse = useRef(0);

  const gridTex = useMemo(() => {
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#04080f";
    ctx.fillRect(0, 0, size, size);

    // Soft perspective grid — low contrast so it reads as room floor, not HUD radar
    ctx.strokeStyle = "rgba(100, 180, 230, 0.1)";
    ctx.lineWidth = 1;
    const step = 40;
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

    // One faint depth ellipse — not concentric orbit rings
    ctx.strokeStyle = "rgba(125, 211, 252, 0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(size / 2, size / 2, 160, 90, 0, 0, Math.PI * 2);
    ctx.stroke();

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(8, 8);
    return tex;
  }, []);

  useFrame((_, dt) => {
    if (reducedMotion || !floorMat.current) return;
    pulse.current += dt * 0.06;
    floorMat.current.opacity = 0.42 + Math.sin(pulse.current) * 0.03;
  });

  return (
    <group>
      <color attach="background" args={["#02050a"]} />
      <fog attach="fog" args={["#02050a", 5.5, 18]} />

      <ambientLight intensity={0.18} />
      <directionalLight position={[3, 7, 2]} intensity={0.28} color="#d4eaff" />
      <pointLight position={[0, 3.2, 0.5]} intensity={0.7} color="#7dd3fc" distance={14} />
      <pointLight position={[-3.5, 1.8, -1.5]} intensity={0.22} color="#38bdf8" distance={9} />
      <pointLight position={[2.5, 1.2, 1]} intensity={0.15} color="#a5f3fc" distance={7} />

      {/* Depth floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.25, -1.2]} receiveShadow>
        <planeGeometry args={[48, 48]} />
        <meshBasicMaterial ref={floorMat} map={gridTex} transparent opacity={0.44} />
      </mesh>

      {/* Soft reflective sheen under focus zone — atmospheric, not a pad */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.24, 0.2]}>
        <circleGeometry args={[3.2, 64]} />
        <meshBasicMaterial color="#071420" transparent opacity={0.28} depthWrite={false} />
      </mesh>

      {/* Far wall wash — room enclosure */}
      <mesh position={[0, 1.2, -9]}>
        <planeGeometry args={[36, 10]} />
        <meshBasicMaterial color="#050c14" transparent opacity={0.9} />
      </mesh>

      {/* Single faint light shaft — restrained */}
      <mesh position={[0.4, 1.5, -2.2]} rotation={[0.12, -0.08, 0.04]}>
        <planeGeometry args={[0.22, 4.2]} />
        <meshBasicMaterial
          color="#7dd3fc"
          transparent
          opacity={0.022}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

/** Sparse dust — computational air, not starfield */
export function RoomDust({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const count = 70;
    const pos = new Float32Array(count * 3);
    let seed = 11;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rnd() - 0.5) * 9;
      pos[i * 3 + 1] = rnd() * 2.8 - 0.2;
      pos[i * 3 + 2] = -rnd() * 7 + 0.5;
    }
    return pos;
  }, []);

  useFrame((_, dt) => {
    if (!ref.current || reducedMotion) return;
    ref.current.rotation.y += dt * 0.005;
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
        opacity={0.22}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}
