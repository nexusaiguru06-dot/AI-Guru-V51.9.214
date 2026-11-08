/**
 * Procedural sound design, rendered sample-by-sample (no audio files, no network).
 * Same output in the browser (→ AudioBuffer) and in Node (→ WAV for tests).
 *
 *   pop      digit appears ........ short pitched blip
 *   scribble pen on board ......... filtered noise with a stroke rhythm
 *   swoosh   something moves ...... noise sweep
 *   whoosh   digit transformation . quick rising tone + air
 *   hop      carry / borrow jump .. two-note bounce
 *   tick     focus ................ tiny click
 *   ding     correct answer ....... bell with harmonics
 *   music    soft pad bed under the whole reel
 */

import type { SfxEvent } from './engine';

export const SFX_RATE = 48000;

/** Deterministic noise. */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) / 4294967296) * 2 - 1;
  };
}

/** V51.9.101: sound-effect packs (the same events, a different character). */
export type SfxPack = 'classic' | 'soft' | 'arcade';
export const SFX_PACKS: readonly SfxPack[] = ['classic', 'soft', 'arcade'];
/** V51.9.101: music beds. */
export type MusicKind = 'calm' | 'upbeat' | 'kerala' | 'lofi';
export const MUSICS: readonly MusicKind[] = ['calm', 'upbeat', 'kerala', 'lofi'];
export const MUSIC_NAME: Record<MusicKind, string> = { calm: 'Calm pad', upbeat: 'Upbeat', kerala: 'Kerala percussion', lofi: 'Lo-fi' };
export const PACK_NAME: Record<SfxPack, string> = { classic: 'Classic', soft: 'Soft', arcade: 'Arcade' };

const square = (x: number) => (Math.sin(x) >= 0 ? 0.55 : -0.55);

function addEvent(out: Float32Array, ev: SfxEvent, rate: number, seed: number, pack: SfxPack = 'classic') {
  const start = Math.floor((ev.t / 1000) * rate);
  const pitch = (ev.pitch ?? 1) * (pack === 'soft' ? 0.78 : 1);
  const wave = pack === 'arcade' ? square : Math.sin;
  const gain = pack === 'soft' ? 0.6 : 1;
  const noise = rng(seed);
  const put = (i: number, v: number) => {
    const k = start + i;
    if (k >= 0 && k < out.length) out[k] += v * gain;
  };
  const secs = (ms: number) => Math.floor((ms / 1000) * rate);

  switch (ev.kind) {
    case 'pop': {
      const n = secs(90);
      for (let i = 0; i < n; i++) {
        const tt = i / rate;
        const f = 520 * pitch * (1 + 0.6 * Math.exp(-tt * 60));
        put(i, 0.22 * wave(2 * Math.PI * f * tt) * Math.exp(-tt * (pack === 'soft' ? 26 : 38)));
      }
      break;
    }
    case 'tick': {
      const n = secs(25);
      for (let i = 0; i < n; i++) put(i, 0.12 * noise() * Math.exp(-i / (rate * 0.004)));
      break;
    }
    case 'scribble': {
      const n = secs(Math.min(ev.dur ?? 400, 1200));
      let lp = 0;
      for (let i = 0; i < n; i++) {
        lp += 0.25 * (noise() - lp);
        const stroke = 0.55 + 0.45 * Math.sin((2 * Math.PI * 7 * i) / rate);
        const env = Math.min(1, i / (rate * 0.02)) * Math.min(1, (n - i) / (rate * 0.05));
        put(i, 0.07 * lp * stroke * env);
      }
      break;
    }
    case 'swoosh':
    case 'whoosh': {
      const n = secs(Math.min(ev.dur ?? 500, 900));
      let lp = 0;
      let ph = 0;
      for (let i = 0; i < n; i++) {
        const p = i / n;
        const a = 0.05 + 0.4 * p;
        lp += a * (noise() - lp);
        const env = Math.sin(Math.PI * p);
        let v = 0.09 * lp * env;
        if (ev.kind === 'whoosh') {
          ph += (2 * Math.PI * (300 + 500 * p) * pitch) / rate;
          v += 0.05 * Math.sin(ph) * env;
        }
        put(i, v);
      }
      break;
    }
    case 'hop': {
      const n = secs(160);
      for (let i = 0; i < n; i++) {
        const tt = i / rate;
        const f = (tt < 0.07 ? 660 : 880) * pitch;
        put(i, 0.14 * wave(2 * Math.PI * f * tt) * Math.exp(-(tt % 0.07) * 30));
      }
      break;
    }
    case 'ding': {
      const n = secs(1200);
      for (let i = 0; i < n; i++) {
        const tt = i / rate;
        const env = Math.exp(-tt * 3.2);
        const v = pack === 'arcade'
          ? wave(2 * Math.PI * (tt < 0.08 ? 1046.5 : 1568) * tt) * Math.exp(-tt * 3)
          : Math.sin(2 * Math.PI * 1318.5 * pitch * tt) + 0.5 * Math.sin(2 * Math.PI * 2637 * pitch * tt) + 0.25 * Math.sin(2 * Math.PI * 3955 * pitch * tt);
        put(i, 0.12 * v * env);
      }
      break;
    }
  }
}

