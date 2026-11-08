import { describe, expect, it } from 'vitest';
import { drawMotionFrame, evalItem, type MotionScene } from '../reels/motion';
import { tokenWidth } from '../reels/motion/metrics';
import { selectDna } from './dna/registry';
import { buildDnaScenes } from './dna/builders';
import { FPX, FPMAX } from './dna/fl-builders';
import { LINE, addFacts, flGeometry, flProblem, gcd, lcm, reduce, tok, val, type Frac } from './dna/fl-math';
import type { BlockPlan, FracLinePlan } from './dna/types';
import type { BookBlock } from './segment';
import { validatePlan } from './plan/validate';
import { offlineFracLine, offlinePlan } from './plan/offline';
import { textOnlyWarning, visualStats } from './plan/visual-qa';
import { compileClass, segmentReel } from './class';
import { FL_ADD_SAMPLE, FL_COMPARE_SAMPLE, FL_EQUIV_SAMPLE, FL_MARK_SAMPLE, FL_MIXED_ADD_SAMPLE, FL_SUB_SAMPLE } from './samples/fraction-line';

const block = (text: string, kind: BookBlock['kind'] = 'prose'): BookBlock => ({ id: 'b', kind, page: 1, chapterId: 'c', sectionId: 's', lines: [{ text, math: false } as BookBlock['lines'][number]], text });
const say = { en: 'x', ml: 'എ' };
const RD = { en: 'x', ml: 'എ' };
const ALL = [FL_MARK_SAMPLE, FL_EQUIV_SAMPLE, FL_COMPARE_SAMPLE, FL_ADD_SAMPLE, FL_SUB_SAMPLE, FL_MIXED_ADD_SAMPLE];
const S = (ops: string[]) => ops.map((op) => ({ op, say }) as FracLinePlan['steps'][number]);

/** Every proper and improper fraction in lowest terms with denominators 2–12 and value ≤ 3. */
const FRACS: Frac[] = [];
for (let d = 2; d <= 12; d++) for (let n = 1; n <= 3 * d; n++) if (gcd(n, d) === 1) FRACS.push([n, d]);

const ADDS: FracLinePlan[] = [];
const COMPARES: FracLinePlan[] = [];
const MARKS: FracLinePlan[] = [];
const EQUIVS: FracLinePlan[] = [];
FRACS.forEach((a, i) => FRACS.forEach((c, j) => {
  if ((i * 7 + j * 3) % 11 !== 0 || a === c) return;
  for (const op of ['add', 'sub'] as const) {
    const p: FracLinePlan = { kind: 'add', op, fracs: [a, c], steps: S(['show', 'jump', ...(a[1] !== c[1] ? ['common'] : []), 'result']) };
    if (!flProblem(p, 'p')) ADDS.push(p);
  }
  const q: FracLinePlan = { kind: 'compare', fracs: [a, c], steps: S(['show', ...(a[1] !== c[1] ? ['common'] : []), 'result']) };
  if (!flProblem(q, 'p')) COMPARES.push(q);
}));
for (let i = 0; i < FRACS.length; i += 1) {
  const set = [FRACS[i], FRACS[(i * 5 + 3) % FRACS.length], FRACS[(i * 3 + 7) % FRACS.length]].slice(0, 1 + (i % 3));
  const p: FracLinePlan = { kind: 'mark', fracs: set, steps: S(['show', 'divide', 'mark', ...(set.some((f) => f[0] > f[1]) ? ['mixed'] : [])]) };
  if (!flProblem(p, 'p')) MARKS.push(p);
}
for (const f of FRACS.filter((f) => f[0] < f[1])) for (const k of [2, 3, 4, 6]) {
  const p: FracLinePlan = { kind: 'equivalent', frac: f, k, steps: S(['show', 'scale', 'result']) };
  if (!flProblem(p, 'p')) EQUIVS.push(p);
}
const CASES = [...ADDS, ...COMPARES, ...MARKS, ...EQUIVS];

