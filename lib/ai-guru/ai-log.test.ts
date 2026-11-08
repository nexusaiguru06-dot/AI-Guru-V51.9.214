// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { aiLogEntries, clearAiLog, logAi, maskKey, onAiLog, shortReason, timedAi } from './ai-log';
import { explain } from '@/components/ai-guru/AiKeysLog';

describe('V51.9.114 AI log', () => {
  beforeEach(() => clearAiLog());
  it('records each call with provider, model, masked key, task, time and the reason it failed', async () => {
    const seen: number[] = [];
    const off = onAiLog((e) => seen.push(e.length));
    logAi({ provider: 'gemini', model: 'gemini-x', key: maskKey('AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ012345'), task: 'MCQ · plan', ok: false, ms: 812, status: 429, error: 'Resource has been exhausted (e.g. check quota). key AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ012345' });
    await timedAi({ provider: 'openai', model: 'gpt-4.1-mini', task: 'MCQ · content' }, async () => 'ok');
    await expect(timedAi({ provider: 'sarvam', model: 'sarvam-105b' }, async () => { throw new Error('Sarvam AI BYOK is not active.'); })).rejects.toThrow();
    off();
    const e = aiLogEntries();
    expect(e.map((x) => [x.provider, x.ok])).toEqual([['gemini', false], ['openai', true], ['sarvam', false]]);
    expect(e[0].key).toBe('AIza…2345');
    expect(e[0].error).not.toContain('ABCDEFGHIJ'); // a full key never lands in the log
    expect(e[0].task).toBe('MCQ · plan');
    expect(seen).toEqual([1, 2, 3]);
  });
  it('explains common failures in plain words', () => {
    expect(explain({ status: 429, error: 'Quota exceeded for metric: generate_requests_per_day' })).toMatch(/today/);
    expect(explain({ status: 429, error: 'Resource has been exhausted' })).toMatch(/minute/);
    expect(explain({ status: 400, error: 'API key not valid. Please pass a valid API key.' })).toMatch(/not valid/);
    expect(explain({ status: 503, error: 'The model is overloaded' })).toMatch(/busy/);
    expect(explain({ error: 'Failed to fetch' })).toMatch(/internet/);
    expect(shortReason(new Error('x'.repeat(500))).length).toBeLessThanOrEqual(220);
  });
  it('keeps at most 300 entries', () => {
    for (let i = 0; i < 320; i++) logAi({ provider: 'gemini', model: 'm', ok: true, ms: 1 });
    expect(aiLogEntries().length).toBe(300);
  });
});
