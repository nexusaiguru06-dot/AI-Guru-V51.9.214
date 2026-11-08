import { describe, expect, it } from 'vitest';
import { drawMotionFrame, evalItem, type MotionScene } from '../reels/motion';
import { measure, measureSpaced, richRuns, richWidth, setMeasurer } from '../reels/motion/metrics';
import { selectDna } from './dna/registry';
import { buildDnaScenes } from './dna/builders';
import { fmtSet } from './dna/venn-builders';
import { SET_NAMES, codeAt, elementCodes, elementsOf, evalMask, exprText, inclusion, maskCodes, parseSetExpr, placeInRegion, regionOf, sameSet, vennGeometry, type Expr } from './dna/venn-math';
import type { BlockPlan, VennPlan } from './dna/types';
import type { BookBlock } from './segment';
import { validatePlan } from './plan/validate';
import { offlinePlan, offlineVenn } from './plan/offline';
import { textOnlyWarning, visualStats } from './plan/visual-qa';
import { compileClass, segmentReel } from './class';
import { VENN_ELEMENTS_SAMPLE, VENN_OPERATIONS_SAMPLE, VENN_THREE_SAMPLE } from './samples/venn-sets';

const block = (text: string, kind: BookBlock['kind'] = 'prose'): BookBlock => ({ id: 'b', kind, page: 1, chapterId: 'c', sectionId: 's', lines: [{ text, math: false } as BookBlock['lines'][number]], text });
const say = { en: 'x', ml: 'എ' };
const RD = { en: 'x', ml: 'എ' };
const codes = (s: string, n = 2) => regionOf(s, n).codes;
const texts = (s: MotionScene) => s.items.filter((i) => i.kind === 'text').map((i) => evalItem(i, s.durationMs + 10).text);

describe('drawn set symbols (the board font has no ∪ ∩ ∅ ∈)', () => {
  it('each is its own run with room for the drawing', () => {
    expect(richRuns('A ∪ B').map((r) => r.text)).toEqual(['A ', '∪', ' B']);
    expect(richRuns('A^c ∩ B^c').filter((r) => r.sym).length).toBe(1);
    expect(richRuns('x ∈ ℝ').some((r) => r.sym)).toBe(true);
    expect(richRuns('∅')).toEqual([{ text: '∅', sup: false, sym: true }]);
    expect(richWidth('∪', 30)).toBeGreaterThan(measure('A', 30) * 0.8);
  });
  it('drawing never types the missing glyph', () => {
    const typed: string[] = [];
    const ctx = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? (s: string) => ({ width: s.length * 10 }) : k === 'fillText' ? (s: string) => typed.push(s) : () => undefined), set: () => true }) as unknown as CanvasRenderingContext2D;
    const sc = buildDnaScenes('venn-sets', VENN_ELEMENTS_SAMPLE, 'en', 'T')[0];
    drawMotionFrame(ctx, sc, sc.durationMs * 0.95, { format: 'landscape' } as never);
    expect(typed.some((s) => /[∪∩∅]/.test(s))).toBe(false);
  });
});

describe('spaces around symbols are counted even when the canvas drops them', () => {
  it('measureSpaced adds the width of leading and trailing spaces', () => {
    setMeasurer((text, px) => text.trim().length * px * 0.5); // a back-end that ignores surrounding spaces
    try {
      expect(measure('A ', 30)).toBe(measure('A', 30));
      expect(measureSpaced('A ', 30)).toBeCloseTo(2 * 15, 6); // the space counts again
      expect(measureSpaced(' A ', 30)).toBeCloseTo(3 * 15, 6);
    } finally {
      setMeasurer(null);
    }
    // With a measurer that keeps spaces, the result equals plain measure.
    setMeasurer((text, px) => text.length * px * 0.5);
    try {
      expect(measureSpaced(' A ', 20)).toBeCloseTo(3 * 10, 6);
      expect(richWidth('A ∪ B', 20)).toBeCloseTo(measureSpaced('A ', 20) + 20 * 0.72 + measureSpaced(' B', 20), 6);
    } finally {
      setMeasurer(null);
    }
  });
});

