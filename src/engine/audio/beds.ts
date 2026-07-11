/**
 * Ambient beds: continuously-running procedural soundscapes, one per scene.
 * A bed = a node graph + optional timed event schedulers + a `set(param)`
 * surface for scene-reactive values (train distance, storm level, crumbs,
 * dimmed lights...). Beds are built lazily once the context unlocks, fade
 * in over ~2.5s and out over ~.8s on scene exit.
 */
import {
  audioCtx,
  masterBus,
  whenRunning,
  noiseSrc,
  gain,
  filter,
  osc,
  lfo,
  impulse,
  rand,
} from './core';

type Ctx = AudioContext;

interface BedInner {
  set?(param: string, v: number): void;
  dispose(): void;
}

export interface BedHandle {
  set(param: string, v: number): void;
  stop(fadeSeconds?: number): void;
}

/* ---------------- builder toolkit ---------------- */

class Rig {
  srcs: AudioScheduledSourceNode[] = [];
  timers: number[] = [];
  constructor(
    public c: Ctx,
    public out: GainNode,
  ) {}

  noise(rate = 1): AudioBufferSourceNode {
    const s = noiseSrc(this.c, rate);
    this.srcs.push(s);
    return s;
  }

  osc(type: OscillatorType, freq: number): OscillatorNode {
    const o = osc(this.c, type, freq);
    this.srcs.push(o);
    return o;
  }

  lfo(freq: number, depth: number, param: AudioParam): void {
    this.srcs.push(lfo(this.c, freq, depth, param));
  }

  /** Continuous noise layer: noise -> filter -> gain -> out. */
  layer(type: BiquadFilterType, freq: number, q: number, level: number): GainNode {
    const f = filter(this.c, type, freq, q);
    const g = gain(this.c, level);
    this.noise().connect(f);
    f.connect(g);
    g.connect(this.out);
    return g;
  }

  /** Repeating randomized event. */
  every(minS: number, maxS: number, fn: () => void): void {
    const slot = this.timers.length;
    this.timers.push(0);
    const tick = () => {
      fn();
      this.timers[slot] = window.setTimeout(tick, rand(minS, maxS) * 1000);
    };
    this.timers[slot] = window.setTimeout(tick, rand(minS, maxS) * 1000);
  }

  /** Short filtered-noise burst (event SFX inside beds). */
  burst(dur: number, vol: number, type: BiquadFilterType, from: number, to = from, q = 1, dest?: AudioNode): void {
    const t = this.c.currentTime;
    const src = noiseSrc(this.c);
    const f = filter(this.c, type, from, q);
    f.frequency.exponentialRampToValueAtTime(Math.max(to, 20), t + dur);
    const g = gain(this.c, 0);
    g.gain.linearRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(dest ?? this.out);
    src.stop(t + dur + 0.05);
  }

  /** Short pitched blip/ping. */
  blip(f0: number, f1: number, dur: number, vol: number, type: OscillatorType = 'sine', dest?: AudioNode): void {
    const t = this.c.currentTime;
    const o = osc(this.c, type, f0);
    o.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), t + dur);
    const g = gain(this.c, 0);
    g.gain.linearRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest ?? this.out);
    o.stop(t + dur + 0.05);
  }

  /** Hall/room reverb return; feed it via the returned send gain. */
  reverb(seconds: number, decay: number, wet: number): GainNode {
    const send = gain(this.c, 1);
    const conv = this.c.createConvolver();
    conv.buffer = impulse(this.c, seconds, decay);
    const ret = gain(this.c, wet);
    send.connect(conv);
    conv.connect(ret);
    ret.connect(this.out);
    return send;
  }

  pan(v: number): StereoPannerNode {
    const p = this.c.createStereoPanner();
    p.pan.value = v;
    return p;
  }

  dispose(): void {
    this.timers.forEach((t) => clearTimeout(t));
    this.srcs.forEach((s) => {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    });
    this.out.disconnect();
  }
}

const smooth = (p: AudioParam, c: Ctx, v: number, tc = 0.4) => p.setTargetAtTime(v, c.currentTime, tc);

/* ---------------- recipes ---------------- */

type Builder = (c: Ctx, out: GainNode) => BedInner;

