'use client';

/**
 * V51.9.160 — an on-device Malayalam voice a student can choose to download: AI4Bharat's vits_rasa_13 (CC-BY-4.0),
 * Sherpa-ONNX export (huggingface.co/MatiasLin/sherpa-onnx-vits-rasa-13). It reads Malayalam letters directly (no
 * espeak), so there is no Tamil-like accent. One Malayalam speaker (MAL_F, a woman).
 *
 * The files (~150 MB) are kept in this browser's Cache Storage; the ONNX runtime is loaded from jsDelivr the first
 * time it is needed (no package to install for the app). Everything runs on the device; nothing is sent anywhere.
 * When downloaded and switched on, the classroom tries this voice first for Malayalam (see provider-order.ts); a
 * sentence it cannot read (mostly English) goes to the next voice.
 */
import { bytesToBase64, encodeWav, inputRoles, onnxMetadata, parseTokens, rasaSentences, rasaText, RASA_MALAYALAM_SPEAKER, RASA_STYLES, tokenize, tokenOptions, type RasaStyle, type TokenOptions } from './rasa-core';

export const RASA_REPO = 'https://huggingface.co/MatiasLin/sherpa-onnx-vits-rasa-13/resolve/main';
export const RASA_FILES = { model: `${RASA_REPO}/model.onnx`, tokens: `${RASA_REPO}/tokens.txt` };
export const RASA_APPROX_MB = 150;
const CACHE = 'ai-guru-rasa-v1';
const ON_KEY = 'ai-guru-rasa-voice';
const STYLE_KEY = 'ai-guru-rasa-style';
/**
 * V51.9.162: until when (ms) this device is too slow for the on-device voice. Read by provider-order.ts: while it is
 * set, Malayalam goes straight to Edge (the class never waits for, or freezes on, the on-device voice).
 */
export const RASA_SLOW_KEY = 'ai-guru-rasa-slow-until';
const SLOW_PAUSE_MS = 30 * 60_000;
/** One sentence may take this long at most; then Edge reads it instead. */
const SENTENCE_LIMIT_MS = 8_000;
const ORT_VERSION = '1.23.2';
const ORT_BASE = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;

type Ort = {
  env: { wasm: { wasmPaths?: string; numThreads?: number; proxy?: boolean } };
  Tensor: new (type: string, data: unknown, dims: number[]) => unknown;
  InferenceSession: { create: (b: Uint8Array, o?: Record<string, unknown>) => Promise<OrtSession> };
};
type OrtSession = { inputNames: readonly string[]; outputNames: readonly string[]; run: (feeds: Record<string, unknown>) => Promise<Record<string, { data: Float32Array | ArrayLike<number>; dims: readonly number[] }>> };

const ls = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* blocked */ } },
};
const changed = () => { try { window.dispatchEvent(new CustomEvent('ai-guru-rasa-changed')); } catch { /* not in a browser */ } };

/* ---------------- the student's choice ---------------- */

/** Downloaded and switched on (read synchronously by the voice order). */
export const rasaVoiceOn = (): boolean => ls.get(ON_KEY) === 'on';
export function setRasaVoiceOn(on: boolean) { ls.set(ON_KEY, on ? 'on' : 'off'); ls.set(RASA_SLOW_KEY, null); changed(); }
/** V51.9.162: the on-device voice could not keep up on this device: Edge reads Malayalam for a while. */
function markSlow(why: string) {
  ls.set(RASA_SLOW_KEY, String(Date.now() + SLOW_PAUSE_MS));
  console.warn(`[AI Guru voice] on-device Malayalam voice is too slow on this device (${why}); Edge reads Malayalam for the next 30 minutes.`);
  changed();
}
/** Waits for a job at most `ms`; after that the caller moves on (the job may still finish in the background). */
function within<T>(job: Promise<T>, ms: number, why: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => { timer = setTimeout(() => { markSlow(why); reject(new Error(`On-device voice too slow (${why}): the next voice reads this sentence.`)); }, ms); });
  return Promise.race([job, late]).finally(() => clearTimeout(timer));
}
export const rasaStyle = (): RasaStyle => { const s = ls.get(STYLE_KEY) as RasaStyle | null; return s && s in RASA_STYLES ? s : 'book'; };
export function setRasaStyle(s: RasaStyle) { ls.set(STYLE_KEY, s); changed(); }

/** Both files are in this browser's cache. */
export async function rasaDownloaded(): Promise<boolean> {
  if (typeof caches === 'undefined') return false;
  try { const c = await caches.open(CACHE); return !!(await c.match(RASA_FILES.model)) && !!(await c.match(RASA_FILES.tokens)); } catch { return false; }
}

/* ---------------- download ---------------- */

export interface DownloadProgress { file: 'tokens' | 'model'; loaded: number; total: number }

