import type { ReactNode } from 'react';

interface PanelProps {
  title?: string;
  className?: string;
  /** Extra classes for the content area (defaults to p-4). */
  bodyClassName?: string;
  children: ReactNode;
}

/** Bordered terminal panel — the basic building block of every page layout. */
export function Panel({ title, className = '', bodyClassName = 'p-4', children }: PanelProps) {
  return (
    <section className={`flex flex-col border border-phosphor/30 bg-terminal/75 ${className}`}>
      {title && (
        <header className="border-b border-phosphor/30 px-3 py-1.5 text-xs tracking-[0.3em] text-phosphor/80">
          {title}
        </header>
      )}
      <div className={`flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}
