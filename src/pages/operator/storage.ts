const KEY = 'operator.career.v1';

export interface CareerStats {
  version: 1;
  shiftsCompleted: number;
  shiftsTraced: number;
  totalScore: number;
  bestScore: number;
  /** Best single-shift accuracy 0..1 (shifts with at least one call). */
  bestAccuracy: number;
  totalCorrect: number;
  totalWrong: number;
  totalMissed: number;
  lastShiftAt: string | null;
}

export interface ShiftResult {
  outcome: 'complete' | 'traced';
  score: number;
  correct: number;
  wrong: number;
  missed: number;
  probes: number;
  /** 0..1; NaN-safe (0 when no calls were made). */
  accuracy: number;
  rankLabel: string;
  rankBlurb: string;
  newBestScore: boolean;
}

const EMPTY: CareerStats = {
  version: 1,
  shiftsCompleted: 0,
  shiftsTraced: 0,
  totalScore: 0,
  bestScore: 0,
  bestAccuracy: 0,
  totalCorrect: 0,
  totalWrong: 0,
  totalMissed: 0,
  lastShiftAt: null,
};

export function loadCareer(): CareerStats {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<CareerStats>;
    if (parsed.version !== 1) return { ...EMPTY };
    return { ...EMPTY, ...parsed };
  } catch {
    // Private mode / blocked storage: play without persistence.
    return { ...EMPTY };
  }
}

/** Fold a finished shift into career stats, persist, and return the update. */
export function recordShift(
  result: Omit<ShiftResult, 'newBestScore'>,
): { career: CareerStats; newBestScore: boolean } {
  const career = loadCareer();
  const newBestScore = result.score > career.bestScore && career.shiftsCompleted > 0;
  career.shiftsCompleted += 1;
  if (result.outcome === 'traced') career.shiftsTraced += 1;
  career.totalScore += result.score;
  career.bestScore = Math.max(career.bestScore, result.score);
  career.bestAccuracy = Math.max(career.bestAccuracy, result.accuracy);
  career.totalCorrect += result.correct;
  career.totalWrong += result.wrong;
  career.totalMissed += result.missed;
  career.lastShiftAt = new Date().toISOString();
  try {
    localStorage.setItem(KEY, JSON.stringify(career));
  } catch {
    // Storage unavailable — stats live for this session only.
  }
  return { career, newBestScore };
}
