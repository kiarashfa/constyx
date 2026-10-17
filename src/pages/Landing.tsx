import { Link } from 'react-router-dom';
import { SITE } from '../site/config';
import { SECTIONS } from '../site/routes';
import { SCENES } from './locations/scenes';
import { FOCUS_SCENES } from './focus/scenes';

/** `label ....... value`, dot-leadered so the values line up in one column. */
const readout = (label: string, value: string) =>
  `${label} ${'.'.repeat(Math.max(2, 23 - label.length))} ${value}`;

const sceneCount = [...SCENES, ...FOCUS_SCENES].filter((scene) => scene.status === 'online').length;

const BOOT_LINES = [
  `NEBUCHADNEZZAR :: OPERATOR CONSOLE v${__APP_VERSION__}`,
  readout('hardline', 'OK'),
  readout('broadcast depth', 'SEARCHING'),
  readout('trace shield', 'ACTIVE'),
  readout('programs', `${SECTIONS.length} ONLINE`),
  readout('simulations', `${sceneCount} LOADED`),
];

/** Full-bleed rain with a minimal boot readout floating on top. */
export function Landing() {
  return (
    <div className="flex min-h-[70vh] flex-col justify-center py-8">
      <div className="max-w-xl border border-phosphor/30 bg-terminal/80 p-5 sm:p-7">
        <div className="space-y-1 text-xs text-phosphor/70 sm:text-sm">
          {BOOT_LINES.map((line) => (
            <p key={line}>&gt; {line}</p>
          ))}
        </div>

        <h1 className="glow mt-6 text-4xl tracking-[0.3em] sm:text-5xl">{SITE.name}</h1>
        <p className="mt-3 text-sm text-phosphor/70">
          The Matrix has you. This console watches it back.
        </p>

        <div className="mt-6 space-y-1.5 text-xs sm:text-sm">
          {SECTIONS.map(({ path, label, tagline }) => (
            <p key={path}>
              <Link
                to={path}
                className="text-phosphor/80 transition-colors hover:text-phosphor-bright"
              >
                &gt; run {label} :: {tagline}
              </Link>
            </p>
          ))}
        </div>

        <p className="mt-6 text-xs text-phosphor-dim">
          awaiting operator input <span className="cursor-blink text-phosphor">▮</span>
        </p>
        <p className="mt-2 text-xs">
          <Link to="/about" className="text-phosphor/60 transition-colors hover:text-phosphor-bright">
            &gt; whoami :: about this console
          </Link>
        </p>
      </div>
    </div>
  );
}
