import { Link } from 'react-router-dom';

const BOOT_LINES = [
  'NEBUCHADNEZZAR :: OPERATOR CONSOLE v0.1.0',
  'hardline .............. OK',
  'broadcast depth ........ SEARCHING',
  'trace shield ........... ACTIVE',
  'constructs ............. 6 REGISTERED / 0 INITIALIZED',
];

const PROGRAMS = [
  { to: '/operator', label: 'OPERATOR — watch the code' },
  { to: '/construct', label: 'CONSTRUCT — skill downloads' },
  { to: '/locations', label: 'LOCATIONS — simulation decks' },
  { to: '/focus', label: 'FOCUS — deep-work sessions' },
  { to: '/screensaver', label: 'SCREENSAVER — export the rain' },
  { to: '/ascii', label: 'ASCII — transmission composer' },
  { to: '/code-vision', label: 'CODE VISION — see the feed as code' },
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

        <h1 className="glow mt-6 text-4xl tracking-[0.4em] sm:text-5xl">OPERATOR</h1>
        <p className="mt-3 text-sm text-phosphor/70">
          The Matrix has you. This console watches it back.
        </p>

        <div className="mt-6 space-y-1.5 text-xs sm:text-sm">
          {PROGRAMS.map(({ to, label }) => (
            <p key={to}>
              <Link
                to={to}
                className="text-phosphor/80 transition-colors hover:text-phosphor-bright"
              >
                &gt; run {label}
              </Link>
            </p>
          ))}
        </div>

        <p className="mt-6 text-xs text-phosphor-dim">
          awaiting operator input <span className="cursor-blink text-phosphor">▮</span>
        </p>
      </div>
    </div>
  );
}
