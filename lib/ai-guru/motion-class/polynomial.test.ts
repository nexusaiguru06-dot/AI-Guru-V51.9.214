import { describe, expect, it } from 'vitest';
import { drawMotionFrame, evalItem, type MotionScene } from '../reels/motion';
import { tokenWidth } from '../reels/motion/metrics';
import { selectDna } from './dna/registry';
import { buildDnaScenes } from './dna/builders';
import { addPoly, degree, divide, evalPoly, factorLines, fullyFactorable, graphWindow, identityOf, integerRoots, mulPoly, negPoly, norm, parsePoly, polyText, realRoots, remainderLines, subPoly, termsOf, type Poly } from './dna/p-math';
import { LMAX, LX } from './dna/p-builders';
import type { BlockPlan, PolyPlan } from './dna/types';
import type { BookBlock } from './segment';
import { validatePlan } from './plan/validate';
import { offlinePlan, offlinePoly } from './plan/offline';
import { textOnlyWarning, visualStats } from './plan/visual-qa';
import { compileClass, segmentReel } from './class';
import { POLY_ARITH_SAMPLE, POLY_FACTOR_SAMPLE, POLY_IDENTITY_SAMPLE } from './samples/polynomial';

const block = (text: string, kind: BookBlock['kind'] = 'prose'): BookBlock => ({ id: 'b', kind, page: 1, chapterId: 'c', sectionId: 's', lines: [{ text, math: false } as BookBlock['lines'][number]], text });
const say = { en: 'x', ml: 'എ' };
const RD = { en: 'x', ml: 'എ' };

/** A deterministic spread of polynomials of degree 1 to 4. */
function polys(): Poly[] {
  const out: Poly[] = [];
  const vals = [-9, -4, -1, 0, 1, 2, 5, 9];
  for (const a of [-3, -1, 1, 2, 7]) for (const b of vals) for (const c of vals) for (const d of [-6, 0, 3]) out.push([a, b, c, d]);
  for (const a of [-2, 1, 4]) for (const b of vals) for (const c of [-5, 0, 6]) out.push([a, b, c]);
  return out;
}

