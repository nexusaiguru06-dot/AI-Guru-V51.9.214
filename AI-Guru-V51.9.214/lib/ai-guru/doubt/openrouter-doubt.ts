/**
 * V51.9.200 — doubt clearing with an OpenRouter key (no Gemini key needed).
 *
 * OpenRouter has no live, talk-at-the-same-time voice like Gemini Live, so a doubt goes turn by turn:
 *  • the student speaks (the browser turns speech into text), types, or shows the camera;
 *  • the question — with a photo of what the camera sees, when it is on — goes to a free OpenRouter model that can see
 *    pictures;
 *  • the answer appears as it is written and is read aloud by the browser's voice.
 * The conversation keeps the last few turns, so follow-up questions work.
 */
import { callOpenRouter, type ORMessage } from '../openrouter';

export interface DoubtTurn { q: string; a: string }

/** The messages for one turn: the teacher's instructions, the last turns, then the question (and the photo). */
export function doubtMessages(system: string, history: DoubtTurn[], question: string, imageJpegBase64?: string, note?: string): ORMessage[] {
  const recent = history.slice(-4).flatMap((t): ORMessage[] => [{ role: 'user', content: t.q }, { role: 'assistant', content: t.a }]);
  const text = `${question}${note ? `\n\n[${note}]` : ''}${imageJpegBase64 ? '\n\n(The photo is what my camera shows now: my textbook, notebook or question.)' : ''}`;
  const user: ORMessage = imageJpegBase64
    ? { role: 'user', content: [{ type: 'text', text }, { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageJpegBase64}` } }] }
    : { role: 'user', content: text };
  return [{ role: 'system', content: `${system}\n\nThis conversation is turn by turn (not live): answer the question fully in one reply, in short spoken sentences a student can follow when read aloud. Do not use markdown tables or code; plain sentences and simple steps.` }, ...recent, user];
}

/** One answer from OpenRouter, streamed into `onDelta`. */
export function askOpenRouterDoubt(o: { system: string; history: DoubtTurn[]; question: string; image?: string; note?: string; onDelta?: (t: string) => void; signal?: AbortSignal }): Promise<string> {
  return callOpenRouter({ messages: doubtMessages(o.system, o.history, o.question, o.image, o.note), task: 'doubt', maxTokens: 1200, temperature: 0.3, onDelta: o.onDelta, signal: o.signal });
}

/** Text for reading aloud: no markdown marks, no emoji clutter. */
export const speakable = (t: string) => t.replace(/[*_#`>|]+/g, ' ').replace(/\$+/g, ' ').replace(/\s+/g, ' ').trim();

type Rec = { lang: string; continuous: boolean; interimResults: boolean; start: () => void; stop: () => void; abort: () => void; onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null };

/** Whether this browser can turn speech into text (Chrome, Edge, Samsung Internet, Safari). */
export const canListen = () => typeof window !== 'undefined' && !!((window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition);

/**
 * Listens to the microphone and calls `onFinal` with each finished sentence. Keeps listening until stopped (the browser
 * ends recognition after a pause, so it is restarted). `pause()` stops hearing while the answer is read aloud.
 */
export function listen(o: { lang: string; onFinal: (text: string) => void; onInterim?: (text: string) => void; onError?: (msg: string) => void }) {
  const W = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  const Ctor = W.SpeechRecognition || W.webkitSpeechRecognition;
  if (!Ctor) { o.onError?.('This browser cannot listen to speech. Type your doubt instead, or use Chrome.'); return { stop() {}, pause() {}, resume() {} }; }
  const r = new Ctor();
  r.lang = o.lang; r.continuous = true; r.interimResults = true;
  let on = true, paused = false;
  r.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i];
      const t = res[0]?.transcript ?? '';
      if (res.isFinal) { if (t.trim()) o.onFinal(t.trim()); } else interim += t;
    }
    if (interim) o.onInterim?.(interim);
  };
  r.onerror = (e) => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { on = false; o.onError?.('Allow the microphone for this site to ask by voice.'); } };
  r.onend = () => { if (on && !paused) { try { r.start(); } catch { /* already started */ } } };
  try { r.start(); } catch { /* already started */ }
  return {
    stop() { on = false; try { r.abort(); } catch { /* ignore */ } },
    pause() { paused = true; try { r.stop(); } catch { /* ignore */ } },
    resume() { if (!on) return; paused = false; try { r.start(); } catch { /* already started */ } },
  };
}
