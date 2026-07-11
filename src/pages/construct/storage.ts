const KEY = 'construct.progress.v1';

export interface ProgramProgress {
  downloads: number;
  firstAt: string;
  lastAt: string;
}

export interface ConstructProgress {
  version: 1;
  programs: Record<string, ProgramProgress>;
}

const EMPTY: ConstructProgress = { version: 1, programs: {} };

export function loadProgress(): ConstructProgress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY, programs: {} };
    const parsed = JSON.parse(raw) as Partial<ConstructProgress>;
    if (parsed.version !== 1 || typeof parsed.programs !== 'object' || !parsed.programs) {
      return { ...EMPTY, programs: {} };
    }
    return { version: 1, programs: parsed.programs };
  } catch {
    return { ...EMPTY, programs: {} };
  }
}

/** Record a completed download for a program; returns updated progress. */
export function recordDownload(id: string): ConstructProgress {
  const progress = loadProgress();
  const now = new Date().toISOString();
  const prev = progress.programs[id];
  progress.programs[id] = {
    downloads: (prev?.downloads ?? 0) + 1,
    firstAt: prev?.firstAt ?? now,
    lastAt: now,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    // Storage unavailable — progress lives for this session only.
  }
  return progress;
}
