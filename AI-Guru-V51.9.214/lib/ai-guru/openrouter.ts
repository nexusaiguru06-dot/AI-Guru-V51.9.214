'use client';

/**
 * V51.9.158 — OpenRouter as the students' backup AI (Option 1: their own keys, like the Gemini keys).
 *
 * A student (or a parent) makes a free OpenRouter account and pastes the key in Settings. AI Guru keeps using the
 * student's Gemini keys first; when every Gemini key has reached its limit, is rate-limited, missing or refused, the
 * same request (text, photos, video frames, a conversation, or a streamed answer) goes to OpenRouter instead.
 *
 * Free models (ids ending in ":free") cost nothing. OpenRouter's limits (per account, third-party figures checked
 * October 2026; they can change): 20 requests a minute; 50 a day, or 1,000 a day once the account has ever bought
 * $10 of credits. Keys stay in this browser and go straight to OpenRouter (it allows calls from web pages); they are
 * never sent to the AI Guru server. Pure browser module: it must not import student-key (that imports this lazily).
 */
import { logAi, maskKey, shortReason } from '@/lib/ai-guru/ai-log';

export const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const STORAGE = 'ai_guru_openrouter_v1';
const MODELS_CACHE = 'ai_guru_openrouter_models_v1';

export interface OpenRouterKey {
  id: string;
  key: string;
  addedAt: number;
  /** From GET /key: true while the account has never bought credits (50 free requests a day). */
  freeTier?: boolean;
  validatedAt?: number;
  lastUsedAt?: number;
  exhaustedOn?: string;
  cooldownUntil?: number;
  invalid?: boolean;
  lastError?: string;
}
interface Store { v: 1; keys: OpenRouterKey[]; model?: string }
export interface FreeModel { id: string; name: string; vision: boolean; context: number }

/** The parts AI Guru already builds for Gemini (text and inline pictures). */
export type GeminiPart = { text?: string; inline_data?: { mime_type: string; data: string }; inlineData?: { mimeType: string; data: string } };
type OAPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };
export type ORMessage = { role: 'system' | 'user' | 'assistant'; content: string | OAPart[] };

const today = () => new Date().toISOString().slice(0, 10);
const hasWindow = () => typeof window !== 'undefined';

/** OpenRouter keys look like sk-or-v1-<64 hex>. */
export const isOpenRouterKey = (k: string) => /^sk-or-(v1-)?[A-Za-z0-9]{20,}$/.test(k.trim());

function read(): Store {
  if (!hasWindow()) return { v: 1, keys: [] };
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE) || '') as Store;
    if (s?.v === 1 && Array.isArray(s.keys)) {
      let changed = false;
      for (const k of s.keys) {
        if (k.exhaustedOn && k.exhaustedOn !== today()) { delete k.exhaustedOn; delete k.lastError; changed = true; }
        if (k.cooldownUntil && k.cooldownUntil <= Date.now()) { delete k.cooldownUntil; changed = true; }
      }
      if (changed) localStorage.setItem(STORAGE, JSON.stringify(s));
      return s;
    }
  } catch { /* empty */ }
  return { v: 1, keys: [] };
}
function write(s: Store) {
  if (!hasWindow()) return;
  try { localStorage.setItem(STORAGE, JSON.stringify(s)); } catch { /* storage full or blocked */ }
  window.dispatchEvent(new CustomEvent('ai-guru-openrouter-changed'));
}
const usable = (k: OpenRouterKey) => !k.invalid && k.exhaustedOn !== today() && (!k.cooldownUntil || k.cooldownUntil <= Date.now());

