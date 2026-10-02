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

/** Streamline / wireframe particle points — elongated streaks, not soft blobs */
const VERT = /* glsl */ `
uniform float uSize;
uniform float uSpeak;
attribute float aSize;
attribute float aPop;
attribute float aFlow;
attribute float aStretch;
attribute float aRegion;
varying float vDepth;
varying float vPop;
varying float vSize;
varying float vStretch;
varying float vFlow;
varying float vRegion;

void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDepth = -mv.z;
  vPop = aPop;
  vSize = aSize;
  vStretch = aStretch;
  vFlow = aFlow;
  vRegion = aRegion;
  float atten = 210.0 / max(32.0, -mv.z * 40.0);
  float speakBoost = 1.0 + uSpeak * 0.12;
  gl_PointSize = uSize * (0.45 + aSize * 0.55) * atten * (1.0 + aStretch * 0.85) * speakBoost;
  gl_PointSize = clamp(gl_PointSize, 0.8, 14.0);
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uColorHi;
uniform vec3 uWarm;
uniform float uOpacity;
uniform float uFrontBoost;
uniform float uSpeak;
uniform float uAssemble;
varying float vDepth;
varying float vPop;
varying float vSize;
varying float vStretch;
varying float vFlow;
varying float vRegion;

void main() {
  vec2 c = gl_PointCoord - vec2(0.5);
  // Rotate into streamline axis — thin vertical streaks
  float ca = cos(vFlow);
  float sa = sin(vFlow);
  vec2 r = vec2(ca * c.x - sa * c.y, sa * c.x + ca * c.y);
  float sx = mix(1.0, 0.28, clamp(vStretch, 0.0, 1.0));
  float sy = mix(1.0, 1.55, clamp(vStretch, 0.0, 1.0));
  r.x /= sx;
  r.y /= sy;
  float d = length(r);
  if (d > 0.5) discard;
  float soft = smoothstep(0.5, 0.1, d);
  float grain = 0.85 + 0.15 * fract(sin(dot(gl_PointCoord * 40.0, vec2(12.9898, 78.233))) * 43758.5453);

  float front = clamp((2.8 - vDepth) / 2.4, 0.0, 1.0);
  float depthAlpha = mix(0.22, 1.0, front);
  vec3 col = mix(uColor * 0.5, mix(uColor, uColorHi, 0.4 + front * 0.55), front);
  col = mix(col, uColorHi, uFrontBoost * front * 0.35);

  // Face energy region → warm orange when speaking (restrained, not cartoon eyes)
  float isEnergy = step(9.5, vRegion) * (1.0 - step(10.5, vRegion));
  col = mix(col, mix(uColorHi, uWarm, 0.85), isEnergy * uSpeak * 0.92);

  // Assembling: slight lift + brighter silhouette streams
  col = mix(col, uColorHi, uAssemble * 0.12 * (1.0 - isEnergy));

  float popMul = vPop > 1.5 ? 0.38 : (vPop > 0.5 ? 0.75 : 1.0);
  float alpha = soft * uOpacity * depthAlpha * popMul * (0.8 + vSize * 0.2) * grain;
  // Semi-transparent bust during assemble
  alpha *= mix(1.0, 0.78, uAssemble * 0.55);
  gl_FragColor = vec4(col, alpha);
}
`;

const HOT_VERT = /* glsl */ `
uniform float uSize;
varying float vDepth;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDepth = -mv.z;
  gl_PointSize = uSize * (240.0 / max(32.0, -mv.z * 40.0));
  gl_PointSize = clamp(gl_PointSize, 1.5, 16.0);
  gl_Position = projectionMatrix * mv;
}
`;