describe('the numbers are true', () => {
  it('there are plenty of cases', () => {
    expect(ADDS.length).toBeGreaterThan(40);
    expect(COMPARES.length).toBeGreaterThan(40);
    expect(MARKS.length).toBeGreaterThan(40);
    expect(EQUIVS.length).toBeGreaterThan(40);
  });
  it('sums and differences over the common denominator are exact', () => {
    for (const p of ADDS) {
      const s = addFacts(p);
      const [a, c] = p.fracs as [Frac, Frac];
      expect(s.D).toBe(lcm(a[1], c[1]));
      expect(s.ap[0] * a[1]).toBe(a[0] * s.D);
      expect(s.cp[0] * c[1]).toBe(c[0] * s.D);
      const exact = p.op === 'sub' ? a[0] * c[1] - c[0] * a[1] : a[0] * c[1] + c[0] * a[1];
      expect(s.sum[0] * a[1] * c[1]).toBe(exact * s.sum[1]);
      expect(gcd(s.sum[0], s.sum[1])).toBe(1);
      expect(s.whole * s.sum[1] + s.rem).toBe(s.sum[0]);
      expect(s.S / s.D).toBeCloseTo(p.op === 'sub' ? val(a) - val(c) : val(a) + val(c), 12);
    }
  });
  it('reduce', () => {
    expect(reduce(6, 8)).toEqual([3, 4]);
    expect(reduce(12, 4)).toEqual([3, 1]);
    expect(tok([3, 4])).toBe('{3/4}');
  });
  it('the line holds every value and its parts', () => {
    for (const p of CASES) {
      const g = flGeometry(p);
      expect(g.D * g.L).toBeLessThanOrEqual(36);
      const vs = p.kind === 'equivalent' ? [val(p.frac!)] : p.kind === 'add' ? [addFacts(p).S / addFacts(p).D, ...p.fracs!.map(val)] : p.fracs!.map(val);
      for (const v of vs) { expect(v).toBeLessThanOrEqual(g.L + 1e-9); expect(g.x(v)).toBeLessThanOrEqual(LINE.x0 + LINE.w + 1e-9); }
      expect(g.x(0)).toBe(LINE.x0);
    }
  });
});

