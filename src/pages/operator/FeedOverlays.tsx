import type { CareerStats, ShiftResult } from './storage';

function OverlayFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-terminal/85 p-4">
      <div className="w-full max-w-md border border-phosphor/40 bg-terminal/90 p-5">{children}</div>
    </div>
  );
}

export function BriefingOverlay({
  career,
  onStart,
}: {
  career: CareerStats;
  onStart: () => void;
}) {
  return (
    <OverlayFrame>
      <p className="text-[10px] tracking-[0.3em] text-phosphor-dim">SHIFT BRIEFING</p>
      <h2 className="glow mt-1 text-xl tracking-[0.3em]">WATCH THE CODE</h2>
      <ul className="mt-4 space-y-2 text-xs leading-relaxed text-phosphor/70">
        <li>▸ Anomalies surface as columns that look wrong — white and fast, repeating glyphs, pulsing digits, or faint static.</li>
        <li>▸ Click the affected column, then pick the verb that matches what you saw. Every signature has exactly one right call.</li>
        <li>▸ Wrong calls, misses, and probing clean nodes raise the TRACE. At 100% they find the hardline.</li>
      </ul>
      {career.shiftsCompleted > 0 && (
        <p className="mt-4 border-t border-phosphor/20 pt-3 text-[11px] text-phosphor/50">
          career :: {career.shiftsCompleted} shifts · best {career.bestScore} · best accuracy{' '}
          {Math.round(career.bestAccuracy * 100)}% · traced {career.shiftsTraced}×
        </p>
      )}
      <button
        type="button"
        onClick={onStart}
        className="glow mt-5 w-full border border-phosphor/60 px-4 py-2 text-sm tracking-[0.35em] text-phosphor hover:bg-phosphor/15"
      >
        [ START SHIFT ]
      </button>
    </OverlayFrame>
  );
}

export function PausedOverlay({ onResume }: { onResume: () => void }) {
  return (
    <OverlayFrame>
      <h2 className="glow text-xl tracking-[0.3em]">FEED HELD</h2>
      <p className="mt-3 text-xs text-phosphor/70">
        Shift clock frozen. The code waits for no one — but the console does.
      </p>
      <button
        type="button"
        onClick={onResume}
        className="glow mt-5 w-full border border-phosphor/60 px-4 py-2 text-sm tracking-[0.35em] text-phosphor hover:bg-phosphor/15"
      >
        [ RESUME ]
      </button>
    </OverlayFrame>
  );
}

export function ResultsOverlay({
  result,
  career,
  onRestart,
  onDismiss,
}: {
  result: ShiftResult;
  career: CareerStats;
  onRestart: () => void;
  onDismiss: () => void;
}) {
  const rows: [string, string][] = [
    ['SCORE', String(result.score)],
    ['CORRECT CALLS', String(result.correct)],
    ['WRONG CALLS', String(result.wrong)],
    ['MISSED', String(result.missed)],
    ['CLEAN PROBES', String(result.probes)],
    ['ACCURACY', `${Math.round(result.accuracy * 100)}%`],
  ];
  return (
    <OverlayFrame>
      <p className="text-[10px] tracking-[0.3em] text-phosphor-dim">
        {result.outcome === 'traced' ? 'SHIFT ABORTED' : 'SHIFT COMPLETE'}
      </p>
      <h2
        className={`mt-1 text-2xl tracking-[0.3em] ${
          result.outcome === 'traced' ? 'text-[#ff5f56]' : 'glow'
        }`}
      >
        {result.rankLabel}
      </h2>
      <p className="mt-1 text-xs italic text-phosphor/60">{result.rankBlurb}</p>
      {result.newBestScore && (
        <p className="mt-2 text-xs tracking-widest text-phosphor-bright">★ NEW BEST SHIFT</p>
      )}
      <dl className="mt-4 space-y-1 text-xs text-phosphor/70">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between">
            <dt>{k}</dt>
            <dd className="text-phosphor">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 border-t border-phosphor/20 pt-3 text-[11px] text-phosphor/50">
        career :: {career.shiftsCompleted} shifts · best {career.bestScore} · best accuracy{' '}
        {Math.round(career.bestAccuracy * 100)}% · traced {career.shiftsTraced}×
      </p>
      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={onRestart}
          className="glow flex-1 border border-phosphor/60 px-3 py-2 text-xs tracking-[0.3em] text-phosphor hover:bg-phosphor/15"
        >
          [ NEXT SHIFT ]
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="flex-1 border border-phosphor/30 px-3 py-2 text-xs tracking-[0.3em] text-phosphor/60 hover:text-phosphor"
        >
          [ STAND DOWN ]
        </button>
      </div>
    </OverlayFrame>
  );
}
