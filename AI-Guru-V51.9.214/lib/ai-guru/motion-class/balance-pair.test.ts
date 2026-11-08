import { describe, expect, it } from 'vitest';
import { drawMotionFrame } from '../reels/motion';
import { selectDna } from './dna/registry';
import { buildDnaScenes } from './dna/builders';
import { PAIR_BEADS_SAMPLE, PAIR_PRICE_SAMPLE, PAIR_SAMPLES, PAIR_SHARE_SAMPLE, PAIR_ADD_SAMPLE } from './samples/balance-pair';
import { combineOf, findPairEquations, lineCheck, lineCombine, lineEq, lineKnown, lineReduced, lineSubst, lineUnknown, pairFacts, pairProblem, PS, tilt, type PairEq, type Tok } from './dna/pair-math';
import type { PairPlan } from './dna/types';
import type { BookBlock } from './segment';
import { validatePlan } from './plan/validate';
import { offlinePair, offlinePlan } from './plan/offline';
import { qaLayout, qaPlan } from './plan/qa';
import { textOnlyWarning, visualStats } from './plan/visual-qa';
import { compileClass } from './class';

const RD = { en: 'x', ml: 'എ' };
const say = { en: 'x', ml: 'എ' };
const block = (text: string, kind: BookBlock['kind'] = 'math'): BookBlock => ({ id: 'b', kind, page: 1, chapterId: 'c', sectionId: 's', lines: [{ text, math: kind === 'math' } as BookBlock['lines'][number]], text });
const txt = (t: Tok[]) => t.map(([s]) => s).join(' ');
const steps = (...ops: string[]) => ops.map((op) => ({ op, say })) as PairPlan['steps'];
const FULL = steps('show', 'combine', 'solve', 'back', 'check');

/** Every legal pair on a small grid: x, y 1–12, coefficients 1–3, b ±1–3. */
const CASES: PairPlan[] = [];
for (let x = 1; x <= 12; x++) for (let y = 1; y <= 12; y++) for (let a1 = 1; a1 <= 3; a1++) for (let a2 = 1; a2 <= 3; a2++) for (const b1 of [-3, -2, -1, 1, 2, 3]) for (const b2 of [-3, -2, -1, 1, 2, 3]) {
  const e1: PairEq = { a: a1, b: b1, c: a1 * x + b1 * y };
  const e2: PairEq = { a: a2, b: b2, c: a2 * x + b2 * y };
  if (e1.c < 1 || e2.c < 1) continue;
  const p: PairPlan = { e1, e2, steps: FULL };
  if (pairProblem(p, 'p') === null) CASES.push(p);
}

