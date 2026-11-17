import {
  DataTexture,
  FloatType,
  Matrix4,
  NearestFilter,
  NoColorSpace,
  Quaternion,
  RGBAFormat,
  Vector3,
  type BufferGeometry,
  type MeshStandardMaterial,
  type SkinnedMesh,
  type Texture,
} from 'three';
import { getGLTF, getTexture, preloadGLTF, preloadTexture } from '../../engine3d/assets';
import peopleUrl from './assets/people.glb?url';
import maskUrl from './assets/people_mask.webp?url';

/* --------------------------------------------------------------- figures
 * The people file holds six skinned bodies (two levels of detail each) and
 * the agent's kit, all on the same 19-bone rig and one shared atlas. Nothing
 * is animated in the file: the gaits are posed here, per figure, into a small
 * float texture of bone matrices (one row per frame) that the crowd shader
 * samples per instance. Hundreds of walkers then cost a draw call per body.
 */

export const preloadPeople = () => Promise.all([preloadGLTF(peopleUrl), preloadTexture(maskUrl)]);

export type FigName = 'man' | 'man2' | 'woman' | 'woman2' | 'red' | 'guide' | 'kit';

export interface Clip {
  start: number;
  len: number;
}

export interface FigureKit {
  name: FigName;
  near: BufferGeometry;
  far: BufferGeometry | null;
  bones: DataTexture;
  clips: Record<string, Clip>;
  /** Ground covered by one full walk cycle at scale 1, per clip, metres. */
  stride: Record<string, number>;
}

export interface PeopleAssets {
  kits: Record<FigName, FigureKit>;
  lit: Texture;
  mask: Texture;
}

interface Style {
  /** Thigh swing amplitude, radians. */
  leg: number;
  arm: number;
  sway: number;
  roll: number;
  twist: number;
  lean: number;
  /** Thighs angled inward (a walk on one line). */
  narrow: number;
  arms: 'swing' | 'behind' | 'aim' | 'model';
  gun?: boolean;
}

const NORMAL: Style = { leg: 0.42, arm: 0.34, sway: 0.012, roll: 0.03, twist: 0.08, lean: 0.045, narrow: 0, arms: 'swing' };
/** The tell: no sway, no twist, arms that barely move. */
const STIFF: Style = { leg: 0.38, arm: 0.06, sway: 0, roll: 0, twist: 0, lean: 0, narrow: 0, arms: 'swing' };
const AIM: Style = { ...STIFF, leg: 0, arms: 'aim', gun: true };
const MODEL: Style = { leg: 0.37, arm: 0.2, sway: 0.03, roll: 0.075, twist: 0.12, lean: 0.0, narrow: 0.06, arms: 'model' };
const LEADER: Style = { leg: 0.4, arm: 0, sway: 0.008, roll: 0.02, twist: 0.03, lean: 0.02, narrow: 0, arms: 'behind' };

const FRAMES = 24;
/** Clips per figure: [name, style, frames]. A one-frame clip is a held pose. */
const CLIPS: Record<FigName, [string, Style, number][]> = {
  man: [['walk', NORMAL, FRAMES], ['stiff', STIFF, FRAMES], ['aim', AIM, 1], ['stand', { ...NORMAL, leg: 0 }, 1]],
  kit: [['walk', NORMAL, FRAMES], ['stiff', STIFF, FRAMES], ['aim', AIM, 1], ['stand', { ...NORMAL, leg: 0 }, 1]],
  man2: [['walk', { ...NORMAL, leg: 0.38, arm: 0.28, lean: 0.07 }, FRAMES], ['stand', { ...NORMAL, leg: 0 }, 1]],
  woman: [['walk', { ...NORMAL, leg: 0.4, arm: 0.3, roll: 0.05, narrow: 0.03 }, FRAMES], ['stand', { ...NORMAL, leg: 0 }, 1]],
  woman2: [['walk', { ...NORMAL, leg: 0.41, arm: 0.36, roll: 0.045, narrow: 0.02 }, FRAMES], ['stand', { ...NORMAL, leg: 0 }, 1]],
  red: [['walk', MODEL, FRAMES], ['stand', { ...MODEL, leg: 0 }, 1]],
  guide: [['walk', LEADER, FRAMES], ['stand', { ...LEADER, leg: 0 }, 1]],
};

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);
const rot = (axis: Vector3, angle: number) => new Quaternion().setFromAxisAngle(axis, angle);

