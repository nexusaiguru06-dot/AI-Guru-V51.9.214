import { describe, expect, it } from 'vitest';
import { evalItem, drawMotionFrame, pointsAt, type MotionScene } from '../reels/motion';
import { blockFeatures, selectDna } from './dna/registry';
import { buildDnaScenes } from './dna/builders';
import { mean, median, parseQ, qAdd, qMul, qNorm } from './dna/board-builders';
import type { BlockPlan, FractionPlan, HistogramPlan, TreePlan } from './dna/types';
import type { BookBlock } from './segment';
import { validatePlan } from './plan/validate';
import { offlineFractions, offlinePlan } from './plan/offline';
import { textOnlyWarning, visualStats } from './plan/visual-qa';
import { compileClass, segmentReel } from './class';
import { BAG_TREE_SAMPLE, COIN_TREE_SAMPLE, FRACTION_GRID_SAMPLE, FRACTION_SAMPLE, HISTOGRAM_SAMPLE } from './samples/fractions-stats';

const block = (kind: BookBlock['kind'], text: string): BookBlock => ({
  id: 'b',
  kind,
  page: 1,
  chapterId: 'c',
  sectionId: 's',
  lines: text.split('\n').map((t) => ({ text: t, math: false }) as BookBlock['lines'][number]),
  text,
});
const say = { en: 'x', ml: 'എ' };
const RD = { en: 'x', ml: 'എ' };
const end = (s: MotionScene) => s.durationMs + 10;
const item = (s: MotionScene, id: string) => s.items.find((i) => i.id === id)!;
const state = (s: MotionScene, id: string) => evalItem(item(s, id), end(s));
const ys = (s: MotionScene, id: string) => (pointsAt(item(s, id), end(s)) ?? []).map((p) => Math.round(p[1] * 10) / 10);
const xs = (s: MotionScene, id: string) => (pointsAt(item(s, id), end(s)) ?? []).map((p) => Math.round(p[0] * 10) / 10);

describe('samples pass the same validator as AI plans', () => {
  const cases: Array<[Parameters<typeof validatePlan>[0], unknown]> = [
    ['fraction-bars', FRACTION_SAMPLE],
    ['fraction-bars', FRACTION_GRID_SAMPLE],
    ['histogram', HISTOGRAM_SAMPLE],
    ['probability-tree', COIN_TREE_SAMPLE],
    ['probability-tree', BAG_TREE_SAMPLE],
  ];
  cases.forEach(([dna, plan], i) => it(`${dna} #${i} (EN + ML)`, () => expect(validatePlan(dna, plan, RD)).toEqual([])));
});

describe('exact fractions', () => {
  it('parse, normalise, multiply, add', () => {
    expect(parseQ('{3/4}')).toEqual([3, 4]);
    expect(parseQ(' 2 / 5 ')).toEqual([2, 5]);
    expect(parseQ('0.5')).toBeNull();
    expect(parseQ('1/0')).toBeNull();
    expect(qNorm([6, 8])).toEqual([3, 4]);
    expect(qMul([2, 5], [1, 4])).toEqual([1, 10]);
    expect(qAdd([1, 4], [1, 4])).toEqual([1, 2]);
  });
});

