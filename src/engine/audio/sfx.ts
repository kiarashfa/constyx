/**
 * One-shot synths. Every function is safe to call any time — if the
 * context isn't unlocked yet it silently no-ops (one-shots are moments;
 * deferring them would play them late and wrong).
 */
import { audioCtx, masterBus, noiseSrc, gain, filter, osc, rand } from './core';

type Ctx = AudioContext;

function bus(): { c: Ctx; out: GainNode } | null {
  const c = audioCtx();
  const m = masterBus();
  return c && m ? { c, out: m } : null;
}

/** Filtered-noise burst: the workhorse. Returns its output gain. */
function burst(
  c: Ctx,
  out: AudioNode,
  opts: {
    dur: number;
    vol: number;
    type?: BiquadFilterType;
    from: number;
    to?: number;
    q?: number;
    attack?: number;
    rate?: number;
  },
): void {
  const { dur, vol, type = 'bandpass', from, to = from, q = 1, attack = 0.002, rate = 1 } = opts;
  const t = c.currentTime;
  const src = noiseSrc(c, rate);
  const f = filter(c, type, from, q);
  f.frequency.exponentialRampToValueAtTime(Math.max(to, 20), t + dur);
  const g = gain(c, 0);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f);
  f.connect(g);
  g.connect(out);
  src.stop(t + dur + 0.05);
}

/** Pitched thump: sine with a fast downward glide. */
function thumpTone(c: Ctx, out: AudioNode, f0: number, f1: number, dur: number, vol: number): void {
  const t = c.currentTime;
  const o = osc(c, 'sine', f0);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = gain(c, 0);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(out);
  o.stop(t + dur + 0.05);
}

/* ---------------- the jack-in ---------------- */

/** Rising signal sweep + glitch ticks + a soft white-out impact, timed to
 *  the ~2.7s JackIn transition. */
export function sfxJackIn(): void {
  const b = bus();
  if (!b) return;
  const { c, out } = b;
  const t = c.currentTime;

  // Rising carrier.
  const o = osc(c, 'sawtooth', 70);
  o.frequency.exponentialRampToValueAtTime(880, t + 2.1);
  const f = filter(c, 'lowpass', 300, 4);
  f.frequency.exponentialRampToValueAtTime(4200, t + 2.1);
  const g = gain(c, 0);
  g.gain.linearRampToValueAtTime(0.1, t + 0.4);
  g.gain.setValueAtTime(0.1, t + 1.9);
  g.gain.linearRampToValueAtTime(0, t + 2.2);
  o.connect(f);
  f.connect(g);
  g.connect(out);
  o.stop(t + 2.3);

  // Glitch ticks, accelerating.
  for (let i = 0; i < 14; i++) {
    const at = t + 0.3 + Math.pow(i / 14, 1.6) * 1.8;
    const src = noiseSrc(c);
    const bf = filter(c, 'bandpass', rand(900, 3800), 6);
    const tg = gain(c, 0);
    tg.gain.setValueAtTime(0, at);
    tg.gain.linearRampToValueAtTime(0.12, at + 0.004);
    tg.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
    src.connect(bf);
    bf.connect(tg);
    tg.connect(out);
    src.stop(at + 0.08);
  }

  // White-out wash at the cut.
  setTimeout(() => {
    const b2 = bus();
    if (!b2) return;
    burst(b2.c, b2.out, { dur: 0.7, vol: 0.3, type: 'lowpass', from: 5000, to: 300 });
    thumpTone(b2.c, b2.out, 120, 40, 0.5, 0.3);
  }, 2150);
}

/* ---------------- combat & range ---------------- */

export type GunKind = 'pistol' | 'smg' | 'shotgun' | 'rifle';

export function sfxGunshot(kind: GunKind): void {
  const b = bus();
  if (!b) return;
  const { c, out } = b;
  const v = rand(0.9, 1.1);
  if (kind === 'shotgun') {
    burst(c, out, { dur: 0.28, vol: 0.5 * v, type: 'lowpass', from: 2400, to: 240 });
    thumpTone(c, out, 150, 45, 0.22, 0.4);
  } else if (kind === 'rifle') {
    burst(c, out, { dur: 0.2, vol: 0.42 * v, type: 'bandpass', from: 1700, to: 400, q: 0.7 });
    thumpTone(c, out, 190, 55, 0.16, 0.32);
    burst(c, out, { dur: 0.4, vol: 0.08, type: 'highpass', from: 2500 }); // crack tail
  } else if (kind === 'smg') {
    burst(c, out, { dur: 0.11, vol: 0.3 * v, type: 'bandpass', from: 1500, to: 500, q: 0.8 });
    thumpTone(c, out, 170, 70, 0.09, 0.22);
  } else {
    burst(c, out, { dur: 0.16, vol: 0.38 * v, type: 'bandpass', from: 1400, to: 350, q: 0.8 });
    thumpTone(c, out, 180, 60, 0.13, 0.3);
  }
}

export type HitKind = 'hit' | 'block' | 'counter' | 'whiff';

export function sfxDojo(kind: HitKind): void {
  const b = bus();
  if (!b) return;
  const { c, out } = b;
  if (kind === 'hit') {
    thumpTone(c, out, 140, 55, 0.18, 0.4);
    burst(c, out, { dur: 0.09, vol: 0.16, from: 900, to: 300 });
  } else if (kind === 'block') {
    burst(c, out, { dur: 0.07, vol: 0.28, from: 2200, to: 900, q: 3 });
    thumpTone(c, out, 220, 120, 0.08, 0.2);
  } else if (kind === 'counter') {
    thumpTone(c, out, 170, 50, 0.22, 0.45);
    burst(c, out, { dur: 0.14, vol: 0.2, from: 1200, to: 250 });
  } else {
    burst(c, out, { dur: 0.16, vol: 0.1, type: 'bandpass', from: 500, to: 1400, q: 1.5 });
  }
}

/** Bullet-time dodge whoosh (slow, wide) or a near-miss graze zip. */
export function sfxWhoosh(graze = false): void {
  const b = bus();
  if (!b) return;
  const { c, out } = b;
  if (graze) {
    burst(c, out, { dur: 0.25, vol: 0.3, from: 3200, to: 500, q: 4 });
  } else {
    burst(c, out, { dur: 0.9, vol: 0.22, type: 'bandpass', from: 240, to: 900, q: 1.2, attack: 0.25 });
    thumpTone(c, out, 90, 50, 0.7, 0.12);
  }
}

/** Soft landing/impact thump (rooftop landings etc.). */
export function sfxThump(intensity = 1): void {
  const b = bus();
  if (!b) return;
  thumpTone(b.c, b.out, 130, 45, 0.2, 0.25 * Math.min(intensity, 1.5));
  burst(b.c, b.out, { dur: 0.1, vol: 0.06 * intensity, type: 'lowpass', from: 700, to: 200 });
}

/** The White Room TV: a period channel knob clunk. */
export function sfxTvClick(): void {
  const b = bus();
  if (!b) return;
  burst(b.c, b.out, { dur: 0.05, vol: 0.25, from: 1800, to: 700, q: 2 });
  thumpTone(b.c, b.out, 300, 150, 0.05, 0.12);
}