async function fetchToCache(url: string, cache: Cache, onBytes: (loaded: number, total: number) => void, signal?: AbortSignal) {
  const res = await fetch(url, { signal, mode: 'cors' });
  if (!res.ok || !res.body) throw new Error(`Download failed (HTTP ${res.status}). Check the internet and try again.`);
  const total = Number(res.headers.get('content-length')) || 0;
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value); loaded += value.length; onBytes(loaded, total);
  }
  const blob = new Blob(parts as BlobPart[]);
  await cache.put(url, new Response(blob, { headers: { 'content-type': url.endsWith('.txt') ? 'text/plain; charset=utf-8' : 'application/octet-stream', 'content-length': String(blob.size) } }));
  return blob.size;
}

/** Downloads the voice into this browser (once). Switches it on when done. */
export async function downloadRasaVoice(onProgress?: (p: DownloadProgress) => void, signal?: AbortSignal): Promise<void> {
  if (typeof caches === 'undefined') throw new Error('This browser cannot keep downloaded voices (Cache Storage is missing). Try Chrome.');
  try { await navigator.storage?.persist?.(); } catch { /* best effort: ask the browser not to clear it */ }
  const est = await navigator.storage?.estimate?.().catch(() => undefined);
  if (est && est.quota !== undefined && est.usage !== undefined && est.quota - est.usage < (RASA_APPROX_MB + 30) * 1048576) throw new Error(`Not enough free space for the voice (about ${RASA_APPROX_MB} MB is needed). Free some space and try again.`);
  const cache = await caches.open(CACHE);
  await fetchToCache(RASA_FILES.tokens, cache, (l, t) => onProgress?.({ file: 'tokens', loaded: l, total: t }), signal);
  const size = await fetchToCache(RASA_FILES.model, cache, (l, t) => onProgress?.({ file: 'model', loaded: l, total: t }), signal);
  if (size < 1_000_000) { await cache.delete(RASA_FILES.model); throw new Error('The voice file looks incomplete. Try the download again.'); }
  engine = null;
  brokenUntil = 0;
  setRasaVoiceOn(true);
}

export async function removeRasaVoice(): Promise<void> {
  engine = null;
  try { await caches.delete(CACHE); } catch { /* none */ }
  ls.set(ON_KEY, null);
  changed();
}

/* ---------------- the engine ---------------- */

interface Engine { session: OrtSession; tokens: Map<string, number>; opts: TokenOptions; rate: number; meta: Record<string, string>; roles: ReturnType<typeof inputRoles> }
let engine: Promise<Engine> | null = null;
/** ONNX Runtime runs one request at a time per session: voice lines asked for together (reels make several at once) wait in turn. */
let queue: Promise<unknown> = Promise.resolve();
function inTurn<T>(job: () => Promise<T>): Promise<T> { const run = queue.then(job, job); queue = run.catch(() => undefined); return run; }
/** After the engine failed to start or run, it is not tried again for a few minutes (each try could take seconds). */
let brokenUntil = 0;
let brokenWhy = '';

function loadOrt(): Promise<Ort> {
  const w = window as unknown as { ort?: Ort };
  if (w.ort) return Promise.resolve(w.ort);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `${ORT_BASE}ort.min.js`;
    s.async = true;
    s.onload = () => (w.ort ? resolve(w.ort) : reject(new Error('The voice engine did not start.')));
    s.onerror = () => reject(new Error('Could not load the voice engine (needs the internet the first time).'));
    document.head.appendChild(s);
  });
}

async function loadEngine(): Promise<Engine> {
  const cache = await caches.open(CACHE);
  const [m, t] = await Promise.all([cache.match(RASA_FILES.model), cache.match(RASA_FILES.tokens)]);
  if (!m || !t) throw new Error('The Malayalam voice is not downloaded on this device.');
  const ort = await loadOrt();
  ort.env.wasm.wasmPaths = ORT_BASE;
  // V51.9.162: the voice model runs in ONNX Runtime's own worker, not on the page: the page (board, buttons) never freezes
  ort.env.wasm.proxy = true;
  ort.env.wasm.numThreads = (globalThis as { crossOriginIsolated?: boolean }).crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 2) : 1;
  const bytes = new Uint8Array(await m.arrayBuffer());
  const meta = onnxMetadata(bytes);
  const tokens = parseTokens(await t.text());
  const session = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
  return { session, tokens, opts: tokenOptions(meta, tokens), rate: Number(meta.sample_rate) || 22050, meta, roles: inputRoles(session.inputNames) };
}
const getEngine = () => {
  if (Date.now() < brokenUntil) return Promise.reject(new Error(brokenWhy));
  return (engine ??= loadEngine().catch((e) => { engine = null; brokenUntil = Date.now() + 3 * 60_000; brokenWhy = e instanceof Error ? e.message : String(e); throw e; }));
};

