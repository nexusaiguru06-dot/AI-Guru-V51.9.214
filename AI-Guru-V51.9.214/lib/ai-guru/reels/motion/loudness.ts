/**
 * V51.9.97 — even loudness for every reel and class video.
 *
 * Loudness is measured the way broadcasters and the big video apps measure it
 * (ITU-R BS.1770 / EBU R128: K-weighting, 400 ms blocks with 75 % overlap,
 * −70 LUFS absolute gate and −10 LU relative gate), then the whole soundtrack is
 * moved to one target and its peaks are held under a ceiling by a look-ahead
 * limiter. So a reel voiced by Edge, Piper or Google sounds as loud as the
 * next one, and close to what Instagram / YouTube play at (about −14 LUFS).
 *
 * Pure (no Web Audio): the browser export, live playback and tests share it.
 * Written for AI Guru from the published standard; no third-party code.
 */

export const REEL_LUFS = -14;
/** Each voice clip is levelled to this before mixing, so voices from different engines match. */
export const VOICE_LUFS = -20;
export const CEILING_DB = -1;

const dbToGain = (db: number) => Math.pow(10, db / 20);
export const gainToDb = (g: number) => (g > 0 ? 20 * Math.log10(g) : -Infinity);

interface Biquad { b0: number; b1: number; b2: number; a1: number; a2: number }

/** The two K-weighting filters (high shelf + high pass) for any sample rate. */
export function kWeightingFilters(rate: number): [Biquad, Biquad] {
  // Stage 1: high shelf (+4 dB above ~1.7 kHz, the head's effect)
  const G = 3.999843853973347, f0 = 1681.974450955533, Q = 0.7071752369554196;
  const K = Math.tan((Math.PI * f0) / rate);
  const Vh = Math.pow(10, G / 20);
  const Vb = Math.pow(Vh, 0.4996667741545416);
  const a0 = 1 + K / Q + K * K;
  const shelf: Biquad = {
    b0: (Vh + (Vb * K) / Q + K * K) / a0,
    b1: (2 * (K * K - Vh)) / a0,
    b2: (Vh - (Vb * K) / Q + K * K) / a0,
    a1: (2 * (K * K - 1)) / a0,
    a2: (1 - K / Q + K * K) / a0,
  };
  // Stage 2: high pass (~38 Hz, the RLB curve)
  const f1 = 38.13547087602444, Q1 = 0.5003270373238773;
  const K1 = Math.tan((Math.PI * f1) / rate);
  const a01 = 1 + K1 / Q1 + K1 * K1;
  const hp: Biquad = { b0: 1, b1: -2, b2: 1, a1: (2 * (K1 * K1 - 1)) / a01, a2: (1 - K1 / Q1 + K1 * K1) / a01 };
  return [shelf, hp];
}

function runBiquad(x: Float32Array, f: Biquad): Float32Array {
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i];
    const o = f.b0 * v + f.b1 * x1 + f.b2 * x2 - f.a1 * y1 - f.a2 * y2;
    x2 = x1; x1 = v; y2 = y1; y1 = o;
    y[i] = o;
  }
  return y;
}

const blockLoudness = (meanSquare: number) => -0.691 + 10 * Math.log10(meanSquare);

/**
 * Integrated loudness (LUFS) of a mono signal. −Infinity for silence.
 * Clips shorter than one 400 ms block are measured as a single block.
 */
export function integratedLufs(samples: Float32Array, rate: number): number {
  if (!samples.length) return -Infinity;
  const [shelf, hp] = kWeightingFilters(rate);
  const k = runBiquad(runBiquad(samples, shelf), hp);
  // prefix sums of squares → any block's mean square in O(1)
  const pre = new Float64Array(k.length + 1);
  for (let i = 0; i < k.length; i++) pre[i + 1] = pre[i] + k[i] * k[i];
  const block = Math.round(0.4 * rate);
  const step = Math.round(0.1 * rate);
  const ms: number[] = [];
  if (k.length <= block) ms.push(pre[k.length] / k.length);
  else for (let s = 0; s + block <= k.length; s += step) ms.push((pre[s + block] - pre[s]) / block);
  const abs = ms.filter((m) => m > 0 && blockLoudness(m) > -70);
  if (!abs.length) return -Infinity;
  const rel = blockLoudness(abs.reduce((a, b) => a + b, 0) / abs.length) - 10;
  const gated = abs.filter((m) => blockLoudness(m) > rel);
  if (!gated.length) return -Infinity;
  return blockLoudness(gated.reduce((a, b) => a + b, 0) / gated.length);
}

