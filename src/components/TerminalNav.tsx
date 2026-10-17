import { NavLink } from 'react-router-dom';
import { SECTIONS } from '../site/routes';

const LINKS = [
  { to: '/', code: '00', label: 'CONSOLE', end: true },
  ...SECTIONS.map(({ path, code, label }) => ({ to: path, code, label, end: false })),
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
