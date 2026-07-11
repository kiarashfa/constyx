import { RainEngine } from './RainEngine';
import type { RainConfig } from './types';

/**
 * Entry point for the exported, standalone screensaver.
 *
 * This file exists purely so the screensaver export has a single, tiny,
 * dependency-light seam onto the REAL rain engine. The `virtual:rain-standalone`
 * Vite plugin (see vite.config.ts) bundles `presets.ts` + `RainEngine.ts` + this
 * file into one browser-ready script via the TypeScript compiler, so the
 * exported HTML runs the exact same rendering code the site does — no
 * reimplementation, no drift. The build inlines that script and calls
 * `startStandaloneRain(canvas, config)` with the player's chosen configuration.
 */
export function startStandaloneRain(
  canvas: HTMLCanvasElement,
  config: Partial<RainConfig>,
): RainEngine {
  const engine = new RainEngine(canvas, config);
  engine.start();
  return engine;
}
