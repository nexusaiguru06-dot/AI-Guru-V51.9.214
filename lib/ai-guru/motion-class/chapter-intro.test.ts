import { describe, expect, it } from 'vitest';
import { PAIRS_INTRO_SAMPLE } from './samples/chapter-intro';
import { validatePlan } from './plan/validate';
import { buildDnaScenes } from './dna/builders';
import { chapterIntroPlan, introBlock } from './plan/chapter-intro';
import { introProblems, pairFacts, solveFacts } from './dna/ci-math';
import { compileClass } from './class';
import { splitRuns } from './board-kind';
import type { BlockPlan } from './dna/types';

describe('chapter-intro DNA', () => {
  it('the golden sample is valid and draws a title, one card per topic and a recap', () => {
    expect(validatePlan('chapter-intro', PAIRS_INTRO_SAMPLE, { en: 'x', ml: 'എക്സ്' })).toEqual([]);
    for (const lang of ['en', 'ml'] as const) {
      const scenes = buildDnaScenes('chapter-intro', PAIRS_INTRO_SAMPLE, lang, 'Pairs of Equations');
      expect(scenes).toHaveLength(PAIRS_INTRO_SAMPLE.topics.length + 2);
      for (const s of scenes) {
        expect(s.durationMs).toBeGreaterThan(2000);
        expect(s.captions.length).toBeGreaterThan(0);
      }
    }
  });

  it('computes the examples: 2x − 10 = 100 → x = 55 and x + y = 100, x − y = 10 → (55, 45)', () => {
    const s = solveFacts({ a: 2, b: -10, c: 100 })!;
    expect([s.first, s.moved, s.answer, s.check]).toEqual(['2x − 10 = 100', '2x = 110', 'x = 55', '2 × 55 − 10 = 100']);
    const p = pairFacts({ a: 1, b: 1, c: 100 }, { a: 1, b: -1, c: 10 })!;
    expect([p.l1, p.l2, p.answer]).toEqual(['x + y = 100', 'x − y = 10', 'x = 55,  y = 45']);
  });

  it('rejects examples that do not come out whole, and bad plans', () => {
    expect(solveFacts({ a: 3, b: 0, c: 10 })).toBeNull();
    expect(pairFacts({ a: 1, b: 1, c: 10 }, { a: 2, b: 2, c: 20 })).toBeNull();
    const bad = { ...PAIRS_INTRO_SAMPLE, topics: PAIRS_INTRO_SAMPLE.topics.slice(0, 1), formulas: ['$bad$ {x}'] };
    expect(introProblems(bad).length).toBeGreaterThanOrEqual(2);
  });

  it('is made from a chapter\'s own sections: topics from the headings, examples from the equations', () => {
    const plan = chapterIntroPlan('Pairs of Equations', [
      { heading: 'Mental math and algebra', text: 'Taking the number of black beads as x, the number of white is x - 10. We can extract x from this: 2x - 10 = 100' },
      { heading: 'Two unknowns', text: 'Sum x + y = 100 and difference x - y = 10 give x = 55.' },
      { heading: 'Word problems', text: 'A story with no equation.' },
    ])!;
    expect(plan).not.toBeNull();
    expect(plan.topics.map((t) => t.name.en)).toEqual(['Mental math and algebra', 'Two unknowns', 'Word problems']);
    expect(plan.topics[0].example).toMatchObject({ kind: 'solve', a: 2, b: -10, c: 100 });
    expect(plan.topics[1].example).toMatchObject({ kind: 'pair' });
    expect(plan.topics[2].example).toBeUndefined();
    expect(introProblems(plan)).toEqual([]);
    expect(chapterIntroPlan('A chapter', [{ heading: 'Only one', text: '' }])).toBeNull();
  });

  it('plays first on the lecture board when put in front of the section blocks', () => {
    const { block, plan } = introBlock(PAIRS_INTRO_SAMPLE);
    const plans = new Map<string, BlockPlan>([[block.id, plan]]);
    expect(splitRuns([block], plans)).toEqual([{ kind: 'lecture', blocks: [block] }]);
    const segs = compileClass([block], plans, { title: 'Pairs of Equations' }, { order: 'per-language', languages: ['en', 'ml'] });
    expect(segs.map((s) => `${s.phase}:${s.lang}`)).toEqual(['teach:en', 'teach:ml']);
    expect(segs[0].build().length).toBe(PAIRS_INTRO_SAMPLE.topics.length + 2);
  });
});
