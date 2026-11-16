import { useCallback, useEffect, useRef, useState } from 'react';
import { SceneShell } from '../../engine3d/SceneShell';
import { Interactable } from '../../engine3d/Interactable';
import { useSceneStore, type SceneStore } from '../../engine3d/store';
import type { SceneComponentProps } from '../../scenes';
import { sfxDojo } from '../../../../engine/audio';
import { Opponent, preloadOpponent, type OpponentCtl } from './Opponent';
import { DojoRoom, ROOM_COLLIDERS, ROOM_PLATFORMS, preloadRoom } from './Room';
import {
  DojoHud,
  OutcomeOverlay,
  type Callout,
  type DojoPhase,
  type FightStats,
  type OutcomeInfo,
  type TelegraphRef,
} from './DojoHud';
import {
  ATTACKS,
  COUNTER_POINTS,
  MAX_HEALTH,
  PRACTICE_GAP_MS,
  PRACTICE_READY_PER_KIND,
  SPARRING_GAP_MAX_MS,
  SPARRING_GAP_MIN_MS,
  STAGGER_MS,
  STREAK_LIMIT,
  STRIKE_MS,
  WIN_POINTS,
  type AttackKind,
  type ResponseKind,
} from './combat';

/** Awaited by the scene route behind the jack-in transition. */
export const preload = () => Promise.all([preloadRoom(), preloadOpponent()]);

/* --------------------------------------------------------------- gameplay */

function StoreTap({ onStore }: { onStore: (store: SceneStore) => void }) {
  const store = useSceneStore();
  useEffect(() => onStore(store), [store, onStore]);
  return null;
}

/** The bow anchor rides inside the opponent's moving root (dynamic focus). */
function BowAnchor({ disabled, onBow }: { disabled: boolean; onBow: () => void }) {
  return (
    <Interactable dynamic label="BOW: BEGIN PRACTICE" radius={2.6} disabled={disabled} onInteract={onBow}>
      <mesh position={[0, 1.3, 0]} visible={false}>
        <boxGeometry args={[0.1, 0.1, 0.1]} />
      </mesh>
    </Interactable>
  );
}

const PRACTICE_SEQUENCE: AttackKind[] = ['sweep', 'heavy', 'lunge', 'sweep', 'heavy', 'lunge'];
const KINDS: AttackKind[] = ['sweep', 'heavy', 'lunge'];

function freshStats(): FightStats {
  return {
    health: MAX_HEALTH,
    points: 0,
    misreadStreak: 0,
    reads: 0,
    counters: 0,
    hitsTaken: 0,
    bestReadStreak: 0,
  };
}

