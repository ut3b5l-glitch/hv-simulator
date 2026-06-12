"use client";

/**
 * RaceBroadcast — a Three.js "TV feed" of one simulated running of the race.
 *
 * v3: real-time 3D. Animated horse meshes (the three.js project's classic
 * GLB horse — a professionally animated morph-target gallop cycle, MIT) run
 * a curved floodlit course rendered with perspective cameras, fog, and a
 * pack-tracking shadow light. Elevated trackside camera towers with long
 * lenses cut down the course like a TV outside-broadcast; Happy Valley
 * meetings get the night-race mood (city towers, floodlights, infield
 * screens), Sha Tin the daytime look.
 *
 * The OUTCOME is honest: each playback samples one full finishing order from
 * the model's win probabilities (Plackett–Luce — the same engine as the
 * Monte Carlo panel below it). The animation is choreography around that
 * sampled order. Replay = fresh sample. Photo finishes get broadcast slow-mo.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import type { Race, Runner } from "@/lib/types";

// ── Constants ───────────────────────────────────────────────────────────────

const LENGTH_M = 2.5; // one "length" in metres
const CTRL_S = [0, 0.18, 0.4, 0.62, 0.82, 0.94, 1];

// Silk colours by saddlecloth number (1-indexed), vivid broadcast palette.
const SILKS = [
  "#d94c3d", "#f2f2f2", "#2f63c9", "#f3c83a", "#3f9e4d", "#23211f",
  "#ef7f1a", "#e88bb6", "#2fb3a8", "#7a4fd0", "#98a3ad", "#a3cf4a",
  "#8a5a33", "#8c2f3d",
];
const SILK_ALT = [
  "#ffffff", "#1a1a1a", "#f3c83a", "#1a1a1a", "#ffffff", "#f2f2f2",
  "#ffffff", "#ffffff", "#ffffff", "#f3c83a", "#1a1a1a", "#1a1a1a",
  "#f2f2f2", "#f2f2f2",
];

// Coat tints (multiplied over the model's painted vertex colours):
// bays, chestnuts, a grey, a black.
const COATS = [
  "#94653c", "#a37345", "#7a5434", "#b3814b", "#d8d4d8", "#4c4138",
  "#9e6839", "#86593a",
];

interface ThemeSpec {
  night: boolean;
  sky: number;
  fogNear: number;
  fogFar: number;
  hemiSky: number;
  hemiGround: number;
  hemiInt: number;
  sunColor: number;
  sunInt: number;
  trackA: string;
  trackB: string;
  apron: string;
  infield: string;
  outfield: string;
  boardBg: string;
  boardText: string;
  hkjcBoard: string;
}

const THEMES: Record<"night" | "day", ThemeSpec> = {
  night: {
    night: true,
    sky: 0x070a14,
    fogNear: 160,
    fogFar: 950,
    hemiSky: 0x33405e,
    hemiGround: 0x14301c,
    hemiInt: 1.05,
    sunColor: 0xfff0c8,
    sunInt: 3.0,
    trackA: "#2f7a44",
    trackB: "#28693a",
    apron: "#225c33",
    infield: "#16401f",
    outfield: "#102e17",
    boardBg: "#101114",
    boardText: "#f9ef98",
    hkjcBoard: "#10316e",
  },
  day: {
    night: false,
    sky: 0x9fd2ef,
    fogNear: 260,
    fogFar: 1500,
    hemiSky: 0xbfdcff,
    hemiGround: 0x3f7d38,
    hemiInt: 1.0,
    sunColor: 0xfff6e8,
    sunInt: 2.6,
    trackA: "#58a34c",
    trackB: "#4e9543",
    apron: "#4a8c40",
    infield: "#3f7d38",
    outfield: "#3a7434",
    boardBg: "#f3f3ee",
    boardText: "#16181c",
    hkjcBoard: "#1a4b9e",
  },
};

// ── Race script: sampled outcome + choreography ─────────────────────────────

interface HorseSpec {
  runnerIdx: number;
  cloth: number;
  name: string;
  coat: string;
  silk: string;
  silkAlt: string;
  lane: number; // n-1 = inside rail (barrier 1)
  ctrl: number[];
  phase0: number;
  finishPos: number;
  marginM: number;
  isTopPick: boolean;
}

interface RaceScript {
  horses: HorseSpec[];
  order: number[];
  lengthM: number;
  duration: number;
  winMarginL: number;
  photoFinish: boolean;
}

/** Sample one full finishing order ∝ model win probabilities (Plackett–Luce). */
function sampleOrder(weights: number[]): number[] {
  const n = weights.length;
  const w = weights.map((x) => Math.max(x, 1e-9));
  let total = w.reduce((a, b) => a + b, 0);
  const order: number[] = [];
  for (let pos = 0; pos < n; pos++) {
    let x = Math.random() * total;
    let pick = -1;
    for (let i = 0; i < n; i++) {
      if (w[i] <= 0) continue;
      x -= w[i];
      if (x <= 0) {
        pick = i;
        break;
      }
    }
    if (pick === -1) for (let i = n - 1; i >= 0; i--) if (w[i] > 0) { pick = i; break; }
    order.push(pick);
    total -= w[pick];
    w[pick] = 0;
  }
  return order;
}

