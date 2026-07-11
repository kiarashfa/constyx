import type { ReactNode } from 'react';
import type { LessonBlock, LessonImage } from './types';

/**
 * Minimal inline emphasis for lesson prose: **bold** and *italic*.
 * Anything heavier belongs in a dedicated block type, not in strings.
 */
export function renderInline(text: string): ReactNode {
  const tokens = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return tokens.map((token, i) => {
    if (token.startsWith('**') && token.endsWith('**')) {
      return (
        <strong key={i} className="font-bold text-ink">
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith('*') && token.endsWith('*') && token.length > 2) {
      return <em key={i}>{token.slice(1, -1)}</em>;
    }
    return token;
  });
}

export function LessonBlockView({ block }: { block: LessonBlock }) {
  switch (block.type) {
    case 'paragraph':
      return <p className="text-[15px] leading-relaxed text-ink-soft">{renderInline(block.text)}</p>;

    case 'list': {
      const numbered = block.style === 'numbered';
      return (
        <ul className="space-y-2">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-ink-soft">
              <span className="shrink-0 text-loaded">{numbered ? `${i + 1}.` : '▸'}</span>
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      );
    }

    case 'quote':
      return (
        <blockquote className="border-l-2 border-loaded pl-4">
          <p className="text-[15px] italic leading-relaxed text-ink">“{block.text}”</p>
          {block.attribution && (
            <footer className="mt-2 text-xs tracking-wider text-ink-soft">— {block.attribution}</footer>
          )}
        </blockquote>
      );

    case 'readout':
      return (
        <dl className="divide-y divide-ink/10 border border-ink/25 bg-white/60">
          {block.entries.map(({ term, detail }) => (
            <div key={term} className="grid gap-1 px-4 py-3 sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-4">
              <dt className="text-xs font-bold tracking-[0.15em] text-ink">{term}</dt>
              <dd className="text-sm leading-relaxed text-ink-soft">{renderInline(detail)}</dd>
            </div>
          ))}
        </dl>
      );

    case 'callout':
      return (
        <aside className="border border-loaded/50 bg-loaded/5 px-4 py-3">
          {block.label && (
            <p className="mb-1.5 text-[11px] font-bold tracking-[0.25em] text-loaded">
              ◆ {block.label}
            </p>
          )}
          <p className="text-sm leading-relaxed text-ink-soft">{renderInline(block.text)}</p>
        </aside>
      );
  }
}

export function LessonImageView({ image }: { image: LessonImage }) {
  return (
    <figure className="border border-ink/25 bg-white">
      <figcaption className="flex items-center justify-between border-b border-ink/15 px-3 py-1.5">
        <span className="text-[10px] tracking-[0.3em] text-ink-soft">VISUAL REFERENCE</span>
        {image.caption && (
          <span className="text-[11px] tracking-wider text-loaded">{image.caption}</span>
        )}
      </figcaption>
      <img src={image.src} alt={image.alt} className="block w-full" loading="lazy" />
    </figure>
  );
}