describe('what is written', () => {
  const lines = (sc: MotionScene, k: number, title: boolean): string[] => {
    const time = sc.captions[k + (title ? 1 : 0)].t1 - 40;
    const vis = sc.items.filter((it) => it.kind === 'text').map((it) => evalItem(it, time)).filter((st) => st.alpha > 0.5 && st.x >= FPX - 4);
    const rows = new Map<number, Array<{ x: number; text: string }>>();
    for (const v of vis) { const key = Math.round(v.y); rows.set(key, [...(rows.get(key) ?? []), { x: v.x, text: v.text }]); }
    return [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, r]) => r.sort((a, b) => a.x - b.x).map((q) => q.text).join(' '));
  };
  const figure = (sc: MotionScene, k: number, title: boolean): string[] => {
    const time = sc.captions[k + (title ? 1 : 0)].t1 - 40;
    return sc.items.filter((it) => it.kind === 'text').map((it) => evalItem(it, time)).filter((st) => st.alpha > 0.5 && st.x < FPX - 4).map((q) => q.text);
  };
  it('mark', () => {
    const [sc] = buildDnaScenes('fraction-line', FL_MARK_SAMPLE, 'en', 'T');
    expect(lines(sc, 0, true)).toEqual(['{1/2}', '{3/4}', '{5/4}']);
    expect(figure(sc, 0, true).sort()).toEqual(['0', '1', '2']);
    expect(lines(sc, 1, true)).toEqual(['Each whole = 4 equal parts', '1 part = {1/4}']);
    expect(lines(sc, 2, true)).toEqual(['{1/2} = 2 × {1/4}', '{3/4} = 3 × {1/4}', '{5/4} = 5 × {1/4}']);
    expect(figure(sc, 2, true).sort()).toEqual(['0', '1', '2', '{1/2}', '{1/4}'.replace('1/4', '3/4'), '{5/4}'].sort());
    expect(lines(sc, 3, true)).toEqual(['{5/4} = 1 {1/4}']);
    expect(figure(sc, 3, true)).toEqual(expect.arrayContaining(['1', '{1/4}']));
  });
  it('equivalent', () => {
    const [sc] = buildDnaScenes('fraction-line', FL_EQUIV_SAMPLE, 'en', 'T');
    expect(lines(sc, 0, false)).toEqual(['{2/3}']);
    expect(lines(sc, 1, false)).toEqual(['{2/3} = {2/3} × {2/2}', '= {4/6}']);
    expect(lines(sc, 2, false)).toEqual(['{2/3} = {4/6}']);
    expect(figure(sc, 1, false)).toEqual(expect.arrayContaining(['{2/3}', '{4/6}']));
  });
  it('compare', () => {
    const [sc] = buildDnaScenes('fraction-line', FL_COMPARE_SAMPLE, 'en', 'T');
    expect(lines(sc, 1, false)).toEqual(['{2/3} = {8/12}', '{3/4} = {9/12}']);
    expect(figure(sc, 1, false)).toEqual(expect.arrayContaining(['{8/12}', '{9/12}']));
    expect(lines(sc, 2, false)).toEqual(['{8/12} < {9/12}', '{2/3} < {3/4}']);
  });
  it('add, subtract', () => {
    const [sc] = buildDnaScenes('fraction-line', FL_ADD_SAMPLE, 'en', 'T');
    expect(lines(sc, 0, false)).toEqual(['{1/2} + {1/3}']);
    expect(lines(sc, 1, false)).toEqual(['{1/2} + {1/3}', '{1/3} to the right']);
    expect(lines(sc, 2, false)).toEqual(['{1/2} = {3/6}', '{1/3} = {2/6}']);
    expect(lines(sc, 3, false)).toEqual(['= {3/6} + {2/6}', '= {5/6}']);
    const [sb] = buildDnaScenes('fraction-line', FL_SUB_SAMPLE, 'en', 'T');
    expect(lines(sb, 1, false)).toEqual(['{5/4} − {1/2}', '{1/2} to the left']);
    expect(lines(sb, 3, false)).toEqual(['= {5/4} − {2/4}', '= {3/4}']);
    const [mx] = buildDnaScenes('fraction-line', FL_MIXED_ADD_SAMPLE, 'en', 'T');
    expect(lines(mx, 2, false)).toEqual(['= {9/12} + {8/12}', '= {17/12}', '= 1 {5/12}']);
    expect(figure(mx, 2, false)).toEqual(expect.arrayContaining(['1', '{5/12}']));
  });
});

