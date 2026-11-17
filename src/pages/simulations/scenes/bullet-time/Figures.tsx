import { useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  Euler,
  LessDepth,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
  type Bone,
  type Group,
  type Material,
  type Mesh,
  type MeshStandardMaterial,
  type Object3D,
  type SkinnedMesh,
} from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { getGLTF, preloadGLTF } from '../../engine3d/assets';
import { AGENT_AT, GRADE, SUN_DIR } from './World';
import figuresUrl from './assets/figures.glb?url';

export const preloadFigures = () => preloadGLTF(figuresUrl);

/** The atlas stores lit colour / this range (figures.py LIT_K). */
const LIT_K = 1.5;

export type AvatarPose = 'ready' | 'back' | 'left' | 'right' | 'hit';

/** Mutable control block written by the wave system, read by the operator each frame. */
export interface AvatarCtl {
  pose: AvatarPose;
  since: number;
}

type V3 = [number, number, number];

/**
 * A pose is a handful of limb directions in the body frame (x: his left,
 * y: up, z: the way he faces) plus torso lean/side/twist, head nod, a drop of
 * the hips and a push of the hips along the facing. The coat skirts hang in
 * the yaw frame so they can fly out behind him.
 */
interface Pose {
  lean: number;
  side: number;
  twist: number;
  head: number;
  adv: number;
  armL: V3;
  foreL: V3;
  armR: V3;
  foreR: V3;
  legL: V3;
  shinL: V3;
  legR: V3;
  shinR: V3;
  /** Coat skirt panels: front/back x his left/right. */
  coatFL: V3;
  coatFR: V3;
  coatBL: V3;
  coatBR: V3;
}

const SCALARS = ['lean', 'side', 'twist', 'head', 'adv'] as const;
const VECTORS = ['armL', 'foreL', 'armR', 'foreR', 'legL', 'shinL', 'legR', 'shinR', 'coatFL', 'coatFR', 'coatBL', 'coatBR'] as const;

