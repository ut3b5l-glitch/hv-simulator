"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * The 3D hero: a galloping horse made of data. Thousands of gold/butter/green
 * data points rain down the right side of the hero in vertical streams, lock
 * into their slot in a horse silhouette, shimmer while the shape holds, then
 * stream out below — every particle on its own staggered cycle, so the horse
 * is always ~85% formed while visibly being *made of moving data*. That's the
 * product in one image: raw numbers in, a horse read out.
 *
 * The silhouette is sampled client-side from the galloping-horse glyph (🐎)
 * rasterized to an offscreen canvas — crisp on every platform, zero image
 * assets. Pointer parallax leans the whole form; a faint dust field gives the
 * night-racecourse depth behind it.
 */

const CYCLE = 7; // seconds per particle cycle
const ENTER = 0.13; // fraction of cycle spent raining in
const EXIT = 0.87; // fraction at which the particle streams out

// Zokki accents — weighted so the horse reads gold with butter glints.
const PALETTE: [number, number, number][] = [
  [0xd3 / 255, 0xb3 / 255, 0x58 / 255], // gold
  [0xf9 / 255, 0xef / 255, 0x98 / 255], // butter
  [0x6b / 255, 0xc3 / 255, 0x4b / 255], // green
];

type Cloud = {
  count: number;
  targets: Float32Array; // locked position per particle
  base: Float32Array; // base RGB per particle
  phase: Float32Array; // cycle offset per particle
  drop: Float32Array; // rain-in travel distance per particle
  sway: Float32Array; // horizontal jitter while raining
};

/**
 * Rasterize a glyph and sample its opaque pixels into ~2k particle targets in
 * scene units (shape ~4.4 units wide, centred on origin, slight z depth).
 * Falls back to the Zokki "Z" if the emoji somehow renders empty.
 */
