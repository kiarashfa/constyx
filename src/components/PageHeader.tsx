import type { ReactNode } from 'react';

interface PageHeaderProps {
  code: string;
  title: string;
  children: ReactNode;
}

/** Standard route header: program number, glowing title, in-universe blurb. */
export function PageHeader({ code, title, children }: PageHeaderProps) {
  return (
    <header className="mb-6">
      <p className="text-xs tracking-widest text-phosphor-dim">/// PROGRAM {code}</p>
      <h1 className="glow mt-1 text-2xl tracking-[0.35em] sm:text-3xl">{title}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-phosphor/70">{children}</p>
    </header>
  );
}
