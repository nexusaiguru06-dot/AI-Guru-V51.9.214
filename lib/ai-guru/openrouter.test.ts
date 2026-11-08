/** V51.9.158 — OpenRouter as the backup behind the students' Gemini keys. */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mem = (m = new Map<string, string>()) => ({ getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), clear: () => m.clear() });
const g = globalThis as Record<string, unknown>;
g.window = { location: { origin: 'https://aiguru.test' }, dispatchEvent: () => true, addEventListener: () => {}, removeEventListener: () => {}, setTimeout, clearTimeout };
g.localStorage = mem();
g.sessionStorage = mem();

import { classifyOpenRouter, cleanJson, malayalamLevel, modelGroup, fromGeminiContents, isOpenRouterKey, openRouter, rankFreeModels, toOpenAiParts, callOpenRouter } from './openrouter';
import { callGeminiClient, callGeminiClientVision, studentKey } from '../student-key';

const OR1 = `sk-or-v1-${'a'.repeat(64)}`, OR2 = `sk-or-v1-${'b'.repeat(64)}`;
const GEM = `AIza${'x'.repeat(35)}`;
const MODELS = { data: [
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3', context_length: 65000, architecture: { input_modalities: ['text'] } },
  { id: 'google/gemma-3-27b-it:free', name: 'Gemma 3 27B', context_length: 96000, architecture: { input_modalities: ['text', 'image'] } },
  { id: 'openai/gpt-x', name: 'paid', context_length: 1, architecture: { input_modalities: ['text'] } },
] };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

let calls: Array<{ url: string; body?: Record<string, unknown>; auth?: string }> = [];
function fakeFetch(handlers: { gemini?: () => Response; or?: (auth: string, body: Record<string, unknown>) => Response }) {
  calls = [];
  g.fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const auth = (init?.headers as Record<string, string> | undefined)?.Authorization;
    calls.push({ url, body, auth });
    if (url.includes('openrouter.ai/api/v1/models')) return json(200, MODELS);
    if (url.includes('generativelanguage')) return handlers.gemini ? handlers.gemini() : json(500, { error: { message: 'no' } });
    if (url.includes('openrouter.ai/api/v1/chat/completions')) return handlers.or ? handlers.or(auth ?? '', body ?? {}) : json(500, {});
    return json(404, {});
  });
}
const orOk = (text: string) => json(200, { choices: [{ message: { content: text } }] });

beforeEach(() => { (g.localStorage as { clear: () => void }).clear(); (g.sessionStorage as { clear: () => void }).clear(); });

