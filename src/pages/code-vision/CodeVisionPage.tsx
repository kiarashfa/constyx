import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { PageHeader } from '../../components/PageHeader';

const CodeVisionCanvas = lazy(() => import('./CodeVisionCanvas'));

type FeedState = 'idle' | 'requesting' | 'live' | 'denied' | 'error' | 'unsupported';

/**
 * [07] CODE VISION — the standalone webcam section. Requests the camera on an
 * explicit gesture, then renders the live feed through the shared code-vision
 * effect (see src/engine/codevision). Everything is local: the stream goes
 * straight into a VideoTexture and is drawn in WebGL — nothing is uploaded,
 * recorded, or transmitted anywhere.
 */
export function CodeVisionPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<FeedState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [videoReady, setVideoReady] = useState(false);
  const [cell, setCell] = useState(8);
  const [mirror, setMirror] = useState(true);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setVideoReady(false);
  }, []);

  // Release the camera when the section unmounts (kills the recording light).
  useEffect(() => stopStream, [stopStream]);

  const requestFeed = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState('unsupported');
      return;
    }
    setState('requesting');
    setErrorMsg('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      setState('live');
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setState('denied');
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        setState('error');
        setErrorMsg('No camera device was found on this machine.');
      } else {
        setState('error');
        setErrorMsg(err instanceof Error ? err.message : 'The feed could not be opened.');
      }
    }
  }, []);

  const endFeed = useCallback(() => {
    stopStream();
    setState('idle');
  }, [stopStream]);

  return (
    <>
      <PageHeader code="07" title="CODE VISION">
        The operator&apos;s gift: to stop seeing the render and start seeing the code
        underneath it. Point the hardline at your own feed and watch it resolve into falling
        green glyphs — brightness and edges picked out in characters, the way Neo learned to
        read the world. Local only: the image never leaves this machine.
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        {/* ---- viewport ---- */}
        <div className="relative flex min-h-[320px] items-center justify-center overflow-hidden border border-phosphor/40 bg-black sm:min-h-[440px]">
          {/* The video element stays mounted (hidden) so the texture has a live
              source; WebGL draws the visible result. */}
          <video
            ref={videoRef}
            className="hidden"
            muted
            playsInline
            onLoadedMetadata={() => setVideoReady(true)}
          />

          {state === 'live' && videoReady && videoRef.current ? (
            <Suspense fallback={<Readout>DECODING FEED…</Readout>}>
              <div className="absolute inset-0">
                <CodeVisionCanvas video={videoRef.current} cell={cell} mirror={mirror} />
              </div>
              <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 text-[10px] tracking-[0.3em] text-phosphor/70">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-phosphor" />
                LIVE · LOCAL
              </div>
            </Suspense>
          ) : (
            <FeedPlaceholder
              state={state}
              errorMsg={errorMsg}
              onRequest={requestFeed}
              onRetry={requestFeed}
            />
          )}

          <div
            aria-hidden
            className="crt-overlay pointer-events-none absolute inset-0 opacity-70"
          />
        </div>

        {/* ---- controls ---- */}
        <div className="flex flex-col gap-4">
          <section className="border border-phosphor/30 bg-terminal/75">
            <header className="border-b border-phosphor/30 px-3 py-1.5 text-xs tracking-[0.3em] text-phosphor/80">
              FEED
            </header>
            <div className="flex flex-col gap-3 p-3">
              {state === 'live' ? (
                <button
                  type="button"
                  onClick={endFeed}
                  className="border border-phosphor/40 px-3 py-2 text-xs tracking-[0.3em] text-phosphor/80 transition-colors hover:border-phosphor hover:text-phosphor"
                >
                  [ ◼ CLOSE FEED ]
                </button>
              ) : (
                <button
                  type="button"
                  onClick={requestFeed}
                  disabled={state === 'requesting'}
                  className="glow border border-phosphor bg-phosphor/10 px-3 py-2 text-xs tracking-[0.3em] text-phosphor-bright transition-colors hover:bg-phosphor/20 disabled:opacity-40"
                >
                  {state === 'requesting' ? '· OPENING HARDLINE ·' : '[ ▸ OPEN CAMERA FEED ]'}
                </button>
              )}

              <label className="block text-[11px] tracking-[0.2em] text-phosphor/70">
                GLYPH SIZE · {cell}px
                <input
                  type="range"
                  min={6}
                  max={18}
                  step={1}
                  value={cell}
                  onChange={(e) => setCell(Number(e.target.value))}
                  className="mt-1 w-full accent-phosphor"
                />
              </label>

              <label className="flex cursor-pointer items-center gap-2 text-[11px] tracking-[0.2em] text-phosphor/70">
                <input
                  type="checkbox"
                  checked={mirror}
                  onChange={(e) => setMirror(e.target.checked)}
                  className="accent-phosphor"
                />
                MIRROR FEED
              </label>
            </div>
          </section>

          <section className="border border-phosphor/20 bg-terminal/60 p-3 text-[11px] leading-relaxed text-phosphor/55">
            <p className="mb-1 tracking-[0.2em] text-phosphor/70">/// PRIVACY</p>
            <p>
              The camera stream is processed entirely on this device, in the browser&apos;s
              graphics pipeline. Nothing is uploaded, stored, or sent over any network. Close
              the feed (or leave the section) to release the camera.
            </p>
          </section>
        </div>
      </div>

      <p className="mt-4 text-xs text-phosphor-dim">
        &gt; code vision :: getUserMedia → VideoTexture → glyph-density shader · zero network
      </p>
    </>
  );
}

