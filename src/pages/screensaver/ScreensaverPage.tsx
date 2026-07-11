import { useRef, useState, type ReactNode } from 'react';
import { MatrixRain, type RainConfig } from '../../engine/rain';
import { Panel } from '../../components/Panel';
import { PageHeader } from '../../components/PageHeader';
import {
  COLOR_PRESETS,
  CHARSET_PRESETS,
  FONT_PRESETS,
  INITIAL_CONFIG,
  type ColorPreset,
} from './presets';

/**
 * SCREENSAVER — a live configurator built directly on the rain engine's
 * `setConfig` surface. The preview is a full-size `MatrixRain` reflecting the
 * config in real time; the panel drives every field the engine exposes; and
 * "download" bundles the ACTUAL engine into a standalone HTML file (see
 * ./exportScreensaver — dynamically imported so the bundled engine string stays
 * out of the main chunk until the player actually exports).
 */
export function ScreensaverPage() {
  const [config, setConfig] = useState<RainConfig>(INITIAL_CONFIG);
  const [charsetName, setCharsetName] = useState('MATRIX');
  const [customChars, setCustomChars] = useState('01アイウ=+*ゴ');
  const [toast, setToast] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const update = (patch: Partial<RainConfig>) => setConfig((c) => ({ ...c, ...patch }));

  const applyPalette = (p: ColorPreset) =>
    update({ color: p.color, headColor: p.headColor, backgroundColor: p.backgroundColor });

  const activePalette = COLOR_PRESETS.find(
    (p) =>
      p.color === config.color &&
      p.headColor === config.headColor &&
      p.backgroundColor === config.backgroundColor,
  );

  const chooseCharset = (name: string, chars: string, custom?: boolean) => {
    setCharsetName(name);
    update({ charset: custom ? customChars || chars : chars });
  };

  const onCustomChars = (value: string) => {
    setCustomChars(value);
    if (charsetName === 'CUSTOM') update({ charset: value || INITIAL_CONFIG.charset });
  };

  const reset = () => {
    setConfig(INITIAL_CONFIG);
    setCharsetName('MATRIX');
  };

  const onExport = async () => {
    setExporting(true);
    try {
      const { downloadScreensaver, estimateSizeKb } = await import('./exportScreensaver');
      const kb = estimateSizeKb(config);
      downloadScreensaver(config);
      showToast(`EXPORTED // operator-screensaver.html // ~${kb} KB`);
    } catch {
      showToast('EXPORT FAILED — SEE CONSOLE');
    } finally {
      setExporting(false);
    }
  };

  const toastTimer = useRef<number | undefined>(undefined);
  const showToast = (text: string) => {
    setToast(text);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4200);
  };

  const fullscreenPreview = () => previewRef.current?.requestFullscreen?.();

  return (
    <>
      <PageHeader code="05" title="SCREENSAVER">
        Tune your own rain — glyphs, palette, speed, density — and watch it change live.
        When it looks right, take it with you: export a single standalone HTML file that runs
        the real engine full-screen, anywhere. The code follows you out.
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Live preview */}
        <div className="lg:sticky lg:top-16 lg:self-start">
          <Panel
            title="LIVE PREVIEW"
            bodyClassName="relative min-h-[420px] p-0 lg:min-h-[560px]"
          >
            <div ref={previewRef} className="absolute inset-0" style={{ background: config.backgroundColor }}>
              <MatrixRain className="block h-full w-full" config={config} />
            </div>
            <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 text-[10px] tracking-[0.3em] text-phosphor/60">
              <span className="cursor-blink">◉</span> LIVE
            </div>
            <button
              type="button"
              onClick={fullscreenPreview}
              className="absolute right-2 top-2 border border-phosphor/30 bg-terminal/80 px-2 py-1 text-[10px] tracking-[0.25em] text-phosphor/60 transition-colors hover:text-phosphor"
            >
              [ ⤢ FULLSCREEN ]
            </button>
            {toast && (
              <div className="absolute inset-x-3 bottom-3 border border-phosphor/40 bg-terminal/90 px-3 py-2 text-[11px] tracking-[0.2em] text-phosphor-bright">
                {toast}
              </div>
            )}
          </Panel>
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-4">
          <Panel title="PALETTE" bodyClassName="grid grid-cols-2 gap-2 p-3">
            {COLOR_PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => applyPalette(p)}
                className={`flex items-center gap-2 border px-2 py-1.5 text-left text-[10px] tracking-[0.15em] transition-colors ${
                  activePalette?.name === p.name
                    ? 'border-phosphor bg-phosphor/10 text-phosphor-bright'
                    : 'border-phosphor/25 text-phosphor/70 hover:border-phosphor/60'
                }`}
              >
                <span
                  className="inline-block h-3 w-3 shrink-0 border border-white/20"
                  style={{ background: p.color, boxShadow: `0 0 6px ${p.color}` }}
                />
                {p.name}
              </button>
            ))}
          </Panel>

          <Panel title="GLYPHS" bodyClassName="flex flex-col gap-2 p-3">
            <div className="grid grid-cols-4 gap-1.5">
              {CHARSET_PRESETS.map((cs) => (
                <button
                  key={cs.name}
                  type="button"
                  onClick={() => chooseCharset(cs.name, cs.chars, cs.custom)}
                  className={`border px-1 py-1 text-[9px] tracking-[0.1em] transition-colors ${
                    charsetName === cs.name
                      ? 'border-phosphor bg-phosphor/10 text-phosphor-bright'
                      : 'border-phosphor/25 text-phosphor/70 hover:border-phosphor/60'
                  }`}
                >
                  {cs.name}
                </button>
              ))}
            </div>
            {charsetName === 'CUSTOM' && (
              <input
                type="text"
                value={customChars}
                onChange={(e) => onCustomChars(e.target.value)}
                placeholder="type glyphs to rain..."
                className="mt-1 w-full border border-phosphor/30 bg-terminal/60 px-2 py-1.5 text-sm text-phosphor outline-none placeholder-phosphor/30 focus:border-phosphor/70"
              />
            )}
            <p className="text-[10px] leading-relaxed text-phosphor/40">
              {config.charset.length} glyphs in the pool.
            </p>
          </Panel>

          <Panel title="MOTION" bodyClassName="flex flex-col gap-3.5 p-3">
            <Range
              label="SPEED"
              value={config.speed}
              min={2}
              max={40}
              step={1}
              display={`${config.speed} rows/s`}
              onChange={(v) => update({ speed: v })}
            />
            <Range
              label="DENSITY"
              value={config.density}
              min={0.1}
              max={1}
              step={0.05}
              display={`${Math.round(config.density * 100)}%`}
              onChange={(v) => update({ density: v })}
            />
            <Range
              label="VARIANCE"
              value={config.speedVariance}
              min={0}
              max={1}
              step={0.05}
              display={`${Math.round(config.speedVariance * 100)}%`}
              onChange={(v) => update({ speedVariance: v })}
            />
            <Range
              label="GLYPH SIZE"
              value={config.fontSize}
              min={8}
              max={40}
              step={1}
              display={`${config.fontSize}px`}
              onChange={(v) => update({ fontSize: v })}
            />
            <Range
              label="TRAIL"
              value={config.fadeAlpha}
              min={0.02}
              max={0.3}
              step={0.01}
              display={config.fadeAlpha <= 0.08 ? 'long' : config.fadeAlpha >= 0.2 ? 'short' : 'medium'}
              onChange={(v) => update({ fadeAlpha: v })}
            />
          </Panel>

          <Panel title="COLORS" bodyClassName="flex flex-col gap-2.5 p-3">
            <ColorField label="TRAIL" value={config.color} onChange={(v) => update({ color: v })} />
            <ColorField label="HEAD" value={config.headColor} onChange={(v) => update({ headColor: v })} />
            <ColorField
              label="BACKGROUND"
              value={config.backgroundColor}
              onChange={(v) => update({ backgroundColor: v })}
            />
          </Panel>

          <Panel title="FONT" bodyClassName="p-3">
            <div className="grid grid-cols-2 gap-1.5">
              {FONT_PRESETS.map((f) => (
                <button
                  key={f.name}
                  type="button"
                  onClick={() => update({ fontFamily: f.stack })}
                  style={{ fontFamily: f.stack }}
                  className={`border px-2 py-1.5 text-[11px] tracking-wide transition-colors ${
                    config.fontFamily === f.stack
                      ? 'border-phosphor bg-phosphor/10 text-phosphor-bright'
                      : 'border-phosphor/25 text-phosphor/70 hover:border-phosphor/60'
                  }`}
                >
                  {f.name}
                </button>
              ))}
            </div>
          </Panel>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={onExport}
              disabled={exporting}
              className="glow border border-phosphor bg-phosphor/10 px-4 py-3 text-xs tracking-[0.3em] text-phosphor-bright transition-colors hover:bg-phosphor/20 disabled:opacity-50"
            >
              {exporting ? '[ BUNDLING... ]' : '[ ▼ DOWNLOAD SCREENSAVER ]'}
            </button>
            <div className="flex items-center justify-between">
              <p className="max-w-[240px] text-[10px] leading-relaxed text-phosphor/40">
                Exports one standalone .html — no network, no install. Open it, or point an
                OS screensaver tool at it.
              </p>
              <button
                type="button"
                onClick={reset}
                className="shrink-0 border border-phosphor/25 px-3 py-1.5 text-[10px] tracking-[0.2em] text-phosphor/60 transition-colors hover:border-phosphor/60 hover:text-phosphor"
              >
                RESET
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- controls

interface RangeProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: ReactNode;
  onChange: (value: number) => void;
}

function Range({ label, value, min, max, step, display, onChange }: RangeProps) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-[10px] tracking-[0.2em] text-phosphor/60">
        {label}
        <span className="text-phosphor/80">{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 w-full accent-phosphor"
      />
    </label>
  );
}

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function ColorField({ label, value, onChange }: ColorFieldProps) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-[10px] tracking-[0.2em] text-phosphor/60">{label}</span>
      <span className="flex items-center gap-2">
        <span className="text-[10px] uppercase text-phosphor/50">{value}</span>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-6 w-9 cursor-pointer border border-phosphor/30 bg-transparent"
        />
      </span>
    </label>
  );
}
