import type { ColumnEffect, RainConfig, RainEvent, RainEventListener } from './types';
import { defaultRainConfig } from './presets';

interface Column {
  /** Left edge of the column's glyph cell, CSS px. */
  x: number;
  /** Fractional row of the leading glyph. Negative = still above the screen. */
  head: number;
  /** Last row that received a glyph, so fast columns never skip cells. */
  lastDrawnRow: number;
  /** Fall speed, rows per second. */
  speed: number;
  /** Dormant columns draw nothing; density controls how many are active. */
  active: boolean;
  /** When a dormant column next re-rolls against density (ms timestamp). */
  wakeAt: number;
  highlightUntil: number;
  highlightColor: string;
  /** Persistent visual override (threat visuals). Null = ambient look. */
  effect: ColumnEffect | null;
  /** Fixed glyph used while effect.glyphMode === 'repeat'. */
  effectGlyph: string;
  /** When the effect was applied — phase origin for pulse oscillation. */
  effectStart: number;
}

/**
 * Framework-agnostic digital-rain renderer on a 2D canvas.
 *
 * The canvas is sized to its CSS box (ResizeObserver) at device-pixel-ratio
 * resolution. The classic look comes from a translucent background fill each
 * frame (fades old glyphs) plus a bright head glyph per column that repaints
 * its previous cell in the trail color as it advances.
 *
 * Extension points for later rounds:
 *  - `dispatch(event)` feeds typed RainEvents into the frame loop; handled in
 *    `applyEvent()`. 'column-highlight' and 'glitch-flash' have minimal
 *    reference implementations — game logic will extend this union.
 *  - `addEventListener()` lets outside code (HUDs, scoring) observe events.
 *  - `setConfig(partial)` retunes any visual parameter live (screensaver
 *    configurator will drive this).
 */
