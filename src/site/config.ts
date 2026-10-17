/**
 * Site-wide identity: the one place the name, deployed address, and shared
 * head values live. Pure data with no browser or React imports, so both the
 * app and `vite.config.ts` (which builds the per-route HTML, sitemap,
 * manifest, and robots.txt from it) can import it.
 */
export const SITE = {
  name: 'ConStyx',
  /** The root page's full title (other pages use `ConStyx · Section – Page`). */
  title: 'ConStyx · matrix terminal',
  description:
    'ConStyx is an unofficial, non-commercial fan tribute to The Matrix trilogy. The browser as an operator terminal: watch the code, download skills, jack into scenes, settle in to focus.',
  /** Deployed origin, no trailing slash. */
  origin: 'https://kiarashfa.github.io',
  /**
   * Path the production build is served from (GitHub Pages project site).
   * The dev server stays at '/'. Every absolute URL the build emits — assets,
   * canonical/OG links, sitemap, manifest — runs through this.
   */
  basePath: '/constyx/',
  repoUrl: 'https://github.com/kiarashfa/constyx',
  author: 'Kiarash Farajzadehahary',
  /** First year of the project; the footer computes the range from it. */
  copyrightStartYear: 2026,
  /** Terminal black (`--color-terminal`) — browser chrome + manifest. */
  themeColor: '#020604',
  /** Social preview: 1200×630 PNG under public/. */
  ogImage: { path: 'og-image.png', width: 1200, height: 630, alt: 'The ConStyx wordmark over green digital rain' },
} as const;