const HOT_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vDepth;
void main() {
  vec2 c = gl_PointCoord - vec2(0.5);
  float d = length(c);
  if (d > 0.5) discard;
  float soft = smoothstep(0.5, 0.04, d);
  float core = smoothstep(0.2, 0.0, d);
  vec3 col = mix(uColor, vec3(1.0), core * 0.7);
  gl_FragColor = vec4(col, soft * uOpacity);
}
`;

/**
 * CORE ↔ anatomical humanoid — streamline particle field (Reznikov-class),
 * warm speaking core, throat hotspot, residual JARVIS ring DNA behind.
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
  const body = useRef<THREE.Points>(null);
  const eyes = useRef<THREE.Points>(null);
  const faceWarm = useRef<THREE.Points>(null);
  const throat = useRef<THREE.Points>(null);
  const accents = useRef<THREE.Points>(null);
  const reticle = useRef<THREE.Group>(null);
  const hud = useRef<THREE.Group>(null);
  const energyPulse = useRef(0);
  const speakSmooth = useRef(0);
  const blink = useRef(0);
  const nextBlink = useRef(2.4);
  const gaze = useRef({ x: 0, y: 0 });

  const bodyGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const n = layout.eyeStart;
    const pos = layout.core.slice(0, n * 3);
    const aSize = new Float32Array(n);
    const aPop = new Float32Array(n);
    const aFlow = new Float32Array(n);
    const aStretch = new Float32Array(n);
    const aRegion = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      aSize[i] = layout.sizes[i];
      aPop[i] = layout.populations[i];
      aFlow[i] = layout.flow[i];
      aStretch[i] = layout.stretch[i];
      aRegion[i] = layout.regions[i];
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(aSize, 1));
    g.setAttribute("aPop", new THREE.BufferAttribute(aPop, 1));
    g.setAttribute("aFlow", new THREE.BufferAttribute(aFlow, 1));
    g.setAttribute("aStretch", new THREE.BufferAttribute(aStretch, 1));
    g.setAttribute("aRegion", new THREE.BufferAttribute(aRegion, 1));
    g.computeBoundingSphere();
    return g;
  }, [layout]);

  const eyeGeom = useMemo(() => sliceGeom(layout, layout.eyeStart, layout.eyeCount), [layout]);
  const faceGeom = useMemo(
    () => sliceGeom(layout, layout.faceEnergyStart, layout.faceEnergyCount),
    [layout],
  );
  const throatGeom = useMemo(
    () => sliceGeom(layout, layout.throatStart, layout.throatCount),
    [layout],
  );
  const accentGeom = useMemo(() => buildAccentParticles(48), []);

  const bodyMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uSize: { value: 2.2 },
          uOpacity: { value: 0.78 },
          uColor: { value: new THREE.Color("#38bdf8") },
          uColorHi: { value: new THREE.Color("#e0f2fe") },
          uWarm: { value: new THREE.Color("#fb923c") },
          uFrontBoost: { value: 0.3 },
          uSpeak: { value: 0 },
          uAssemble: { value: 0 },
        },
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending,
        toneMapped: false,
      }),
    [],
  );

  const eyeMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uSize: { value: 3.6 },
          uOpacity: { value: 0 },
          uColor: { value: new THREE.Color("#f0f9ff") },
        },
        vertexShader: HOT_VERT,
        fragmentShader: HOT_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [],
  );

  const warmMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uSize: { value: 4.5 },
          uOpacity: { value: 0 },
          uColor: { value: new THREE.Color("#f97316") },
        },
        vertexShader: HOT_VERT,
        fragmentShader: HOT_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [],
  );

  const throatMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uSize: { value: 5.5 },
          uOpacity: { value: 0 },
          uColor: { value: new THREE.Color("#67e8f9") },
        },
        vertexShader: HOT_VERT,
        fragmentShader: HOT_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [],
  );

  const accentMat = useMemo(
    () =>
      new THREE.PointsMaterial({
        size: 0.018,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        sizeAttenuation: true,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  const accent = visualAccent(state);

  useFrame((st, dt) => {
    if (!work.current || work.current.length !== layout.count * 3) {
      work.current = new Float32Array(layout.count * 3);
    }
    const t = st.clock.elapsedTime;
    const current = work.current;
    const frameDt = Math.min(0.05, dt);

    let morph = 0;
    if (presence === "transforming") morph = progress;
    else if (presence === "humanoid") morph = 1;
    else if (presence === "returning") morph = 1 - progress;
    else morph = 0;

    const assembling =
      presence === "transforming" || (presence === "returning" && morph > 0.15 && morph < 0.95)
        ? 1
        : presence === "humanoid"
          ? 0
          : 0;
    const assembleAmt =
      presence === "transforming"
        ? THREE.MathUtils.smoothstep(morph, 0.08, 0.92)
        : presence === "returning"
          ? THREE.MathUtils.smoothstep(1 - morph, 0.08, 0.92)
          : 0;

    morphPresence(
      layout.core,
      layout.humanoid,
      morph,
      layout.delays,
      current,
      layout.curve,
    );

    // `__JARVIS_FORCE_SPEAK__` — screenshot/demo hook only; production uses SPEAKING + audioLevel
    const forceSpeak =
      typeof window !== "undefined" &&
      Boolean((window as unknown as { __JARVIS_FORCE_SPEAK__?: boolean }).__JARVIS_FORCE_SPEAK__);
    const speaking = state === "SPEAKING" || forceSpeak;
    const level = forceSpeak ? 0.62 + Math.sin(t * 9) * 0.22 : audioLevel;
    speakSmooth.current = THREE.MathUtils.lerp(
      speakSmooth.current,
      speaking ? 0.55 + level * 0.45 : 0,
      0.12,
    );

    if (morph > 0.3 && !reducedMotion) {
      const breath = Math.sin(t * 1.1) * 0.012;
      const headYaw = Math.sin(t * 0.32) * 0.014;
      const headPitch = Math.sin(t * 0.26) * 0.009;
      const jaw = speaking ? level * 0.052 : Math.sin(t * 1.35) * 0.004;
      const sternum = speaking ? level * 0.03 : breath * 0.55;
      energyPulse.current = THREE.MathUtils.lerp(
        energyPulse.current,
        speaking ? 0.4 + level * 0.5 : 0.1 + Math.sin(t * 2.0) * 0.035,
        0.1,
      );

      gaze.current.x = Math.sin(t * 0.17) * 0.006;
      gaze.current.y = Math.sin(t * 0.21 + 1.2) * 0.004;
      nextBlink.current -= frameDt;
      if (nextBlink.current <= 0) {
        blink.current = 1;
        nextBlink.current = 2.2 + Math.random() * 3.4;
      }
      if (blink.current > 0) blink.current = Math.max(0, blink.current - frameDt * 5.5);
      const blinkAmt = blink.current > 0.5 ? (1 - blink.current) * 2 : blink.current * 2;
      const lidClose = Math.min(1, blinkAmt);

      for (let i = 0; i < layout.count; i++) {
        const o = i * 3;
        const region = layout.regions[i];
        let x = current[o];
        let y = current[o + 1];
        let z = current[o + 2];

        // Assembling: shoulder streams dissolve/stream downward
        if (assembling && (region === Region.SHOULDER || region === Region.TORSO)) {
          const localT = Math.max(0, Math.min(1, (morph - (layout.delays[i] ?? 0)) / 0.22));
          const stream = (1 - localT) * assembleAmt;
          y -= stream * 0.12;
          x += Math.sin(t * 2.2 + i * 0.05) * stream * 0.04;
          z -= stream * 0.06;
        }

        if (
          region === Region.CRANIUM ||
          region === Region.BROW ||
          region === Region.ORBIT ||
          region === Region.NOSE ||
          region === Region.CHEEK ||
          region === Region.JAW ||
          region === Region.MOUTH ||
          region === Region.EYE ||
          region === Region.SILHOUETTE
        ) {
          const y0 = y - 0.85;
          const xz = x;
          x = xz * Math.cos(headYaw) - z * Math.sin(headYaw);
          z = xz * Math.sin(headYaw) + z * Math.cos(headYaw);
          y = 0.85 + y0 * Math.cos(headPitch) - z * Math.sin(headPitch) * 0.15;
        }

        if (region === Region.TORSO || region === Region.SHOULDER) y += breath;
        if (region === Region.JAW || region === Region.MOUTH) {
          y -= jaw * (region === Region.MOUTH ? 1.2 : 0.7);
          if (speaking && region === Region.MOUTH) z += audioLevel * 0.014;
        }
        if (region === Region.ENERGY) {
          const pulse = energyPulse.current;
          // Face cluster vs throat vs filament — amplify with speak
          if (i >= layout.faceEnergyStart && i < layout.faceEnergyStart + layout.faceEnergyCount) {
            const s = speakSmooth.current;
            x *= 1 + s * 0.08;
            y += Math.sin(t * 8 + i) * 0.004 * s;
            z += 0.01 * s;
          } else if (i >= layout.throatStart && i < layout.throatStart + layout.throatCount) {
            const pulseT = 0.15 + Math.sin(t * 3.2) * 0.04 + speakSmooth.current * 0.12;
            x *= 1 + pulseT * 0.05;
            z += pulseT * 0.01;
          } else {
            x *= 1 + pulse * 0.035;
            y += sternum * 0.35;
            z += pulse * 0.018;
          }
        }
        if (region === Region.DRIFT) {
          const di = i * 0.17;
          x += Math.sin(t * 0.38 + di) * 0.03;
          y += Math.cos(t * 0.31 + di) * 0.02;
          // Topographic drift layers
          z -= 0.02 + Math.sin(t * 0.2 + di) * 0.01;
        }
        if (region === Region.ORBIT && lidClose > 0.01) {
          const dist = Math.hypot(x - (x < 0 ? -0.125 : 0.125), y - 0.985);
          if (dist < 0.08) {
            y -= lidClose * 0.018;
            z -= lidClose * 0.006;
          }
        }
        if (region === Region.EYE) {
          x += gaze.current.x;
          y += gaze.current.y - lidClose * 0.01;
        }
        if (layout.populations[i] === 0 && layout.stretch[i] > 0.45) {
          // Streamline shimmer along flow
          y += Math.sin(t * 4.2 + i * 0.11) * 0.0015;
        }

        current[o] = x;
        current[o + 1] = y;
        current[o + 2] = z;
      }
    }

    pushRange(body.current, current, 0, layout.eyeStart);
    pushRange(faceWarm.current, current, layout.faceEnergyStart, layout.faceEnergyCount);
    pushRange(throat.current, current, layout.throatStart, layout.throatCount);

    const eyeReveal = THREE.MathUtils.smoothstep(morph, 0.86, 0.98);
    if (eyes.current) {
      eyes.current.visible = eyeReveal > 0.04 && speakSmooth.current < 0.85;
      eyeMat.uniforms.uOpacity.value = eyeReveal * (0.55 - speakSmooth.current * 0.25);
      eyeMat.uniforms.uSize.value = 3.2;
      pushRange(eyes.current, current, layout.eyeStart, layout.eyeCount);
    }

    // Warm face core — SPEAKING driven (ElevenLabs audioLevel compatible)
    if (faceWarm.current) {
      const on = morph > 0.55 && speakSmooth.current > 0.04;
      faceWarm.current.visible = on;
      warmMat.uniforms.uOpacity.value = on
        ? speakSmooth.current * (0.55 + level * 0.35)
        : 0;
      warmMat.uniforms.uSize.value = 3.8 + speakSmooth.current * 2.2;
      warmMat.uniforms.uColor.value.set(
        speakSmooth.current > 0.3 ? "#fb923c" : "#38bdf8",
      );
    }

    // Throat cyan point — always on when humanoid mostly formed
    if (throat.current) {
      const on = morph > 0.45;
      throat.current.visible = on;
      throatMat.uniforms.uOpacity.value = on
        ? 0.55 + Math.sin(t * 2.8) * 0.12 + speakSmooth.current * 0.15
        : 0;
      throatMat.uniforms.uSize.value = 5.2 + Math.sin(t * 3.1) * 0.4;
    }

    // Small red/white accent particles during resolve
    if (accents.current) {
      const am = accentMat;
      const show = assembleAmt > 0.15 || presence === "transforming";
      accents.current.visible = show;
      am.opacity = show ? 0.35 + assembleAmt * 0.35 : 0;
      accents.current.rotation.y = t * 0.08;
      const attr = accents.current.geometry.getAttribute("position") as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      for (let i = 0; i < arr.length / 3; i++) {
        const base = i * 3;
        arr[base + 1] += Math.sin(t * 1.5 + i) * 0.0008;
      }
      attr.needsUpdate = true;
    }

    // Thin facial reticle during transforming / early presence
    if (reticle.current) {
      const show = morph > 0.35 && (assembleAmt > 0.2 || morph < 0.98);
      reticle.current.visible = show;
      reticle.current.position.set(gaze.current.x * 2, 0.96 + gaze.current.y * 2, 0.34);
      const opacity = show ? 0.22 + (1 - morph) * 0.2 : 0;
      reticle.current.traverse((obj) => {
        const m = (obj as THREE.Mesh).material as THREE.MeshBasicMaterial;
        if (m && m.opacity !== undefined) m.opacity = opacity;
      });
    }

    const bodyOpacity =
      presence === "core"
        ? 0.12 + accent.particle * 0.15
        : 0.78 + accent.particle * 0.12 + assembleAmt * 0.06;

    bodyMat.uniforms.uOpacity.value = bodyOpacity;
    bodyMat.uniforms.uColor.value.set(accent.primary);
    bodyMat.uniforms.uFrontBoost.value = 0.28 + accent.intensity * 0.25;
    bodyMat.uniforms.uSize.value = tier === "HIGH" ? 2.15 : tier === "MEDIUM" ? 2.45 : 2.8;
    bodyMat.uniforms.uSpeak.value = speakSmooth.current;
    bodyMat.uniforms.uAssemble.value = assembleAmt;

    // Residual JARVIS DNA HUD — denser segmented rings + amber accents (original, not MCU clone)
    if (hud.current) {
      const on = presence === "humanoid" || (presence === "transforming" && morph > 0.4);
      hud.current.visible = on;
      hud.current.rotation.z = t * 0.06;
      const pulse = on
        ? presence === "humanoid"
          ? 0.14 + Math.sin(t * 0.9) * 0.025
          : morph * 0.1
        : 0;
      hud.current.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        const m = mesh.material as THREE.MeshBasicMaterial;
        if (!m || m.opacity === undefined) return;
        const base = typeof m.userData.baseOpacity === "number" ? m.userData.baseOpacity : 0.08;
        m.opacity = base * (pulse / 0.14);
      });
      const hs = presence === "humanoid" ? 1.42 + Math.sin(t * 0.55) * 0.02 : 1.1 + morph * 0.28;
      hud.current.scale.setScalar(hs);
    }

    if (group.current) {
      const targetY =
        presence === "humanoid" || presence === "transforming" || presence === "returning"
          ? -0.02
          : 0.08;
      group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, targetY, 0.06);
      const s =
        presence === "humanoid"
          ? 1.78
          : morph > 0.25
            ? 1.22 + morph * 0.48
            : 1;
      const cur = group.current.scale.x || 1;
      group.current.scale.setScalar(THREE.MathUtils.lerp(cur, s, 0.05));
    }
  });

  return (
    <group ref={group}>
      <points ref={body} geometry={bodyGeom} material={bodyMat} />
      <points ref={eyes} geometry={eyeGeom} material={eyeMat} visible={false} />
      <points ref={faceWarm} geometry={faceGeom} material={warmMat} visible={false} />
      <points ref={throat} geometry={throatGeom} material={throatMat} visible={false} />
      <points ref={accents} geometry={accentGeom} material={accentMat} visible={false} />

      {/* Thin facial reticle — resolving form readability */}
      <group ref={reticle} visible={false} position={[0, 0.96, 0.34]}>
        <mesh>
          <ringGeometry args={[0.055, 0.062, 48]} />
          <meshBasicMaterial
            color="#7dd3fc"
            transparent
            opacity={0.2}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <planeGeometry args={[0.02, 0.002]} />
          <meshBasicMaterial color="#e0f2fe" transparent opacity={0.25} depthWrite={false} />
        </mesh>
        <mesh>
          <planeGeometry args={[0.02, 0.002]} />
          <meshBasicMaterial color="#e0f2fe" transparent opacity={0.25} depthWrite={false} />
        </mesh>
      </group>

      {/* Residual circular telemetry halo — denser DNA behind humanoid */}
      <group ref={hud} position={[0, 0.45, -0.55]} rotation={[Math.PI / 2.12, 0, 0]} visible={false}>
        <HudRing radius={1.05} tube={0.012} opacity={0.11} color="#38bdf8" />
        <HudRing radius={1.18} tube={0.008} opacity={0.09} color="#7dd3fc" segments={96} />
        <HudRing radius={1.32} tube={0.006} opacity={0.07} color="#67e8f9" />
        <HudTicks radius={1.22} count={72} opacity={0.1} color="#a5f3fc" />
        <HudArc radius={1.4} start={0.2} end={1.4} opacity={0.08} color="#38bdf8" />
        <HudArc radius={1.48} start={2.2} end={3.6} opacity={0.07} color="#22d3ee" />
        {/* Subtle gold/amber accent arcs — not MCU branding */}
        <HudArc radius={1.55} start={4.0} end={4.9} opacity={0.09} color="#fbbf24" />
        <HudArc radius={1.12} start={5.2} end={5.9} opacity={0.07} color="#f59e0b" />
        <HudRing radius={1.62} tube={0.004} opacity={0.05} color="#e0f2fe" segments={64} />
      </group>
    </group>
  );
}

function sliceGeom(
  layout: ReturnType<typeof buildPresenceLayout>,
  start: number,
  count: number,
) {
  const g = new THREE.BufferGeometry();
  const n = Math.max(1, count);
  const pos = new Float32Array(n * 3);
  for (let k = 0; k < count; k++) {
    const i = start + k;
    pos[k * 3] = layout.core[i * 3];
    pos[k * 3 + 1] = layout.core[i * 3 + 1];
    pos[k * 3 + 2] = layout.core[i * 3 + 2];
  }
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  return g;
}

function pushRange(
  points: THREE.Points | null,
  current: Float32Array,
  start: number,
  count: number,
) {
  if (!points || count <= 0) return;
  const attr = points.geometry.getAttribute("position") as THREE.BufferAttribute;
  const arr = attr.array as Float32Array;
  for (let k = 0; k < count; k++) {
    const i = start + k;
    arr[k * 3] = current[i * 3];
    arr[k * 3 + 1] = current[i * 3 + 1];
    arr[k * 3 + 2] = current[i * 3 + 2];
  }
  attr.needsUpdate = true;
}

function buildAccentParticles(n: number) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  let s = 911;
  const rnd = () => {
    s = (s * 48271) % 2147483647;
    return (s - 1) / 2147483646;
  };
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 0.35 + rnd() * 0.85;
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = -0.1 + rnd() * 1.4;
    pos[i * 3 + 2] = Math.sin(a) * r * 0.4 - 0.1;
    const warm = rnd() < 0.45;
    col[i * 3] = warm ? 0.98 : 0.9;
    col[i * 3 + 1] = warm ? 0.45 : 0.95;
    col[i * 3 + 2] = warm ? 0.4 : 1.0;
  }
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

function HudRing({
  radius,
  tube,
  opacity,
  color,
  segments = 80,
}: {
  radius: number;
  tube: number;
  opacity: number;
  color: string;
  segments?: number;
}) {
  return (
    <mesh>
      <torusGeometry args={[radius, tube, 6, segments]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        onUpdate={(m) => {
          m.userData.baseOpacity = opacity;
        }}
      />
    </mesh>
  );
}

function HudTicks({
  radius,
  count,
  opacity,
  color,
}: {
  radius: number;
  count: number;
  opacity: number;
  color: string;
}) {
  const geo = useMemo(() => {
    const positions: number[] = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const len = i % 6 === 0 ? 0.055 : 0.028;
      positions.push(
        Math.cos(a) * radius,
        Math.sin(a) * radius,
        0,
        Math.cos(a) * (radius + len),
        Math.sin(a) * (radius + len),
        0,
      );
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return g;
  }, [radius, count]);

  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        onUpdate={(m) => {
          m.userData.baseOpacity = opacity;
        }}
      />
    </lineSegments>
  );
}

function HudArc({
  radius,
  start,
  end,
  opacity,
  color,
}: {
  radius: number;
  start: number;
  end: number;
  opacity: number;
  color: string;
}) {
  const geo = useMemo(() => {
    const segs = 32;
    const positions: number[] = [];
    for (let i = 0; i < segs; i++) {
      const a0 = start + ((end - start) * i) / segs;
      const a1 = start + ((end - start) * (i + 1)) / segs;
      positions.push(
        Math.cos(a0) * radius,
        Math.sin(a0) * radius,
        0,
        Math.cos(a1) * radius,
        Math.sin(a1) * radius,
        0,
      );
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return g;
  }, [radius, start, end]);

  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        onUpdate={(m) => {
          m.userData.baseOpacity = opacity;
        }}
      />
    </lineSegments>
  );
}