/** Catmull–Rom interpolation over the (CTRL_S, v) knots. */
function spline(v: number[], s: number): number {
  const S = CTRL_S;
  const last = S.length - 1;
  if (s <= 0) return v[0];
  if (s >= 1) return v[last];
  let i = 0;
  while (i < last - 1 && s > S[i + 1]) i++;
  const t = (s - S[i]) / (S[i + 1] - S[i]);
  const p0 = v[Math.max(i - 1, 0)];
  const p1 = v[i];
  const p2 = v[i + 1];
  const p3 = v[Math.min(i + 2, last)];
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

function buildScript(runners: Runner[], distanceM: number): RaceScript {
  const n = runners.length;
  const finishOrder = sampleOrder(runners.map((r) => r.win_pct));

  const marginsM: number[] = new Array(n).fill(0);
  let cum = 0;
  for (let pos = 1; pos < n; pos++) {
    const gapL = 0.18 + Math.min(3.5, -Math.log(Math.random()) * (pos <= 3 ? 0.7 : 1.1));
    cum += gapL * LENGTH_M;
    marginsM[pos] = cum;
  }
  const winMarginL = marginsM[1] / LENGTH_M;

  const byBarrier = runners
    .map((_, i) => i)
    .sort((a, b) => (runners[a].barrier ?? a + 1) - (runners[b].barrier ?? b + 1));
  const laneOf: number[] = new Array(n);
  byBarrier.forEach((runnerIdx, rank) => {
    laneOf[runnerIdx] = n - 1 - rank;
  });

  const posOf: number[] = new Array(n);
  finishOrder.forEach((idx, pos) => (posOf[idx] = pos));

  const horses: HorseSpec[] = runners.map((r, i) => {
    const pos = posOf[i];
    const finalOff = -marginsM[pos];
    const style = Math.random();
    const early = style < 0.3 ? 3.5 : style < 0.7 ? 0 : -4.2;
    const jitter = () => (Math.random() - 0.5) * 4.5;
    const c0 = (Math.random() - 0.5) * 1.6;
    const c1 = early + jitter();
    const c2 = early * 0.8 + jitter();
    const c3 = early * 0.45 + jitter();
    let c4: number;
    let c5: number;
    if (pos === 0) {
      c4 = -Math.min(marginsM[1] + 1.5, 2.5 + Math.random() * 2);
      c5 = finalOff - (0.4 + Math.random() * 0.9);
    } else if (pos <= 2) {
      c4 = finalOff * 0.45 + (Math.random() - 0.5) * 1.4;
      c5 = finalOff + Math.random() * 0.7;
    } else {
      c4 = finalOff * 0.55 + (Math.random() - 0.5) * 2;
      c5 = finalOff * 0.85;
    }
    const cloth = r.horse_no ?? i + 1;
    return {
      runnerIdx: i,
      cloth,
      name: r.horse_name,
      coat: COATS[i % COATS.length],
      silk: SILKS[(cloth - 1) % SILKS.length],
      silkAlt: SILK_ALT[(cloth - 1) % SILK_ALT.length],
      lane: laneOf[i],
      ctrl: [c0, c1, c2, c3, c4, c5, finalOff],
      phase0: Math.random() * Math.PI * 2,
      finishPos: pos,
      marginM: marginsM[pos],
      isTopPick: r.rank === 1,
    };
  });

  return {
    horses,
    order: finishOrder,
    lengthM: distanceM,
    duration: 16 + Math.max(0, distanceM - 1000) * 0.012,
    winMarginL,
    photoFinish: winMarginL < 0.3,
  };
}

/** Leader-pace baseline progress 0→1: a jump-and-build start, then flat out. */
function baseProgress(u: number): number {
  const ramp = 0.12;
  const c = 1 / (1 - ramp / 2);
  if (u < ramp) return (c * u * u) / (2 * ramp);
  return c * (ramp / 2 + (u - ramp));
}

function marginText(lengths: number): string {
  if (lengths < 0.12) return "by a nose";
  if (lengths < 0.25) return "by a short head";
  if (lengths < 0.4) return "by a head";
  if (lengths < 0.65) return "by a neck";
  if (lengths < 0.9) return "by half a length";
  if (lengths < 1.4) return "by a length";
  if (lengths < 2.5) return `by ${lengths.toFixed(0)} lengths`;
  return `by ${Math.round(lengths)} lengths — eased down`;
}

// ── Track geometry ──────────────────────────────────────────────────────────
// Ground plane y=0, course: back straight → 100° anticlockwise turn
// (r=170 m) → 330 m home straight to the post at the origin. d = metres run.

const TURN_R = 170;
const TURN_ANG = 1.75;
const HOME = 330;
const RAIL_IN = 0;
const RAIL_OUT = 16;

interface PathPt {
  x: number;
  z: number;
  tx: number;
  tz: number;
  ux: number; // outward normal (inside → outside)
  uz: number;
}

function pathAt(L: number, d: number): PathPt {
  const dHome = L - HOME;
  if (d >= dHome) {
    return { x: d - L, z: 0, tx: 1, tz: 0, ux: 0, uz: -1 };
  }
  const arcLen = TURN_R * TURN_ANG;
  const dArc = dHome - arcLen;
  const cx = -HOME;
  const cz = TURN_R;
  if (d >= dArc) {
    const phi = (d - dHome) / TURN_R;
    const s = Math.sin(phi);
    const c = Math.cos(phi);
    return { x: cx + TURN_R * s, z: cz - TURN_R * c, tx: c, tz: s, ux: s, uz: -c };
  }
  const s0 = Math.sin(-TURN_ANG);
  const c0 = Math.cos(-TURN_ANG);
  const ax = cx + TURN_R * s0;
  const az = cz - TURN_R * c0;
  const back = d - dArc;
  return { x: ax + c0 * back, z: az + s0 * back, tx: c0, tz: s0, ux: s0, uz: -c0 };
}

function laneOffset(lane: number, n: number): number {
  return 2 + 1.25 * (n - 1 - lane);
}

// ── Asset: the animated horse (loaded once per session) ─────────────────────
// Quaternius "Animated Animal Pack" horse (CC0, quaternius.com) — a rigged
// SkinnedMesh with 13 skeletal animations; we run its Gallop cycle. Named
// materials (Main / Main_Dark / Main_Light / Hair) let each runner carry its
// own coat. Repacked to binary GLB by scripts/gltf2glb.py.

interface HorseAsset {
  root: THREE.Object3D;
  gallop: THREE.AnimationClip;
  scale: number; // GLB units → metres (nose-to-tail ≈ 2.9 m)
  yOffset: number;
}

let horseAssetPromise: Promise<HorseAsset> | null = null;

function loadHorseAsset(): Promise<HorseAsset> {
  if (!horseAssetPromise) {
    horseAssetPromise = new GLTFLoader()
      .loadAsync("/models/HorseQuaternius.glb")
      .then((gltf) => {
        const root = gltf.scene;
        const gallop =
          gltf.animations.find((c) => c.name === "Gallop") ?? gltf.animations[0];
        if (!gallop) throw new Error("HorseQuaternius.glb: no animations");
        const bb = new THREE.Box3().setFromObject(root);
        const lenZ = bb.max.z - bb.min.z;
        const scale = 2.9 / lenZ;
        return { root, gallop, scale, yOffset: -bb.min.y * scale };
      });
  }
  return horseAssetPromise;
}

// ── Canvas texture helpers ──────────────────────────────────────────────────

function makeTexture(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function boardTexture(text: string, bg: string, fg: string): THREE.CanvasTexture {
  return makeTexture(1024, 96, (ctx) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1024, 96);
    ctx.fillStyle = fg;
    ctx.font = "800 52px ui-sans-serif, system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 512, 52, 980);
  });
}

