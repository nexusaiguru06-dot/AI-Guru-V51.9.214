/**
 * V51.9.97 — self-check of a finished video, before anyone shares it.
 *
 * The browser half (self-check-browser.ts) opens the MP4 that was just made, reads its
 * length, decodes its sound and grabs small frames across it; this half (pure, tested)
 * decides what is wrong:
 *   - length differs from the reel                → error
 *   - no sound track / the whole video is silent  → error
 *   - a step's voice is missing                   → error ("Voice missing at 0:12")
 *   - a blank stretch (one flat colour)           → error
 *   - picture frozen for a long time              → warning
 *   - long silence in the middle, clipping, too quiet / too loud → warning
 */

import { gainToDb, integratedLufs, peakOf } from './loudness';

export type ProblemKind = 'duration' | 'no-audio' | 'silent' | 'voice-missing' | 'blank' | 'frozen' | 'gap' | 'clipping' | 'quiet' | 'loud';

export interface CheckProblem {
  kind: ProblemKind;
  severity: 'error' | 'warn';
  atMs?: number;
  message: string;
}

export interface ReelCheck {
  /** False when the browser could not open the file to check it (the video itself may be fine). */
  checked: boolean;
  /** No errors (warnings allowed). */
  ok: boolean;
  reason?: string;
  durationMs?: number;
  lufs?: number;
  peakDb?: number;
  /** True when the sound was checked from the decoded file; false when from the mix before encoding. */
  audioFromFile?: boolean;
  frames?: number;
  problems: CheckProblem[];
}

export interface CheckExpect {
  durationMs: number;
  /** The file should carry a sound track. */
  audio: boolean;
  /** Where a voice should be speaking: [start, end] in ms. */
  voices: Array<[number, number]>;
  /** Steps that should speak but have no voice clip at all (on-screen times, ms). */
  unvoiced?: number[];
}

export const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const rmsDb = (x: Float32Array, a: number, b: number) => {
  let s = 0;
  const n = Math.max(1, b - a);
  for (let i = a; i < b; i++) s += x[i] * x[i];
  return 10 * Math.log10(s / n || 1e-12);
};

/* ---------------- length ---------------- */

export function checkDuration(actualMs: number, expect: CheckExpect): CheckProblem[] {
  if (!Number.isFinite(actualMs) || actualMs <= 0) return [{ kind: 'duration', severity: 'error', message: 'The video has no length — it did not finish writing.' }];
  const diff = Math.abs(actualMs - expect.durationMs);
  if (diff > Math.max(500, expect.durationMs * 0.02)) {
    return [{ kind: 'duration', severity: 'error', message: `The video is ${(actualMs / 1000).toFixed(1)} s but should be ${(expect.durationMs / 1000).toFixed(1)} s.` }];
  }
  return [];
}

/* ---------------- sound ---------------- */

export interface AudioFindings {
  problems: CheckProblem[];
  lufs: number;
  peakDb: number;
}