export default function DojoScene({ onExit }: SceneComponentProps) {
  const storeRef = useRef<SceneStore | null>(null);
  const [phase, setPhase] = useState<DojoPhase>('warmup');
  const [callout, setCallout] = useState<Callout | null>(null);
  const [stats, setStats] = useState<FightStats>(freshStats);
  const [practiceCounts, setPracticeCounts] = useState<Record<AttackKind, number>>({
    sweep: 0,
    heavy: 0,
    lunge: 0,
  });
  const [flash, setFlash] = useState<'none' | 'hit' | 'counter'>('none');
  const [outcome, setOutcome] = useState<OutcomeInfo | null>(null);

  const ctl = useRef<OpponentCtl>({ mode: 'idle', kind: 'sweep', since: 0, engaged: false });
  const telegraph = useRef<TelegraphRef>({ active: false, start: 0, durationMs: 1 });
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const game = useRef({
    stats: freshStats(),
    practiceCounts: { sweep: 0, heavy: 0, lunge: 0 } as Record<AttackKind, number>,
    attack: null as { kind: AttackKind; responded: ResponseKind | null } | null,
    readStreak: 0,
    lastKind: null as AttackKind | null,
    practiceIdx: 0,
    roundStart: 0,
    readyToastShown: false,
    timers: [] as number[],
    resolveTimer: 0,
  });

  const setMode = (mode: OpponentCtl['mode']) => {
    ctl.current.mode = mode;
    ctl.current.since = performance.now();
  };

  const later = useCallback((fn: () => void, ms: number) => {
    game.current.timers.push(window.setTimeout(fn, ms));
  }, []);

  const clearTimers = useCallback(() => {
    for (const t of game.current.timers) clearTimeout(t);
    game.current.timers = [];
  }, []);

  const flashFor = useCallback(
    (kind: 'hit' | 'counter') => {
      setFlash(kind);
      later(() => setFlash('none'), 450);
    },
    [later],
  );

  const endRound = useCallback(
    (result: OutcomeInfo['result']) => {
      clearTimers();
      telegraph.current.active = false;
      game.current.attack = null;
      ctl.current.engaged = false;
      setMode(result === 'win' ? 'bow' : 'idle');
      setOutcome({
        result,
        stats: { ...game.current.stats },
        durationMs: performance.now() - game.current.roundStart,
      });
      setPhase('outcome');
    },
    [clearTimers],
  );

  // Declared before use inside resolve/startAttack via refs.
  const startAttackRef = useRef<() => void>(() => {});

  const scheduleNext = useCallback(() => {
    const p = phaseRef.current;
    if (p !== 'practice' && p !== 'sparring') return;
    const gap =
      p === 'practice'
        ? PRACTICE_GAP_MS
        : SPARRING_GAP_MIN_MS + Math.random() * (SPARRING_GAP_MAX_MS - SPARRING_GAP_MIN_MS);
    later(() => startAttackRef.current(), gap);
  }, [later]);

  const resolve = useCallback(
    (response: ResponseKind | null) => {
      const g = game.current;
      const attack = g.attack;
      if (!attack) return;
      g.attack = null;
      telegraph.current.active = false;
      const def = ATTACKS[attack.kind];
      const p = phaseRef.current;
      const correct = response === def.correct;
      const countered = correct && def.correct === 'counter';

      setMode(countered ? 'stagger' : 'strike');

      if (correct) {
        if (countered) {
          flashFor('counter');
          storeRef.current?.shake(0.12);
          sfxDojo('counter');
        } else if (def.correct === 'block') {
          storeRef.current?.shake(0.08); // the thud on your guard
          sfxDojo('block');
        } else {
          sfxDojo('whiff'); // the sweep hisses past under you
        }
        setCallout({ text: def.readText, tone: 'good' });
        if (p === 'practice') {
          g.practiceCounts[attack.kind] += 1;
          setPracticeCounts({ ...g.practiceCounts });
          if (
            !g.readyToastShown &&
            KINDS.every((k) => g.practiceCounts[k] >= PRACTICE_READY_PER_KIND)
          ) {
            g.readyToastShown = true;
            storeRef.current?.toast('Forms learned. Press [G] when you are ready to spar.', 4800);
          }
        } else if (p === 'sparring') {
          g.stats.reads += 1;
          g.stats.points += countered ? COUNTER_POINTS : 1;
          if (countered) g.stats.counters += 1;
          g.stats.misreadStreak = 0;
          g.readStreak += 1;
          g.stats.bestReadStreak = Math.max(g.stats.bestReadStreak, g.readStreak);
          setStats({ ...g.stats });
        }
      } else {
        storeRef.current?.shake(0.42);
        flashFor('hit');
        sfxDojo('hit');
        setCallout({ text: def.hitText, tone: 'bad' });
        if (p === 'sparring') {
          g.stats.hitsTaken += 1;
          g.stats.health = Math.max(0, g.stats.health - def.damage);
          g.stats.misreadStreak += 1;
          g.readStreak = 0;
          setStats({ ...g.stats });
        }
      }

      const recoverMs = countered ? STAGGER_MS : STRIKE_MS;
      later(() => {
        const now = phaseRef.current;
        if (now === 'sparring') {
          if (game.current.stats.health <= 0) return endRound('lose-health');
          if (game.current.stats.misreadStreak >= STREAK_LIMIT) return endRound('lose-streak');
          if (game.current.stats.points >= WIN_POINTS) return endRound('win');
          setMode('guard');
        } else {
          setMode('idle');
        }
        scheduleNext();
      }, recoverMs);
    },
    [endRound, flashFor, later, scheduleNext],
  );

  const startAttack = useCallback(() => {
    const p = phaseRef.current;
    if (p !== 'practice' && p !== 'sparring') return;
    const g = game.current;
    let kind: AttackKind;
    if (p === 'practice' && g.practiceIdx < PRACTICE_SEQUENCE.length) {
      kind = PRACTICE_SEQUENCE[g.practiceIdx++];
    } else {
      const pool = KINDS.filter((k) => k !== g.lastKind);
      kind = pool[Math.floor(Math.random() * pool.length)];
    }
    g.lastKind = kind;
    const def = ATTACKS[kind];
    const durationMs = p === 'practice' ? def.practiceTelegraphMs : def.sparringTelegraphMs;
    g.attack = { kind, responded: null };
    ctl.current.kind = kind;
    setMode('telegraph');
    telegraph.current = { active: true, start: performance.now(), durationMs };
    setCallout(p === 'practice' ? { text: def.callout, tone: 'info' } : null);
    g.resolveTimer = window.setTimeout(() => resolve(null), durationMs);
    g.timers.push(g.resolveTimer);
  }, [resolve]);
  startAttackRef.current = startAttack;

  const respond = useCallback(
    (response: ResponseKind) => {
      const g = game.current;
      if (!g.attack || g.attack.responded) return;
      g.attack.responded = response;
      // Cancel only the pending timeout-resolve; answer decisively, now.
      clearTimeout(g.resolveTimer);
      resolve(response);
    },
    [resolve],
  );

  const startPractice = useCallback(() => {
    clearTimers();
    const g = game.current;
    g.practiceIdx = 0;
    g.practiceCounts = { sweep: 0, heavy: 0, lunge: 0 };
    g.readyToastShown = false;
    g.attack = null;
    setPracticeCounts({ ...g.practiceCounts });
    setOutcome(null);
    setPhase('practice');
    ctl.current.engaged = true;
    setMode('bow');
    setCallout({ text: 'He bows. The forms begin. Watch, then answer.', tone: 'info' });
    later(() => startAttackRef.current(), 1600);
  }, [clearTimers, later]);

  const startSparring = useCallback(() => {
    clearTimers();
    const g = game.current;
    g.stats = freshStats();
    g.readStreak = 0;
    g.attack = null;
    setStats({ ...g.stats });
    setOutcome(null);
    setPhase('sparring');
    ctl.current.engaged = true;
    setMode('guard');
    setCallout({ text: 'Sparring. No more callouts. Read him.', tone: 'info' });
    game.current.roundStart = performance.now();
    later(() => startAttackRef.current(), 1400);
  }, [clearTimers, later]);

  // Inputs: Space dodge · RMB block · LMB counter · G to spar.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') respond('dodge');
      if (e.code === 'KeyG' && (phaseRef.current === 'warmup' || phaseRef.current === 'practice')) {
        startSparring();
      }
    };
    const onMouse = (e: MouseEvent) => {
      if (!storeRef.current?.getSnapshot().locked) return;
      if (e.button === 0) respond('counter');
      if (e.button === 2) respond('block');
    };
    const noMenu = (e: Event) => e.preventDefault();
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onMouse);
    document.addEventListener('contextmenu', noMenu);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onMouse);
      document.removeEventListener('contextmenu', noMenu);
    };
  }, [respond, startSparring]);

  useEffect(() => clearTimers, [clearTimers]);

  // Dev handle for scripted verification.
  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__dojoDebug = {
        respond,
        startPractice,
        startSparring,
        phase: () => phaseRef.current,
        state: () => ({ ...game.current.stats, attack: game.current.attack, ctl: { ...ctl.current } }),
        hurt: (n: number) => {
          game.current.stats.health = n;
          setStats({ ...game.current.stats });
        },
      };
    }
  }, [respond, startPractice, startSparring]);

  return (
    <SceneShell
      title="DOJO :: SPARRING PROGRAM"
      spawn={[0, 0, 3.6]}
      colliders={ROOM_COLLIDERS}
      platforms={ROOM_PLATFORMS}
      player={{
        gravity: 14,
        // Cosmetic hop so the low-sweep dodge physically leaves the floor.
        jump: {
          chargeDurationMs: 400,
          sweetStart: 0,
          sweetEnd: 1,
          minVelY: 3.1,
          maxVelY: 3.1,
          forwardBoost: 0,
        },
      }}
      onExit={onExit}
      overlay={
        outcome ? (
          <OutcomeOverlay
            outcome={outcome}
            onSparAgain={() => {
              startSparring();
              storeRef.current?.lock();
            }}
            onPractice={() => {
              startPractice();
              storeRef.current?.lock();
            }}
            onExit={onExit}
          />
        ) : null
      }
      hud={
        <>
          <StoreTap onStore={(s) => void (storeRef.current = s)} />
          <DojoHud
            phase={phase}
            callout={callout}
            stats={stats}
            practiceCounts={practiceCounts}
            flash={flash}
            telegraph={telegraph}
          />
        </>
      }
    >
      <DojoRoom />
      <Opponent ctl={ctl}>
        <BowAnchor disabled={phase !== 'warmup'} onBow={startPractice} />
      </Opponent>
    </SceneShell>
  );
}
