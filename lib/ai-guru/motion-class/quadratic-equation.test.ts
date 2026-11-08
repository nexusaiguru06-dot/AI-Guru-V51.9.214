import { describe, expect, it } from 'vitest';
import { drawMotionFrame, evalItem, type MotionScene } from '../reels/motion';
import { tokenWidth } from '../reels/motion/metrics';
import { selectDna } from './dna/registry';
import { buildDnaScenes } from './dna/builders';
import { disc, factoring, factoringZero, formulaWork, graphWindow, isRoot, parseQuad, polyText, ratValue, rationalRoots, roots, sqrtExact, vertex, checkText, type Quad } from './dna/q-math';
import { LMAX, LX } from './dna/q-builders';
import type { BlockPlan, QuadPlan } from './dna/types';
import type { BookBlock } from './segment';
import { validatePlan } from './plan/validate';
import { offlinePlan, offlineQuad } from './plan/offline';
import { textOnlyWarning, visualStats } from './plan/visual-qa';
import { compileClass, segmentReel } from './class';
import { QUAD_FACTOR_SAMPLE, QUAD_FORMULA_SAMPLE, QUAD_NOROOT_SAMPLE } from './samples/quadratic-equation';

const block = (text: string, kind: BookBlock['kind'] = 'prose'): BookBlock => ({ id: 'b', kind, page: 1, chapterId: 'c', sectionId: 's', lines: [{ text, math: false } as BookBlock['lines'][number]], text });
const say = { en: 'x', ml: 'എ' };
const RD = { en: 'x', ml: 'എ' };

describe('the algebra is exact (brute force)', () => {
  it('roots satisfy the equation exactly, and factoring always works when D is a perfect square', () => {
    let n = 0;
    for (let a = -6; a <= 6; a++) {
      if (!a) continue;
      for (let b = -20; b <= 20; b++) for (let c = -36; c <= 36; c++) {
        const q: Quad = { a, b, c };
        const D = disc(q);
        const k = sqrtExact(D);
        if (k === null) {
          expect(roots(q)).toEqual([]);
          continue;
        }
        n++;
        const rs = roots(q);
        expect(rs.length).toBe(k === 0 ? 1 : 2);
        for (const r of rs) expect(isRoot(q, r), `${a},${b},${c}`).toBe(true);
        if (rs.length === 2) expect(ratValue(rs[0])).toBeLessThan(ratValue(rs[1]));
        if (c !== 0) {
          const f = factoring(q);
          expect(f, `${a},${b},${c}`).not.toBeNull();
          const { g1, a1, m1, g2, m, n: nn } = f!;
          expect(g1 * a1).toBe(a);
          expect(g1 * m1 + g2 * a1).toBe(b);
          expect(g2 * m1).toBe(c);
          expect(m + nn).toBe(b);
          expect(m * nn).toBe(a * c);
          expect(f!.lines.length).toBe(4);
          const got = [f!.r1, f!.r2].map(ratValue).sort((x, y) => x - y);
          expect(got[0]).toBeCloseTo(ratValue(rs[0]), 9);
          expect(got[1]).toBeCloseTo(ratValue(rs[rs.length - 1]), 9);
        }
      }
    }
    expect(n).toBeGreaterThan(1000);
  });
  it('lines read as maths', () => {
    expect(factoring({ a: 1, b: -5, c: 6 })!.lines).toEqual(['x^2 − 2x − 3x + 6 = 0', 'x(x − 2) − 3(x − 2) = 0', '(x − 3)(x − 2) = 0', 'x − 3 = 0   or   x − 2 = 0']);
    expect(factoringZero({ a: 2, b: -6, c: 0 })!.r2).toEqual({ n: 3, d: 1 });
    expect(polyText({ a: -2, b: 0, c: 3 })).toBe('−2x^2 + 3');
    expect(polyText({ a: 1, b: 0, c: 0 })).toBe('x^2');
    expect(formulaWork({ a: 2, b: -3, c: -2 }).discLines).toEqual(['D = b² − 4ac', 'D = (−3)² − 4(2)(−2)', 'D = 25']);
    expect(checkText({ a: 1, b: -5, c: 6 }, 2)).toBe('(2)² − 5(2) + 6 = 0');
    expect(rationalRoots({ a: 1, b: 2, c: 5 })).toBe(false);
  });
  it('the graph window shows the vertex, roots and both axes', () => {
    for (let a = -6; a <= 6; a += 1) for (let b = -20; b <= 20; b += 3) for (let c = -36; c <= 36; c += 5) {
      if (!a) continue;
      const q = { a, b, c };
      const w = graphWindow(q);
      const { h, k } = vertex(q);
      expect(w.xMin).toBeLessThanOrEqual(0 + (Math.abs(h) > 0 ? Math.abs(h) : 0));
      expect(h).toBeGreaterThanOrEqual(w.xMin);
      expect(h).toBeLessThanOrEqual(w.xMax);
      expect(k).toBeGreaterThanOrEqual(w.yMin);
      expect(k).toBeLessThanOrEqual(w.yMax);
      expect(w.yMin).toBeLessThanOrEqual(0);
      expect(w.yMax).toBeGreaterThanOrEqual(0);
      for (const r of roots(q)) {
        expect(ratValue(r)).toBeGreaterThanOrEqual(w.xMin);
        expect(ratValue(r)).toBeLessThanOrEqual(w.xMax);
      }
    }
  });
  it('parseQuad reads plain equations only', () => {
    expect(parseQuad('Solve x² − 5x + 6 = 0.')).toEqual({ a: 1, b: -5, c: 6 });
    expect(parseQuad('2x^2-3x-2=0')).toEqual({ a: 2, b: -3, c: -2 });
    expect(parseQuad('−x² + 4 = 0')).toEqual({ a: -1, b: 0, c: 4 });
    expect(parseQuad('3x² + 6x = 0')).toEqual({ a: 3, b: 6, c: 0 });
    expect(parseQuad('x² = 9')).toBeNull();
    expect(parseQuad('5x + 6 = 0')).toBeNull();
    expect(parseQuad('no equation here')).toBeNull();
  });
});

