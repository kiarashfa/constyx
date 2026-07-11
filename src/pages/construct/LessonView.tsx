import { Link } from 'react-router-dom';
import type { Lesson } from './types';
import { CATEGORY_LABEL } from './types';
import type { ProgramProgress } from './storage';
import { LessonBlockView, LessonImageView } from './blocks';

interface LessonViewProps {
  lesson: Lesson;
  progress: ProgramProgress | undefined;
}

/** The article view: HUD-framed header, section manifest, block content. */
export function LessonView({ lesson, progress }: LessonViewProps) {
  return (
    <div className="text-ink">
      <header className="border-b border-ink/20 pb-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[11px] tracking-[0.4em] text-ink-soft">
            CONSTRUCT :: PROGRAM {lesson.code} :: {CATEGORY_LABEL[lesson.category]}
          </p>
          <p className="text-[11px] tracking-[0.2em] text-loaded">
            ■ LOADED{progress && progress.downloads > 1 ? ` ×${progress.downloads}` : ''}
          </p>
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-[0.2em] sm:text-4xl">{lesson.title}</h1>
        <p className="mt-2 text-sm italic text-ink-soft">“{lesson.tagline}”</p>
        <p className="mt-3 text-[11px] tracking-[0.2em] text-ink-soft">
          PAYLOAD {lesson.sizeLabel} · INTEGRATION TIME ~{lesson.estMinutes} MIN ·{' '}
          {lesson.sections.length} MODULES
        </p>
      </header>

      <div className="mt-6 grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav className="lg:sticky lg:top-20 lg:self-start">
          <p className="text-[10px] tracking-[0.3em] text-ink-soft">MODULE MANIFEST</p>
          <ol className="mt-2 space-y-1.5 border-l border-ink/15 pl-3">
            {lesson.sections.map((section, i) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="text-xs leading-snug text-ink-soft hover:text-loaded"
                >
                  {String(i + 1).padStart(2, '0')} · {section.heading}
                </a>
              </li>
            ))}
          </ol>
          <Link
            to="/construct"
            className="mt-5 inline-block border border-ink/30 px-3 py-1.5 text-[11px] tracking-[0.25em] text-ink-soft hover:border-ink hover:text-ink"
          >
            ← PROGRAM LIBRARY
          </Link>
        </nav>

        <article className="max-w-3xl">
          {lesson.sections.map((section, i) => (
            <section key={section.id} id={section.id} className="scroll-mt-20 pb-10">
              <h2 className="flex items-baseline gap-3 text-lg font-bold tracking-[0.15em]">
                <span className="text-xs text-loaded">{String(i + 1).padStart(2, '0')}</span>
                {section.heading}
              </h2>
              <div className="mt-4 space-y-4">
                {section.blocks.map((block, j) => (
                  <LessonBlockView key={j} block={block} />
                ))}
                {section.image && <LessonImageView image={section.image} />}
              </div>
            </section>
          ))}

          {lesson.sources && lesson.sources.length > 0 && (
            <footer className="border-t border-ink/20 pt-4">
              <p className="text-[10px] tracking-[0.3em] text-ink-soft">ARCHIVE REFERENCES</p>
              <ul className="mt-2 space-y-1">
                {lesson.sources.map((source) => (
                  <li key={source} className="text-xs leading-relaxed text-ink-soft">
                    ◦ {source}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] text-ink-soft/70">
                Written for this console from the sources above — research input, not copied text.
              </p>
            </footer>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/construct"
              className="border border-ink px-4 py-2 text-xs font-bold tracking-[0.3em] text-ink hover:bg-ink hover:text-construct"
            >
              [ RETURN TO LIBRARY ]
            </Link>
          </div>
        </article>
      </div>
    </div>
  );
}