describe('set expressions', () => {
  it('parse the symbols and the ASCII spellings alike', () => {
    for (const s of ['A U B', 'A∪B', 'A u B'.replace('u', 'U')]) expect(codes(s)).toEqual([1, 2, 3]);
    for (const s of ["A'", 'A^c', 'Aᶜ', 'A′']) expect(codes(s)).toEqual([0, 2]);
    expect(codes('A - B')).toEqual(codes('A−B'));
    expect(codes('A\\B')).toEqual([1]);
  });
  it('bad expressions are named', () => {
    const e = (s: string, n = 2) => parseSetExpr(s, n).error;
    expect(e('A∩')).toMatch(/too early/);
    expect(e('(A∩B')).toMatch(/missing/);
    expect(e('A∩B∪A')).toMatch(/brackets/);
    expect(e('A−B−A', 3)).toMatch(/ambiguous/);
    expect(e('A∩C')).toMatch(/does not exist/);
    expect(e('')).toMatch(/empty/);
    expect(e('A B')).toMatch(/unexpected/);
    expect(parseSetExpr('A∩B∩C', 3).error).toBeUndefined();
    expect(parseSetExpr('(A∩B)∪C', 3).error).toBeUndefined();
  });
  it('regions of the standard operations (2 sets: 1 = only A, 2 = only B, 3 = both, 0 = outside)', () => {
    expect(codes('A∩B')).toEqual([3]);
    expect(codes('A∪B')).toEqual([1, 2, 3]);
    expect(codes('A−B')).toEqual([1]);
    expect(codes('B−A')).toEqual([2]);
    expect(codes("(A∩B)'")).toEqual([0, 1, 2]);
    expect(codes("(A∪B)'")).toEqual([0]);
    expect(codes("A'∪B")).toEqual([0, 2, 3]);
    expect(codes('A∩B∩C', 3)).toEqual([7]);
    expect(codes('A∪B∪C', 3)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(codes('(A∩B)−C', 3)).toEqual([3]);
  });
  it('De Morgan and friends are recognised; false ones are not', () => {
    for (const n of [2, 3]) {
      expect(sameSet("A'∪B'", "(A∩B)'", n).same).toBe(true);
      expect(sameSet("A'∩B'", "(A∪B)'", n).same).toBe(true);
      expect(sameSet('A−B', "A∩B'", n).same).toBe(true);
      expect(sameSet("A''", 'A', n).same).toBe(true);
    }
    expect(sameSet("A'∩B'∩C'", "(A∪B∪C)'", 3).same).toBe(true);
    expect(sameSet('A∩(B∪C)', '(A∩B)∪(A∩C)', 3).same).toBe(true);
    const bad = sameSet('A∪B', 'A∩B', 2);
    expect(bad.same).toBe(false);
    expect(bad.differ).toEqual([1, 2]);
    expect(sameSet('A−B', 'B−A', 2).same).toBe(false);
    expect(sameSet("A'∪B'", "(A∪B)'", 2).same).toBe(false);
    expect(sameSet('A∩X', 'A', 2).error).toBeTruthy();
  });
  it('board text round-trips to the same region', () => {
    for (const s of ["A'∪B'", "(A∩B)'", 'A−B', '(A∩B)∪C', "(A∪B)'∩C", "A''"]) {
      const e = parseSetExpr(s, 3).expr!;
      expect(codes(exprText(e).replace(/\^c/g, "'"), 3)).toEqual(codes(s, 3));
    }
    expect(exprText(parseSetExpr("A'∪B'", 2).expr!)).toBe('A^c ∪ B^c');
    expect(exprText(parseSetExpr("(A∩B)'", 2).expr!)).toBe('(A ∩ B)^c');
  });
});

describe('independent check: region algebra agrees with real sets of numbers', () => {
  // Evaluate an expression directly on JavaScript Sets (no masks) and compare with the app's answer.
  const direct = (e: Expr, sets: Array<Set<number>>, universe: number[]): Set<number> => {
    if (e.t === 'set') return sets[e.i];
    if (e.t === 'not') {
      const inner = direct(e.e, sets, universe);
      return new Set(universe.filter((x) => !inner.has(x)));
    }
    const a = direct(e.a, sets, universe);
    const b = direct(e.b, sets, universe);
    if (e.op === '∪') return new Set([...a, ...b]);
    if (e.op === '∩') return new Set([...a].filter((x) => b.has(x)));
    return new Set([...a].filter((x) => !b.has(x)));
  };
  it('random sets, many expressions', () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const pool = ['A∩B', 'A∪B', "A'", 'A−B', 'B−A', "A'∪B'", "(A∩B)'", "A'∩B'", "(A∪B)'", "A'∪B", 'A∩B∩C', 'A∪B∪C', '(A∩B)−C', '(A∪B)∩C', "A'∩B'∩C'", "(A−B)'", "(A∩B')∪(B∩A')"];
    for (let trial = 0; trial < 60; trial++) {
      const universe = Array.from({ length: 12 }, (_, i) => i + 1);
      const sets = [0, 1, 2].map(() => new Set(universe.filter(() => rnd() < 0.45)));
      const es = { sets: sets.map((s) => [...s]), outside: universe.filter((x) => !sets.some((s) => s.has(x))) };
      for (const src of pool) {
        const n = /C/.test(src) ? 3 : 2;
        const sub = { sets: es.sets.slice(0, n), outside: universe.filter((x) => !sets.slice(0, n).some((s) => s.has(x))) };
        const want = [...direct(parseSetExpr(src, n).expr!, sets.slice(0, n), universe)].map(String).sort();
        const got = (elementsOf(src, sub).items ?? []).sort();
        expect(got, `${src} trial ${trial}`).toEqual(want.sort());
      }
    }
  });
  it('sameSet agrees with brute force on random pairs', () => {
    const exprs = ["A'∪B'", "(A∩B)'", 'A∪B', 'A∩B', 'A−B', "A∩B'", "A'", "(A∪B)'", "A'∩B'", "A'∪B", 'B−A'];
    for (const a of exprs) {
      for (const b of exprs) {
        const brute = maskCodes(0, 2).length === 0 && JSON.stringify(codes(a)) === JSON.stringify(codes(b));
        expect(sameSet(a, b, 2).same).toBe(brute);
      }
    }
  });
  it('evalMask on the four regions', () => {
    expect(evalMask(parseSetExpr('A', 2).expr!, 2)).toBe(0b1010);
  });
});

