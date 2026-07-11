import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, type Group, type Mesh } from 'three';
import { SceneShell } from '../../engine3d/SceneShell';
import { useSceneStore, type SceneStore } from '../../engine3d/store';
import type { SceneComponentProps } from '../../scenes';
import { sfxWhoosh } from '../../../../engine/audio';
import { Avatar, type AvatarCtl } from './Avatar';
import { BulletsView, makeBulletPool, type BulletSlot, type DodgeDir } from './Bullets';
import {
  BulletTimeHud,
  OutcomeOverlay,
  type AttemptStats,
  type BtPhase,
  type PromptRef,
} from './BulletTimeHud';

/* ------------------------------------------------------------------ tuning */

interface WaveDef {
  bullets: number;
  flightSec: number;
  windowSec: number;
  gapSec: number;
}

/** Escalation: more bullets, faster flight, tighter response windows. */
const WAVES: WaveDef[] = [
  { bullets: 3, flightSec: 4.4, windowSec: 1.7, gapSec: 1.2 },
  { bullets: 3, flightSec: 3.8, windowSec: 1.45, gapSec: 1.05 },
  { bullets: 4, flightSec: 3.3, windowSec: 1.25, gapSec: 0.95 },
  { bullets: 4, flightSec: 2.9, windowSec: 1.1, gapSec: 0.85 },
  { bullets: 5, flightSec: 2.5, windowSec: 0.95, gapSec: 0.75 },
];
const MAX_GRAZES = 3;
const MUZZLE = new Vector3(0.28, 1.44, -12.6);
/** Where each dodge direction's bullet is aimed on the standing body. */
const ZONES: Record<DodgeDir, [number, number, number]> = {
  back: [0, 1.52, 0.05],
  left: [0.34, 1.35, 0], // passes the right side — leaning LEFT clears it
  right: [-0.34, 1.35, 0],
};

/* ------------------------------------------------------------- environment */

const DUSK = '#141a2b';

function DuskRooftop() {
  const towers = useMemo(() => {
    let seed = 4242;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    return Array.from({ length: 14 }, (_, i) => {
      const angle = (i / 14) * Math.PI * 2 + rand() * 0.3;
      const radius = 36 + rand() * 26;
      return {
        pos: [Math.sin(angle) * radius, -20 + (8 + rand() * 26) / 2, Math.cos(angle) * radius] as [
          number,
          number,
          number,
        ],
        size: [4 + rand() * 6, 8 + rand() * 26, 4 + rand() * 6] as [number, number, number],
      };
    });
  }, []);
  return (
    <>
      <color attach="background" args={[DUSK]} />
      <fog attach="fog" args={[DUSK, 26, 85]} />
      <ambientLight color="#8b9bc2" intensity={1.05} />
      <hemisphereLight args={['#4a5c88', '#1a1a20', 1.0]} />
      {/* Sun just below the horizon — long warm key from behind the agent */}
      <directionalLight position={[-6, 5, -30]} color="#ff9d5c" intensity={1.1} />
      <directionalLight position={[8, 12, 14]} color="#8fa3cc" intensity={0.5} />
      {/* Practical over the shooter so he reads against the skyline */}
      <pointLight position={[1.5, 3.4, -12]} color="#ffc890" distance={9} intensity={5} />

      {/* Roof slab + building mass */}
      <mesh position={[0, -10, -3]}>
        <boxGeometry args={[20, 20, 26]} />
        <meshStandardMaterial color="#5a6472" roughness={0.4} metalness={0.1} />
      </mesh>
      {/* Parapets */}
      {(
        [
          [0, -15.8, 20, 0.4],
          [0, 9.8, 20, 0.4],
          [-9.8, -3, 0.4, 26],
          [9.8, -3, 0.4, 26],
        ] as const
      ).map(([x, z, w, d], i) => (
        <mesh key={i} position={[x, 0.42, z]}>
          <boxGeometry args={[w, 0.85, d]} />
          <meshStandardMaterial color="#5c6674" roughness={0.6} />
        </mesh>
      ))}
      {/* Props */}
      <mesh position={[-5.5, 0.6, -6]}>
        <boxGeometry args={[1.6, 1.2, 1.4]} />
        <meshStandardMaterial color="#6a7482" roughness={0.6} metalness={0.2} />
      </mesh>
      <mesh position={[6, 1.6, 4]}>
        <cylinderGeometry args={[0.04, 0.06, 3.2, 8]} />
        <meshStandardMaterial color="#39404a" roughness={0.6} metalness={0.4} />
      </mesh>
      {/* Skyline silhouettes */}
      {towers.map((t, i) => (
        <mesh key={i} position={t.pos}>
          <boxGeometry args={t.size} />
          <meshStandardMaterial color="#1b2230" roughness={0.9} />
        </mesh>
      ))}
    </>
  );
}