function clothTexture(no: number): THREE.CanvasTexture {
  return makeTexture(128, 128, (ctx) => {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = "#121212";
    ctx.font = "800 88px ui-sans-serif, system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(no), 64, 70);
  });
}

function glowTexture(): THREE.CanvasTexture {
  return makeTexture(128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
    g.addColorStop(0, "rgba(255,250,220,1)");
    g.addColorStop(0.25, "rgba(255,248,210,0.45)");
    g.addColorStop(1, "rgba(255,248,210,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  });
}

function windowsTexture(): THREE.CanvasTexture {
  return makeTexture(256, 512, (ctx) => {
    ctx.fillStyle = "#141824";
    ctx.fillRect(0, 0, 256, 512);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let y = 6; y < 504; y += 9) {
      for (let x = 5; x < 250; x += 8) {
        if (rnd() > 0.6) continue;
        ctx.fillStyle = rnd() > 0.85 ? "rgba(170,200,255,0.8)" : "rgba(249,239,152,0.75)";
        ctx.fillRect(x, y, 3, 4);
      }
    }
  });
}

function poleTexture(): THREE.CanvasTexture {
  const t = makeTexture(16, 128, (ctx) => {
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? "#ffffff" : "#c9342b";
      ctx.fillRect(0, i * 16, 16, 16);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// ── The 3D stage ────────────────────────────────────────────────────────────

interface HorseRig {
  outer: THREE.Group;
  mixer: THREE.AnimationMixer;
  bobPhase: number;
}

interface FrameInfo {
  leadX: number;
  order: number[]; // horse indices by current race position
}

interface Stage {
  update(t: number, dt: number, script: RaceScript): FrameInfo;
  resize(): void;
  render(): void;
  dispose(): void;
  setRemaining(rem: number): void;
}

/** Build a flat ground ribbon that follows the course between two offsets. */
function ribbonGeometry(
  L: number,
  d0: number,
  d1: number,
  o0: number,
  o1: number,
  step: number,
  colorAt: (d: number) => THREE.Color,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  for (let d = d0; d < d1; d += step) {
    const p0 = pathAt(L, d);
    const p1 = pathAt(L, Math.min(d + step, d1));
    const col = colorAt(d);
    const ax = p0.x + p0.ux * o0;
    const az = p0.z + p0.uz * o0;
    const bx = p1.x + p1.ux * o0;
    const bz = p1.z + p1.uz * o0;
    const cx2 = p1.x + p1.ux * o1;
    const cz2 = p1.z + p1.uz * o1;
    const ex = p0.x + p0.ux * o1;
    const ez = p0.z + p0.uz * o1;
    positions.push(ax, 0, az, bx, 0, bz, cx2, 0, cz2, ax, 0, az, cx2, 0, cz2, ex, 0, ez);
    for (let k = 0; k < 6; k++) colors.push(col.r, col.g, col.b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

function buildJockey(silk: string, silkAlt: string): THREE.Group {
  const g = new THREE.Group();
  const silkMat = new THREE.MeshLambertMaterial({ color: silk });
  const altMat = new THREE.MeshLambertMaterial({ color: silkAlt });
  const skinMat = new THREE.MeshLambertMaterial({ color: 0xd9a87c });
  const whiteMat = new THREE.MeshLambertMaterial({ color: 0xf0f0f0 });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1c1c1c });

  // Crouched torso, leaning over the neck (+Z = forward).
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.32, 4, 8), silkMat);
  torso.rotation.x = Math.PI / 2 - 0.55;
  torso.position.set(0, 0.3, 0.05);
  g.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 10), skinMat);
  head.position.set(0, 0.46, 0.28);
  g.add(head);
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.105, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    altMat,
  );
  cap.position.copy(head.position).y += 0.015;
  g.add(cap);

  // Arms reaching to the reins.
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.3, 4, 6), silkMat);
    arm.position.set(side * 0.13, 0.3, 0.3);
    arm.rotation.x = Math.PI / 2 - 0.25;
    g.add(arm);
    // Thigh + boot
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.26, 4, 6), whiteMat);
    thigh.position.set(side * 0.17, 0.12, 0.02);
    thigh.rotation.x = -0.9;
    thigh.rotation.z = side * 0.25;
    g.add(thigh);
    const boot = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.2, 4, 6), darkMat);
    boot.position.set(side * 0.21, -0.08, -0.05);
    g.add(boot);
  }
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  return g;
}