/** What the model expects (shown by "Test" in Settings, to check a new model file). */
export async function rasaDiagnostics(): Promise<string> {
  const e = await getEngine();
  return `inputs: ${e.session.inputNames.map((n) => `${n}=${e.roles[n] ?? '?'}`).join(', ')} · outputs: ${e.session.outputNames.join(', ')} · ${e.tokens.size} tokens · ${e.rate} Hz · blank ${e.opts.addBlank ? e.opts.blankId : 'off'} · ${Object.entries(e.meta).filter(([k]) => !/comment|url|license/i.test(k)).slice(0, 8).map(([k, v]) => `${k}=${v.slice(0, 20)}`).join(' ')}`;
}

async function sentence(e: Engine, text: string, style: RasaStyle, speed: number): Promise<Float32Array> {
  const ort = (window as unknown as { ort: Ort }).ort;
  const { ids } = tokenize(text, e.tokens, e.opts);
  if (ids.length < 3) return new Float32Array(0);
  const big = (n: number[]) => BigInt64Array.from(n.map((x) => BigInt(x)));
  const feeds: Record<string, unknown> = {};
  for (const name of e.session.inputNames) {
    switch (e.roles[name]) {
      case 'ids': feeds[name] = new ort.Tensor('int64', big(ids), [1, ids.length]); break;
      case 'mask': feeds[name] = new ort.Tensor('int64', big(ids.map(() => 1)), [1, ids.length]); break;
      case 'length': feeds[name] = new ort.Tensor('int64', big([ids.length]), [1]); break;
      case 'noise': feeds[name] = new ort.Tensor('float32', Float32Array.from([0.667]), [1]); break;
      case 'lengthScale': feeds[name] = new ort.Tensor('float32', Float32Array.from([1 / Math.max(0.5, Math.min(2, speed))]), [1]); break;
      case 'noiseW': feeds[name] = new ort.Tensor('float32', Float32Array.from([0.8]), [1]); break;
      case 'scales': feeds[name] = new ort.Tensor('float32', Float32Array.from([0.667, 1 / speed, 0.8]), [3]); break;
      case 'sid': feeds[name] = new ort.Tensor('int64', big([RASA_MALAYALAM_SPEAKER]), [1]); break;
      case 'emotion': feeds[name] = new ort.Tensor('int64', big([RASA_STYLES[style]]), [1]); break;
      default: throw new Error(`The voice model asks for an input AI Guru does not know: "${name}".`);
    }
  }
  const t0 = Date.now();
  const out = await within(inTurn(() => e.session.run(feeds)), SENTENCE_LIMIT_MS, 'a sentence took over 8 s');
  const ms = Date.now() - t0;
  const y = out[e.session.outputNames[0]];
  const audio = y.data instanceof Float32Array ? y.data : Float32Array.from(y.data as ArrayLike<number>);
  // slower than speaking it (and over 3 s) = the class would wait at every Malayalam sentence: use Edge for a while
  const speakMs = (audio.length / e.rate) * 1000;
  if (ms > 3000 && ms > speakMs * 1.5) markSlow(`${(ms / 1000).toFixed(1)} s to make ${(speakMs / 1000).toFixed(1)} s of speech`);
  return audio;
}

/**
 * Speaks Malayalam on this device. Throws (so the next voice is tried) when the voice is not downloaded or the text
 * is mostly English. Returns a WAV (16-bit, the model's rate) and its length.
 */
export async function synthRasa(input: string, o: { style?: RasaStyle; speed?: number } = {}): Promise<{ wav: Uint8Array; durationMs: number; text: string }> {
  const r = rasaText(input);
  if (r.english) throw new Error('Has English words: the next voice reads this sentence.');
  const parts = rasaSentences(r.text);
  if (!parts.length) throw new Error('Nothing in Malayalam to read.');
  const e = await within(getEngine(), 20_000, 'the voice took over 20 s to start');
  const gap = new Float32Array(Math.round(e.rate * 0.18));
  const chunks: Float32Array[] = [];
  try {
    for (const p of parts) { const a = await sentence(e, p, o.style ?? rasaStyle(), o.speed ?? 1); if (a.length) chunks.push(a, gap); }
  } catch (err) {
    brokenUntil = Date.now() + 3 * 60_000; brokenWhy = err instanceof Error ? err.message : String(err);
    throw err;
  }
  const n = chunks.reduce((a, c) => a + c.length, 0);
  if (n < e.rate * 0.15) throw new Error('The Malayalam voice returned silence.');
  const all = new Float32Array(n);
  let at = 0;
  for (const c of chunks) { all.set(c, at); at += c.length; }
  return { wav: encodeWav(all, e.rate), durationMs: Math.round((n / e.rate) * 1000), text: r.text };
}

/** The same answer shape as /api/ai-guru/tts, for the classroom's voice loop. */
export async function rasaTtsResponse(text: string): Promise<{ ok: true; result: { audioBase64: string; format: 'wav'; provider: 'rasa'; durationMs: number } }> {
  const { wav, durationMs } = await synthRasa(text);
  return { ok: true, result: { audioBase64: bytesToBase64(wav), format: 'wav', provider: 'rasa', durationMs } };
}
