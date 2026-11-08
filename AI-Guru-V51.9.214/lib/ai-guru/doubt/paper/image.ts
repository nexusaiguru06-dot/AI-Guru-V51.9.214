/**
 * V51.9.98 — picture checks for "Show your paper" (pure; the camera code feeds it pixels).
 *
 * The live camera pane sends small 1024×768 frames twice a second, which is fine to see a
 * page but too soft to READ handwriting. For a paper we take one sharp still at the
 * camera's full resolution instead, and only when the paper is held steady and in focus:
 *   - sharpness  = variance of the Laplacian on a small grey copy (blur → low)
 *   - brightness = mean grey level (too dark → ask for light)
 *   - steadiness = how much the small grey copy changed since the last look
 * Then a gentle clean-up (levels stretched between the 1st and 99th percentile) so pencil
 * on off-white paper reads clearly, without changing colours of pens and diagrams.
 */

export interface Grey {
  w: number;
  h: number;
  /** 0–255 */
  px: Float32Array;
}

/** RGBA → small grey image (box-averaged down to at most `maxW` wide). */
export function toGrey(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number, maxW = 160): Grey {
  const f = Math.max(1, Math.ceil(width / maxW));
  const w = Math.max(1, Math.floor(width / f));
  const h = Math.max(1, Math.floor(height / f));
  const px = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let dy = 0; dy < f; dy++) {
        const row = (y * f + dy) * width;
        for (let dx = 0; dx < f; dx++) {
          const p = (row + x * f + dx) * 4;
          s += 0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2];
        }
      }
      px[y * w + x] = s / (f * f);
    }
  }
  return { w, h, px };
}

/** Variance of the 4-neighbour Laplacian — the usual focus measure. */
export function sharpness(g: Grey): number {
  const { w, h, px } = g;
  if (w < 3 || h < 3) return 0;
  let sum = 0, sq = 0, n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const l = px[i - 1] + px[i + 1] + px[i - w] + px[i + w] - 4 * px[i];
      sum += l;
      sq += l * l;
      n++;
    }
  }
  const mean = sum / n;
  return sq / n - mean * mean;
}

export function brightness(g: Grey): number {
  let s = 0;
  for (let i = 0; i < g.px.length; i++) s += g.px[i];
  return s / g.px.length;
}

/** Mean absolute difference (0–255) between two grey images of the same size; Infinity if sizes differ. */
export function motion(a: Grey | null, b: Grey): number {
  if (!a || a.w !== b.w || a.h !== b.h) return Infinity;
  let d = 0;
  for (let i = 0; i < a.px.length; i++) d += Math.abs(a.px[i] - b.px[i]);
  return d / a.px.length;
}

export interface FrameLook {
  sharp: number;
  bright: number;
  moved: number;
}

export type Readiness = 'dark' | 'moving' | 'blurry' | 'ready';

/** Thresholds tuned on 160-px-wide copies of phone-camera pages. */
export const LIMITS = { dark: 55, moving: 4, sharp: 60 };

export function readiness(f: FrameLook): Readiness {
  if (f.bright < LIMITS.dark) return 'dark';
  if (f.moved > LIMITS.moving) return 'moving';
  if (f.sharp < LIMITS.sharp) return 'blurry';
  return 'ready';
}

/**
 * Auto-capture: the page must be "ready" for `holdMs` in a row (checked every few hundred ms).
 * Returns the new streak start (or null) and whether to take the photo now.
 */
export function steadyStep(state: { since: number | null }, r: Readiness, now: number, holdMs = 1200): { since: number | null; fire: boolean } {
  if (r !== 'ready') return { since: null, fire: false };
  const since = state.since ?? now;
  return { since, fire: now - since >= holdMs };
}

export const READINESS_TEXT: Record<Readiness, { en: string; ml: string }> = {
  dark: { en: 'Too dark — move to the light', ml: 'ഇരുട്ടാണ് — വെളിച്ചത്തിലേക്ക് മാറൂ' },
  moving: { en: 'Hold the paper still…', ml: 'പേപ്പർ അനങ്ങാതെ പിടിക്കൂ…' },
  blurry: { en: 'Not sharp — move the paper a little farther', ml: 'വ്യക്തമല്ല — പേപ്പർ അൽപ്പം അകലെ പിടിക്കൂ' },
  ready: { en: 'Good — hold still', ml: 'ശരി — അനങ്ങാതെ പിടിക്കൂ' },
};

/** Long side at most `max` px (keeps the shape: no squashing 16:9 into 4:3). */
export function fitSize(w: number, h: number, max = 2048): { w: number; h: number } {
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

/**
 * Gentle clean-up in place: stretch the levels between the 1st and 99th percentile of
 * brightness (same stretch on R, G, B, so ink colours stay), with a little lift so paper
 * turns white. Does nothing to an image that already uses the full range.
 */
export function cleanUp(rgba: Uint8ClampedArray, width: number, height: number): { lo: number; hi: number } {
  const hist = new Uint32Array(256);
  const n = width * height;
  const step = Math.max(1, Math.floor(n / 200_000)); // sample big images
  let count = 0;
  for (let i = 0; i < n; i += step) {
    const p = i * 4;
    hist[Math.round(0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2])]++;
    count++;
  }
  const pick = (q: number) => {
    let acc = 0;
    for (let v = 0; v < 256; v++) {
      acc += hist[v];
      if (acc >= q * count) return v;
    }
    return 255;
  };
  const lo = pick(0.01);
  const hi = pick(0.99);
  if (hi - lo < 40 || (lo <= 5 && hi >= 250)) return { lo, hi }; // flat or already full range
  const top = Math.max(lo + 32, hi - 8); // a touch below the paper level, so the paper becomes white
  const scale = 255 / Math.max(1, top - lo);
  const lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) lut[v] = Math.round((v - lo) * scale);
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    rgba[p] = lut[rgba[p]];
    rgba[p + 1] = lut[rgba[p + 1]];
    rgba[p + 2] = lut[rgba[p + 2]];
  }
  return { lo, hi };
}
