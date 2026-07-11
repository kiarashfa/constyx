import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import * as ts from 'typescript';

const rainDir = resolve(dirname(fileURLToPath(import.meta.url)), 'src/engine/rain');
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

// Default base '/' serves dev and local preview. The GitHub Pages workflow
// builds with `--base=/<repo-name>/` so absolute asset URLs resolve from any
// route depth — required for the 404.html deep-link trick with clean paths.
export default defineConfig({
  base: '/',
  plugins: [react(), tailwindcss(), rainStandalonePlugin()],
});
