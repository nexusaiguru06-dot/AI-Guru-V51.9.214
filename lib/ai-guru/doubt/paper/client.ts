'use client';

/**
 * V51.9.98 — browser side of "Show your paper": sharp stills from the camera or a photo,
 * reading the page, answering questions, and reading answers aloud.
 */

import { openRouter } from '@/lib/ai-guru/openrouter';
import { callGeminiClientContents, studentKey } from '@/lib/student-key';
import { offlineAI } from '@/lib/offline-ai';
import { chunkForSpeech, getSpeechLang, loadSpeechVoices, selectFemaleVoice, speakChunked } from '@/lib/web-speech';
import { edgeVoiceFor, markTtsProviderDown, ttsProviderOrder } from '@/lib/ai-guru/tts/provider-order';
import { brightness, cleanUp, fitSize, motion, sharpness, toGrey, type FrameLook, type Grey } from './image';
import { answerSystemPrompt, chatContents, offlinePrompt, parseAnswer, parseReading, READING_USER, readingSystemPrompt, type AnswerContext, type PaperAnswer, type PaperLang, type PaperReading, type PaperTurn } from './paper';
import { ttsFetch } from '@/lib/ai-guru/tts/tts-fetch'; // V51.9.160: on-device Malayalam voice

export interface PaperPhoto {
  base64: string;
  mimeType: 'image/jpeg';
  /** For showing the photo on screen. */
  url: string;
  w: number;
  h: number;
}

function canvasToPhoto(c: HTMLCanvasElement): Promise<PaperPhoto> {
  return new Promise((resolve, reject) => {
    c.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('Could not take the photo.'));
        const r = new FileReader();
        r.onloadend = () => {
          const url = String(r.result);
          resolve({ base64: url.split(',')[1] ?? '', mimeType: 'image/jpeg', url, w: c.width, h: c.height });
        };
        r.onerror = () => reject(new Error('Could not read the photo.'));
        r.readAsDataURL(blob);
      },
      'image/jpeg',
      0.9,
    );
  });
}