describe('the algebra is exact', () => {
  it('add, subtract, multiply agree with evaluation at many points', () => {
    const ps = polys();
    for (let i = 0; i < ps.length; i += 7) {
      const a = ps[i];
      const b = ps[(i * 13 + 5) % ps.length].slice(0, 3);
      if (b[0] === 0) continue;
      for (const x of [-3, -1, 0, 1, 2, 4]) {
        expect(evalPoly(addPoly(a, b), x)).toBe(evalPoly(a, x) + evalPoly(b, x) + 0);
        expect(evalPoly(subPoly(a, b), x)).toBe(evalPoly(a, x) - evalPoly(b, x) + 0);
        expect(evalPoly(mulPoly(a, b), x)).toBe(evalPoly(a, x) * evalPoly(b, x) + 0);
        expect(evalPoly(negPoly(a), x)).toBe(-evalPoly(a, x) + 0);
      }
    }
    expect(norm([0, 0, 3, 0])).toEqual([3, 0]);
    expect(degree([0, 0, 3, 1])).toBe(1);
  });
  it('division: P = (x − r) q + R and R = P(r), every step consistent', () => {
    for (const p of polys()) for (const r of [-7, -2, -1, 1, 3, 9]) {
      const dv = divide(p, r);
      expect(dv.rem, `${p} / ${r}`).toBe(evalPoly(p, r));
      const back = addPoly(mulPoly([1, -r], dv.q), [dv.rem]);
      expect(back).toEqual(norm(p));
      // each step: left = previous − product, and the product is the quotient term times (x − r)
      let prev = norm(p);
      for (const s of dv.steps) {
        expect(addPoly(prev, negPoly(s.product))).toEqual(s.left);
        expect(s.product).toEqual(norm(mulPoly([s.c, ...Array(s.pw).fill(0)], [1, -r])));
        prev = s.left;
      }
    }
  });
  it('lines read as maths', () => {
    expect(polyText([3, -2, 0, 5, -7])).toBe('3x^4 − 2x^3 + 5x − 7');
    expect(polyText([1, 0, -9])).toBe('x^2 − 9');
    expect(polyText([-1, 0, 0])).toBe('−x^2');
    expect(polyText([0])).toBe('0');
    expect(remainderLines([1, 0, -4, 5], 2).lines).toEqual(['P(2) = (2)^3 − 4(2) + 5', 'P(2) = 8 − 8 + 5', 'P(2) = 5']);
    expect(remainderLines([1, -4, 1, 6], -1).lines).toEqual(['P(−1) = (−1)^3 − 4(−1)^2 + (−1) + 6', 'P(−1) = −1 − 4 − 1 + 6', 'P(−1) = 0']);
    expect(factorLines([1, -4, 1, 6], 2)!.lines).toEqual(['P(2) = 8 − 16 + 2 + 6 = 0', 'P(x) = (x − 2)(x^2 − 2x − 3)', '= (x − 2)(x + 1)(x − 3)']);
    expect(factorLines([1, -4, 1, 6], 5)).toBeNull();
  });
  it('integer roots, full factorisation and real roots', () => {
    expect(integerRoots([1, -4, 1, 6]).roots).toEqual([-1, 2, 3]);
    expect(fullyFactorable([1, -4, 1, 6])).toEqual([-1, 2, 3]);
    expect(fullyFactorable([2, -4, 1, 6])).toBeNull();
    expect(fullyFactorable([1, 0, 1])).toBeNull();
    expect(fullyFactorable([1, 6, 9])).toEqual([-3, -3]);
    for (const a of [-4, -1, 2, 5]) for (const b of [-3, 0, 4]) for (const c of [-6, -1, 2, 7]) {
      const p = mulPoly(mulPoly([1, -a], [1, -b]), [1, -c]);
      expect(fullyFactorable(p)!.slice().sort((x, y) => x - y)).toEqual([a, b, c].sort((x, y) => x - y));
      const rr = realRoots(p);
      for (const r of [a, b, c]) expect(rr.some((x) => Math.abs(x - r) < 1e-6), `${p} root ${r}`).toBe(true);
    }
  });
  it('identities are recognised and their lines are true', () => {
    expect(identityOf([1, 0, -9])!.kind).toBe('diff-squares');
    expect(identityOf([1, 6, 9])!.kind).toBe('square-sum');
    expect(identityOf([1, -8, 16])!.kind).toBe('square-diff');
    expect(identityOf([1, 0, 9])).toBeNull();
    expect(identityOf([1, 5, 9])).toBeNull();
    expect(identityOf([2, 0, -8])).toBeNull();
    for (let k = 1; k <= 12; k++) {
      expect(identityOf([1, 0, -k * k])!.k).toBe(k);
      expect(identityOf([1, 2 * k, k * k])!.kind).toBe('square-sum');
      expect(identityOf([1, -2 * k, k * k])!.kind).toBe('square-diff');
      expect(mulPoly([1, k], [1, -k])).toEqual([1, 0, -k * k]);
      expect(mulPoly([1, k], [1, k])).toEqual([1, 2 * k, k * k]);
    }
    expect(identityOf([1, 0, -9])!.lines).toEqual(['x^2 − 9', '= x^2 − 3^2', '= (x − 3)(x + 3)']);
    expect(identityOf([1, -6, 9])!.check).toEqual(['(x − 3)(x − 3) = x^2 − 3x − 3x + 9', '= x^2 − 6x + 9']);
  });
  it('the graph window shows every root and turning point and both axes', () => {
    for (const p of polys()) {
      if (p[0] === 0) continue;
      const w = graphWindow(p);
      expect(w.xMin).toBeLessThanOrEqual(-3);
      expect(w.xMax).toBeGreaterThanOrEqual(3);
      expect(w.yMin).toBeLessThanOrEqual(0);
      expect(w.yMax).toBeGreaterThanOrEqual(0);
      for (const r of realRoots(p)) {
        expect(r, `${p}`).toBeGreaterThanOrEqual(w.xMin);
        expect(r).toBeLessThanOrEqual(w.xMax);
      }
      const d = p.slice(0, -1).map((c, i) => c * (p.length - 1 - i));
      for (const x of realRoots(d)) {
        const y = evalPoly(p, x);
        expect(y, `${p} at ${x}`).toBeGreaterThanOrEqual(w.yMin);
        expect(y).toBeLessThanOrEqual(w.yMax);
      }
    }
  });
  it('parsePoly reads polynomials in text only', () => {
    expect(parsePoly('Find the remainder when P(x) = 3x⁴ − 2x³ + 5x − 7 is divided by x − 2.')).toEqual([3, -2, 0, 5, -7]);
    expect(parsePoly('x^3 - 6x^2 + 11x - 6')).toEqual([1, -6, 11, -6]);
    expect(parsePoly('Factorise x² − 9.')).toEqual([1, 0, -9]);
    expect(parsePoly('ax² + bx + c')).toBeNull();
    expect(parsePoly('x² = 9')).toBeNull();
    expect(parsePoly('In 2023, 45 students')).toBeNull();
    expect(parsePoly('x^5 + 1')).toBeNull();
    expect(termsOf([3, 0, -5]).map((t) => t.k)).toEqual([2, 0]);
  });
});

