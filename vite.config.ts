import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, runnerImport, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import * as ts from 'typescript';
import { SITE } from './src/site/config';

const rootDir = dirname(fileURLToPath(import.meta.url));
const rainDir = resolve(rootDir, 'src/engine/rain');
// Dependency order: presets defines defaultRainConfig, RainEngine uses it, the
// entry uses RainEngine. types.ts is intentionally omitted — it is type-only,
// so every reference to it is erased by the compiler.
const RAIN_SOURCES = ['presets.ts', 'RainEngine.ts', 'standalone.ts'];
const RAIN_VIRTUAL_ID = 'virtual:rain-standalone';
const RAIN_RESOLVED_ID = '\0' + RAIN_VIRTUAL_ID;

/**
 * Drop ESM module syntax so the source files can be concatenated into one
 * script. Only import/export STATEMENTS are touched (a small, predictable set
 * we own); every inline type annotation is left for the TypeScript compiler to
 * erase. Imports resolve within-folder to sibling modules that are already
 * concatenated ahead, so deleting them is safe.
 */
function stripModuleSyntax(source: string): string {
  return source
    .split('\n')
    .filter((line) => !/^\s*import\b/.test(line))
    .map((line) =>
      line.replace(
        /^(\s*)export\s+(?=(?:default\s+)?(?:abstract\s+)?(?:const|class|function|interface|type|enum|let|var)\b)/,
        '$1',
      ),
    )
    .join('\n');
}

/**
 * Exposes `virtual:rain-standalone` — the real rain engine transpiled to a
 * self-contained browser script (a `string`). The Screensaver export inlines it
 * verbatim into the downloadable HTML, so exported screensavers run the site's
 * actual engine code rather than a separate copy.
 */
function rainStandalonePlugin(): Plugin {
  return {
    name: 'operator:rain-standalone',
    resolveId(id) {
      if (id === RAIN_VIRTUAL_ID) return RAIN_RESOLVED_ID;
    },
    load(id) {
      if (id !== RAIN_RESOLVED_ID) return;
      const merged = RAIN_SOURCES.map((file) => {
        const path = resolve(rainDir, file);
        this.addWatchFile(path);
        return stripModuleSyntax(readFileSync(path, 'utf8'));
      }).join('\n\n');

      const { outputText } = ts.transpileModule(merged, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
          useDefineForClassFields: true,
          removeComments: true,
        },
      });

      return `export default ${JSON.stringify(outputText)};`;
    },
  };
}

interface PageMeta {
  path: string;
  title: string;
  description: string;
}

const HEAD_START = '<!--site-head-->';
const HEAD_END = '<!--/site-head-->';

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Router path → deployed absolute URL. Pages are directory indexes, so they end in '/'. */
const pageUrl = (base: string, path: string) =>
  SITE.origin + base + (path === '/' ? '' : `${path.replace(/^\/+|\/+$/g, '')}/`);