interface Rest {
  names: string[];
  parent: number[];
  head: Vector3[];
  fix: Matrix4[];
  order: number[];
  index: Record<string, number>;
}

function readRest(mesh: SkinnedMesh): Rest {
  const { bones, boneInverses } = mesh.skeleton;
  // the loader strips dots and numbers repeated names (HandL_3): back to the plain bone name
  const names = bones.map((b) => b.name.replace(/_\d+$/, ''));
  const parent = bones.map((b) => (b.parent ? bones.indexOf(b.parent as (typeof bones)[number]) : -1));
  const head = bones.map((b) => new Vector3().setFromMatrixPosition(b.matrixWorld));
  const fix = bones.map((b, i) => new Matrix4().multiplyMatrices(b.matrixWorld, boneInverses[i]).multiply(mesh.bindMatrix));
  const depth = (i: number): number => (parent[i] < 0 ? 0 : 1 + depth(parent[i]));
  const order = bones.map((_, i) => i).sort((a, b) => depth(a) - depth(b));
  const index: Record<string, number> = {};
  names.forEach((n, i) => (index[n] = i));
  return { names, parent, head, fix, order, index };
}

/** World-space rotation per named bone for one instant of a gait (figure frame: +x its left, +z ahead). */
function poseRotations(theta: number, st: Style, rest: Rest): Record<string, Quaternion> {
  const out: Record<string, Quaternion> = {};
  const s = Math.sin(theta);
  out.Hips = rot(Y, -st.twist * s).multiply(rot(Z, st.roll * s));
  out.Spine = rot(X, st.lean * 0.5);
  out.Chest = rot(Y, st.twist * 1.3 * s).multiply(rot(X, st.lean));
  out.Neck = new Quaternion();
  out.Head = new Quaternion();
  const dirOf = (a: string, b: string) => rest.head[rest.index[b]].clone().sub(rest.head[rest.index[a]]).normalize();
  for (const [side, sg, th] of [
    ['L', 1, theta],
    ['R', -1, theta + Math.PI],
  ] as const) {
    // legs: swing about the hip, the knee folds as the leg comes through
    const a = st.leg * Math.sin(th);
    const knee = st.leg > 0 ? 0.1 + 0.95 * Math.max(0, Math.cos(th + 0.5)) ** 2 * (st.leg / 0.42) : 0.04;
    const shin = a - knee;
    out[`Thigh${side}`] = rot(Z, sg * st.narrow).multiply(rot(X, -a));
    out[`Shin${side}`] = rot(X, -shin);
    out[`Foot${side}`] = rot(X, -(shin * 0.3 + a * 0.2));
    // arms: each segment is turned from its rest direction to where it should point
    const b = -st.arm * Math.sin(th);
    let upper: Vector3;
    let fore: Vector3;
    if (st.arms === 'behind') {
      upper = new Vector3(sg * 0.16, -1, -0.36);
      fore = new Vector3(-sg * 0.66, -0.52, -0.4);
    } else if (st.arms === 'aim' && side === 'R') {
      upper = new Vector3(-0.2, -0.1, 1);
      fore = new Vector3(0.0, 0.05, 1);
    } else if (st.arms === 'model') {
      upper = new Vector3(sg * 0.2, -1, Math.sin(b) * 0.8 - 0.05);
      fore = new Vector3(sg * 0.12, -1, 0.22 + Math.sin(b));
    } else {
      const e = 0.2 + 0.3 * Math.max(0, Math.sin(b));
      upper = new Vector3(sg * 0.13, -Math.cos(b), Math.sin(b));
      fore = new Vector3(sg * 0.05, -Math.cos(b + e), Math.sin(b + e));
    }
    const restUpper = dirOf(`UpperArm${side}`, `ForeArm${side}`);
    const restFore = dirOf(`ForeArm${side}`, `Hand${side}`);
    out[`UpperArm${side}`] = new Quaternion().setFromUnitVectors(restUpper, upper.normalize());
    out[`ForeArm${side}`] = new Quaternion().setFromUnitVectors(restFore, fore.normalize());
  }
  return out;
}