export const openRouter = {
  getAll: (): OpenRouterKey[] => read().keys.map((k) => ({ ...k })),
  usable: (): OpenRouterKey[] => read().keys.filter(usable),
  hasKey: (): boolean => read().keys.length > 0,
  hasUsable: (): boolean => read().keys.some(usable),
  model: (): string | undefined => read().model,
  setModel(id: string | null) { const s = read(); if (id) s.model = id; else delete s.model; write(s); },
  save(key: string, info: Partial<OpenRouterKey> = {}): OpenRouterKey {
    const clean = key.trim();
    if (!isOpenRouterKey(clean)) throw new Error('That does not look like an OpenRouter key (it starts with sk-or-).');
    const s = read();
    let k = s.keys.find((x) => x.key === clean);
    if (!k) { k = { id: `or-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, key: clean, addedAt: Date.now() }; s.keys.push(k); }
    Object.assign(k, info, { invalid: false });
    delete k.exhaustedOn; delete k.cooldownUntil; delete k.lastError;
    write(s);
    return { ...k };
  },
  remove(id: string) { const s = read(); s.keys = s.keys.filter((k) => k.id !== id && k.key !== id); write(s); },
  status(k: OpenRouterKey): 'ready' | 'daily-limit' | 'cooldown' | 'invalid' {
    if (k.invalid) return 'invalid';
    if (k.exhaustedOn === today()) return 'daily-limit';
    if (k.cooldownUntil && k.cooldownUntil > Date.now()) return 'cooldown';
    return 'ready';
  },
  masked: (k: string) => `${k.slice(0, 9)}${'•'.repeat(6)}${k.slice(-4)}`,
};

function mark(key: string, patch: Partial<OpenRouterKey> | ((k: OpenRouterKey) => void)) {
  const s = read();
  const k = s.keys.find((x) => x.key === key);
  if (!k) return;
  if (typeof patch === 'function') patch(k); else Object.assign(k, patch);
  write(s);
}

export class OpenRouterError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
/** No usable OpenRouter key: the caller keeps its own (Gemini) error. */
export class OpenRouterNotReady extends Error {}

/** daily = this key's free requests for today are used up; temporary = try another key now, this one in a minute. */
export function classifyOpenRouter(status: number, message: string): 'daily' | 'temporary' | 'invalid' | 'other' {
  const m = message.toLowerCase();
  if (status === 401) return 'invalid';
  if (status === 429) return /per.?day|free-models-per-day|daily/.test(m) ? 'daily' : 'temporary';
  if (status === 402) return 'daily'; // needs credits (a paid model, or free credits used up): skip this key today
  if (status >= 500 || status === 408) return 'temporary';
  return 'other';
}

/* ---------------- models ---------------- */

/**
 * V51.9.159 — Malayalam first. How well each free model family handles Malayalam, from what its makers publish:
 *   good    Malayalam is a named / documented language: Sarvam-M (built for Indian languages), Gemini, Gemma, Qwen3
 *   some    strong multilingual models whose makers do not list Malayalam (they often manage, less reliably)
 *   english Malayalam is not among the supported languages (Llama 3 and 4)
 * Not a test of quality: the Settings card's "Try it" shows how a model really writes Malayalam.
 */
export type MalayalamLevel = 'good' | 'some' | 'english';
const ML_GOOD = [/sarvam/i, /gemini/i, /gemma/i, /qwen-?3|qwen3/i];
const ML_SOME = [/deepseek/i, /glm/i, /kimi|moonshot/i, /gpt-oss/i, /qwen/i, /mistral|mixtral/i, /nemotron/i, /hermes/i];
const ML_ENGLISH = [/llama/i];
export function malayalamLevel(id: string): MalayalamLevel {
  if (ML_ENGLISH.some((r) => r.test(id))) return 'english';
  if (ML_GOOD.some((r) => r.test(id))) return 'good';
  return 'some';
}
const familyRank = (id: string) => { const all = [...ML_GOOD, ...ML_SOME]; const i = all.findIndex((r) => r.test(id)); return i < 0 ? all.length : i; };

/**
 * The owner's order (good English and good Malayalam both matter): every Gemini model first, then OpenAI's models,
 * then Sarvam (Indian languages); after them the other free models, Malayalam-capable first, Llama (no Malayalam) last.
 */
export type ModelGroup = 'gemini' | 'openai' | 'sarvam' | 'other-ml' | 'other' | 'english';
export const MODEL_GROUPS: Array<[ModelGroup, string]> = [
  ['gemini', 'Gemini (Google)'], ['openai', 'OpenAI'], ['sarvam', 'Sarvam (Indian languages)'],
  ['other-ml', 'Others — good in Malayalam'], ['other', 'Others — some Malayalam'], ['english', 'Mostly English (Malayalam not supported)'],
];
export function modelGroup(id: string): ModelGroup {
  if (/^google\/gemini/i.test(id) || /\/gemini/i.test(id)) return 'gemini';
  if (/^openai\//i.test(id)) return 'openai';
  if (/sarvam/i.test(id)) return 'sarvam';
  const lv = malayalamLevel(id);
  return lv === 'good' ? 'other-ml' : lv === 'some' ? 'other' : 'english';
}
const GROUP_ORDER = Object.fromEntries(MODEL_GROUPS.map(([g], i) => [g, i])) as Record<ModelGroup, number>;

/** Free models in the owner's order (see modelGroup); inside a group by family, then the longest memory. */
export function rankFreeModels(list: FreeModel[]): FreeModel[] {
  return [...list].sort((a, b) => GROUP_ORDER[modelGroup(a.id)] - GROUP_ORDER[modelGroup(b.id)] || familyRank(a.id) - familyRank(b.id) || b.context - a.context);
}

/** Today's free models from OpenRouter (public list, no key needed; kept for an hour on this device). */
export async function listFreeModels(force = false): Promise<FreeModel[]> {
  if (!force && hasWindow()) {
    try { const c = JSON.parse(sessionStorage.getItem(MODELS_CACHE) || ''); if (c && Date.now() - c.at < 3_600_000 && Array.isArray(c.list) && c.list.length) return c.list; } catch { /* none */ }
  }
  const res = await fetch(`${OPENROUTER_BASE}/models`);
  if (!res.ok) throw new OpenRouterError(res.status, `OpenRouter model list: HTTP ${res.status}`);
  const j = await res.json();
  const list: FreeModel[] = (Array.isArray(j?.data) ? j.data : [])
    .filter((m: { id?: string }) => typeof m?.id === 'string' && m.id.endsWith(':free'))
    .map((m: { id: string; name?: string; context_length?: number; architecture?: { input_modalities?: string[]; modality?: string } }) => ({
      id: m.id, name: m.name || m.id, context: m.context_length || 0,
      vision: !!(m.architecture?.input_modalities?.includes('image') || /image/.test(m.architecture?.modality || '')),
    }));
  const ranked = rankFreeModels(list);
  if (hasWindow()) try { sessionStorage.setItem(MODELS_CACHE, JSON.stringify({ at: Date.now(), list: ranked })); } catch { /* ignore */ }
  return ranked;
}

/** The model to use: the student's choice (if it can do the job), else the best free one (one that reads pictures when needed). */
export async function chooseModel(needsVision: boolean): Promise<string> {
  const chosen = openRouter.model();
  let list: FreeModel[] = [];
  try { list = await listFreeModels(); } catch { /* offline list: use the choice as is */ }
  if (chosen) {
    const info = list.find((m) => m.id === chosen);
    if (!needsVision || !info || info.vision) return chosen;
  }
  const pick = list.find((m) => (needsVision ? m.vision : true)) ?? list[0];
  if (!pick) throw new OpenRouterError(503, 'OpenRouter has no free model available right now.');
  return pick.id;
}

/* ---------------- calling ---------------- */

/** Gemini parts → OpenAI-style parts (text and data-URL pictures). */
export function toOpenAiParts(parts: GeminiPart[]): string | OAPart[] {
  const out: OAPart[] = [];
  for (const p of parts) {
    if (typeof p.text === 'string') out.push({ type: 'text', text: p.text });
    const img = p.inline_data ? { mime: p.inline_data.mime_type, data: p.inline_data.data } : p.inlineData ? { mime: p.inlineData.mimeType, data: p.inlineData.data } : null;
    if (img) out.push({ type: 'image_url', image_url: { url: `data:${img.mime};base64,${img.data}` } });
  }
  return out.every((p) => p.type === 'text') ? out.map((p) => (p as { text: string }).text).join('\n') : out;
}

/** Gemini contents (user/model turns) → OpenAI messages. */
export function fromGeminiContents(system: string, contents: Array<{ role: 'user' | 'model'; parts: GeminiPart[] }>): ORMessage[] {
  return [{ role: 'system', content: system }, ...contents.map((c) => ({ role: c.role === 'model' ? 'assistant' as const : 'user' as const, content: toOpenAiParts(c.parts) }))];
}

/** A JSON answer without the ```json fences some free models add. */
export function cleanJson(text: string): string {
  const t = text.trim();
  const m = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(t);
  return m ? m[1] : t;
}

export interface OpenRouterRequest {
  messages: ORMessage[];
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
  task?: string;
  signal?: AbortSignal;
  /** Streams the answer: called with each new piece of text. */
  onDelta?: (text: string) => void;
}

const hasImages = (ms: ORMessage[]) => ms.some((m) => Array.isArray(m.content) && m.content.some((p) => p.type === 'image_url'));

async function once(key: string, model: string, r: OpenRouterRequest): Promise<string> {
  const messages = r.json ? r.messages.map((m, i) => (i === 0 && m.role === 'system' && typeof m.content === 'string' ? { ...m, content: `${m.content}\n\nReply with valid JSON only (no markdown fences, no text before or after).` } : m)) : r.messages;
  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    signal: r.signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, 'HTTP-Referer': hasWindow() ? window.location.origin : 'https://aiguru.app', 'X-Title': 'AI Guru' },
    body: JSON.stringify({ model, messages, max_tokens: Math.min(r.maxTokens ?? 4096, 16384), temperature: r.temperature ?? 0.4, ...(r.onDelta ? { stream: true } : {}) }),
  });
  if (!res.ok) {
    const body = await res.text();
    let msg = body;
    try { const j = JSON.parse(body); msg = j?.error?.message || j?.message || body; } catch { /* text */ }
    throw new OpenRouterError(res.status, `OpenRouter ${res.status}: ${String(msg).slice(0, 300)}`);
  }
  if (!r.onDelta) {
    const j = await res.json();
    if (j?.error) throw new OpenRouterError(Number(j.error.code) || 500, `OpenRouter: ${j.error.message || 'error'}`);
    const text = j?.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text.trim()) throw new OpenRouterError(502, 'OpenRouter returned an empty answer.');
    return r.json ? cleanJson(text) : text;
  }
  // streamed (server-sent events, OpenAI format)
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = '', all = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const j = JSON.parse(data);
        if (j?.error) throw new OpenRouterError(Number(j.error.code) || 500, `OpenRouter: ${j.error.message || 'error'}`);
        const d = j?.choices?.[0]?.delta?.content;
        if (typeof d === 'string' && d) { all += d; r.onDelta(d); }
      } catch (e) { if (e instanceof OpenRouterError) throw e; /* a partial line */ }
    }
  }
  if (!all) throw new OpenRouterError(502, 'OpenRouter returned an empty answer.');
  return all;
}

