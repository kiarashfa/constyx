import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  CanvasTexture,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  MeshBasicMaterial,
  PlaneGeometry,
  ShaderMaterial,
  type BufferGeometry,
  type Group,
} from 'three';
import { getPeople, type Clip, type FigName, type FigureKit, type PeopleAssets } from './figures';
import { HAZE, HAZE_DENSITY } from './World';

/* ----------------------------------------------------------------- crowd
 * Every walker is one instance of a skinned body: the vertex shader reads
 * the body's bone matrices for the walker's point in its gait from a small
 * float texture, and tints hair, skin and cloth per person through the mask
 * atlas. Near walkers use the detailed mesh, the rest a light one. One shared
 * useFrame moves everybody; nothing here goes through React state.
 */

type V3 = [number, number, number];
export type WalkerKind = 'npc' | 'agent' | 'woman' | 'guide';

export interface Walker {
  kind: WalkerKind;
  fig: FigName;
  x: number;
  y: number;
  z: number;
  /** Unit heading on the ground plane. */
  hx: number;
  hz: number;
  speed: number;
  /** 0..1 through the gait cycle. */
  phase: number;
  scale: number;
  hair: V3;
  skin: V3;
  cloth: V3;
  clip: string;
  /** Held pose blended over the gait (the agent's aim, the guide stopping). */
  pose: string;
  blend: number;
  fade: number;
  active: boolean;
  // movement
  route: 'line' | 'graph' | 'loop' | 'patrol' | 'lead';
  dir: 1 | -1;
  node: number;
  prev: number;
  ox: number;
  oz: number;
  tx: number;
  ty: number;
  tz: number;
  /** Patrol ends / lead progress. */
  a: number;
  b: number;
}

export interface CrowdCtl {
  walkers: Walker[];
  agent: Walker;
  woman: Walker;
  guide: Walker;
  /** The halt: everybody holds mid-stride. */
  frozen: boolean;
  /** The agent has his pistol on the player. */
  aiming: boolean;
  hintRingUntil: number;
}

/* ------------------------------------------------------------------ routes
 * Three coordinates: +x east, +z south. The player walks toward -z.
 */
const WINDOW = 46; // line walkers live within this distance of the player along the street
const Z_MIN = -136;
const Z_MAX = 126;
const CROSS_Z0 = 40;
const CROSS_Z1 = 52;
const ROAD_Y = -0.15;
const TERRACE_Y = 2.16;

/** Plaza waypoints: the footpath side, the middle, the foot and head of both stairs, the terrace. */
const NODES: V3[] = [
  [10.5, 0, -40],
  [10.5, 0, -28],
  [10.5, 0, -16],
  [19, 0, -41.2],
  [17.5, 0, -28],
  [19, 0, -14.8],
  [29.4, 0, -41.5],
  [34.6, TERRACE_Y, -41.5],
  [29.4, 0, -14.5],
  [34.6, TERRACE_Y, -14.5],
  [40, TERRACE_Y, -38],
  [40, TERRACE_Y, -18],
  [15, 0, -21],
  [15, 0, -35],
  [21, 0, -22.5],
  [21, 0, -33.5],
];
const STAIR_NODES = new Set([6, 7, 8, 9]);
const EDGES: [number, number][] = [
  [0, 3], [0, 4], [1, 3], [1, 4], [1, 5], [2, 4], [2, 5], [3, 4], [4, 5],
  [3, 6], [5, 8], [6, 7], [8, 9], [7, 10], [9, 11], [10, 11],
  [12, 2], [12, 4], [12, 14], [12, 5], [13, 0], [13, 4], [13, 15], [13, 3], [14, 5], [14, 4], [15, 3], [15, 4], [14, 15],
];
const NEIGHBOURS: number[][] = NODES.map((_, i) => EDGES.filter((e) => e.includes(i)).map((e) => (e[0] === i ? e[1] : e[0])));

/** Her walk: round the plaza, along the pool kerb past the cascade. */
const HER_LOOP: V3[] = [
  [23.0, 0, -39.6],
  [20.6, 0, -28],
  [23.0, 0, -16.4],
  [14, 0, -17],
  [11.5, 0, -28],
  [14, 0, -39],
];

/** The guide leads along the footpath and into the plaza, stopping by the pool. */
const LEAD: [number, number][] = [
  [5.2, 50.5],
  [5.2, -13],
  [13.5, -21],
  [17.2, -25.5],
];
const LEAD_AHEAD = 4.2;