describe('validator', () => {
  const v = (plan: unknown) => validatePlan('polynomial', plan, undefined, true).join(' | ');
  const show = { op: 'show' as const, say };
  const plan = (steps: PolyPlan['steps'], over: Partial<PolyPlan> = {}): PolyPlan => ({ p: [1, -4, 1, 6], q: [1, 2], r: 2, steps, ...over });
  it('samples pass', () => {
    for (const p of [POLY_FACTOR_SAMPLE, POLY_ARITH_SAMPLE, POLY_IDENTITY_SAMPLE]) expect(validatePlan('polynomial', p, RD)).toEqual([]);
  });
  it('numbers', () => {
    expect(v(plan([show], { p: [0, 1, 2] }))).toMatch(/must not be 0/);
    expect(v(plan([show], { p: [1] }))).toMatch(/degree 2 to 4/);
    expect(v(plan([show], { p: [1, 1, 1, 1, 1, 1] }))).toMatch(/degree 2 to 4/);
    expect(v(plan([show], { p: [13, 1, 1] }))).toMatch(/between −12 and 12/);
    expect(v(plan([show], { p: [1.5, 1, 1] }))).toMatch(/whole numbers/);
    expect(v(plan([show], { q: [10, 1] }))).toMatch(/between −9 and 9/);
    expect(v(plan([show], { q: [1, 2, 3, 4, 5] }))).toMatch(/degree 1 to 3/);
    expect(v(plan([show], { r: 0 }))).toMatch(/non-zero whole number/);
    expect(v(plan([show], { r: 10 }))).toMatch(/non-zero whole number/);
  });
  it('order and arguments', () => {
    expect(v(plan([{ op: 'graph', say }]))).toMatch(/needs \{"op":"show"\}/);
    expect(v(plan([show, show]))).toMatch(/only once/);
    expect(v(plan([show, { op: 'add', say }], { q: undefined }))).toMatch(/needs the second polynomial/);
    expect(v(plan([show, { op: 'multiply', say }], { q: undefined }))).toMatch(/needs the second polynomial/);
    expect(v(plan([show, { op: 'multiply', say }], { p: [1, 1, 1, 1, 1], q: [1, 1, 1] }))).toMatch(/at most 3 non-zero|above degree 5/);
    expect(v(plan([show, { op: 'divide', say }], { r: undefined }))).toMatch(/needs "r"/);
    expect(v(plan([show, { op: 'divide', say }], { p: [1, 0, 0, 0, 1] }))).toMatch(/up to degree 3/);
    expect(v(plan([show, { op: 'remainder', say }], { r: undefined }))).toMatch(/needs "r"/);
    expect(v(plan([show, { op: 'factor', at: 5, say }]))).toMatch(/P\(5\) is not 0/);
    expect(v(plan([show, { op: 'factor', at: 2, say }], { p: [2, -4, 1, 6] }))).toMatch(/monic/);
    expect(v(plan([show, { op: 'identity', say }]))).toMatch(/x² − k²/);
    expect(v(plan([show, { op: 'roots', say }]))).toMatch(/needs "graph"/);
    expect(v(plan([show, { op: 'graph', say }, { op: 'roots', say }], { p: [1, 0, 1] }))).toMatch(/whole-number root/);
    expect(v(plan([show, { op: 'graph', say }, { op: 'graph', say }]))).toMatch(/"graph" only once/);
    expect(v(plan([show, { op: 'spin' as 'show', say }]))).toMatch(/not one of/);
    expect(v(plan([show, { op: 'graph', say: { en: '', ml: 'എ' } }]))).toMatch(/say is required/);
    expect(v(plan([]))).toMatch(/must list the steps/);
  });
});

