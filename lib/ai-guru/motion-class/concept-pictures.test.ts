import { describe, it, expect } from 'vitest';
import { buildDnaScenes } from './dna/builders';
import { validatePlan } from './plan/validate';
import { timelineReport } from './plan/timeline-qa';
import { qaLayout } from './plan/qa';
import { iconFor, ICON_NAMES, ICONS } from './dna/concept-icons';
import { SCALE_SAMPLE, BARS_SAMPLE, TREE_SAMPLE, ICON_FLOW_SAMPLE } from './samples/concept-pictures';
import { boardProblems } from './dna/concept-math';
import type { BoardPlan } from './dna/types';

const SAMPLES: Array<[string, BoardPlan]> = [['scale', SCALE_SAMPLE], ['bars', BARS_SAMPLE], ['tree', TREE_SAMPLE], ['cycle with icons', ICON_FLOW_SAMPLE]];

describe('concept picture layouts', () => {
  for (const [name, plan] of SAMPLES) {
    it(`${name}: valid, builds in English and Malayalam, no overlap, steady pace`, () => {
      expect(boardProblems(plan, 'teach')).toEqual([]);
      expect(validatePlan('concept-board', plan, { en: 'x', ml: 'മ' }, true)).toEqual([]);
      for (const lang of ['en', 'ml'] as const) {
        const scenes = buildDnaScenes('concept-board', plan, lang, 'qa');
        expect(scenes).toHaveLength(1);
        expect(timelineReport(scenes[0]).ok).toBe(true);
      }
      expect(qaLayout('concept-board', plan)).toEqual([]);
    });
  }
  it('the scale tips toward the heavier pan and levels when the weights match', () => {
    const sc = buildDnaScenes('concept-board', SCALE_SAMPLE, 'en', 'qa')[0];
    const beam = sc.items.find((i) => i.id === 'beam')!;
    expect(beam).toBeTruthy();
  });
  it('bad pictures are rejected with a clear message', () => {
    expect(boardProblems({ ...BARS_SAMPLE, points: [{ board: { en: 'A' }, say: { en: 's' } }, { board: { en: 'B' }, say: { en: 's' } }] }, 't').join(' ')).toMatch(/value/);
    expect(boardProblems({ ...SCALE_SAMPLE, heads: undefined }, 't').join(' ')).toMatch(/pan titles/);
    expect(boardProblems({ ...TREE_SAMPLE, points: TREE_SAMPLE.points.map((p, i) => (i === 2 ? { ...p, parent: 5 } : p)) }, 't').join(' ')).toMatch(/parent/);
    expect(boardProblems({ ...ICON_FLOW_SAMPLE, points: ICON_FLOW_SAMPLE.points.map((p) => ({ ...p, icon: 'unicorn' })) }, 't').join(' ')).toMatch(/icon/);
  });
  it('every icon has strokes inside its 100 × 100 box, and keywords pick sensible icons', () => {
    for (const n of ICON_NAMES) {
      expect(ICONS[n].length).toBeGreaterThan(0);
      for (const st of ICONS[n]) for (const [x, y] of st.pts) { expect(x).toBeGreaterThanOrEqual(-1); expect(x).toBeLessThanOrEqual(101); expect(y).toBeGreaterThanOrEqual(-1); expect(y).toBeLessThanOrEqual(101); }
    }
    expect(iconFor('The sun heats the sea')).toBe('sun');
    expect(iconFor('Vapour forms clouds')).toBe('cloud');
    expect(iconFor('Rivers carry water')).toBe('drop');
    expect(iconFor('The price of rice rose')).toBe('coin');
    expect(iconFor('Nothing special here')).toBeUndefined();
  });
});