describe('validator', () => {
  const v = (plan: unknown) => validatePlan('quadratic-equation', plan, undefined, true).join(' | ');
  const show = { op: 'show' as const, say };
  const plan = (steps: QuadPlan['steps'], over: Partial<QuadPlan> = {}): QuadPlan => ({ a: 1, b: -5, c: 6, steps, ...over });
  it('samples pass', () => {
    for (const p of [QUAD_FACTOR_SAMPLE, QUAD_FORMULA_SAMPLE, QUAD_NOROOT_SAMPLE]) expect(validatePlan('quadratic-equation', p, RD)).toEqual([]);
  });
  it('numbers', () => {
    expect(v(plan([show], { a: 0 }))).toMatch(/a must be/);
    expect(v(plan([show], { a: 7 }))).toMatch(/a must be/);
    expect(v(plan([show], { b: 21 }))).toMatch(/b must be/);
    expect(v(plan([show], { c: 37 }))).toMatch(/c must be/);
    expect(v(plan([show], { c: 1.5 }))).toMatch(/whole numbers/);
  });
  it('order and arguments', () => {
    expect(v(plan([{ op: 'graph', say }]))).toMatch(/needs \{"op":"show"\}/);
    expect(v(plan([show, show]))).toMatch(/only once/);
    expect(v(plan([show, { op: 'roots', say }]))).toMatch(/needs "graph"/);
    expect(v(plan([show, { op: 'factorise', say }], { b: 2, c: 5 }))).toMatch(/perfect square/);
    expect(v(plan([show, { op: 'factorise', say }], { b: 0, c: 0 }))).toMatch(/nothing to split/);
    expect(v(plan([show, { op: 'graph', say }, { op: 'roots', say }], { b: 2, c: 5 }))).toMatch(/perfect square/);
    expect(v(plan([show, { op: 'check', say }], { a: 2, b: -3, c: -2 }))).toMatch(/whole/);
    expect(v(plan([show, { op: 'spin' as 'show', say }]))).toMatch(/not one of/);
    expect(v(plan([show, { op: 'graph', say: { en: '', ml: 'എ' } }]))).toMatch(/say is required/);
    expect(v(plan([]))).toMatch(/must list the steps/);
  });
});