/** Draws any image source at up to 2048 px (shape kept), cleans it up, returns a JPEG. */
async function sourceToPhoto(src: CanvasImageSource, w0: number, h0: number): Promise<PaperPhoto> {
  if (!w0 || !h0) throw new Error('The camera is not ready yet.');
  const { w, h } = fitSize(w0, h0, 2048);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas unavailable.');
  ctx.drawImage(src, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  cleanUp(img.data, w, h);
  ctx.putImageData(img, 0, 0);
  return canvasToPhoto(c);
}

/** A sharp still at the camera's full resolution (not the small live-stream frame). */
export async function captureStill(video: HTMLVideoElement): Promise<PaperPhoto> {
  // ImageCapture.takePhoto gives the sensor's full still where supported (Android Chrome); the video frame otherwise.
  const track = (video.srcObject as MediaStream | null)?.getVideoTracks?.()[0];
  const IC = (globalThis as { ImageCapture?: new (t: MediaStreamTrack) => { takePhoto(): Promise<Blob> } }).ImageCapture;
  if (track && IC && track.readyState === 'live') {
    try {
      const blob = await Promise.race([new IC(track).takePhoto(), new Promise<never>((_, rej) => setTimeout(() => rej(new Error('slow')), 2500))]);
      const bmp = await createImageBitmap(blob);
      try {
        return await sourceToPhoto(bmp, bmp.width, bmp.height);
      } finally {
        bmp.close();
      }
    } catch {
      /* fall back to the video frame */
    }
  }
  return sourceToPhoto(video, video.videoWidth, video.videoHeight);
}

/** A photo the student picked or took with the phone's camera app (EXIF rotation applied). */
export async function photoFromFile(file: File): Promise<PaperPhoto> {
  if (!/^image\//.test(file.type)) throw new Error('Choose a photo (JPG or PNG).');
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  try {
    return await sourceToPhoto(bmp, bmp.width, bmp.height);
  } finally {
    bmp.close();
  }
}

/** One quick look at the live camera: sharpness, brightness and movement since the last look. */
export function lookAt(video: HTMLVideoElement, canvas: HTMLCanvasElement, prev: Grey | null): { look: FrameLook; grey: Grey } | null {
  if (!video.videoWidth) return null;
  const w = 320;
  const h = Math.max(1, Math.round((w * video.videoHeight) / video.videoWidth));
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, w, h);
  const grey = toGrey(ctx.getImageData(0, 0, w, h).data, w, h, 160);
  return { grey, look: { sharp: sharpness(grey), bright: brightness(grey), moved: motion(prev, grey) } };
}

export const hasGeminiKey = () => studentKey.hasKey() || openRouter.hasUsable(); // V51.9.158: or the OpenRouter backup
export const offlineVisionReady = () => offlineAI.getVisionStatus() === 'ready';

const bytesOf = (b64: string) => {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
};

/** Step 1: read the page(s). Needs a Gemini key (the on-device model answers, but does not transcribe reliably). */
export async function readPaper(photos: PaperPhoto[], signal?: AbortSignal): Promise<PaperReading> {
  const raw = await callGeminiClientContents(
    readingSystemPrompt(photos.length),
    [{ role: 'user', parts: [...photos.map((p) => ({ inline_data: { mime_type: p.mimeType, data: p.base64 } })), { text: READING_USER }] }],
    undefined,
    { json: true, temperature: 0.1, maxOutputTokens: 8192, signal },
  );
  return parseReading(raw, photos.length);
}

/** Step 2: answer the latest question (the last student turn). */
export async function askPaper(reading: PaperReading | null, turns: PaperTurn[], photos: PaperPhoto[], ctx: AnswerContext, signal?: AbortSignal): Promise<PaperAnswer> {
  const question = [...turns].reverse().find((t) => t.role === 'student')?.text ?? '';
  if (!hasGeminiKey()) {
    if (!offlineVisionReady() || !photos[0]) throw new Error('Add your free Gemini key in Settings (or download the offline picture model) to ask about a paper.');
    const sys = `You are AI Guru, a patient school teacher for a Class ${ctx.grade} student (${ctx.boardName}). ${ctx.languageLine} The student shows you a photo of their paper and asks about it. Read the photo carefully, answer briefly, and point out any mistake on the paper kindly.`;
    const text = await offlineAI.generateWithImage(sys, offlinePrompt(question, reading), bytesOf(photos[0].base64));
    const empty: PaperReading = reading ?? { quality: 'good', subject: 'other', language: 'other', title: '', summary: '', lines: [], diagrams: [], pages: photos.length };
    return parseAnswer(text, empty);
  }
  const r = reading ?? { quality: 'good' as const, subject: 'other', language: 'other', title: '', summary: '', lines: [], diagrams: [], pages: photos.length };
  const raw = await callGeminiClientContents(answerSystemPrompt(r, ctx), chatContents(turns.slice(-12), photos), undefined, { json: true, temperature: 0.35, maxOutputTokens: 4096, signal });
  return parseAnswer(raw, r);
}

/* ---------------- reading answers aloud ---------------- */

export interface Speaking {
  stop(): void;
  done: Promise<void>;
}

/**
 * Speaks with the classroom's own voice chain (Edge → Piper → Google → Sarvam, sentence by
 * sentence, so it starts quickly), falling back to the browser's voice.
 */
export function speakAnswer(text: string, lang: PaperLang): Speaking {
  let stopped = false;
  let current: AudioBufferSourceNode | null = null;
  let browser: { cancel(): void } | null = null;
  const ctl = new AbortController();
  const ac = typeof AudioContext !== 'undefined' ? new AudioContext() : null;
  const languageCode = lang === 'malayalam' ? 'ml-IN' : 'en-IN';
  const clean = text.replace(/[*_#`>]/g, '').trim();

  async function fetchChunk(chunk: string): Promise<AudioBuffer | null> {
    for (const provider of ttsProviderOrder(lang === 'malayalam' ? 'malayalam' : 'english')) {
      if (stopped) return null;
      try {
        const r = await ttsFetch('/api/ai-guru/tts', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          signal: ctl.signal,
          body: JSON.stringify({ provider, text: chunk, languageCode, speaker: provider === 'edge' ? edgeVoiceFor(languageCode) : provider === 'sarvam' ? 'shubh' : undefined, alignment: false }),
        });
        const j = await r.json();
        if (!ac) return null;
        if (!r.ok || !j?.ok || !j.result?.audioBase64) { markTtsProviderDown(provider); continue; }
        return await ac.decodeAudioData(bytesOf(j.result.audioBase64));
      } catch {
        if (stopped) return null;
        markTtsProviderDown(provider);
      }
    }
    return null;
  }

  const play = (buf: AudioBuffer) =>
    new Promise<void>((resolve) => {
      if (!ac || stopped) return resolve();
      const s = ac.createBufferSource();
      s.buffer = buf;
      s.connect(ac.destination);
      s.onended = () => resolve();
      current = s;
      s.start();
    });

  const browserSpeak = async (from: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || stopped) return;
    const locale = getSpeechLang(lang);
    const voice = selectFemaleVoice(await loadSpeechVoices(), locale);
    await new Promise<void>((resolve) => {
      browser = speakChunked({ text: from, locale, voice, onDone: resolve });
    });
  };

  const done = (async () => {
    const chunks = chunkForSpeech(clean);
    let next = chunks.length ? fetchChunk(chunks[0]) : Promise.resolve(null);
    for (let i = 0; i < chunks.length && !stopped; i++) {
      const buf = await next;
      next = i + 1 < chunks.length ? fetchChunk(chunks[i + 1]) : Promise.resolve(null); // fetch ahead while this one plays
      if (!buf) {
        await browserSpeak(chunks.slice(i).join(' '));
        break;
      }
      await play(buf);
    }
  })().finally(() => {
    void ac?.close().catch(() => {});
  });

  return {
    stop() {
      stopped = true;
      ctl.abort();
      try { current?.stop(); } catch { /* ended */ }
      (browser as { cancel(): void } | null)?.cancel();
    },
    done,
  };
}

/* ---------------- asking by voice ---------------- */

type Recog = { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; abort(): void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null };

export const canListen = () => typeof window !== 'undefined' && !!((window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition);

/** Listens for one question; `onText` gets the words so far, `onEnd` the final text (or '' on error). */
export function listen(lang: PaperLang, onText: (t: string) => void, onEnd: (t: string, error?: string) => void): { stop(): void } {
  const W = window as unknown as { SpeechRecognition?: new () => Recog; webkitSpeechRecognition?: new () => Recog };
  const C = W.SpeechRecognition || W.webkitSpeechRecognition;
  if (!C) {
    onEnd('', 'Voice input is not available in this browser — type your question.');
    return { stop() {} };
  }
  const r = new C();
  r.lang = lang === 'malayalam' ? 'ml-IN' : 'en-IN';
  r.interimResults = true;
  r.continuous = false;
  let text = '';
  let failed: string | undefined;
  r.onresult = (e) => {
    text = Array.from(e.results).map((x) => x[0]?.transcript ?? '').join(' ').trim();
    onText(text);
  };
  r.onerror = (e) => {
    failed = e.error === 'not-allowed' ? 'Allow the microphone to ask by voice.' : e.error === 'no-speech' ? 'I did not hear anything — try again.' : undefined;
  };
  r.onend = () => onEnd(text, text ? undefined : failed);
  r.start();
  return { stop: () => r.stop() };
}
