import { useCallback, useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Group } from 'three';
import { SceneShell } from '../../engine3d/SceneShell';
import { Interactable } from '../../engine3d/Interactable';
import { useSceneStore, type SceneStore } from '../../engine3d/store';
import type { SceneComponentProps } from '../../scenes';
import { useAmbience } from '../../../../engine/audio';
import { Crowd, makeCrowd, type CrowdCtl } from './crowd';
import { preloadPeople } from './figures';
import { COLLIDERS, FAR, PLATFORMS, SPAWN, StreetWorld, preloadWorld } from './World';
import { OtherProgramDialogue, OtherProgramWorld } from './OtherProgram';
import { RedDressHud, WinOverlay, type RdPhase, type StreetStats } from './RedDressHud';

/** Awaited by the scene route behind the jack-in transition. */
export const preload = () => Promise.all([preloadWorld(), preloadPeople()]);

/* ------------------------------------------------------------------ layout
 * Three coordinates, +z south. You start on the kerb of the crossing (z 54)
 * and walk north against the crowd: the footpath beside the colonnade
 * (x 2.5..9), then the plaza (z -12..-44) with the fountain at its east end.
 * Platforms and colliders are generated with the scene (layout.json).
 */
const SPOT_AT = 100;
const EGG_HOLD_SEC = 4;
/** The halt lands when he is within this range and this close to the centre of your view. */
const FREEZE_RANGE = 18;
const FREEZE_CONE_DOT = Math.cos((7 * Math.PI) / 180);
const WALK_SIGNAL_SEC = 2.6;

const HINTS = [
  'Everyone on this street is going somewhere. One of them is only ever watching.',
  'The crowd bobs, sways, wastes motion. Agents don\'t. Watch the shoulders, and the ear.',
];

/** The guide, a few paces ahead: [progress north of the start in metres, line]. */
const LESSON: [number, string][] = [
  [3, 'GUIDE: "Keep up. Read every face you pass. Your feet know the way."'],
  [30, 'GUIDE: "Every one of them is still wired in. Any of them can be turned against you in a heartbeat."'],
  [62, 'GUIDE: "Whatever just pulled your eye is exactly what they are counting on."'],
];

/* --------------------------------------------------- detection + egg logic */

function DetectionSystem({
  ctl,
  clockRef,
  detectionRef,
  eggTimerRef,
  onSpotted,
  onEggReady,
  onWalkSignal,
  active,
}: {
  ctl: React.MutableRefObject<CrowdCtl>;
  clockRef: React.MutableRefObject<number>;
  detectionRef: React.MutableRefObject<number>;
  eggTimerRef: React.MutableRefObject<number>;
  onSpotted: () => void;
  onEggReady: () => void;
  onWalkSignal: () => void;
  active: boolean;
}) {
  const store = useSceneStore();
  const camera = useThree((state) => state.camera);
  const eggAnnounced = useRef(false);
  const lessonAt = useRef(0);
  const signalled = useRef(false);

  useFrame((_, rawDt) => {
    if (!active) return;
    const snap = store.getSnapshot();
    if (!snap.locked || snap.overlayOpen) return;
    const dt = Math.min(rawDt, 0.05);
    clockRef.current += dt;
    if (!signalled.current && clockRef.current > WALK_SIGNAL_SEC) {
      signalled.current = true;
      onWalkSignal();
    }

    const { agent, woman } = ctl.current;
    const px = camera.position.x;
    const pz = camera.position.z;

    // ---- the lesson, spoken as you go ----
    const north = SPAWN[2] - pz;
    if (lessonAt.current < LESSON.length && north > LESSON[lessonAt.current][0]) {
      store.toast(LESSON[lessonAt.current][1], 5200);
      lessonAt.current++;
    }

    // ---- agent awareness ----
    const dx = px - agent.x;
    const dz = pz - agent.z;
    const dist = Math.hypot(dx, dz);
    let d = detectionRef.current;
    if (dist < 2.5) {
      d = SPOT_AT; // walked straight into him
    } else if (dist < 10) {
      // In front of the way he faces counts harder; sprinting is loud.
      const inFront = dx * agent.hx + dz * agent.hz > 0 || dist < 1.5;
      const sprinting = store.motion.speed > 3.4;
      let rate = ((10 - dist) / 10) * 16;
      if (inFront) rate *= 1.6;
      if (sprinting) rate *= 2.1;
      d += rate * dt;
    } else if (dist > 12) {
      d -= 14 * dt;
    }
    detectionRef.current = Math.max(0, Math.min(SPOT_AT, d));
    if (detectionRef.current >= SPOT_AT) {
      detectionRef.current = 0;
      onSpotted();
      return;
    }

    // ---- walking with her (the hidden program's trigger) ----
    if (woman.active) {
      const wd = Math.hypot(px - woman.x, pz - woman.z);
      if (wd < 2.3) {
        eggTimerRef.current += dt;
        if (eggTimerRef.current >= EGG_HOLD_SEC && !eggAnnounced.current) {
          eggAnnounced.current = true;
          onEggReady();
        }
      } else {
        eggTimerRef.current = Math.max(0, eggTimerRef.current - dt * 1.5);
      }
    }
  });
  return null;
}