describe('elements, lists and counts are computed', () => {
  const es = { sets: [[2, 4, 6, 8], [1, 2, 3, 4]], outside: [5, 7] };
  it('element regions', () => {
    const c = elementCodes(es);
    expect(c.get('2')).toBe(3);
    expect(c.get('6')).toBe(1);
    expect(c.get('1')).toBe(2);
    expect(c.get('5')).toBe(0);
  });
  it('lists', () => {
    expect(elementsOf('A∩B', es).items).toEqual(['2', '4']);
    expect(elementsOf('A−B', es).items).toEqual(['6', '8']);
    expect(elementsOf("A'", es).items?.sort()).toEqual(['1', '3', '5', '7']);
    expect(fmtSet([])).toBe('∅');
    expect(fmtSet(['3', '4'])).toBe('{3, 4}');
  });
  it('inclusion–exclusion counts match the real union', () => {
    expect(inclusion(es)).toEqual({ a: 4, b: 4, both: 2, union: 6 });
    expect(elementsOf('A∪B', es).items!.length).toBe(inclusion(es).union);
  });
});

describe('elements are placed inside their own region', () => {
  it('every position falls in the right region and none touch', () => {
    for (const n of [2, 3]) {
      const g = vennGeometry(n);
      for (let code = 0; code < 1 << n; code++) {
        const pos = placeInRegion(g, code, n === 2 ? 3 : 1);
        expect(pos, `n=${n} code=${code}`).not.toBeNull();
        for (const [x, y] of pos!) expect(codeAt(g, x, y)).toBe(code);
        for (let i = 0; i < pos!.length; i++) for (let j = i + 1; j < pos!.length; j++) expect(Math.hypot(pos![i][0] - pos![j][0], pos![i][1] - pos![j][1])).toBeGreaterThanOrEqual(22);
        for (const [x, y] of pos!) for (const [cx, cy, r] of g.circles) expect(Math.abs(Math.hypot(x - cx, y - cy) - r)).toBeGreaterThanOrEqual(15);
      }
    }
  });
  it('a region that is too small says so', () => {
    expect(placeInRegion(vennGeometry(3), 7, 12)).toBeNull();
  });
});