/**
 * One request, trying each saved OpenRouter key in turn (a key whose free requests for today are used up is skipped
 * until tomorrow; a rate-limited key rests a minute). Throws OpenRouterNotReady when no key is usable.
 */
export async function callOpenRouter(r: OpenRouterRequest): Promise<string> {
  const keys = openRouter.usable();
  if (!keys.length) throw new OpenRouterNotReady(openRouter.hasKey() ? 'All saved OpenRouter keys have reached their limit for now.' : 'No OpenRouter key is saved.');
  const model = await chooseModel(hasImages(r.messages));
  let last: unknown;
  let shown = false; // a streamed answer that already showed text must not be repeated with another key
  const req: OpenRouterRequest = r.onDelta ? { ...r, onDelta: (d) => { shown = true; r.onDelta!(d); } } : r;
  for (const k of keys) {
    const t0 = Date.now();
    try {
      const text = await once(k.key, model, req);
      mark(k.key, (x) => { x.lastUsedAt = Date.now(); delete x.cooldownUntil; delete x.lastError; });
      logAi({ provider: 'openrouter', model, key: maskKey(k.key), task: r.task, ok: true, ms: Date.now() - t0 });
      return text;
    } catch (e) {
      last = e;
      if ((e as Error)?.name === 'AbortError') throw e;
      const status = e instanceof OpenRouterError ? e.status : 0;
      logAi({ provider: 'openrouter', model, key: maskKey(k.key), task: r.task, ok: false, ms: Date.now() - t0, error: shortReason(e), status: status || undefined });
      if (shown) throw e;
      const kind = e instanceof OpenRouterError ? classifyOpenRouter(e.status, e.message) : 'other';
      const why = (e as Error)?.message?.slice(0, 300) ?? 'error';
      if (kind === 'invalid') mark(k.key, { invalid: true, lastError: why });
      else if (kind === 'daily') mark(k.key, { exhaustedOn: today(), lastError: why });
      else if (kind === 'temporary') mark(k.key, { cooldownUntil: Date.now() + 60_000, lastError: why });
      else throw e;
    }
  }
  throw last instanceof Error ? last : new Error('OpenRouter request failed.');
}

/** Checks a key without spending a request (GET /key) and saves it with its free-tier status. */
export async function validateOpenRouterKey(key: string): Promise<OpenRouterKey> {
  const clean = key.trim();
  if (!isOpenRouterKey(clean)) throw new Error('That does not look like an OpenRouter key. It starts with sk-or-.');
  const res = await fetch(`${OPENROUTER_BASE}/key`, { headers: { Authorization: `Bearer ${clean}` } });
  if (res.status === 401) throw new Error('OpenRouter did not accept this key. Copy it again from openrouter.ai/keys.');
  if (!res.ok) throw new Error(`OpenRouter could not check the key now (HTTP ${res.status}). Try again in a minute.`);
  const j = await res.json().catch(() => ({}));
  const d = j?.data ?? {};
  return openRouter.save(clean, { validatedAt: Date.now(), freeTier: typeof d.is_free_tier === 'boolean' ? d.is_free_tier : undefined });
}