/** The shared <head> block: title, description, icons, manifest, and link-preview tags. */
function headBlock(base: string, page: PageMeta, opts: { noindex?: boolean } = {}): string {
  const url = pageUrl(base, page.path);
  const image = SITE.origin + base + SITE.ogImage.path;
  const imageAlt = escapeHtml(SITE.ogImage.alt);
  const title = escapeHtml(page.title);
  const description = escapeHtml(page.description);
  const lines = [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    opts.noindex ? '<meta name="robots" content="noindex" />' : `<link rel="canonical" href="${url}" />`,
    `<meta name="theme-color" content="${SITE.themeColor}" />`,
    `<link rel="icon" type="image/svg+xml" href="${base}favicon.svg" />`,
    `<link rel="apple-touch-icon" href="${base}apple-touch-icon.png" />`,
    `<link rel="manifest" href="${base}site.webmanifest" />`,
    '<meta property="og:type" content="website" />',
    `<meta property="og:site_name" content="${SITE.name}" />`,
    ...(opts.noindex ? [] : [`<meta property="og:url" content="${url}" />`]),
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta property="og:image:width" content="${SITE.ogImage.width}" />`,
    `<meta property="og:image:height" content="${SITE.ogImage.height}" />`,
    `<meta property="og:image:alt" content="${imageAlt}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${image}" />`,
    `<meta name="twitter:image:alt" content="${imageAlt}" />`,
  ];
  return [HEAD_START, ...lines, HEAD_END].join('\n    ');
}

function webManifest(base: string): string {
  return JSON.stringify(
    {
      name: SITE.name,
      short_name: SITE.name,
      description: SITE.description,
      start_url: base,
      scope: base,
      display: 'standalone',
      background_color: SITE.themeColor,
      theme_color: SITE.themeColor,
      icons: [
        { src: `${base}icon-192.png`, sizes: '192x192', type: 'image/png' },
        { src: `${base}icon-512.png`, sizes: '512x512', type: 'image/png' },
      ],
    },
    null,
    2,
  );
}

function sitemap(base: string, pages: PageMeta[]): string {
  const lastmod = new Date().toISOString().slice(0, 10);
  const urls = pages.map((page) => {
    const depth = page.path === '/' ? 0 : page.path.split('/').length - 1;
    const priority = ['1.0', '0.8', '0.6'][Math.min(depth, 2)];
    return [
      '  <url>',
      `    <loc>${pageUrl(base, page.path)}</loc>`,
      `    <lastmod>${lastmod}</lastmod>`,
      '    <changefreq>monthly</changefreq>',
      `    <priority>${priority}</priority>`,
      '  </url>',
    ].join('\n');
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!-- Generated at build from src/site/routes.ts. Do not hand-edit. -->',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}

/**
 * Site plumbing generated from `src/site/config.ts` + `src/site/routes.ts`:
 *
 * - the shared <head> (title, description, canonical, icons, manifest, Open
 *   Graph/Twitter tags), injected into index.html in dev and build;
 * - `site.webmanifest`, with every path run through the base;
 * - at build: one prerendered HTML file per real route (`operator/index.html`,
 *   `focus/pod-bay/index.html`, …) carrying that page's own title and
 *   description, so GitHub Pages answers deep links with 200 and link previews
 *   are page-specific; a noindex `404.html` for everything else, which boots
 *   the SPA into its not-found screen; `sitemap-index.xml`; and `robots.txt`.
 */
function sitePlugin(): Plugin {
  let base = '/';
  let outDir = '';
  let isBuild = false;
  return {
    name: 'constyx:site',
    configResolved(config) {
      base = config.base;
      outDir = resolve(config.root, config.build.outDir);
      isBuild = config.command === 'build';
    },
    transformIndexHtml(html) {
      return html.replace(
        HEAD_START,
        headBlock(base, { path: '/', title: SITE.title, description: SITE.description }),
      );
    },
    configureServer(server) {
      server.middlewares.use('/site.webmanifest', (_req, res) => {
        res.setHeader('Content-Type', 'application/manifest+json');
        res.end(webManifest(base));
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'site.webmanifest', source: webManifest(base) });
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\n\nSitemap: ${SITE.origin}${base}sitemap-index.xml\n`,
      });
    },
    async closeBundle() {
      if (!isBuild) return;
      const { module } = await runnerImport<{ allRoutes: () => PageMeta[] }>(
        resolve(rootDir, 'src/site/routes.ts'),
        { configFile: false, logLevel: 'silent' },
      );
      const pages = module.allRoutes();
      const shell = readFileSync(resolve(outDir, 'index.html'), 'utf8');
      const start = shell.indexOf(HEAD_START);
      const end = shell.indexOf(HEAD_END);
      if (start < 0 || end < start) throw new Error('constyx:site: head markers missing from built index.html');
      const render = (page: PageMeta, opts?: { noindex?: boolean }) =>
        shell.slice(0, start) + headBlock(base, page, opts) + shell.slice(end + HEAD_END.length);

      for (const page of pages) {
        const dir = resolve(outDir, page.path.replace(/^\/+/, ''));
        mkdirSync(dir, { recursive: true });
        writeFileSync(resolve(dir, 'index.html'), render(page));
      }
      writeFileSync(
        resolve(outDir, '404.html'),
        render({ path: '/404', title: `${SITE.name} · Not Found`, description: SITE.description }, { noindex: true }),
      );
      // Fixed name and location: the origin's robots.txt (kiarashfa.github.io)
      // lists `<origin><base>sitemap-index.xml` for every project. Don't rename.
      writeFileSync(resolve(outDir, 'sitemap-index.xml'), sitemap(base, pages));
    },
  };
}

const pkg = JSON.parse(readFileSync(resolve(rootDir, 'package.json'), 'utf8')) as { version: string };

// Dev serves from '/'; the production build (and `vite preview` of it) is
// served from the GitHub Pages project path (`SITE.basePath`), so absolute
// asset URLs resolve from any route depth and every generated URL carries the
// base.
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? SITE.basePath : '/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_YEAR__: JSON.stringify(new Date().getFullYear()),
  },
  plugins: [react(), tailwindcss(), rainStandalonePlugin(), sitePlugin()],
}));
