import { useEffect, useRef, type MutableRefObject } from 'react';
import { MatrixRain } from '../../../../engine/rain';

export type RdPhase = 'street' | 'spotted' | 'won' | 'program';

interface RedDressHudProps {
  phase: RdPhase;
  attempts: number;
  hintsUsed: number;
  /** 0..100, mutated by the detection loop. */
  detectionRef: MutableRefObject<number>;
}

export function RedDressHud({ phase, attempts, hintsUsed, detectionRef }: RedDressHudProps) {
  const meterWrap = useRef<HTMLDivElement>(null);
  const meterFill = useRef<HTMLDivElement>(null);

  // Attention meter fades in only while something is actually noticing you.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const wrap = meterWrap.current;
      const fill = meterFill.current;
      if (!wrap || !fill) return;
      const d = detectionRef.current;
      wrap.style.opacity = d > 4 ? '1' : '0';
      fill.style.width = `${Math.min(100, d).toFixed(1)}%`;
      fill.style.backgroundColor = d > 65 ? '#ff5f56' : d > 35 ? '#ffb020' : 'var(--color-phosphor)';
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [detectionRef]);

  return (
    <>
      <div className="pointer-events-none absolute left-1/2 top-10 -translate-x-1/2 text-center text-[10px] tracking-[0.35em]">
        {phase === 'street' && (
          <p className="text-phosphor/60">reach the ringing hardline · unseen</p>
        )}
      </div>

      <div className="pointer-events-none absolute right-4 top-10 text-right text-[10px] tracking-[0.25em] text-phosphor/50">
        <p>ATTEMPT {attempts + 1}</p>
        <p className="mt-1">[H] hint{hintsUsed > 0 ? ` · used ${hintsUsed}` : ''}</p>
      </div>

      {/* Someone is paying attention to you */}
      <div
        ref={meterWrap}
        className="pointer-events-none absolute bottom-16 left-1/2 -translate-x-1/2 text-center transition-opacity duration-300"
        style={{ opacity: 0 }}
      >
        <p className="mb-1 text-[10px] tracking-[0.35em] text-phosphor/70">ATTENTION ON YOU</p>
        <div className="h-1.5 w-56 border border-phosphor/40 bg-terminal/70">
          <div ref={meterFill} className="h-full" style={{ width: '0%' }} />
        </div>
      </div>

      {/* Compromised → simulation reload */}
      {phase === 'spotted' && (
        <div className="absolute inset-0 z-20">
          <MatrixRain
            className="block h-full w-full"
            config={{ speed: 90, density: 1, fadeAlpha: 0.28, fontSize: 14 }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="border border-[#ff5f56]/60 bg-terminal/85 px-6 py-4 text-center">
              <p className="text-[10px] tracking-[0.4em] text-[#ff5f56]">YOU'VE BEEN MADE</p>
              <p className="mt-2 text-sm tracking-[0.25em] text-phosphor">
                RELOADING THE STREET :: HE WON'T BE WHERE HE WAS
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export interface StreetStats {
  attempts: number;
  hintsUsed: number;
  timeSec: number;
  metHer: boolean;
}

export function WinOverlay({
  stats,
  onAgain,
  onExit,
}: {
  stats: StreetStats;
  onAgain: () => void;
  onExit: () => void;
}) {
  const rows: [string, string][] = [
    ['ATTEMPTS', String(stats.attempts + 1)],
    ['HINTS USED', String(stats.hintsUsed)],
    ['TIME ON THE STREET', `${Math.round(stats.timeSec)}s`],
    ['THE OTHER PROGRAM', stats.metHer ? 'found' : 'undiscovered'],
  ];
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-terminal/85 p-4">
      <div className="w-full max-w-md border border-phosphor/40 bg-terminal/95 p-6">
        <p className="text-[10px] tracking-[0.4em] text-phosphor-dim">AWARENESS PROGRAM :: COMPLETE</p>
        <h2 className="glow mt-1 text-2xl tracking-[0.25em] text-phosphor">HARDLINE REACHED</h2>
        <p className="mt-3 text-xs leading-relaxed text-phosphor/60">
          You looked at everything and lingered on nothing. The crowd never learned your
          face; the one who was watching never got the chance. That's the whole lesson —
          the street is full of things built to be looked at. Stay the one doing the looking.
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
            [ WALK IT AGAIN ]
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