describe('samples pass the same validator as AI plans', () => {
  it('operations, elements and three-set samples (EN + ML)', () => {
    for (const p of [VENN_OPERATIONS_SAMPLE, VENN_ELEMENTS_SAMPLE, VENN_THREE_SAMPLE]) expect(validatePlan('venn-sets', p, RD)).toEqual([]);
  });
});

describe('validator rejects what cannot be right', () => {
  const v = (plan: unknown) => validatePlan('venn-sets', plan, undefined, true).join(' | ');
  const show = { op: 'show' as const, say };
  const plan = (steps: VennPlan['steps'], over: Partial<VennPlan> = {}): VennPlan => ({ sets: 2, steps, ...over });
  it('structure', () => {
    expect(v(plan([show], { sets: 4 as 2 }))).toMatch(/must be 2 or 3/);
    expect(v(plan([{ op: 'shade', expr: 'A∩B', say }]))).toMatch(/needs \{"op":"show"\}/);
    expect(v(plan([show, show]))).toMatch(/only once/);
    expect(v(plan([show, { op: 'explode' as 'clear', say }]))).toMatch(/not one of/);
    expect(v(plan([]))).toMatch(/must list the steps/);
    expect(v(plan([show, { op: 'clear', say: { en: '', ml: 'എ' } }]))).toMatch(/say is required/);
  });
  it('expressions', () => {
    expect(v(plan([show, { op: 'shade', expr: 'A∩C', say }]))).toMatch(/does not exist/);
    expect(v(plan([show, { op: 'shade', expr: 'A∩B∪A', say }]))).toMatch(/brackets/);
    expect(v(plan([show, { op: 'shade', expr: '', say }]))).toMatch(/set expression/);
  });
  it('a false identity is refused, with the regions that differ', () => {
    const m = v(plan([show, { op: 'identity', left: "A'∪B'", right: "(A∪B)'", say }]));
    expect(m).toMatch(/not the same set/);
    expect(m).toMatch(/only A|only B|A and B/);
    expect(v(plan([show, { op: 'identity', left: "A'∪B'", right: "(A∩B)'", say }]))).toBe('');
  });
  it('elements and what needs them', () => {
    expect(v(plan([show, { op: 'list', expr: 'A∩B', say }]))).toMatch(/needs "elements"/);
    expect(v(plan([show, { op: 'inclusion', say }]))).toMatch(/needs "elements"/);
    expect(v(plan([show, { op: 'inclusion', say }], { sets: 3, elements: [[1], [2], [3]] }))).toMatch(/two sets/);
    expect(v(plan([show], { elements: [[1, 2]] }))).toMatch(/2 lists/);
    expect(v(plan([show], { elements: [[1, 1], [2]] }))).toMatch(/repeated/);
    expect(v(plan([show], { elements: [[1, 2], [3]], outside: [2] }))).toMatch(/also in a set/);
    expect(v(plan([show], { elements: [['toolongword'], [1]] }))).toMatch(/at most 6 characters/);
    expect(v(plan([show], { elements: [[1, 2, 3, 4, 5, 6, 7, 8], [9]] }))).toMatch(/at most 6|too small/);
    expect(v(plan([show], { outside: [1] }))).toMatch(/needs "elements"/);
  });
});

