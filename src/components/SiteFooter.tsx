import { Link } from 'react-router-dom';
import { SITE } from '../site/config';

/* The start year is fixed (when the project began); the end year is the build year. */
const years =
  __BUILD_YEAR__ > SITE.copyrightStartYear
    ? `${SITE.copyrightStartYear}–${__BUILD_YEAR__}`
    : `${SITE.copyrightStartYear}`;

const linkClass = 'inline-block py-1 text-phosphor/60 transition-colors hover:text-phosphor-bright';

/** Required attribution — rendered on every page via AppShell. */
export function SiteFooter() {
  return (
    <footer className="border-t border-phosphor/20 bg-terminal/85">
      <div className="mx-auto w-full max-w-6xl px-4 py-3 text-[11px] leading-relaxed text-phosphor/50 sm:px-6">
        <p>
          {SITE.name} is an unofficial, non-commercial fan tribute to{' '}
          <span className="text-phosphor/70">The Matrix</span> trilogy, created by the
          Wachowskis. The Matrix and all related characters, names, and imagery are ©
          Warner Bros. Entertainment Inc. This project is not affiliated with, sponsored
          by, or endorsed by Warner Bros. No commercial use. Made with respect, by fans.
        </p>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-5">
          <span>
            © {years} {SITE.author}
          </span>
          <Link to="/about" className={linkClass}>
            About
          </Link>
          <a href={SITE.repoUrl} target="_blank" rel="noopener" className={linkClass}>
            Source code
          </a>
          <a href={`${SITE.repoUrl}/blob/main/LICENSE`} target="_blank" rel="noopener" className={linkClass}>
            License
          </a>
        </div>
      </div>
    </footer>
  );
}