function seeded(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

// Tints multiply the neutral colours baked into the atlas.
const HAIR: V3[] = [
  [0.07, 0.065, 0.06], [0.07, 0.065, 0.06], [0.16, 0.11, 0.07], [0.28, 0.19, 0.11], [0.95, 0.80, 0.50],
  [1.25, 1.08, 0.70], [0.55, 0.54, 0.52], [0.42, 0.20, 0.11],
];
const SKIN: V3[] = [
  [1.0, 0.97, 0.94], [1.0, 0.97, 0.94], [0.96, 0.9, 0.85], [0.84, 0.74, 0.66], [0.62, 0.48, 0.4], [0.42, 0.31, 0.27],
];
const BLACK: V3 = [0.055, 0.058, 0.06];
const CLOTH: V3[] = [BLACK, BLACK, BLACK, BLACK, BLACK, BLACK, BLACK, [0.10, 0.105, 0.11], [0.085, 0.09, 0.10], [0.06, 0.075, 0.12]];
const WHITES: V3 = [1.55, 1.62, 1.55]; // the sailors

function blank(kind: WalkerKind, fig: FigName): Walker {
  return {
    kind, fig, x: 0, y: 0, z: 0, hx: 0, hz: 1, speed: 1.3, phase: 0, scale: 1,
    hair: HAIR[0], skin: SKIN[0], cloth: BLACK, clip: 'walk', pose: 'stand', blend: 0, fade: 1, active: true,
    route: 'line', dir: 1, node: 0, prev: 0, ox: 0, oz: 0, tx: 0, ty: 0, tz: 0, a: 0, b: 0,
  };
}

function dress(w: Walker, rand: () => number): void {
  const figs: FigName[] = ['man', 'man', 'man2', 'woman', 'woman2', 'woman'];
  w.fig = figs[Math.floor(rand() * figs.length)];
  w.hair = HAIR[Math.floor(rand() * HAIR.length)];
  w.skin = SKIN[Math.floor(rand() * SKIN.length)];
  w.cloth = rand() < 0.035 && w.fig === 'man' ? WHITES : CLOTH[Math.floor(rand() * CLOTH.length)];
  if (w.fig === 'man2' && rand() < 0.5) w.hair = rand() < 0.5 ? w.skin.map((c, i) => c * [1.2, 1.0, 0.92][i]) as V3 : HAIR[6];
  w.scale = (w.fig.startsWith('woman') ? 1.02 : 0.98) + rand() * 0.07;
  w.speed = 1.15 + rand() * 0.4;
  w.phase = rand();
}

function aimGraph(w: Walker, node: number): void {
  const stairs = STAIR_NODES.has(node);
  w.prev = w.node;
  w.node = node;
  w.tx = NODES[node][0] + (stairs ? 0 : w.ox);
  w.ty = NODES[node][1];
  w.tz = NODES[node][2] + (stairs ? Math.sign(w.oz || 1) * (0.7 + Math.abs(w.oz)) : w.oz);
}

export function makeCrowd(seed: number): CrowdCtl {
  const rand = seeded(9000 + seed * 7919);
  const walkers: Walker[] = [];
  // the footpath you walk up: almost everybody is coming toward you
  for (let i = 0; i < 190; i++) {
    const w = blank('npc', 'man');
    dress(w, rand);
    const against = rand() < 0.86;
    w.dir = against ? 1 : -1;
    w.x = against ? 4.3 + rand() * 4.0 : 3.6 + rand() * 0.8;
    w.z = SPAWN_Z + (rand() * 2 - 1) * WINDOW;
    // people in the same strip of the path keep the same pace, so few walk through each other
    w.speed = 1.12 + ((w.x * 1.7) % 1) * 0.4;
    walkers.push(w);
  }
  // the far footpath, both ways
  for (let i = 0; i < 26; i++) {
    const w = blank('npc', 'man');
    dress(w, rand);
    w.dir = rand() < 0.5 ? 1 : -1;
    w.x = w.dir > 0 ? -12.9 + rand() * 1.2 : -11.5 + rand() * 1.2;
    w.z = SPAWN_Z + (rand() * 2 - 1) * WINDOW;
    walkers.push(w);
  }
  // the plaza: crossing between the footpath, the stairs and the terrace
  for (let i = 0; i < 125; i++) {
    const w = blank('npc', 'man');
    dress(w, rand);
    w.route = 'graph';
    w.ox = (rand() * 2 - 1) * 1.3;
    w.oz = (rand() * 2 - 1) * 1.3;
    const e = EDGES[Math.floor(rand() * EDGES.length)];
    const flip = rand() < 0.5;
    w.node = flip ? e[0] : e[1];
    aimGraph(w, flip ? e[1] : e[0]);
    const from = NODES[w.prev];
    const t = rand();
    const sx = from[0] + (STAIR_NODES.has(w.prev) ? 0 : w.ox);
    const sz = from[2] + (STAIR_NODES.has(w.prev) ? Math.sign(w.oz || 1) * (0.7 + Math.abs(w.oz)) : w.oz);
    w.x = sx + (w.tx - sx) * t;
    w.y = from[1] + (w.ty - from[1]) * t;
    w.z = sz + (w.tz - sz) * t;
    walkers.push(w);
  }
  // her
  const woman = blank('woman', 'red');
  woman.route = 'loop';
  woman.hair = [1.3, 1.1, 0.66];
  woman.skin = [1.04, 0.98, 0.93];
  woman.scale = 1.06;
  woman.speed = 1.05;
  woman.node = 1;
  [woman.x, woman.y, woman.z] = HER_LOOP[0];
  [woman.tx, woman.ty, woman.tz] = HER_LOOP[1];
  // the agent: posted on a short beat somewhere along your way, a different place each load
  const agent = blank('agent', 'man');
  agent.route = 'patrol';
  agent.clip = 'stiff';
  agent.pose = 'aim';
  agent.hair = [0.13, 0.09, 0.06];
  agent.skin = [1.0, 0.95, 0.9];
  agent.cloth = [0.075, 0.08, 0.085];
  agent.scale = 1.04;
  agent.speed = 0.95;
  if (rand() < 0.3) {
    agent.x = 12.5 + rand() * 3;
    const c = -34 + rand() * 12;
    agent.a = c - 5;
    agent.b = c + 5;
  } else {
    agent.x = rand() < 0.5 ? 4.7 : 7.6;
    const c = -6 + rand() * 36;
    agent.a = c - 6;
    agent.b = c + 6;
  }
  agent.z = (agent.a + agent.b) / 2;
  // the guide
  const guide = blank('guide', 'guide');
  guide.route = 'lead';
  guide.hair = [0.07, 0.06, 0.055];
  guide.skin = [0.4, 0.3, 0.26];
  guide.cloth = [0.09, 0.09, 0.095];
  guide.scale = 1.04;
  guide.x = LEAD[0][0];
  guide.z = LEAD[0][1];
  guide.hz = -1;
  walkers.push(woman, agent, guide);
  return { walkers, agent, woman, guide, frozen: false, aiming: false, hintRingUntil: 0 };
}

const SPAWN_Z = 54;

/* -------------------------------------------------------------- movement */

function leadLength(): number[] {
  const acc = [0];
  for (let i = 1; i < LEAD.length; i++) acc.push(acc[i - 1] + Math.hypot(LEAD[i][0] - LEAD[i - 1][0], LEAD[i][1] - LEAD[i - 1][1]));
  return acc;
}
const LEAD_ACC = leadLength();

function leadAt(s: number): [number, number, number, number] {
  const c = Math.max(0, Math.min(LEAD_ACC[LEAD_ACC.length - 1], s));
  let i = 1;
  while (i < LEAD.length - 1 && LEAD_ACC[i] < c) i++;
  const t = (c - LEAD_ACC[i - 1]) / (LEAD_ACC[i] - LEAD_ACC[i - 1]);
  const [ax, az] = LEAD[i - 1];
  const [bx, bz] = LEAD[i];
  const len = Math.hypot(bx - ax, bz - az);
  return [ax + (bx - ax) * t, az + (bz - az) * t, (bx - ax) / len, (bz - az) / len];
}

function leadProgress(px: number, pz: number): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 1; i < LEAD.length; i++) {
    const [ax, az] = LEAD[i - 1];
    const [bx, bz] = LEAD[i];
    const l2 = (bx - ax) ** 2 + (bz - az) ** 2;
    const t = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (pz - az) * (bz - az)) / l2));
    const d = Math.hypot(px - (ax + (bx - ax) * t), pz - (az + (bz - az) * t));
    if (d < bestD) {
      bestD = d;
      best = LEAD_ACC[i - 1] + t * Math.sqrt(l2);
    }
  }
  return best;
}