/** `samples` mono at `rate`; null when the file has no sound track. */
export function checkAudio(samples: Float32Array | null, rate: number, expect: CheckExpect): AudioFindings {
  const problems: CheckProblem[] = [];
  if (!expect.audio) return { problems, lufs: -Infinity, peakDb: -Infinity };
  if (!samples || !samples.length) {
    problems.push({ kind: 'no-audio', severity: 'error', message: 'The video has no sound track.' });
    return { problems, lufs: -Infinity, peakDb: -Infinity };
  }
  const peakDb = gainToDb(peakOf(samples));
  const lufs = integratedLufs(samples, rate);
  if (peakDb < -50) {
    problems.push({ kind: 'silent', severity: 'error', message: 'The video is silent — no voice or music came through.' });
    return { problems, lufs, peakDb };
  }
  // each voice cue must actually carry sound (middle 80 % of the cue, so ramps do not count)
  // A cue counts as missing when it is near-silent, or far quieter than the other voice steps
  // (then only the ducked music is playing there: the clip itself was empty).
  const missing: number[] = [];
  const levels: Array<[number, number]> = [];
  for (const [a, b] of expect.voices) {
    if (b - a < 300) continue;
    const pad = (b - a) * 0.1;
    const s0 = Math.floor(((a + pad) / 1000) * rate), s1 = Math.min(samples.length, Math.ceil(((b - pad) / 1000) * rate));
    if (s1 - s0 < rate * 0.1) { if (s0 >= samples.length) missing.push(a); continue; }
    levels.push([a, rmsDb(samples, s0, s1)]);
  }
  const sorted = levels.map((l) => l[1]).sort((x, y) => x - y);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  for (const [a, db] of levels) if (db < -45 || (levels.length >= 3 && db < median - 14)) missing.push(a);
  for (const t of expect.unvoiced ?? []) missing.push(t);
  missing.sort((x, y) => x - y);
  if (missing.length) {
    const list = missing.slice(0, 4).map(clock).join(', ') + (missing.length > 4 ? ` and ${missing.length - 4} more` : '');
    problems.push({ kind: 'voice-missing', severity: 'error', atMs: missing[0], message: `Voice missing at ${list}.` });
  }
  // long silence in the middle (the first and last second may be quiet)
  const win = Math.round(0.25 * rate);
  let quietFrom = -1;
  let longest = 0, longestAt = 0;
  const start = rate, stop = samples.length - rate;
  for (let i = start; i + win <= stop; i += win) {
    if (rmsDb(samples, i, i + win) < -55) {
      if (quietFrom < 0) quietFrom = i;
      const len = i + win - quietFrom;
      if (len > longest) { longest = len; longestAt = quietFrom; }
    } else quietFrom = -1;
  }
  if (longest > 4 * rate) problems.push({ kind: 'gap', severity: 'warn', atMs: (longestAt / rate) * 1000, message: `${(longest / rate).toFixed(0)} s of silence from ${clock((longestAt / rate) * 1000)}.` });
  let hot = 0;
  for (let i = 0; i < samples.length; i++) if (Math.abs(samples[i]) >= 0.995) hot++;
  if (hot > samples.length * 0.001) problems.push({ kind: 'clipping', severity: 'warn', message: 'The sound is distorted in places (too loud).' });
  if (Number.isFinite(lufs) && lufs < -24) problems.push({ kind: 'quiet', severity: 'warn', message: `The sound is quiet (${lufs.toFixed(0)} LUFS); phones will play it softly.` });
  if (Number.isFinite(lufs) && lufs > -9) problems.push({ kind: 'loud', severity: 'warn', message: `The sound is very loud (${lufs.toFixed(0)} LUFS).` });
  return { problems, lufs, peakDb };
}

/* ---------------- picture ---------------- */

export interface FrameSample {
  t: number;
  /** Spread of brightness (0–255 scale). A flat, one-colour frame is near 0. */
  spread: number;
  /** Tiny grey thumbnail (e.g. 32 × 18) to compare frames. */
  sig: Float32Array;
}

export const SIG_W = 32;
export const SIG_H = 18;

/** RGBA pixels → FrameSample (pure, so tests can feed it made-up frames). */
export function frameSample(t: number, rgba: Uint8ClampedArray | Uint8Array, width: number, height: number): FrameSample {
  const n = width * height;
  let sum = 0, sq = 0;
  const sig = new Float32Array(SIG_W * SIG_H);
  const cnt = new Float32Array(SIG_W * SIG_H);
  for (let y = 0; y < height; y++) {
    const sy = Math.min(SIG_H - 1, Math.floor((y * SIG_H) / height));
    for (let x = 0; x < width; x++) {
      const p = (y * width + x) * 4;
      const l = 0.2126 * rgba[p] + 0.7152 * rgba[p + 1] + 0.0722 * rgba[p + 2];
      sum += l;
      sq += l * l;
      const k = sy * SIG_W + Math.min(SIG_W - 1, Math.floor((x * SIG_W) / width));
      sig[k] += l;
      cnt[k]++;
    }
  }
  for (let k = 0; k < sig.length; k++) sig[k] = cnt[k] ? sig[k] / cnt[k] : 0;
  const mean = sum / n;
  return { t, spread: Math.sqrt(Math.max(0, sq / n - mean * mean)), sig };
}