function sampleGlyph(glyph: string): Cloud {
  const S = 220;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

  const draw = (g: string) => {
    ctx.clearRect(0, 0, S, S);
    ctx.font = `${S * 0.86}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    ctx.fillText(g, S / 2, S / 2 + S * 0.04);
    return ctx.getImageData(0, 0, S, S).data;
  };

  let data = draw(glyph);
  let hits = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 120) hits++;
  if (hits < 400) data = draw("Z"); // emoji-less environment — brand mark instead

  // Sample on a grid with in-cell jitter so the cloud looks organic.
  const STEP = 3;
  const pts: number[] = [];
  for (let py = 0; py < S; py += STEP) {
    for (let px = 0; px < S; px += STEP) {
      const a = data[(py * S + px) * 4 + 3];
      if (a > 120) {
        const x = ((px + Math.random() * STEP) / S - 0.5) * 4.4;
        const y = -((py + Math.random() * STEP) / S - 0.5) * 4.4;
        const z = (Math.random() - 0.5) * 0.4;
        pts.push(x, y, z);
      }
    }
  }

  const count = pts.length / 3;
  const targets = new Float32Array(pts);
  const base = new Float32Array(count * 3);
  const phase = new Float32Array(count);
  const drop = new Float32Array(count);
  const sway = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const r = Math.random();
    const c = PALETTE[r < 0.68 ? 0 : r < 0.9 ? 1 : 2];
    base[i * 3] = c[0];
    base[i * 3 + 1] = c[1];
    base[i * 3 + 2] = c[2];
    phase[i] = Math.random();
    drop[i] = 3 + Math.random() * 2.2;
    sway[i] = (Math.random() - 0.5) * 0.5;
  }
  return { count, targets, base, phase, drop, sway };
}

const easeOut = (u: number) => 1 - Math.pow(1 - u, 3);
const easeIn = (u: number) => u * u * u;

function DataHorse() {
  const group = useRef<THREE.Group>(null);
  const geomRef = useRef<THREE.BufferGeometry>(null);
  const cloud = useMemo(() => sampleGlyph("🐎"), []);

  // Position from the *world-space* viewport width (not pixel breakpoints —
  // the camera's visible extent depends on the canvas aspect). Wide screens:
  // the horse canters just inside the right edge, facing the copy. Narrow
  // screens: it drops below the copy, centred and smaller.
  const vw = useThree((s) => s.viewport.width);
  let basePos: [number, number, number];
  let scale: number;
  if (vw > 8) {
    scale = 1;
    basePos = [Math.min(vw / 2 - 2.2 - 0.5, 4.4), -0.1, 0];
  } else if (vw > 5.4) {
    scale = 0.8;
    basePos = [vw / 2 - 1.76 - 0.3, -0.35, 0];
  } else {
    // Narrow screens: the copy owns the middle, so the horse canters in the
    // open sky above the headline — decorative, never behind text.
    scale = 0.38;
    basePos = [0.55, 2.35, 0];
  }

  const positions = useMemo(() => new Float32Array(cloud.count * 3), [cloud]);
  const colors = useMemo(() => new Float32Array(cloud.count * 3), [cloud]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const { count, targets, base, phase, drop, sway } = cloud;

    for (let i = 0; i < count; i++) {
      const local = (t / CYCLE + phase[i]) % 1;
      const tx = targets[i * 3];
      const ty = targets[i * 3 + 1];
      const tz = targets[i * 3 + 2];
      let x = tx;
      let y = ty;
      let b: number; // brightness

      if (local < ENTER) {
        // raining in from above, drifting onto its slot
        const u = local / ENTER;
        const e = easeOut(u);
        y = ty + drop[i] * (1 - e);
        x = tx + sway[i] * (1 - e);
        b = u * u;
      } else if (local < EXIT) {
        // locked in the silhouette — breathe + a shimmer wave sweeping the form
        b = 0.8 + 0.25 * Math.sin(t * 2.1 + ty * 2.4 + tx * 1.3);
      } else {
        // streaming out below
        const u = (local - EXIT) / (1 - EXIT);
        const e = easeIn(u);
        y = ty - drop[i] * 0.8 * e;
        x = tx + sway[i] * e * 0.4;
        b = 1 - u;
      }

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = tz;
      // Additive blending → scaling colour toward black is a per-point fade.
      colors[i * 3] = base[i * 3] * b;
      colors[i * 3 + 1] = base[i * 3 + 1] * b;
      colors[i * 3 + 2] = base[i * 3 + 2] * b;
    }

    const geom = geomRef.current;
    if (geom) {
      geom.attributes.position.needsUpdate = true;
      geom.attributes.color.needsUpdate = true;
    }

    // gentle canter bob + pointer parallax
    if (group.current) {
      const px = state.pointer.x;
      const py = state.pointer.y;
      group.current.position.y = basePos[1] + Math.sin(t * 1.15) * 0.06;
      group.current.rotation.y += (px * 0.16 - group.current.rotation.y) * 0.04;
      group.current.rotation.x += (-py * 0.07 - group.current.rotation.x) * 0.04;
    }
  });

  return (
    <group ref={group} position={basePos} scale={scale}>
      <points>
        <bufferGeometry ref={geomRef}>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.05}
          vertexColors
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
    </group>
  );
}

/** Faint ambient dust — the racecourse night behind the data. */
function Dust() {
  const ref = useRef<THREE.Points>(null);
  const geom = useMemo(() => {
    const N = typeof window !== "undefined" && window.innerWidth < 640 ? 350 : 800;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 26;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 14;
      pos[i * 3 + 2] = -4 - Math.random() * 16;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.004;
  });
  return (
    <points ref={ref} geometry={geom}>
      <pointsMaterial color="#f7f4e8" size={0.028} transparent opacity={0.35} sizeAttenuation depthWrite={false} />
    </points>
  );
}

export default function TrackScene() {
  return (
    <Canvas
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      dpr={[1, 1.75]}
      camera={{ position: [0, 0, 7], fov: 50 }}
      style={{ position: "absolute", inset: 0 }}
    >
      <Dust />
      <DataHorse />
    </Canvas>
  );
}
