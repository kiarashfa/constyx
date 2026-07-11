import { Link, Outlet } from 'react-router-dom';
import { useState } from 'react';
import type { Lesson } from './types';
import { CATEGORY_LABEL } from './types';
import { LESSONS } from './lessons';
import { loadProgress } from './storage';

/**
 * Layout for all /construct routes: swaps the terminal's dark rain for the
 * white loading-void. The shell's nav/footer stay dark, framing the program —
 * the same contrast trick the films use for Construct scenes.
 */
export function ConstructLayout() {
  return (
    <>
      <div aria-hidden="true" className="construct-void fixed inset-0 -z-10" />
      <Outlet />
    </>
  );
}

function ProgramCard({ lesson, downloads }: { lesson: Lesson; downloads: number }) {
  const loaded = downloads > 0;
  return (
    <Link
      to={`/construct/${lesson.id}`}
      className="group flex flex-col border border-ink/30 bg-white/70 p-4 transition-colors hover:border-loaded hover:bg-white"
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] tracking-[0.3em] text-ink-soft">
          {lesson.code} :: {CATEGORY_LABEL[lesson.category]}
        </p>
        <p className={`text-[11px] tracking-[0.15em] ${loaded ? 'text-loaded' : 'text-ink/40'}`}>
          {loaded ? `■ LOADED${downloads > 1 ? ` ×${downloads}` : ''}` : '□ NOT LOADED'}
        </p>
      </div>
      <h2 className="mt-2 text-xl font-bold tracking-[0.15em] text-ink group-hover:text-loaded">
        {lesson.title}
      </h2>
      <p className="mt-1 text-xs italic text-ink-soft">“{lesson.tagline}”</p>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-soft">{lesson.summary}</p>
      <p className="mt-4 border-t border-ink/10 pt-2 text-[11px] tracking-[0.15em] text-ink-soft">
        PAYLOAD {lesson.sizeLabel} · ~{lesson.estMinutes} MIN ·{' '}
        <span className="text-loaded opacity-0 transition-opacity group-hover:opacity-100">
          TAP TO DOWNLOAD ▸
        </span>
      </p>
    </Link>
  );
}

/** The program library — the shelf of loadable skills. */
export function ConstructPage() {
  const [progress] = useState(loadProgress);
  const loadedCount = LESSONS.filter((l) => progress.programs[l.id]).length;

  return (
    <div className="text-ink">
      <header className="mb-6">
        <p className="text-[11px] tracking-[0.4em] text-ink-soft">/// PROGRAM 02</p>
        <h1 className="mt-1 text-3xl font-bold tracking-[0.25em] sm:text-4xl">THE CONSTRUCT</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">
          This is the loading program. We can load anything, from clothing to equipment,
          weapons, training simulations — anything we need. Choose a discipline; the
          console uploads it straight to your head. Reading it afterwards is, regrettably,
          still manual.
        </p>
        <p className="mt-3 text-[11px] tracking-[0.25em] text-loaded">
          {loadedCount} / {LESSONS.length} PROGRAMS LOADED
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {LESSONS.map((lesson) => (
          <ProgramCard
            key={lesson.id}
            lesson={lesson}
            downloads={progress.programs[lesson.id]?.downloads ?? 0}
          />
        ))}
      </div>
    </div>
  );
}
