import { useEffect, useMemo, useRef, useState } from 'react';
import { Panel } from '../../components/Panel';
import { PageHeader } from '../../components/PageHeader';
import { copyText, downloadTextFile } from '../../lib/download';
import { renderAscii, STYLE_OPTIONS, type AsciiStyle } from './render';

/**
 * ASCII COMPOSER — type text, watch it become terminal block art. All styles
 * share one 5×7 bitmap font (see ./font, ./render); nothing here needs the 3D
 * or scene infrastructure. Copy as plain text or download a .txt — ready to
 * paste into a terminal, code comment, or channel that still takes ASCII.
 */
export function AsciiPage() {
  const [text, setText] = useState('OPERATOR');
  const [style, setStyle] = useState<AsciiStyle>('block');
  const [seed, setSeed] = useState(1);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  // Only the matrix style is animated; every other style is fully static.
  useEffect(() => {
    if (style !== 'matrix') return;
    const id = window.setInterval(() => setSeed((s) => s + 1), 140);
    return () => window.clearInterval(id);
  }, [style]);

  const output = useMemo(() => renderAscii(text, style, seed), [text, style, seed]);
  const hasArt = text.trim().length > 0;

  const flash = (message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2400);
  };

  const onCopy = async () => {
    if (!hasArt) return;
    flash((await copyText(output)) ? 'COPIED TO CLIPBOARD' : 'COPY BLOCKED — SELECT MANUALLY');
  };

  const onDownload = () => {
    if (!hasArt) return;
    downloadTextFile('operator-ascii.txt', output + '\n');
    flash('SAVED // operator-ascii.txt');
  };

  return (
    <>
      <PageHeader code="06" title="ASCII COMPOSER">
        Compose transmissions the way the Nebuchadnezzar would print them — oversized glyph
        art from a hand-built terminal font. Short strings read best. Copy it into any
        channel that still takes plain text, or save it to a file.
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Panel title="INPUT" bodyClassName="p-3">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.toUpperCase())}
              rows={2}
              spellCheck={false}
              placeholder="> type transmission..."
              className="w-full resize-none bg-transparent text-sm tracking-wider text-phosphor outline-none placeholder-phosphor/30"
            />
            <p className="mt-1 text-[10px] tracking-widest text-phosphor/40">
              {text.length} CHARS · A–Z 0–9 AND PUNCTUATION · MULTI-LINE OK
            </p>
          </Panel>

          <Panel
            title="PREVIEW"
            className="min-h-[260px]"
            bodyClassName="relative flex min-h-[240px] items-center overflow-auto p-4"
          >
            {hasArt ? (
              <pre
                className="whitespace-pre font-terminal text-[11px] leading-none text-phosphor sm:text-[13px]"
                style={{ textShadow: '0 0 6px rgba(0, 255, 65, 0.45)' }}
              >
                {output}
              </pre>
            ) : (
              <p className="w-full text-center text-sm tracking-widest text-phosphor/40">
                AWAITING INPUT<span className="cursor-blink">▮</span>
              </p>
            )}
            {toast && (
              <div className="pointer-events-none absolute right-3 top-3 border border-phosphor/40 bg-terminal/90 px-2 py-1 text-[10px] tracking-[0.2em] text-phosphor-bright">
                {toast}
              </div>
            )}
          </Panel>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onCopy}
              disabled={!hasArt}
              className="glow border border-phosphor bg-phosphor/10 px-4 py-2.5 text-xs tracking-[0.3em] text-phosphor-bright transition-colors hover:bg-phosphor/20 disabled:opacity-40"
            >
              [ ⧉ COPY TEXT ]
            </button>
            <button
              type="button"
              onClick={onDownload}
              disabled={!hasArt}
              className="border border-phosphor/40 px-4 py-2.5 text-xs tracking-[0.3em] text-phosphor/80 transition-colors hover:border-phosphor hover:text-phosphor disabled:opacity-40"
            >
              [ ▼ SAVE .TXT ]
            </button>
          </div>
        </div>

        <Panel title="STYLE" bodyClassName="flex flex-col gap-2 p-3">
          {STYLE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setStyle(option.id)}
              className={`border px-3 py-2 text-left transition-colors ${
                style === option.id
                  ? 'border-phosphor bg-phosphor/10 text-phosphor-bright'
                  : 'border-phosphor/25 text-phosphor/70 hover:border-phosphor/60'
              }`}
            >
              <span className="block text-xs tracking-[0.25em]">▸ {option.label}</span>
              <span className="mt-0.5 block text-[10px] leading-tight text-phosphor/40">
                {option.hint}
              </span>
            </button>
          ))}
        </Panel>
      </div>
    </>
  );
}
