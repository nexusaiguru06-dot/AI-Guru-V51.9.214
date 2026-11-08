/**
 * V51.9.160 — pure parts of the on-device Malayalam voice (AI4Bharat vits_rasa_13, Sherpa-ONNX export):
 * the text the voice can read, its tokens, the model's own settings (ONNX metadata), the model's input names,
 * splitting into sentences, and WAV encoding. No DOM, no network: shared by the browser engine and the tests.
 */
import { speakable, ML_LETTER_NAMES } from '../reels/motion/speech';
import { mlNumbersInText } from './ml-numbers';

/** The Malayalam speaker of vits_rasa_13 (MAL_F) and its speaking styles (emotion ids on the model card). */
export const RASA_MALAYALAM_SPEAKER = 11;
export const RASA_STYLES = { book: 3, conversation: 4, news: 10, wiki: 16, happy: 8 } as const;
export type RasaStyle = keyof typeof RASA_STYLES;
export const RASA_STYLE_NAME: Record<RasaStyle, string> = { book: 'Reading a book', conversation: 'Talking (conversation)', news: 'News reader', wiki: 'Explaining (encyclopedia)', happy: 'Happy' };

/* ---------------- text ---------------- */

export interface RasaText { text: string; /** Has English words this Malayalam-only voice cannot say: the next voice (Edge, which reads both) says the sentence. */ english: boolean }

/**
 * What the Malayalam-only voice can read: maths symbols as Malayalam words (speakable), numbers as words, single
 * English letters by their Malayalam names. A sentence that still has an English word is marked `english`: the voice
 * would drop that word, so the classroom's next voice (Edge, which reads both languages) says the whole sentence.
 */
export function rasaText(input: string): RasaText {
  let s = speakable(input, 'ml');
  s = mlNumbersInText(s);
  // short capital abbreviations are spelled out (QR → ക്യൂ ആർ, SMS → എസ് എം എസ്)
  s = s.replace(/\b[A-Z]{2,4}\b/g, (w) => [...w].map((ch) => ML_LETTER_NAMES[ch.toLowerCase()]).join(' '));
  // lone letters (variables) → their Malayalam names
  s = s.replace(/(^|[^A-Za-z])([A-Za-z])(?=[^A-Za-z]|$)/g, (_m, pre, v) => `${pre}${ML_LETTER_NAMES[v.toLowerCase()] ?? v}`);
  const english = /[A-Za-z]{2,}/.test(s) || !/[\u0D00-\u0D7F]/.test(s);
  return { text: s.replace(/\s+/g, ' ').trim(), english };
}

/** Sentences of at most ~220 characters (the model reads short sentences best), without the end mark (Sherpa's known trailing-noise issue). */
export function rasaSentences(text: string, max = 220): string[] {
  const out: string[] = [];
  for (const part of text.split(/(?<=[.!?।])\s+|\n+/)) {
    let p = part.trim();
    if (!p) continue;
    while (p.length > max) {
      const cut = Math.max(p.lastIndexOf(',', max), p.lastIndexOf(' ', max));
      const at = cut > max * 0.4 ? cut : max;
      out.push(p.slice(0, at).trim());
      p = p.slice(at + 1).trim();
    }
    if (p) out.push(p);
  }
  return out.map((p) => p.replace(/[.!?।]+$/, '').trim()).filter((p) => /[ഀ-ൿ]/.test(p));
}

/* ---------------- tokens ---------------- */

/** tokens.txt: one "<char> <id>" per line (the char may itself be a space). */
export function parseTokens(txt: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const line of txt.split(/\r?\n/)) {
    if (!line) continue;
    const at = line.lastIndexOf(' ');
    if (at < 0) continue;
    const id = Number(line.slice(at + 1));
    const tok = line.slice(0, at);
    if (Number.isInteger(id)) m.set(tok === '' ? ' ' : tok, id);
  }
  return m;
}

export interface TokenOptions { addBlank: boolean; blankId: number; bosId?: number; eosId?: number }

/** Malayalam text → token ids (characters not in the model's list are skipped and counted). */
export function tokenize(text: string, tokens: Map<string, number>, o: TokenOptions): { ids: number[]; skipped: string[] } {
  const ids: number[] = [];
  const skipped: string[] = [];
  for (const ch of text.normalize('NFC')) {
    const id = tokens.get(ch) ?? (ch === ' ' ? tokens.get('▁') : undefined);
    if (id === undefined) { if (ch.trim()) skipped.push(ch); continue; }
    ids.push(id);
  }
  let out = ids;
  if (o.addBlank) {
    out = [o.blankId];
    for (const id of ids) out.push(id, o.blankId);
  }
  if (o.bosId !== undefined) out = [o.bosId, ...out];
  if (o.eosId !== undefined) out = [...out, o.eosId];
  return { ids: out, skipped };
}