export function peakOf(samples: Float32Array): number {
  let p = 0;
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i]);
    if (a > p) p = a;
  }
  return p;
}

/**
 * Look-ahead peak limiter, in place: no sample ends above `ceiling`.
 * The gain starts dipping `lookMs` before a peak (no click) and recovers over `releaseMs`.
 * O(n) (sliding minimum + running average), so a 20-minute class is fine.
 */
export function limitPeaks(buf: Float32Array, rate: number, ceiling = dbToGain(CEILING_DB), lookMs = 5, releaseMs = 120): void {
  const n = buf.length;
  if (!n || peakOf(buf) <= ceiling) return;
  const L = Math.max(1, Math.round((lookMs / 1000) * rate));
  const need = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.abs(buf[i]);
    need[i] = a > ceiling ? ceiling / a : 1;
  }
  // m[i] = min(need[i .. i+L]) — sliding window minimum with a deque of indices
  const m = new Float32Array(n);
  const dq = new Int32Array(n + L + 1);
  let head = 0, tail = 0;
  let j = 0;
  for (let i = 0; i < n; i++) {
    const end = Math.min(n - 1, i + L);
    for (; j <= end; j++) {
      while (tail > head && need[dq[tail - 1]] >= need[j]) tail--;
      dq[tail++] = j;
    }
    while (dq[head] < i) head++;
    m[i] = need[dq[head]];
  }
  // average of m over the last L samples: a smooth ramp that is still ≤ the need at every peak
  const g = new Float32Array(n);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += m[i];
    if (i >= L) sum -= m[i - L];
    g[i] = sum / Math.min(i + 1, L);
  }
  const rel = 1 - Math.exp(-1 / ((releaseMs / 1000) * rate));
  let cur = 1;
  for (let i = 0; i < n; i++) {
    cur = cur + (1 - cur) * rel; // recover toward 1
    if (g[i] < cur) cur = g[i]; // never above what this sample needs
    buf[i] *= Math.min(cur, need[i]); // the min() is a final guard against any rounding overshoot
  }
}

export interface LoudnessResult {
  /** Loudness before and after (LUFS); −Infinity when silent. */
  before: number;
  after: number;
  gainDb: number;
  peakDb: number;
}

/**
 * Moves a soundtrack to `target` LUFS (in place) and holds its peaks under `ceilingDb`.
 * Silence is left alone; the boost is capped so a near-silent track is not blown up into hiss.
 */
export function normaliseLoudness(
  buf: Float32Array,
  rate: number,
  o: { target?: number; ceilingDb?: number; maxBoostDb?: number } = {},
): LoudnessResult {
  const target = o.target ?? REEL_LUFS;
  const before = integratedLufs(buf, rate);
  if (!Number.isFinite(before)) return { before, after: before, gainDb: 0, peakDb: gainToDb(peakOf(buf)) };
  const gainDb = Math.max(-30, Math.min(o.maxBoostDb ?? 24, target - before));
  const g = dbToGain(gainDb);
  for (let i = 0; i < buf.length; i++) buf[i] *= g;
  limitPeaks(buf, rate, dbToGain(o.ceilingDb ?? CEILING_DB));
  return { before, after: integratedLufs(buf, rate), gainDb, peakDb: gainToDb(peakOf(buf)) };
}

/**
 * Levels one voice clip to `target` LUFS without clipping it: the gain is the smaller of
 * "reach the target" and "peak at 0.95". Different TTS engines then sound equally loud.
 */
export function levelClip(clip: Float32Array, rate: number, target = VOICE_LUFS): Float32Array {
  const l = integratedLufs(clip, rate);
  const peak = peakOf(clip);
  if (!Number.isFinite(l) || peak === 0) return clip;
  const g = Math.min(dbToGain(target - l), 0.95 / peak);
  for (let i = 0; i < clip.length; i++) clip[i] *= g;
  return clip;
}
