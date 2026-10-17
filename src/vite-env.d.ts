/// <reference types="vite/client" />

/** package.json version, injected at build by vite.config.ts. */
declare const __APP_VERSION__: string;
/** Calendar year the bundle was built, injected by vite.config.ts. */
declare const __BUILD_YEAR__: number;

/**
 * The rain engine bundled to a self-contained browser script string. Produced
 * at build time by `rainStandalonePlugin` in vite.config.ts; inlined into the
 * downloadable screensaver by the Screensaver export.
 */
declare module 'virtual:rain-standalone' {
  const rainEngineScript: string;
  export default rainEngineScript;
}