describe('the numbers are true', () => {
  it('there are plenty of legal pairs, and every one has the answers it was made from', () => {
    expect(CASES.length).toBeGreaterThan(1500);
    for (const p of CASES.filter((_, i) => i % 7 === 0)) {
      const f = pairFacts(p);
      expect(p.e1.a * f.x + p.e1.b * f.y).toBe(p.e1.c);
      expect(p.e2.a * f.x + p.e2.b * f.y).toBe(p.e2.c);
      // the combined scale is true too: coef × kept = rhs
      expect(f.comb.coef * f.kv).toBe(f.comb.rhs);
      expect(f.comb.coef).toBeGreaterThan(0);
      expect(f.comb.rhs).toBeGreaterThan(0);
      // the number tile and the rest balance again after it comes off both pans
      expect(f.back.coefU * f.uv).toBe(f.back.n);
      expect(f.back.n + f.back.num).toBe((f.back.eq === 1 ? p.e1 : p.e2).c);
      expect(f.back.n).toBeGreaterThan(0);
      expect(f.back.coefU).toBeGreaterThan(0);
    }
  });
  it('adding or subtracting really removes one unknown', () => {
    for (const p of CASES.filter((_, i) => i % 11 === 0)) {
      const c = combineOf(p.e1, p.e2)!;
      const [hi, lo] = c.kind === 'sub' ? (c.first === 1 ? [p.e1, p.e2] : [p.e2, p.e1]) : [p.e1, p.e2];
      const s = c.kind === 'add' ? 1 : -1;
      const ax = hi.a + s * lo.a;
      const by = hi.b + s * lo.b;
      expect(c.drop === 'x' ? ax : by).toBe(0);
      expect(c.drop === 'x' ? by : ax).toBe(c.coef);
      expect(hi.c + s * lo.c).toBe(c.rhs);
    }
  });
  it('the written lines agree with the tiles', () => {
    const f = pairFacts(PAIR_BEADS_SAMPLE);
    expect(txt(lineEq(PAIR_BEADS_SAMPLE.e1, 'x', 'y'))).toBe('x + y = 100');
    expect(txt(lineEq(PAIR_BEADS_SAMPLE.e2, 'x', 'y'))).toBe('x − y = 10');
    expect(txt(lineCombine(f))).toBe('2x = 110');
    expect(txt(lineKnown(f))).toBe('x = 55');
    expect(txt(lineSubst(f))).toBe('55 + y = 100');
    expect(txt(lineReduced(f))).toBe('y = 45');
    expect(txt(lineUnknown(f))).toBe('y = 45');
    expect(txt(lineCheck(PAIR_BEADS_SAMPLE.e2, f))).toBe('55 − 45 = 10');
    const g = pairFacts(PAIR_SHARE_SAMPLE);
    expect(txt(lineCombine(g))).toBe('4y = 16');
    expect(txt(lineSubst(g))).toBe('2x + 3 × 4 = 22');
    expect(txt(lineReduced(g))).toBe('2x = 10');
    expect(txt(lineCheck(PAIR_SHARE_SAMPLE.e2, g))).toBe('2 × 5 − 4 = 6');
    const h = pairFacts(PAIR_PRICE_SAMPLE);
    expect([h.x, h.y]).toEqual([1000, 10000]);
    expect(txt(lineCombine(h))).toBe('3x = 3000');
    const k = pairFacts(PAIR_ADD_SAMPLE);
    expect([k.x, k.y]).toEqual([4, 2]);
    expect(txt(lineCombine(k))).toBe('5x = 20');
  });
  it('rejects what cannot be shown', () => {
    const p = (e1: PairEq, e2: PairEq): string | null => pairProblem({ e1, e2, steps: [] }, 'p');
    expect(p({ a: 1, b: 1, c: 100 }, { a: 1, b: -1, c: 10 })).toBeNull();
    expect(p({ a: 5, b: 1, c: 10 }, { a: 1, b: 1, c: 5 })).toMatch(/1 to 4/);
    expect(p({ a: 1, b: 0, c: 10 }, { a: 1, b: 1, c: 5 })).toMatch(/not 0/);
    expect(p({ a: 1, b: 1, c: 10 }, { a: 1, b: 1, c: 10 })).toMatch(/no single solution/);
    expect(p({ a: 1, b: 1, c: 10 }, { a: 1, b: -1, c: 3 })).toMatch(/not whole numbers/);
    expect(p({ a: 1, b: 1, c: 10 }, { a: 2, b: 3, c: 26 })).toMatch(/add or subtract/); // needs multiplying first
    expect(p({ a: 1, b: -1, c: 3 }, { a: 2, b: -1, c: 7 })).toMatch(/plus before y/);
    expect(p({ a: 1, b: 1, c: 1 }, { a: 1, b: -1, c: -3 })).toMatch(/1 to/);
  });
});

describe('the scales tip like real ones', () => {
  it('the heavier pan goes down and equal weights stay level', () => {
    expect(tilt(5, 5)).toBe(0);
    expect(tilt(10, 4)).toBeLessThan(0);
    expect(tilt(4, 10)).toBeGreaterThan(0);
    expect(Math.abs(tilt(1, 1000))).toBeLessThanOrEqual(PS.tiltMax + 1e-9);
  });
});

describe('the DNA', () => {
  it('every sample validates, builds, passes the quality gate and has a picture, not only text', () => {
    for (const p of PAIR_SAMPLES) {
      expect(validatePlan('balance-pair', p, RD)).toEqual([]);
      const [sc] = buildDnaScenes('balance-pair', p, 'en', 'T');
      expect(sc.captions.length).toBe(p.steps.length + (p.title ? 1 : 0));
      expect(qaLayout('balance-pair', p)).toEqual([]);
      expect(qaPlan('balance-pair', p, RD)).toEqual([]);
      expect(textOnlyWarning({ dna: 'balance-pair', teach: p })).toBeUndefined();
      expect(visualStats([sc]).graphics).toBeGreaterThanOrEqual(5);
      expect(sc.durationMs).toBeLessThan(80_000);
    }
  });
  it('English and Malayalam have identical pictures', () => {
    const en = buildDnaScenes('balance-pair', PAIR_SHARE_SAMPLE, 'en', 'T')[0];
    const ml = buildDnaScenes('balance-pair', PAIR_SHARE_SAMPLE, 'ml', 'T')[0];
    expect(ml.items.map((i) => i.id)).toEqual(en.items.map((i) => i.id));
    expect(ml.captions.length).toBe(en.captions.length);
  });
  it('draws without error in every format and theme', () => {
    const noop = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? (x: string) => ({ width: x.length * 10 }) : () => undefined), set: () => true }) as unknown as CanvasRenderingContext2D;
    for (const p of PAIR_SAMPLES) {
      const [sc] = buildDnaScenes('balance-pair', p, 'en', 'T');
      for (const format of ['vertical', 'landscape', 'square'] as const) for (const theme of ['light', 'dark'] as const) for (const f of [0.1, 0.5, 0.97]) drawMotionFrame(noop, sc, sc.durationMs * f, { format, theme } as never);
    }
  });
  it('a sample of legal pairs all build', () => {
    for (const p of CASES.filter((_, i) => i % 97 === 0)) expect(() => buildDnaScenes('balance-pair', p, 'en', 'T')).not.toThrow();
  });
});