const OPERATOR_POSES: Record<AvatarPose, Pose> = {
  // Feet apart, weight even, hands loose and a little forward: waiting for the shot.
  ready: {
    lean: 0.02, side: 0, twist: 0, head: 0, adv: 0,
    armL: [0.28, -1, 0.1], foreL: [0.12, -1, 0.42],
    armR: [-0.28, -1, 0.1], foreR: [-0.12, -1, 0.42],
    legL: [0.2, -1, 0.02], shinL: [0.05, -1, -0.03],
    legR: [-0.2, -1, 0.02], shinR: [-0.05, -1, -0.03],
    // standing: the panels hang nearly straight, a little open at the front
    coatFL: [0.05, -1, 0.04], coatFR: [-0.05, -1, 0.04], coatBL: [0.04, -1, -0.03], coatBR: [-0.04, -1, -0.03],
  },
  // The bend: knees driven forward, the body arched back toward horizontal,
  // arms flung wide and windmilling, the coat flying out under him.
  back: {
    // Side frames: shins near vertical, knees out in front, hips dropped to knee
    // height and back over the heels, the torso arched past horizontal (head
    // below the hips), one arm thrown up to the sky, the other flung out wide.
    // Torso-frame +z is the chest, so with the torso laid back it points at the sky.
    lean: -1.75, side: 0.1, twist: -0.18, head: -0.4, adv: 0.45,
    armL: [0.25, 0.05, 1], foreL: [0.12, 0.35, 1],
    armR: [-1, 0.25, -0.15], foreR: [-0.85, 0.5, -0.1],
    legL: [0.2, -0.2, 1], shinL: [0.05, -1, 0.12],
    legR: [-0.16, -0.25, 1], shinR: [-0.04, -1, 0.1],
    // the coat hangs from the hips and trails back under him (clamped above the deck)
    // back panels trail behind him, the front panels fall open to either side
    coatFL: [0.85, -0.5, 0.1], coatFR: [-0.85, -0.5, 0.05], coatBL: [0.45, -0.6, -0.7], coatBR: [-0.5, -0.6, -0.65],
  },
  // A sharp lean to HIS left (the camera's left from behind him).
  left: {
    lean: -0.1, side: -0.75, twist: 0.25, head: 0.15, adv: 0,
    armL: [0.85, -0.3, 0.1], foreL: [0.7, 0.3, 0.25],
    armR: [-0.4, 0.55, -0.1], foreR: [-0.1, 0.95, 0.1],
    legL: [0.42, -0.9, 0.1], shinL: [0.05, -1, -0.15],
    legR: [-0.12, -1, 0.0], shinR: [-0.05, -1, -0.05],
    coatFL: [-0.2, -1, 0.1], coatFR: [-0.55, -0.8, 0.0], coatBL: [-0.1, -1, -0.2], coatBR: [-0.5, -0.8, -0.25],
  },
  right: {
    lean: -0.1, side: 0.75, twist: -0.25, head: 0.15, adv: 0,
    armL: [0.4, 0.55, -0.1], foreL: [0.1, 0.95, 0.1],
    armR: [-0.85, -0.3, 0.1], foreR: [-0.7, 0.3, 0.25],
    legL: [0.12, -1, 0.0], shinL: [0.05, -1, -0.05],
    legR: [-0.42, -0.9, 0.1], shinR: [-0.05, -1, -0.15],
    coatFL: [0.55, -0.8, 0.0], coatFR: [0.2, -1, 0.1], coatBL: [0.5, -0.8, -0.25], coatBR: [0.1, -1, -0.2],
  },
  // Clipped: a stagger back, one hand to the shoulder.
  hit: {
    lean: 0.35, side: -0.25, twist: 0.35, head: 0.3, adv: 0.15,
    armL: [-0.2, -0.3, 0.9], foreL: [-0.6, 0.65, 0.2],
    armR: [-0.5, -0.8, 0.2], foreR: [-0.3, -0.8, 0.5],
    legL: [0.22, -0.95, 0.25], shinL: [0.02, -1, -0.3],
    legR: [-0.22, -0.95, -0.15], shinR: [-0.04, -1, -0.15],
    coatFL: [0.2, -1, 0.25], coatFR: [-0.2, -1, 0.25], coatBL: [0.2, -1, 0.15], coatBR: [-0.2, -1, 0.15],
  },
};

/** The agent: square on, gun arm straight out at the operator, the other hand at his side. */
const AGENT_POSE: Pose = {
  lean: 0.0, side: 0, twist: 0.12, head: 0.04, adv: 0,
  armL: [0.18, -1, 0.04], foreL: [0.08, -1, 0.15],
  armR: [-0.12, 0.02, 1], foreR: [-0.05, 0.03, 1],
  legL: [0.17, -1, 0.04], shinL: [0.04, -1, -0.03],
  legR: [-0.17, -1, -0.04], shinR: [-0.04, -1, -0.03],
  coatFL: [0, -1, 0], coatFR: [0, -1, 0], coatBL: [0, -1, 0], coatBR: [0, -1, 0],
};

function clonePose(p: Pose): Pose {
  const out = { ...p };
  for (const key of VECTORS) out[key] = [...p[key]] as V3;
  return out;
}

interface Rig {
  root: Object3D;
  bones: Record<string, Bone>;
  rest: Map<Bone, Quaternion>;
  restWorld: Map<Bone, Quaternion>;
  meshes: SkinnedMesh[];
}