const builders: Record<string, Builder> = {
  /** Machine-world fields: sub drone, wind, distant thunder. */
  podBay(c, out) {
    const r = new Rig(c, out);
    const sub = gain(c, 0.16);
    r.osc('sine', 36).connect(sub);
    sub.connect(out);
    const d1 = gain(c, 0.05);
    r.osc('triangle', 55).connect(d1);
    d1.connect(out);
    const d2 = gain(c, 0.05);
    r.osc('triangle', 55.6).connect(d2);
    d2.connect(out);
    const wind = r.layer('lowpass', 420, 0.6, 0.07);
    r.lfo(0.07, 0.035, wind.gain);
    let storm = 0;
    r.every(9, 30, () => {
      if (Math.random() < 0.25 + storm * 0.6) {
        r.burst(rand(1.5, 3), 0.1 + storm * 0.14, 'lowpass', 900, 60, 0.7);
      }
    });
    return {
      set(p, v) {
        if (p === 'storm') {
          storm = v;
          smooth(wind.gain, c, 0.07 + v * 0.09, 1.5);
          smooth(sub.gain, c, 0.16 + v * 0.06, 1.5);
        }
      },
      dispose: () => r.dispose(),
    };
  },

  /** Empty station: room tone in a tiled hall + the train, distance-driven. */
  mobilAve(c, out) {
    const r = new Rig(c, out);
    const verb = r.reverb(2.2, 3.2, 0.35);
    r.layer('lowpass', 220, 0.6, 0.045);
    const hum = gain(c, 0.012);
    r.osc('sine', 100).connect(hum);
    hum.connect(out);
    r.every(6, 18, () => r.blip(rand(700, 1100), 300, 0.12, 0.02, 'sine', verb)); // drips
    // Train: rumble + rail hiss + clack, all scaled by closeness.
    const rumbleSrc = r.noise(0.7);
    const rumbleF = filter(c, 'lowpass', 90, 0.7);
    const rumble = gain(c, 0);
    rumbleSrc.connect(rumbleF);
    rumbleF.connect(rumble);
    rumble.connect(out);
    const hissF = filter(c, 'bandpass', 1900, 1.2);
    const hiss = gain(c, 0);
    r.noise().connect(hissF);
    hissF.connect(hiss);
    hiss.connect(out);
    const clackF = filter(c, 'bandpass', 750, 3);
    const clack = gain(c, 0);
    r.noise().connect(clackF);
    clackF.connect(clack);
    clack.connect(out);
    r.lfo(5.4, 0.5, clack.gain); // wheel rhythm rides the gain
    return {
      set(p, v) {
        if (p === 'train') {
          const close = Math.max(0, Math.min(1, v));
          smooth(rumble.gain, c, close * close * 0.3, 0.15);
          smooth(hiss.gain, c, close * close * 0.06, 0.15);
          smooth(clack.gain, c, close * close * 0.05, 0.15);
          smooth(rumbleSrc.playbackRate, c, 0.6 + close * 0.5, 0.15);
        }
      },
      dispose: () => r.dispose(),
    };
  },

  /** The park: breeze, leaves, songbirds, pigeons that answer the crumbs. */
  park(c, out) {
    const r = new Rig(c, out);
    const breeze = r.layer('lowpass', 500, 0.6, 0.055);
    r.lfo(0.09, 0.03, breeze.gain);
    const leaves = r.layer('bandpass', 2300, 0.8, 0.02);
    r.lfo(0.13, 0.013, leaves.gain);
    r.layer('lowpass', 140, 0.7, 0.03); // distant city floor
    let feed = 0;
    r.every(2.5, 8, () => {
      // Songbird: 2-4 quick chirps, panned.
      const p = r.pan(rand(-0.8, 0.8));
      p.connect(out);
      const n = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        setTimeout(() => r.blip(rand(2600, 4200), rand(1800, 3000), rand(0.06, 0.13), 0.022, 'sine', p), i * rand(120, 220));
      }
    });
    r.every(4, 12, () => {
      // Pigeon coo, more insistent once the crumbs are down.
      if (Math.random() > 0.35 + feed * 0.55) return;
      const p = r.pan(rand(-0.5, 0.5));
      p.connect(out);
      const t = c.currentTime;
      const o = osc(c, 'sine', 340);
      const g = gain(c, 0);
      g.gain.linearRampToValueAtTime(0.03 + feed * 0.02, t + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      const vib = osc(c, 'sine', 28);
      const vg = gain(c, 24);
      vib.connect(vg);
      vg.connect(o.frequency);
      o.connect(g);
      g.connect(p);
      o.stop(t + 0.55);
      vib.stop(t + 0.55);
    });
    return {
      set(p, v) {
        if (p === 'feed') feed = v;
      },
      dispose: () => r.dispose(),
    };
  },

  /** MetaCortex: fluorescents, HVAC, the squeegee, a distant phone. */
  office(c, out) {
    const r = new Rig(c, out);
    const hum = gain(c, 0.013);
    r.osc('triangle', 120).connect(hum);
    hum.connect(out);
    const hum2 = gain(c, 0.005);
    r.osc('sine', 240).connect(hum2);
    hum2.connect(out);
    r.layer('lowpass', 260, 0.6, 0.05); // HVAC
    r.every(6.4, 7.6, () => {
      // The squeegee stroke: a resonant rubber squeak sliding down.
      const p = r.pan(0.25);
      p.connect(out);
      r.burst(rand(0.5, 0.9), 0.035, 'bandpass', rand(2400, 3000), rand(1100, 1500), 9, p);
    });
    r.every(40, 130, () => {
      // A phone two rows over, twice, unanswered.
      for (let k = 0; k < 2; k++) {
        setTimeout(() => {
          const t = c.currentTime;
          const o = osc(c, 'square', 1040);
          const tremolo = osc(c, 'sine', 22);
          const tg = gain(c, 0.5);
          const g = gain(c, 0);
          g.gain.linearRampToValueAtTime(0.012, t + 0.03);
          g.gain.setValueAtTime(0.012, t + 0.5);
          g.gain.linearRampToValueAtTime(0, t + 0.55);
          tremolo.connect(tg);
          tg.connect(g.gain);
          o.connect(g);
          g.connect(out);
          o.stop(t + 0.6);
          tremolo.stop(t + 0.6);
        }, k * 1500);
      }
    });
    r.every(3, 11, () => {
      // Somebody typing, far off.
      for (let i = 0; i < 3 + Math.floor(Math.random() * 5); i++) {
        setTimeout(() => r.burst(0.02, 0.012, 'bandpass', rand(1800, 2600), undefined, 3), i * rand(70, 160));
      }
    });
    return { dispose: () => r.dispose() };
  },

  /** Tea house: near-silence with texture — kettle, cups, the street below. */
  teaHouse(c, out) {
    const r = new Rig(c, out);
    r.layer('lowpass', 300, 0.6, 0.022);
    const kettle = r.layer('highpass', 3400, 0.7, 0.008);
    r.lfo(0.2, 0.005, kettle.gain);
    r.layer('lowpass', 160, 0.8, 0.02); // street far below
    const verb = r.reverb(1.2, 2.6, 0.3);
    r.every(9, 26, () => {
      // Porcelain, softly.
      r.blip(rand(2100, 2800), rand(1600, 2200), 0.2, 0.02, 'triangle', verb);
    });
    r.every(14, 40, () => r.burst(0.3, 0.012, 'bandpass', 300, 180, 2, verb)); // timber creak
    return { dispose: () => r.dispose() };
  },

  /** Adams Street: the rain, drips under the deck, the passing car. */
  bridge(c, out) {
    const r = new Rig(c, out);
    const body = r.layer('lowpass', 1100, 0.5, 0.13);
    const patter = r.layer('bandpass', 4200, 0.7, 0.05);
    r.lfo(7.3, 0.02, patter.gain);
    r.lfo(0.11, 0.025, body.gain);
    const verb = r.reverb(1.6, 2.8, 0.25);
    let storm = 0;
    r.every(0.7, 2.2, () => {
      // Drips off the girders into puddles.
      r.blip(rand(500, 1100), rand(250, 500), rand(0.05, 0.1), 0.022, 'sine', verb);
    });
    r.every(18, 55, () => {
      if (Math.random() < 0.35 + storm * 0.5) r.burst(rand(2, 4), 0.1 + storm * 0.12, 'lowpass', 700, 50, 0.7);
    });
    // Car pass: tire wash + engine, closeness-driven.
    const tiresF = filter(c, 'bandpass', 950, 0.8);
    const tires = gain(c, 0);
    r.noise().connect(tiresF);
    tiresF.connect(tires);
    tires.connect(out);
    const engF = filter(c, 'lowpass', 190, 0.8);
    const eng = gain(c, 0);
    const engO = r.osc('sawtooth', 62);
    engO.connect(engF);
    engF.connect(eng);
    eng.connect(out);
    return {
      set(p, v) {
        if (p === 'storm') {
          storm = v;
          smooth(body.gain, c, 0.13 + v * 0.1, 1.2);
          smooth(patter.gain, c, 0.05 + v * 0.05, 1.2);
        } else if (p === 'car') {
          const close = Math.max(0, Math.min(1, v));
          smooth(tires.gain, c, close * close * 0.2, 0.12);
          smooth(eng.gain, c, close * close * 0.1, 0.12);
          smooth(engO.frequency, c, 58 + close * 14, 0.12);
        }
      },
      dispose: () => r.dispose(),
    };
  },

  /** The Architect's room: cold, electronic, patient. */
  architect(c, out) {
    const r = new Rig(c, out);
    const whine = gain(c, 0.005);
    r.osc('sine', 11600).connect(whine);
    whine.connect(out);
    const droneF = filter(c, 'lowpass', 320, 0.8);
    const drone = gain(c, 0.038);
    r.osc('sawtooth', 48).connect(droneF);
    r.osc('sawtooth', 48.6).connect(droneF);
    droneF.connect(drone);
    drone.connect(out);
    const fifth = gain(c, 0.016);
    r.osc('sine', 72.2).connect(fifth);
    fifth.connect(out);
    const wash = r.layer('bandpass', 6200, 0.7, 0.012);
    r.lfo(0.06, 0.007, wash.gain);
    let sync = 0;
    r.every(0.8, 3.2, () => {
      // Data chirps off the monitor wall; in sync mode they align and repeat.
      const n = sync > 0.5 ? 3 : 1;
      for (let i = 0; i < n; i++) {
        setTimeout(() => r.blip(rand(1700, 3400), rand(900, 1600), 0.05, 0.02, 'square', undefined), i * 160);
      }
    });
    return {
      set(p, v) {
        if (p === 'sync') {
          sync = v;
          smooth(drone.gain, c, 0.038 + v * 0.02, 1);
          smooth(fifth.gain, c, 0.016 * (1 - v * 0.7), 1); // the dissonance resolves
        }
      },
      dispose: () => r.dispose(),
    };
  },

  /** Le Vrai: the murmur of a full dining room — the scene's main event. */
  restaurant(c, out) {
    const r = new Rig(c, out);
    const verbSend = r.reverb(1.9, 2.9, 0.4);
    // Murmur bus: seven "voices" of band-passed noise with speech rhythm.
    const murmurLP = filter(c, 'lowpass', 1350, 0.7);
    const murmur = gain(c, 0.3);
    murmurLP.connect(murmur);
    murmur.connect(out);
    murmurLP.connect(verbSend);
    let density = 1;
    for (let v = 0; v < 7; v++) {
      const f = filter(c, 'bandpass', rand(260, 780), 2.6);
      const vg = gain(c, 0);
      const p = r.pan(rand(-0.75, 0.75));
      r.noise().connect(f);
      f.connect(vg);
      vg.connect(p);
      p.connect(murmurLP);
      // Syllable rhythm.
      r.lfo(rand(3, 5.5), 0.02, vg.gain);
      // Sentences: speak, pause, speak.
      const slot = r.timers.length;
      r.timers.push(0);
      let speaking = false;
      const turn = () => {
        speaking = !speaking && Math.random() < 0.75 * density;
        vg.gain.setTargetAtTime(speaking ? 0.045 : 0.0, c.currentTime, 0.25);
        r.timers[slot] = window.setTimeout(turn, rand(speaking ? 1.6 : 0.6, speaking ? 5 : 4) * 1000);
      };
      r.timers[slot] = window.setTimeout(turn, rand(200, 2500));
    }
    // Cutlery and glassware.
    r.every(1.6, 6, () => {
      const p = r.pan(rand(-0.8, 0.8));
      p.connect(verbSend);
      p.connect(out);
      if (Math.random() < 0.7) {
        r.blip(rand(2000, 4300), rand(1500, 3200), rand(0.08, 0.2), 0.02, 'triangle', p); // fork on china
      } else {
        r.burst(0.12, 0.025, 'bandpass', rand(600, 900), undefined, 4, p); // plate set down
      }
    });
    r.every(20, 70, () => r.blip(2950, 2900, 0.6, 0.014, 'sine', verbSend)); // a glass, somewhere
    r.layer('lowpass', 240, 0.6, 0.03); // warm room floor
    return {
      set(p, v) {
        if (p === 'dim') {
          density = 1 - v * 0.45;
          smooth(murmur.gain, c, 0.3 * (1 - v * 0.3), 1.5);
        }
      },
      dispose: () => r.dispose(),
    };
  },

  /** Red-dress street: daytime city floor with sparse traffic voices. */
  street(c, out) {
    const r = new Rig(c, out);
    const traffic = r.layer('lowpass', 340, 0.6, 0.09);
    r.lfo(0.08, 0.03, traffic.gain);
    r.layer('bandpass', 1300, 0.6, 0.012);
    r.every(18, 55, () => {
      const t = c.currentTime;
      const o = osc(c, 'sine', Math.random() < 0.5 ? 350 : 440);
      const g = gain(c, 0);
      g.gain.linearRampToValueAtTime(0.02, t + 0.05);
      g.gain.setValueAtTime(0.02, t + rand(0.2, 0.5));
      g.gain.linearRampToValueAtTime(0, t + 0.7);
      const f = filter(c, 'lowpass', 900, 1);
      o.connect(f);
      f.connect(g);
      g.connect(out);
      o.stop(t + 0.8);
    });
    return { dispose: () => r.dispose() };
  },

  /** Rooftop: hard wind with gusts, the city far below. */
  rooftopWind(c, out) {
    const r = new Rig(c, out);
    const windG = r.layer('lowpass', 480, 0.5, 0.16);
    r.lfo(0.12, 0.09, windG.gain);
    const whistle = r.layer('bandpass', 1250, 2.5, 0.008);
    r.lfo(0.21, 0.006, whistle.gain);
    r.layer('lowpass', 110, 0.7, 0.05);
    return { dispose: () => r.dispose() };
  },

  /** White room: the void hums, barely. */
  whiteRoom(c, out) {
    const r = new Rig(c, out);
    const tone = gain(c, 0.006);
    r.osc('sine', 174).connect(tone);
    tone.connect(out);
    r.layer('lowpass', 200, 0.6, 0.018);
    return { dispose: () => r.dispose() };
  },
};