describe('the validator', () => {
  const ok = (p: unknown) => validatePlan('balance-pair', p, RD);
  it('wants the five steps in order, each with a caption', () => {
    expect(ok({ e1: PAIR_BEADS_SAMPLE.e1, e2: PAIR_BEADS_SAMPLE.e2, steps: FULL })).toEqual([]);
    expect(ok({ e1: PAIR_BEADS_SAMPLE.e1, e2: PAIR_BEADS_SAMPLE.e2, steps: steps('show', 'solve', 'combine', 'back', 'check') }).join(' ')).toMatch(/must be "combine"/);
    expect(ok({ e1: PAIR_BEADS_SAMPLE.e1, e2: PAIR_BEADS_SAMPLE.e2, steps: steps('show', 'combine') }).join(' ')).toMatch(/"solve" is missing/);
    expect(ok({ e1: PAIR_BEADS_SAMPLE.e1, e2: PAIR_BEADS_SAMPLE.e2, steps: [{ op: 'show' }, ...FULL.slice(1)] }).join(' ')).toMatch(/say is required/);
  });
  it('explains an impossible pair', () => {
    expect(ok({ e1: { a: 1, b: 1, c: 10 }, e2: { a: 2, b: 3, c: 26 }, steps: FULL }).join(' ')).toMatch(/add or subtract/);
  });
});

describe('choosing the DNA', () => {
  const dna = (t: string, kind: BookBlock['kind'] = 'math') => selectDna(block(t, kind), 'Pairs of equations').dna;
  it('picks the two scales for a pair that one add or subtract solves', () => {
    expect(dna('x + y = 100\nx − y = 10')).toBe('balance-pair');
    expect(dna('x + y = 11000\n4x + y = 14000')).toBe('balance-pair');
    expect(dna('Solve 2x + 3y = 22 and 2x − y = 6 by elimination.', 'problem')).toBe('balance-pair');
    expect(dna('Solve the pair of linear equations 3x + 3y = 18 and 2x − 3y = 2.', 'prose')).toBe('balance-pair');
  });
  it('leaves alone what two scales cannot show', () => {
    expect(dna('x + y = 10\n2x + 3y = 26')).not.toBe('balance-pair'); // needs multiplying first
    expect(dna('Draw the graph of x + y = 100 and x − y = 10.', 'prose')).not.toBe('balance-pair');
    expect(dna('x + y = 10\nx − y = 3')).not.toBe('balance-pair'); // x = 6.5
    expect(dna('2x + 5 = 25')).not.toBe('balance-pair');
    expect(dna('x² + y = 10')).not.toBe('balance-pair');
  });
  it('finds the pair in a paragraph', () => {
    const found = findPairEquations('The sum is x + y = 100 and the difference is x − y = 10.');
    expect(found).toEqual([{ e1: { a: 1, b: 1, c: 100 }, e2: { a: 1, b: -1, c: 10 } }]);
    expect(findPairEquations('2x + y = 7')).toEqual([]);
  });
});

describe('the offline planner', () => {
  it('writes a valid plan with the numbers in the captions', () => {
    const plan = offlinePair('x + y = 100\nx − y = 10')!;
    expect(validatePlan('balance-pair', plan, RD)).toEqual([]);
    expect(plan.steps.map((s) => s.op)).toEqual(['show', 'combine', 'solve', 'back', 'check']);
    expect(plan.steps[2].say.en).toMatch(/55/);
    for (const p of CASES.filter((_, i) => i % 131 === 0)) {
      const o = offlinePair(`${p.e1.a}x ${p.e1.b < 0 ? '−' : '+'} ${Math.abs(p.e1.b)}y = ${p.e1.c} and ${p.e2.a}x ${p.e2.b < 0 ? '−' : '+'} ${Math.abs(p.e2.b)}y = ${p.e2.c}`);
      expect(o, JSON.stringify(p)).not.toBeNull();
      expect(validatePlan('balance-pair', o, RD)).toEqual([]);
    }
  });
  it('offlinePlan uses it, and falls back to the equation pair when the scales cannot show it', () => {
    const plan = offlinePlan(block('x + y = 100\nx − y = 10'), 'Pairs of equations', 'Solving');
    expect(plan.dna).toBe('balance-pair');
    const other = offlinePlan(block('x + y = 10\n2x + 3y = 26'), 'Pairs of equations', 'Solving');
    expect(other.dna).not.toBe('balance-pair');
  });
  it('compiles into a class with English before Malayalam', () => {
    const b = block('x + y = 100\nx − y = 10');
    const plan = { ...offlinePlan(b, 'Pairs of equations', 'Solving'), blockId: 'b' };
    const segs = compileClass([b], new Map([['b', plan]]), { title: 'T' }, { order: 'per-language', languages: ['en', 'ml'] });
    expect(segs.filter((s) => s.phase === 'teach').length).toBeGreaterThanOrEqual(1);
  });
});
