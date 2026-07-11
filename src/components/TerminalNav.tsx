import { NavLink } from 'react-router-dom';

const LINKS = [
  { to: '/', code: '00', label: 'CONSOLE', end: true },
  { to: '/operator', code: '01', label: 'OPERATOR' },
  { to: '/construct', code: '02', label: 'CONSTRUCT' },
  { to: '/locations', code: '03', label: 'LOCATIONS' },
  { to: '/focus', code: '04', label: 'FOCUS' },
  { to: '/screensaver', code: '05', label: 'SCREENSAVER' },
  { to: '/ascii', code: '06', label: 'ASCII' },
  { to: '/code-vision', code: '07', label: 'CODE VISION' },
];

/** Terminal-styled persistent nav: a prompt line plus program "slots". */
export function TerminalNav() {
  return (
    <nav className="sticky top-0 z-30 border-b border-phosphor/30 bg-terminal/85 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-2 text-xs sm:px-6 sm:text-sm">
        <span className="mr-2 whitespace-nowrap text-phosphor-dim">
          operator@nebuchadnezzar:~$
        </span>
        {LINKS.map(({ to, code, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `whitespace-nowrap tracking-widest transition-colors ${
                isActive
                  ? 'glow bg-phosphor px-1 text-terminal'
                  : 'text-phosphor/70 hover:text-phosphor-bright'
              }`
            }
          >
            [{code}]{label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