/** The shooter: dark suit, tie, glasses, arm extended, muzzle flash. */
function AgentShooter({ flashRef, clockRef }: { flashRef: MutableRefObject<number>; clockRef: MutableRefObject<number> }) {
  const root = useRef<Group>(null);
  const flash = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (root.current) root.current.rotation.y = Math.sin(clock.elapsedTime * 0.6) * 0.03;
    if (flash.current) flash.current.visible = clockRef.current < flashRef.current;
  });
  return (
    <group ref={root} position={[0, 0, -13.2]} rotation={[0, Math.PI, 0]}>
      {/* legs */}
      {([-1, 1] as const).map((s) => (
        <mesh key={s} position={[s * 0.11, 0.48, 0]}>
          <capsuleGeometry args={[0.065, 0.75, 4, 10]} />
          <meshStandardMaterial color="#1c1e24" roughness={0.7} />
        </mesh>
      ))}
      {/* torso + shirt + tie */}
      <mesh position={[0, 1.28, 0]}>
        <capsuleGeometry args={[0.17, 0.42, 4, 12]} />
        <meshStandardMaterial color="#22242b" roughness={0.65} />
      </mesh>
      <mesh position={[0, 1.34, 0.145]}>
        <boxGeometry args={[0.09, 0.3, 0.02]} />
        <meshStandardMaterial color="#d8dade" roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.3, 0.155]}>
        <boxGeometry args={[0.03, 0.24, 0.015]} />
        <meshStandardMaterial color="#0d0e12" roughness={0.6} />
      </mesh>
      {/* head + glasses */}
      <mesh position={[0, 1.75, 0]}>
        <sphereGeometry args={[0.105, 18, 14]} />
        <meshStandardMaterial color="#c9a68a" roughness={0.55} />
      </mesh>
      <mesh position={[0, 1.77, 0.095]}>
        <boxGeometry args={[0.14, 0.03, 0.028]} />
        <meshStandardMaterial color="#0a0a0c" roughness={0.2} metalness={0.4} />
      </mesh>
      {/* left arm at side */}
      <mesh position={[-0.26, 1.25, 0]} rotation={[0, 0, 0.12]}>
        <capsuleGeometry args={[0.05, 0.45, 4, 8]} />
        <meshStandardMaterial color="#22242b" roughness={0.65} />
      </mesh>
      {/* right arm extended toward the player, pistol in hand */}
      <group position={[0.24, 1.46, 0.02]} rotation={[Math.PI / 2 - 0.06, 0, -0.05]}>
        <mesh position={[0, -0.26, 0]}>
          <capsuleGeometry args={[0.05, 0.44, 4, 8]} />
          <meshStandardMaterial color="#22242b" roughness={0.65} />
        </mesh>
        <mesh position={[0, -0.54, 0.03]}>
          <boxGeometry args={[0.035, 0.14, 0.06]} />
          <meshStandardMaterial color="#17181c" roughness={0.35} metalness={0.5} />
        </mesh>
        <mesh ref={flash} position={[0, -0.66, 0.05]} visible={false}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshStandardMaterial color="#fff0c8" emissive="#ffd873" emissiveIntensity={4} />
        </mesh>
      </group>
    </group>
  );
}

/* ------------------------------------------------------------- camera rig */

/**
 * Third-person orbit: slow pendulum drift around the avatar, a faster arc
 * sweep on back-dodges (the film's orbiting shot), and store.shake wiring
 * (PlayerControls isn't mounted in cameraRig="scene").
 */
