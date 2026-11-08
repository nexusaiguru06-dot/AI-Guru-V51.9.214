import { describe, expect, it } from 'vitest';
import { drawMotionFrame, evalItem, type MotionScene } from '../reels/motion';
import { tokenWidth } from '../reels/motion/metrics';
import { selectDna } from './dna/registry';
import { buildDnaScenes } from './dna/builders';
import { WIN, checkHolds, checkText, clipLine, eliminate, eqProblem, eqText, onLine, solve, substitute, type Eq } from './dna/lin-math';
import { labelSpot } from './dna/lin-builders';
import type { BlockPlan, LinPlan } from './dna/types';
import type { BookBlock } from './segment';
import { validatePlan } from './plan/validate';
import { offlineLinear, offlinePlan } from './plan/offline';
import { textOnlyWarning, visualStats } from './plan/visual-qa';
import { compileClass, segmentReel } from './class';
import { LIN_BOTH_SAMPLE, LIN_FULL_SAMPLE } from './samples/linear-system';

const block = (text: string, kind: BookBlock['kind'] = 'prose'): BookBlock => ({ id: 'b', kind, page: 1, chapterId: 'c', sectionId: 's', lines: [{ text, math: false } as BookBlock['lines'][number]], text });
const say = { en: 'x', ml: 'എ' };
const RD = { en: 'x', ml: 'എ' };

/** Every whole-number system with a solution in ±6, coefficients 1..9 in size, c inside ±60, det ≠ 0. */
function systems(): Array<{ e1: Eq; e2: Eq; x: number; y: number }> {
  const out: Array<{ e1: Eq; e2: Eq; x: number; y: number }> = [];
  const co = [-9, -5, -3, -2, -1, 1, 2, 3, 4, 6, 7, 9];
  for (const x of [-6, -2, 0, 1, 3, 6]) for (const y of [-5, -1, 0, 2, 4, 6]) for (const a1 of co) for (const b1 of [-4, -1, 2, 3, 9]) for (const a2 of [-6, -1, 2, 5, 8]) for (const b2 of [-9, -3, 1, 4, 6]) {
    const e1 = { a: a1, b: b1, c: a1 * x + b1 * y };
    const e2 = { a: a2, b: b2, c: a2 * x + b2 * y };
    if (Math.abs(e1.c) > 60 || Math.abs(e2.c) > 60 || a1 * b2 - a2 * b1 === 0) continue;
    out.push({ e1, e2, x, y });
  }
  return out;
}
const ALL = systems();