describe('what the board shows', () => {
  const [s] = buildDnaScenes('polynomial', POLY_FACTOR_SAMPLE, 'en', 'T');
  const [a] = buildDnaScenes('polynomial', POLY_ARITH_SAMPLE, 'en', 'T');
  const [i] = buildDnaScenes('polynomial', POLY_IDENTITY_SAMPLE, 'en', 'T');
  const vis = (sc: MotionScene, t: number) => sc.items.filter((it) => it.kind === 'text').map((it) => evalItem(it, t)).filter((st) => st.alpha > 0.5);
  const at = (sc: MotionScene, k: number, title: boolean) => sc.captions[k + (title ? 1 : 0)].t1 - 40;
  it('show, divide, remainder and factor are written by the app', () => {
    const t = (k: number) => vis(s, at(s, k, true)).map((q) => q.text);
    expect(t(0)).toEqual(expect.arrayContaining(['P(x) = x^3 − 4x^2 + x + 6', 'degree = 3', 'coefficients: 1, −4, 1, 6']));
    for (const w of ['(x^3 − 4x^2 + x + 6) ÷ (x − 2)', 'x^2(x − 2) = x^3 − 2x^2', '−2x^2 + x + 6', '−2x(x − 2) = −2x^2 + 4x', '−3x + 6', '−3(x − 2) = −3x + 6', 'q = x^2 − 2x − 3,  R = 0']) expect(t(2), w).toContain(w);
    expect(t(3)).toEqual(expect.arrayContaining(['P(2) = (2)^3 − 4(2)^2 + (2) + 6', 'P(2) = 8 − 16 + 2 + 6', 'P(2) = 0']));
    expect(t(3)).not.toContain('q = x^2 − 2x − 3,  R = 0'); // the division was cleared
    expect(t(4)).toEqual(expect.arrayContaining(['P(2) = 8 − 16 + 2 + 6 = 0', 'P(x) = (x − 2)(x^2 − 2x − 3)', '= (x − 2)(x + 1)(x − 3)']));
  });
  it('columns: every coefficient sits in the column of its power; sums are right', () => {
    const st = vis(a, at(a, 1, false));
    const row = (label: string) => st.filter((q) => Math.abs(q.y - st.find((z) => z.text === label)!.y) < 3 && q.text !== label).sort((x, y) => x.x - y.x).map((q) => q.text);
    expect(row('P')).toEqual(['3', '2', '−5']);
    expect(row('Q')).toEqual(['1', '−4', '1']);
    expect(row('P + Q')).toEqual(['4', '−2', '−4']);
    expect(st.map((q) => q.text)).toContain('P + Q = 4x^2 − 2x − 4');
    const sb = vis(a, at(a, 2, false));
    const rowS = (label: string) => sb.filter((q) => Math.abs(q.y - sb.find((z) => z.text === label)!.y) < 3 && q.text !== label).sort((x, y) => x.x - y.x).map((q) => q.text);
    expect(rowS('−Q')).toEqual(['−1', '4', '−1']);
    expect(rowS('P − Q')).toEqual(['2', '6', '−6']);
    // columns line up: the x of the k-th number is the same in every row
    const xsOf = (lab: string, sc: typeof st) => sc.filter((q) => Math.abs(q.y - sc.find((z) => z.text === lab)!.y) < 3 && q.text !== lab).sort((x, y) => x.x - y.x).map((q) => q.x);
    expect(xsOf('P', st)).toEqual(xsOf('P + Q', st));
  });
  it('multiply: every cell is the product of its row and column term; like powers share a colour', () => {
    const st = vis(a, at(a, 3, false));
    const cells = ['3x^4', '−12x^3', '3x^2', '2x^3', '−8x^2', '2x', '−5x^2', '20x', '−5'];
    for (const c of cells) expect(st.map((q) => q.text), c).toContain(c);
    const col = (txt: string) => st.filter((q) => q.text === txt).pop()!.color.toLowerCase(); // the table cell comes after the row label
    expect(col('−12x^3')).toBe(col('2x^3'));
    expect(col('3x^2')).toBe(col('−8x^2'));
    expect(col('3x^2')).toBe(col('−5x^2'));
    expect(col('2x')).toBe(col('20x'));
    expect(col('3x^4')).not.toBe(col('2x^3'));
    expect(st.map((q) => q.text)).toContain('P × Q = 3x^4 − 10x^3 − 10x^2 + 22x − 5');
  });
  it('identity: lines, area picture of four regions, check with a tick', () => {
    const st = vis(i, at(i, 1, false));
    expect(st.map((q) => q.text)).toEqual(expect.arrayContaining(['x^2 + 6x + 9', '= x^2 + 2(x)(3) + 3^2', '= (x + 3)^2', '(x + 3)(x + 3) = x^2 + 3x + 3x + 9', '= x^2 + 6x + 9']));
    const polys2 = i.items.filter((it) => it.kind === 'poly' && /^ar/.test(it.id));
    expect(polys2.length).toBe(4);
    expect(i.items.some((it) => it.kind === 'tick')).toBe(true);
    // the picture is gone when the graph comes
    expect(vis(i, at(i, 2, false)).some((q) => q.text === 'x^2' && q.color.toLowerCase() === '#d22d2d')).toBe(false);
  });
  it('nothing overlaps or leaves its area', () => {
    for (const [sc, title] of [[s, true], [a, false], [i, false]] as const) for (let k = 0; k < sc.captions.length; k++) {
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
      for (const b of st.filter((x) => x.q.y > 90 && x.q.y < 400 && Math.abs(x.l - LX) < 2)) expect(b.r, b.q.text).toBeLessThanOrEqual(LX + LMAX + 1);
      for (let p1 = 0; p1 < st.length; p1++) for (let p2 = p1 + 1; p2 < st.length; p2++) {
        if (Math.abs(st[p1].q.y - st[p2].q.y) > 10) continue;
        const gap = Math.max(st[p1].l, st[p2].l) - Math.min(st[p1].r, st[p2].r);
        // tick labels of the two axes may touch at the origin corner (the plane's own placement)
        const tol = st[p1].l > 380 && st[p2].l > 380 ? -0.5 : -1e-6;
        expect(gap, `${st[p1].q.text} / ${st[p2].q.text} at ${t}`).toBeGreaterThanOrEqual(tol);
      }
    }
  });
  it('English and Malayalam pictures are identical; only captions differ', () => {
    const ml = buildDnaScenes('polynomial', POLY_FACTOR_SAMPLE, 'ml', 'T')[0];
    expect(ml.items.map((it) => `${it.id}:${it.kind}:${it.text}`)).toEqual(s.items.map((it) => `${it.id}:${it.kind}:${it.text}`));
    expect(ml.captions.map((c) => c.text)).not.toEqual(s.captions.map((c) => c.text));
  });
});