/** The tokenizer settings from the model's metadata and tokens (Sherpa writes add_blank, blank / pad ids). */
export function tokenOptions(meta: Record<string, string>, tokens: Map<string, number>): TokenOptions {
  const num = (k: string) => (meta[k] !== undefined && meta[k] !== '' && Number.isFinite(Number(meta[k])) ? Number(meta[k]) : undefined);
  const pad = tokens.get('_') ?? tokens.get('<pad>') ?? tokens.get('<blk>') ?? tokens.get('<blank>');
  const addBlank = meta.add_blank !== undefined ? meta.add_blank === '1' || meta.add_blank.toLowerCase() === 'true' : true;
  const useBosEos = meta.use_eos_bos === '1';
  return { addBlank, blankId: num('blank_id') ?? num('pad_id') ?? pad ?? 0, ...(useBosEos ? { bosId: num('bos_id'), eosId: num('eos_id') } : {}) };
}

/* ---------------- the model file ---------------- */

/** The ONNX file's metadata_props (ModelProto field 14), read without loading the graph. */
export function onnxMetadata(bytes: Uint8Array): Record<string, string> {
  const out: Record<string, string> = {};
  const dec = new TextDecoder();
  let i = 0;
  const varint = (): number => {
    let r = 0, shift = 0;
    for (;;) {
      const b = bytes[i++];
      r += (b & 0x7f) * 2 ** shift;
      if (b < 0x80) return r;
      shift += 7;
      if (shift > 63) throw new Error('bad varint');
    }
  };
  const readEntry = (end: number) => {
    let k = '', v = '';
    while (i < end) {
      const tag = varint(), f = Math.floor(tag / 8), w = tag & 7;
      if (w !== 2) { skip(w); continue; }
      const len = varint(); const s = dec.decode(bytes.subarray(i, i + len)); i += len;
      if (f === 1) k = s; else if (f === 2) v = s;
    }
    if (k) out[k] = v;
  };
  const skip = (w: number) => {
    if (w === 0) varint(); else if (w === 1) i += 8; else if (w === 5) i += 4; else if (w === 2) { const len = varint(); i += len; } else throw new Error(`wire type ${w}`);
  };
  try {
    while (i < bytes.length) {
      const tag = varint(), f = Math.floor(tag / 8), w = tag & 7;
      if (f === 14 && w === 2) { const len = varint(); readEntry(i + len); } else skip(w);
    }
  } catch { /* a damaged file: whatever was read */ }
  return out;
}

export type InputRole = 'ids' | 'length' | 'noise' | 'lengthScale' | 'noiseW' | 'scales' | 'sid' | 'emotion' | 'mask';
/** Which model input is which (Sherpa: x, x_length, noise_scale, length_scale, noise_scale_w, sid, emotion_id; HF/MMS: input_ids, attention_mask). */
export function inputRoles(names: readonly string[]): Record<string, InputRole | null> {
  const r: Record<string, InputRole | null> = {};
  for (const n of names) {
    const l = n.toLowerCase();
    r[n] = /^(x|input|input_ids|text|tokens)$/.test(l) ? 'ids'
      : /^(x_lengths?|input_lengths?|lengths?|text_lengths?)$/.test(l) ? 'length'
      : /^noise_scale_w$|^noise_w$/.test(l) ? 'noiseW'
      : /^noise_scale$/.test(l) ? 'noise'
      : /^length_scale$/.test(l) ? 'lengthScale'
      : /^scales$/.test(l) ? 'scales'
      : /^(sid|speaker|speaker_id|speakers?)$/.test(l) ? 'sid'
      : /emotion|style/.test(l) ? 'emotion'
      : /attention_mask/.test(l) ? 'mask'
      : null;
  }
  return r;
}

/* ---------------- audio ---------------- */

/** 16-bit mono WAV from float samples. */
export function encodeWav(samples: Float32Array, rate: number): Uint8Array {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => { for (let k = 0; k < s.length; k++) v.setUint8(o + k, s.charCodeAt(k)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, samples.length * 2, true);
  for (let k = 0; k < samples.length; k++) { const s = Math.max(-1, Math.min(1, samples[k])); v.setInt16(44 + k * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true); }
  return new Uint8Array(buf);
}

export function bytesToBase64(b: Uint8Array): string {
  let s = '';
  for (let k = 0; k < b.length; k += 0x8000) s += String.fromCharCode(...b.subarray(k, k + 0x8000));
  return btoa(s);
}
