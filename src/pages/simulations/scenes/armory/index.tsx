import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import {
  Color,
  Object3D,
  Raycaster,
  Vector3,
  type Group,
  type InstancedMesh,
  type Mesh,
  type PointLight,
} from 'three';
import { SceneShell } from '../../engine3d/SceneShell';
import { Interactable } from '../../engine3d/Interactable';
import { RendererLook } from '../../engine3d/RendererLook';
import {
  useSceneStore,
  type Collider2D,
  type Platform,
  type SceneStore,
} from '../../engine3d/store';
import type { SceneComponentProps } from '../../scenes';
import { sfxGunshot } from '../../../../engine/audio';
import {
  HOLD,
  RACK_COLLIDERS,
  RUSH_TOTAL_MS,
  RackAisles,
  Terminal,
  VOID_WHITE,
  WeaponModel,
  getArmoryParts,
  muzzleOf,
  preloadArmory,
  type RushState,
} from './models';
import { CatalogOverlay } from './CatalogOverlay';
import { ArmoryHud, type RangeScore } from './ArmoryHud';
import type { WeaponEntry } from './types';

/** Awaited by the scene route behind the jack-in transition. */
export const preload = preloadArmory;

const RUSH_SEEN_KEY = 'armory.rush.v1';
const TARGET_Z = -36;
const MAX_MARKERS = 48;

const PLATFORMS: Platform[] = [{ minX: -8, maxX: 8, minZ: -42, maxZ: 14, y: 0 }];

const COLLIDERS: Collider2D[] = [
  { minX: -8.5, maxX: 8.5, minZ: 13.5, maxZ: 14.5 }, // behind spawn
  { minX: -8.5, maxX: -7.6, minZ: -42, maxZ: 14 }, // side bounds
  { minX: 7.6, maxX: 8.5, minZ: -42, maxZ: 14 },
  { minX: -8.5, maxX: 8.5, minZ: -42.5, maxZ: -41.5 }, // range back wall
  { minX: -0.3, maxX: 0.3, minZ: TARGET_Z - 0.28, maxZ: TARGET_Z + 0.16 }, // target stand
  { minX: 1.27, maxX: 1.73, minZ: 9.85, maxZ: 10.15 }, // manifest terminal
  { minX: -1.73, maxX: -1.27, minZ: 9.85, maxZ: 10.15 }, // recall terminal
  { minX: 2.27, maxX: 2.73, minZ: -27.15, maxZ: -26.85 }, // range reset terminal
  ...RACK_COLLIDERS,
];

/* ------------------------------------------------------------ environment */

/**
 * Shadowless studio light for the void: a broad overhead source, softer walls
 * and a bright floor bounce, built in place (no HDR download).
 */
function VoidEnvironment() {
  return (
    <>
      <RendererLook exposure={1.05} />
      <color attach="background" args={[VOID_WHITE]} />
      <fog attach="fog" args={[VOID_WHITE, 34, 112]} />
      <Environment resolution={256} frames={1}>
        <color attach="background" args={['#b9beb9']} />
        <Lightformer form="rect" intensity={2.6} position={[0, 7, 0]} rotation-x={Math.PI / 2} scale={[16, 16, 1]} />
        <Lightformer form="rect" intensity={1.5} position={[0, 3, 9]} scale={[18, 6, 1]} />
        <Lightformer form="rect" intensity={1.1} position={[0, 3, -9]} scale={[18, 6, 1]} />
        <Lightformer form="rect" intensity={1.1} position={[-9, 3, 0]} rotation-y={Math.PI / 2} scale={[18, 6, 1]} />
        <Lightformer form="rect" intensity={1.1} position={[9, 3, 0]} rotation-y={Math.PI / 2} scale={[18, 6, 1]} />
        <Lightformer form="rect" intensity={0.9} position={[0, -4, 0]} rotation-x={Math.PI / 2} scale={[30, 30, 1]} />
      </Environment>

      {/* Floor: pure void colour, unlit, so it meets the background without a seam. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[130, 48]} />
        <meshBasicMaterial color={VOID_WHITE} toneMapped={false} fog={false} />
      </mesh>

      {/* Firing line + lane guide, painted on the floor */}
      <mesh position={[0, 0.004, -28]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[8, 0.12]} />
        <meshBasicMaterial color="#1c7a3e" />
      </mesh>
      <mesh position={[0, 0.004, -32]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.03, 8]} />
        <meshBasicMaterial color="#a9b3ad" />
      </mesh>
    </>
  );
}