describe('the picture is the maths', () => {
  const at = (sc: MotionScene, it: MotionScene['items'][number]) => evalItem(it, sc.durationMs);
  it('dots sit at value × unit on the line', () => {
    for (const p of [FL_MARK_SAMPLE, FL_COMPARE_SAMPLE, ...MARKS.slice(0, 20), ...COMPARES.slice(0, 20)]) {
      const sc = buildDnaScenes('fraction-line', p, 'en', 'T')[0];
      const g = flGeometry(p);
      const xs = sc.items.filter((it) => it.kind === 'dot').map((it) => at(sc, it).x).sort((a, b) => a - b);
      const want = p.fracs!.map((f) => g.x(val(f))).sort((a, b) => a - b);
      expect(xs.length).toBe(want.length);
      xs.forEach((x, i) => expect(x).toBeCloseTo(want[i], 6));
    }
  });
  it('ticks: one per part, at i/D', () => {
    const sc = buildDnaScenes('fraction-line', FL_MARK_SAMPLE, 'en', 'T')[0];
    const g = flGeometry(FL_MARK_SAMPLE);
    const ticks = sc.items.filter((it) => it.kind === 'poly' && it.points?.length === 2 && it.points[0][0] === it.points[1][0]);
    const sub = ticks.filter((it) => Math.abs(it.points![0][1] - it.points![1][1]) === 14).map((it) => it.points![0][0]).sort((a, b) => a - b);
    const whole = ticks.filter((it) => Math.abs(it.points![0][1] - it.points![1][1]) === 28).map((it) => it.points![0][0]).sort((a, b) => a - b);
    expect(whole).toEqual([0, 1, 2].map((i) => g.x(i)));
    expect(sub).toEqual([1, 2, 3, 5, 6, 7].map((i) => g.x(i / 4)));
  });
  it('equivalent: both dots at the same x; finer line has d × k parts', () => {
    for (const p of [FL_EQUIV_SAMPLE, ...EQUIVS.slice(0, 20)]) {
      const sc = buildDnaScenes('fraction-line', p, 'en', 'T')[0];
      const dots = sc.items.filter((it) => it.kind === 'dot').map((it) => at(sc, it));
      expect(dots.length).toBe(2);
      expect(dots[0].x).toBeCloseTo(dots[1].x, 9);
      expect(dots[0].x).toBeCloseTo(LINE.x0 + LINE.w * val(p.frac!), 6);
      const ticks = sc.items.filter((it) => it.kind === 'poly' && it.points?.length === 2 && it.points[0][0] === it.points[1][0] && Math.abs(it.points[0][1] - it.points[1][1]) === 14);
      expect(ticks.length).toBe(p.frac![1] - 1 + p.frac![1] * p.k! - 1);
    }
  });
  it('add: the arc runs from the first fraction to the answer', () => {
    for (const p of [FL_ADD_SAMPLE, FL_SUB_SAMPLE, FL_MIXED_ADD_SAMPLE, ...ADDS.slice(0, 30)]) {
      const sc = buildDnaScenes('fraction-line', p, 'en', 'T')[0];
      const g = flGeometry(p);
      const s = addFacts(p);
      const arc = sc.items.find((it) => it.kind === 'poly' && (it.points?.length ?? 0) > 10)!;
      expect(arc.points![0][0]).toBeCloseTo(g.x(val(s.a)), 6);
      expect(arc.points![arc.points!.length - 1][0]).toBeCloseTo(g.x(s.S / s.D), 6);
      const dots = sc.items.filter((it) => it.kind === 'dot').map((it) => at(sc, it).x);
      expect(dots.length).toBe(2);
      expect(dots[1]).toBeCloseTo(g.x(s.S / s.D), 6);
    }
  });
  it('compare: bar lengths are in proportion to the values', () => {
    for (const p of [FL_COMPARE_SAMPLE, ...COMPARES.slice(0, 20)]) {
      const sc = buildDnaScenes('fraction-line', p, 'en', 'T')[0];
      const bars = sc.items.filter((it) => it.kind === 'poly' && it.closed && it.fill);
      expect(bars.length).toBe(2);
      const len = bars.map((b) => Math.max(...b.points!.map((q) => q[0])) - Math.min(...b.points!.map((q) => q[0])));
      expect(len[0] / len[1]).toBeCloseTo(val(p.fracs![0]) / val(p.fracs![1]), 9);
    }
  });
});

