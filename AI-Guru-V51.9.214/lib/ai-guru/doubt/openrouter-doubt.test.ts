// @vitest-environment node
/** V51.9.200 — doubts with an OpenRouter key: the messages for one turn, and the text read aloud. */
import { describe, expect, it } from 'vitest';
import { doubtMessages, speakable } from './openrouter-doubt';

describe('OpenRouter doubts', () => {
  it('system, the last four turns, then the question with the camera photo', () => {
    const hist = Array.from({ length: 6 }, (_, i) => ({ q: `q${i}`, a: `a${i}` }));
    const m = doubtMessages('You are AI Guru.', hist, 'Why is line 3 wrong?', 'QUJD', 'Board: Part 2, page 14');
    expect(m[0]).toMatchObject({ role: 'system' });
    expect(String(m[0].content)).toMatch(/turn by turn/);
    expect(m.slice(1, -1).map((x) => x.content)).toEqual(['q2', 'a2', 'q3', 'a3', 'q4', 'a4', 'q5', 'a5']);
    const last = m[m.length - 1];
    expect(Array.isArray(last.content)).toBe(true);
    const parts = last.content as Array<{ type: string; text?: string; image_url?: { url: string } }>;
    expect(parts[0].text).toMatch(/Why is line 3 wrong\?[\s\S]*Board: Part 2, page 14[\s\S]*my camera shows/);
    expect(parts[1].image_url?.url).toBe('data:image/jpeg;base64,QUJD');
  });
  it('a typed question without a photo is plain text', () => {
    expect(doubtMessages('S', [], 'What is a prime?').at(-1)).toEqual({ role: 'user', content: 'What is a prime?' });
  });
  it('reads aloud without markdown marks', () => {
    expect(speakable('**Step 1:** add $x$ to `both` sides')).toBe('Step 1: add x to both sides');
  });
});