function turnToward(w: Walker, dx: number, dz: number, rate: number): void {
  const len = Math.hypot(dx, dz);
  if (len < 1e-4) return;
  const hx = w.hx + ((dx / len) - w.hx) * rate;
  const hz = w.hz + ((dz / len) - w.hz) * rate;
  const n = Math.hypot(hx, hz) || 1;
  w.hx = hx / n;
  w.hz = hz / n;
}

function step(w: Walker, dt: number, px: number, pz: number, ctl: CrowdCtl, stride: number): void {
  let moved = w.speed * dt;
  if (w.route === 'line') {
    w.z += w.dir * moved;
    if (w.z > pz + WINDOW) w.z -= 2 * WINDOW;
    else if (w.z < pz - WINDOW) w.z += 2 * WINDOW;
    w.hx = 0;
    w.hz = w.dir;
    w.y = w.z > CROSS_Z0 && w.z < CROSS_Z1 ? ROAD_Y : 0;
    w.fade = Math.max(0, Math.min(1, (WINDOW - Math.abs(w.z - pz)) / 5));
    w.active = w.z > Z_MIN && w.z < Z_MAX;
  } else if (w.route === 'graph' || w.route === 'loop') {
    const dx = w.tx - w.x;
    const dz = w.tz - w.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.25) {
      if (w.route === 'loop') {
        w.node = (w.node + 1) % HER_LOOP.length;
        [w.tx, w.ty, w.tz] = HER_LOOP[w.node];
      } else {
        const options = NEIGHBOURS[w.node].filter((n) => n !== w.prev);
        const pick = options.length ? options[Math.floor(Math.random() * options.length)] : w.prev;
        aimGraph(w, pick);
      }
    } else {
      turnToward(w, dx, dz, 1 - Math.exp(-6 * dt));
      w.x += w.hx * moved;
      w.z += w.hz * moved;
      w.y += ((w.ty - w.y) * Math.min(1, moved / dist));
    }
  } else if (w.route === 'patrol') {
    if (ctl.aiming) {
      turnToward(w, px - w.x, pz - w.z, 1 - Math.exp(-9 * dt));
      w.blend = Math.min(1, w.blend + dt * 4);
      moved = 0;
    } else {
      w.blend = Math.max(0, w.blend - dt * 4);
      w.z += w.dir * moved;
      if (w.z > w.b) w.dir = -1;
      if (w.z < w.a) w.dir = 1;
      turnToward(w, 0, w.dir, 1 - Math.exp(-5 * dt));
    }
  } else {
    // The guide keeps a few paces ahead and waits when you fall behind
    const want = Math.min(LEAD_ACC[LEAD_ACC.length - 1], leadProgress(px, pz) + LEAD_AHEAD);
    const gap = want - w.a;
    const v = Math.max(0, Math.min(1.75, gap * 1.4));
    moved = v * dt;
    w.a += moved;
    const [x, z, hx, hz] = leadAt(w.a);
    w.x = x;
    w.z = z;
    w.y = z > CROSS_Z0 && z < CROSS_Z1 ? ROAD_Y : 0;
    const waiting = v < 0.25;
    w.blend += ((waiting ? 1 : 0) - w.blend) * (1 - Math.exp(-5 * dt));
    if (waiting && w.a > LEAD_ACC[LEAD_ACC.length - 1] - 0.5) turnToward(w, px - x, pz - z, 1 - Math.exp(-3 * dt));
    else turnToward(w, hx, hz, 1 - Math.exp(-6 * dt));
  }
  w.phase = (w.phase + moved / (stride * w.scale)) % 1;
}