const sigDiff = (a: Float32Array, b: Float32Array) => {
  let d = 0;
  for (let i = 0; i < a.length; i++) d += Math.abs(a[i] - b[i]);
  return d / a.length;
};

/** Frames taken evenly across the video, in time order. */
export function checkFrames(frames: FrameSample[], expect: CheckExpect, o: { frozenMs?: number } = {}): CheckProblem[] {
  const problems: CheckProblem[] = [];
  if (!frames.length) return problems;
  // blank: a flat frame, not in the first/last half second (fades)
  const blank = frames.filter((f) => f.spread < 2 && f.t > 500 && f.t < expect.durationMs - 500);
  if (blank.length) {
    const share = blank.length / frames.length;
    problems.push({
      kind: 'blank', severity: 'error', atMs: blank[0].t,
      message: share > 0.8 ? 'The picture is blank — nothing was drawn.' : `Blank picture at ${blank.slice(0, 3).map((f) => clock(f.t)).join(', ')}.`,
    });
  }
  // frozen: the same picture for a long stretch. Board lessons hold still while the voice talks,
  // but the captions move word by word, so a long, truly identical stretch is a stuck video.
  const frozenMs = o.frozenMs ?? 8000;
  let from = 0;
  let worst: [number, number] | null = null;
  for (let i = 1; i <= frames.length; i++) {
    const same = i < frames.length && sigDiff(frames[i].sig, frames[i - 1].sig) < 0.4;
    if (!same) {
      const span = frames[i - 1].t - frames[from].t;
      if (span >= frozenMs && (!worst || span > worst[1] - worst[0])) worst = [frames[from].t, frames[i - 1].t];
      from = i;
    }
  }
  if (worst) {
    const whole = worst[1] - worst[0] >= expect.durationMs * 0.9 && frames.length > 2;
    problems.push({
      kind: 'frozen', severity: whole ? 'error' : 'warn', atMs: worst[0],
      message: whole ? 'The picture never moves — the video looks stuck.' : `The picture does not change from ${clock(worst[0])} to ${clock(worst[1])}.`,
    });
  }
  return problems;
}

/** Times (ms) to sample frames at: about one a second, at most `max`, never the very first or last frame. */
export function frameTimes(durationMs: number, max = 90): number[] {
  if (durationMs <= 0) return [];
  const n = Math.max(2, Math.min(max, Math.round(durationMs / 1000)));
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(Math.round(((i + 0.5) / n) * durationMs));
  return out;
}

export function finishCheck(parts: { durationMs?: number; lufs?: number; peakDb?: number; frames?: number; audioFromFile?: boolean; problems: CheckProblem[] }): ReelCheck {
  const problems = [...parts.problems].sort((a, b) => (a.severity === b.severity ? (a.atMs ?? 0) - (b.atMs ?? 0) : a.severity === 'error' ? -1 : 1));
  return { checked: true, ok: !problems.some((p) => p.severity === 'error'), ...parts, problems };
}

/** One line for a notice: "Checked ✓ 42.3 s · sound −14 LUFS" or "⚠ Voice missing at 0:12. …" */
export function checkSummary(c: ReelCheck | undefined | null): string {
  if (!c) return '';
  if (!c.checked) return `Not checked (${c.reason ?? 'this browser could not open the file'}).`;
  const errors = c.problems.filter((p) => p.severity === 'error');
  const warns = c.problems.filter((p) => p.severity === 'warn');
  if (errors.length) return `⚠ Problem found: ${errors.map((p) => p.message).join(' ')}${warns.length ? ` Also: ${warns.map((p) => p.message).join(' ')}` : ''}`;
  const sound = c.lufs !== undefined && Number.isFinite(c.lufs) ? ` · sound ${Math.round(c.lufs)} LUFS` : '';
  const base = `Checked ✓ ${c.durationMs !== undefined ? `${(c.durationMs / 1000).toFixed(1)} s` : ''}${sound}`;
  return warns.length ? `${base} · note: ${warns.map((p) => p.message).join(' ')}` : base;
}