describe('the algebra is exact', () => {
  it('has a large, varied test set', () => expect(ALL.length).toBeGreaterThan(5000));
  it('solve finds the whole-number solution', () => {
    for (const s of ALL) expect(solve(s)).toEqual({ x: s.x, y: s.y });
  });
  it('elimination: scaled equations have equal-size coefficients, the sum/difference has one unknown, its value is the solution', { timeout: 30000 }, () => {
    for (const s of ALL.filter((_, i) => i % 3 === 0)) for (const v of ['x', 'y'] as const) {
      const el = eliminate(s, v);
      const q1 = v === 'x' ? el.s1.a : el.s1.b;
      const q2 = v === 'x' ? el.s2.a : el.s2.b;
      expect(Math.abs(q1)).toBe(Math.abs(q2));
      expect(q1 + (el.op === '+' ? q2 : -q2)).toBe(0);
      expect(el.m1).toBeGreaterThanOrEqual(1);
      expect(el.m2).toBeGreaterThanOrEqual(1);
      expect(el.r).not.toBe(0);
      expect(el.value).toBe(el.left === 'x' ? s.x : s.y);
      // the scaled equations are still true at the solution
      expect(checkHolds(el.s1, s.x, s.y)).toBe(true);
      expect(checkHolds(el.s2, s.x, s.y)).toBe(true);
    }
  });
  it('substitution finds the other unknown, whichever equation is used', () => {
    for (const s of ALL.filter((_, i) => i % 7 === 0)) for (const into of [1, 2] as const) for (const known of ['x', 'y'] as const) {
      const sb = substitute(s, known, known === 'x' ? s.x : s.y, into);
      expect(sb.value).toBe(known === 'x' ? s.y : s.x);
      expect(sb.coef * sb.value + 0).toBe(sb.rhs + 0);
    }
  });
  it('the check lines are true and read as maths', () => {
    for (const s of ALL.filter((_, i) => i % 11 === 0)) {
      expect(checkHolds(s.e1, s.x, s.y)).toBe(true);
      expect(checkText(s.e1, s.x, s.y)).toMatch(/^[−(0-9]/);
    }
    expect(checkText({ a: 3, b: 2, c: 12 }, 2, 3)).toBe('3(2) + 2(3) = 12');
    expect(checkText({ a: 2, b: -1, c: 1 }, 2, 3)).toBe('2(2) − 3 = 1');
    expect(checkText({ a: -1, b: -4, c: -6 }, 2, 1)).toBe('−2 − 4(1) = −6');
    expect(checkText({ a: 1, b: 1, c: -1 }, 2, -3)).toBe('2 + (−3) = −1');
  });
  it('equation text', () => {
    expect(eqText({ a: 3, b: 2, c: 12 })).toBe('3x + 2y = 12');
    expect(eqText({ a: 2, b: -1, c: 1 })).toBe('2x − y = 1');
    expect(eqText({ a: -1, b: -4, c: -6 })).toBe('−x − 4y = −6');
    expect(eliminate({ e1: { a: 3, b: 2, c: 12 }, e2: { a: 2, b: -1, c: 1 } }, 'y').text).toBe('7x = 14');
    expect(substitute({ e1: { a: 3, b: 2, c: 12 }, e2: { a: 2, b: -1, c: 1 } }, 'x', 2, 2).line1).toBe('2(2) − y = 1');
    expect(substitute({ e1: { a: 3, b: 2, c: 12 }, e2: { a: 2, b: -1, c: 1 } }, 'x', 2, 1).line1).toBe('3(2) + 2y = 12');
  });
  it('refuses systems that cannot be taught cleanly', () => {
    expect(solve({ e1: { a: 1, b: 2, c: 3 }, e2: { a: 2, b: 4, c: 7 } })).toHaveProperty('error', 'the two lines are parallel (no solution)');
    expect(JSON.stringify(solve({ e1: { a: 1, b: 2, c: 3 }, e2: { a: 2, b: 4, c: 6 } }))).toMatch(/same line/);
    expect(JSON.stringify(solve({ e1: { a: 1, b: 1, c: 1 }, e2: { a: 1, b: -2, c: 0 } }))).toMatch(/whole numbers/);
    expect(JSON.stringify(solve({ e1: { a: 1, b: 1, c: 40 }, e2: { a: 1, b: -1, c: 0 } }))).toMatch(/between −6 and 6/);
    expect(eqProblem({ a: 0, b: 1, c: 1 }, 'e')).toMatch(/non-zero/);
    expect(eqProblem({ a: 10, b: 1, c: 1 }, 'e')).toMatch(/non-zero/);
    expect(eqProblem({ a: 1, b: 1, c: 61 }, 'e')).toMatch(/between/);
    expect(eqProblem({ a: 1.5, b: 1, c: 1 }, 'e')).toMatch(/whole/);
  });
});

describe('the lines are drawn where the equations put them', () => {
  it('both ends lie on the line and on the window edge, for every equation', () => {
    for (const s of ALL.filter((_, i) => i % 5 === 0)) for (const e of [s.e1, s.e2]) {
      const [p, q] = clipLine(e);
      expect(onLine(e, p)).toBe(true);
      expect(onLine(e, q)).toBe(true);
      for (const r of [p, q]) {
        expect(Math.max(Math.abs(r[0]), Math.abs(r[1]))).toBeCloseTo(WIN, 6);
        expect(Math.abs(r[0])).toBeLessThanOrEqual(WIN + 1e-9);
        expect(Math.abs(r[1])).toBeLessThanOrEqual(WIN + 1e-9);
      }
      expect(p[0]).toBeLessThanOrEqual(q[0]);
    }
  });
  it('the solution lies on both drawn lines', () => {
    for (const s of ALL.filter((_, i) => i % 5 === 0)) for (const e of [s.e1, s.e2]) {
      const [p, q] = clipLine(e);
      // (x, y) between the ends
      const k = p[0] === q[0] ? (s.y - p[1]) / (q[1] - p[1]) : (s.x - p[0]) / (q[0] - p[0]);
      expect(k).toBeGreaterThanOrEqual(-1e-9);
      expect(k).toBeLessThanOrEqual(1 + 1e-9);
      expect(onLine(e, [s.x, s.y])).toBe(true);
    }
  });
  it('the solution label stays inside the window and clear of both lines', () => {
    for (const s of ALL.filter((_, i) => i % 9 === 0)) {
      const [dx, dy] = labelSpot(s.x, s.y, [s.e1, s.e2]);
      expect(Math.abs(s.x + dx)).toBeLessThanOrEqual(WIN);
      expect(Math.abs(s.y + dy)).toBeLessThanOrEqual(WIN);
    }
    // the sample: the label is at least 1 unit from both lines
    const [dx, dy] = labelSpot(2, 3, [LIN_FULL_SAMPLE.e1, LIN_FULL_SAMPLE.e2]);
    for (const e of [LIN_FULL_SAMPLE.e1, LIN_FULL_SAMPLE.e2]) expect(Math.abs(e.a * (2 + dx) + e.b * (3 + dy) - e.c) / Math.hypot(e.a, e.b)).toBeGreaterThan(1);
  });
});

describe('validator', () => {
  const v = (plan: unknown) => validatePlan('linear-system', plan, undefined, true).join(' | ');
  const e1 = { a: 3, b: 2, c: 12 };
  const e2 = { a: 2, b: -1, c: 1 };
  const show = { op: 'show' as const, say };
  const plan = (steps: LinPlan['steps'], a = e1, b = e2): LinPlan => ({ e1: a, e2: b, steps });
  it('samples pass', () => {
    for (const p of [LIN_FULL_SAMPLE, LIN_BOTH_SAMPLE]) expect(validatePlan('linear-system', p, RD)).toEqual([]);
  });
  it('numbers', () => {
    expect(v(plan([show], { a: 1, b: 2, c: 3 }, { a: 2, b: 4, c: 7 }))).toMatch(/parallel/);
    expect(v(plan([show], { a: 1, b: 2, c: 3 }, { a: 2, b: 4, c: 6 }))).toMatch(/same line/);
    expect(v(plan([show], { a: 1, b: 1, c: 1 }, { a: 1, b: -2, c: 0 }))).toMatch(/whole numbers/);
    expect(v(plan([show], { a: 0, b: 1, c: 1 }, e2))).toMatch(/e1: a and b must be non-zero/);
    expect(v({ steps: [show] })).toMatch(/needs whole numbers/);
  });
  it('order', () => {
    expect(v(plan([{ op: 'graph', say }]))).toMatch(/needs \{"op":"show"\}/);
    expect(v(plan([show, show]))).toMatch(/only once/);
    expect(v(plan([show, { op: 'meet', say }]))).toMatch(/"meet" needs "graph"/);
    expect(v(plan([show, { op: 'graph', say }, { op: 'graph', say }]))).toMatch(/"graph" only once/);
    expect(v(plan([show, { op: 'substitute', into: 1, say }]))).toMatch(/exactly one unknown/);
    expect(v(plan([show, { op: 'check', say }]))).toMatch(/both unknowns found/);
    expect(v(plan([show, { op: 'matrix', say }, { op: 'matrix', say }]))).toMatch(/"matrix" only once/);
  });
  it('elimination and substitution', () => {
    expect(v(plan([show, { op: 'eliminate', var: 'z' as 'x', say }]))).toMatch(/must be "x" or "y"/);
    expect(v(plan([show, { op: 'eliminate', var: 'x', say }, { op: 'eliminate', var: 'x', say }]))).toMatch(/already eliminated/);
    expect(v(plan([show, { op: 'eliminate', var: 'x', say }, { op: 'substitute', into: 3 as 1, say }]))).toMatch(/into must be 1 or 2/);
    expect(v(plan([show, { op: 'eliminate', var: 'x', say }, { op: 'substitute', into: 1, say }, { op: 'substitute', into: 2, say }]))).toMatch(/exactly one unknown/);
    expect(v(plan([show, { op: 'eliminate', var: 'x', say }, { op: 'substitute', into: 1, say }, { op: 'eliminate', var: 'y', say }]))).toMatch(/already found/);
    expect(v(plan([show, { op: 'eliminate', var: 'x', say }, { op: 'eliminate', var: 'y', say }, { op: 'check', say }]))).toBe('');
    expect(v(plan([show, { op: 'spin' as 'show', say }]))).toMatch(/not one of/);
    expect(v(plan([show, { op: 'graph', say: { en: '', ml: 'എ' } }]))).toMatch(/say is required/);
    expect(v(plan([]))).toMatch(/must list the steps/);
  });
});

describe('what the board shows (V51.9.136: worked step by step)', () => {
  const [s] = buildDnaScenes('linear-system', LIN_FULL_SAMPLE, 'en', 'T');
  const end = s.durationMs + 10;
  const visible = (sc: MotionScene, t: number) => sc.items.filter((i) => i.kind === 'text').map((i) => evalItem(i, t)).filter((st) => st.alpha > 0.5);
  /** Every visible text, and (V51.9.137: lines are written token by token) every working line joined by rows. */
  const texts = (sc: MotionScene, t: number) => {
    const vis = visible(sc, t);
    const work = vis.filter((st) => /^wk/.test(st.id));
    const byRow = new Map<number, typeof work>();
    for (const st of work) { const k = Math.round(st.y); byRow.set(k, [...(byRow.get(k) ?? []), st]); }
    return [...vis.map((st) => st.text), ...[...byRow.values()].map((r) => r.sort((p, q) => p.x - q.x).map((st) => st.text).join(' '))];
  };
  /** The end of the first caption whose text matches. */
  const at = (re: RegExp) => { const c = s.captions.find((x) => re.test(x.text)); expect(c, String(re)).toBeTruthy(); return c!.t1 - 40; };
  it('writes the equations token by token in the panel first', () => {
    const t0 = s.captions[2].t1 - 40; // title, show
    const row = (y: number) => visible(s, t0).filter((st) => Math.abs(st.y - y) < 3 && st.x > 440).sort((p, q) => p.x - q.x).map((st) => st.text).join('');
    expect(row(64)).toBe('(1)3x+2y=12');
    expect(row(104)).toBe('(2)2x−y=1');
  });
  it('elimination is many small steps: multiply, simplify, add, cancel, divide, answer', () => {
    const keys = s.captions.map((c) => c.text);
    const i = keys.findIndex((x) => /First we make one unknown disappear/.test(x));
    expect(i).toBeGreaterThan(0);
    expect(keys.slice(i, i + 8).map((x) => x.split(' ').slice(0, 3).join(' '))).toEqual([
      'First we make', 'Equation (1) already', 'We want the', 'Multiply each term:', 'Now the y', 'The y terms', '7x means 7', '14 divided by',
    ]);
    expect(texts(s, at(/^We want the y terms/))).toContain('2 × 2x − 2 × y = 2 × 1');
    expect(texts(s, at(/^Multiply each term: 2 × 2x/))).toContain('4x − 2y = 2');
    const sum = texts(s, at(/^Now the y terms are 2y and −2y/)).join(' ');
    expect(sum).toMatch(/3x \+ 4x \+ 2y − 2y = 12 \+ 2/);
    for (const w of ['7x = 14', 'x = 14 ÷ 7', 'x = 2']) expect(texts(s, at(/^14 divided by 7 is 2/)), w).toContain(w);
  });
  it('every working line has its short note on the right (what), and the caption says why', () => {
    const cap = s.captions.find((c) => /divide both sides by 7/.test(c.text))!;
    expect(cap.note).toBe('÷ 7 both sides');
    expect(cap.boardNote).toBe(true);
    expect(cap.text).toMatch(/opposite of multiplying/);
    const st = visible(s, cap.t1 - 40);
    const note = st.find((q) => q.text === '÷ 7 both sides')!;
    const line = st.filter((q) => /^wk/.test(q.id) && Math.abs(q.y - note.y) < 2);
    expect(line.map((q) => q.text).join(' ')).toBe('x = 14 ÷ 7');
    const lineRight = Math.max(...line.map((q) => q.x + tokenWidth(q.text, q.size) / 2));
    expect(note.x - tokenWidth(note.text, note.size) / 2).toBeGreaterThan(lineRight);
  });
  it('substitution: put the value in, multiply, move across, simplify, divide', () => {
    const t = texts(s, at(/^−3 divided by \(−1\) is 3/));
    for (const w of ['2x − y = 1', '2(2) − y = 1', '4 − y = 1', '−y = 1 − 4', '−y = −3', 'y = −3 ÷ (−1)', 'y = 3']) expect(t, w).toContain(w);
    const move = s.captions.find((c) => /take 4 away from the left side/.test(c.text))!;
    expect(move.note).toBe('− 4 both sides');
  });
  it('the check works both equations out and ticks them', () => {
    const chk = texts(s, at(/^Both equations are true/));
    expect(chk).toContain('3(2) + 2(3) = 6 + 6 = 12');
    expect(chk).toContain('2(2) − 3 = 4 − 3 = 1');
    expect(s.items.filter((i) => i.kind === 'tick').length).toBeGreaterThanOrEqual(2);
  });
  it('the graph page comes back: the meeting point, the answers in the panel, the matrix', () => {
    expect(texts(s, at(/^They meet at exactly one point/))).toContain('(2, 3)');
    const fin = texts(s, end);
    expect(fin).toContain('x = 2');
    expect(fin).toContain('y = 3');
    expect(fin).not.toContain('2(2) − y = 1'); // the working page is gone
  });
  it('matrix form: coefficients fly out of the equations into the matrix', () => {
    const st = visible(s, end);
    const find = (txt: string, x0: number, x1: number, y: number) => st.some((q) => q.text === txt && q.x >= x0 && q.x <= x1 && Math.abs(q.y - y) < 3);
    expect(find('3', 480, 700, 190)).toBe(true);
    expect(find('2', 480, 700, 190)).toBe(true);
    expect(find('12', 480, 700, 190)).toBe(true);
    expect(find('2', 480, 700, 234)).toBe(true);
    expect(find('−1', 480, 700, 234)).toBe(true);
    expect(find('1', 480, 700, 234)).toBe(true);
    const three = st.find((q) => q.text === '3' && Math.abs(q.y - 190) < 3)!;
    const two = st.find((q) => q.text === '2' && Math.abs(q.y - 234) < 3)!;
    expect(three.color.toLowerCase()).toBe('#d22d2d');
    expect(two.color.toLowerCase()).toBe('#13a018');
  });
  it('nothing overlaps on a row and nothing leaves the board, at the end of every step', () => {
    for (const sc of [s, buildDnaScenes('linear-system', LIN_BOTH_SAMPLE, 'ml', 'T')[0]]) {
      for (const t of sc.captions.map((c) => c.t1 - 40)) {
        const box = visible(sc, t).map((q) => { const w = tokenWidth(q.text, q.size); return { q, l: q.x - w / 2, r: q.x + w / 2 }; });
        for (const b of box) {
          expect(b.l, b.q.text).toBeGreaterThan(4);
          expect(b.r, b.q.text).toBeLessThan(716);
          expect(b.q.y).toBeGreaterThan(8);
          expect(b.q.y).toBeLessThan(440);
        }
        for (let i = 0; i < box.length; i++) for (let j = i + 1; j < box.length; j++) {
          if (Math.abs(box[i].q.y - box[j].q.y) > 12) continue;
          const gap = Math.max(box[i].l, box[j].l) - Math.min(box[i].r, box[j].r);
          expect(gap, `${box[i].q.text} / ${box[j].q.text} at ${t}`).toBeGreaterThanOrEqual(-1e-6);
        }
      }
    }
  });
  it('English and Malayalam write the same maths; only captions and the small notes differ', () => {
    const ml = buildDnaScenes('linear-system', LIN_FULL_SAMPLE, 'ml', 'T')[0];
    const maths = (sc: MotionScene) => sc.items.filter((i) => !i.id.startsWith('nt')).map((i) => `${i.id}:${i.kind}:${i.text}`);
    expect(maths(ml)).toEqual(maths(s));
    expect(ml.captions.map((c) => c.text)).not.toEqual(s.captions.map((c) => c.text));
    expect(ml.captions.every((c) => !c.note || /[\u0D00-\u0D7F]|[=×÷()0-9xy]/.test(c.note))).toBe(true);
  });
  it('the build refuses a system with no clean solution', () => {
    expect(() => buildDnaScenes('linear-system', { e1: { a: 1, b: 1, c: 1 }, e2: { a: 1, b: -2, c: 0 }, steps: [] }, 'en', 'T')).toThrow(/whole numbers/);
  });
});

describe('selection', () => {
  const pick = (t: string, kind: BookBlock['kind'] = 'prose') => selectDna(block(t, kind)).dna;
  it('pair of linear equations talk → linear-system', () => {
    expect(pick('A pair of linear equations in two variables can be solved by the graphical method.')).toBe('linear-system');
    expect(pick('Solve the simultaneous equations by the elimination method.', 'exercise')).toBe('linear-system');
    expect(pick('We can write the system of equations 3x + 2y = 12 and 2x − y = 1 in matrix form.')).toBe('linear-system');
    expect(pick('Find the solution by the substitution method.', 'exercise')).toBe('linear-system');
  });
  it('the same words elsewhere stay elsewhere', () => {
    expect(pick('The equation 3x + 5 = 20 has one variable.')).not.toBe('linear-system');
    expect(pick('The matrix has 3 rows and 2 columns; each entry is written a_{11}.')).not.toBe('linear-system');
    expect(pick('Sine, cosine and tangent are trigonometric ratios.')).toBe('unit-circle');
  });
});

describe('offline planner', () => {
  it('reads two equations from the text and picks the cheaper unknown to eliminate', () => {
    const p = offlineLinear('Solve 3x + 2y = 12 and 2x − y = 1.')!;
    expect(p.e1).toEqual({ a: 3, b: 2, c: 12 });
    expect(p.e2).toEqual({ a: 2, b: -1, c: 1 });
    expect(p.steps.find((s) => s.op === 'eliminate')).toMatchObject({ var: 'y' });
    expect(validatePlan('linear-system', p, RD)).toEqual([]);
    const q = offlineLinear('x + y = 5 and x − y = 1')!;
    expect(q.e1).toEqual({ a: 1, b: 1, c: 5 });
    expect(q.e2).toEqual({ a: 1, b: -1, c: 1 });
    expect(validatePlan('linear-system', q, RD)).toEqual([]);
  });
  it('falls back (with a warning) when the numbers are not there or not clean', () => {
    expect(offlineLinear('A pair of linear equations in two variables.')).toBeNull();
    expect(offlineLinear('x + y = 1 and x − 2y = 0')).toBeNull();
    const pl = offlinePlan(block('A pair of linear equations in two variables is called a system.'), '', '');
    expect(pl.dna).toBe('concept-board');
    expect(pl.warnings?.join()).toMatch(/AI planner needed/);
    const good = offlinePlan(block('Solve the pair of linear equations 3x + 2y = 12 and 2x − y = 1 by elimination.', 'exercise'), '', '');
    expect(good.dna).toBe('linear-system');
  });
});

describe('picture and class', () => {
  it('samples are real pictures', () => {
    for (const teach of [LIN_FULL_SAMPLE, LIN_BOTH_SAMPLE]) {
      expect(textOnlyWarning({ dna: 'linear-system', teach })).toBeUndefined();
      expect(visualStats(buildDnaScenes('linear-system', teach, 'en', 'T')).graphics).toBeGreaterThanOrEqual(3);
    }
  });
  it('compiles into a class: the algebra steps are split into many small captioned steps', () => {
    const plan: BlockPlan = { blockId: 'b', dna: 'linear-system', read: RD, teach: LIN_FULL_SAMPLE, source: 'fixture' };
    const segs = compileClass([block('A pair of linear equations.')], new Map([['b', plan]]), { title: 'T' });
    for (const seg of segs.filter((s) => s.phase === 'teach')) expect(segmentReel(seg).parts[0].captions.length).toBeGreaterThan(LIN_FULL_SAMPLE.steps.length + 12);
  });
  it('draws without error in every format and theme', () => {
    const noop = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? (s: string) => ({ width: s.length * 10 }) : /Gradient|Pattern/.test(String(k)) ? () => ({ addColorStop: () => undefined }) : () => undefined), set: () => true }) as unknown as CanvasRenderingContext2D;
    for (const teach of [LIN_FULL_SAMPLE, LIN_BOTH_SAMPLE]) {
      const sc = buildDnaScenes('linear-system', teach, 'ml', 'T')[0];
      for (const format of ['landscape', 'vertical', 'square'] as const) for (const theme of ['light', 'dark'] as const) for (const f of [0.1, 0.4, 0.7, 0.99]) drawMotionFrame(noop, sc, sc.durationMs * f, { format, theme } as never);
    }
  });
  it('every sample system is built without error for many systems and both orders', () => {
    for (const s of ALL.filter((_, i) => i % 97 === 0)) {
      const plan: LinPlan = { e1: s.e1, e2: s.e2, steps: [{ op: 'show', say }, { op: 'graph', say }, { op: 'meet', say }, { op: 'eliminate', var: 'x', say }, { op: 'substitute', into: 2, say }, { op: 'check', say }, { op: 'matrix', say }] };
      expect(validatePlan('linear-system', plan, RD), JSON.stringify(s)).toEqual([]);
      expect(() => buildDnaScenes('linear-system', plan, 'en', 'T')).not.toThrow();
    }
  });
});