describe('fractions: the numbers on the bars are true', () => {
  const [s] = buildDnaScenes('fraction-bars', FRACTION_SAMPLE, 'en', 'T');
  it('cutting a bar changes the label, not the shaded width', () => {
    expect(state(s, 'fb0l').text).toBe('{2/4}');
    expect(xs(s, 'fb0s')).toEqual([90, 310, 310, 90]); // 2 of 4 of 440 = 220
  });
  it('cutting adds dividers only inside the old parts (never over an old divider)', () => {
    const cuts = s.items.filter((i) => /^fs\d+$/.test(i.id));
    expect(cuts).toHaveLength(2); // 2 → 4 parts: new lines at 1/4 and 3/4 only
    expect(cuts.map((c) => xs(s, c.id)[0]).sort((a, b) => a - b)).toEqual([200, 420]);
  });
  it('joining adds the shaded parts end to end', () => {
    expect(state(s, 'fb3l').text).toBe('{3/4}');
    expect(xs(s, 'fb3s')).toEqual([90, 420, 420, 90]); // 3 of 4 = 330
    const flying = s.items.filter((i) => /^fj/.test(i.id));
    expect(flying).toHaveLength(2);
    expect(xs(s, flying[0].id)).toEqual([90, 200, 200, 90]); // 1 quarter = 110
    expect(xs(s, flying[1].id)).toEqual([200, 420, 420, 200]); // 2 quarters = 220, after the first
  });
  it('a 10 × 10 grid colours exactly the tiles asked for and writes decimal and percent', () => {
    const [g] = buildDnaScenes('fraction-bars', FRACTION_GRID_SAMPLE, 'en', 'T');
    const tiles = g.items.filter((i) => /^fg\d+_\d+$/.test(i.id));
    expect(tiles).toHaveLength(100);
    expect(tiles.filter((i) => evalItem(i, end(g)).fillAlpha > 0.3)).toHaveLength(35);
    expect(state(g, 'fgl').text).toBe('{35/100}');
    expect(state(g, 'fgd').text).toBe('= 0.35');
    expect(state(g, 'fgp').text).toBe('= 35%');
  });
  it('no decimal is invented for tiles that are not tenths or hundredths', () => {
    const [g] = buildDnaScenes('fraction-bars', { steps: [{ op: 'grid', rows: 2, cols: 3, shade: 3, say }] }, 'en', 'T');
    expect(g.items.some((i) => i.id === 'fgd')).toBe(false);
    expect(g.items.some((i) => i.id === 'fgp')).toBe(false);
  });
});

describe('histogram: mean and median are computed, and follow a change', () => {
  const [s] = buildDnaScenes('histogram', HISTOGRAM_SAMPLE, 'en', 'T');
  it('helpers', () => {
    expect(mean([4, 8, 6, 6, 6])).toBe(6);
    expect(median([4, 8, 6, 6, 6])).toBe(6);
    expect(median([1, 2, 3, 10])).toBe(2.5);
  });
  it('after the change: mean 7.2, median still 6, bar 0 is full height', () => {
    expect(state(s, 'hl0t').text).toBe('mean = 7.2');
    expect(state(s, 'hl1t').text).toBe('median = 6');
    expect(state(s, 'hv0').text).toBe('10');
    expect(ys(s, 'hb0')[0]).toBe(40); // top of the axis (yMax 10)
    expect(ys(s, 'hb1')[0]).toBeCloseTo(340 - 8 * 30, 0);
    expect(ys(s, 'hl0')[0]).toBeCloseTo(340 - 7.2 * 30, 0); // the mean line has slid
    expect(ys(s, 'hl1')[0]).toBeCloseTo(340 - 6 * 30, 0);
  });
});

describe('probability tree: products and sums are exact', () => {
  const rows = (s: MotionScene) => s.items.filter((i) => /^trow/.test(i.id)).map((i) => i.text);
  it('coin: a path multiplies, an event adds, the ends total 1', () => {
    const [s] = buildDnaScenes('probability-tree', COIN_TREE_SAMPLE, 'en', 'T');
    const all = rows(s).join(' ');
    expect(all).toContain('{1/4}');
    expect(all).toContain('{3/4}'); // at least one head
    expect(state(s, 'tl0').text).toBe('{1/4}');
    expect(rows(s).slice(-1)).toEqual(['1']); // the last row ends "… = 1"
  });
  it('bag without replacement: second draw changes the chances', () => {
    const [s] = buildDnaScenes('probability-tree', BAG_TREE_SAMPLE, 'en', 'T');
    expect(rows(s)).toContain('{1/10}'); // 2/5 × 1/4
    expect(['tl0', 'tl1', 'tl2', 'tl3'].map((id) => state(s, id).text)).toEqual(['{1/10}', '{3/10}', '{3/10}', '{3/10}']);
    expect(rows(s).slice(-1)).toEqual(['1']);
  });
});

