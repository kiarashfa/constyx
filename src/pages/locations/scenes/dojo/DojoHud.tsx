import { useEffect, useRef, type MutableRefObject } from 'react';
import {
  ATTACKS,
  MAX_HEALTH,
  PRACTICE_READY_PER_KIND,
  STREAK_LIMIT,
  WIN_POINTS,
  type AttackKind,
} from './combat';

export type DojoPhase = 'warmup' | 'practice' | 'sparring' | 'outcome';

export interface Callout {
  text: string;
  tone: 'info' | 'good' | 'bad';
}

export interface FightStats {
  health: number;
  points: number;
  misreadStreak: number;
  reads: number;
  counters: number;
  hitsTaken: number;
  bestReadStreak: number;
}

/** Live telegraph timing, for the shrinking response-window bar. */
export interface TelegraphRef {
  active: boolean;
  start: number;
  durationMs: number;
}

interface DojoHudProps {
  phase: DojoPhase;
  callout: Callout | null;
  stats: FightStats;
  practiceCounts: Record<AttackKind, number>;
  flash: 'none' | 'hit' | 'counter';
  telegraph: MutableRefObject<TelegraphRef>;
}

const TONE_CLASS: Record<Callout['tone'], string> = {
  info: 'border-phosphor/50 text-phosphor',
  good: 'border-phosphor text-phosphor glow',
  bad: 'border-[#ff5f56]/70 text-[#ff5f56]',
};

export function DojoHud({ phase, callout, stats, practiceCounts, flash, telegraph }: DojoHudProps) {
  const windowBar = useRef<HTMLDivElement>(null);

  // Response-window bar: shrinks over the telegraph. rAF + direct DOM writes.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const bar = windowBar.current;
      if (!bar) return;
      const t = telegraph.current;
      if (!t.active) {
        bar.style.opacity = '0';
        return;
      }
      const left = Math.max(0, 1 - (performance.now() - t.start) / t.durationMs);
      bar.style.opacity = '1';
      bar.style.width = `${(left * 100).toFixed(1)}%`;
      bar.style.backgroundColor = left < 0.35 ? '#ff5f56' : 'var(--color-phosphor)';
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [telegraph]);

  const healthFrac = Math.max(0, stats.health / MAX_HEALTH);
  const healthBlocks = Math.round(healthFrac * 20);

  return (
    <>
      {/* Hit / counter flash */}
      {flash === 'hit' && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(160,20,20,0.5) 92%)' }}
        />
      )}
      {flash === 'counter' && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,255,65,0.18) 95%)' }}
        />
      )}

      {/* Mode banner */}
      <div className="pointer-events-none absolute left-1/2 top-10 -translate-x-1/2 text-center text-[10px] tracking-[0.35em]">
        {phase === 'practice' && <p className="text-phosphor/70">PRACTICE FORMS — no harm here</p>}
        {phase === 'sparring' && <p className="glow text-phosphor">SPARRING — round live</p>}
        {phase === 'warmup' && (
          <p className="text-phosphor/50">approach your partner and bow [E] · or [G] to spar now</p>
        )}
      </div>

      {/* Callout + response window */}
      {callout && (
        <div className="pointer-events-none absolute bottom-24 left-1/2 w-full max-w-lg -translate-x-1/2 px-4 text-center">
          <p
            className={`inline-block border bg-terminal/85 px-4 py-2 text-sm tracking-[0.2em] ${TONE_CLASS[callout.tone]}`}
          >
            {callout.text}
          </p>
        </div>
      )}
      <div className="pointer-events-none absolute bottom-20 left-1/2 h-1 w-64 -translate-x-1/2 border border-phosphor/30 bg-terminal/60">
        <div ref={windowBar} className="h-full" style={{ width: '0%', opacity: 0 }} />
      </div>

      {/* Practice progress */}
      {phase === 'practice' && (
        <div className="pointer-events-none absolute bottom-6 left-6 text-[10px] tracking-[0.25em] text-phosphor/70">
          <p className="mb-1 text-phosphor/50">FORMS LEARNED</p>
          {(Object.keys(ATTACKS) as AttackKind[]).map((kind) => (
            <p key={kind}>
              {ATTACKS[kind].name.padEnd(20, ' ')}{' '}
              <span className="text-phosphor">
                {'✓'.repeat(Math.min(practiceCounts[kind], PRACTICE_READY_PER_KIND))}
                {'○'.repeat(Math.max(0, PRACTICE_READY_PER_KIND - practiceCounts[kind]))}
              </span>
            </p>
          ))}
          <p className="mt-2 text-phosphor/50">[G] BEGIN SPARRING</p>
        </div>
      )}

      {/* Sparring meters */}
      {phase === 'sparring' && (
        <div className="pointer-events-none absolute bottom-6 left-6 space-y-2 text-[10px] tracking-[0.25em]">
          <div>
            <p className={healthFrac < 0.35 ? 'text-[#ff5f56]' : 'text-phosphor/60'}>
              CONDITION {Math.round(stats.health)}%
            </p>
            <p className={`text-sm leading-none ${healthFrac < 0.35 ? 'text-[#ff5f56]' : 'text-phosphor'}`}>
              {'▓'.repeat(healthBlocks)}
              <span className="text-phosphor/20">{'░'.repeat(20 - healthBlocks)}</span>
            </p>
          </div>
          <p className="text-phosphor/70">
            READS <span className="glow text-phosphor">{stats.points}</span>/{WIN_POINTS}
            <span className="ml-4">
              MISREADS{' '}
              <span className={stats.misreadStreak > 0 ? 'text-[#ff5f56]' : 'text-phosphor/50'}>
                {'●'.repeat(stats.misreadStreak)}
                {'○'.repeat(Math.max(0, STREAK_LIMIT - stats.misreadStreak))}
              </span>
            </span>
          </p>
        </div>
      )}

      {/* Input legend */}
      {(phase === 'practice' || phase === 'sparring') && (
        <div className="pointer-events-none absolute bottom-6 right-6 text-right text-[10px] tracking-[0.2em] text-phosphor/45">
          <p>SPACE — dodge low</p>
          <p>RIGHT-CLICK — block heavy</p>
          <p>LEFT-CLICK — counter the opening</p>
        </div>
      )}
    </>
  );
}