describe('validation', () => {
  const ok = (p: FracLinePlan) => validatePlan('fraction-line', p, RD);
  it('the samples are valid', () => { for (const p of ALL) expect(ok(p)).toEqual([]); });
  it('fractions', () => {
    const m = (fracs: unknown) => flProblem({ kind: 'mark', fracs, steps: [] } as unknown as FracLinePlan, 'p');
    expect(m([])).toMatch(/1 to 4 fractions/);
    expect(m([[1, 2], [1, 3], [1, 4], [1, 5], [1, 6]])).toMatch(/1 to 4 fractions/);
    expect(m([[1.5, 2]])).toMatch(/whole numbers/);
    expect(m([[1, 1]])).toMatch(/denominator must be from 2 to 12/);
    expect(m([[1, 13]])).toMatch(/denominator must be from 2 to 12/);
    expect(m([[0, 3]])).toMatch(/at least 1/);
    expect(m([[2, 4]])).toMatch(/not in lowest terms/);
    expect(m([[10, 3]])).toMatch(/more than 3/);
    expect(m([[1, 2], [1, 2]])).toMatch(/different/);
    expect(m([[1, 12], [1, 11]])).toMatch(/too close/);
    expect(m([[1, 12], [1, 7], [1, 6]])).toMatch(/too close/);
    expect(m([[7, 11], [5, 7], [8, 11]])).toMatch(/too close/);
    expect(m([[1, 6], [1, 4], [5, 12]])).toBeNull();
    expect(m([[1, 2], [3, 4], [5, 4]])).toBeNull();
    expect(m([[1, 11], [3, 8], [2, 7]])).toMatch(/too fine/);
  });
  it('equivalent', () => {
    const e = (frac: unknown, k: unknown) => flProblem({ kind: 'equivalent', frac, k, steps: [] } as unknown as FracLinePlan, 'p');
    expect(e([3, 2], 2)).toMatch(/proper fraction/);
    expect(e([2, 3], 1)).toMatch(/k must be/);
    expect(e([2, 3], 7)).toMatch(/k must be/);
    expect(e([5, 11], 4)).toMatch(/too fine/);
    expect(e([2, 3], 2)).toBeNull();
  });
  it('add and compare', () => {
    const a = (fracs: unknown, op?: string) => flProblem({ kind: 'add', fracs, op, steps: [] } as unknown as FracLinePlan, 'p');
    expect(a([[1, 2]])).toMatch(/2 fractions/);
    expect(a([[1, 3], [1, 2]], 'sub')).toMatch(/not positive/);
    expect(a([[1, 2], [1, 2]], 'sub')).toMatch(/different/);
    expect(a([[5, 2], [3, 2]])).toMatch(/more than 3/);
    expect(a([[1, 2], [1, 3]], 'times')).toMatch(/"add" or "sub"/);
    expect(a([[7, 12], [9, 11]])).toMatch(/too fine/);
    expect(a([[1, 2], [1, 3]])).toBeNull();
    expect(flProblem({ kind: 'cube', steps: [] } as unknown as FracLinePlan, 'p')).toMatch(/kind must be/);
  });
  it('steps', () => {
    const p = (kind: FracLinePlan['kind'], ops: string[], more: Partial<FracLinePlan> = {}) => ok({ kind, fracs: [[1, 2], [3, 4]], steps: S(ops), ...more });
    expect(p('mark', ['divide']).join()).toMatch(/needs \{"op":"show"\}/);
    expect(p('mark', ['show', 'show']).join()).toMatch(/"show" only once/);
    expect(p('mark', ['show', 'mark', 'mark']).join()).toMatch(/only once/);
    expect(p('mark', ['show', 'mark', 'divide']).join()).toMatch(/"divide" must come before "mark"/);
    expect(p('mark', ['show', 'mixed']).join()).toMatch(/needs "mark"/);
    expect(p('mark', ['show', 'mark', 'mixed']).join()).toMatch(/needs an improper fraction/);
    expect(p('mark', ['show', 'jump']).join()).toMatch(/not one of/);
    expect(p('compare', ['show', 'result', 'common']).join()).toMatch(/"result" must be the last/);
    expect(p('compare', ['show', 'common', 'result'], { fracs: [[1, 4], [3, 4]] }).join()).toMatch(/not needed/);
    expect(p('add', ['show', 'common', 'jump', 'result']).join()).toMatch(/"jump" must come before "common"/);
    expect(ok({ kind: 'mark', fracs: [[1, 2]], steps: [{ op: 'show', say: { en: '', ml: '' } }] }).join()).toMatch(/say is required/);
    expect(p('mark', ['show', 'divide', 'mark'])).toEqual([]);
  });
});