function Readout({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm tracking-[0.3em] text-phosphor/60">
      {children}
      <span className="cursor-blink">▮</span>
    </p>
  );
}

function FeedPlaceholder({
  state,
  errorMsg,
  onRequest,
  onRetry,
}: {
  state: FeedState;
  errorMsg: string;
  onRequest: () => void;
  onRetry: () => void;
}) {
  if (state === 'requesting') return <Readout>AWAITING CAMERA PERMISSION…</Readout>;

  if (state === 'denied') {
    return (
      <div className="max-w-sm px-6 text-center">
        <p className="text-sm tracking-[0.2em] text-phosphor/80">FEED REFUSED</p>
        <p className="mt-2 text-xs leading-relaxed text-phosphor/55">
          Camera access was blocked. Allow it in your browser&apos;s site settings (the camera
          icon in the address bar), then reopen the feed.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="glow mt-4 border border-phosphor px-4 py-2 text-xs tracking-[0.3em] text-phosphor-bright hover:bg-phosphor/15"
        >
          [ ↻ TRY AGAIN ]
        </button>
      </div>
    );
  }

  if (state === 'unsupported') {
    return (
      <div className="max-w-sm px-6 text-center">
        <p className="text-sm tracking-[0.2em] text-phosphor/80">NO HARDLINE</p>
        <p className="mt-2 text-xs leading-relaxed text-phosphor/55">
          This browser won&apos;t expose a camera here. Camera access needs a secure context —
          run the site over <span className="text-phosphor/80">localhost</span> or https rather
          than a <span className="text-phosphor/80">file://</span> path.
        </p>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="max-w-sm px-6 text-center">
        <p className="text-sm tracking-[0.2em] text-phosphor/80">FEED ERROR</p>
        <p className="mt-2 text-xs leading-relaxed text-phosphor/55">{errorMsg}</p>
        <button
          type="button"
          onClick={onRetry}
          className="glow mt-4 border border-phosphor px-4 py-2 text-xs tracking-[0.3em] text-phosphor-bright hover:bg-phosphor/15"
        >
          [ ↻ TRY AGAIN ]
        </button>
      </div>
    );
  }

  // idle
  return (
    <div className="max-w-sm px-6 text-center">
      <p className="glow text-sm tracking-[0.3em] text-phosphor">THE CODE IS EVERYWHERE</p>
      <p className="mt-2 text-xs leading-relaxed text-phosphor/55">
        Open your camera to see it resolve. The feed is rendered locally and never leaves this
        machine.
      </p>
      <button
        type="button"
        onClick={onRequest}
        className="glow mt-4 border border-phosphor bg-phosphor/10 px-5 py-2.5 text-xs tracking-[0.3em] text-phosphor-bright hover:bg-phosphor/20"
      >
        [ ▸ OPEN CAMERA FEED ]
      </button>
    </div>
  );
}