function CameraRig({
  clockRef,
  sweepRef,
}: {
  clockRef: MutableRefObject<number>;
  sweepRef: MutableRefObject<number>;
}) {
  const store = useSceneStore();
  const camera = useThree((state) => state.camera);
  const sweep = useRef(0);
  const shakeMag = useRef(0);
  const desired = useMemo(() => new Vector3(), []);

  useEffect(() => {
    store.shake = (magnitude) => {
      shakeMag.current = Math.min(0.6, Math.max(shakeMag.current, magnitude));
    };
    return () => void (store.shake = () => {});
  }, [store]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    if (sweepRef.current > 0) {
      sweep.current = Math.max(sweep.current, sweepRef.current);
      sweepRef.current = 0;
    }
    sweep.current *= Math.exp(-1.1 * dt);

    // Over-the-shoulder orbit: mostly behind-right of the avatar, agent in
    // frame; a back-dodge kicks a faster arc sweep around the arching body.
    const az = 0.42 + Math.sin(clockRef.current * 0.07) * 0.22 + sweep.current * 1.05;
    const radius = 3.6 - sweep.current * 0.5;
    desired.set(Math.sin(az) * radius, 1.72 - sweep.current * 0.35, Math.cos(az) * radius);
    camera.position.lerp(desired, 1 - Math.exp(-5 * dt));
    if (shakeMag.current > 0.002) {
      camera.position.x += (Math.random() - 0.5) * shakeMag.current;
      camera.position.y += (Math.random() - 0.5) * shakeMag.current;
      shakeMag.current *= Math.exp(-6 * dt);
    }
    // Aim between the avatar and the shooter so both stay composed in frame.
    camera.lookAt(0, 1.08 - sweep.current * 0.2, -2.4);
  });
  return null;
}

/* ------------------------------------------------------------ wave system */

interface SimState {
  phase: BtPhase;
  wave: number; // 1-based
  spawned: number;
  nextSpawnAt: number;
  waveHits: number;
  until: number; // phase deadline (intro/break)
  lastDirs: DodgeDir[];
  avatarResetAt: number;
  lastImpactAt: number;
}

function WaveSystem({
  sim,
  slots,
  clockRef,
  prompt,
  avatarCtl,
  agentFlash,
  statsRef,
  onGraze,
  onPhase,
  onWave,
}: {
  sim: MutableRefObject<SimState>;
  slots: MutableRefObject<BulletSlot[]>;
  clockRef: MutableRefObject<number>;
  prompt: MutableRefObject<PromptRef>;
  avatarCtl: MutableRefObject<AvatarCtl>;
  agentFlash: MutableRefObject<number>;
  statsRef: MutableRefObject<AttemptStats>;
  onGraze: () => void;
  onPhase: (phase: BtPhase) => void;
  onWave: (wave: number) => void;
}) {
  const store = useSceneStore();

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const s = sim.current;
    const snap = store.getSnapshot();
    // Freeze the whole simulation while unlocked or an overlay is up.
    if (!snap.locked || snap.overlayOpen || s.phase === 'won' || s.phase === 'reloading') return;

    if (s.phase === 'standby') {
      s.phase = 'intro';
      s.until = clockRef.current + 2.2;
      onPhase('intro');
    }

    clockRef.current += dt;
    const now = clockRef.current;
    const wave = WAVES[s.wave - 1];

    // Avatar recovery after a dodge/hit hold.
    if (avatarCtl.current.pose !== 'ready' && now >= s.avatarResetAt) {
      avatarCtl.current = { pose: 'ready', since: performance.now() };
    }

    if (s.phase === 'intro' && now >= s.until) {
      s.phase = 'wave';
      s.spawned = 0;
      s.waveHits = 0;
      s.nextSpawnAt = now + 0.8;
      onPhase('wave');
      onWave(s.wave);
    }

    if (s.phase === 'break' && now >= s.until) {
      s.wave += 1;
      s.phase = 'wave';
      s.spawned = 0;
      s.waveHits = 0;
      s.nextSpawnAt = now + 0.7;
      onPhase('wave');
      onWave(s.wave);
    }

    if (s.phase !== 'wave' || !wave) return;

    // ---- spawn ----
    if (s.spawned < wave.bullets && now >= s.nextSpawnAt) {
      const slot = slots.current.find((b) => !b.active);
      if (slot) {
        let dir: DodgeDir =
          Math.random() < 0.45 ? 'back' : Math.random() < 0.5 ? 'left' : 'right';
        const [a, b] = s.lastDirs;
        if (a && a === b && dir === a) dir = dir === 'back' ? 'left' : 'back';
        s.lastDirs = [dir, a];
        const zone = ZONES[dir];
        slot.active = true;
        slot.dir = dir;
        slot.from.copy(MUZZLE);
        slot.to.set(
          zone[0] + (Math.random() - 0.5) * 0.06,
          zone[1] + (Math.random() - 0.5) * 0.06,
          zone[2],
        );
        slot.bornAt = now;
        slot.flightSec = wave.flightSec;
        slot.resolved = 'pending';
        slot.promptShown = false;
        s.spawned += 1;
        s.lastImpactAt = Math.max(s.lastImpactAt, now + wave.flightSec);
        s.nextSpawnAt = now + wave.gapSec * (0.9 + Math.random() * 0.3);
        agentFlash.current = now + 0.08;
      }
    }

    // ---- impacts (timeout or doomed wrong-input) ----
    for (const slot of slots.current) {
      if (!slot.active) continue;
      const impactAt = slot.bornAt + slot.flightSec;
      if ((slot.resolved === 'pending' || slot.resolved === 'doomed') && now >= impactAt) {
        slot.resolved = 'hit';
        slot.sparkAt = now;
        sfxWhoosh(true); // the graze zip
        avatarCtl.current = { pose: 'hit', since: performance.now() };
        sim.current.avatarResetAt = now + 0.75;
        s.waveHits += 1;
        statsRef.current.grazes += 1;
        store.shake(0.4);
        onGraze();
      }
    }

    // ---- prompt: the earliest unanswered bullet inside its window ----
    let active: BulletSlot | null = null;
    let activeImpact = Infinity;
    for (const slot of slots.current) {
      if (!slot.active || slot.resolved !== 'pending') continue;
      const impactAt = slot.bornAt + slot.flightSec;
      if (now >= impactAt - wave.windowSec && impactAt < activeImpact) {
        active = slot;
        activeImpact = impactAt;
      }
    }
    if (active) {
      prompt.current = {
        dir: active.dir,
        start: activeImpact - wave.windowSec,
        end: activeImpact,
      };
    } else if (prompt.current.dir) {
      prompt.current = { dir: null, start: 0, end: 0 };
    }

    // ---- wave complete ----
    const anyUnresolved = slots.current.some(
      (b) => b.active && (b.resolved === 'pending' || b.resolved === 'doomed'),
    );
    if (s.spawned >= wave.bullets && !anyUnresolved && now > s.lastImpactAt + 0.7) {
      if (s.waveHits === 0) statsRef.current.perfectWaves += 1;
      if (s.wave >= WAVES.length) {
        s.phase = 'won';
        onPhase('won');
      } else {
        s.phase = 'break';
        s.until = now + 2.6;
        onPhase('break');
      }
    }
  });
  return null;
}