describe('selection', () => {
  const pick = (text: string, kind: BookBlock['kind'] = 'prose') => selectDna(block(text, kind)).dna;
  it('fractions on a number line → fraction-line', () => {
    expect(pick('Represent the fractions 1/2 and 3/4 on a number line.', 'exercise')).toBe('fraction-line');
    expect(pick('Equivalent fractions on the number line: 1/2 = 2/4.')).toBe('fraction-line');
    expect(pick('To add fractions on a number line, start at the first fraction and jump the length of the second.')).toBe('fraction-line');
    expect(pick('Mark thirds and halves on a number line. Compare the fractions.')).toBe('fraction-line');
  });
  it('the same words elsewhere stay elsewhere', () => {
    expect(pick('Mark −3 and 2 on a number line.', 'exercise')).not.toBe('fraction-line');
    expect(pick('Opposite numbers are the same distance from zero on the number line.')).not.toBe('fraction-line');
    expect(pick('One half of the bar is shaded. Add the fractions shown by the bars.')).not.toBe('fraction-line');
    expect(pick('Find 12% of 250.', 'exercise')).toBe('ratio-percent');
    expect(pick('Draw a pie chart for the data given in the table.', 'exercise')).toBe('pie-chart');
  });
});

describe('offline planner', () => {
  it('marks, equivalents, compares, adds, subtracts', () => {
    const m = offlineFracLine('Mark 1/2, 3/4 and 5/4 on a number line.')!;
    expect(m).toMatchObject({ kind: 'mark', fracs: [[1, 2], [3, 4], [5, 4]] });
    expect(m.steps.map((x) => x.op)).toEqual(['show', 'divide', 'mark', 'mixed']);
    const e = offlineFracLine('Show that 2/3 and 4/6 are equivalent fractions on a number line.')!;
    expect(e).toMatchObject({ kind: 'equivalent', frac: [2, 3], k: 2 });
    const e3 = offlineFracLine('Write an equivalent fraction of 3/4 by multiplying by 3 on a number line.')!;
    expect(e3).toMatchObject({ kind: 'equivalent', frac: [3, 4], k: 3 });
    const c = offlineFracLine('Which is greater, 2/3 or 3/4? Use a number line.')!;
    expect(c).toMatchObject({ kind: 'compare', fracs: [[2, 3], [3, 4]] });
    expect(c.steps.map((x) => x.op)).toEqual(['show', 'common', 'result']);
    const a = offlineFracLine('Add 1/2 and 1/3 on a number line.')!;
    expect(a).toMatchObject({ kind: 'add', op: 'add', fracs: [[1, 2], [1, 3]] });
    const s = offlineFracLine('Subtract 1/2 from 5/4 on a number line.')!;
    expect(s).toMatchObject({ kind: 'add', op: 'sub', fracs: [[5, 4], [1, 2]] });
    for (const p of [m, e, e3, c, a, s]) expect(validatePlan('fraction-line', p, RD)).toEqual([]);
  });
  it('null when the fractions do not fit', () => {
    expect(offlineFracLine('A number line shows fractions.')).toBeNull();
    expect(offlineFracLine('Mark 2/4 on a number line.')).toBeNull();
    expect(offlineFracLine('Mark 1/13 on a number line.')).toBeNull();
  });
  it('falls back with a warning without fractions', () => {
    const pl = offlinePlan(block('Fractions can be shown on a number line.'), '', '');
    expect(pl.dna).toBe('concept-board');
    expect(pl.warnings?.join()).toMatch(/AI planner needed/);
    expect(offlinePlan(block('Mark 1/2 and 3/4 on a number line.', 'exercise'), '', '').dna).toBe('fraction-line');
  });
});