describe('what the board shows', () => {
  it('shading covers exactly the regions of the expression', () => {
    const [s] = buildDnaScenes('venn-sets', VENN_OPERATIONS_SAMPLE, 'en', 'T');
    const regs = s.items.filter((i) => i.kind === 'region');
    const want = ['A∩B', 'A∪B', "A'", 'A−B', 'B−A', "A'∪B", "(A∩B)'", "A'∪B'", "A'∩B'"].map((e) => codes(e));
    expect(regs.map((r) => r.region!.codes)).toEqual(want);
    for (const r of regs) expect(r.region!.circles.length).toBe(2);
  });
  it('writes the expressions, lists and counts the app computed', () => {
    const [s] = buildDnaScenes('venn-sets', VENN_ELEMENTS_SAMPLE, 'en', 'T');
    const t = texts(s);
    for (const want of ['A ∩ B = {2, 4}', 'A ∪ B = {2, 4, 6, 8, 1, 3}', 'A^c = {1, 3, 5, 7}', 'n(A ∪ B) = n(A) + n(B) − n(A ∩ B)', '= 4 + 4 − 2 = 6']) expect(t).toContain(want);
    const ops = texts(buildDnaScenes('venn-sets', VENN_OPERATIONS_SAMPLE, 'en', 'T')[0]);
    expect(ops).toContain('A^c ∪ B^c = (A ∩ B)^c');
    expect(ops).toContain('A^c ∩ B^c = (A ∪ B)^c');
  });
  it('every element sits in the region it belongs to', () => {
    const [s] = buildDnaScenes('venn-sets', VENN_ELEMENTS_SAMPLE, 'en', 'T');
    const g = vennGeometry(2);
    const want = elementCodes({ sets: VENN_ELEMENTS_SAMPLE.elements!, outside: VENN_ELEMENTS_SAMPLE.outside! });
    const els = s.items.filter((i) => /^el\d+$/.test(i.id));
    expect(els.length).toBe(want.size);
    for (const i of els) expect(codeAt(g, i.x.at(0), i.y.at(0))).toBe(want.get(i.text));
  });
  it('a region the plan cannot fit fails to build, not silently', () => {
    const bad: VennPlan = { sets: 3, elements: [[1, 2, 3, 4, 5, 6], [1, 2, 3, 4, 5, 6], [1, 2, 3, 4, 5, 6]], steps: [{ op: 'show', say }] };
    expect(validatePlan('venn-sets', bad, undefined, true).join()).toMatch(/too small/);
  });
});

describe('English and Malayalam share the same picture', () => {
  it('same items, kinds and regions; only captions and circle words change language', () => {
    const en = buildDnaScenes('venn-sets', VENN_ELEMENTS_SAMPLE, 'en', 'T')[0];
    const ml = buildDnaScenes('venn-sets', VENN_ELEMENTS_SAMPLE, 'ml', 'T')[0];
    expect(ml.items.map((i) => `${i.id}:${i.kind}`)).toEqual(en.items.map((i) => `${i.id}:${i.kind}`));
    const diff = en.items.filter((i, k) => i.text !== ml.items[k].text).map((i) => i.id);
    expect(diff.sort()).toEqual(['word0', 'word1']);
    expect(en.items.filter((i) => i.kind === 'region').map((r) => r.region)).toEqual(ml.items.filter((i) => i.kind === 'region').map((r) => r.region));
    expect(ml.captions.map((c) => c.text)).not.toEqual(en.captions.map((c) => c.text));
  });
});

describe('selection', () => {
  const pick = (t: string, kind: BookBlock['kind'] = 'prose') => selectDna(block(t, kind)).dna;
  it('sets talk → the Venn DNA', () => {
    expect(pick('The union of two sets A and B contains every element that is in A or in B. The intersection A ∩ B contains the elements common to both.')).toBe('venn-sets');
    expect(pick('Draw a Venn diagram and shade the complement of A in the universal set.')).toBe('venn-sets');
    expect(pick("De Morgan's laws: the complement of the union of two sets is the intersection of their complements.")).toBe('venn-sets');
  });
  it('same words elsewhere stay elsewhere', () => {
    expect(pick('The intersection of two lines is a point.')).not.toBe('venn-sets');
    expect(pick('The area of a circle of radius r is πr² and its circumference is 2πr.')).toBe('shape-formula');
    expect(pick('A matrix is a rectangular arrangement of numbers in rows and columns. A 3 × 3 matrix has 3 rows and 3 columns; the entry a12 is in row 1, column 2.')).toBe('matrix-grid');
    expect(pick('Complementary angles add up to 90 degrees.')).not.toBe('venn-sets');
  });
});