function buildStage(
  canvas: HTMLCanvasElement,
  script: RaceScript,
  theme: ThemeSpec,
  asset: HorseAsset,
): Stage {
  const L = script.lengthM;
  const n = script.horses.length;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = theme.night ? 1.15 : 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(theme.sky);
  scene.fog = new THREE.Fog(theme.sky, theme.fogNear, theme.fogFar);

  const camera = new THREE.PerspectiveCamera(28, 16 / 9, 0.5, 3000);

  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(d: T): T => {
    disposables.push(d);
    return d;
  };

  // ── Lights ──
  const hemi = new THREE.HemisphereLight(theme.hemiSky, theme.hemiGround, theme.hemiInt);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(theme.sunColor, theme.sunInt);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -55;
  sun.shadow.camera.right = 55;
  sun.shadow.camera.top = 55;
  sun.shadow.camera.bottom = -55;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 300;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(sun.target);
  // A soft fill from the opposite side so the shaded flank isn't black.
  const fill = new THREE.DirectionalLight(theme.night ? 0x8fa3cc : 0xcfe4ff, 0.5);
  fill.position.set(-60, 50, 80);
  scene.add(fill);

  // ── Ground ──
  const baseMatParams = { vertexColors: true } as const;
  const groundMat = track(new THREE.MeshLambertMaterial(baseMatParams));
  const cTrackA = new THREE.Color(theme.trackA);
  const cTrackB = new THREE.Color(theme.trackB);
  const cApron = new THREE.Color(theme.apron);
  const cInfield = new THREE.Color(theme.infield);
  const cOutfield = new THREE.Color(theme.outfield);

  const groundGroup = new THREE.Group();
  const addRibbon = (o0: number, o1: number, step: number, colorAt: (d: number) => THREE.Color) => {
    const geo = track(ribbonGeometry(L, -120, L + 260, o0, o1, step, colorAt));
    const mesh = new THREE.Mesh(geo, groundMat);
    mesh.receiveShadow = true;
    groundGroup.add(mesh);
  };
  addRibbon(RAIL_IN, RAIL_OUT, 9, (d) => (Math.floor(d / 9) % 2 ? cTrackA : cTrackB));
  addRibbon(RAIL_OUT, 30, 27, () => cApron);
  addRibbon(-44, RAIL_IN, 27, () => cInfield);
  addRibbon(30, 150, 27, () => cOutfield);
  scene.add(groundGroup);

  const basePlane = new THREE.Mesh(
    track(new THREE.CircleGeometry(2600, 48)),
    track(new THREE.MeshLambertMaterial({ color: new THREE.Color(theme.outfield).multiplyScalar(0.85) })),
  );
  basePlane.rotation.x = -Math.PI / 2;
  basePlane.position.y = -0.08;
  scene.add(basePlane);

  // Finish line across the turf
  {
    const p = pathAt(L, L);
    const lineGeo = track(new THREE.PlaneGeometry(0.5, RAIL_OUT));
    const line = new THREE.Mesh(
      lineGeo,
      track(new THREE.MeshBasicMaterial({ color: 0xffffff })),
    );
    line.rotation.x = -Math.PI / 2;
    line.rotation.z = Math.atan2(p.ux, p.uz) + Math.PI / 2;
    line.position.set(p.x + p.ux * (RAIL_OUT / 2), 0.02, p.z + p.uz * (RAIL_OUT / 2));
    scene.add(line);
  }

  // ── Rails: instanced posts + tube bars ──
  const postGeo = track(new THREE.CylinderGeometry(0.035, 0.035, 1.1, 6));
  const railMat = track(new THREE.MeshBasicMaterial({ color: 0xf2f3f6 }));
  const dRail0 = -90;
  const dRail1 = L + 240;
  const postCount = Math.floor((dRail1 - dRail0) / 4) * 2;
  const posts = new THREE.InstancedMesh(postGeo, railMat, postCount);
  {
    const m4 = new THREE.Matrix4();
    let idx = 0;
    for (const off of [RAIL_IN, RAIL_OUT]) {
      for (let d = dRail0; d < dRail1 && idx < postCount; d += 4) {
        const p = pathAt(L, d);
        m4.makeTranslation(p.x + p.ux * off, 0.55, p.z + p.uz * off);
        posts.setMatrixAt(idx++, m4);
      }
    }
    posts.count = idx;
  }
  scene.add(posts);
  for (const off of [RAIL_IN, RAIL_OUT]) {
    const pts: THREE.Vector3[] = [];
    for (let d = dRail0; d <= dRail1; d += 8) {
      const p = pathAt(L, d);
      pts.push(new THREE.Vector3(p.x + p.ux * off, 1.08, p.z + p.uz * off));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.Mesh(
      track(new THREE.TubeGeometry(curve, Math.floor(pts.length * 1.5), 0.05, 6)),
      railMat,
    );
    scene.add(tube);
  }

  // ── Billboards ──
  const texZokki = track(boardTexture("ZOKKI", theme.boardBg, theme.boardText));
  const texPass = track(boardTexture("DAY PASS", theme.boardBg, theme.boardText));
  const texHV = track(boardTexture("跑馬地 HAPPY VALLEY", theme.hkjcBoard, "#f4f6fb"));
  const texHKR = track(boardTexture("HONG KONG RACING", theme.hkjcBoard, "#f4f6fb"));
  const boardGeo = track(new THREE.PlaneGeometry(20, 1.3));
  const boardMats = [texZokki, texPass, texHV, texHKR].map((t) =>
    track(new THREE.MeshBasicMaterial({ map: t })),
  );
  for (let d0 = -60, idx = 0; d0 < L - 6; d0 += 24, idx++) {
    const isHome = d0 > L - HOME;
    const p = pathAt(L, d0 + 12);
    const mat = isHome ? boardMats[2 + (idx % 2)] : boardMats[idx % 3 === 1 ? 1 : 0];
    const board = new THREE.Mesh(boardGeo, mat);
    board.position.set(p.x + p.ux * -1.2, 0.75, p.z + p.uz * -1.2);
    board.rotation.y = Math.atan2(p.ux, p.uz);
    scene.add(board);
  }

  // ── Infield big screens (live distance) ──
  const screenCanvas = document.createElement("canvas");
  screenCanvas.width = 512;
  screenCanvas.height = 140;
  const screenCtx = screenCanvas.getContext("2d")!;
  const screenTex = track(new THREE.CanvasTexture(screenCanvas));
  screenTex.colorSpace = THREE.SRGBColorSpace;
  const drawScreen = (remaining: number) => {
    screenCtx.fillStyle = "#06231d";
    screenCtx.fillRect(0, 0, 512, 140);
    screenCtx.fillStyle = "#f9ef98";
    screenCtx.font = "800 44px ui-sans-serif, system-ui";
    screenCtx.textAlign = "left";
    screenCtx.textBaseline = "middle";
    screenCtx.fillText("ZOKKI", 28, 70);
    screenCtx.fillStyle = "#9ef3c3";
    screenCtx.textAlign = "right";
    screenCtx.font = "800 56px ui-sans-serif, system-ui";
    screenCtx.fillText(`${remaining}M`, 488, 70);
  };
  drawScreen(L);
  const screenGeo = track(new THREE.PlaneGeometry(26, 7));
  const screenMat = track(new THREE.MeshBasicMaterial({ map: screenTex }));
  const legGeo = track(new THREE.BoxGeometry(1, 3.2, 1));
  const legMat = track(new THREE.MeshLambertMaterial({ color: 0x23262e }));
  for (const sd of [L - 60, L - 300]) {
    const p = pathAt(L, sd);
    const sc = new THREE.Mesh(screenGeo, screenMat);
    sc.position.set(p.x + p.ux * -14, 6.6, p.z + p.uz * -14);
    sc.rotation.y = Math.atan2(p.ux, p.uz);
    scene.add(sc);
    for (const lo of [-9, 9]) {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(
        p.x + p.ux * -14 + p.tx * lo,
        1.6,
        p.z + p.uz * -14 + p.tz * lo,
      );
      scene.add(leg);
    }
  }

  // ── City towers + floodlights + stars (the Happy Valley night ring) ──
  if (theme.night) {
    const winTex = track(windowsTexture());
    // fog:false — the lit windows must glow through the haze, not fade to sky.
    const towerMat = track(new THREE.MeshBasicMaterial({ map: winTex, fog: false }));
    const towerGeo = track(new THREE.BoxGeometry(1, 1, 1));
    const positions: { x: number; z: number; w: number; h: number }[] = [];
    const cx = -HOME;
    const cz = TURN_R;
    for (let i = 0; i < 26; i++) {
      const a = -2.9 + i * 0.16;
      const rad = 520 + ((i * 53) % 110);
      positions.push({
        x: cx + rad * Math.sin(a),
        z: cz - rad * Math.cos(a) + 60,
        w: 24 + ((i * 31) % 18),
        h: 50 + ((i * 67) % 85),
      });
    }
    for (let i = 0; i < 22; i++) {
      positions.push({
        x: -780 + i * 46,
        z: 430 + ((i * 37) % 90),
        w: 26 + ((i * 29) % 16),
        h: 55 + ((i * 71) % 90),
      });
    }
    const towers = new THREE.InstancedMesh(towerGeo, towerMat, positions.length);
    const m4 = new THREE.Matrix4();
    positions.forEach((p, i) => {
      m4.makeScale(p.w, p.h, p.w);
      m4.setPosition(p.x, p.h / 2, p.z);
      towers.setMatrixAt(i, m4);
    });
    scene.add(towers);

    // Floodlight masts with additive glow heads
    const glowTex = track(glowTexture());
    const glowMat = track(
      new THREE.SpriteMaterial({
        map: glowTex,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
      }),
    );
    const poleGeo = track(new THREE.CylinderGeometry(0.22, 0.3, 30, 8));
    const poleMat = track(new THREE.MeshLambertMaterial({ color: 0x4a505e }));
    for (let mi = 0; mi < 8; mi++) {
      const md = L - 40 - mi * 190;
      const p = pathAt(L, md);
      const bx = p.x + p.ux * -7;
      const bz = p.z + p.uz * -7;
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(bx, 15, bz);
      scene.add(pole);
      const glow = new THREE.Sprite(glowMat);
      glow.scale.set(16, 16, 1);
      glow.position.set(bx, 30.5, bz);
      scene.add(glow);
    }

    // Stars
    const starGeo = track(new THREE.BufferGeometry());
    const starPos: number[] = [];
    for (let i = 0; i < 420; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 900 + Math.random() * 900;
      const y = 180 + Math.random() * 700;
      starPos.push(Math.cos(a) * r - HOME, y, Math.sin(a) * r + TURN_R);
    }
    starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPos, 3));
    const stars = new THREE.Points(
      starGeo,
      track(new THREE.PointsMaterial({ color: 0xcdd6ee, size: 1.6, sizeAttenuation: false, fog: false })),
    );
    scene.add(stars);
  } else {
    // Daytime: soft cloud sprites + distant tree line ring
    const glowTex = track(glowTexture());
    const cloudMat = track(
      new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, transparent: true, opacity: 0.5, fog: false }),
    );
    for (let i = 0; i < 7; i++) {
      const cl = new THREE.Sprite(cloudMat);
      const a = i * 0.9;
      cl.position.set(Math.cos(a) * 900 - HOME, 220 + (i % 3) * 60, Math.sin(a) * 900 + TURN_R);
      cl.scale.set(420, 130, 1);
      scene.add(cl);
    }
    const hillMat = track(new THREE.MeshLambertMaterial({ color: 0x6f8f6a }));
    const hillGeo = track(new THREE.SphereGeometry(1, 16, 8));
    for (let i = 0; i < 9; i++) {
      const a = -3 + i * 0.55;
      const hill = new THREE.Mesh(hillGeo, hillMat);
      hill.position.set(-HOME + Math.sin(a) * 620, -18, TURN_R - Math.cos(a) * 620 + 60);
      hill.scale.set(260 + (i % 3) * 80, 80 + (i % 4) * 22, 200);
      scene.add(hill);
    }
  }

  // ── Starting gates ──
  {
    const p = pathAt(L, -2);
    const gateMat = track(new THREE.MeshLambertMaterial({ color: 0xdde2ea }));
    const gatePostGeo = track(new THREE.BoxGeometry(0.08, 2.6, 0.08));
    const oMax = laneOffset(0, n) + 1.5;
    for (let o = 1; o <= oMax; o += 1.25) {
      const post = new THREE.Mesh(gatePostGeo, gateMat);
      post.position.set(p.x + p.ux * o, 1.3, p.z + p.uz * o);
      scene.add(post);
    }
    const beam = new THREE.Mesh(track(new THREE.BoxGeometry(oMax - 1, 0.3, 0.12)), gateMat);
    const om = (1 + oMax) / 2;
    beam.position.set(p.x + p.ux * om, 2.6, p.z + p.uz * om);
    beam.rotation.y = Math.atan2(p.tx, p.tz) + Math.PI / 2;
    scene.add(beam);
  }

  // ── Finish post (candy-striped, inside rail) ──
  {
    const p = pathAt(L, L);
    const tex = track(poleTexture());
    tex.repeat.set(1, 3);
    const pole = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.09, 0.09, 4.8, 8)),
      track(new THREE.MeshBasicMaterial({ map: tex })),
    );
    pole.position.set(p.x + p.ux * -0.6, 2.4, p.z + p.uz * -0.6);
    scene.add(pole);
    const disc = new THREE.Mesh(
      track(new THREE.CircleGeometry(0.5, 20)),
      track(new THREE.MeshBasicMaterial({ color: 0xc9342b, side: THREE.DoubleSide })),
    );
    disc.position.set(p.x + p.ux * -0.6, 5.2, p.z + p.uz * -0.6);
    disc.rotation.y = Math.atan2(p.ux, p.uz);
    scene.add(disc);
  }

  // ── Horses ──
  const rigs: HorseRig[] = script.horses.map((h) => {
    const body = cloneSkeleton(asset.root);
    body.scale.setScalar(asset.scale);
    body.position.y = asset.yOffset;
    const coat = new THREE.Color(h.coat);
    body.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      // Bones swing the hooves outside the bind-pose bounds — never cull.
      mesh.frustumCulled = false;
      const src = mesh.material as THREE.MeshStandardMaterial;
      if (!src?.name) return;
      const tint =
        src.name === "Main"
          ? coat.clone()
          : src.name === "Main_Dark"
            ? coat.clone().multiplyScalar(0.6)
            : src.name === "Main_Light"
              ? coat.clone().multiplyScalar(1.3)
              : src.name === "Hair"
                ? coat.clone().multiplyScalar(0.32)
                : null;
      if (tint) {
        const mat = src.clone();
        mat.color = tint;
        mesh.material = track(mat);
      }
    });

    const outer = new THREE.Group();
    outer.add(body);

    // Jockey perched over the withers.
    const jockey = buildJockey(h.silk, h.silkAlt);
    jockey.position.set(0, 1.66, -0.02);
    jockey.scale.setScalar(1.05);
    outer.add(jockey);

    // Saddlecloth numbers on both flanks.
    const cTex = track(clothTexture(h.cloth));
    const cMat = track(new THREE.MeshBasicMaterial({ map: cTex }));
    const cGeo = track(new THREE.PlaneGeometry(0.42, 0.36));
    for (const side of [-1, 1]) {
      const cloth = new THREE.Mesh(cGeo, cMat);
      cloth.position.set(side * 0.4, 1.12, 0.08);
      cloth.rotation.y = side * (Math.PI / 2);
      outer.add(cloth);
    }

    const mixer = new THREE.AnimationMixer(body);
    const action = mixer.clipAction(asset.gallop);
    action.setDuration(0.5 + Math.random() * 0.07); // racing stride ~2 Hz
    action.play();
    mixer.setTime(Math.random() * 2);

    scene.add(outer);
    return { outer, mixer, bobPhase: h.phase0 };
  });

  // ── Director state ──
  // Towers from the gates to L-150, then the classic finish-line shot.
  const stations: { d: number; off: number; h: number }[] = [];
  const nTowers = 5;
  for (let k = 0; k < nTowers; k++) {
    const d = 150 + (k * (L - 300)) / (nTowers - 1);
    stations.push({ d, off: 34 + (k % 3) * 12, h: 6 + (k % 4) * 2.2 });
  }
  stations.push({ d: L + 14, off: 27, h: 6.5 });
  let shotIdx = -1;
  const look = new THREE.Vector3();
  let fovSmooth = 28;

  const xs = new Array<number>(n).fill(0);

  function update(t: number, dt: number, sc: RaceScript): FrameInfo {
    const T = sc.duration;
    const u = Math.min(t / T, 1.35);
    const s = baseProgress(Math.min(u, 1));
    const overrun = Math.max(0, t - T);

    for (let i = 0; i < n; i++) {
      const h = sc.horses[i];
      const sH = Math.min(u, 1);
      let x = s * L + spline(h.ctrl, sH);
      if (overrun > 0) x += (L / T) * overrun * 0.95;
      x += Math.sin(sH * 23 + h.phase0) * 0.35;
      xs[i] = x;
    }
    const sorted = xs.map((x, i) => [x, i] as const).sort((a, b) => b[0] - a[0]);
    const leadX = sorted[0][0];

    // Horses: place along the course, advance the gallop.
    for (let i = 0; i < n; i++) {
      const h = sc.horses[i];
      const o = laneOffset(h.lane, n);
      const p = pathAt(L, xs[i]);
      const rig = rigs[i];
      rig.outer.position.set(p.x + p.ux * o, 0, p.z + p.uz * o);
      rig.outer.rotation.y = Math.atan2(p.tx, p.tz);
      rig.mixer.update(dt);
      // Jockey bob synced loosely to the gallop.
      const jockey = rig.outer.children[1];
      jockey.position.y = 1.66 + Math.sin(t * 12 + rig.bobPhase) * 0.045;
      jockey.rotation.x = Math.sin(t * 12 + rig.bobPhase + 0.8) * 0.05;
    }

    // Director: pick the camera tower, pan, auto-zoom.
    let shot = stations.length - 1;
    for (let i = 0; i < stations.length - 1; i++) {
      if (leadX < stations[i].d + 30) {
        shot = i;
        break;
      }
    }
    const st = stations[shot];
    const sp = pathAt(L, st.d);
    camera.position.set(sp.x + sp.ux * st.off, st.h, sp.z + sp.uz * st.off);

    const front3 = (sorted[0][0] + (sorted[1]?.[0] ?? leadX) + (sorted[2]?.[0] ?? leadX)) / 3;
    const tp = pathAt(L, front3 + 5);
    const rawLook = new THREE.Vector3(
      tp.x + tp.ux * 7 + Math.sin(t * 2.7) * 0.12,
      1.45 + Math.sin(t * 3.3) * 0.06,
      tp.z + tp.uz * 7,
    );
    const dist = camera.position.distanceTo(rawLook);
    const rawFov = THREE.MathUtils.clamp(
      THREE.MathUtils.radToDeg(2 * Math.atan2(5.5, Math.max(dist, 8))),
      7,
      52,
    );
    if (shot !== shotIdx) {
      shotIdx = shot;
      look.copy(rawLook);
      fovSmooth = rawFov;
    } else {
      look.lerp(rawLook, 1 - Math.exp(-dt * 5.5));
      fovSmooth += (rawFov - fovSmooth) * (1 - Math.exp(-dt * 3.2));
    }
    camera.lookAt(look);
    if (Math.abs(camera.fov - fovSmooth) > 0.01) {
      camera.fov = fovSmooth;
      camera.updateProjectionMatrix();
    }

    // Broadcast key light: stays behind-above the camera so the field is
    // always lit toward the lens, and tracks the pack for contact shadows.
    const packP = pathAt(L, front3);
    const kx = camera.position.x - packP.x;
    const kz = camera.position.z - packP.z;
    const kl = Math.hypot(kx, kz) || 1;
    sun.position.set(packP.x + (kx / kl) * 70 + 18, 90, packP.z + (kz / kl) * 70 + 12);
    sun.target.position.set(packP.x, 0, packP.z);
    sun.target.updateMatrixWorld();

    return { leadX, order: sorted.map(([, i]) => i) };
  }

  let lastScreenRem = -1;
  function setRemaining(rem: number) {
    if (rem === lastScreenRem) return;
    lastScreenRem = rem;
    drawScreen(rem);
    screenTex.needsUpdate = true;
  }

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    const cur = renderer.getSize(new THREE.Vector2());
    if (Math.abs(cur.x - w) > 1 || Math.abs(cur.y - h) > 1) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }

  function render() {
    renderer.render(scene, camera);
  }

  function dispose() {
    for (const d of disposables) d.dispose();
    renderer.dispose();
  }

  return { update, resize, render, dispose, setRemaining };
}

