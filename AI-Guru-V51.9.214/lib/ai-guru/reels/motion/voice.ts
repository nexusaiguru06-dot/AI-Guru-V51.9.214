'use client';

/**
 * Voice-over for reels through the classroom's own TTS chain
 * (/api/ai-guru/tts: Edge Read Aloud → local Piper → Google Cloud → Sarvam,
 * same order and voice settings as the live class). Clips are decoded to
 * 48 kHz mono, trimmed and cached for the session.
 */

import { edgeVoiceFor, markTtsProviderDown, ttsProviderOrder } from '../../tts/provider-order';
import type { Lang } from './captions';
import { prepareClip, resample, type VoiceClips } from './audio';
import { SFX_RATE } from './sfx';
import { ttsFetch } from '@/lib/ai-guru/tts/tts-fetch'; // V51.9.160: on-device Malayalam voice

export interface VoiceProgress {
  done: number;
  total: number;
}

export interface VoiceResult {
  clips: VoiceClips;
  /** Texts no provider could voice (those steps stay silent). */
  failed: string[];
  providers: string[];
  lastError?: string;
}

const cache = new Map<string, { samples: Float32Array; provider: string }>();

/**
 * V51.9.100: the teacher's own voice (IndicF5 on the AI Guru PC, through /api/ai-guru/teacher-voice).
 * `auth` = the teacher's { code, key }; a student sends nothing (their sign-in cookie picks their own teacher).
 */
export interface TeacherVoice { avatarId: string; auth?: { code: string; key: string } | null }
/** When the teacher-voice worker is not running, the other steps go straight to the classroom voice for a while. */
let teacherDownUntil = 0;
export const resetTeacherVoice = () => { teacherDownUntil = 0; };

async function speakTeacher(text: string, lang: Lang, tv: TeacherVoice, signal?: AbortSignal): Promise<{ samples: Float32Array; provider: string }> {
  const key = `teacher:${tv.avatarId}|${lang}|${text}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const ctl = new AbortController();
  const stop = () => ctl.abort();
  signal?.addEventListener('abort', stop);
  const timer = setTimeout(stop, 150_000); // IndicF5 on a CPU takes a while per sentence
  try {
    const r = await fetch('/api/ai-guru/teacher-voice', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, lang, ...(tv.auth ?? {}) }), signal: ctl.signal });
    const json = await r.json().catch(() => ({}));
    if (!r.ok || !json?.ok || !json.result?.audioBase64) {
      if (r.status === 503 || r.status === 404 || r.status === 401) teacherDownUntil = Date.now() + 10 * 60_000;
      throw new Error(json?.error || `teacher voice HTTP ${r.status}`);
    }
    const samples = await decode(b64ToBytes(json.result.audioBase64));
    if (samples.length < SFX_RATE * 0.15) throw new Error('teacher voice returned silence');
    const out = { samples, provider: 'teacher-voice' };
    cache.set(key, out);
    return out;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', stop);
  }
}

function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function decode(bytes: Uint8Array<ArrayBuffer>): Promise<Float32Array> {
  // An OfflineAudioContext at 48 kHz resamples while decoding.
  const ctx = new OfflineAudioContext(1, 1, SFX_RATE);
  const buf = await ctx.decodeAudioData(bytes.buffer.slice(0));
  const mono = new Float32Array(buf.length);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < d.length; i++) mono[i] += d[i] / buf.numberOfChannels;
  }
  return prepareClip(mono, SFX_RATE);
}

/**
 * V51.9.100: a student's avatar voice — Gemini text-to-speech called from the student's phone with the student's own
 * key (BYOK). Never through the AI Guru server, so it can never cost the company anything.
 */
export interface ByokVoice { voice: string }

/** Gemini returns raw 16-bit PCM ("audio/L16;rate=24000"): to float samples at the reel's rate, trimmed and levelled. */
export function pcm16ToClip(b64: string, mimeType: string): Float32Array {
  const bytes = b64ToBytes(b64);
  const rate = Number(/rate=(\d+)/.exec(mimeType)?.[1] ?? 24000) || 24000;
  const n = bytes.length >> 1;
  const v = new DataView(bytes.buffer, bytes.byteOffset, n * 2);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = v.getInt16(i * 2, true) / 32768;
  return prepareClip(resample(out, rate, SFX_RATE), SFX_RATE);
}

async function speakByok(text: string, lang: Lang, b: ByokVoice): Promise<{ samples: Float32Array; provider: string }> {
  const key = `byok:${b.voice}|${lang}|${text}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const { callGeminiTtsClient } = await import('../../../student-key');
  const r = await callGeminiTtsClient(text, lang === 'ml' ? 'ml-IN' : 'en-IN', undefined, { voiceName: b.voice });
  const samples = /wav|mpeg|mp3|ogg/i.test(r.mimeType) ? await decode(b64ToBytes(r.data)) : pcm16ToClip(r.data, r.mimeType);
  if (samples.length < SFX_RATE * 0.15) throw new Error('Gemini returned silence');
  const out = { samples, provider: 'my-key (Gemini)' };
  cache.set(key, out);
  return out;
}