describe('selection', () => {
  const pick = (t: string, kind: BookBlock['kind'] = 'prose') => selectDna(block(t, kind)).dna;
  it('polynomial talk → polynomial', () => {
    expect(pick('By the remainder theorem, when a polynomial P(x) is divided by x − a, the remainder is P(a).')).toBe('polynomial');
    expect(pick('If P(a) = 0, then x − a is a factor of the polynomial. This is the factor theorem.')).toBe('polynomial');
    expect(pick('The degree of a polynomial is the highest power of x in it.')).toBe('polynomial');
    expect(pick('Find the remainder when the polynomial x³ − 6x² + 11x − 6 is divided by x − 2.', 'exercise')).toBe('polynomial');
  });
  it('the same words elsewhere stay elsewhere', () => {
    expect(pick('The graph of a quadratic polynomial is a curve called a parabola.')).not.toBe('polynomial');
    expect(pick('Solve x² − 5x + 6 = 0 by factorising.', 'exercise')).toBe('quadratic-equation');
    expect(pick('A pair of linear equations in two variables can be solved by the graphical method.')).toBe('linear-system');
    expect(pick('In an arithmetic sequence each term is got by adding the common difference.')).toBe('arithmetic-sequence');
    expect(pick('The sum of the angles of a triangle is 180°.')).not.toBe('polynomial');
  });
});