/** [F]: stop the program. Lands only with the agent near the centre of your view. */
function FreezeCall({
  ctl,
  active,
  onFreeze,
  onMiss,
}: {
  ctl: React.MutableRefObject<CrowdCtl>;
  active: boolean;
  onFreeze: () => void;
  onMiss: () => void;
}) {
  const store = useSceneStore();
  const camera = useThree((state) => state.camera);
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyF' || e.repeat) return;
      const snap = store.getSnapshot();
      if (!snap.locked || snap.overlayOpen) return;
      const { agent } = ctl.current;
      const dx = agent.x - camera.position.x;
      const dz = agent.z - camera.position.z;
      const dist = Math.hypot(dx, dz);
      const fx = -camera.matrixWorld.elements[8];
      const fz = -camera.matrixWorld.elements[10];
      const flat = Math.hypot(fx, fz) || 1;
      const dot = (dx * fx + dz * fz) / (dist * flat || 1);
      if (dist < FREEZE_RANGE && dot > FREEZE_CONE_DOT) onFreeze();
      else onMiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, camera, ctl, onFreeze, onMiss, store]);
  return null;
}

/** Follows the woman so her (dynamic) interactable rides her position. */
function EggAnchor({
  ctl,
  enabled,
  onMeet,
}: {
  ctl: React.MutableRefObject<CrowdCtl>;
  enabled: boolean;
  onMeet: () => void;
}) {
  const group = useRef<Group>(null);
  useFrame(() => {
    const w = ctl.current.woman;
    group.current?.position.set(w.x, 0, w.z);
  });
  return (
    <group ref={group}>
      <Interactable dynamic label="INTRODUCE YOURSELF" radius={2.4} disabled={!enabled} onInteract={onMeet}>
        <mesh position={[0, 1.4, 0]} visible={false}>
          <boxGeometry args={[0.1, 0.1, 0.1]} />
        </mesh>
      </Interactable>
    </group>
  );
}

function StoreTap({ onStore }: { onStore: (store: SceneStore) => void }) {
  const store = useSceneStore();
  useEffect(() => onStore(store), [store, onStore]);
  return null;
}

/* ------------------------------------------------------------------ scene */