describe('picture and class', () => {
  it('samples are real pictures', () => {
    for (const teach of ALL) {
      expect(textOnlyWarning({ dna: 'fraction-line', teach })).toBeUndefined();
      expect(visualStats(buildDnaScenes('fraction-line', teach, 'en', 'T')).graphics).toBeGreaterThanOrEqual(4);
    }
  });
  it('compiles into a class with one caption per step', () => {
    for (const teach of ALL) {
      const plan: BlockPlan = { blockId: 'b', dna: 'fraction-line', read: RD, teach, source: 'fixture' };
      const segs = compileClass([block('Fractions on a number line.')], new Map([['b', plan]]), { title: 'T' });
      for (const seg of segs.filter((x) => x.phase === 'teach')) expect(segmentReel(seg).parts[0].captions.length).toBe(teach.steps.length + (teach.title ? 1 : 0));
    }
  });
  it('draws without error in every format and theme', () => {
    const noop = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? (x: string) => ({ width: x.length * 10 }) : () => undefined), set: () => true }) as unknown as CanvasRenderingContext2D;
    for (const teach of ALL) {
      const sc = buildDnaScenes('fraction-line', teach, 'ml', 'T')[0];
      for (const format of ['landscape', 'vertical', 'square'] as const) for (const theme of ['light', 'dark'] as const) for (const f of [0.1, 0.4, 0.7, 0.99]) drawMotionFrame(noop, sc, sc.durationMs * f, { format, theme } as never);
    }
  });
  it('nothing overlaps or leaves its area (every step, many plans)', { timeout: 120000 }, () => {
    const cases = [...ALL, ...CASES.filter((_, i) => i % 5 === 0)];
    for (const teach of cases) {
      const sc = buildDnaScenes('fraction-line', teach, 'en', 'T')[0];
      for (let k = 0; k < sc.captions.length; k++) {
        const time = sc.captions[k].t1 - 40;
        const st = sc.items.filter((it) => it.kind === 'text').map((it) => evalItem(it, time)).filter((s) => s.alpha > 0.5).map((q) => {
          const w = tokenWidth(q.text, q.size);
          return { q, l: q.x - w / 2, r: q.x + w / 2 };
        });
        const tag = JSON.stringify(teach.fracs ?? teach.frac);
        for (const b of st) {
          expect(b.l, `${tag} ${b.q.text}`).toBeGreaterThan(2);
          expect(b.r, `${tag} ${b.q.text}`).toBeLessThan(718);
          if (b.l > FPX - 4) expect(b.r, `${tag} ${b.q.text}`).toBeLessThanOrEqual(FPX + FPMAX + 1);
          else expect(b.r, `${tag} ${b.q.text}`).toBeLessThan(FPX - 4);
        }
        for (let i = 0; i < st.length; i++) for (let j = i + 1; j < st.length; j++) {
          const dy = Math.abs(st[i].q.y - st[j].q.y);
          if (dy > 34) continue;
          const gap = Math.max(st[i].l, st[j].l) - Math.min(st[i].r, st[j].r);
          if (gap < 0) expect(dy, `${tag} ${st[i].q.text} / ${st[j].q.text} at step ${k}`).toBeGreaterThan(34);
        }
      }
    }
  });
  it('English and Malayalam pictures are identical; only captions differ', () => {
    const en = buildDnaScenes('fraction-line', FL_ADD_SAMPLE, 'en', 'T')[0];
    const ml = buildDnaScenes('fraction-line', FL_ADD_SAMPLE, 'ml', 'T')[0];
    expect(ml.items.map((it) => `${it.id}:${it.kind}:${it.text}`)).toEqual(en.items.map((it) => `${it.id}:${it.kind}:${it.text}`));
    expect(ml.captions.map((x) => x.text)).not.toEqual(en.captions.map((x) => x.text));
  });
  it('builds and validates every case', { timeout: 120000 }, () => {
    for (const p of CASES.filter((_, i) => i % 3 === 0)) {
      expect(validatePlan('fraction-line', p, RD), JSON.stringify(p.fracs ?? p.frac)).toEqual([]);
      expect(() => buildDnaScenes('fraction-line', p, 'en', 'T')).not.toThrow();
    }
  });
});