/* ---------------------------------------------------------------- shader */

const VERTEX = /* glsl */ `
  uniform sampler2D uBones;
  attribute vec4 skinIndex;
  attribute vec4 skinWeight;
  attribute vec4 aAnim;   // frame within the clip, clip start row, clip length, fade
  attribute vec2 aBlend;  // held-pose row, its weight
  attribute vec3 aHair;
  attribute vec3 aSkin;
  attribute vec3 aCloth;
  varying vec2 vUv;
  varying vec3 vHair;
  varying vec3 vSkin;
  varying vec3 vCloth;
  varying float vFade;
  varying float vDepth;

  mat4 boneAt(float bone, float row) {
    int x = int(bone + 0.5) * 4;
    int y = int(row + 0.5);
    return mat4(texelFetch(uBones, ivec2(x, y), 0), texelFetch(uBones, ivec2(x + 1, y), 0),
                texelFetch(uBones, ivec2(x + 2, y), 0), texelFetch(uBones, ivec2(x + 3, y), 0));
  }

  mat4 skinAt(float row) {
    return boneAt(skinIndex.x, row) * skinWeight.x + boneAt(skinIndex.y, row) * skinWeight.y +
           boneAt(skinIndex.z, row) * skinWeight.z + boneAt(skinIndex.w, row) * skinWeight.w;
  }

  void main() {
    float f = floor(aAnim.x);
    float t = aAnim.x - f;
    float next = mod(f + 1.0, aAnim.z);
    mat4 skin = skinAt(aAnim.y + f) * (1.0 - t) + skinAt(aAnim.y + next) * t;
    if (aBlend.y > 0.001) skin = skin * (1.0 - aBlend.y) + skinAt(aBlend.x) * aBlend.y;
    vec4 local = skin * vec4(position, 1.0);
    vec4 mv = modelViewMatrix * instanceMatrix * vec4(local.xyz, 1.0);
    vUv = uv;
    vHair = aHair;
    vSkin = aSkin;
    vCloth = aCloth;
    vFade = aAnim.w;
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform sampler2D uLit;
  uniform sampler2D uMask;
  uniform vec3 uFog;
  uniform float uFogDensity;
  uniform float uGain;
  varying vec2 vUv;
  varying vec3 vHair;
  varying vec3 vSkin;
  varying vec3 vCloth;
  varying float vFade;
  varying float vDepth;

  void main() {
    if (vFade < 0.999) {
      // walkers arrive and leave through a screen-door dissolve, far down the street
      float d = fract(dot(floor(gl_FragCoord.xy), vec2(0.7548776662, 0.5698402910)));
      if (d > vFade) discard;
    }
    vec3 c = texture2D(uLit, vUv).rgb;
    vec3 m = texture2D(uMask, vUv).rgb;
    c *= mix(vec3(1.0), vHair, m.r) * mix(vec3(1.0), vSkin, m.g) * mix(vec3(1.0), vCloth, m.b);
    c *= uGain;
    c = mix(c, uFog, 1.0 - exp(-uFogDensity * uFogDensity * vDepth * vDepth));
    gl_FragColor = vec4(c, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** Brightness of the figures' baked light against the lightmapped street. */
const PEOPLE_GAIN = 1.35;
const NEAR_DISTANCE = 11;
const NEAR_MAX = 26;

interface Batch {
  mesh: InstancedMesh;
  kit: FigureKit;
  matrix: InstancedBufferAttribute;
  anim: InstancedBufferAttribute;
  blend: InstancedBufferAttribute;
  hair: InstancedBufferAttribute;
  skin: InstancedBufferAttribute;
  cloth: InstancedBufferAttribute;
  count: number;
}

function makeBatch(kit: FigureKit, source: BufferGeometry, capacity: number, assets: PeopleAssets): Batch {
  const geometry = source.clone();
  const attr = (name: string, size: number) => {
    const a = new InstancedBufferAttribute(new Float32Array(capacity * size), size);
    a.setUsage(DynamicDrawUsage);
    geometry.setAttribute(name, a);
    return a;
  };
  const anim = attr('aAnim', 4);
  const blend = attr('aBlend', 2);
  const hair = attr('aHair', 3);
  const skin = attr('aSkin', 3);
  const cloth = attr('aCloth', 3);
  const material = new ShaderMaterial({
    uniforms: {
      uBones: { value: kit.bones },
      uLit: { value: assets.lit },
      uMask: { value: assets.mask },
      uFog: { value: new Color(HAZE) },
      uFogDensity: { value: HAZE_DENSITY },
      uGain: { value: PEOPLE_GAIN },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    side: DoubleSide,
  });
  const mesh = new InstancedMesh(geometry, material, capacity);
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.count = 0;
  return { mesh, kit, matrix: mesh.instanceMatrix, anim, blend, hair, skin, cloth, count: 0 };
}

function put(b: Batch, w: Walker, clip: Clip, pose: Clip): void {
  const i = b.count++;
  const m = b.matrix.array as Float32Array;
  const s = w.scale;
  const o = i * 16;
  m[o] = s * w.hz; m[o + 1] = 0; m[o + 2] = -s * w.hx; m[o + 3] = 0;
  m[o + 4] = 0; m[o + 5] = s; m[o + 6] = 0; m[o + 7] = 0;
  m[o + 8] = s * w.hx; m[o + 9] = 0; m[o + 10] = s * w.hz; m[o + 11] = 0;
  m[o + 12] = w.x; m[o + 13] = w.y; m[o + 14] = w.z; m[o + 15] = 1;
  const a = b.anim.array as Float32Array;
  a[i * 4] = w.phase * clip.len;
  a[i * 4 + 1] = clip.start;
  a[i * 4 + 2] = clip.len;
  a[i * 4 + 3] = w.fade;
  const bl = b.blend.array as Float32Array;
  bl[i * 2] = pose.start;
  bl[i * 2 + 1] = w.blend;
  (b.hair.array as Float32Array).set(w.hair, i * 3);
  (b.skin.array as Float32Array).set(w.skin, i * 3);
  (b.cloth.array as Float32Array).set(w.cloth, i * 3);
}

function flush(b: Batch): void {
  b.mesh.count = b.count;
  for (const a of [b.matrix, b.anim, b.blend, b.hair, b.skin, b.cloth]) a.needsUpdate = true;
}

function shadowTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  grad.addColorStop(0, 'rgba(0,0,0,0.62)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.3)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new CanvasTexture(c);
}

const FIG_NAMES: FigName[] = ['man', 'man2', 'woman', 'woman2', 'red', 'guide', 'kit'];

export function Crowd({ ctl }: { ctl: MutableRefObject<CrowdCtl> }) {
  const camera = useThree((state) => state.camera);
  const assets = useMemo(() => getPeople(), []);
  const hintRing = useRef<Group>(null);
  const rig = useMemo(() => {
    if (!assets) return null;
    const near = {} as Record<FigName, Batch>;
    const far = {} as Record<FigName, Batch | null>;
    for (const name of FIG_NAMES) {
      const kit = assets.kits[name];
      near[name] = makeBatch(kit, kit.near, name === 'kit' ? 2 : NEAR_MAX + 2, assets);
      far[name] = kit.far ? makeBatch(kit, kit.far, 340, assets) : null;
    }
    const plane = new PlaneGeometry(1, 1);
    plane.rotateX(-Math.PI / 2);
    const shadows = new InstancedMesh(
      plane,
      new MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, toneMapped: false }),
      400,
    );
    shadows.frustumCulled = false;
    shadows.renderOrder = 2;
    return { near, far, shadows };
  }, [assets]);

  useEffect(
    () => () => {
      if (!rig) return;
      for (const b of [...Object.values(rig.near), ...Object.values(rig.far)]) {
        if (!b) continue;
        b.mesh.geometry.dispose();
        (b.mesh.material as ShaderMaterial).dispose();
      }
      rig.shadows.geometry.dispose();
      (rig.shadows.material as MeshBasicMaterial).dispose();
    },
    [rig],
  );

  useFrame(({ clock }, rawDt) => {
    if (!rig || !assets) return;
    const dt = Math.min(rawDt, 0.05);
    const c = ctl.current;
    const px = camera.position.x;
    const pz = camera.position.z;
    const fx = -camera.matrixWorld.elements[8];
    const fz = -camera.matrixWorld.elements[10];
    for (const name of FIG_NAMES) {
      rig.near[name].count = 0;
      const f = rig.far[name];
      if (f) f.count = 0;
    }
    const sm = rig.shadows.instanceMatrix.array as Float32Array;
    let shadows = 0;
    let nearUsed = 0;
    for (const w of c.walkers) {
      const kit = assets.kits[w.fig];
      const clip = kit.clips[w.clip] ?? kit.clips.walk;
      if (!c.frozen) step(w, dt, px, pz, c, kit.stride[w.clip] ?? kit.stride.walk);
      else if (w.kind === 'agent' && c.aiming) {
        // the one thing that still moves after the freeze: his gun arm, already up
        turnToward(w, px - w.x, pz - w.z, 1 - Math.exp(-9 * dt));
        w.blend = Math.min(1, w.blend + dt * 4);
      }
      if (!w.active) continue;
      const dx = w.x - px;
      const dz = w.z - pz;
      const d2 = dx * dx + dz * dz;
      if (d2 > 9 && dx * fx + dz * fz < -1.5) continue; // behind the camera
      // step aside for the player rather than walk through the lens
      if (w.kind === 'npc' && d2 < 0.72 && !c.frozen) {
        const d = Math.sqrt(d2) || 0.01;
        w.x += (dx / d) * (0.85 - d) * 0.5;
      }
      const hero = w.kind !== 'npc';
      const close = d2 < NEAR_DISTANCE * NEAR_DISTANCE || (hero && d2 < 40 * 40);
      const useNear = close && (hero || nearUsed < NEAR_MAX);
      if (useNear && !hero) nearUsed++;
      const batch = useNear ? rig.near[w.fig] : rig.far[w.fig] ?? rig.near[w.fig];
      if (batch.count >= batch.mesh.instanceMatrix.count) continue;
      const pose = kit.clips[w.pose] ?? kit.clips.stand;
      put(batch, w, clip, pose);
      if (w.kind === 'agent') {
        const k = assets.kits.kit;
        put(rig.near.kit, w, k.clips[w.clip] ?? k.clips.walk, k.clips[w.pose] ?? k.clips.stand);
      }
      if (shadows < 400 && d2 < 55 * 55) {
        const o = shadows++ * 16;
        const s = 0.95 * w.scale * w.fade;
        sm.fill(0, o, o + 16);
        sm[o] = s; sm[o + 5] = 1; sm[o + 10] = s; sm[o + 15] = 1;
        sm[o + 12] = w.x; sm[o + 13] = w.y + 0.015; sm[o + 14] = w.z;
      }
    }
    for (const name of FIG_NAMES) {
      flush(rig.near[name]);
      const f = rig.far[name];
      if (f) flush(f);
    }
    rig.shadows.count = shadows;
    rig.shadows.instanceMatrix.needsUpdate = true;

    // Accessibility ping: a brief ring under the agent.
    if (hintRing.current) {
      const show = performance.now() < c.hintRingUntil;
      hintRing.current.visible = show;
      if (show) {
        hintRing.current.position.set(c.agent.x, 0.05, c.agent.z);
        const p = 1 + Math.sin(clock.elapsedTime * 6) * 0.12;
        hintRing.current.scale.set(p, p, p);
      }
    }
  });

  if (!rig) return null;
  return (
    <>
      {FIG_NAMES.map((name) => (
        <primitive key={`${name}-near`} object={rig.near[name].mesh} />
      ))}
      {FIG_NAMES.map((name) => {
        const f = rig.far[name];
        return f ? <primitive key={`${name}-far`} object={f.mesh} /> : null;
      })}
      <primitive object={rig.shadows} />
      <group ref={hintRing} visible={false}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.5, 0.62, 24]} />
          <meshBasicMaterial color="#00ff41" transparent opacity={0.8} toneMapped={false} />
        </mesh>
      </group>
    </>
  );
}

/** One figure standing still (the hidden program). Faces +z. */
export function StandingFigure({ fig, position, hair, skin }: { fig: FigName; position: V3; hair: V3; skin: V3 }) {
  const assets = useMemo(() => getPeople(), []);
  const batch = useMemo(() => {
    if (!assets) return null;
    const kit = assets.kits[fig];
    const b = makeBatch(kit, kit.near, 1, assets);
    const u = (b.mesh.material as ShaderMaterial).uniforms;
    u.uFogDensity.value = 0;
    u.uGain.value = 1.9;
    return b;
  }, [assets, fig]);
  const walker = useMemo(() => {
    const w = blank('woman', fig);
    w.hair = hair;
    w.skin = skin;
    w.clip = 'stand';
    w.scale = 1.06;
    [w.x, w.y, w.z] = position;
    return w;
  }, [fig, hair, skin, position]);
  useEffect(
    () => () => {
      batch?.mesh.geometry.dispose();
      (batch?.mesh.material as ShaderMaterial | undefined)?.dispose();
    },
    [batch],
  );
  useFrame(({ clock }) => {
    if (!batch) return;
    batch.count = 0;
    walker.hx = Math.sin(Math.sin(clock.elapsedTime * 0.5) * 0.06);
    walker.hz = Math.cos(Math.sin(clock.elapsedTime * 0.5) * 0.06);
    put(batch, walker, batch.kit.clips.stand, batch.kit.clips.stand);
    flush(batch);
  });
  return batch ? <primitive object={batch.mesh} /> : null;
}
