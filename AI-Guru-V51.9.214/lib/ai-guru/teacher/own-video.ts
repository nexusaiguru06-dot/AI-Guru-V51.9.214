/**
 * V51.9.103 — "Use my own video": a teacher uploads a recording of THEMSELVES (a class video saved from their own
 * YouTube Studio, a clip from their own Instagram, a phone recording) and the app takes from it:
 *   - the best stills for the avatar photo (sharp, well lit, a face-coloured centre) — the teacher picks one;
 *   - the clearest 10–15 seconds of speech for the voice sample;
 *   - optionally the words of that sample (Gemini with the key saved on this computer), so they need not be typed;
 *   - optionally 8 seconds of the video for the AI lip-sync.
 * Everything runs in the browser; nothing is fetched from the web. The consent tick ("my own face and my own voice")
 * still has to be ticked when saving.
 *
 * The scoring functions are pure (tests use them); the browser helpers are below them.
 */

/** Grey value (0–255) of an RGBA pixel. */
const grey = (d: Uint8ClampedArray, i: number) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];

/** Skin-like colour (a broad rule that works across Indian skin tones in normal light). */
export function skinLike(r: number, g: number, b: number): boolean {
  return r > 60 && g > 30 && b > 15 && r > g && r > b && r - Math.min(g, b) > 12 && Math.abs(r - g) > 8 && r - b < 170;
}

export interface FrameScore {
  /** Edge energy (variance of the Laplacian): blurred frames score low. */
  sharp: number;
  /** 1 at mid brightness, falling towards black or white. */
  light: number;
  /** Share of face-coloured pixels in the middle of the frame. */
  face: number;
  total: number;
}

/** Scores one small frame (RGBA, w × h) as a candidate avatar photo. */
export function frameScore(d: Uint8ClampedArray, w: number, h: number): FrameScore {
  let sum = 0, sum2 = 0, n = 0, light = 0, skin = 0, centre = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      const lap = 4 * grey(d, i) - grey(d, i - 4) - grey(d, i + 4) - grey(d, i - w * 4) - grey(d, i + w * 4);
      sum += lap; sum2 += lap * lap; n++;
      light += grey(d, i);
      if (x > w * 0.3 && x < w * 0.7 && y > h * 0.2 && y < h * 0.75) { centre++; if (skinLike(d[i], d[i + 1], d[i + 2])) skin++; }
    }
  }
  const varLap = n ? sum2 / n - (sum / n) ** 2 : 0;
  const mean = n ? light / n : 0;
  const s: FrameScore = { sharp: Math.min(1, varLap / 600), light: Math.max(0, 1 - Math.abs(mean - 125) / 125), face: centre ? skin / centre : 0, total: 0 };
  s.total = s.face < 0.12 ? 0 : 0.45 * s.sharp + 0.2 * s.light + 0.35 * Math.min(1, s.face / 0.5);
  return s;
}

/**
 * The clearest stretch of speech in a recording: the window (`want` seconds, or less if the recording is shorter) with
 * the most speech, the fewest long pauses and no clipping, widened to start and end in a pause.
 * Returns start / end in seconds, or null when there is hardly any speech.
 */
export function bestSpeechWindow(samples: Float32Array, rate: number, want = 12): { start: number; end: number; speech: number } | null {
  const hop = Math.round(rate * 0.03);
  const frames = Math.floor(samples.length / hop);
  if (frames < 10) return null;
  const rms = new Float32Array(frames);
  const clip = new Uint8Array(frames);
  let peak = 0;
  for (let f = 0; f < frames; f++) {
    let s = 0, c = 0;
    for (let i = f * hop; i < (f + 1) * hop; i++) { const v = samples[i]; s += v * v; if (Math.abs(v) > 0.985) c++; }
    rms[f] = Math.sqrt(s / hop);
    clip[f] = c > 2 ? 1 : 0;
    peak = Math.max(peak, rms[f]);
  }
  if (peak < 0.005) return null;
  const sorted = Array.from(rms).sort((a, b) => a - b);
  const floor = sorted[Math.floor(frames * 0.1)];
  const thr = Math.max(floor * 3, peak * 0.12);
  const voiced: number[] = Array.from(rms, (v) => (v > thr ? 1 : 0));
  const win = Math.min(frames, Math.round((want / 0.03)));
  let best = -1, bestAt = 0;
  let v = 0, c = 0;
  for (let f = 0; f < frames; f++) {
    v += voiced[f]; c += clip[f];
    if (f >= win) { v -= voiced[f - win]; c -= clip[f - win]; }
    if (f >= win - 1) {
      const score = v - 8 * c;
      if (score > best) { best = score; bestAt = f - win + 1; }
    }
  }
  const speech = (voiced.slice(bestAt, bestAt + win).reduce((a: number, b: number) => a + b, 0)) / win;
  if (speech < 0.25) return null;
  // start and end inside a pause (up to 0.6 s earlier / later), so no word is cut
  let a = bestAt, b = Math.min(frames - 1, bestAt + win - 1);
  for (let k = 0; k < 20 && a > 0 && voiced[a]; k++) a--;
  for (let k = 0; k < 20 && b < frames - 1 && voiced[b]; k++) b++;
  return { start: (a * hop) / rate, end: ((b + 1) * hop) / rate, speech };
}

