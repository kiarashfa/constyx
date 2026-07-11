// Minimal ambient types for the Node built-ins used by vite.config.ts.
//
// This project intentionally ships no `@types/node` (it stays dependency-lean
// and offline), yet the Vite config reads a few files on disk to bundle the
// rain engine for the screensaver export. These declarations cover exactly the
// surface used there — nothing more.

declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string;
}

declare module 'node:path' {
  export function dirname(path: string): string;
  export function resolve(...paths: string[]): string;
}

declare module 'node:url' {
  export function fileURLToPath(url: string): string;
}

interface ImportMeta {
  readonly url: string;
}