async function speakOne(text: string, lang: Lang, signal?: AbortSignal, teacher?: TeacherVoice | null, byok?: ByokVoice | null, edgeVoices?: { en: string; ml: string } | null): Promise<{ samples: Float32Array; provider: string }> {
  if (byok) {
    try { return await speakByok(text, lang, byok); } catch (e) { if (signal?.aborted) throw e; /* the free classroom voice says this step */ }
  }
  if (teacher && Date.now() >= teacherDownUntil) {
    try { return await speakTeacher(text, lang, teacher, signal); } catch (e) { if (signal?.aborted) throw e; /* the classroom voice says this step */ }
  }
  const key = `${edgeVoices ? `${edgeVoices[lang]}|` : ''}${lang}|${text}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const languageCode = lang === 'ml' ? 'ml-IN' : 'en-IN';
  let last = 'no provider answered';
  for (const provider of ttsProviderOrder(lang === 'ml' ? 'malayalam' : 'english')) {
    if (signal?.aborted) throw new DOMException('cancelled', 'AbortError');
    const ctl = new AbortController();
    const stop = () => ctl.abort();
    signal?.addEventListener('abort', stop);
    const timer = setTimeout(stop, 25_000);
    try {
      const r = await ttsFetch('/api/ai-guru/tts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          provider,
          text,
          languageCode,
          speaker: provider === 'edge' ? (edgeVoices?.[lang] ?? edgeVoiceFor(languageCode)) : provider === 'sarvam' ? 'shubh' : undefined,
          alignment: false,
        }),
        signal: ctl.signal,
      });
      const json = await r.json();
      if (!r.ok || !json?.ok || !json.result?.audioBase64) throw new Error(json?.error || `${provider} HTTP ${r.status}`);
      const samples = await decode(b64ToBytes(json.result.audioBase64));
      if (samples.length < SFX_RATE * 0.15) throw new Error(`${provider} returned silence`);
      const out = { samples, provider: String(json.result.provider || provider) };
      cache.set(key, out);
      return out;
    } catch (e) {
      if (signal?.aborted) throw e;
      last = e instanceof Error ? e.message : String(e);
      markTtsProviderDown(provider);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', stop);
    }
  }
  throw new Error(last);
}

/** Voice every step of a reel. Runs a few requests at a time; failures leave that step silent. */
export async function synthesizeVoiceClips(
  texts: string[],
  lang: Lang,
  o: { onProgress?: (p: VoiceProgress) => void; signal?: AbortSignal; concurrency?: number; /** V51.9.100: try the teacher's own voice first */ teacher?: TeacherVoice | null; /** V51.9.100: a student's avatar voice with their own key */ byok?: ByokVoice | null; /** V51.9.101: lines NOT in the student's own voice (the teacher's question in a duet) */ byokSkip?: Set<string>; /** V51.9.103: a character's free classroom voices */ edgeVoices?: { en: string; ml: string } | null } = {},
): Promise<VoiceResult> {
  const clips: VoiceClips = new Map();
  const failed: string[] = [];
  const providers = new Set<string>();
  let lastError: string | undefined;
  let done = 0;
  let next = 0;
  o.onProgress?.({ done, total: texts.length });
  const worker = async () => {
    while (next < texts.length) {
      const text = texts[next++];
      try {
        const r = await speakOne(text, lang, o.signal, o.teacher, o.byokSkip?.has(text) ? null : o.byok, o.edgeVoices);
        clips.set(text, r.samples);
        providers.add(r.provider);
      } catch (e) {
        if (o.signal?.aborted) throw e;
        failed.push(text);
        lastError = e instanceof Error ? e.message : String(e);
      }
      o.onProgress?.({ done: ++done, total: texts.length });
    }
  };
  // the teacher's voice worker runs one sentence at a time on the PC: do not queue several at once
  await Promise.all(Array.from({ length: Math.min(o.teacher && Date.now() >= teacherDownUntil ? 1 : (o.concurrency ?? 3), texts.length) }, worker));
  return { clips, failed, providers: [...providers], lastError };
}
