import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <p className="glow text-3xl tracking-[0.35em]">SYSTEM FAILURE</p>
      <p className="mt-4 text-sm text-phosphor/60">no such construct at this address.</p>
      <Link to="/" className="mt-6 text-sm text-phosphor/80 hover:text-phosphor-bright">
        &gt; return to console
      </Link>
    </div>
  );
}
