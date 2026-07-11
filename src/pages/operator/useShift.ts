import { useCallback, useEffect, useRef, useState } from 'react';
import type { RainEngine } from '../../engine/rain';
import {
  ACTIONS,
  FIRST_SPAWN_MS,
  PROBE_TRACE_COST,
  SHIFT_DURATION_MS,
  THREATS,
  TRACE_DECAY_PER_S,
  maxActive,
  rateShift,
  rollKind,
  spawnIntervalMs,
  ttlScale,
  type ActionId,
  type Sector,
  type ThreatKind,
} from './threats';
import { loadCareer, recordShift, type CareerStats, type ShiftResult } from './storage';

export type ShiftPhase = 'idle' | 'running' | 'paused' | 'ended';

export interface Anomaly {
  id: number;
  kind: ThreatKind;
  column: number;
  /** Shift-clock ms at which the threat breaches/fades. */
  expiresAt: number;
  sector: Sector;
}

export interface LogEntry {
  id: number;
  /** Shift-clock ms. */
  at: number;
  text: string;
  tone: 'info' | 'good' | 'bad' | 'dim';
}

export interface TargetState {
  anomalyId: number;
  column: number;
  /** Canvas-relative CSS px of the column's left edge, for anchoring UI. */
  x: number;
  cellWidth: number;
}

export interface ShiftCounts {
  correct: number;
  wrong: number;
  missed: number;
  probes: number;
}

interface Sim {
  clock: number;
  lastTickAt: number;
  nextSpawnAt: number;
  nextId: number;
  score: number;
  trace: number;
  counts: ShiftCounts;
  anomalies: Anomaly[];
  log: LogEntry[];
  target: TargetState | null;
  result: ShiftResult | null;
}

const TICK_MS = 200;
const LOG_CAP = 30;

function freshSim(): Sim {
  return {
    clock: 0,
    lastTickAt: 0,
    nextSpawnAt: FIRST_SPAWN_MS,
    nextId: 1,
    score: 0,
    trace: 0,
    counts: { correct: 0, wrong: 0, missed: 0, probes: 0 },
    anomalies: [],
    log: [],
    target: null,
    result: null,
  };
}

/**
 * The whole Operator shift: clock, pacing, spawning, targeting, scoring,
 * trace meter, logging, and career persistence. All rain visuals go through
 * the round-1 engine event API (column-effect / highlight / glitch-flash).
 */