/**
 * Silhouette target. The printed board comes from the scene file; scoring is
 * done against invisible zone meshes that copy the print, stacked by tiny
 * z-offsets so the nearest (highest-value) zone wins the ray.
 */
function RangeTarget({ zonesRef }: { zonesRef: MutableRefObject<Mesh[]> }) {
  const board = useRef<Mesh>(null);
  const torso = useRef<Mesh>(null);
  const head = useRef<Mesh>(null);
  const chest = useRef<Mesh>(null);
  const model = useMemo(() => getArmoryParts()?.target ?? null, []);

  useEffect(() => {
    const zones = [chest.current, head.current, torso.current, board.current].filter(
      (m): m is Mesh => !!m,
    );
    zonesRef.current = zones;
    return () => void (zonesRef.current = []);
  }, [zonesRef]);

  return (
    <group position={[0, 0, TARGET_Z]}>
      {model && <primitive object={model} />}
      <mesh ref={board} position={[0, 1.45, 0.005]} userData={{ score: 2, zone: 'board' }}>
        <planeGeometry args={[0.6, 1.05]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      <mesh
        ref={torso}
        position={[0, 1.36, 0.008]}
        scale={[0.215, 0.37, 1]}
        userData={{ score: 6, zone: 'torso' }}
      >
        <circleGeometry args={[1, 24]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      <mesh ref={head} position={[0, 1.82, 0.008]} userData={{ score: 10, zone: 'head' }}>
        <circleGeometry args={[0.095, 20]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      <mesh ref={chest} position={[0, 1.5, 0.011]} userData={{ score: 9, zone: 'chest' }}>
        <circleGeometry args={[0.07, 18]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------ view model */

interface FlashRef {
  until: number;
}

function ViewModel({ weapon, flash }: { weapon: WeaponEntry; flash: MutableRefObject<FlashRef> }) {
  const camera = useThree((state) => state.camera);
  const group = useRef<Group>(null);
  const lightRef = useRef<PointLight>(null);
  const muzzle = useRef<Mesh>(null);
  const fwd = useRef(new Vector3());
  const right = useRef(new Vector3());
  const up = useRef(new Vector3());
  const hold = HOLD[weapon.archetype];
  const tip = useMemo(() => muzzleOf(weapon.archetype), [weapon.archetype]);

  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    camera.getWorldDirection(fwd.current);
    right.current.set(1, 0, 0).applyQuaternion(camera.quaternion);
    up.current.set(0, 1, 0).applyQuaternion(camera.quaternion);
    const now = performance.now();
    const firing = now < flash.current.until;
    // Recoil: a short shove back and up that settles within ~120 ms.
    const kick = Math.max(0, 1 - (now - (flash.current.until - 50)) / 120);
    g.position
      .copy(camera.position)
      .addScaledVector(fwd.current, hold[0] - kick * 0.035)
      .addScaledVector(right.current, hold[1])
      .addScaledVector(up.current, hold[2] + kick * 0.008 + Math.sin(clock.elapsedTime * 1.8) * 0.003);
    g.quaternion.copy(camera.quaternion);
    if (lightRef.current) lightRef.current.intensity = firing ? 6 : 0;
    if (muzzle.current) {
      muzzle.current.visible = firing;
      if (firing) muzzle.current.rotation.z = now;
    }
  });

  return (
    <group ref={group}>
      <WeaponModel archetype={weapon.archetype} />
      <mesh ref={muzzle} position={[tip[0], tip[1], tip[2] - 0.05]} visible={false}>
        <octahedronGeometry args={[0.035, 0]} />
        <meshBasicMaterial color="#ffe9a8" toneMapped={false} />
      </mesh>
      <pointLight ref={lightRef} position={[tip[0], tip[1], tip[2] - 0.08]} color="#ffd873" distance={6} intensity={0} />
    </group>
  );
}

/* --------------------------------------------------------- firing system */

interface ShotResult {
  pellets: number;
  hits: number;
  score: number;
}

function FiringSystem({
  weaponRef,
  zonesRef,
  flash,
  onShot,
}: {
  weaponRef: MutableRefObject<WeaponEntry | null>;
  zonesRef: MutableRefObject<Mesh[]>;
  flash: MutableRefObject<FlashRef>;
  onShot: (result: ShotResult) => void;
}) {
  const store = useSceneStore();
  const camera = useThree((state) => state.camera);
  const markers = useRef<InstancedMesh>(null);
  const markerIdx = useRef(0);
  const raycaster = useRef(new Raycaster());
  const dir = useRef(new Vector3());
  const side = useRef(new Vector3());
  const up = useRef(new Vector3());
  const helper = useRef(new Object3D());
  const lastShot = useRef(0);
  const holdTimer = useRef(0);

  const fire = useCallback(() => {
    const weapon = weaponRef.current;
    const snap = store.getSnapshot();
    if (!weapon || !snap.locked || snap.overlayOpen || snap.prompt) return;
    const now = performance.now();
    if (now - lastShot.current < weapon.fire.intervalMs) return;
    lastShot.current = now;
    flash.current.until = now + 50;
    store.shake(weapon.fire.kick);
    sfxGunshot(
      weapon.fire.pellets > 1
        ? 'shotgun'
        : weapon.fire.intervalMs <= 140
          ? 'smg'
          : weapon.fire.intervalMs >= 700
            ? 'rifle'
            : 'pistol',
    );

    camera.getWorldDirection(dir.current);
    side.current.crossVectors(dir.current, camera.up).normalize();
    up.current.crossVectors(side.current, dir.current).normalize();

    let hits = 0;
    let score = 0;
    const aim = new Vector3();
    for (let p = 0; p < weapon.fire.pellets; p++) {
      const spreadX = (Math.random() - 0.5) * 2 * weapon.fire.spread;
      const spreadY = (Math.random() - 0.5) * 2 * weapon.fire.spread;
      aim
        .copy(dir.current)
        .addScaledVector(side.current, spreadX)
        .addScaledVector(up.current, spreadY)
        .normalize();
      raycaster.current.set(camera.position, aim);
      const intersections = raycaster.current.intersectObjects(zonesRef.current, false);
      const hit = intersections[0];
      if (import.meta.env.DEV) {
        // Rolling shot log for range tuning (same spirit as __armoryDebug).
        const log = ((window as unknown as Record<string, unknown>).__shotLog ??= []) as unknown[];
        const ray = raycaster.current.ray;
        log.push({
          zone: hit ? hit.object.userData.zone : 'miss',
          rayO: [+ray.origin.x.toFixed(2), +ray.origin.y.toFixed(2), +ray.origin.z.toFixed(2)],
        });
        if (log.length > 50) log.splice(0, log.length - 50);
      }
      if (!hit) continue;
      const zoneScore = (hit.object.userData.score as number) ?? 0;
      score += zoneScore;
      if (zoneScore > 2) hits += 1;
      // Punch a marker into the target at the hit point.
      const inst = markers.current;
      if (inst) {
        helper.current.position.copy(hit.point);
        helper.current.position.z += 0.02;
        helper.current.rotation.set(0, 0, Math.random() * Math.PI);
        helper.current.scale.setScalar(1);
        helper.current.updateMatrix();
        inst.setMatrixAt(markerIdx.current % MAX_MARKERS, helper.current.matrix);
        inst.instanceMatrix.needsUpdate = true;
        markerIdx.current += 1;
      }
    }
    onShot({ pellets: weapon.fire.pellets, hits, score });
  }, [camera, flash, onShot, store, weaponRef, zonesRef]);

  useEffect(() => {
    const down = (e: MouseEvent) => {
      if (e.button !== 0) return;
      fire();
      const weapon = weaponRef.current;
      if (weapon?.fire.auto) {
        clearInterval(holdTimer.current);
        holdTimer.current = window.setInterval(fire, Math.max(40, weapon.fire.intervalMs));
      }
    };
    const stop = () => clearInterval(holdTimer.current);
    window.addEventListener('mousedown', down);
    window.addEventListener('mouseup', stop);
    window.addEventListener('blur', stop);
    return () => {
      clearInterval(holdTimer.current);
      window.removeEventListener('mousedown', down);
      window.removeEventListener('mouseup', stop);
      window.removeEventListener('blur', stop);
    };
  }, [fire, weaponRef]);

  useEffect(() => {
    // Hide the marker pool offscreen initially.
    const inst = markers.current;
    if (!inst) return;
    const h = new Object3D();
    h.position.set(0, -100, 0);
    h.updateMatrix();
    for (let i = 0; i < MAX_MARKERS; i++) inst.setMatrixAt(i, h.matrix);
    inst.instanceMatrix.needsUpdate = true;
    const shade = new Color('#efe9dc');
    for (let i = 0; i < MAX_MARKERS; i++) inst.setColorAt(i, shade);
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  }, []);

  return (
    <instancedMesh ref={markers} args={[undefined, undefined, MAX_MARKERS]}>
      <circleGeometry args={[0.022, 8]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

/* ----------------------------------------------------------------- scene */

function StoreTap({ onStore }: { onStore: (store: SceneStore) => void }) {
  const store = useSceneStore();
  useEffect(() => onStore(store), [store, onStore]);
  return null;
}

function SceneInteractables({
  onManifest,
  onReplayRush,
  onResetScore,
}: {
  onManifest: () => void;
  onReplayRush: () => void;
  onResetScore: () => void;
}) {
  const store = useSceneStore();
  return (
    <>
      <Interactable label="OPEN ARMORY MANIFEST" radius={2.6} onInteract={onManifest}>
        <Terminal position={[1.5, 0, 10]} lines={['MANIFEST', 'ORDNANCE INDEX']} />
      </Interactable>
      <Interactable
        label="RE-RUN SHELF PROTOCOL"
        radius={2.4}
        onInteract={() => {
          onReplayRush();
          store.toast('Ordnance recall. Stand by.', 1800);
        }}
      >
        <Terminal position={[-1.5, 0, 10]} lines={['RECALL', 'SHELF PROTOCOL']} />
      </Interactable>
      <Interactable
        label="RESET RANGE SCORE"
        radius={2.4}
        onInteract={() => {
          onResetScore();
          store.toast('Range score zeroed.', 2000);
        }}
      >
        <Terminal position={[2.5, 0, -27]} lines={['RESET', 'RANGE SCORE']} />
      </Interactable>
    </>
  );
}

export default function ArmoryScene({ onExit }: SceneComponentProps) {
  const storeRef = useRef<SceneStore | null>(null);
  const [storeReady, setStoreReady] = useState(false);
  const [manifestOpen, setManifestOpen] = useState(false);
  const [weapon, setWeapon] = useState<WeaponEntry | null>(null);
  const weaponRef = useRef<WeaponEntry | null>(null);
  weaponRef.current = weapon;
  const [score, setScore] = useState<RangeScore>({ shots: 0, hits: 0, score: 0, best: 0 });
  const [rushing, setRushing] = useState(false);

  const rush = useRef<RushState>({
    mode: localStorage.getItem(RUSH_SEEN_KEY) ? 'placed' : 'hidden',
    startedAt: 0,
  });
  const zonesRef = useRef<Mesh[]>([]);
  const flash = useRef<FlashRef>({ until: 0 });

  const playRush = useCallback(() => {
    rush.current = { mode: 'rushing', startedAt: performance.now() };
    setRushing(true);
    window.setTimeout(() => {
      setRushing(false);
      storeRef.current?.toast('Guns. Lots of guns.', 3600);
      try {
        localStorage.setItem(RUSH_SEEN_KEY, '1');
      } catch {
        // fine — the set-piece just replays next visit
      }
    }, RUSH_TOTAL_MS);
  }, []);

  // First visit: the shelves rush in shortly after the player takes control.
  useEffect(() => {
    const store = storeRef.current;
    if (!storeReady || !store) return;
    if (rush.current.mode !== 'hidden') return;
    let played = false;
    const unsub = store.subscribe(() => {
      if (played || !store.getSnapshot().locked) return;
      played = true;
      window.setTimeout(playRush, 700);
    });
    return unsub;
  }, [storeReady, playRush]);

  // Keyboard: M toggles the manifest.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyM' && !manifestOpen) setManifestOpen(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [manifestOpen]);

  const onShot = useCallback((result: { pellets: number; hits: number; score: number }) => {
    setScore((s) => ({
      shots: s.shots + 1,
      // A trigger pull "hits" when at least one projectile lands on the
      // silhouette — keeps accuracy ≤100% for multi-pellet weapons.
      hits: s.hits + (result.hits > 0 ? 1 : 0),
      score: s.score + result.score,
      best: s.best,
    }));
  }, []);

  const resetScore = useCallback(() => {
    setScore((s) => ({ shots: 0, hits: 0, score: 0, best: Math.max(s.best, s.score) }));
  }, []);

  // Dev handle for scripted verification.
  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__armoryDebug = {
        playRush,
        openManifest: () => setManifestOpen(true),
        loadWeapon: (w: WeaponEntry) => setWeapon(w),
        rushMode: () => rush.current.mode,
        zones: () => zonesRef.current.map((z) => z.userData.zone),
      };
    }
  }, [playRush]);

  return (
    <SceneShell
      title="ARMORY :: ORDNANCE CONSTRUCT"
      spawn={[0, 0, 11.5]}
      colliders={COLLIDERS}
      platforms={PLATFORMS}
      player={{ sprint: { maxSpeed: 5.5, rampSec: 0.8 } }}
      onExit={onExit}
      overlay={
        manifestOpen ? (
          <CatalogOverlay
            loadedId={weapon?.id ?? null}
            onLoad={(w) => {
              setWeapon(w);
              setManifestOpen(false);
              storeRef.current?.toast(`${w.name} loaded. Range is hot down the aisle.`, 3600);
            }}
            onClose={() => setManifestOpen(false)}
          />
        ) : null
      }
      hud={
        <>
          <StoreTap
            onStore={(s) => {
              storeRef.current = s;
              setStoreReady(true);
            }}
          />
          <ArmoryHud weapon={weapon} score={score} rushing={rushing} />
        </>
      }
    >
      <VoidEnvironment />
      <RackAisles rush={rush} />
      <RangeTarget zonesRef={zonesRef} />
      <SceneInteractables
        onManifest={() => setManifestOpen(true)}
        onReplayRush={playRush}
        onResetScore={resetScore}
      />
      {weapon && <ViewModel weapon={weapon} flash={flash} />}
      <FiringSystem weaponRef={weaponRef} zonesRef={zonesRef} flash={flash} onShot={onShot} />
    </SceneShell>
  );
}