/** A figure's rig out of the shared file: bone names with the loader's de-dupe suffix stripped. */
function prepareRig(name: string): Rig | null {
  const gltf = getGLTF(figuresUrl);
  if (!gltf) return null;
  const source = gltf.scene.getObjectByName(name);
  if (!source) return null;
  const root = cloneSkinned(source);
  root.position.set(0, 0, 0);
  const bones: Record<string, Bone> = {};
  const rest = new Map<Bone, Quaternion>();
  const restWorld = new Map<Bone, Quaternion>();
  const meshes: SkinnedMesh[] = [];
  root.updateMatrixWorld(true);
  const inverseRoot = root.getWorldQuaternion(new Quaternion()).invert();
  root.traverse((node) => {
    const bone = node as Bone;
    if (bone.isBone) bones[bone.name.replace(/_\d+$/, '')] = bone;
    const mesh = node as SkinnedMesh;
    if (mesh.isSkinnedMesh) {
      mesh.frustumCulled = false;
      // The atlas carries the roof's daylight: show it as emission.
      const m = (mesh.material as MeshStandardMaterial).clone();
      m.emissiveMap = m.map;
      m.emissive = GRADE.clone();
      m.emissiveIntensity = LIT_K;
      m.map = null;
      m.color = new Color(0, 0, 0);
      m.envMapIntensity = 0;
      m.roughness = 1;
      mesh.material = m;
      meshes.push(mesh);
    }
  });
  for (const bone of Object.values(bones)) {
    rest.set(bone, bone.quaternion.clone());
    restWorld.set(bone, inverseRoot.clone().multiply(bone.getWorldQuaternion(new Quaternion())));
  }
  if (!bones.Hips || !bones.Chest || !bones.UpperArmL || !bones.ThighL) return null;
  return { root, bones, rest, restWorld, meshes };
}

const UP = new Vector3(0, 1, 0);
const qA = new Quaternion();
const qB = new Quaternion();
const qC = new Quaternion();
const qTorso = new Quaternion();
const qYaw = new Quaternion();
const vA = new Vector3();
const vB = new Vector3();
const euler = new Euler();
const ANKLE = 0.085;
/** Coat skirt length from its bone root to the hem (figures.py: waist - 0.05 down to ankle + 0.1). */
const COAT_LEN = 0.84;
/** How far above the deck the hem stays. */
const HEM_CLEAR = 0.04;

/** Pose the skeleton from limb directions (the dojo opponent's method), feet kept on the deck. */
function applyPose(rig: Rig, cur: Pose, yaw: number, lift: Object3D, breathe: number) {
  const { bones, rest, restWorld } = rig;
  for (const [bone, q] of rest) bone.quaternion.copy(q);
  const lean = cur.lean + breathe;
  const bend = (bone: Bone | undefined, x: number, y: number, z: number) => {
    if (!bone) return;
    const world = restWorld.get(bone)!;
    qA.setFromEuler(euler.set(x, y, z, 'YXZ'));
    qB.copy(world).invert().multiply(qA).multiply(world);
    bone.quaternion.multiply(qB);
  };
  bend(bones.Spine, lean * 0.5, cur.twist * 0.5, cur.side * 0.5);
  bend(bones.Chest, lean * 0.5, cur.twist * 0.5, cur.side * 0.5);
  bend(bones.Head, cur.head, -cur.twist * 0.6, 0);

  qYaw.setFromEuler(euler.set(0, yaw, 0, 'YXZ'));
  qA.setFromEuler(euler.set(lean * 0.5, cur.twist * 0.5, cur.side * 0.5, 'YXZ'));
  qTorso.copy(qYaw).multiply(qA).multiply(qA);

  const aim = (bone: Bone | undefined, dir: V3 | Vector3, frame: Quaternion) => {
    if (!bone) return;
    const parent = bone.parent!;
    parent.updateWorldMatrix(true, false);
    parent.getWorldQuaternion(qA);
    if (Array.isArray(dir)) vA.set(dir[0], dir[1], dir[2]);
    else vA.copy(dir);
    vA.normalize().applyQuaternion(frame);
    vB.copy(UP).applyQuaternion(qB.copy(qA).multiply(bone.quaternion));
    qC.setFromUnitVectors(vB, vA);
    bone.quaternion.premultiply(qB.copy(qA)).premultiply(qC).premultiply(qA.invert());
  };
  aim(bones.UpperArmL, cur.armL, qTorso);
  aim(bones.ForeArmL, cur.foreL, qTorso);
  aim(bones.UpperArmR, cur.armR, qTorso);
  aim(bones.ForeArmR, cur.foreR, qTorso);
  aim(bones.ThighL, cur.legL, qYaw);
  aim(bones.ShinL, cur.shinL, qYaw);
  aim(bones.ThighR, cur.legR, qYaw);
  aim(bones.ShinR, cur.shinR, qYaw);
  aim(bones.FootL, vB.set(0.12, -0.3, 0.95), qYaw);
  aim(bones.FootR, vB.set(-0.12, -0.3, 0.95), qYaw);
  lift.updateWorldMatrix(true, true);
  const yL = bones.FootL.getWorldPosition(vA).y;
  const yR = bones.FootR.getWorldPosition(vB).y;
  lift.position.y -= Math.min(yL, yR) - ANKLE;
  lift.updateWorldMatrix(true, true);

  // Coat skirts last, once the hips are at their final height: never let the
  // hem sink through the deck. If it would, swing the skirt flatter instead.
  for (const [bone, dir] of [
    [bones.CoatFL, cur.coatFL],
    [bones.CoatFR, cur.coatFR],
    [bones.CoatBL, cur.coatBL],
    [bones.CoatBR, cur.coatBR],
  ] as const) {
    if (!bone) continue;
    const top = bone.getWorldPosition(vB).y;
    vA.set(dir[0], dir[1], dir[2]).normalize();
    const floor = -Math.max(0.05, top - HEM_CLEAR) / COAT_LEN;
    if (vA.y < floor) {
      const flat = Math.hypot(vA.x, vA.z) || 1;
      const k = Math.sqrt(Math.max(0, 1 - floor * floor)) / flat;
      vA.set(vA.x * k, floor, vA.z * k);
    }
    aim(bone, vA.clone(), qYaw);
  }
}

