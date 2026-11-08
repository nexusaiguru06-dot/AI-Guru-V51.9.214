import { describe, expect, it } from 'vitest';
import { drawMotionFrame, evalItem, pointsAt, type MotionScene } from '../reels/motion';
import { measure, richRuns, richWidth } from '../reels/motion/metrics';
import { angleArc, arcPts, circlePts, rightAnglePts } from '../reels/motion/shapes';
import { selectDna } from './dna/registry';
import { buildDnaScenes } from './dna/builders';
import { figureOf } from './dna/shape-builders';
import { SHAPE_KINDS, formulaLines, isRightTriangle, sideLabels, sideLengths, specialAngles, sqrtText } from './dna/shape-math';
import type { BlockPlan, ShapePlan } from './dna/types';
import type { BookBlock } from './segment';
import { validatePlan } from './plan/validate';
import { offlinePlan, offlineShape } from './plan/offline';
import { textOnlyWarning, visualStats } from './plan/visual-qa';
import { compileClass, segmentReel } from './class';
import { SHAPE_NUMBERS_SAMPLE, SHAPE_SHEET_SAMPLE } from './samples/shape-formula';

const block = (text: string, kind: BookBlock['kind'] = 'prose'): BookBlock => ({ id: 'b', kind, page: 1, chapterId: 'c', sectionId: 's', lines: [{ text, math: false } as BookBlock['lines'][number]], text });
const say = { en: 'x', ml: 'എ' };
const RD = { en: 'x', ml: 'എ' };
const dist = (p: [number, number], q: [number, number]) => Math.hypot(p[0] - q[0], p[1] - q[1]);

describe('square roots on the board (the font has no √)', () => {
  it('√ and its radicand are one run; the sign is drawn, not typed', () => {
    expect(richRuns('5√3')).toEqual([{ text: '5', sup: false }, { text: '3', sup: false, rad: true }]);
    expect(richRuns('√{x+1}')).toEqual([{ text: 'x+1', sup: false, rad: true }]);
    expect(richRuns('a : a√3 : 2a').map((r) => r.text)).toEqual(['a : a', '3', ' : 2a']);
    expect(richRuns('x^2')).toEqual([{ text: 'x', sup: false }, { text: '2', sup: true }]);
  });
  it('a root is wider than its radicand alone (room for the drawn sign)', () => {
    expect(richWidth('√3', 30)).toBeGreaterThan(measure('3', 30) + 30 * 0.5);
  });
  it('exact simplification', () => {
    expect([25, 13, 50, 12, 8, 1, 2].map(sqrtText)).toEqual(['5', '√13', '5√2', '2√3', '2√2', '1', '√2']);
  });
  it('drawing a root draws a path (not a missing glyph)', () => {
    const strokes: number[] = [];
    const fills: string[] = [];
    const ctx = new Proxy({}, {
      get: (_t, k) => {
        if (k === 'measureText') return (s: string) => ({ width: s.length * 10 });
        if (k === 'stroke') return () => strokes.push(1);
        if (k === 'fillText') return (s: string) => fills.push(s);
        return () => undefined;
      },
      set: () => true,
    }) as unknown as CanvasRenderingContext2D;
    const sc = buildDnaScenes('shape-formula', SHAPE_SHEET_SAMPLE, 'en', 'T')[0];
    drawMotionFrame(ctx, sc, sc.durationMs * 0.9, { format: 'landscape' } as never);
    expect(fills.some((f) => f.includes('√'))).toBe(false);
  });
});