// ── HUD state pushed up to React at a low rate ──────────────────────────────

interface HudState {
  caption: string;
  remaining: number;
  top4: { cloth: number; name: string; silk: string; isTopPick: boolean }[];
  flash: number;
}

interface ResultState {
  rows: { pos: number; cloth: number; name: string; silk: string; winPct: number; odds: number | null }[];
  marginLine: string;
  photoFinish: boolean;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function RaceBroadcast({
  race,
  venue,
}: {
  race: Race;
  venue?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const stageRef = useRef<Stage | null>(null);
  const scriptRef = useRef<RaceScript | null>(null);
  const clockRef = useRef(0);
  const speedRef = useRef(1);
  const lastTsRef = useRef<number | null>(null);
  const hudKeyRef = useRef("");
  const leadRef = useRef(0);

  const [status, setStatus] = useState<"idle" | "running" | "finished">("idle");
  const [assets, setAssets] = useState<"loading" | "ready" | "error">("loading");
  const [speed, setSpeed] = useState(1);
  const [hud, setHud] = useState<HudState | null>(null);
  const [result, setResult] = useState<ResultState | null>(null);

  const themeKey = venue === "ST" ? "day" : "night";
  const runners = race.runners;

  speedRef.current = speed;

  const stopLoop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    lastTsRef.current = null;
  }, []);

