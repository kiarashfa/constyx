import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import { RainEngine } from './RainEngine';
import type { RainConfig, RainEvent } from './types';

/**
 * Imperative surface exposed via `ref` — how future features (game logic,
 * focus-mode ambience) talk to a mounted rain instance without re-rendering.
 */
export interface RainHandle {
  dispatch: (event: RainEvent) => void;
  engine: () => RainEngine | null;
}

export interface MatrixRainProps {
  /** Partial overrides merged onto the Matrix-green defaults. Live-updatable. */
  config?: Partial<RainConfig>;
  /** Freeze the animation without unmounting the canvas. */
  paused?: boolean;
  /** Size the canvas via CSS (e.g. "block h-full w-full"); the engine follows. */
  className?: string;
  ref?: Ref<RainHandle>;
}

/**
 * React binding for RainEngine. The canvas fills whatever box you give it via
 * `className`; DPR scaling and resize are handled internally.
 */
export function MatrixRain({ config, paused = false, className, ref }: MatrixRainProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<RainEngine | null>(null);
  const initialConfigRef = useRef(config);
  initialConfigRef.current = config;
  const configKey = JSON.stringify(config ?? {});

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new RainEngine(canvas, initialConfigRef.current);
    engineRef.current = engine;
    engine.start();
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (config) engineRef.current?.setConfig(config);
    // configKey is a value-equality guard so inline config objects don't
    // retune the engine every render.
  }, [configKey]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (paused) engine.stop();
    else engine.start();
  }, [paused]);

  useImperativeHandle(
    ref,
    () => ({
      dispatch: (event: RainEvent) => engineRef.current?.dispatch(event),
      engine: () => engineRef.current,
    }),
    [],
  );

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