describe('offline planner', () => {
  it('builds valid two-set and three-set plans', () => {
    const t2 = 'The union of two sets A and B, their intersection and the complement of A. De Morgan law.';
    const p = offlinePlan(block(t2), '', '');
    expect(p.dna).toBe('venn-sets');
    expect(validatePlan('venn-sets', p.teach, { en: t2, ml: 'എ' })).toEqual([]);
    expect((p.teach as VennPlan).steps.some((s) => s.op === 'identity')).toBe(true);
    const o3 = offlineVenn('Three sets A, B and C: their union and intersection.');
    expect(o3.sets).toBe(3);
    expect(validatePlan('venn-sets', o3, RD)).toEqual([]);
  });
});

describe('picture and class', () => {
  it('samples are real pictures', () => {
    for (const teach of [VENN_OPERATIONS_SAMPLE, VENN_ELEMENTS_SAMPLE, VENN_THREE_SAMPLE]) {
      expect(textOnlyWarning({ dna: 'venn-sets', teach })).toBeUndefined();
      expect(visualStats(buildDnaScenes('venn-sets', teach, 'en', 'T')).graphics).toBeGreaterThanOrEqual(5);
    }
  });
  it('compiles into a class with one caption per step', () => {
    const plan: BlockPlan = { blockId: 'b', dna: 'venn-sets', read: RD, teach: VENN_OPERATIONS_SAMPLE, source: 'fixture' };
    const segs = compileClass([block('The union of two sets.')], new Map([['b', plan]]), { title: 'T' });
    for (const seg of segs.filter((s) => s.phase === 'teach')) expect(segmentReel(seg).parts[0].captions.length).toBe(VENN_OPERATIONS_SAMPLE.steps.length + 1);
  });
  it('a region is drawn by clipping to every circle in turn (inside) or outside it', () => {
    const calls: string[] = [];
    const ctx = new Proxy({}, {
      get: (_t, k) => {
        if (k === 'measureText') return (s: string) => ({ width: s.length * 10 });
        if (k === 'arc') return (...a: unknown[]) => calls.push(`arc:${a[5] === true ? 'rev' : 'fwd'}`);
        if (k === 'clip') return () => calls.push('clip');
        if (k === 'fillRect') return () => calls.push('fillRect');
        return () => undefined;
      },
      set: () => true,
    }) as unknown as CanvasRenderingContext2D;
    const [s] = buildDnaScenes('venn-sets', { sets: 2, steps: [{ op: 'show', say }, { op: 'shade', expr: 'A−B', say }] }, 'en', 'T');
    const region = s.items.find((i) => i.kind === 'region')!;
    calls.length = 0;
    // Draw only after the shading has faded in.
    drawMotionFrame(ctx, s, s.durationMs - 100, { format: 'landscape' } as never);
    expect(region.region!.codes).toEqual([1]);
    expect(calls.filter((c) => c === 'fillRect').length).toBeGreaterThanOrEqual(1);
    expect(calls.includes('arc:rev')).toBe(true); // "not in B" = universe minus a circle
  });
  it('draws without error in every format and theme', () => {
    const noop = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? (s: string) => ({ width: s.length * 10 }) : () => undefined), set: () => true }) as unknown as CanvasRenderingContext2D;
    for (const teach of [VENN_OPERATIONS_SAMPLE, VENN_ELEMENTS_SAMPLE, VENN_THREE_SAMPLE]) {
      const sc = buildDnaScenes('venn-sets', teach, 'ml', 'T')[0] as MotionScene;
      for (const format of ['landscape', 'vertical', 'square'] as const) for (const theme of ['light', 'dark'] as const) for (const f of [0.1, 0.4, 0.7, 0.99]) drawMotionFrame(noop, sc, sc.durationMs * f, { format, theme } as never);
    }
    expect(SET_NAMES.length).toBe(3);
  });
});
