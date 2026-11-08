import { describe, expect, it, vi } from 'vitest';
import { Motion } from '../reels/motion/engine';
import { aiPlanBlock, regenerateBlock, type Llm } from './plan/ai';
import { LAYOUT_QA_DNAS, bilingualPairs, qaCaptions, qaLayout, qaPlan } from './plan/qa';
import type { SqPlan } from './dna/types';
import type { BookBlock } from './segment';
import { SQ_SUM_SAMPLE, SQ_DIFF_SAMPLE } from './samples/square-identity';

const block: BookBlock = { id: 'q1', kind: 'result', page: 1, chapterId: 'c', sectionId: 's', lines: [{ text: '(a + b)² = a² + 2ab + b²', math: false } as BookBlock['lines'][number]], text: 'The square of a sum: (a + b)² = a² + 2ab + b² for all numbers a and b.' };
const ctx = { chapterTitle: 'Algebraic identities', sectionTitle: 'Squares' };
const read = { en: block.text, ml: 'തുകയുടെ വർഗം: (a + b)² = a² + 2ab + b² (എല്ലാ സംഖ്യകൾക്കും).' };
const answer = (teach: SqPlan) => JSON.stringify({ dna: 'square-identity', read, teach });
const scripted = (answers: string[]): Llm & { calls: string[] } => {
  const calls: string[] = [];
  const fn = (async (_s: string, user: string) => { calls.push(user); return answers[Math.min(calls.length - 1, answers.length - 1)]; }) as Llm & { calls: string[] };
  fn.calls = calls;
  return fn;
};
const withCaption = (p: SqPlan, i: number, en: string, ml?: string): SqPlan => {
  const c = structuredClone(p);
  c.steps[i].say = { en, ml: ml ?? c.steps[i].say.ml };
  return c;
};
const LONG = Array.from({ length: 55 }, (_, i) => `word${i}`).join(' ');

describe('quality checks', () => {
  it('good plans pass', () => {
    expect(qaPlan('square-identity', SQ_SUM_SAMPLE, read)).toEqual([]);
    expect(qaPlan('square-identity', SQ_DIFF_SAMPLE, read)).toEqual([]);
  });
  it('finds the bilingual pairs wherever they are', () => {
    const pairs = bilingualPairs(SQ_SUM_SAMPLE);
    expect(pairs.length).toBe(SQ_SUM_SAMPLE.steps.length + 1);
    expect(pairs[0].path).toBe('teach.title');
  });
  it('a caption that is a paragraph is a problem', () => {
    const p = qaCaptions(withCaption(SQ_SUM_SAMPLE, 1, LONG));
    expect(p.join()).toMatch(/steps\[1\]\.say\.en is 55 words/);
    const m = qaCaptions(withCaption(SQ_SUM_SAMPLE, 1, 'Short.', Array.from({ length: 70 }, () => 'വാക്ക്').join(' ')));
    expect(m.join()).toMatch(/\.ml is 70 words/);
  });
  it('English phrases inside the Malayalam are a problem', () => {
    const p = qaCaptions(withCaption(SQ_SUM_SAMPLE, 2, 'Fit two rectangles.', 'ഇനി fit the two rectangles along it വയ്ക്കുക.'));
    expect(p.join()).toMatch(/mixes a whole English phrase/);
    // letters and maths symbols are fine
    expect(qaCaptions(withCaption(SQ_SUM_SAMPLE, 2, 'Fit.', 'a, b എന്നിവ (a + b)² ആണ്.'))).toEqual([]);
  });
  it('the same caption on step after step is a problem', () => {
    const c = structuredClone(SQ_SUM_SAMPLE);
    for (const i of [1, 2, 3]) c.steps[i].say = { en: 'Look at the picture carefully now.', ml: 'ചിത്രം ശ്രദ്ധിച്ച് നോക്കൂ.' };
    expect(qaCaptions(c).join()).toMatch(/repeated 3 times/);
  });
  it('layout QA only runs for the DNAs whose layouts are tested', () => {
    expect(LAYOUT_QA_DNAS.has('square-identity')).toBe(true);
    expect(qaLayout('concept-board', SQ_SUM_SAMPLE)).toEqual([]);
    expect(qaLayout('square-identity', SQ_SUM_SAMPLE)).toEqual([]);
    expect(qaLayout('square-identity', null)).toEqual([]); // a plan that cannot be built is the validator's business
  });
});