describe('validator rejects plans that cannot be right', () => {
  const v = (dna: Parameters<typeof validatePlan>[0], plan: unknown) => validatePlan(dna, plan, undefined, true).join(' | ');
  it('fractions', () => {
    const f = (steps: FractionPlan['steps']): FractionPlan => ({ steps });
    expect(v('fraction-bars', f([{ op: 'bar', n: 30, shade: 1, say }]))).toMatch(/1–24/);
    expect(v('fraction-bars', f([{ op: 'bar', n: 4, shade: 5, say }]))).toMatch(/0–4/);
    expect(v('fraction-bars', f([{ op: 'split', bar: 0, by: 2, say }]))).toMatch(/draw a bar first/);
    expect(v('fraction-bars', f([{ op: 'bar', n: 4, shade: 1, say }, { op: 'bar', n: 6, shade: 1, say }, { op: 'join', a: 0, b: 1, say }]))).toMatch(/Cut them/);
    expect(v('fraction-bars', f([{ op: 'bar', n: 4, shade: 3, say }, { op: 'bar', n: 4, shade: 3, say }, { op: 'join', a: 0, b: 1, say }]))).toMatch(/more than the whole/);
    expect(v('fraction-bars', f([{ op: 'bar', n: 12, shade: 1, say }, { op: 'split', bar: 0, by: 3, say }]))).toMatch(/too many/);
    expect(v('fraction-bars', f([{ op: 'bar', n: 2, shade: 1, say }, { op: 'grid', rows: 2, cols: 2, shade: 1, say }]))).toMatch(/do not mix/);
    expect(v('fraction-bars', f([{ op: 'grid', rows: 11, cols: 10, shade: 1, say }]))).toMatch(/1–10/);
  });
  it('histogram', () => {
    const h = (steps: HistogramPlan['steps'], over: Partial<HistogramPlan> = {}): HistogramPlan => ({ categories: ['A', 'B', 'C'], yMax: 10, steps, ...over });
    expect(v('histogram', h([{ op: 'bars', values: [1, 2, 99], say }]))).toMatch(/between 0 and yMax/);
    expect(v('histogram', h([{ op: 'bars', values: [1, 2], say }]))).toMatch(/3 numbers/);
    expect(v('histogram', h([{ op: 'mean', say }]))).toMatch(/needs the bars/);
    expect(v('histogram', h([{ op: 'bars', values: [1, 2, 3], say }, { op: 'bars', values: [1, 2, 3], say }]))).toMatch(/only once/);
    expect(v('histogram', h([{ op: 'bars', values: [1, 2, 3], say }, { op: 'change', index: 5, to: 1, say }]))).toMatch(/bar number/);
    expect(v('histogram', h([{ op: 'axes', say }], { categories: ['A'] }))).toMatch(/2–12/);
    expect(v('histogram', h([{ op: 'axes', say }], { categories: ['A', 'a-very-long-label'] }))).toMatch(/8 characters/);
  });
  it('tree', () => {
    const t = (branches: TreePlan['branches'], steps: TreePlan['steps']): TreePlan => ({ branches, steps });
    const g = (levels: number): TreePlan['steps'][number] => ({ op: 'grow', levels, say });
    expect(v('probability-tree', t([{ label: 'H', p: '1/2' }, { label: 'T', p: '1/3' }], [g(1)]))).toMatch(/exactly 1/);
    expect(v('probability-tree', t([{ label: 'H', p: '0.5' }, { label: 'T', p: '1/2' }], [g(1)]))).toMatch(/fraction/);
    const two = [{ label: 'H', p: '1/2', children: [{ label: 'H', p: '1/2' }, { label: 'T', p: '1/2' }] }, { label: 'T', p: '1/2' }];
    expect(v('probability-tree', t(two, [g(2), { op: 'path', path: [0], say }]))).toMatch(/stops before the end/);
    expect(v('probability-tree', t(two, [g(1), { op: 'path', path: [1], say }]))).toMatch(/grow the tree/);
    expect(v('probability-tree', t(two, [g(2), { op: 'path', path: [1, 0], say }]))).toMatch(/no branch/);
    expect(v('probability-tree', t(two, [g(9)]))).toMatch(/levels must be/);
    expect(v('probability-tree', t(two, [g(2), { op: 'explode' as 'total', say }]))).toMatch(/not one of/);
  });
});

