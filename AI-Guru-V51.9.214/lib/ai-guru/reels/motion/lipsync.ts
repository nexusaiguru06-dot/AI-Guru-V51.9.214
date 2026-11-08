/**
 * V51.9.100 — the mouth of the teacher's avatar, driven by the reel's own voice track.
 *
 * One clock for voice and picture (the idea LatentSync uses: every video frame is tied to its own slice of audio):
 * the voice clips are placed on the reel's timeline exactly where the mix puts them, and every frame k gets the
 * sound in a short window around k / fps. From that window come four numbers:
 *   level  how loud (0–1, from RMS in dB)              → ring glow, a small nod
 *   open   how far the jaw drops (level, with a fast attack and a slower release, gated in pauses)
 *   wide   "ee" / "s" sounds (many zero crossings)    → a wider, flatter mouth
 *   round  "oo" / "o" sounds (energy mostly below ~500 Hz) → a narrower, rounder mouth
 * Pure (no Web Audio, no DOM): the preview, the MP4 export and the tests compute the same frames.
 * Written for AI Guru; no third-party code.
 */

import { reelVoiceCues, type MotionReel } from './reel';
import { resample, type VoiceClips } from './audio';
import { SFX_RATE } from './sfx';

export interface MouthTrack {
  fps: number;
  level: Float32Array;
  open: Float32Array;
  wide: Float32Array;
  round: Float32Array;
}

export interface MouthState {
  level: number;
  open: number;
  wide: number;
  round: number;
}

export const CLOSED: MouthState = { level: 0, open: 0, wide: 0, round: 0 };

/** Rate the voice track is analysed at (speech needs no more; keeps a 3-minute reel cheap). */
export const TRACK_RATE = 16_000;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Mouth shapes for every frame of a mono voice signal.
 * `quietDb`..`loudDb` maps RMS to level 0–1 (voice clips are levelled to about −20 LUFS before mixing).
 */
export function mouthTrack(samples: Float32Array, rate: number, fps: number, o: { quietDb?: number; loudDb?: number } = {}): MouthTrack {
  const frames = Math.max(1, Math.ceil((samples.length / rate) * fps));
  const level = new Float32Array(frames);
  const open = new Float32Array(frames);
  const wide = new Float32Array(frames);
  const round = new Float32Array(frames);
  const quiet = o.quietDb ?? -48;
  const loud = o.loudDb ?? -16;
  const half = Math.max(8, Math.round((rate / fps) * 0.75)); // window ≈ 1.5 frames, centred on the frame
  // one-pole low-pass at ~500 Hz for the "round" measure
  const a = Math.exp((-2 * Math.PI * 500) / rate);
  let prevOpen = 0;
  for (let k = 0; k < frames; k++) {
    const c = Math.round((k / fps) * rate);
    const s0 = Math.max(0, c - half);
    const s1 = Math.min(samples.length, c + half);
    let sum = 0;
    let low = 0;
    let lp = 0;
    let zc = 0;
    let prev = samples[s0] ?? 0;
    for (let i = s0; i < s1; i++) {
      const x = samples[i];
      sum += x * x;
      lp = (1 - a) * x + a * lp;
      low += lp * lp;
      if ((x >= 0) !== (prev >= 0)) zc++;
      prev = x;
    }
    const n = Math.max(1, s1 - s0);
    const rms = Math.sqrt(sum / n);
    const db = rms > 0 ? 20 * Math.log10(rms) : -120;
    const lv = clamp01((db - quiet) / (loud - quiet));
    level[k] = lv;
    // the jaw: opens fast, closes a little slower (lips do not snap shut between syllables), shut in pauses
    const target = lv < 0.06 ? 0 : Math.pow(lv, 0.85);
    const next = target > prevOpen ? prevOpen + (target - prevOpen) * 0.75 : prevOpen + (target - prevOpen) * 0.45;
    open[k] = next < 0.01 ? 0 : next;
    prevOpen = open[k];
    if (lv > 0.06) {
      const zcr = zc / n; // crossings per sample
      wide[k] = clamp01((zcr * (rate / 16_000) - 0.06) / 0.18);
      const ratio = sum > 0 ? low / sum : 0;
      round[k] = clamp01((ratio - 0.72) / 0.22) * (1 - wide[k]);
    }
  }
  return { fps, level, open, wide, round };
}