/** Gentle C-major pad: changes chord every 4 s, very quiet, fades in/out. */
function addMusic(out: Float32Array, rate: number, kind: MusicKind = 'calm') {
  if (kind === 'upbeat') return addUpbeat(out, rate);
  if (kind === 'kerala') return addKerala(out, rate);
  if (kind === 'lofi') return addLofi(out, rate);
  const chords = [
    [261.6, 329.6, 392.0],
    [220.0, 261.6, 329.6],
    [174.6, 220.0, 261.6],
    [196.0, 246.9, 293.7],
  ];
  const len = out.length;
  for (let i = 0; i < len; i++) {
    const tt = i / rate;
    const k = Math.floor(tt / 4) % chords.length;
    const local = (tt % 4) / 4;
    const env = Math.min(1, tt / 1.5) * Math.min(1, (len - i) / (rate * 1.5)) * (0.75 + 0.25 * Math.sin(Math.PI * local));
    let v = 0;
    for (const f of chords[k]) v += Math.sin(2 * Math.PI * f * tt) + 0.3 * Math.sin(2 * Math.PI * f * 2 * tt);
    out[i] += 0.012 * v * env;
  }
}

const CHORDS = [
  [261.6, 329.6, 392.0],
  [220.0, 261.6, 329.6],
  [174.6, 220.0, 261.6],
  [196.0, 246.9, 293.7],
];
const fade = (i: number, len: number, rate: number) => Math.min(1, i / (rate * 1.2)) * Math.min(1, (len - i) / (rate * 1.5));

/** Upbeat: a plucked arpeggio in eighths at 104 bpm over a soft kick on every beat. */
function addUpbeat(out: Float32Array, rate: number) {
  const len = out.length;
  const beat = 60 / 104;
  for (let i = 0; i < len; i++) {
    const tt = i / rate;
    const chord = CHORDS[Math.floor(tt / (beat * 8)) % CHORDS.length];
    const e = tt % (beat / 2);
    const note = chord[Math.floor(tt / (beat / 2)) % 3] * 2;
    let v = 0.5 * Math.sin(2 * Math.PI * note * tt) * Math.exp(-e * 9);
    const k = tt % beat;
    v += 0.9 * Math.sin(2 * Math.PI * (55 + 90 * Math.exp(-k * 30)) * k) * Math.exp(-k * 14);
    out[i] += 0.016 * v * fade(i, len, rate);
  }
}

/** Kerala percussion: a chenda-like low drum (pitch falling) in a 3+3+2 pattern, ilathalam cymbal ticks, a tanpura-like drone. */
function addKerala(out: Float32Array, rate: number) {
  const len = out.length;
  const pulse = 60 / 132 / 2;
  const pattern = [1, 0, 0, 1, 0, 0, 1, 0];
  const noise = rng(4242);
  for (let i = 0; i < len; i++) {
    const tt = i / rate;
    const n = Math.floor(tt / pulse);
    const e = tt - n * pulse;
    let v = 0;
    if (pattern[n % 8]) v += 0.9 * Math.sin(2 * Math.PI * (90 + 70 * Math.exp(-e * 25)) * e) * Math.exp(-e * 11);
    if (n % 2 === 1) v += 0.25 * noise() * Math.exp(-e * 60) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 5200 * e));
    v += 0.22 * (Math.sin(2 * Math.PI * 130.8 * tt) + 0.5 * Math.sin(2 * Math.PI * 196 * tt)) * (0.8 + 0.2 * Math.sin(tt * 1.3));
    out[i] += 0.016 * v * fade(i, len, rate);
  }
}