export class RainEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private config: RainConfig;

  private columns: Column[] = [];
  private width = 0;
  private height = 0;
  private rows = 0;
  private cellWidth = 0;

  private rafId: number | null = null;
  private lastFrame = 0;
  private flashUntil = 0;
  private flashColor = '';

  private pendingEvents: RainEvent[] = [];
  private readonly listeners = new Set<RainEventListener>();
  private readonly resizeObserver: ResizeObserver;

  constructor(canvas: HTMLCanvasElement, overrides: Partial<RainConfig> = {}) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('RainEngine: 2D canvas context unavailable');
    this.ctx = ctx;
    this.config = { ...defaultRainConfig, ...overrides };

    this.resizeObserver = new ResizeObserver(() => this.syncSize());
    this.resizeObserver.observe(canvas);
    this.syncSize();
  }

  start(): void {
    if (this.rafId !== null) return;
    this.lastFrame = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }

  stop(): void {
    if (this.rafId === null) return;
    cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  destroy(): void {
    this.stop();
    this.resizeObserver.disconnect();
    this.listeners.clear();
  }

  get running(): boolean {
    return this.rafId !== null;
  }

  /** Snapshot of the active configuration. */
  getConfig(): Readonly<RainConfig> {
    return { ...this.config };
  }

  /** Number of columns at the current size — event targets index into this. */
  getColumnCount(): number {
    return this.columns.length;
  }

  /**
   * Column index under a CSS-pixel x offset (canvas-relative, e.g.
   * `event.offsetX`), or -1 when the grid is empty. This is how interactive
   * surfaces map clicks/taps onto columns.
   */
  getColumnForOffset(x: number): number {
    if (this.columns.length === 0 || this.cellWidth <= 0) return -1;
    const col = Math.floor(x / this.cellWidth);
    return Math.max(0, Math.min(this.columns.length - 1, col));
  }

  /** Left edge of a column's cell in CSS pixels — for anchoring DOM overlays. */
  getColumnX(column: number): number {
    return column * this.cellWidth;
  }

  /** Current cell width in CSS pixels. */
  getCellWidth(): number {
    return this.cellWidth;
  }

  /** Live-retune any subset of the config; rebuilds the grid only if needed. */
  setConfig(overrides: Partial<RainConfig>): void {
    const prev = this.config;
    this.config = { ...prev, ...overrides };
    if (
      this.config.fontSize !== prev.fontSize ||
      this.config.columnCount !== prev.columnCount
    ) {
      this.rebuildGrid();
    }
  }

  /**
   * Queue an event for the next frame. This is THE hook future features use:
   * the Operator game will dispatch threat highlights, the focus tool ambience
   * pulses, etc. Unknown-to-current-code variants simply reach listeners.
   */
  dispatch(event: RainEvent): void {
    this.pendingEvents.push(event);
    for (const listener of this.listeners) listener(event);
  }

  /** Observe every dispatched event. Returns an unsubscribe function. */
  addEventListener(listener: RainEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ---------------------------------------------------------------- internals

  private loop = (now: number): void => {
    this.frame(now);
    this.rafId = requestAnimationFrame(this.loop);
  };

  private syncSize(): void {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (w === 0 || h === 0) return;
    const dpr = window.devicePixelRatio || 1;
    this.width = w;
    this.height = h;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Resizing clears the canvas; start from an opaque background so the
    // first frames don't fade from transparent.
    this.ctx.fillStyle = this.config.backgroundColor;
    this.ctx.fillRect(0, 0, w, h);
    this.rebuildGrid();
  }

  private rebuildGrid(): void {
    const { fontSize, columnCount } = this.config;
    this.rows = Math.ceil(this.height / fontSize);
    const count = columnCount ?? Math.max(1, Math.floor(this.width / fontSize));
    this.cellWidth = columnCount ? this.width / columnCount : fontSize;

    const next: Column[] = [];
    for (let i = 0; i < count; i++) {
      const existing = this.columns[i];
      if (existing) {
        existing.x = i * this.cellWidth;
        next.push(existing);
      } else {
        next.push(this.spawnColumn(i * this.cellWidth));
      }
    }
    this.columns = next;
  }

  private spawnColumn(x: number): Column {
    const { speed, speedVariance, density } = this.config;
    const head = -Math.random() * this.rows * 1.5;
    return {
      x,
      head,
      lastDrawnRow: Math.floor(head),
      speed: Math.max(0.5, speed * (1 + speedVariance * (Math.random() * 2 - 1))),
      active: Math.random() < density,
      wakeAt: 0,
      highlightUntil: 0,
      highlightColor: '',
      effect: null,
      effectGlyph: '',
      effectStart: 0,
    };
  }

  /** Send a finished (or dormant) column back above the screen. */
  private recycleColumn(col: Column, now: number): void {
    const { speed, speedVariance, density } = this.config;
    // A column carrying an effect (an active threat) never goes dormant.
    if (col.effect || Math.random() < density) {
      col.active = true;
      col.head = -Math.random() * 20;
      col.lastDrawnRow = Math.floor(col.head);
      col.speed = Math.max(0.5, speed * (1 + speedVariance * (Math.random() * 2 - 1)));
    } else {
      col.active = false;
      col.wakeAt = now + 500 + Math.random() * 3000;
    }
  }

  private frame(now: number): void {
    const dt = Math.min((now - this.lastFrame) / 1000, 0.1);
    this.lastFrame = now;

    for (const event of this.pendingEvents.splice(0)) this.applyEvent(event, now);

    const { ctx, config } = this;
    const { fontSize } = config;

    // Fade pass: dims every existing glyph toward the background color.
    ctx.fillStyle = hexToRgba(config.backgroundColor, config.fadeAlpha);
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.font = `${fontSize}px ${config.fontFamily}`;
    ctx.textBaseline = 'top';

    for (const col of this.columns) {
      if (!col.active) {
        if (now >= col.wakeAt) this.recycleColumn(col, now);
        continue;
      }

      const effect = col.effect;
      col.head += col.speed * (effect?.speedMultiplier ?? 1) * dt;
      const headRow = Math.floor(col.head);

      // Effect pulse: oscillate the whole column's draw alpha.
      if (effect?.pulse) {
        const { periodMs, minAlpha } = effect.pulse;
        const phase = ((now - col.effectStart) / periodMs) * Math.PI * 2;
        ctx.globalAlpha = minAlpha + (1 - minAlpha) * (0.5 + 0.5 * Math.sin(phase));
      }

      const trailColor =
        effect?.color ??
        (now < col.highlightUntil ? col.highlightColor : config.color);

      // Repaint each newly passed cell in the trail color (over the old bright
      // head), then draw the fresh bright head. Loop is clamped so a huge dt
      // can't stall a frame.
      const firstRow = Math.max(col.lastDrawnRow, headRow - this.rows);
      for (let row = firstRow; row < headRow; row++) {
        if (row < 0 || row * fontSize > this.height) continue;
        this.drawGlyph(col, row, trailColor, true);
      }
      if (headRow > col.lastDrawnRow) {
        col.lastDrawnRow = headRow;
        if (headRow >= 0 && headRow * fontSize <= this.height) {
          this.drawGlyph(col, headRow, effect?.headColor ?? config.headColor, false);
        }
      }

      // Effect jitter: erratically rewrite a recent cell — corrupted stutter.
      if (effect?.jitter && Math.random() < effect.jitter) {
        const row = headRow - 1 - Math.floor(Math.random() * 6);
        if (row >= 0 && row * fontSize <= this.height) {
          this.drawGlyph(col, row, trailColor, true);
        }
      }

      ctx.globalAlpha = 1;

      // Recycle once the head is a few rows past the bottom edge.
      if ((col.head - 4) * fontSize > this.height) {
        this.recycleColumn(col, now);
      }
    }

    // Reference 'glitch-flash' visual: a brief translucent wash.
    if (now < this.flashUntil) {
      ctx.fillStyle = hexToRgba(this.flashColor, 0.08);
      ctx.fillRect(0, 0, this.width, this.height);
    }
  }

  private drawGlyph(col: Column, row: number, color: string, clearCell: boolean): void {
    const { ctx, config } = this;
    const y = row * config.fontSize;
    if (clearCell) {
      // Erase the bright head pixels before repainting the cell as trail.
      // Preserve any pulse alpha around the opaque clear.
      const alpha = ctx.globalAlpha;
      ctx.globalAlpha = 1;
      ctx.fillStyle = config.backgroundColor;
      ctx.fillRect(col.x, y, this.cellWidth, config.fontSize);
      ctx.globalAlpha = alpha;
    }
    let glyph: string;
    if (col.effect?.glyphMode === 'repeat') {
      glyph = col.effectGlyph;
    } else {
      const charset = col.effect?.charset ?? config.charset;
      glyph = charset[Math.floor(Math.random() * charset.length)];
    }
    ctx.fillStyle = color;
    ctx.fillText(glyph, col.x, y);
  }

  /**
   * Minimal reference handling of the current event vocabulary. Future rounds
   * extend this switch (threat spawns, extraction pings, jack-out sweeps...).
   */
  private applyEvent(event: RainEvent, now: number): void {
    switch (event.type) {
      case 'column-highlight': {
        const col = this.columns[event.column];
        if (!col) return;
        col.highlightUntil = now + (event.durationMs ?? 1200);
        col.highlightColor = event.color ?? this.config.headColor;
        col.active = true;
        break;
      }
      case 'glitch-flash': {
        this.flashUntil = now + (event.durationMs ?? 120);
        this.flashColor = event.color ?? this.config.color;
        break;
      }
      case 'column-effect': {
        const col = this.columns[event.column];
        if (!col) return;
        col.effect = event.effect;
        col.effectStart = now;
        const charset = event.effect.charset ?? this.config.charset;
        col.effectGlyph = charset[Math.floor(Math.random() * charset.length)];
        // Make the effect promptly visible: wake the column and, if its head
        // is far off-screen or nearly done, restart it near the top.
        col.active = true;
        if (col.head < -2 || col.head > this.rows * 0.7) {
          col.head = Math.random() * this.rows * 0.25;
          col.lastDrawnRow = Math.floor(col.head);
        }
        break;
      }
      case 'column-effect-clear': {
        const col = this.columns[event.column];
        if (!col) return;
        col.effect = null;
        col.effectGlyph = '';
        break;
      }
    }
  }
}

function hexToRgba(hex: string, alpha: number): string {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
