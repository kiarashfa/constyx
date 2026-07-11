/**
 * OPERATOR audio core — fully procedural Web Audio. No sample files: every
 * bed and one-shot is synthesized, so the project stays offline-complete
 * and license-clean. (Real recordings can still be layered in later via
 * assets-userprovided/; see HANDOFF.)
 *
 * Conventions:
 *  - master gain .75 into a safety compressor;
 *  - ambient beds sit at .1–.3 and fade in over ~2.5s, out over ~.8s;
 *  - one-shots peak <= .5 pre-master;
 *  - the context unlocks on the first user gesture (click/keydown — the
 *    hub link click or [SETTLE IN] both qualify); anything started before
 *    that is deferred and built on unlock.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const onUnlock: (() => void)[] = [];

export function audioCtx(): AudioContext | null {
  return ctx && ctx.state === 'running' ? ctx : null;
}

/** Create/resume the context. Safe to call from anywhere; real work only
 *  happens once a user gesture has been seen. */
export function ensureAudio(): void {
  if (typeof window === 'undefined') return;
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return;
    }
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 6;
    comp.connect(ctx.destination);
    master = ctx.createGain();
    master.gain.value = 0.75;
    master.connect(comp);
  }
  if (ctx.state === 'suspended') {
    ctx.resume().then(() => {
      if (ctx?.state === 'running') {
        onUnlock.splice(0).forEach((fn) => fn());
      }
    });
  } else if (ctx.state === 'running' && onUnlock.length) {
    onUnlock.splice(0).forEach((fn) => fn());
  }
}

/** Run now if the context is live, else defer until it unlocks. */
export function whenRunning(fn: () => void): void {
  ensureAudio();
  if (ctx && ctx.state === 'running') fn();
  else onUnlock.push(fn);
}

export function masterBus(): GainNode | null {
  return master;
}

// Unlock on the first gesture anywhere.
if (typeof document !== 'undefined') {
  const unlock = () => ensureAudio();
  document.addEventListener('click', unlock, { capture: true });
  document.addEventListener('keydown', unlock, { capture: true });
}

/* ---------------- shared buffers ---------------- */

let noiseBuf: AudioBuffer | null = null;
export function noiseBuffer(c: AudioContext): AudioBuffer {
  if (!noiseBuf || noiseBuf.sampleRate !== c.sampleRate) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

const irCache = new Map<string, AudioBuffer>();
/** Procedural reverb impulse: exponentially decaying noise. */
export function impulse(c: AudioContext, seconds: number, decay: number): AudioBuffer {
  const key = `${seconds}:${decay}:${c.sampleRate}`;
  let buf = irCache.get(key);
  if (!buf) {
    const len = Math.floor(c.sampleRate * seconds);
    buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    irCache.set(key, buf);
  }
  return buf;
}

/* ---------------- tiny node builders ---------------- */

export function noiseSrc(c: AudioContext, rate = 1): AudioBufferSourceNode {
  const s = c.createBufferSource();
  s.buffer = noiseBuffer(c);
  s.loop = true;
  s.playbackRate.value = rate;
  s.start();
  return s;
}

export function gain(c: AudioContext, v: number): GainNode {
  const g = c.createGain();
  g.gain.value = v;
  return g;
}

export function filter(
  c: AudioContext,
  type: BiquadFilterType,
  freq: number,
  q = 0.9,
): BiquadFilterNode {
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

export function osc(c: AudioContext, type: OscillatorType, freq: number): OscillatorNode {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  o.start();
  return o;
}

/** LFO driving an AudioParam: param += osc(freq) * depth. */
export function lfo(c: AudioContext, freq: number, depth: number, param: AudioParam): OscillatorNode {
  const o = osc(c, 'sine', freq);
  const g = gain(c, depth);
  o.connect(g);
  g.connect(param);
  return o;
}

export const rand = (a: number, b: number) => a + Math.random() * (b - a);
