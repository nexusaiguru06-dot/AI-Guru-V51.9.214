import { describe, it, expect } from 'vitest';
import { buildDnaScenes } from './dna/builders';
import { offlineConceptBoard } from './plan/offline';
import { validatePlan } from './plan/validate';
import { timelineReport } from './plan/timeline-qa';

const TEXTS: Record<string, string> = {
  flow: 'First, the plant takes in water through its roots. Then the water travels up the stem to the leaves. Next, the leaves absorb sunlight and carbon dioxide. Finally, the leaf makes glucose and releases oxygen.',
  cycle: 'The sun heats water in the sea and it evaporates. The vapour rises and condenses into clouds. The clouds give rain on the land. The rivers carry the water back to the sea and the cycle repeats.',
  timeline: 'In 1857 the first War of Independence began. In 1885 the Indian National Congress was founded. In 1919 the Jallianwala Bagh massacre took place. In 1947 India became independent.',
};
describe('subject-neutral concept layouts', () => {
  for (const [layout, text] of Object.entries(TEXTS)) {
    it(`${layout}: offline planner picks it, plan validates, scenes build in both languages without overlap`, () => {
      const plan = offlineConceptBoard(text, 'Test');
      expect(plan.layout).toBe(layout);
      for (const lang of ['en', 'ml'] as const) {
        const scenes = buildDnaScenes('concept-board', plan, lang, 'qa');
        expect(scenes.length).toBeGreaterThan(0);
        for (const sc of scenes) expect(timelineReport(sc).ok).toBe(true);
      }
      expect(validatePlan('concept-board', plan, { en: text }, false)).toEqual([]);
    });
  }
});

import { passageBlocks } from './passage';
import { offlinePlan } from './plan/offline';
import { compileClass } from './class';

describe('RAG Classroom passage → Motion Class lesson (any subject)', () => {
  for (const [name, text] of Object.entries(TEXTS)) {
    it(`${name} passage compiles to scenes with captions`, () => {
      const blocks = passageBlocks(text, 'Heading', 'k');
      expect(blocks.length).toBeGreaterThan(0);
      const plans = new Map(blocks.map((b) => [b.id, offlinePlan(b, 'Chapter', 'Heading')]));
      const segs = compileClass(blocks, plans, { title: 'T' }, { order: 'per-language', languages: ['en'] });
      expect(segs.length).toBeGreaterThan(0);
    });
  }
});

describe('bilingual class order (V51.9.52 board)', () => {
  it('English teaching first, then the same lesson in Malayalam', () => {
    const blocks = passageBlocks(TEXTS.flow, 'Heading', 'bi');
    const plans = new Map(
      blocks.map((b) => {
        const p = offlinePlan(b, 'Chapter', 'Heading');
        const withMl = JSON.parse(JSON.stringify(p), (_k, v) => (v && typeof v === 'object' && typeof v.en === 'string' && v.ml === undefined ? { ...v, ml: `മലയാളം ${v.en}` } : v));
        return [b.id, withMl] as const;
      }),
    );
    const segs = compileClass(blocks, plans, { title: 'T' }, { order: 'per-language', languages: ['en', 'ml'] });
    const langs = segs.map((s) => s.lang);
    expect(langs).toContain('en');
    expect(langs).toContain('ml');
    expect(langs.lastIndexOf('en')).toBeLessThan(langs.indexOf('ml'));
  });
});