/** The reel's voice-over alone (no music or sound effects), placed at each step's cue, at `rate`. */
export function reelVoiceTrack(reel: MotionReel, clips: VoiceClips | null | undefined, rate = TRACK_RATE, only?: (cueT: number) => boolean): Float32Array<ArrayBuffer> {
  const out = new Float32Array(Math.ceil((reel.durationMs / 1000) * rate));
  if (!clips?.size) return out;
  for (const c of reelVoiceCues(reel)) {
    if (only && !only(c.t)) continue;
    const raw = clips.get(c.say);
    if (!raw) continue;
    const clip = rate === SFX_RATE ? raw : resample(raw, SFX_RATE, rate);
    const at = Math.round((c.t / 1000) * rate);
    for (let i = 0; i < clip.length && at + i < out.length; i++) out[at + i] += clip[i];
  }
  return out;
}

/** Mouth shapes for every frame of a reel (null when the reel has no voice: the mouth stays closed). */
export function reelMouthTrack(reel: MotionReel, clips: VoiceClips | null | undefined, fps = 30, only?: (cueT: number) => boolean): MouthTrack | null {
  if (!clips?.size) return null;
  return mouthTrack(reelVoiceTrack(reel, clips, TRACK_RATE, only), TRACK_RATE, fps);
}

/** V51.9.101: [start, end) of the reel's parts in a group (e.g. 'duet-ask'), in reel time. */
export function groupRanges(reel: MotionReel, group: string): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let t = 0;
  for (const p of reel.parts) { if (p.group === group) out.push([t, t + p.durationMs]); t += p.durationMs; }
  return out;
}

/** The mouth at reel time t (linear between frames, so a 60 fps preview of a 30 fps track is smooth). */
export function mouthAt(track: MouthTrack | null | undefined, tMs: number): MouthState {
  if (!track || !track.open.length) return CLOSED;
  const x = (tMs / 1000) * track.fps;
  const i = Math.floor(x);
  if (i < 0) return CLOSED;
  if (i >= track.open.length - 1) {
    const j = track.open.length - 1;
    return i > j ? CLOSED : { level: track.level[j], open: track.open[j], wide: track.wide[j], round: track.round[j] };
  }
  const f = x - i;
  const mix = (arr: Float32Array) => arr[i] * (1 - f) + arr[i + 1] * f;
  return { level: mix(track.level), open: mix(track.open), wide: mix(track.wide), round: mix(track.round) };
}

/** Deterministic pseudo-random 0–1 for blink n (same blinks in the preview and the MP4). */
const rand = (n: number, seed: number) => {
  let h = (n * 374761393 + seed * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

export const BLINK_MS = 170;

/** How closed the eyes are at t (0 open … 1 shut): a short blink every 2.6–5 s, now and then a double blink. */
export function blinkAt(tMs: number, seed = 1): number {
  if (tMs < 0) return 0;
  let at = 900 + rand(0, seed) * 1500;
  for (let n = 1; at <= tMs + BLINK_MS; n++) {
    const d = tMs - at;
    if (d >= 0 && d < BLINK_MS) return 1 - Math.abs(d / (BLINK_MS / 2) - 1);
    at += rand(n, seed) < 0.12 ? BLINK_MS + 120 : 2600 + rand(n + 7919, seed) * 2400;
  }
  return 0;
}

/** A made-up "ma-ba-ee-oo" voice, 4 s, for previews before there is a real voice. */
export function demoMouthTrack(): MouthTrack {
  const rate = 16_000;
  const s = new Float32Array(rate * 4);
  const syll = [0.15, 0.45, 0.8, 1.15, 1.6, 1.9, 2.3, 2.75, 3.1];
  for (let i = 0; i < s.length; i++) {
    const t = i / rate;
    let env = 0;
    for (const c of syll) env = Math.max(env, Math.exp(-(((t - c) / 0.09) ** 2)));
    const f = t > 2.3 ? 3000 : 180; // the last syllables are "ee"/"s"-like (many crossings)
    s[i] = 0.25 * env * Math.sin(2 * Math.PI * f * t);
  }
  return mouthTrack(s, rate, 30);
}
