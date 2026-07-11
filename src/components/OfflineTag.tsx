interface OfflineTagProps {
  label?: string;
}

/** Blinking status chip for features that don't exist yet. */
export function OfflineTag({ label = 'NOT YET INITIALIZED' }: OfflineTagProps) {
  return (
    <span className="inline-flex items-center gap-2 border border-phosphor/40 px-2 py-0.5 text-[11px] tracking-[0.25em] text-phosphor/80">
      <span className="cursor-blink">▮</span>
      {label}
    </span>
  );
}