  const buildResult = useCallback(
    (script: RaceScript): ResultState => {
      const rows = script.order.slice(0, 3).map((hi, pos) => {
        const h = script.horses[hi];
        const r = runners[h.runnerIdx];
        return {
          pos: pos + 1,
          cloth: h.cloth,
          name: h.name,
          silk: h.silk,
          winPct: r.win_pct,
          odds: r.public_odds ?? null,
        };
      });
      const winner = script.horses[script.order[0]];
      return {
        rows,
        marginLine: `${winner.name} wins ${marginText(script.winMarginL)}`,
        photoFinish: script.photoFinish,
      };
    },
    [runners],
  );

  /** Drive HUD state from a frame summary (throttled to actual changes). */
  const pushHud = useCallback(
    (t: number, info: FrameInfo, script: RaceScript) => {
      const T = script.duration;
      const u = Math.min(t / T, 1.35);
      const overrun = Math.max(0, t - T);
      const L = script.lengthM;
      const leadX = info.leadX;
      const remaining = Math.max(0, Math.round((L - leadX) / 25) * 25);
      stageRef.current?.setRemaining(remaining);

      const top4 = info.order.slice(0, 4).map((i) => {
        const h = script.horses[i];
        return { cloth: h.cloth, name: h.name, silk: h.silk, isTopPick: h.isTopPick };
      });
      const winner = script.horses[script.order[0]];
      const second = script.horses[script.order[1]] ?? winner;
      const lead = script.horses[info.order[0]];
      const chaser = script.horses[info.order[Math.min(1, info.order.length - 1)]];
      let caption = "";
      if (u < 0.06) caption = `They're off at ${venue === "ST" ? "Sha Tin" : "Happy Valley"}!`;
      else if (u >= 0.3 && u < 0.42) caption = `${lead.name} takes them along`;
      else if (leadX > L - 360 && leadX < L - 260)
        caption = `They straighten for home — ${lead.name} from ${chaser.name}`;
      else if (u >= 0.9 && u < 1)
        caption = script.photoFinish
          ? `${winner.name} and ${second.name} together!`
          : `${lead.name} kicks for home!`;
      else if (u >= 1 && script.photoFinish && overrun < 1.4) caption = "PHOTO FINISH";
      else if (u >= 1) caption = `${winner.name} wins ${marginText(script.winMarginL)}`;
      const sinceLine = leadX >= L ? Math.min(1, (leadX - L) / 4) : 0;
      const flash = leadX >= L ? Math.max(0, 0.85 - sinceLine * 2.2) : 0;

      const hudKey = `${caption}|${remaining}|${top4.map((x) => x.cloth).join(",")}|${flash > 0.05 ? 1 : 0}`;
      if (hudKey !== hudKeyRef.current) {
        hudKeyRef.current = hudKey;
        setHud({ caption, remaining, top4, flash });
      }
    },
    [venue],
  );