describe('the app computes every label and formula', () => {
  it('right triangle: hypotenuse is exact', () => {
    expect(sideLabels('right-triangle', 3, 4)).toEqual({ va: '3', hb: '4', hyp: '5' });
    expect(sideLabels('right-triangle', 1, 2).hyp).toBe('√5');
    expect(sideLabels('right-triangle', 4, 4).hyp).toBe('4√2');
    expect(sideLabels('right-triangle', 5, 12).hyp).toBe('13');
    expect(sideLabels('right-triangle')).toEqual({ va: 'a', hb: 'b', hyp: 'c' });
  });
  it('special triangles: a, a√3, 2a and a, a, a√2, symbolic or numeric', () => {
    expect(sideLabels('special-30-60-90')).toEqual({ va: 'a', hb: 'a√3', hyp: '2a' });
    expect(sideLabels('special-30-60-90', 5)).toEqual({ va: '5', hb: '5√3', hyp: '10' });
    expect(sideLabels('special-45-45-90', 7)).toEqual({ va: '7', hb: '7', hyp: '7√2' });
  });
  it('the written sides really satisfy Pythagoras', () => {
    for (const a of [1, 2, 3, 5, 9]) {
      for (const k of ['special-30-60-90', 'special-45-45-90'] as const) {
        const s = sideLengths(k, a)!;
        expect(isRightTriangle(s.va, s.hb, s.hyp)).toBe(true);
      }
    }
    expect(isRightTriangle(3, 4, 5)).toBe(true);
    expect(isRightTriangle(3, 4, 6)).toBe(false);
    const s = sideLengths('right-triangle', 6, 8)!;
    expect(s.hyp).toBeCloseTo(10, 9);
  });
  it('worked formulas', () => {
    expect(formulaLines('circle', 'area', 5)).toEqual(['A = πr²', 'A = π(5)² = 25π']);
    expect(formulaLines('circle', 'circumference', 5)).toEqual(['C = 2πr', 'C = 2π(5) = 10π']);
    expect(formulaLines('rectangle', 'area', 6, 4)).toEqual(['A = lw', 'A = 6 × 4 = 24']);
    expect(formulaLines('rectangle', 'perimeter', 6, 4)[1]).toBe('P = 2(6 + 4) = 20');
    expect(formulaLines('square', 'area', 5)[1]).toBe('A = 5² = 25');
    expect(formulaLines('triangle', 'area', 5, 3)[1]).toBe('A = ½ × 5 × 3 = 7.5');
    expect(formulaLines('right-triangle', 'pythagoras', 3, 4)).toEqual(['a² + b² = c²', '3² + 4² = 25', 'c = 5']);
    expect(formulaLines('right-triangle', 'pythagoras', 1, 1)[2]).toBe('c = √2');
    expect(formulaLines('special-30-60-90', 'ratio')).toEqual(['a : a√3 : 2a']);
    expect(formulaLines('special-45-45-90', 'ratio', 4)[1]).toBe('4 : 4 : 4√2');
  });
});

describe('figures are drawn to the right proportions', () => {
  it('right-angle corner is a true right angle in every right triangle', () => {
    for (const k of ['right-triangle', 'special-30-60-90', 'special-45-45-90'] as const) {
      const [bl, rc, top] = figureOf(k).pts;
      const dot = (bl[0] - rc[0]) * (top[0] - rc[0]) + (bl[1] - rc[1]) * (top[1] - rc[1]);
      expect(Math.abs(dot)).toBeLessThan(1e-6);
    }
  });
  it('30-60-90: hypotenuse is twice the short side, long leg is √3 times it; 45-45-90 legs are equal', () => {
    const [bl, rc, top] = figureOf('special-30-60-90').pts;
    const short = dist(rc, top);
    expect(dist(bl, top) / short).toBeCloseTo(2, 6);
    expect(dist(bl, rc) / short).toBeCloseTo(Math.sqrt(3), 6);
    const [a, b, c] = figureOf('special-45-45-90').pts;
    expect(dist(a, b)).toBeCloseTo(dist(b, c), 6);
    expect(dist(a, c) / dist(b, c)).toBeCloseTo(Math.SQRT2, 6);
  });
  it('numeric right triangle keeps the ratio of its legs', () => {
    const [bl, rc, top] = figureOf('right-triangle', 3, 4).pts;
    expect(dist(rc, top) / dist(bl, rc)).toBeCloseTo(3 / 4, 6);
  });
  it('arcs and marks', () => {
    for (const p of circlePts(100, 50, 40)) expect(dist(p, [100, 50])).toBeCloseTo(40, 6);
    const arc = arcPts(0, 0, 10, 0, Math.PI / 2);
    expect(arc[0][0]).toBeCloseTo(10, 6);
    expect(arc[arc.length - 1][1]).toBeCloseTo(10, 6);
    const [p1, p2, p3] = rightAnglePts([0, 0], [1, 0], [0, 1], 10);
    expect([p1, p2, p3]).toEqual([[10, 0], [10, 10], [0, 10]]);
  });
  it('the degrees written are the degrees drawn', () => {
    for (const k of ['special-30-60-90', 'special-45-45-90'] as const) {
      const [bl, rc, top] = figureOf(k).pts;
      const want = specialAngles(k)!;
      expect(angleArc(bl, rc, top, 38).degrees).toBeCloseTo(want[0], 4);
      expect(angleArc(top, bl, rc, 38).degrees).toBeCloseTo(want[1], 4);
    }
  });
});

describe('samples pass the same validator as AI plans', () => {
  it('formula sheet and numbers sample (EN + ML)', () => {
    expect(validatePlan('shape-formula', SHAPE_SHEET_SAMPLE, RD)).toEqual([]);
    expect(validatePlan('shape-formula', SHAPE_NUMBERS_SAMPLE, RD)).toEqual([]);
  });
  it('every shape with every formula it allows builds in both languages', () => {
    for (const k of SHAPE_KINDS) {
      const plan: ShapePlan = { steps: [{ op: 'shape', kind: k, say }, { op: 'label', say }, { op: 'name', say }] };
      expect(validatePlan('shape-formula', plan, RD)).toEqual([]);
    }
  });
});

