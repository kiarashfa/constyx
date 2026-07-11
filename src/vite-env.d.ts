/// <reference types="vite/client" />

/**
 * The rain engine bundled to a self-contained browser script string. Produced
 * at build time by `rainStandalonePlugin` in vite.config.ts; inlined into the
 * downloadable screensaver by the Screensaver export.
 */
declare module 'virtual:rain-standalone' {
  const rainEngineScript: string;
  export default rainEngineScript;
}