describe('what the board shows', () => {
  const [s] = buildDnaScenes('quadratic-equation', QUAD_FACTOR_SAMPLE, 'en', 'T');
  const [f] = buildDnaScenes('quadratic-equation', QUAD_FORMULA_SAMPLE, 'en', 'T');
  const [z] = buildDnaScenes('quadratic-equation', QUAD_NOROOT_SAMPLE, 'en', 'T');
  const vis = (sc: MotionScene, t: number) => sc.items.filter((i) => i.kind === 'text').map((i) => evalItem(i, t)).filter((st) => st.alpha > 0.5);
  const at = (sc: MotionScene, k: number, title: boolean) => sc.captions[k + (title ? 1 : 0)].t1 - 40;
  it('equation, discriminant, factoring, roots and check are written by the app', () => {
    const t = (k: number) => vis(s, at(s, k, true)).map((q) => q.text);
    expect(t(0)).toContain('x^2 − 5x + 6 = 0');
    for (const w of ['D = b² − 4ac', 'D = (−5)² − 4(1)(6)', 'D = 1', 'D > 0']) expect(t(2)).toContain(w);
    expect(t(3)).toContain('(x − 3)(x − 2) = 0');
    expect(t(3).join('|')).toContain('x =|2|or|x =|3');
    expect(t(5)).toContain('(2)² − 5(2) + 6 = 0');
    expect(t(5)).toContain('(3)² − 5(3) + 6 = 0');
  });
  it('the formula steps show the fraction and a negative D stops', () => {
    const fv = vis(f, at(f, 2, false)).map((q) => q.text);
    // typeset since V51.9.48: the formula and the numbers are glyphs with a fraction bar and a root sign
    expect(fv).toContain('±');
    expect(fv).toContain('D');
    expect(fv.join('')).toContain('3±5');
    expect(f.items.some((i) => i.kind === 'poly' || i.kind === 'line')).toBe(true);
    const last = vis(z, at(z, 3, false)).map((q) => q.text);
    expect(last).toContain('D = −16');
    expect(last).toContain('D < 0');
    expect(last.some((x) => x.startsWith('x ='))).toBe(false);
  });
  it('the curve is purple and clipped to the graph; root dots sit on the x-axis', () => {
    const cur = s.items.filter((i) => i.kind === 'poly' && evalItem(i, s.durationMs + 10).color.toLowerCase() === '#9d3bc8');
    expect(cur.length).toBeGreaterThan(0);
    const dots = s.items.filter((i) => i.kind === 'dot' && /rt\d/.test(i.id)).map((d) => evalItem(d, s.durationMs + 10));
    expect(dots.length).toBe(2);
    expect(Math.abs(dots[0].y - dots[1].y)).toBeLessThan(1e-6);
    expect(dots[1].x).toBeGreaterThan(dots[0].x);
  });
  it('nothing overlaps or leaves its area', () => {
    for (const [sc, title] of [[s, true], [f, false], [z, false]] as const) for (let k = 0; k < sc.captions.length; k++) {
      const t = sc.captions[k].t1 - 40;
      void title;
      const st = vis(sc, t).map((q) => {
        const w = tokenWidth(q.text, q.size);
        return { q, l: q.x - w / 2, r: q.x + w / 2 };
      });
      for (const b of st) {
        expect(b.l, b.q.text).toBeGreaterThan(2);
        expect(b.r, b.q.text).toBeLessThan(718);
      }
      for (const b of st.filter((x) => x.q.y > 90 && Math.abs(x.l - LX) < 2)) expect(b.r, b.q.text).toBeLessThanOrEqual(LX + LMAX + 1);
      for (let i = 0; i < st.length; i++) for (let j = i + 1; j < st.length; j++) {
        if (Math.abs(st[i].q.y - st[j].q.y) > 10) continue;
        const gap = Math.max(st[i].l, st[j].l) - Math.min(st[i].r, st[j].r);
        expect(gap, `${st[i].q.text} / ${st[j].q.text} at ${t}`).toBeGreaterThanOrEqual(-1e-6);
      }
    }
  });
  it('English and Malayalam pictures are identical; only captions differ', () => {
    const ml = buildDnaScenes('quadratic-equation', QUAD_FACTOR_SAMPLE, 'ml', 'T')[0];
    expect(ml.items.map((i) => `${i.id}:${i.kind}:${i.text}`)).toEqual(s.items.map((i) => `${i.id}:${i.kind}:${i.text}`));
    expect(ml.captions.map((c) => c.text)).not.toEqual(s.captions.map((c) => c.text));
  });
});

describe('selection', () => {
  const pick = (t: string, kind: BookBlock['kind'] = 'prose') => selectDna(block(t, kind)).dna;
  it('quadratic talk → quadratic-equation', () => {
    expect(pick('A quadratic equation is an equation of the form ax² + bx + c = 0.')).toBe('quadratic-equation');
    expect(pick('Find the discriminant of 2x² − 3x − 2 = 0 and the roots.', 'exercise')).toBe('quadratic-equation');
    expect(pick('Solve by factorising: x² − 5x + 6 = 0', 'exercise')).toBe('quadratic-equation');
  });
  it('the same words elsewhere stay elsewhere', () => {
    expect(pick('The square roots of 49 are 7 and −7.')).not.toBe('quadratic-equation');
    expect(pick('A parabola is a curve.')).not.toBe('quadratic-equation');
    expect(pick('The graph of a quadratic polynomial is a curve called a parabola.')).not.toBe('quadratic-equation');
    expect(pick('A pair of linear equations in two variables can be solved by the graphical method.')).toBe('linear-system');
    expect(pick('In an arithmetic sequence each term is got by adding the common difference.')).toBe('arithmetic-sequence');
  });
});

