'use client';

/**
 * V51.9.97 — opens a freshly made MP4 in the browser and checks it (see self-check.ts):
 * length from a <video> element, sound decoded from the file itself, small frames
 * grabbed across the video. Never throws: if the browser cannot open the file, the
 * result says "not checked" and the video is still handed over.
 */

import { checkAudio, checkDuration, checkFrames, finishCheck, frameSample, frameTimes, type CheckExpect, type CheckProblem, type FrameSample, type ReelCheck } from './self-check';

const THUMB_W = 96;

function once(el: HTMLMediaElement, ok: string, ms: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { cleanup(); reject(new Error(`timed out waiting for ${ok}`)); }, ms);
    const done = () => { cleanup(); resolve(); };
    const fail = () => { cleanup(); reject(new Error(el.error?.message || 'the browser could not open the video')); };
    const cleanup = () => { clearTimeout(timer); el.removeEventListener(ok, done); el.removeEventListener('error', fail); };
    el.addEventListener(ok, done);
    el.addEventListener('error', fail);
  });
}

async function readFrames(url: string, durationHintMs: number, onProgress?: (p: number) => void, signal?: AbortSignal): Promise<{ durationMs: number; frames: FrameSample[] }> {
  const v = document.createElement('video');
  v.muted = true;
  v.playsInline = true;
  v.preload = 'auto';
  v.src = url;
  try {
    if (v.readyState < 1) await once(v, 'loadedmetadata', 15000);
    const durationMs = v.duration * 1000;
    const w = THUMB_W;
    const h = Math.max(1, Math.round((THUMB_W * (v.videoHeight || 9)) / (v.videoWidth || 16)));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return { durationMs, frames: [] };
    const times = frameTimes(Number.isFinite(durationMs) && durationMs > 0 ? durationMs : durationHintMs);
    const frames: FrameSample[] = [];
    for (let i = 0; i < times.length; i++) {
      if (signal?.aborted) break;
      const seek = once(v, 'seeked', 5000);
      v.currentTime = times[i] / 1000;
      await seek;
      ctx.drawImage(v, 0, 0, w, h);
      frames.push(frameSample(times[i], ctx.getImageData(0, 0, w, h).data, w, h));
      onProgress?.((i + 1) / times.length);
    }
    return { durationMs, frames };
  } finally {
    v.removeAttribute('src');
    v.load();
  }
}

async function decodeSound(blob: Blob): Promise<{ samples: Float32Array; rate: number } | null> {
  const Ctx = (globalThis as { OfflineAudioContext?: typeof OfflineAudioContext }).OfflineAudioContext;
  if (!Ctx) throw new Error('no audio decoder');
  const ctx = new Ctx(1, 1, 48000);
  let buf: AudioBuffer;
  try {
    buf = await ctx.decodeAudioData(await blob.arrayBuffer());
  } catch (e) {
    throw new Error(`could not decode the sound (${(e as Error).message || 'unknown'})`);
  }
  if (!buf.length) return null;
  // mono mix-down
  const out = new Float32Array(buf.length);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const ch = buf.getChannelData(c);
    for (let i = 0; i < out.length; i++) out[i] += ch[i] / buf.numberOfChannels;
  }
  return { samples: out, rate: buf.sampleRate };
}

/**
 * Checks the MP4. `mix` (the soundtrack as it was encoded) is used for the sound
 * checks when this browser cannot decode the file's sound track.
 */
export async function checkReelVideo(
  blob: Blob,
  expect: CheckExpect,
  o: { mix?: { samples: Float32Array; rate: number } | null; onProgress?: (p: number) => void; signal?: AbortSignal } = {},
): Promise<ReelCheck> {
  if (typeof document === 'undefined') return { checked: false, ok: true, reason: 'not in a browser', problems: [] };
  const url = URL.createObjectURL(blob);
  try {
    const problems: CheckProblem[] = [];
    let durationMs: number | undefined;
    let frameCount = 0;
    try {
      const r = await readFrames(url, expect.durationMs, (p) => o.onProgress?.(0.8 * p), o.signal);
      durationMs = r.durationMs;
      frameCount = r.frames.length;
      problems.push(...checkDuration(r.durationMs, expect), ...checkFrames(r.frames, expect));
    } catch (e) {
      return { checked: false, ok: true, reason: (e as Error).message, problems: [] };
    }
    let sound: { samples: Float32Array; rate: number } | null = null;
    let fromFile = false;
    if (expect.audio) {
      try {
        sound = await decodeSound(blob);
        fromFile = true;
      } catch {
        sound = o.mix ?? null; // fall back to the mix that went into the encoder
        if (!sound) problems.push({ kind: 'no-audio', severity: 'warn', message: 'The sound could not be checked in this browser.' });
      }
    }
    o.onProgress?.(0.9);
    const a = expect.audio && (sound || fromFile) ? checkAudio(sound?.samples ?? null, sound?.rate ?? 48000, expect) : null;
    if (a) problems.push(...a.problems);
    o.onProgress?.(1);
    return finishCheck({
      durationMs,
      frames: frameCount,
      lufs: a && Number.isFinite(a.lufs) ? a.lufs : undefined,
      peakDb: a && Number.isFinite(a.peakDb) ? a.peakDb : undefined,
      audioFromFile: expect.audio ? fromFile : undefined,
      problems,
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
