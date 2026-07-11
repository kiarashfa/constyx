import { useEffect, useRef, type MutableRefObject } from 'react';
import { MatrixRain } from '../../../../engine/rain';
import type { DodgeDir } from './Bullets';

export type BtPhase = 'standby' | 'intro' | 'wave' | 'break' | 'reloading' | 'won';

/** 60Hz prompt state — written by the system, read by a rAF loop here. */
export interface PromptRef {
  dir: DodgeDir | null;
  /** Sim-clock seconds of window start/end. */
  start: number;
  end: number;
}

export interface AttemptStats {
  dodged: number;
  grazes: number;
  perfectWaves: number;
  reactionsMs: number[];
}

interface BulletTimeHudProps {
  phase: BtPhase;
  wave: number;
  waveCount: number;
  grazes: number;
  maxGrazes: number;
  feedback: { text: string; tone: 'good' | 'bad' | 'info' } | null;
  prompt: MutableRefObject<PromptRef>;
  clockRef: MutableRefObject<number>;
  flash: 'none' | 'hit' | 'clean';
}

const DIR_LABEL: Record<DodgeDir, string> = {
  back: '▼ LEAN BACK [S]',
  left: '◀ LEAN LEFT [A]',
  right: 'LEAN RIGHT [D] ▶',
};

const TONE_CLASS = {
  good: 'glow border-phosphor text-phosphor',
  bad: 'border-[#ff5f56]/70 text-[#ff5f56]',
  info: 'border-phosphor/50 text-phosphor/80',
};

export function BulletTimeHud({
  phase,
  wave,
  waveCount,
  grazes,
  maxGrazes,
  feedback,
  prompt,
  clockRef,
  flash,
}: BulletTimeHudProps) {
  const promptBox = useRef<HTMLDivElement>(null);
  const promptText = useRef<HTMLParagraphElement>(null);
  const windowBar = useRef<HTMLDivElement>(null);

  // Prompt + shrinking window bar, direct DOM writes at frame rate.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const box = promptBox.current;
      const text = promptText.current;
      const bar = windowBar.current;
      if (!box || !text || !bar) return;
      const p = prompt.current;
      const now = clockRef.current;
      if (!p.dir || now > p.end) {
        box.style.opacity = '0';
        return;
      }
      box.style.opacity = '1';
      text.textContent = DIR_LABEL[p.dir];
      const left = Math.max(0, (p.end - now) / (p.end - p.start));
      bar.style.width = `${(left * 100).toFixed(1)}%`;
      bar.style.backgroundColor = left < 0.35 ? '#ff5f56' : 'var(--color-phosphor)';
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [prompt, clockRef]);

  return (
    <>
      {/* Hit / clean-dodge washes */}
      {flash === 'hit' && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at center, transparent 38%, rgba(160,20,20,0.5) 92%)' }}
        />
      )}
      {flash === 'clean' && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,255,65,0.12) 96%)' }}
        />
      )}

      {/* Wave banner */}
      <div className="pointer-events-none absolute left-1/2 top-10 -translate-x-1/2 text-center text-[10px] tracking-[0.35em]">
        {phase === 'wave' && (
          <p className="glow text-phosphor">
            WAVE {wave}/{waveCount}
          </p>
        )}
        {phase === 'break' && <p className="text-phosphor/60">reload… breathe…</p>}
        {phase === 'intro' && <p className="text-phosphor/60">he's drawing — watch the air, answer the arrow</p>}
        {phase === 'standby' && <p className="text-phosphor/50">take control to begin</p>}
      </div>

      {/* Grazes */}
      <div className="pointer-events-none absolute right-4 top-10 text-right text-[10px] tracking-[0.25em]">
        <p className={grazes > 0 ? 'text-[#ff5f56]' : 'text-phosphor/50'}>
          GRAZES {'●'.repeat(grazes)}
          {'○'.repeat(Math.max(0, maxGrazes - grazes))}
        </p>
        <p className="mt-1 text-phosphor/40">A left · S back · D right</p>
      </div>

      {/* Directional prompt + response window */}
      <div
        ref={promptBox}
        className="pointer-events-none absolute bottom-24 left-1/2 -translate-x-1/2 text-center"
        style={{ opacity: 0 }}
      >
        <p
          ref={promptText}
          className="glow border border-phosphor/60 bg-terminal/85 px-5 py-2.5 text-lg tracking-[0.25em] text-phosphor"
        />
        <div className="mx-auto mt-1.5 h-1 w-56 border border-phosphor/30 bg-terminal/60">
          <div ref={windowBar} className="h-full" style={{ width: '100%' }} />
        </div>
      </div>

      {/* Resolve feedback */}
      {feedback && (
        <div className="pointer-events-none absolute bottom-14 left-1/2 -translate-x-1/2">
          <p
            className={`border bg-terminal/85 px-3 py-1.5 text-xs tracking-[0.2em] ${TONE_CLASS[feedback.tone]}`}
          >
            {feedback.text}
          </p>
        </div>
      )}

      {/* Simulation reload (three grazes) */}
      {phase === 'reloading' && (
        <div className="absolute inset-0 z-20">
          <MatrixRain
            className="block h-full w-full"
            config={{ speed: 90, density: 1, fadeAlpha: 0.28, fontSize: 14 }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="border border-phosphor/50 bg-terminal/80 px-5 py-3 text-sm tracking-[0.3em] text-phosphor">
              TOO MANY HITS :: RELOADING SIMULATION
            </p>
          </div>
        </div>
      )}
    </>
  );
}

export function OutcomeOverlay({
  stats,
  onAgain,
  onExit,
}: {
  stats: AttemptStats;
  onAgain: () => void;
  onExit: () => void;
}) {
  const avgReaction =
    stats.reactionsMs.length > 0
      ? Math.round(stats.reactionsMs.reduce((a, b) => a + b, 0) / stats.reactionsMs.length)
      : 0;
  const rows: [string, string][] = [
    ['BULLETS DODGED', String(stats.dodged)],
    ['GRAZES TAKEN', String(stats.grazes)],
    ['PERFECT WAVES', String(stats.perfectWaves)],
    ['AVG REACTION', avgReaction > 0 ? `${avgReaction} ms` : '—'],
  ];
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-terminal/85 p-4">
      <div className="w-full max-w-md border border-phosphor/40 bg-terminal/95 p-6">
        <p className="text-[10px] tracking-[0.4em] text-phosphor-dim">BULLET TIME :: COMPLETE</p>
        <h2 className="glow mt-1 text-2xl tracking-[0.25em] text-phosphor">
          YOU MOVED LIKE THEY DO
        </h2>
        <p className="mt-3 text-xs leading-relaxed text-phosphor/60">
          Nobody dodges a full magazine on instinct. You didn't need to — you only had to
          not be where the bullet was going. The air remembers the shape you left in it.
        </p>
        <dl className="mt-4 space-y-1 border-t border-phosphor/20 pt-3 text-xs text-phosphor/70">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <dt>{k}</dt>
              <dd className="text-phosphor">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onAgain}
            className="glow flex-1 border border-phosphor/60 px-3 py-2 text-xs tracking-[0.25em] text-phosphor hover:bg-phosphor/15"
          >
            [ RUN IT AGAIN ]
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