describe('English and Malayalam share the same picture', () => {
  it('same items at the same places; only captions differ', () => {
    for (const [dna, plan] of [['fraction-bars', FRACTION_SAMPLE], ['histogram', HISTOGRAM_SAMPLE], ['probability-tree', BAG_TREE_SAMPLE]] as const) {
      const en = buildDnaScenes(dna, plan, 'en', 'T')[0];
      const ml = buildDnaScenes(dna, plan, 'ml', 'T')[0];
      // The words mean / median on the histogram are translated; everything else is identical.
      const shape = (s: MotionScene) => s.items.map((i) => (/^hl\dt$/.test(i.id) ? `${i.id}:${i.kind}` : `${i.id}:${i.kind}:${i.text}@${Math.round(i.x.at(0))},${Math.round(i.y.at(0))}`));
      expect(shape(ml)).toEqual(shape(en));
      expect(ml.captions.map((c) => c.text)).not.toEqual(en.captions.map((c) => c.text));
    }
  });
});

describe('histogram words are translated, numbers are not', () => {
  it('Malayalam mean / median labels carry the same computed numbers', () => {
    const en = buildDnaScenes('histogram', HISTOGRAM_SAMPLE, 'en', 'T')[0];
    const ml = buildDnaScenes('histogram', HISTOGRAM_SAMPLE, 'ml', 'T')[0];
    expect(state(ml, 'hl0t').text).toBe('ശരാശരി = 7.2');
    expect(state(ml, 'hl1t').text).toBe('മധ്യമം = 6');
    expect(state(en, 'hl0t').text).toBe('mean = 7.2');
  });
});

describe('selection', () => {
  const pick = (kind: BookBlock['kind'], text: string) => selectDna(block(kind, text)).dna;
  it('fractions, data, chance', () => {
    expect(pick('prose', 'The fraction 3/4 means 3 out of 4 equal parts. The numerator is 3 and the denominator is 4.')).toBe('fraction-bars');
    expect(pick('prose', 'The bar graph shows the marks of five children. Find the mean and the median of the data.')).toBe('histogram');
    expect(pick('prose', 'When a coin is tossed, the chance of getting a head is 1/2. The outcomes are head and tail.')).toBe('probability-tree');
  });
  it('algebra and graphs are not hijacked', () => {
    expect(pick('prose', 'We transform the equation 2x − 10 = 100 into 2x = 110 by adding 10 on both sides.')).not.toMatch(/fraction|histogram|probability/);
    expect(pick('prose', 'The graph of the equation y = 2x + 1 is a straight line.')).toBe('function-graph');
    expect(pick('problem', 'There are 100 beads, some black and some white. There are 10 more black beads than white. How many of each are there?')).toBe('word-problem');
  });
  it('features count the evidence', () => {
    const f = blockFeatures(block('prose', 'The chance of an event: favourable outcomes out of all outcomes, for a coin or a die.'));
    expect(f.prob).toBe(true);
    expect(f.probHits).toBeGreaterThanOrEqual(5);
    expect(blockFeatures(block('prose', 'Add the numbers 12, 15 and 9.')).fractions).toBe(false);
    expect(blockFeatures(block('prose', 'On 12/10/2024 we met.')).fractions).toBe(false);
  });
});

