import type { WeaponEntry } from './types';
import { CATEGORY_LABEL } from './types';

export interface RangeScore {
  shots: number;
  hits: number;
  score: number;
  best: number;
}

interface ArmoryHudProps {
  weapon: WeaponEntry | null;
  score: RangeScore;
  rushing: boolean;
}

export function ArmoryHud({ weapon, score, rushing }: ArmoryHudProps) {
  const accuracy = score.shots > 0 ? Math.round((score.hits / score.shots) * 100) : 0;
  return (
    <>
      {rushing && (
        <div className="pointer-events-none absolute left-1/2 top-10 -translate-x-1/2">
          <p className="glow text-xs tracking-[0.4em] text-phosphor">LOADING ORDNANCE…</p>
        </div>
      )}

      {/* Loaded weapon line */}
      <div className="pointer-events-none absolute bottom-6 left-6 text-[10px] tracking-[0.25em]">
        {weapon ? (
          <>
            <p className="text-phosphor/50">LOADED</p>
            <p className="glow text-sm tracking-[0.2em] text-phosphor">{weapon.name}</p>
            <p className="text-phosphor/50">{CATEGORY_LABEL[weapon.category]}</p>
          </>
        ) : (
          <p className="text-phosphor/45">no weapon loaded — open the manifest [M]</p>
        )}
      </div>

      {/* Range score */}
      {weapon && (
        <div className="pointer-events-none absolute bottom-6 right-6 text-right text-[10px] tracking-[0.25em] text-phosphor/70">
          <p>
            SHOTS {score.shots} · HITS {score.hits} · ACC{' '}
            <span className={accuracy >= 70 ? 'glow text-phosphor' : ''}>{accuracy}%</span>
          </p>
          <p>
            SCORE <span className="glow text-phosphor">{score.score}</span>
            {score.best > 0 && <span className="ml-2 text-phosphor/45">BEST {score.best}</span>}
          </p>
          <p className="mt-1 text-phosphor/40">[LMB] fire · [M] manifest · [E] interact</p>
        </div>
      )}
    </>
  );
}