describe('offline planner', () => {
  it('reads the equation from the text', () => {
    const p = offlineQuad('Solve x² − 5x + 6 = 0 by factorising.')!;
    expect(p).toMatchObject({ a: 1, b: -5, c: 6 });
    expect(p.steps.map((x) => x.op)).toEqual(['show', 'graph', 'discriminant', 'factorise', 'roots', 'check']);
    expect(validatePlan('quadratic-equation', p, RD)).toEqual([]);
    const g = offlineQuad('2x² − 3x − 2 = 0')!;
    expect(g.steps.map((x) => x.op)).toEqual(['show', 'graph', 'discriminant', 'factorise', 'roots']);
    expect(validatePlan('quadratic-equation', g, RD)).toEqual([]);
    const n = offlineQuad('x² + 2x + 5 = 0')!;
    expect(n.steps.map((x) => x.op)).toEqual(['show', 'graph', 'discriminant', 'formula']);
    expect(validatePlan('quadratic-equation', n, RD)).toEqual([]);
    expect(offlineQuad('Quadratic equations are important.')).toBeNull();
    expect(offlineQuad('x² − 5x + 600 = 0')).toBeNull();
  });
  it('falls back with a warning when no equation is given', () => {
    const pl = offlinePlan(block('We study quadratic equations and the discriminant.'), '', '');
    expect(pl.dna).toBe('concept-board');
    expect(pl.warnings?.join()).toMatch(/AI planner needed/);
    expect(offlinePlan(block('Solve x² − 5x + 6 = 0.', 'exercise'), '', '').dna).toBe('quadratic-equation');
  });
});

describe('picture and class', () => {
  const ALL = [QUAD_FACTOR_SAMPLE, QUAD_FORMULA_SAMPLE, QUAD_NOROOT_SAMPLE];
  it('samples are real pictures', () => {
    for (const teach of ALL) {
      expect(textOnlyWarning({ dna: 'quadratic-equation', teach })).toBeUndefined();
      expect(visualStats(buildDnaScenes('quadratic-equation', teach, 'en', 'T')).graphics).toBeGreaterThanOrEqual(4);
    }
  });
  it('compiles into a class with one caption per step', () => {
    const plan: BlockPlan = { blockId: 'b', dna: 'quadratic-equation', read: RD, teach: QUAD_FACTOR_SAMPLE, source: 'fixture' };
    const segs = compileClass([block('Quadratic equations.')], new Map([['b', plan]]), { title: 'T' });
    for (const seg of segs.filter((x) => x.phase === 'teach')) expect(segmentReel(seg).parts[0].captions.length).toBe(QUAD_FACTOR_SAMPLE.steps.length + 1);
  });
  it('draws without error in every format and theme', () => {
    const noop = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? (x: string) => ({ width: x.length * 10 }) : () => undefined), set: () => true }) as unknown as CanvasRenderingContext2D;
    for (const teach of ALL) {
      const sc = buildDnaScenes('quadratic-equation', teach, 'ml', 'T')[0];
      for (const format of ['landscape', 'vertical', 'square'] as const) for (const theme of ['light', 'dark'] as const) for (const f of [0.1, 0.4, 0.7, 0.99]) drawMotionFrame(noop, sc, sc.durationMs * f, { format, theme } as never);
    }
  });
  it('builds and validates for many coefficients', () => {
    for (let a = -6; a <= 6; a += 1) for (let b = -20; b <= 20; b += 5) for (let c = -36; c <= 36; c += 9) {
      if (!a) continue;
      const q = { a, b, c };
      const rat = rationalRoots(q);
      const whole = rat && roots(q).every((r) => r.d === 1);
      const steps: QuadPlan['steps'] = [{ op: 'show', say }, { op: 'graph', say }, { op: 'discriminant', say }];
      if (rat && !(b === 0 && c === 0)) steps.push({ op: 'factorise', say });
      else steps.push({ op: 'formula', say });
      if (rat) steps.push({ op: 'roots', say });
      if (whole) steps.push({ op: 'check', say });
      const plan: QuadPlan = { ...q, steps };
      expect(validatePlan('quadratic-equation', plan, RD), JSON.stringify(q)).toEqual([]);
      expect(() => buildDnaScenes('quadratic-equation', plan, 'en', 'T'), JSON.stringify(q)).not.toThrow();
    }
  });
});
