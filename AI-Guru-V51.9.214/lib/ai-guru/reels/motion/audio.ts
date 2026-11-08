/**
 * Final soundtrack of a reel: sound design + music bed, ducked under the
 * voice-over, with each step's voice clip placed at its cue.
 * Pure (no Web Audio), so the browser export and the Node renderer share it.
 */

import { reelSfx, reelVoiceCues, type MotionReel } from './reel';
import { renderSfx, SFX_RATE, softLimit, type MusicKind, type SfxPack } from './sfx';
import { levelClip, normaliseLoudness, REEL_LUFS, type LoudnessResult } from './loudness';

/** Spoken text → mono samples at `rate`. */
export type VoiceClips = Map<string, Float32Array>;

export function mixReelAudio(
  reel: MotionReel,
  clips: VoiceClips | null | undefined,
  o: {
    rate?: number;
    music?: boolean;
    /** V51.9.101: music bed and sound-effect pack. */
    musicKind?: MusicKind;
    pack?: SfxPack;
    voiceGain?: number;
    /** Target loudness in LUFS (default −14, what Instagram / YouTube play at); false keeps the raw mix. V51.9.97. */
    loudness?: number | false;
    /** Filled with the loudness measured before and after levelling. */
    report?: Partial<LoudnessResult>;
  } = {},
): Float32Array<ArrayBuffer> {
  const rate = o.rate ?? SFX_RATE;
  const cues = clips?.size ? reelVoiceCues(reel).filter((c) => clips.has(c.say)) : [];
  const out = renderSfx(reelSfx(reel), reel.durationMs, {
    rate,
    music: o.music,
    musicKind: o.musicKind,
    pack: o.pack,
    duck: cues.map((c) => [c.t, c.t + c.ms] as [number, number]),
    limit: false,
  });
  const gain = o.voiceGain ?? 1;
  for (const c of cues) {
    // Clips are stored at 48 kHz; a lighter mix (e.g. 24 kHz for live playback) resamples them.
    const raw = clips!.get(c.say)!;
    const clip = rate === SFX_RATE ? raw : resample(raw, SFX_RATE, rate);
    const at = Math.round((c.t / 1000) * rate);
    for (let i = 0; i < clip.length && at + i < out.length; i++) out[at + i] += clip[i] * gain;
  }
  softLimit(out);
  if (o.loudness !== false) {
    const r = normaliseLoudness(out, rate, { target: o.loudness ?? REEL_LUFS });
    if (o.report) Object.assign(o.report, r);
  }
  return out;
}

/**
 * Trim leading/trailing silence so steps are timed to real speech, then level the clip
 * to one loudness (V51.9.97; it was peak-normalised before, so engines sounded uneven).
 */
export function prepareClip(samples: Float32Array, rate: number, threshold = 0.01): Float32Array {
  let a = 0;
  let b = samples.length - 1;
  while (a < b && Math.abs(samples[a]) < threshold) a++;
  while (b > a && Math.abs(samples[b]) < threshold) b--;
  const pad = Math.round(0.04 * rate);
  const s = samples.slice(Math.max(0, a - pad), Math.min(samples.length, b + pad));
  return levelClip(s, rate);
}

/** Linear resample (voices arrive at 22.05/24 kHz, reels are mixed at 48 kHz). */
export function resample(samples: Float32Array, from: number, to: number = SFX_RATE): Float32Array {
  if (from === to) return samples;
  const n = Math.round((samples.length * to) / from);
  const out = new Float32Array(n);
  const k = from / to;
  for (let i = 0; i < n; i++) {
    const x = i * k;
    const j = Math.floor(x);
    const f = x - j;
    out[i] = (samples[j] ?? 0) * (1 - f) + (samples[j + 1] ?? samples[j] ?? 0) * f;
  }
  return out;
}

export const clipMs = (samples: Float32Array, rate: number = SFX_RATE) => Math.round((samples.length / rate) * 1000);

/** Mono float samples → 16-bit PCM WAV (for an <audio> element: pitch-preserving speed control). */
export function encodeWav(samples: Float32Array, rate: number): ArrayBuffer {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + samples.length * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) v.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), true);
  return buf;
}