export interface OutcomeInfo {
  result: 'win' | 'lose-health' | 'lose-streak';
  stats: FightStats;
  durationMs: number;
}

const OUTCOME_COPY: Record<OutcomeInfo['result'], { title: string; line: string; sub: string }> = {
  win: {
    title: 'ROUND WON',
    line: '“Don’t think you are. Know you are.”',
    sub: 'he’s beginning to believe…',
  },
  'lose-health': {
    title: 'ROUND LOST',
    line: '“You’re faster than this.”',
    sub: 'he isn’t stronger than you — he’s only faster. condition depleted.',
  },
  'lose-streak': {
    title: 'ROUND LOST',
    line: '“Stop trying to hit me and hit me.”',
    sub: 'three misreads in a row — you’re guessing, not reading.',
  },
};

export function OutcomeOverlay({
  outcome,
  onSparAgain,
  onPractice,
  onExit,
}: {
  outcome: OutcomeInfo;
  onSparAgain: () => void;
  onPractice: () => void;
  onExit: () => void;
}) {
  const copy = OUTCOME_COPY[outcome.result];
  const s = outcome.stats;
  const attempts = s.reads + s.hitsTaken;
  const rows: [string, string][] = [
    ['READS', String(s.reads)],
    ['COUNTERS LANDED', String(s.counters)],
    ['HITS TAKEN', String(s.hitsTaken)],
    ['READ ACCURACY', attempts > 0 ? `${Math.round((s.reads / attempts) * 100)}%` : '—'],
    ['BEST READ STREAK', String(s.bestReadStreak)],
    ['ROUND TIME', `${Math.round(outcome.durationMs / 1000)}s`],
  ];
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-terminal/85 p-4">
      <div className="w-full max-w-md border border-phosphor/40 bg-terminal/95 p-6">
        <p className="text-[10px] tracking-[0.4em] text-phosphor-dim">DOJO :: SPARRING PROGRAM</p>
        <h2
          className={`mt-1 text-2xl tracking-[0.3em] ${
            outcome.result === 'win' ? 'glow text-phosphor' : 'text-[#ff5f56]'
          }`}
        >
          {copy.title}
        </h2>
        <p className="mt-3 text-sm italic leading-relaxed text-phosphor">{copy.line}</p>
        <p className="mt-1 text-xs text-phosphor/60">{copy.sub}</p>
        <dl className="mt-4 space-y-1 border-t border-phosphor/20 pt-3 text-xs text-phosphor/70">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <dt>{k}</dt>
              <dd className="text-phosphor">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onSparAgain}
            className="glow flex-1 border border-phosphor/60 px-3 py-2 text-xs tracking-[0.25em] text-phosphor hover:bg-phosphor/15"
          >
            [ SPAR AGAIN ]
          </button>
          <button
            type="button"
            onClick={onPractice}
            className="flex-1 border border-phosphor/30 px-3 py-2 text-xs tracking-[0.25em] text-phosphor/60 hover:text-phosphor"
          >
            [ PRACTICE ]
          </button>
          <button
            type="button"
            onClick={onExit}
            className="flex-1 border border-phosphor/30 px-3 py-2 text-xs tracking-[0.25em] text-phosphor/60 hover:text-phosphor"
          >
            [ EXIT ]
          </button>
        </div>
      </div>
    </div>
  );
}