describe('automatic regeneration after the quality check', () => {
  it('asks again with the reasons, and accepts the corrected plan', async () => {
    const bad = withCaption(SQ_SUM_SAMPLE, 1, LONG);
    const llm = scripted([answer(bad), answer(SQ_SUM_SAMPLE)]);
    const r = await aiPlanBlock(block, ctx, llm);
    expect(r.attempts).toBe(2);
    expect(llm.calls[1]).toContain('quality check');
    expect(llm.calls[1]).toContain('55 words');
    expect(r.plan.source).toBe('ai');
    expect(r.plan.qa).toMatchObject({ attempts: 2, passed: true });
    expect(r.plan.warnings?.join()).toMatch(/Regenerated 1 time\(s\) after the quality check/);
  });
  it('a clean first answer costs one ask and no warning', async () => {
    const llm = scripted([answer(SQ_SUM_SAMPLE)]);
    const r = await aiPlanBlock(block, ctx, llm);
    expect(r.attempts).toBe(1);
    expect(r.plan.qa).toEqual({ attempts: 1, passed: true, notes: [] });
    expect(r.plan.warnings).toBeUndefined();
  });
  it('a valid plan that never gets clean is kept, with the open notes as a warning', async () => {
    const bad = answer(withCaption(SQ_SUM_SAMPLE, 1, LONG));
    const llm = scripted([bad]);
    const r = await aiPlanBlock(block, ctx, llm);
    expect(r.attempts).toBe(3);
    expect(r.plan.source).toBe('ai');
    expect(r.plan.qa?.passed).toBe(false);
    expect(r.plan.warnings?.join()).toMatch(/Quality check still open after 3 tries/);
  });
  it('an invalid plan still falls back to the offline plan after three tries', async () => {
    const wrong = answer({ ...SQ_SUM_SAMPLE, a: 4, b: 4 });
    const r = await aiPlanBlock(block, ctx, scripted([wrong]));
    expect(r.plan.source).toBe('offline');
    expect(r.plan.warnings?.join()).toMatch(/AI plan rejected after 3 tries/);
  });
  it('a validation problem and then a quality problem and then a good plan', async () => {
    const llm = scripted([answer({ ...SQ_SUM_SAMPLE, a: 4, b: 4 }), answer(withCaption(SQ_SUM_SAMPLE, 1, LONG)), answer(SQ_SUM_SAMPLE)]);
    const r = await aiPlanBlock(block, ctx, llm);
    expect(r.attempts).toBe(3);
    expect(r.plan.qa).toMatchObject({ attempts: 3, passed: true });
  });
  it("a teacher's note reaches the model, and the new plan is cached", async () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
    const llm = scripted([answer(SQ_DIFF_SAMPLE)]);
    const r = await regenerateBlock(block, { ...ctx, note: 'use the difference of two numbers' }, llm);
    expect(llm.calls[0]).toContain('TEACHER NOTE (follow it): use the difference of two numbers');
    expect(r.plan.source).toBe('ai');
    expect([...store.values()].join()).toContain('"kind":"difference"');
    vi.unstubAllGlobals();
  });
});

describe('layout check finds overlapping and off-board text', () => {
  it('reports both', async () => {
    vi.resetModules();
    vi.doMock('./dna/builders', () => ({
      buildDnaScenes: () => {
        const m = new Motion('T', 720, 444);
        m.step('one', 300, 1000);
        const a = m.text('a', 'overlap one', 200, 100, { size: 22, color: 'ink' });
        m.text('b', 'overlap two', 215, 104, { size: 22, color: 'ink' });
        m.text('c', 'far away off the board edge', 710, 300, { size: 22, color: 'ink' });
        m.appear(['a', 'b', 'c'], 300, 0, false);
        void a;
        m.hold(1500);
        return [m.build()];
      },
    }));
    const { qaLayout: ql } = await import('./plan/qa');
    const p = ql('square-identity', {});
    expect(p.join(' | ')).toMatch(/overlap one" and "overlap two" overlap/);
    expect(p.join(' | ')).toMatch(/runs off the board/);
    vi.doUnmock('./dna/builders');
    vi.resetModules();
  });
});