describe('offline planner', () => {
  it('reads the polynomial and the divisor from the text', () => {
    const p = offlinePoly('Find the remainder when x³ − 4x² + x + 6 is divided by x − 2, and factorise it.')!;
    expect(p.p).toEqual([1, -4, 1, 6]);
    expect(p.r).toBe(2);
    expect(p.steps.map((x) => x.op)).toEqual(['show', 'divide', 'remainder', 'factor', 'graph', 'roots']);
    expect(validatePlan('polynomial', p, RD)).toEqual([]);
    const q = offlinePoly('Factorise x² − 9 using the identity.')!;
    expect(q.steps.map((x) => x.op)).toEqual(['show', 'factor', 'identity', 'graph', 'roots']);
    expect(validatePlan('polynomial', q, RD)).toEqual([]);
    const w = offlinePoly('The polynomial 2x³ + 3x − 5 has degree 3.')!;
    expect(w.steps.map((x) => x.op)).toEqual(['show', 'graph', 'roots']);
    expect(validatePlan('polynomial', w, RD)).toEqual([]);
    expect(offlinePoly('Polynomials are important.')).toBeNull();
    expect(offlinePoly('x³ + 99x + 1')).toBeNull();
  });
  it('falls back with a warning when no polynomial is given', () => {
    const pl = offlinePlan(block('The remainder theorem and the factor theorem are used with polynomials.'), '', '');
    expect(pl.dna).toBe('concept-board');
    expect(pl.warnings?.join()).toMatch(/AI planner needed/);
    expect(offlinePlan(block('Find the remainder when the polynomial x³ − 6x² + 11x − 6 is divided by x − 2.', 'exercise'), '', '').dna).toBe('polynomial');
  });
});

describe('picture and class', () => {
  const ALL = [POLY_FACTOR_SAMPLE, POLY_ARITH_SAMPLE, POLY_IDENTITY_SAMPLE];
  it('samples are real pictures', () => {
    for (const teach of ALL) {
      expect(textOnlyWarning({ dna: 'polynomial', teach })).toBeUndefined();
      expect(visualStats(buildDnaScenes('polynomial', teach, 'en', 'T')).graphics).toBeGreaterThanOrEqual(3);
    }
  });
  it('compiles into a class with one caption per step', () => {
    const plan: BlockPlan = { blockId: 'b', dna: 'polynomial', read: RD, teach: POLY_FACTOR_SAMPLE, source: 'fixture' };
    const segs = compileClass([block('Polynomials.')], new Map([['b', plan]]), { title: 'T' });
    for (const seg of segs.filter((x) => x.phase === 'teach')) expect(segmentReel(seg).parts[0].captions.length).toBe(POLY_FACTOR_SAMPLE.steps.length + 1);
  });
  it('draws without error in every format and theme', () => {
    const noop = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? (x: string) => ({ width: x.length * 10 }) : () => undefined), set: () => true }) as unknown as CanvasRenderingContext2D;
    for (const teach of ALL) {
      const sc = buildDnaScenes('polynomial', teach, 'ml', 'T')[0];
      for (const format of ['landscape', 'vertical', 'square'] as const) for (const theme of ['light', 'dark'] as const) for (const f of [0.1, 0.4, 0.7, 0.99]) drawMotionFrame(noop, sc, sc.durationMs * f, { format, theme } as never);
    }
  });
  it('builds and validates for many polynomials and every step that applies', { timeout: 120000 }, () => {
    for (const p of polys()) {
      if (p[0] === 0 || p.length > 5) continue;
      const steps: PolyPlan['steps'] = [{ op: 'show', say }, { op: 'add', say }, { op: 'subtract', say }, { op: 'graph', say }];
      const plan: PolyPlan = { p, q: [2, -1], r: 3, steps };
      if (p.length <= 4) plan.steps.splice(3, 0, { op: 'divide', say }, { op: 'remainder', say });
      const rs = fullyFactorable(p);
      if (rs) plan.steps.splice(3, 0, { op: 'factor', at: rs[0], say });
      if (integerRoots(p).roots.length) plan.steps.push({ op: 'roots', say });
      expect(validatePlan('polynomial', plan, RD), JSON.stringify(p)).toEqual([]);
      expect(() => buildDnaScenes('polynomial', plan, 'en', 'T'), JSON.stringify(p)).not.toThrow();
    }
    // the largest tables still fit
    const big: PolyPlan = { p: [9, 0, -9], q: [-9, 0, 9], steps: [{ op: 'show', say }, { op: 'multiply', say }, { op: 'add', say }] };
    expect(validatePlan('polynomial', big, RD)).toEqual([]);
    expect(() => buildDnaScenes('polynomial', big, 'en', 'T')).not.toThrow();
  });
});