/** Lo-fi: soft electric-piano chords with tremolo, a lazy beat and vinyl crackle. */
function addLofi(out: Float32Array, rate: number) {
  const len = out.length;
  const beat = 60 / 80;
  const noise = rng(777);
  let lp = 0;
  for (let i = 0; i < len; i++) {
    const tt = i / rate;
    const chord = CHORDS[(Math.floor(tt / (beat * 4)) + 1) % CHORDS.length];
    const ce = tt % (beat * 4);
    let v = 0;
    for (const f of chord) v += Math.sin(2 * Math.PI * f * tt + 0.3 * Math.sin(2 * Math.PI * f * 2 * tt)) * Math.exp(-ce * 0.5);
    v *= 0.75 + 0.25 * Math.sin(2 * Math.PI * 4 * tt);
    const k = tt % beat;
    if (Math.floor(tt / beat) % 2 === 0) v += 1.4 * Math.sin(2 * Math.PI * (50 + 60 * Math.exp(-k * 25)) * k) * Math.exp(-k * 10);
    lp += 0.05 * (noise() - lp);
    v += (Math.abs(noise()) > 0.995 ? 0.8 * noise() : 0) + 0.25 * lp;
    out[i] += 0.012 * v * fade(i, len, rate);
  }
}

export interface SfxOptions {
  rate?: number;
  music?: boolean;
  /** V51.9.101: which music bed and which sound-effect pack (default calm + classic: as before). */
  musicKind?: MusicKind;
  pack?: SfxPack;
  /** Time ranges (ms) where a voice is speaking: music and effects dip underneath. */
  duck?: Array<[number, number]>;
  /** Apply the soft limiter (turn off when more audio will be mixed on top). */
  limit?: boolean;
}

/** Gain envelope that dips to `low` inside the ranges, with smooth 150 ms ramps. */
function duckEnvelope(len: number, rate: number, ranges: Array<[number, number]>, low: number): Float32Array {
  const env = new Float32Array(len).fill(1);
  const ramp = Math.round(0.15 * rate);
  for (const [a, b] of ranges) {
    const s0 = Math.floor((a / 1000) * rate) - ramp;
    const s1 = Math.ceil((b / 1000) * rate) + ramp;
    for (let i = Math.max(0, s0); i < Math.min(len, s1); i++) {
      const inA = Math.min(1, (i - s0) / ramp);
      const inB = Math.min(1, (s1 - i) / ramp);
      const depth = Math.min(inA, inB);
      env[i] = Math.min(env[i], 1 - (1 - low) * depth);
    }
  }
  return env;
}

export function softLimit(buf: Float32Array): void {
  for (let i = 0; i < buf.length; i++) buf[i] = Math.tanh(buf[i] * 1.2) / 1.2;
}

export function renderSfx(events: SfxEvent[], durationMs: number, o: SfxOptions = {}): Float32Array<ArrayBuffer> {
  const rate = o.rate ?? SFX_RATE;
  const len = Math.ceil((durationMs / 1000) * rate);
  const out: Float32Array<ArrayBuffer> = new Float32Array(len);
  const music = new Float32Array(len);
  if (o.music !== false) addMusic(music, rate, o.musicKind);
  events.forEach((ev, i) => addEvent(out, ev, rate, 1234 + i * 7919, o.pack));
  if (o.duck?.length) {
    const fx = duckEnvelope(len, rate, o.duck, 0.45);
    const bed = duckEnvelope(len, rate, o.duck, 0.3);
    for (let i = 0; i < len; i++) out[i] = out[i] * fx[i] + music[i] * bed[i];
  } else {
    for (let i = 0; i < len; i++) out[i] += music[i];
  }
  if (o.limit !== false) softLimit(out);
  return out;
}