/**
 * Hard sun shadow on the deck: the figure's skinned meshes drawn again,
 * squashed onto the floor along the sun direction. Depth test LESS on a
 * single plane lets each pixel darken once (no double-dark overlaps).
 */
function makeShadowMaterial(): MeshBasicMaterial {
  const m = new MeshBasicMaterial({ color: '#0d1612', transparent: true, opacity: 0.5, depthWrite: true, depthFunc: LessDepth });
  const sun = new Vector3(...SUN_DIR).normalize();
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uSun = { value: sun };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uSun;')
      .replace(
        '#include <project_vertex>',
        /* glsl */ `
        vec4 wp = modelMatrix * vec4(transformed, 1.0);
        wp.xz -= uSun.xz * (wp.y / max(uSun.y, 0.05));
        wp.y = 0.012;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        `,
      );
  };
  m.customProgramCacheKey = () => 'bt-planar-shadow';
  return m;
}

function shadowCopies(rig: Rig, material: Material): Mesh[] {
  return rig.meshes.map((src) => {
    const copy = src.clone() as SkinnedMesh;
    copy.bind(src.skeleton, src.bindMatrix);
    copy.material = material;
    copy.renderOrder = 1;
    copy.frustumCulled = false;
    return copy;
  });
}

/** The operator: the player's body, posed by the wave system's dodge calls. Faces the agent (-z). */
export function Operator({ ctl }: { ctl: MutableRefObject<AvatarCtl> }) {
  const lift = useRef<Group>(null);
  const rig = useMemo(() => prepareRig('OperatorRig'), []);
  const shadowMat = useMemo(makeShadowMaterial, []);
  const shadows = useMemo(() => (rig ? shadowCopies(rig, shadowMat) : []), [rig, shadowMat]);
  const cur = useMemo<Pose>(() => clonePose(OPERATOR_POSES.ready), []);
  const forced = useRef<AvatarPose | null>(null);
  if (import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).__operatorDebug = { pose: (p: AvatarPose | null) => void (forced.current = p) };
  }

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    if (!rig || !lift.current) return;
    const pose = forced.current ?? ctl.current.pose;
    const target = OPERATOR_POSES[pose];
    // Dodges snap in hard (the read is the silhouette change); recovery eases out slower.
    const rate = pose === 'ready' ? 4 : pose === 'back' ? 7 : 12;
    const f = 1 - Math.exp(-rate * dt);
    for (const key of SCALARS) cur[key] += (target[key] - cur[key]) * f;
    for (const key of VECTORS) for (let i = 0; i < 3; i++) cur[key][i] += (target[key][i] - cur[key][i]) * f;
    const t = clock.elapsedTime;
    // the coat never quite settles: a slow flutter, stronger while he moves
    const flap = 0.04 + 0.12 * Math.min(1, Math.abs(cur.lean) + Math.abs(cur.side));
    cur.coatFL[0] += Math.sin(t * 2.3) * flap * dt * 4;
    cur.coatFR[0] -= Math.sin(t * 2.1 + 0.7) * flap * dt * 4;
    cur.coatBL[2] += Math.sin(t * 2.0 + 1.3) * flap * dt * 4;
    cur.coatBR[2] += Math.sin(t * 1.8 + 2.1) * flap * dt * 4;
    // adv > 0 carries the hips back, away from the agent (the group is turned to face -z)
    lift.current.position.set(0, lift.current.position.y, -cur.adv);
    applyPose(rig, cur, Math.PI, lift.current, Math.sin(t * 1.7) * 0.01);
  });

  return (
    <group rotation={[0, Math.PI, 0]}>
      <group ref={lift}>{rig && <primitive object={rig.root} />}</group>
      {shadows.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </group>
  );
}

