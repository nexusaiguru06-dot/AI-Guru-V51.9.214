/** V51.9.177 — the server's Gemini call used by study materials made on the AI Guru cloud. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { geminiTextServer } from './gemini-text-server';

afterEach(() => vi.restoreAllMocks());

describe('geminiTextServer', () => {
  it('sends the system text, the prompt and JSON mode with the given key, and returns the text', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"ok":' }, { text: 'true}' }] } }] }), { status: 200 }));
    expect(await geminiTextServer('be a teacher', 'make mcq', { json: true, geminiKey: 'k-123', maxOutputTokens: 500 })).toBe('{"ok":true}');
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('key=k-123');
    const body = JSON.parse(String(init.body));
    expect(body.systemInstruction.parts[0].text).toBe('be a teacher');
    expect(body.generationConfig).toMatchObject({ responseMimeType: 'application/json', maxOutputTokens: 500 });
  });
  it('fails clearly without a key or on an error reply', async () => {
    await expect(geminiTextServer('s', 'p', {})).rejects.toThrow('No Gemini key');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('quota', { status: 429 }));
    await expect(geminiTextServer('s', 'p', { geminiKey: 'k', task: 'MCQ' })).rejects.toThrow('Gemini 429 (MCQ)');
  });
});