export default function RedDressScene({ onExit }: SceneComponentProps) {
  useAmbience('street');
  const storeRef = useRef<SceneStore | null>(null);
  const [phase, setPhase] = useState<RdPhase>('street');
  const [attempts, setAttempts] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [eggReady, setEggReady] = useState(false);
  const [flashWhite, setFlashWhite] = useState(false);
  const [walkSignal, setWalkSignal] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const [stats, setStats] = useState<StreetStats | null>(null);

  const ctl = useRef<CrowdCtl>(makeCrowd(1));
  const clockRef = useRef(0);
  const detectionRef = useRef(0);
  const eggTimerRef = useRef(0);
  const savedPos = useRef<[number, number, number]>(SPAWN);
  const metHer = useRef(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const onSpotted = useCallback(() => {
    if (phaseRef.current !== 'street') return;
    ctl.current.aiming = true; // look again: the pistol is already on you
    setPhase('spotted');
    setTimeout(() => {
      setAttempts((a) => {
        ctl.current = makeCrowd(a + 2); // fresh crowd, agent repositioned
        return a + 1;
      });
      detectionRef.current = 0;
      eggTimerRef.current = 0;
      setEggReady(false);
      storeRef.current?.teleport(SPAWN, 0);
      setPhase('street');
      storeRef.current?.toast('Reloaded. Same street, different watcher.', 3200);
    }, 2300);
  }, []);

  const onEggReady = useCallback(() => {
    storeRef.current?.toast('She slows her pace to match yours.', 3200);
    setEggReady(true);
  }, []);

  const startProgram = useCallback(() => {
    // Return the player to where they met her (a step off her line).
    savedPos.current = [ctl.current.woman.x - 1, 0, ctl.current.woman.z];
    metHer.current = true;
    setFlashWhite(true);
    setTimeout(() => {
      setPhase('program');
      storeRef.current?.teleport([0, 0, 0], 0);
      setFlashWhite(false);
    }, 450);
  }, []);

  const endProgram = useCallback(() => {
    setFlashWhite(true);
    setTimeout(() => {
      ctl.current.woman.active = false; // the program has ended for today
      setEggReady(false);
      setPhase('street');
      storeRef.current?.teleport(savedPos.current, 0);
      setFlashWhite(false);
      storeRef.current?.toast('Back on the street. The lesson is still waiting.', 3200);
    }, 450);
  }, []);

  const onFreeze = useCallback(() => {
    if (phaseRef.current !== 'street') return;
    // The whole street holds mid-stride, his gun arm already up. Walk the frozen crowd, then the debrief.
    ctl.current.frozen = true;
    ctl.current.aiming = true;
    setFrozen(true);
    setPhase('frozen');
    storeRef.current?.toast('GUIDE: "Hold it. Everything stops."', 4200);
    const snapshot = { attempts, hintsUsed, timeSec: clockRef.current, metHer: metHer.current };
    setTimeout(() => {
      if (phaseRef.current !== 'frozen') return;
      setStats(snapshot);
      setPhase('won');
    }, 9000);
  }, [attempts, hintsUsed]);

  const onMiss = useCallback(() => {
    detectionRef.current = Math.min(SPOT_AT - 1, detectionRef.current + 38);
    storeRef.current?.toast('Not him. And now someone heard you.', 2800);
  }, []);

  const fullReset = useCallback(() => {
    ctl.current = makeCrowd(Math.floor(Math.random() * 1000));
    clockRef.current = 0;
    detectionRef.current = 0;
    eggTimerRef.current = 0;
    metHer.current = false;
    setAttempts(0);
    setHintsUsed(0);
    setEggReady(false);
    setFrozen(false);
    setStats(null);
    setPhase('street');
    storeRef.current?.teleport(SPAWN, 0);
  }, []);

  // Accessibility hints: text first; the visual ping unlocks after a failure.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyH' || phaseRef.current !== 'street') return;
      setHintsUsed((used) => {
        if (used < HINTS.length) {
          storeRef.current?.toast(HINTS[used], 5200);
        } else if (attempts >= 1) {
          ctl.current.hintRingUntil = performance.now() + 2600;
          storeRef.current?.toast('There.', 2000);
        } else {
          storeRef.current?.toast('One more honest try first. Then I\'ll point.', 3200);
          return used;
        }
        return used + 1;
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [attempts]);

  // Dev handle for scripted verification.
  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__rdDebug = {
        phase: () => phaseRef.current,
        detection: () => detectionRef.current,
        eggTimer: () => eggTimerRef.current,
        ctl: () => ctl.current,
        agent: () => ({ x: ctl.current.agent.x, z: ctl.current.agent.z }),
        woman: () => ({ x: ctl.current.woman.x, z: ctl.current.woman.z, active: ctl.current.woman.active }),
        clock: () => clockRef.current,
        store: () => storeRef.current,
        spot: onSpotted,
        egg: startProgram,
        freeze: onFreeze,
      };
    }
  }, [onSpotted, startProgram, onFreeze]);

  const inStreet = phase !== 'program';

  return (
    <SceneShell
      title="THE STREET :: AGENT TRAINING PROGRAM"
      spawn={SPAWN}
      far={FAR}
      colliders={phase === 'program' ? [] : COLLIDERS}
      platforms={phase === 'program' ? [{ minX: -20, maxX: 20, minZ: -20, maxZ: 20, y: 0 }] : PLATFORMS}
      player={{ sprint: { maxSpeed: 5, rampSec: 1 } }}
      onExit={onExit}
      overlay={
        phase === 'won' && stats ? (
          <WinOverlay
            stats={stats}
            onAgain={() => {
              fullReset();
              storeRef.current?.lock();
            }}
            onExit={onExit}
          />
        ) : phase === 'program' ? (
          <OtherProgramDialogue onDone={endProgram} />
        ) : null
      }
      hud={
        <>
          <StoreTap onStore={(s) => void (storeRef.current = s)} />
          <RedDressHud phase={phase} attempts={attempts} hintsUsed={hintsUsed} detectionRef={detectionRef} />
          {flashWhite && <div className="absolute inset-0 z-30 bg-white" />}
        </>
      }
    >
      {inStreet ? (
        <>
          <StreetWorld walk={walkSignal} frozen={frozen} />
          <Crowd key={attempts} ctl={ctl} />
          <EggAnchor ctl={ctl} enabled={eggReady && phase === 'street'} onMeet={startProgram} />
          <FreezeCall ctl={ctl} active={phase === 'street'} onFreeze={onFreeze} onMiss={onMiss} />
          <DetectionSystem
            ctl={ctl}
            clockRef={clockRef}
            detectionRef={detectionRef}
            eggTimerRef={eggTimerRef}
            onSpotted={onSpotted}
            onEggReady={onEggReady}
            onWalkSignal={() => setWalkSignal(true)}
            active={phase === 'street'}
          />
        </>
      ) : (
        <OtherProgramWorld />
      )}
    </SceneShell>
  );
}