describe('V51.9.158 OpenRouter helpers', () => {
  it('recognises keys, converts Gemini parts and conversations, cleans JSON, classifies errors', () => {
    expect(isOpenRouterKey(OR1)).toBe(true);
    expect(isOpenRouterKey('AIza123')).toBe(false);
    expect(toOpenAiParts([{ text: 'hi' }])).toBe('hi');
    expect(toOpenAiParts([{ inline_data: { mime_type: 'image/png', data: 'QUJD' } }, { text: 'what?' }])).toEqual([{ type: 'image_url', image_url: { url: 'data:image/png;base64,QUJD' } }, { type: 'text', text: 'what?' }]);
    const m = fromGeminiContents('sys', [{ role: 'user', parts: [{ text: 'q' }] }, { role: 'model', parts: [{ text: 'a' }] }]);
    expect(m.map((x) => x.role)).toEqual(['system', 'user', 'assistant']);
    expect(cleanJson('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(classifyOpenRouter(429, 'Rate limit exceeded: free-models-per-day')).toBe('daily');
    expect(classifyOpenRouter(429, 'Rate limit exceeded: free-models-per-min')).toBe('temporary');
    expect(classifyOpenRouter(401, 'No auth')).toBe('invalid');
    expect(rankFreeModels([{ id: 'x/llama-3.3:free', name: '', vision: false, context: 1 }, { id: 'google/gemma-3-27b:free', name: '', vision: true, context: 1 }])[0].id).toContain('gemma');
    const ids = ['meta-llama/llama-4-maverick:free', 'deepseek/deepseek-chat-v3:free', 'qwen/qwen3-235b-a22b:free', 'google/gemma-3-27b-it:free', 'sarvamai/sarvam-m:free', 'mistralai/mistral-small-3.2:free', 'google/gemini-2.0-flash-exp:free', 'openai/gpt-oss-20b:free'];
    const order = rankFreeModels(ids.map((id) => ({ id, name: id, vision: false, context: 1 }))).map((m) => m.id.split('/')[0]);
    expect(order).toEqual(['google', 'openai', 'sarvamai', 'google', 'qwen', 'deepseek', 'mistralai', 'meta-llama']); // Gemini, OpenAI, Sarvam, then Malayalam-capable, Llama last
    expect(modelGroup('google/gemma-3-27b-it:free')).toBe('other-ml');
    expect(malayalamLevel('meta-llama/llama-4-scout:free')).toBe('english');
  });
});

describe('V51.9.158 the backup', () => {
  it('rotates OpenRouter keys: a key whose free requests are used up rests until tomorrow', async () => {
    openRouter.save(OR1); openRouter.save(OR2);
    fakeFetch({ or: (auth) => (auth.includes('aaaa') ? json(429, { error: { message: 'Rate limit exceeded: free-models-per-day' } }) : orOk('from key 2')) });
    expect(await callOpenRouter({ messages: [{ role: 'user', content: 'hi' }] })).toBe('from key 2');
    expect(openRouter.getAll().map((k) => openRouter.status(k))).toEqual(['daily-limit', 'ready']);
    // the free model was used (never a paid one)
    expect(String(calls.find((c) => c.url.includes('chat'))?.body?.model)).toMatch(/:free$/);
  });

  it('Gemini first; when every Gemini key has reached its limit the same request goes to OpenRouter', async () => {
    studentKey.save(GEM);
    openRouter.save(OR1);
    fakeFetch({ gemini: () => json(429, { error: { message: 'Quota exceeded: generate_requests_per_day' } }), or: () => orOk('backup answer') });
    expect(await callGeminiClient('You are a teacher', 'What is 2+2?')).toBe('backup answer');
    expect(calls[0].url).toContain('generativelanguage'); // Gemini was tried first
    expect(studentKey.getAll().map((k) => studentKey.status(k))).toEqual(['daily-limit']);
    const or = calls.find((c) => c.url.includes('chat/completions'))!;
    expect((or.body?.messages as Array<{ role: string }>).map((m) => m.role)).toEqual(['system', 'user']);
  });

  it('a photo question goes to a free model that can read pictures', async () => {
    openRouter.save(OR1);
    fakeFetch({ or: () => orOk('It is a triangle.') }); // no Gemini key at all
    expect(await callGeminiClientVision('sys', 'What shape?', 'QUJD', 'image/jpeg')).toBe('It is a triangle.');
    const or = calls.find((c) => c.url.includes('chat/completions'))!;
    expect(or.body?.model).toBe('google/gemma-3-27b-it:free');
    expect(JSON.stringify(or.body?.messages)).toContain('data:image/jpeg;base64,QUJD');
  });

  it('JSON requests ask for JSON and come back without fences', async () => {
    openRouter.save(OR1);
    fakeFetch({ or: () => orOk('```json\n{"ok":true}\n```') });
    expect(await callGeminiClient('Make a quiz', 'x', undefined, { json: true })).toBe('{"ok":true}');
  });

  it('without an OpenRouter key the student sees the usual Gemini message', async () => {
    fakeFetch({});
    await expect(callGeminiClient('s', 'u')).rejects.toThrow(/No Gemini API key is saved/);
    expect(calls.some((c) => c.url.includes('openrouter'))).toBe(false);
  });

  it('when both fail, the message names both', async () => {
    studentKey.save(GEM);
    openRouter.save(OR1);
    fakeFetch({ gemini: () => json(429, { error: { message: 'Quota exceeded: generate_requests_per_day' } }), or: () => json(400, { error: { message: 'bad request' } }) });
    await expect(callGeminiClient('s', 'u')).rejects.toThrow(/Gemini keys[\s\S]*OpenRouter backup also failed/);
  });
});
