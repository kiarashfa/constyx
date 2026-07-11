/** Required attribution — rendered on every page via AppShell. */
export function SiteFooter() {
  return (
    <footer className="border-t border-phosphor/20 bg-terminal/85">
      <div className="mx-auto w-full max-w-6xl px-4 py-3 text-[11px] leading-relaxed text-phosphor/50 sm:px-6">
        <p>
          OPERATOR is an unofficial, non-commercial fan tribute to{' '}
          <span className="text-phosphor/70">The Matrix</span> trilogy, created by the
          Wachowskis. The Matrix and all related characters, names, and imagery are ©
          Warner Bros. Entertainment Inc. This project is not affiliated with, sponsored
          by, or endorsed by Warner Bros. No commercial use. Made with respect, by fans.
        </p>
      </div>
    </footer>
  );
}