/* ----------------------------------------------------------------- scene */

function StoreTap({ onStore }: { onStore: (store: SceneStore) => void }) {
  const store = useSceneStore();
  useEffect(() => onStore(store), [store, onStore]);
  return null;
}

function freshSim(): SimState {
  return {
    phase: 'standby',
    wave: 1,
    spawned: 0,
    nextSpawnAt: 0,
    waveHits: 0,
    until: 0,
    lastDirs: [],
    avatarResetAt: 0,
    lastImpactAt: 0,
  };
}

function freshStats(): AttemptStats {
  return { dodged: 0, grazes: 0, perfectWaves: 0, reactionsMs: [] };
}

export default function BulletTimeScene({ onExit }: SceneComponentProps) {
  const storeRef = useRef<SceneStore | null>(null);
  const [phase, setPhase] = useState<BtPhase>('standby');
  const [wave, setWave] = useState(1);
  const [grazes, setGrazes] = useState(0);
  const [feedback, setFeedback] = useState<{ text: string; tone: 'good' | 'bad' | 'info' } | null>(null);
  const [flash, setFlash] = useState<'none' | 'hit' | 'clean'>('none');
  const [outcome, setOutcome] = useState<AttemptStats | null>(null);

  const sim = useRef<SimState>(freshSim());
  const slots = useRef<BulletSlot[]>(makeBulletPool());
  const clockRef = useRef(0);
  const prompt = useRef<PromptRef>({ dir: null, start: 0, end: 0 });
  const avatarCtl = useRef<AvatarCtl>({ pose: 'ready', since: 0 });
  const agentFlash = useRef(0);
  const sweepRef = useRef(0);
  const statsRef = useRef<AttemptStats>(freshStats());
  const timers = useRef<number[]>([]);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const flashFor = useCallback((kind: 'hit' | 'clean') => {
    setFlash(kind);
    timers.current.push(window.setTimeout(() => setFlash('none'), 420));
  }, []);

  const feedbackFor = useCallback(
    (text: string, tone: 'good' | 'bad' | 'info', ms = 1400) => {
      setFeedback({ text, tone });
      timers.current.push(window.setTimeout(() => setFeedback(null), ms));
    },
    [],
  );

  const resetAttempt = useCallback(() => {
    sim.current = freshSim();
    sim.current.phase = 'intro';
    sim.current.until = clockRef.current + 1.8;
    statsRef.current = freshStats();
    slots.current.forEach((s) => void (s.active = false));
    prompt.current = { dir: null, start: 0, end: 0 };
    avatarCtl.current = { pose: 'ready', since: 0 };
    setGrazes(0);
    setWave(1);
    setPhase('intro');
    setOutcome(null);
  }, []);

  const onGraze = useCallback(() => {
    flashFor('hit');
    feedbackFor('GRAZED', 'bad');
    setGrazes(statsRef.current.grazes);
    if (statsRef.current.grazes >= MAX_GRAZES) {
      sim.current.phase = 'reloading';
      setPhase('reloading');
      timers.current.push(window.setTimeout(resetAttempt, 1700));
    }
  }, [feedbackFor, flashFor, resetAttempt]);

  const onPhase = useCallback(
    (p: BtPhase) => {
      setPhase(p);
      if (p === 'won') setOutcome({ ...statsRef.current, reactionsMs: [...statsRef.current.reactionsMs] });
    },
    [],
  );

  // Dodge input: resolves the currently prompted bullet immediately.
  const answer = useCallback(
    (dir: DodgeDir) => {
      if (phaseRef.current !== 'wave') return;
      const now = clockRef.current;
      let target: BulletSlot | null = null;
      let impact = Infinity;
      for (const slot of slots.current) {
        if (!slot.active || slot.resolved !== 'pending') continue;
        const impactAt = slot.bornAt + slot.flightSec;
        if (now >= impactAt - (prompt.current.end - prompt.current.start) && now < impactAt && impactAt < impact) {
          target = slot;
          impact = impactAt;
        }
      }
      if (!target) return;
      if (dir === target.dir) {
        target.resolved = 'dodged';
        sfxWhoosh();
        statsRef.current.dodged += 1;
        statsRef.current.reactionsMs.push(Math.round((now - prompt.current.start) * 1000));
        avatarCtl.current = { pose: dir, since: performance.now() };
        sim.current.avatarResetAt = impact + 0.55;
        if (dir === 'back') sweepRef.current = 1;
        flashFor('clean');
        feedbackFor(dir === 'back' ? 'CLEAN — the air remembers' : 'CLEAN', 'good', 1100);
      } else {
        // Wrong lean: you moved INTO it. Bullet finishes its flight, then hits.
        target.resolved = 'doomed';
        feedbackFor('WRONG WAY', 'bad');
      }
    },
    [feedbackFor, flashFor],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') answer('left');
      if (e.code === 'KeyD' || e.code === 'ArrowRight') answer('right');
      if (e.code === 'KeyS' || e.code === 'ArrowDown' || e.code === 'Space') answer('back');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [answer]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  // Dev handle for scripted verification.
  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__btDebug = {
        answer,
        clock: () => clockRef.current,
        sim: () => ({ ...sim.current }),
        slots: () =>
          slots.current
            .filter((s) => s.active)
            .map((s) => ({ dir: s.dir, resolved: s.resolved, impactAt: s.bornAt + s.flightSec })),
        prompt: () => ({ ...prompt.current }),
        stats: () => ({ ...statsRef.current }),
        avatar: () => ({ ...avatarCtl.current }),
      };
    }
  }, [answer]);

  return (
    <SceneShell
      title="BULLET TIME"
      spawn={[0, 0, 0]}
      cameraRig="scene"
      colliders={[]}
      onExit={onExit}
      overlay={
        outcome ? (
          <OutcomeOverlay
            stats={outcome}
            onAgain={() => {
              resetAttempt();
              storeRef.current?.lock();
            }}
            onExit={onExit}
          />
        ) : null
      }
      hud={
        <>
          <StoreTap onStore={(s) => void (storeRef.current = s)} />
          <BulletTimeHud
            phase={phase}
            wave={wave}
            waveCount={WAVES.length}
            grazes={grazes}
            maxGrazes={MAX_GRAZES}
            feedback={feedback}
            prompt={prompt}
            clockRef={clockRef}
            flash={flash}
          />
        </>
      }
    >
      <DuskRooftop />
      <Avatar ctl={avatarCtl} />
      <AgentShooter flashRef={agentFlash} clockRef={clockRef} />
      <BulletsView slots={slots} clockRef={clockRef} />
      <CameraRig clockRef={clockRef} sweepRef={sweepRef} />
      <WaveSystem
        sim={sim}
        slots={slots}
        clockRef={clockRef}
        prompt={prompt}
        avatarCtl={avatarCtl}
        agentFlash={agentFlash}
        statsRef={statsRef}
        onGraze={onGraze}
        onPhase={onPhase}
        onWave={setWave}
      />
    </SceneShell>
  );
}
