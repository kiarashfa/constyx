import { Outlet, useLocation } from 'react-router-dom';
import { MatrixRain, ambientRainConfig } from '../engine/rain';
import { TerminalNav } from './TerminalNav';
import { SiteFooter } from './SiteFooter';

/**
 * Persistent chrome for every route: one shared ambient rain layer, a dimming
 * veil (lighter on the landing page so the rain reads full-bleed), CRT
 * overlay, terminal nav, and the attribution footer.
 */
export function AppShell() {
  const { pathname } = useLocation();
  const isLanding = pathname === '/';

  return (
    <div className="relative min-h-screen">
      <div className="fixed inset-0 z-0">
        <MatrixRain className="block h-full w-full" config={ambientRainConfig} />
      </div>
      <div
        className={`pointer-events-none fixed inset-0 z-0 ${
          isLanding ? 'bg-terminal/25' : 'bg-terminal/70'
        }`}
      />

      <div className="relative z-10 flex min-h-screen flex-col">
        <TerminalNav />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-10 pt-6 sm:px-6">
          <Outlet />
        </main>
        <SiteFooter />
      </div>

      <div aria-hidden="true" className="crt-overlay pointer-events-none fixed inset-0 z-20" />
    </div>
  );
}