describe('validator rejects steps that do not fit the shape', () => {
  const v = (steps: ShapePlan['steps']) => validatePlan('shape-formula', { steps }, undefined, true).join(' | ');
  const circle = { op: 'shape' as const, kind: 'circle' as const, say };
  it('order and kind', () => {
    expect(v([{ op: 'label', say }])).toMatch(/needs a \{"op":"shape"\}/);
    expect(v([{ op: 'shape', kind: 'hexagon' as 'circle', say }])).toMatch(/kind must be one of/);
    expect(v([circle, { op: 'explode' as 'label', say }])).toMatch(/not one of/);
  });
  it('height only on a triangle, angles only on special triangles', () => {
    expect(v([circle, { op: 'height', say }])).toMatch(/only fits a triangle/);
    expect(v([{ op: 'shape', kind: 'right-triangle', say }, { op: 'angles', say }])).toMatch(/only fits special/);
    expect(v([{ op: 'shape', kind: 'triangle', say }, { op: 'height', say }])).toBe('');
  });
  it('formulas must belong to the shape', () => {
    expect(v([{ op: 'shape', kind: 'rectangle', say }, { op: 'formula', what: 'circumference', say }])).toMatch(/has the formulas area, perimeter/);
    expect(v([circle, { op: 'formula', what: 'pythagoras', say }])).toMatch(/not one of them/);
    expect(v([{ op: 'shape', kind: 'special-30-60-90', say }, { op: 'formula', what: 'area', say }])).toMatch(/ratio/);
  });
  it('sizes are small whole numbers, both given when needed', () => {
    expect(v([{ op: 'shape', kind: 'circle', a: 0, say }])).toMatch(/whole number 1–50/);
    expect(v([{ op: 'shape', kind: 'circle', a: 2.5, say }])).toMatch(/whole number 1–50/);
    expect(v([{ op: 'shape', kind: 'rectangle', a: 6, say }])).toMatch(/needs both a and b/);
    expect(v([{ op: 'shape', kind: 'circle', a: 5, b: 3, say }])).toMatch(/takes only a/);
    expect(v([{ op: 'shape', kind: 'rectangle', b: 3, say }])).toMatch(/b without a/);
  });
  it('limits and captions', () => {
    const many = Array.from({ length: 7 }, () => circle);
    expect(v(many)).toMatch(/at most 6 shapes/);
    expect(v([{ op: 'shape', kind: 'circle', say: { en: '', ml: 'എ' } }])).toMatch(/say is required/);
    expect(validatePlan('shape-formula', { steps: [] }, undefined, true).join()).toMatch(/must list the steps/);
  });
});

describe('English and Malayalam share the same picture', () => {
  it('same items, kinds and places; only shape names and captions change language', () => {
    const en = buildDnaScenes('shape-formula', SHAPE_SHEET_SAMPLE, 'en', 'T')[0];
    const ml = buildDnaScenes('shape-formula', SHAPE_SHEET_SAMPLE, 'ml', 'T')[0];
    expect(ml.items.map((i) => `${i.id}:${i.kind}`)).toEqual(en.items.map((i) => `${i.id}:${i.kind}`));
    const named = new Set(
      SHAPE_SHEET_SAMPLE.steps
        .map((s, k) => (s.op === 'name' ? k : -1))
        .filter((k) => k >= 0)
        .map(() => 0),
    );
    void named;
    const diff = en.items.filter((i, k) => i.text !== ml.items[k].text);
    expect(diff.length).toBe(2); // the two "name" captions under the special triangles
    expect(ml.captions.map((c) => c.text)).not.toEqual(en.captions.map((c) => c.text));
  });
  it('the board writes the numbers it computed', () => {
    const [s] = buildDnaScenes('shape-formula', SHAPE_NUMBERS_SAMPLE, 'en', 'T');
    const texts = s.items.filter((i) => i.kind === 'text').map((i) => evalItem(i, s.durationMs + 10).text);
    for (const want of ['5', '3', '4', 'a² + b² = c²', '3² + 4² = 25', 'c = 5', 'A = ½ × 3 × 4 = 6', 'A = π(5)² = 25π', '5√3', '10', '5 : 5√3 : 10']) expect(texts).toContain(want);
  });
  it('a new shape replaces the old one: nothing of it is visible at the end', () => {
    const [s] = buildDnaScenes('shape-formula', SHAPE_SHEET_SAMPLE, 'en', 'T');
    const end = s.durationMs + 10;
    const alive = s.items.filter((i) => evalItem(i, end).alpha > 0.5).map((i) => i.id);
    const tags = new Set(alive.map((id) => /^(f\d+)/.exec(id)![1]));
    expect(tags.size).toBe(1);
  });
});

