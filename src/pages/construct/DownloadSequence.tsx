import { useEffect, useRef, useState } from 'react';
import type { Lesson } from './types';

interface DownloadSequenceProps {
  lesson: Lesson;
  /** Fires exactly once, when the sequence finishes or is skipped. */
  onComplete: () => void;
}

const DURATION_MS = 3400;
const LOADED_BEAT_MS = 900;

/**
 * The loading-program theater: a progress readout that streams the lesson's
 * own section manifest as "modules", then a LOADED beat, then hands off to
 * the article. Skippable — impatience is very human.
 */
export function DownloadSequence({ lesson, onComplete }: DownloadSequenceProps) {
  const [progress, setProgress] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const doneRef = useRef(false);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onComplete();
  };

  useEffect(() => {
    const started = performance.now();
    const interval = setInterval(() => {
      const t = Math.min((performance.now() - started) / DURATION_MS, 1);
      // Ease with a couple of "stalls" so it feels like a real transfer.
      const eased = t < 0.7 ? t * 1.1 : 0.77 + (t - 0.7) * 0.77;
      setProgress(Math.min(Math.round(eased * 100), 100));
      if (t >= 1) {
        clearInterval(interval);
        setLoaded(true);
      }
    }, 60);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const timeout = setTimeout(finish, LOADED_BEAT_MS);
    return () => clearTimeout(timeout);
  }, [loaded]);

  const modules = lesson.sections;
  const revealed = Math.floor((progress / 100) * modules.length);
  const barBlocks = 28;
  const filled = Math.round((progress / 100) * barBlocks);

  return (
    <div className="flex min-h-[60vh] items-center justify-center text-ink">
      <div className="w-full max-w-xl px-4">
        <p className="text-[11px] tracking-[0.4em] text-ink-soft">
          CONSTRUCT :: PROGRAM {lesson.code}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-[0.25em] sm:text-4xl">{lesson.title}</h1>

        {!loaded ? (
          <>
            <p className="mt-6 text-xs tracking-[0.3em] text-ink-soft">
              DOWNLOADING PROGRAM — {lesson.sizeLabel}
            </p>
            <p className="mt-3 font-bold leading-none text-loaded" aria-hidden="true">
              {'▓'.repeat(filled)}
              <span className="text-ink/15">{'░'.repeat(barBlocks - filled)}</span>
              <span className="ml-3 text-sm">{progress}%</span>
            </p>
            <ul className="mt-6 min-h-32 space-y-1.5 text-xs text-ink-soft">
              {modules.slice(0, revealed).map((section) => (
                <li key={section.id}>
                  ▸ mounting module :: {section.heading.toLowerCase()}{' '}
                  <span className="text-loaded">ok</span>
                </li>
              ))}
              {revealed < modules.length && (
                <li className="cursor-blink text-ink/40">▮</li>
              )}
            </ul>
            <button
              type="button"
              onClick={finish}
              className="mt-6 border border-ink/30 px-4 py-1.5 text-[11px] tracking-[0.3em] text-ink-soft hover:border-ink hover:text-ink"
            >
              [ SKIP TRANSFER ]
            </button>
          </>
        ) : (
          <div className="mt-6">
            <p className="text-lg font-bold tracking-[0.3em] text-loaded">■ PROGRAM LOADED</p>
            <p className="mt-2 text-sm italic text-ink-soft">“{lesson.tagline}”</p>
          </div>
        )}
      </div>
    </div>
  );
}