function makeFlashTexture(): CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,250,225,1)');
  g.addColorStop(0.25, 'rgba(255,214,140,0.85)');
  g.addColorStop(1, 'rgba(255,170,80,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  // star spikes
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = 'rgba(255,230,180,0.7)';
  ctx.lineWidth = 3;
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 4;
    ctx.beginPath();
    ctx.moveTo(size / 2 - Math.cos(a) * size * 0.48, size / 2 - Math.sin(a) * size * 0.48);
    ctx.lineTo(size / 2 + Math.cos(a) * size * 0.48, size / 2 + Math.sin(a) * size * 0.48);
    ctx.stroke();
  }
  return new CanvasTexture(canvas);
}

/**
 * The agent: one-handed aim at the operator, a slow sway, a muzzle flash on
 * each shot. Writes his live muzzle position into `muzzle` (world space).
 */
export function Agent({
  flashUntil,
  clockRef,
  muzzle,
}: {
  flashUntil: MutableRefObject<number>;
  clockRef: MutableRefObject<number>;
  muzzle: Vector3;
}) {
  const root = useRef<Group>(null);
  const lift = useRef<Group>(null);
  const flash = useRef<Mesh>(null);
  const rig = useMemo(() => prepareRig('AgentRig'), []);
  const shadowMat = useMemo(makeShadowMaterial, []);
  const shadows = useMemo(() => (rig ? shadowCopies(rig, shadowMat) : []), [rig, shadowMat]);
  const flashTex = useMemo(makeFlashTexture, []);
  const cur = useMemo<Pose>(() => clonePose(AGENT_POSE), []);
  const hand = useMemo(() => new Vector3(), []);
  const fore = useMemo(() => new Vector3(), []);

  useFrame(({ clock, camera }) => {
    if (!rig || !lift.current || !root.current) return;
    const t = clock.elapsedTime;
    cur.armR[0] = -0.12 + Math.sin(t * 0.7) * 0.015;
    cur.armR[1] = 0.02 + Math.sin(t * 0.9) * 0.012;
    applyPose(rig, cur, 0, lift.current, Math.sin(t * 1.4) * 0.006);
    // muzzle: past the hand along the forearm
    rig.bones.HandR.getWorldPosition(hand);
    rig.bones.ForeArmR.getWorldPosition(fore);
    muzzle.copy(hand).sub(fore).normalize().multiplyScalar(0.24).add(hand);
    muzzle.y += 0.05;
    if (flash.current) {
      const on = clockRef.current < flashUntil.current;
      flash.current.visible = on;
      if (on) {
        flash.current.position.copy(muzzle);
        root.current.worldToLocal(flash.current.position);
        flash.current.quaternion.copy(camera.quaternion);
        const s = 0.32 + Math.random() * 0.12;
        flash.current.scale.set(s, s, s);
      }
    }
  });

  return (
    <group ref={root} position={AGENT_AT}>
      <group ref={lift}>{rig && <primitive object={rig.root} />}</group>
      {shadows.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
      <mesh ref={flash} visible={false} renderOrder={6}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={flashTex} transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </mesh>
    </group>
  );
}