describe('offline planner', () => {
  it('draws one bar for each fraction in the text', () => {
    const fr = offlineFractions('Shade 3/4 of the first bar and {1/2} of the second.')!;
    expect(fr.steps).toHaveLength(2);
    expect(fr.steps[0]).toMatchObject({ op: 'bar', n: 4, shade: 3 });
    expect(validatePlan('fraction-bars', fr, undefined, false)).toEqual([]);
    const plan = offlinePlan(block('prose', 'The fraction 3/4 means 3 out of 4 equal parts of a whole.'), 'Fractions', 'S');
    expect(plan.dna).toBe('fraction-bars');
    expect(textOnlyWarning(plan)).toBeUndefined();
  });
  it('declines what it cannot draw', () => {
    expect(offlineFractions('Half of the class is present.')).toBeNull();
    expect(offlineFractions('Improper 7/4 and date 12/10/2024')).toBeNull();
  });
  it('data and chance wait for the AI planner but are flagged, never hidden', () => {
    for (const text of ['The bar graph shows the marks. Find the mean of the data.', 'The chance of an event is the number of favourable outcomes divided by all possible outcomes.']) {
      const plan = offlinePlan(block('prose', text), 'C', 'S');
      expect(plan.dna).toBe('concept-board');
      expect(plan.warnings?.join(' ')).toMatch(/AI planner needed/);
      expect(plan.warnings?.join(' ')).toMatch(/Text-only board/);
    }
  });
});

describe('visual QA and the class', () => {
  const pics: Array<[Parameters<typeof buildDnaScenes>[0], unknown]> = [
    ['fraction-bars', FRACTION_SAMPLE],
    ['fraction-bars', FRACTION_GRID_SAMPLE],
    ['histogram', HISTOGRAM_SAMPLE],
    ['probability-tree', COIN_TREE_SAMPLE],
    ['probability-tree', BAG_TREE_SAMPLE],
  ];
  it('every sample is a picture', () => {
    for (const [dna, plan] of pics) {
      const v = visualStats(buildDnaScenes(dna, plan, 'en', 'T'));
      expect(v.textOnly, `${dna}`).toBe(false);
      expect(v.graphicShare, `${dna}`).toBeGreaterThan(0.5);
    }
  });
  it('compiles Read/Teach in both languages with a caption for every step', () => {
    const plan: BlockPlan = { blockId: 'b', dna: 'histogram', read: { en: 'Marks.', ml: 'മാർക്ക്.' }, teach: HISTOGRAM_SAMPLE, source: 'fixture' };
    const segs = compileClass([block('prose', 'The bar graph shows marks.')], new Map([['b', plan]]), { title: 'T' });
    expect(segs.map((s) => `${s.phase}:${s.lang}`)).toEqual(['read:en', 'teach:en', 'read:ml', 'teach:ml']);
    for (const seg of segs.filter((s) => s.phase === 'teach')) {
      const reel = segmentReel(seg);
      expect(reel.parts[0].captions.length).toBe(HISTOGRAM_SAMPLE.steps.length + 1); // + title
    }
  });
  it('draws in every format without errors', () => {
    const ctx = new Proxy({} as Record<string, unknown>, {
      get: (t, k: string) => {
        if (k === 'measureText') return (s: string) => ({ width: s.length * 8 });
        if (k === 'createLinearGradient') return () => ({ addColorStop() {} });
        if (k in t) return t[k];
        return () => {};
      },
      set: (t, k: string, v) => ((t[k] = v), true),
    }) as unknown as CanvasRenderingContext2D;
    for (const [dna, plan] of pics) {
      const sc = buildDnaScenes(dna, plan, 'ml', 'T')[0];
      for (const format of ['landscape', 'vertical', 'square'] as const) for (const f of [0.1, 0.5, 0.95]) drawMotionFrame(ctx, sc, sc.durationMs * f, { format } as never);
    }
  });
});