export function useShift(getEngine: () => RainEngine | null) {
  const [phase, setPhase] = useState<ShiftPhase>('idle');
  const [career, setCareer] = useState<CareerStats>(loadCareer);
  const [, setVersion] = useState(0);
  const sim = useRef<Sim>(freshSim());
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const pushLog = useCallback((text: string, tone: LogEntry['tone']) => {
    const s = sim.current;
    s.log.unshift({ id: s.nextId++, at: s.clock, text, tone });
    if (s.log.length > LOG_CAP) s.log.length = LOG_CAP;
  }, []);

  const clearAnomalyVisual = useCallback(
    (column: number) => {
      getEngine()?.dispatch({ type: 'column-effect-clear', column });
    },
    [getEngine],
  );

  const endShift = useCallback(
    (outcome: 'complete' | 'traced') => {
      const s = sim.current;
      // Guard against a straggling tick firing before the phase change
      // commits — a shift must only be recorded once.
      if (s.result) return;
      for (const a of s.anomalies) clearAnomalyVisual(a.column);
      s.anomalies = [];
      s.target = null;

      const { correct, wrong, missed, probes } = s.counts;
      const calls = correct + wrong + missed;
      const accuracy = calls > 0 ? correct / calls : 0;
      const rank = rateShift(s.score, accuracy, outcome === 'traced');
      const { career: updated, newBestScore } = recordShift({
        outcome,
        score: s.score,
        correct,
        wrong,
        missed,
        probes,
        accuracy,
        rankLabel: rank.label,
        rankBlurb: rank.blurb,
      });
      s.result = {
        outcome,
        score: s.score,
        correct,
        wrong,
        missed,
        probes,
        accuracy,
        rankLabel: rank.label,
        rankBlurb: rank.blurb,
        newBestScore,
      };
      setCareer(updated);
      pushLog(
        outcome === 'traced'
          ? '■ TRACE LOCK — hardline compromised, shift aborted'
          : '■ SHIFT COMPLETE — feed handed to next operator',
        outcome === 'traced' ? 'bad' : 'info',
      );
      setPhase('ended');
      bump();
    },
    [bump, clearAnomalyVisual, pushLog],
  );

  const expire = useCallback(
    (a: Anomaly) => {
      const s = sim.current;
      const def = THREATS[a.kind];
      clearAnomalyVisual(a.column);
      if (a.kind === 'echo') {
        pushLog(`· ${def.missText}`, 'dim');
      } else {
        s.counts.missed += 1;
        s.score -= def.missPenalty;
        s.trace = Math.min(100, s.trace + def.traceOnMiss);
        pushLog(`✗ ${def.missText} · −${def.missPenalty} · trace +${def.traceOnMiss}%`, 'bad');
        getEngine()?.dispatch({ type: 'glitch-flash', color: '#ff3344', durationMs: 160 });
      }
      if (s.target?.anomalyId === a.id) s.target = null;
    },
    [clearAnomalyVisual, getEngine, pushLog],
  );

  const spawn = useCallback(
    (t: number) => {
      const engine = getEngine();
      if (!engine) return;
      const count = engine.getColumnCount();
      if (count < 10) return;

      const s = sim.current;
      const taken = new Set(s.anomalies.map((a) => a.column));
      const candidates: number[] = [];
      for (let c = 2; c < count - 2; c++) {
        let clear = true;
        for (const other of taken) {
          if (Math.abs(other - c) < 3) {
            clear = false;
            break;
          }
        }
        if (clear) candidates.push(c);
      }
      if (candidates.length === 0) return;

      const column = candidates[Math.floor(Math.random() * candidates.length)];
      const kind = rollKind(t);
      const def = THREATS[kind];
      const sector: Sector =
        column < count / 3 ? 'WEST' : column < (2 * count) / 3 ? 'CENTRAL' : 'EAST';

      s.anomalies.push({
        id: s.nextId++,
        kind,
        column,
        expiresAt: s.clock + def.ttlMs * ttlScale(t),
        sector,
      });
      engine.dispatch({ type: 'column-effect', column, effect: def.effect });
      pushLog(`▸ ALERT :: ${sector} SECTOR :: ${def.alertText}`, 'info');
    },
    [getEngine, pushLog],
  );

  const tick = useCallback(() => {
    const s = sim.current;
    const now = performance.now();
    const dt = Math.min(now - s.lastTickAt, 1000);
    s.lastTickAt = now;
    s.clock += dt;
    s.trace = Math.max(0, s.trace - (TRACE_DECAY_PER_S * dt) / 1000);

    const t = Math.min(s.clock / SHIFT_DURATION_MS, 1);

    for (const a of [...s.anomalies]) {
      if (s.clock >= a.expiresAt) {
        s.anomalies = s.anomalies.filter((x) => x.id !== a.id);
        expire(a);
      }
    }

    if (s.clock >= s.nextSpawnAt) {
      if (s.anomalies.length < maxActive(t)) {
        spawn(t);
        s.nextSpawnAt = s.clock + spawnIntervalMs(t);
      } else {
        s.nextSpawnAt = s.clock + 1500;
      }
    }

    if (s.trace >= 100) {
      endShift('traced');
      return;
    }
    if (s.clock >= SHIFT_DURATION_MS) {
      endShift('complete');
      return;
    }
    bump();
  }, [bump, endShift, expire, spawn]);

  // Drive the sim while running; pause automatically when the tab hides.
  useEffect(() => {
    if (phase !== 'running') return;
    sim.current.lastTickAt = performance.now();
    const interval = setInterval(tick, TICK_MS);
    const onHide = () => {
      if (document.hidden) setPhase('paused');
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [phase, tick]);

  // Leaving the page mid-shift: clear any threat visuals left in the engine.
  useEffect(() => {
    return () => {
      const engine = getEngine();
      if (!engine) return;
      for (const a of sim.current.anomalies) {
        engine.dispatch({ type: 'column-effect-clear', column: a.column });
      }
    };
  }, [getEngine]);

  const startShift = useCallback(() => {
    sim.current = freshSim();
    pushLog('■ SHIFT START — watch the code, not the HUD', 'info');
    setPhase('running');
    bump();
  }, [bump, pushLog]);

  const togglePause = useCallback(() => {
    setPhase((p) => (p === 'running' ? 'paused' : p === 'paused' ? 'running' : p));
  }, []);

  /** Back to the idle briefing without starting a new shift. */
  const standDown = useCallback(() => {
    sim.current = freshSim();
    setPhase('idle');
    bump();
  }, [bump]);

  /** Player clicked the feed at canvas-relative x (CSS px). */
  const clickFeed = useCallback(
    (offsetX: number) => {
      if (phaseRef.current !== 'running') return;
      const engine = getEngine();
      if (!engine) return;
      const s = sim.current;
      const col = engine.getColumnForOffset(offsetX);
      if (col < 0) return;

      // Forgiving hit box: exact column or immediate neighbor.
      let best: Anomaly | null = null;
      for (const a of s.anomalies) {
        const d = Math.abs(a.column - col);
        if (d <= 1 && (!best || d < Math.abs(best.column - col))) best = a;
      }

      if (best) {
        s.target = {
          anomalyId: best.id,
          column: best.column,
          x: engine.getColumnX(best.column),
          cellWidth: engine.getCellWidth(),
        };
      } else {
        s.target = null;
        s.counts.probes += 1;
        s.trace = Math.min(100, s.trace + PROBE_TRACE_COST);
        pushLog(`· probe :: node ${col} clean :: trace +${PROBE_TRACE_COST}%`, 'dim');
        engine.dispatch({
          type: 'column-highlight',
          column: col,
          color: '#3a5c46',
          durationMs: 500,
        });
      }
      bump();
    },
    [bump, getEngine, pushLog],
  );

  const cancelTarget = useCallback(() => {
    sim.current.target = null;
    bump();
  }, [bump]);

  const chooseAction = useCallback(
    (action: ActionId) => {
      const s = sim.current;
      const target = s.target;
      if (!target || phaseRef.current !== 'running') return;
      const anomaly = s.anomalies.find((a) => a.id === target.anomalyId);
      s.target = null;
      if (!anomaly) {
        bump();
        return;
      }

      const def = THREATS[anomaly.kind];
      const engine = getEngine();
      const correct = def.correctAction === action;
      s.anomalies = s.anomalies.filter((a) => a.id !== anomaly.id);
      clearAnomalyVisual(anomaly.column);

      if (correct) {
        s.counts.correct += 1;
        s.score += def.reward;
        s.trace = Math.max(0, s.trace + def.traceRelief);
        pushLog(`✓ ${def.name} :: ${def.successText} · +${def.reward}`, 'good');
        engine?.dispatch({
          type: 'column-highlight',
          column: anomaly.column,
          color: '#7dffb0',
          durationMs: 900,
        });
        engine?.dispatch({ type: 'glitch-flash', color: '#00ff41', durationMs: 90 });
      } else {
        s.counts.wrong += 1;
        s.score -= def.wrongPenalty;
        s.trace = Math.min(100, s.trace + def.traceOnWrong);
        pushLog(
          `✗ ${def.name} :: ${def.failText} · −${def.wrongPenalty} · trace +${def.traceOnWrong}%`,
          'bad',
        );
        engine?.dispatch({
          type: 'column-highlight',
          column: anomaly.column,
          color: '#ff5f56',
          durationMs: 900,
        });
        engine?.dispatch({ type: 'glitch-flash', color: '#ff3344', durationMs: 140 });
      }

      if (s.trace >= 100) {
        endShift('traced');
        return;
      }
      bump();
    },
    [bump, clearAnomalyVisual, endShift, getEngine, pushLog],
  );

  const s = sim.current;
  const api = {
    phase,
    career,
    clockRemainingMs: Math.max(0, SHIFT_DURATION_MS - s.clock),
    score: s.score,
    trace: s.trace,
    counts: s.counts,
    activeSignals: s.anomalies.length,
    log: s.log,
    target: s.target,
    result: s.result,
    startShift,
    togglePause,
    standDown,
    clickFeed,
    cancelTarget,
    chooseAction,
  };

  // Dev-only automation hook so gameplay can be exercised from the console.
  if (import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).__operatorDebug = {
      engine: getEngine,
      state: () => ({ ...sim.current, phase: phaseRef.current }),
      spawnNow: () => spawn(Math.min(sim.current.clock / SHIFT_DURATION_MS, 1)),
      clickColumn: (column: number) => {
        const engine = getEngine();
        if (engine) clickFeed(engine.getColumnX(column) + engine.getCellWidth() / 2);
      },
      act: (action: ActionId) => chooseAction(action),
      actions: ACTIONS.map((a) => a.id),
      endNow: () => endShift('complete'),
    };
  }

  return api;
}

export type ShiftApi = ReturnType<typeof useShift>;