/* ---------------- browser helpers ---------------- */

/** Seeks a video to t seconds and waits. */
function seek(v: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    const done = () => { v.removeEventListener('seeked', done); resolve(); };
    v.addEventListener('seeked', done);
    v.currentTime = Math.max(0, Math.min(t, (v.duration || t) - 0.05));
    setTimeout(done, 2500);
  });
}

export interface Candidate { t: number; thumb: string; score: number }

/** Opens a video file and returns the best stills (thumbnails + their times), best first. */
export async function bestStills(file: Blob, o: { count?: number; samples?: number; onProgress?: (p: number) => void } = {}): Promise<{ video: HTMLVideoElement; url: string; duration: number; stills: Candidate[] }> {
  const url = URL.createObjectURL(file);
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
  await new Promise<void>((resolve, reject) => { v.onloadeddata = () => resolve(); v.onerror = () => reject(new Error('This browser could not open that video. Try an MP4 or WebM.')); });
  const duration = Number.isFinite(v.duration) ? v.duration : 0;
  const n = Math.max(1, Math.min(o.samples ?? 36, Math.floor(duration / 0.4)));
  const small = document.createElement('canvas');
  small.width = 96; small.height = 96;
  const sctx = small.getContext('2d', { willReadFrequently: true })!;
  const thumbC = document.createElement('canvas');
  thumbC.width = 160; thumbC.height = 160;
  const tctx = thumbC.getContext('2d')!;
  const out: Candidate[] = [];
  for (let k = 0; k < n; k++) {
    const t = ((k + 0.5) / n) * duration;
    await seek(v, t);
    const side = Math.min(v.videoWidth, v.videoHeight);
    const sx = (v.videoWidth - side) / 2, sy = (v.videoHeight - side) / 2;
    sctx.drawImage(v, sx, sy, side, side, 0, 0, 96, 96);
    const sc = frameScore(sctx.getImageData(0, 0, 96, 96).data, 96, 96);
    if (sc.total > 0) {
      tctx.drawImage(v, sx, sy, side, side, 0, 0, 160, 160);
      out.push({ t, thumb: thumbC.toDataURL('image/jpeg', 0.8), score: sc.total });
    }
    o.onProgress?.((k + 1) / n);
  }
  out.sort((a, b) => b.score - a.score);
  // keep stills at least 1 s apart, so the choices differ
  const picked: Candidate[] = [];
  for (const c of out) if (picked.every((p) => Math.abs(p.t - c.t) > 1)) { picked.push(c); if (picked.length >= (o.count ?? 6)) break; }
  return { video: v, url, duration, stills: picked };
}

/** The full-size frame at t seconds (for the crop editor). */
export async function frameAt(v: HTMLVideoElement, t: number): Promise<{ img: HTMLCanvasElement; w: number; h: number }> {
  await seek(v, t);
  const c = document.createElement('canvas');
  c.width = v.videoWidth; c.height = v.videoHeight;
  c.getContext('2d')!.drawImage(v, 0, 0);
  return { img: c, w: c.width, h: c.height };
}

/** The sound of a video file as mono samples. */
export async function videoAudio(file: Blob): Promise<{ samples: Float32Array; rate: number }> {
  const ctx = new OfflineAudioContext(1, 1, 24_000);
  let buf: AudioBuffer;
  try { buf = await ctx.decodeAudioData(await file.arrayBuffer()); } catch { throw new Error('No sound could be read from this video.'); }
  const mono = new Float32Array(buf.length);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < d.length; i++) mono[i] += d[i] / buf.numberOfChannels; }
  return { samples: mono, rate: buf.sampleRate };
}

/** Records `seconds` of the video from `t` (in real time) as a WebM file, for the AI lip-sync. */
export async function cutClip(v: HTMLVideoElement, t: number, seconds = 8): Promise<File> {
  const cap = (v as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream;
  if (!cap) throw new Error('This browser cannot cut a clip from the video. Upload an 8-second clip instead.');
  await seek(v, t);
  const stream = cap.call(v);
  const rec = new MediaRecorder(new MediaStream(stream.getVideoTracks()), { mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm' });
  const parts: BlobPart[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) parts.push(e.data); };
  const stopped = new Promise<void>((r) => { rec.onstop = () => r(); });
  rec.start();
  await v.play();
  await new Promise((r) => setTimeout(r, Math.min(seconds, Math.max(1, (v.duration || seconds) - t)) * 1000));
  v.pause();
  rec.stop();
  await stopped;
  return new File(parts, 'my-face.webm', { type: 'video/webm' });
}