  // Build the stage once assets + canvas are ready.
  useEffect(() => {
    let cancelled = false;
    if (!runners.length) return;
    loadHorseAsset()
      .then((asset) => {
        if (cancelled || !canvasRef.current) return;
        const script = scriptRef.current ?? buildScript(runners, race.distance_m);
        scriptRef.current = script;
        try {
          const stage = buildStage(canvasRef.current, script, THEMES[themeKey], asset);
          stageRef.current = stage;
          stage.resize();
          stage.update(1.2, 0.016, script); // idle teaser frame
          stage.render();
          if (process.env.NODE_ENV === "development") {
            // QA escape hatch: render any race-clock instant deterministically.
            (window as unknown as Record<string, unknown>).__rbRenderAt = (t: number) => {
              const sc = scriptRef.current;
              if (!sc) return -1;
              stage.resize();
              stage.update(Math.max(0, t - 0.02), 5, sc); // converge camera smoothing
              const info = stage.update(t, 0.016, sc);
              stage.render();
              return info.leadX;
            };
          }
          setAssets("ready");
        } catch (e) {
          console.error("RaceBroadcast: WebGL stage failed", e);
          setAssets("error");
        }
      })
      .catch((e) => {
        console.error("RaceBroadcast: horse asset failed", e);
        if (!cancelled) setAssets("error");
      });
    return () => {
      cancelled = true;
      stopLoop();
      stageRef.current?.dispose();
      stageRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [race.race_id, themeKey]);

  const finishRace = useCallback(() => {
    const script = scriptRef.current;
    if (!script) return;
    stopLoop();
    setResult(buildResult(script));
    setStatus("finished");
  }, [buildResult, stopLoop]);

  const play = useCallback(() => {
    const stage = stageRef.current;
    if (!stage || !runners.length) return;
    stopLoop();
    const script = buildScript(runners, race.distance_m);
    scriptRef.current = script;
    setResult(null);
    hudKeyRef.current = "";

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      clockRef.current = script.duration + 2;
      stage.resize();
      const info = stage.update(clockRef.current, 0.016, script);
      stage.render();
      pushHud(clockRef.current, info, script);
      setResult(buildResult(script));
      setStatus("finished");
      return;
    }

    clockRef.current = 0;
    leadRef.current = 0;
    setStatus("running");
    const endAt = script.duration + (script.photoFinish ? 3.4 : 2);
    const step = (ts: number) => {
      const last = lastTsRef.current ?? ts;
      lastTsRef.current = ts;
      let dt = Math.min((ts - last) / 1000, 0.05) * speedRef.current;
      // Broadcast slow-mo through a photo finish.
      const L = script.lengthM;
      if (script.photoFinish && leadRef.current > L - 55 && leadRef.current < L + 6) {
        dt *= 0.45;
      }
      clockRef.current += dt;
      stage.resize();
      const info = stage.update(clockRef.current, dt, script);
      stage.render();
      leadRef.current = info.leadX;
      pushHud(clockRef.current, info, script);
      if (clockRef.current >= endAt) {
        finishRace();
        return;
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  }, [runners, race.distance_m, pushHud, buildResult, finishRace, stopLoop]);

  const skip = useCallback(() => {
    const stage = stageRef.current;
    const script = scriptRef.current;
    if (!stage || !script) return;
    clockRef.current = script.duration + 2;
    const info = stage.update(clockRef.current, 0.016, script);
    stage.render();
    pushHud(clockRef.current, info, script);
    finishRace();
  }, [pushHud, finishRace]);

  useEffect(() => stopLoop, [stopLoop]);

  if (!runners.length) return null;

  return (
    <div className="relative overflow-hidden rounded-card ring-1 ring-white/15 shadow-glass-3">
      <canvas
        ref={canvasRef}
        className="block h-[240px] w-full sm:h-[280px]"
        aria-label="Animated race broadcast"
      />

      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-2.5">
        <span className="num rounded-pill bg-black/55 px-2.5 py-1 text-micro2 font-bold uppercase tracking-eyebrow text-white/90 backdrop-blur-sm">
          R{race.race_number} · {race.distance_m}m · {venue === "ST" ? "Sha Tin" : "Happy Valley"}
        </span>
        {status === "running" && hud && (
          <span className="num rounded-pill bg-black/55 px-2.5 py-1 text-micro2 font-bold text-accent-yellow backdrop-blur-sm">
            {hud.remaining}m
          </span>
        )}
      </div>

      {/* Commentary caption */}
      {status === "running" && hud?.caption && (
        <div className="pointer-events-none absolute inset-x-0 bottom-12 flex justify-center px-4">
          <span
            key={hud.caption}
            className="animate-fade-in rounded-pill bg-black/60 px-3 py-1 text-center text-caption font-semibold text-white backdrop-blur-sm"
          >
            {hud.caption}
          </span>
        </div>
      )}

      {/* Live position ticker — silks row, broadcast style */}
      {status === "running" && hud && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex gap-1.5 overflow-hidden bg-gradient-to-t from-black/70 to-transparent p-2 pt-5">
          {hud.top4.map((h, i) => (
            <span
              key={h.cloth}
              className={`flex min-w-0 items-center gap-1.5 rounded-chip bg-black/55 py-1 pl-1 pr-2 backdrop-blur-sm ${
                h.isTopPick ? "ring-1 ring-accent-yellow/70" : "ring-1 ring-white/15"
              }`}
            >
              <span className="num grid h-5 w-5 shrink-0 place-items-center rounded-[5px] bg-white text-[0.6875rem] font-extrabold text-[#121212]">
                {h.cloth}
              </span>
              <span
                className="h-3 w-1.5 shrink-0 rounded-sm"
                style={{ backgroundColor: h.silk }}
              />
              <span className="num truncate text-micro2 font-semibold text-white/90">
                {i + 1}
                <span className="text-white/50">{["st", "nd", "rd", "th"][i]}</span>{" "}
                {h.name}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* Photo flash at the line */}
      {status === "running" && hud && hud.flash > 0.05 && (
        <div
          className="pointer-events-none absolute inset-0 bg-white"
          style={{ opacity: hud.flash }}
        />
      )}

      {/* Speed / skip controls */}
      {status === "running" && (
        <div className="absolute right-2.5 top-10 flex flex-col gap-1.5">
          <button
            onClick={() => setSpeed((s) => (s === 1 ? 2 : 1))}
            className="tap num rounded-pill bg-black/55 px-2.5 py-1 text-micro2 font-bold text-white/90 ring-1 ring-white/20 backdrop-blur-sm"
          >
            {speed}×
          </button>
          <button
            onClick={skip}
            className="tap rounded-pill bg-black/55 px-2.5 py-1 text-micro2 font-bold text-white/90 ring-1 ring-white/20 backdrop-blur-sm"
          >
            Skip »
          </button>
        </div>
      )}

      {/* Idle overlay — play */}
      {status === "idle" && (
        <button
          onClick={play}
          disabled={assets !== "ready"}
          className="tap absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/45 backdrop-blur-[2px]"
        >
          <span className="grid h-14 w-14 place-items-center rounded-full bg-accent-yellow shadow-glow-yellow">
            {assets === "loading" ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#121212]/30 border-t-[#121212]" />
            ) : (
              <svg viewBox="0 0 24 24" className="ml-1 h-6 w-6 fill-[#121212]">
                <path d="M8 5.5v13l11-6.5z" />
              </svg>
            )}
          </span>
          <span className="text-body font-bold text-white">
            {assets === "error" ? "Broadcast unavailable" : "Watch this race"}
          </span>
          <span className="px-6 text-center text-micro text-white/70">
            {assets === "error"
              ? "This device doesn't support the 3D broadcast"
              : "One running sampled live from the model's probabilities"}
          </span>
        </button>
      )}

      {/* Result overlay */}
      {status === "finished" && result && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[3px]">
          <div className="w-full max-w-sm animate-rise rounded-card bg-[rgba(24,23,21,0.92)] p-4 ring-1 ring-white/20">
            <div className="flex items-center justify-between">
              <span className="eyebrow text-accent-gold">
                {result.photoFinish ? "Photo finish · Result" : "Result"}
              </span>
              <span className="text-micro2 uppercase tracking-eyebrow text-white/45">
                Simulated
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {result.rows.map((row) => (
                <div key={row.pos} className="flex items-center gap-2.5">
                  <span
                    className={`num grid h-6 w-6 shrink-0 place-items-center rounded-chip text-caption font-bold ${
                      row.pos === 1
                        ? "bg-accent-yellow text-[#121212]"
                        : "bg-white/10 text-white/70"
                    }`}
                  >
                    {row.pos}
                  </span>
                  <span className="num grid h-6 w-6 shrink-0 place-items-center rounded-[6px] bg-white text-caption font-extrabold text-[#121212]">
                    {row.cloth}
                  </span>
                  <span className="h-4 w-1.5 shrink-0 rounded-sm" style={{ backgroundColor: row.silk }} />
                  <span className="min-w-0 flex-1 truncate text-callout font-semibold text-white">
                    {row.name}
                  </span>
                  <span className="num shrink-0 text-micro text-white/55">
                    {row.odds ? `@${row.odds.toFixed(1)}` : `${row.winPct.toFixed(0)}%`}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-center text-caption text-white/65">{result.marginLine}</p>
            <button
              onClick={play}
              className="tap butter-panel mt-3 w-full rounded-tile py-2.5 text-body font-bold"
            >
              Run it again
            </button>
            <p className="mt-2 text-center text-micro2 text-white/40">
              Every replay is a fresh sample — entertainment, not a prediction
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