export type BedName = keyof typeof builders;

/* ---------------- bed lifecycle ---------------- */

export function startBed(name: BedName, fadeIn = 2.5): BedHandle {
  let inner: BedInner | null = null;
  let bedGain: GainNode | null = null;
  let stopped = false;
  const pending: [string, number][] = [];

  whenRunning(() => {
    if (stopped) return;
    const c = audioCtx();
    const m = masterBus();
    if (!c || !m) return;
    bedGain = gain(c, 0);
    bedGain.connect(m);
    inner = builders[name](c, bedGain);
    bedGain.gain.linearRampToValueAtTime(1, c.currentTime + fadeIn);
    pending.splice(0).forEach(([p, v]) => inner?.set?.(p, v));
  });

  return {
    set(param, v) {
      if (inner?.set) inner.set(param, v);
      else pending.push([param, v]);
    },
    stop(fadeSeconds = 0.8) {
      stopped = true;
      const c = audioCtx();
      const inn = inner;
      const g = bedGain;
      if (!c || !g) {
        inn?.dispose();
        return;
      }
      g.gain.cancelScheduledValues(c.currentTime);
      g.gain.setTargetAtTime(0, c.currentTime, fadeSeconds / 3);
      window.setTimeout(() => inn?.dispose(), fadeSeconds * 1000 + 250);
    },
  };
}