function writePose(theta: number, st: Style, rest: Rest, data: Float32Array, row: number, nb: number): void {
  const rots = poseRotations(theta, st, rest);
  const D: Quaternion[] = [];
  const P: Vector3[] = [];
  for (const i of rest.order) {
    const p = rest.parent[i];
    D[i] = rots[rest.names[i]] ?? (p >= 0 ? D[p] : new Quaternion());
    P[i] = p < 0 ? rest.head[i].clone() : rest.head[i].clone().sub(rest.head[p]).applyQuaternion(D[p]).add(P[p]);
  }
  // put the lower foot back on the ground, and lean into the standing leg
  const lift = Math.min(...(['FootL', 'FootR'] as const).map((n) => P[rest.index[n]].y - rest.head[rest.index[n]].y));
  const shift = new Vector3(st.sway * Math.sin(theta), -lift, 0);
  const m = new Matrix4();
  const t = new Matrix4();
  for (let i = 0; i < nb; i++) {
    const o = (row * nb + i) * 16;
    if (rest.names[i] === 'Gun' && !st.gun) {
      data.fill(0, o, o + 16); // the pistol folds away to nothing until it is drawn
      continue;
    }
    m.makeRotationFromQuaternion(D[i]);
    m.setPosition(P[i].clone().add(shift));
    m.multiply(t.makeTranslation(-rest.head[i].x, -rest.head[i].y, -rest.head[i].z)).multiply(rest.fix[i]);
    data.set(m.elements, o);
  }
}

function buildKit(name: FigName, near: SkinnedMesh, far: SkinnedMesh | undefined): FigureKit {
  const rest = readRest(near);
  const nb = rest.names.length;
  const defs = CLIPS[name];
  const rows = defs.reduce((n, d) => n + d[2], 0);
  const data = new Float32Array(rows * nb * 16);
  const clips: Record<string, Clip> = {};
  const stride: Record<string, number> = {};
  const legLength =
    rest.head[rest.index.ThighL].distanceTo(rest.head[rest.index.ShinL]) +
    rest.head[rest.index.ShinL].distanceTo(rest.head[rest.index.FootL]);
  let row = 0;
  for (const [clip, st, len] of defs) {
    clips[clip] = { start: row, len };
    stride[clip] = Math.max(0.2, 4 * legLength * Math.sin(st.leg));
    for (let f = 0; f < len; f++) writePose((f / len) * Math.PI * 2, st, rest, data, row++, nb);
  }
  const bones = new DataTexture(data, nb * 4, rows, RGBAFormat, FloatType);
  bones.minFilter = bones.magFilter = NearestFilter;
  bones.generateMipmaps = false;
  bones.needsUpdate = true;
  return { name, near: near.geometry, far: far ? far.geometry : null, bones, clips, stride };
}

let cache: PeopleAssets | null = null;

/** The posed figure kits, or null until `preloadPeople` has finished. */
export function getPeople(): PeopleAssets | null {
  if (cache) return cache;
  const gltf = getGLTF(peopleUrl);
  const mask = getTexture(maskUrl);
  if (!gltf || !mask) return null;
  gltf.scene.updateMatrixWorld(true);
  mask.colorSpace = NoColorSpace;
  mask.needsUpdate = true;
  const mesh = (n: string) => gltf.scene.getObjectByName(n) as SkinnedMesh | undefined;
  const kits = {} as Record<FigName, FigureKit>;
  let lit: Texture | null = null;
  for (const name of Object.keys(CLIPS) as FigName[]) {
    const near = mesh(`${name}_L0`);
    if (!near) return null;
    lit = lit ?? (near.material as MeshStandardMaterial).map;
    kits[name] = buildKit(name, near, mesh(`${name}_L1`));
  }
  if (!lit) return null;
  cache = { kits, lit, mask };
  return cache;
}