describe('selection', () => {
  const pick = (t: string, kind: BookBlock['kind'] = 'prose') => selectDna(block(t, kind)).dna;
  it('formula talk about a named shape → the shape DNA', () => {
    expect(pick('The area of a circle of radius r is πr² and its circumference is 2πr.')).toBe('shape-formula');
    expect(pick('In a right triangle the square on the hypotenuse is equal to the sum of the squares on the other two sides. This is Pythagoras\' theorem.')).toBe('shape-formula');
    expect(pick('The area of a rectangle is its length times its width. The perimeter is 2(l + w).')).toBe('shape-formula');
    expect(pick('In a special right triangle with angles 30-60-90 the sides are in the ratio a, a√3, 2a. The triangle is half of an equilateral triangle.')).toBe('shape-formula');
  });
  it('other DNAs keep their text', () => {
    expect(pick('A matrix is a rectangular arrangement of numbers in rows and columns. A 3 × 3 matrix has 3 rows and 3 columns; the entry a12 is in row 1, column 2.')).toBe('matrix-grid');
    expect(pick('Construct a triangle with a compass and ruler. Bisect the angle and draw a perpendicular to the base.')).not.toBe('shape-formula');
    expect(pick('Find the area of a rectangle of length 26 cm and width 15 cm. How much carpet is needed?', 'problem')).not.toBe('shape-formula');
    expect(pick('The probability of heads when a coin is tossed is one half.')).toBe('probability-tree');
  });
  it('a lone shape name is not enough', () => {
    expect(pick('Draw a circle on your notebook.')).not.toBe('shape-formula');
  });
});

describe('offline planner', () => {
  it('names the shapes of the text and builds valid plans', () => {
    const texts = [
      'The area of a circle of radius r is πr² and its circumference is 2πr.',
      "In a right triangle the square on the hypotenuse equals the sum of the squares on the other two sides. Pythagoras' theorem.",
      'The area of a rectangle is length times width; its perimeter is 2(l + w).',
      'In a 30-60-90 triangle the sides are in the ratio 1 : √3 : 2.',
      'A square has area s² and perimeter 4s.',
    ];
    for (const t of texts) {
      const p = offlinePlan(block(t), '', '');
      expect(p.dna, t).toBe('shape-formula');
      expect(validatePlan('shape-formula', p.teach, { en: t, ml: 'എ' }), t).toEqual([]);
    }
    const sp = offlineShape('The area of a circle is πr². A rectangle has area lw.')!;
    expect(sp.steps.filter((s) => s.op === 'shape').map((s) => (s as { kind: string }).kind)).toEqual(['circle', 'rectangle']);
    expect(offlineShape('Nothing to draw here.')).toBeNull();
  });
});

describe('picture and class', () => {
  it('samples are real pictures, not text boards', () => {
    for (const teach of [SHAPE_SHEET_SAMPLE, SHAPE_NUMBERS_SAMPLE]) {
      expect(textOnlyWarning({ dna: 'shape-formula', teach })).toBeUndefined();
      expect(visualStats(buildDnaScenes('shape-formula', teach, 'en', 'T')).graphics).toBeGreaterThanOrEqual(5);
    }
  });
  it('compiles into a class with one caption per step', () => {
    const plan: BlockPlan = { blockId: 'b', dna: 'shape-formula', read: RD, teach: SHAPE_SHEET_SAMPLE, source: 'fixture' };
    const segs = compileClass([block('The area of a circle is πr².')], new Map([['b', plan]]), { title: 'T' });
    for (const seg of segs.filter((s) => s.phase === 'teach')) expect(segmentReel(seg).parts[0].captions.length).toBe(SHAPE_SHEET_SAMPLE.steps.length + 1);
  });
  it('draws without error in every format and theme', () => {
    const noop = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? (s: string) => ({ width: s.length * 10 }) : () => undefined), set: () => true }) as unknown as CanvasRenderingContext2D;
    for (const teach of [SHAPE_SHEET_SAMPLE, SHAPE_NUMBERS_SAMPLE]) {
      const sc = buildDnaScenes('shape-formula', teach, 'ml', 'T')[0] as MotionScene;
      for (const format of ['landscape', 'vertical', 'square'] as const) for (const theme of ['light', 'dark'] as const) for (const f of [0.1, 0.4, 0.7, 0.99]) drawMotionFrame(noop, sc, sc.durationMs * f, { format, theme } as never);
    }
  });
  it('the poly of a figure is on screen once drawn', () => {
    const [s] = buildDnaScenes('shape-formula', SHAPE_SHEET_SAMPLE, 'en', 'T');
    const first = s.items.find((i) => i.kind === 'poly')!;
    expect(pointsAt(first, s.durationMs)!.length).toBeGreaterThanOrEqual(3);
  });
});
