import { useCallback, useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Group } from 'three';
import { SceneShell } from '../../engine3d/SceneShell';
import { Interactable } from '../../engine3d/Interactable';
import { useSceneStore, type SceneStore } from '../../engine3d/store';
import type { SceneComponentProps } from '../../scenes';
import { useAmbience } from '../../../../engine/audio';
import { Crowd, DejaVuCat, Pigeons, makeCrowd, type CrowdCtl } from './people';
import { Street, STREET_COLLIDERS, STREET_PLATFORMS } from './Street';
import { OtherProgramDialogue, OtherProgramWorld } from './OtherProgram';
import { RedDressHud, WinOverlay, type RdPhase, type StreetStats } from './RedDressHud';

const SPAWN: [number, number, number] = [5.5, 0, 26];
const BOOTH: [number, number, number] = [5.3, 0, -26.1];
const SPOT_AT = 100;
const EGG_HOLD_SEC = 4;

const HINTS = [
  'Everyone on this street is going somewhere. One of them is only ever watching.',
  'The crowd bobs, sways, wastes motion. Agents don\'t. Watch the shoulders.',
];

/* --------------------------------------------------- detection + egg logic */

function DetectionSystem({
  ctl,
  clockRef,
  detectionRef,
  eggTimerRef,
  onSpotted,
  onEggReady,
  active,
}: {
  ctl: React.MutableRefObject<CrowdCtl>;
  clockRef: React.MutableRefObject<number>;
  detectionRef: React.MutableRefObject<number>;
  eggTimerRef: React.MutableRefObject<number>;
  onSpotted: () => void;
  onEggReady: () => void;
  active: boolean;
}) {
  const store = useSceneStore();
  const camera = useThree((state) => state.camera);
  const eggAnnounced = useRef(false);

  useFrame((_, rawDt) => {
    if (!active) return;
    const snap = store.getSnapshot();
    if (!snap.locked || snap.overlayOpen) return;
    const dt = Math.min(rawDt, 0.05);
    clockRef.current += dt;

    const { agent, woman } = ctl.current;
    const px = camera.position.x;
    const pz = camera.position.z;

    // ---- agent awareness ----
    const dx = px - agent.x;
    const dz = pz - agent.z;
    const dist = Math.hypot(dx, dz);
    let d = detectionRef.current;
    if (dist < 2.5) {
      d = SPOT_AT; // walked straight into him
    } else if (dist < 10) {
      // In front of his walk direction counts harder; sprinting is loud.
      const facingZ = agent.dir > 0 ? 1 : -1;
      const inFront = Math.sign(dz) === Math.sign(facingZ) || Math.abs(dz) < 1.5;
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
      storeRef.current?.toast('Reloaded. Same street — different watcher.', 3200);
    }, 1900);
  }, []);

  const onEggReady = useCallback(() => {
    storeRef.current?.toast('She slows her pace to match yours.', 3200);
    setEggReady(true);
  }, []);

  const startProgram = useCallback(() => {
    // Return the player to where they met her (a step off the walking lane).
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

  const onWin = useCallback(() => {
    if (phaseRef.current !== 'street') return;
    setStats({ attempts, hintsUsed, timeSec: clockRef.current, metHer: metHer.current });
    setPhase('won');
  }, [attempts, hintsUsed]);

  const fullReset = useCallback(() => {
    ctl.current = makeCrowd(Math.floor(Math.random() * 1000));
    clockRef.current = 0;
    detectionRef.current = 0;
    eggTimerRef.current = 0;
    metHer.current = false;
    setAttempts(0);
    setHintsUsed(0);
    setEggReady(false);
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
        agent: () => ({ x: ctl.current.agent.x, z: ctl.current.agent.z, dir: ctl.current.agent.dir }),
        woman: () => ({ x: ctl.current.woman.x, z: ctl.current.woman.z, active: ctl.current.woman.active }),
        clock: () => clockRef.current,
        spot: onSpotted,
        egg: startProgram,
        win: onWin,
      };
    }
  }, [onSpotted, startProgram, onWin]);

  const inStreet = phase === 'street' || phase === 'spotted';

  return (
    <SceneShell
      title="THE STREET :: AWARENESS PROGRAM"
      spawn={SPAWN}
      colliders={phase === 'program' ? [] : STREET_COLLIDERS}
      platforms={phase === 'program' ? [{ minX: -20, maxX: 20, minZ: -20, maxZ: 20, y: 0 }] : STREET_PLATFORMS}
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
          <RedDressHud
            phase={phase}
            attempts={attempts}
            hintsUsed={hintsUsed}
            detectionRef={detectionRef}
          />
          {flashWhite && <div className="absolute inset-0 z-30 bg-white" />}
        </>
      }
    >
      {inStreet ? (
        <>
          <Street boothRinging />
          <Crowd key={attempts} ctl={ctl}>
            <DejaVuCat clockRef={clockRef} />
            <Pigeons />
          </Crowd>
          <EggAnchor ctl={ctl} enabled={eggReady && phase === 'street'} onMeet={startProgram} />
          <Interactable label="ANSWER THE HARDLINE" radius={2.6} onInteract={onWin}>
            <mesh position={[BOOTH[0], 1.3, BOOTH[2]]} visible={false}>
              <boxGeometry args={[0.4, 0.4, 0.4]} />
            </mesh>
          </Interactable>
          <DetectionSystem
            ctl={ctl}
            clockRef={clockRef}
            detectionRef={detectionRef}
            eggTimerRef={eggTimerRef}
            onSpotted={onSpotted}
            onEggReady={onEggReady}
            active={phase === 'street'}
          />
        </>
      ) : phase === 'program' ? (
        <OtherProgramWorld />
      ) : null}
    </SceneShell>
  );
}
