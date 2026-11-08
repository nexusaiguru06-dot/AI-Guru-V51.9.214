import { describe, expect, it } from 'vitest';
import { microBlock, microClassPlan, microTask } from './micro';
import { compileClass } from '../class';

const sketch = {
  dna: 'ai-sketch',
  newDna: { name: 'Cross multiplication', description: 'x', keywords: ['cross'] },
  read: { en: 'What is cross multiplication?', ml: 'ക്രോസ് ഗുണനം എന്താണ്?' },
  teach: {
    height: 300,
    objects: [
      { id: 'a', kind: 'text', x: 150, y: 100, text: '2' },
      { id: 'b', kind: 'text', x: 350, y: 100, text: '3' },
      { id: 'c', kind: 'line', x1: 180, y1: 120, x2: 320, y2: 200 },
    ],
    steps: [
      { say: { en: 'Two fractions meet in the middle.', ml: 'രണ്ട് ഭിന്നസംഖ്യകൾ നടുവിൽ കാണുന്നു.' }, do: [{ show: ['a', 'b'] }] },
      { say: { en: 'Multiply across the diagonal.', ml: 'വികർണ്ണമായി ഗുണിക്കുക.' }, do: [{ show: ['c'] }] },
    ],
  },
};

describe('micro class', () => {
  it('asks the AI for any template or a free sketch, and keeps the doubt', () => {
    const t = microTask({ doubt: 'what is cross multiplication?', chapterTitle: 'Pairs', sectionTitle: 'Elimination', nowOnBoard: 'cross multiply both the equations' });
    expect(t).toMatch(/STUDENT'S DOUBT/);
    expect(t).toMatch(/ai-sketch/);
    expect(t).toMatch(/cross multiply both/);
  });
  it('plans with an injected llm, validates, and compiles to a class', async () => {
    const r = await microClassPlan({ doubt: 'what is cross multiplication?', chapterTitle: 'Pairs', sectionTitle: 'Elimination' }, async () => JSON.stringify(sketch), { maxAttempts: 1 });
    expect(r.errors).toEqual([]);
    expect(r.plan.source).toBe('ai');
    expect(r.plan.dna).toBe('ai-sketch');
    const plans = new Map([[r.block.id, r.plan]]);
    const segs = compileClass([r.block], plans, { title: 'Micro' }, { order: 'per-language', languages: ['en', 'ml'], mistakes: false });
    expect(segs.length).toBeGreaterThan(0);
  });
  it('falls back (not source ai) when the AI keeps failing', async () => {
    const r = await microClassPlan({ doubt: 'x', chapterTitle: 'c', sectionTitle: 's' }, async () => 'no json', { maxAttempts: 1 });
    expect(r.plan.source).not.toBe('ai');
    expect(microBlock('hello').text).toBe('hello');
  });
});
