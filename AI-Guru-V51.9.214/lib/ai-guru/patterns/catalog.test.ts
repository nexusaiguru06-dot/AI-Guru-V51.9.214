import { describe, expect, it } from 'vitest';
import { PATTERNS, buildPattern, getPattern, matchesSignals } from './catalog';
import { verifyVisualActions } from './verify';

describe('pattern catalog', () => {
  it('has unique ids and complete metadata for search and prompts', () => {
    expect(new Set(PATTERNS.map((p) => p.id)).size).toBe(PATTERNS.length);
    for (const p of PATTERNS) {
      expect(p.name.length, p.id).toBeGreaterThan(5);
      expect(p.whenToUse.length, p.id).toBeGreaterThan(20);
      expect(p.concepts.length, p.id).toBeGreaterThanOrEqual(3);
      expect(p.params.length, p.id).toBeGreaterThan(0);
      expect(Object.keys(p.example).length, p.id).toBeGreaterThan(0);
    }
  });

  for (const p of PATTERNS) {
    it(`${p.id}: example builds drawable, in-frame, unique-id actions (dry run passes with no errors or warnings)`, () => {
      const actions = p.build(p.example);
      expect(actions.length).toBeGreaterThan(2);
      const res = verifyVisualActions(actions);
      expect(res.errors, JSON.stringify(res.errors)).toHaveLength(0);
      expect(res.warnings, JSON.stringify(res.warnings)).toHaveLength(0);
    });

    it(`${p.id}: empty and garbage parameters never throw and never produce an undrawable action`, () => {
      for (const params of [{}, { min: 'abc', max: NaN, n: -5, k: 99, marks: 'x', values: 'oops', labels: 7, a: {}, top: null, side: [], curve: 5 }, { xMin: 5, xMax: -5, from: 'q', to: [], angle: 999 }]) {
        const actions = p.build(params as never);
        const res = verifyVisualActions(actions);
        expect(res.errors, `${p.id} ${JSON.stringify(res.errors)}`).toHaveLength(0);
      }
    });
  }

  it('prefixes ids so two steps can share one figure without clashes', () => {
    const a = buildPattern('number-line', {}, 'step1-nl'), b = buildPattern('number-line', {}, 'step2-nl');
    const ids = new Set([...a, ...b].map((x) => x.id));
    expect(ids.size).toBe(a.length + b.length);
    expect(a.every((x) => x.id.startsWith('step1-nl-'))).toBe(true);
  });

  it('labels are absolute SVG text, so they stay where the pattern put them', () => {
    const texts = buildPattern('right-triangle', getPattern('right-triangle')!.example).filter((x) => x.type === 'write');
    expect(texts.length).toBeGreaterThan(4);
    expect(texts.every((t) => t.type === 'write' && t.placement === 'absolute' && typeof t.color === 'string')).toBe(true);
  });

  it('uses the real numbers given: legs 3 and 4 make a 3:4 triangle, an open circle marks x > 3', () => {
    const tri = buildPattern('right-triangle', { a: 3, b: 4, c: 5 }).filter((x) => x.type === 'line');
    const len = (l: any) => Math.hypot(l.endX - l.startX, l.endY - l.startY);
    const [horiz, vert] = [tri[0], tri[1]];
    expect(len(horiz) / len(vert)).toBeCloseTo(4 / 3, 1);
    const nl = buildPattern('number-line', { min: 0, max: 6, ray: { from: 3, direction: 'right', closed: false } });
    const circles = nl.filter((x) => x.type === 'shape' && x.shape === 'circle');
    expect(circles.length).toBeGreaterThan(0);
    expect(circles[circles.length - 1]).toMatchObject({ fill: '#0b1017' });
  });

  it('coordinate plane draws y = x + 2 through the y-intercept', () => {
    const acts = buildPattern('coordinate-plane', { xMin: -4, xMax: 6, yMin: -3, yMax: 8, curve: { type: 'linear', m: 1, c: 2 }, showIntercepts: true });
    const texts = acts.filter((x) => x.type === 'write').map((x: any) => x.content);
    expect(texts).toContain('(0, 2)');
    expect(texts).toContain('(-2, 0)');
  });

  it('strong signals fire for real teaching steps and stay silent for plain arithmetic', () => {
    const fires = (id: string, text: string) => matchesSignals(getPattern(id)!, text);
    expect(fires('balance-scale', 'subtract 5 from both sides')).toBe(true);
    expect(fires('right-triangle', 'use the Pythagoras theorem')).toBe(true);
    expect(fires('coordinate-plane', 'find the slope and y-intercept')).toBe(true);
    expect(fires('number-line', 'represent x > 3 on the number line')).toBe(true);
    expect(fires('area-model', 'expand (x+3)(x+2)')).toBe(true);
    expect(fires('number-line-jumps', 'work out 5 + (-8)')).toBe(true);
    expect(fires('number-line-jumps', '2x + 5 - 5 = 20 - 5')).toBe(false);
    for (const p of PATTERNS) expect(matchesSignals(p, 'add the numbers 12 + 15 = 27'), p.id).toBe(false);
  });

  it('unknown pattern ids build nothing instead of throwing', () => {
    expect(buildPattern('nope', {})).toEqual([]);
  });
});
