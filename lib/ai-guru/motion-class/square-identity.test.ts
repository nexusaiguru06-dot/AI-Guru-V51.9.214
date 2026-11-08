import { describe, expect, it } from 'vitest';
import { drawMotionFrame, evalItem, type MotionScene } from '../reels/motion';
import { tokenWidth } from '../reels/motion/metrics';
import { roleColor } from '../reels/motion/grammar';
import { selectDna } from './dna/registry';
import { buildDnaScenes } from './dna/builders';
import { SQX, SQMAX } from './dna/sq-builders';
import { SQ_LABEL_MIN, braceH, braceV, rectPts, sqGeometry, sqProblem, type Rect } from './dna/sq-math';
import type { BlockPlan, SqPlan } from './dna/types';
import type { BookBlock } from './segment';
import { validatePlan } from './plan/validate';
import { offlinePlan, offlineSquareIdentity } from './plan/offline';
import { textOnlyWarning, visualStats } from './plan/visual-qa';
import { compileClass, segmentReel } from './class';
import { SQ_DIFF_BIG_SAMPLE, SQ_DIFF_SAMPLE, SQ_PROD_SAMPLE, SQ_SUM_SAMPLE, SQ_SUM_SWAP_SAMPLE } from './samples/square-identity';

const block = (text: string, kind: BookBlock['kind'] = 'prose'): BookBlock => ({ id: 'b', kind, page: 1, chapterId: 'c', sectionId: 's', lines: [{ text, math: false } as BookBlock['lines'][number]], text });
const say = { en: 'x', ml: 'എ' };
const RD = { en: 'x', ml: 'എ' };
const ALL = [SQ_SUM_SAMPLE, SQ_SUM_SWAP_SAMPLE, SQ_DIFF_SAMPLE, SQ_DIFF_BIG_SAMPLE, SQ_PROD_SAMPLE];
const S = (ops: string[]) => ops.map((op) => ({ op, say }) as SqPlan['steps'][number]);
const SUM_OPS = ['square', 'tileA', 'strips', 'tileB', 'name', 'build', 'check'];
const DIFF_OPS = ['square', 'strips', 'corner', 'name', 'build', 'check'];
const PROD_OPS = ['square', 'remove', 'cut', 'move', 'name', 'build', 'check'];

const CASES: SqPlan[] = [];
for (let a = 1; a <= 11; a++) for (let b = 1; b <= 11; b++) { const p: SqPlan = { kind: 'sum', a, b, steps: S(SUM_OPS) }; if (!sqProblem(p, 'p')) CASES.push(p); }
for (let a = 2; a <= 12; a++) for (let b = 1; b < a; b++) { const p: SqPlan = { kind: 'difference', a, b, steps: S(DIFF_OPS) }; if (!sqProblem(p, 'p')) CASES.push(p); }
for (let a = 2; a <= 11; a++) for (let b = 1; b < a; b++) { const p: SqPlan = { kind: 'product', a, b, steps: S(PROD_OPS) }; if (!sqProblem(p, 'p')) CASES.push(p); }
const area = (r: Rect, u: number) => ((r.x1 - r.x0) * (r.y1 - r.y0)) / (u * u);

describe('the numbers are true', () => {
  it('there are plenty of cases', () => {
    expect(CASES.filter((c) => c.kind === 'sum').length).toBeGreaterThan(40);
    expect(CASES.filter((c) => c.kind === 'difference').length).toBeGreaterThan(30);
    expect(CASES.filter((c) => c.kind === 'product').length).toBeGreaterThan(25);
  });
  it('(a + b)²: the four tiles have areas a², ab, ab, b² and fill the square', () => {
    for (const p of CASES.filter((c) => c.kind === 'sum')) {
      const g = sqGeometry(p); const t = g.tiles;
      expect(area(t.A, g.u)).toBeCloseTo(p.a * p.a, 9);
      expect(area(t.AB1, g.u)).toBeCloseTo(p.a * p.b, 9);
      expect(area(t.AB2, g.u)).toBeCloseTo(p.a * p.b, 9);
      expect(area(t.B, g.u)).toBeCloseTo(p.b * p.b, 9);
      expect(area(t.outer, g.u)).toBeCloseTo((p.a + p.b) ** 2, 9);
      expect(area(t.A, g.u) + area(t.AB1, g.u) + area(t.AB2, g.u) + area(t.B, g.u)).toBeCloseTo((p.a + p.b) ** 2, 9);
      expect(p.a * p.a + 2 * p.a * p.b + p.b * p.b).toBe((p.a + p.b) ** 2);
    }
  });
  it('(a − b)²: the square left is a² − ab − ab + b², the strips share the corner b²', () => {
    for (const p of CASES.filter((c) => c.kind === 'difference')) {
      const g = sqGeometry(p); const t = g.tiles;
      expect(area(t.centre, g.u)).toBeCloseTo((p.a - p.b) ** 2, 9);
      expect(area(t.strR, g.u)).toBeCloseTo(p.a * p.b, 9);
      expect(area(t.strB, g.u)).toBeCloseTo(p.a * p.b, 9);
      expect(area(t.corner, g.u)).toBeCloseTo(p.b * p.b, 9);
      expect(area(t.visR, g.u) + area(t.visB, g.u) + area(t.corner, g.u) + area(t.centre, g.u)).toBeCloseTo(p.a * p.a, 9);
      expect(p.a * p.a - 2 * p.a * p.b + p.b * p.b).toBe((p.a - p.b) ** 2);
      // the overlap of the two strips is exactly the corner
      expect(t.strR.x0).toBeCloseTo(t.corner.x0, 9); expect(t.strB.y0).toBeCloseTo(t.corner.y0, 9);
    }
  });
  it('(a + b)(a − b): the L has area a² − b² and the moved piece makes an (a + b) × (a − b) rectangle', () => {
    for (const p of CASES.filter((c) => c.kind === 'product')) {
      const g = sqGeometry(p); const t = g.tiles;
      expect(area(t.r1, g.u) + area(t.r2, g.u)).toBeCloseTo(p.a * p.a - p.b * p.b, 9);
      expect(area(t.rect, g.u)).toBeCloseTo((p.a + p.b) * (p.a - p.b), 9);
      expect(area(t.r1, g.u) + area(t.r2m, g.u)).toBeCloseTo(area(t.rect, g.u), 9);
      // r2 turned a quarter: width and height swap
      expect((t.r2m.x1 - t.r2m.x0) / g.u).toBeCloseTo((t.r2.y1 - t.r2.y0) / g.u, 9);
      expect((t.r2m.y1 - t.r2m.y0) / g.u).toBeCloseTo((t.r2.x1 - t.r2.x0) / g.u, 9);
      expect(t.r2m.x0).toBeCloseTo(t.r1.x1, 9);
      expect(p.a * p.a - p.b * p.b).toBe((p.a + p.b) * (p.a - p.b));
    }
  });
  it('everything fits the left area; labels fit inside their tiles', () => {
    for (const p of CASES) {
      const g = sqGeometry(p);
      for (const r of Object.values(g.tiles)) { expect(r.x0).toBeGreaterThanOrEqual(29); expect(r.x1).toBeLessThanOrEqual(411); expect(r.y0).toBeGreaterThan(40); expect(r.y1).toBeLessThan(420); }
      for (const br of Object.values(g.braces)) {
        const w = tokenWidth(br.text, br.size);
        expect(br.at[0] - w / 2, `${p.kind} ${p.a} ${p.b} ${br.text}`).toBeGreaterThanOrEqual(24);
        expect(br.at[0] + w / 2, `${p.kind} ${p.a} ${p.b} ${br.text}`).toBeLessThanOrEqual(426);
        expect(br.at[1]).toBeGreaterThan(40); expect(br.at[1]).toBeLessThan(425);
      }
      if (p.kind === 'product') continue;
      for (const [k, l] of Object.entries(g.labels)) {
        const r = g.tiles[k === 'A' ? 'A' : k === 'B' ? 'B' : k === 'AB1' ? 'AB1' : k === 'AB2' ? 'AB2' : k];
        expect(l.size, `${p.kind} ${p.a} ${p.b} ${l.text}`).toBeGreaterThanOrEqual(SQ_LABEL_MIN);
        expect(tokenWidth(l.text, l.size)).toBeLessThanOrEqual(r.x1 - r.x0 - 4);
        expect(l.size).toBeLessThanOrEqual(r.y1 - r.y0 - 4);
      }
    }
  });
  it('braces start and end on the span, bulging away from the figure', () => {
    const h = braceH(100, 200, 50, -1);
    expect(h[0]).toEqual([100, 50]);
    const last = h[h.length - 1];
    expect(last[0]).toBeCloseTo(200, 9); expect(last[1]).toBeCloseTo(50, 9);
    expect(Math.min(...h.map((q) => q[1]))).toBeCloseTo(50 - 12, 9);
    expect(Math.max(...h.map((q) => q[1]))).toBeCloseTo(50, 9);
    const v = braceV(100, 200, 50, 1);
    expect(v[0]).toEqual([50, 100]);
    expect(Math.max(...v.map((q) => q[0]))).toBeCloseTo(62, 9);
    // a narrow span shrinks the brace instead of overrunning it
    const n = braceH(0, 20, 0, 1);
    expect(Math.max(...n.map((q) => q[0]))).toBeLessThanOrEqual(20 + 1e-9);
    expect(rectPts({ x0: 0, y0: 0, x1: 2, y1: 1 })).toEqual([[0, 0], [2, 0], [2, 1], [0, 1]]);
  });
});

describe('what is written', () => {
  const lines = (sc: MotionScene, k: number): string[] => {
    const time = sc.captions[k].t1 - 40;
    const vis = sc.items.filter((it) => it.kind === 'text').map((it) => evalItem(it, time)).filter((st) => st.alpha > 0.5 && st.x >= SQX - 4);
    const rows = new Map<number, Array<{ x: number; text: string }>>();
    for (const v of vis) { const key = Math.round(v.y); rows.set(key, [...(rows.get(key) ?? []), { x: v.x, text: v.text }]); }
    return [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, r]) => r.sort((a, b) => a.x - b.x).map((q) => q.text).join(' '));
  };
  const figure = (sc: MotionScene, k: number): string[] => {
    const time = sc.captions[k].t1 - 40;
    return sc.items.filter((it) => it.kind === 'text').map((it) => evalItem(it, time)).filter((st) => st.alpha > 0.5 && st.x < SQX - 4).map((q) => q.text);
  };
  it('(a + b)²', () => {
    const [sc] = buildDnaScenes('square-identity', SQ_SUM_SAMPLE, 'en', 'T');
    expect(lines(sc, 1)).toEqual(['(a + b)^2']);
    expect(figure(sc, 1).sort()).toEqual(['a + b', 'a + b']);
    expect(figure(sc, 2).sort()).toEqual(['a', 'a', 'a + b', 'a + b']);
    expect(figure(sc, 3).sort()).toEqual(['a', 'a', 'a + b', 'a + b', 'b', 'b']);
    expect(figure(sc, 5).sort()).toEqual(expect.arrayContaining(['a^2', 'ab', 'ab', 'b^2']));
    expect(figure(sc, 4)).not.toContain('a^2');
    expect(lines(sc, 6)).toEqual(['(a + b)^2', '= a^2 + ab + ab + b^2', '= a^2 + 2ab + b^2']);
    expect(lines(sc, 7)).toEqual(['a = 3, b = 2', '(3 + 2)^2 = 5^2 = 25', '9 + 12 + 4 = 25']);
  });
  it('(a − b)²', () => {
    const [sc] = buildDnaScenes('square-identity', SQ_DIFF_SAMPLE, 'en', 'T');
    expect(lines(sc, 1)).toEqual(['(a − b)^2']);
    expect(figure(sc, 1).sort()).toEqual(['a', 'a']);
    expect(figure(sc, 2).sort()).toEqual(['a', 'a', 'b', 'b']);
    expect(figure(sc, 4).sort()).toEqual(expect.arrayContaining(['(a − b)^2', 'ab', 'ab', 'b^2', 'a − b', 'a − b']));
    expect(figure(sc, 3)).not.toContain('ab');
    expect(lines(sc, 4)).toEqual(['(a − b)^2']);
    expect(lines(sc, 5)).toEqual(['(a − b)^2', '= a^2 − ab − ab + b^2', '= a^2 − 2ab + b^2']);
    expect(lines(sc, 6)).toEqual(['a = 5, b = 2', '(5 − 2)^2 = 3^2 = 9', '25 − 20 + 4 = 9']);
  });
  it('(a + b)(a − b)', () => {
    const [sc] = buildDnaScenes('square-identity', SQ_PROD_SAMPLE, 'en', 'T');
    expect(lines(sc, 1)).toEqual(['a^2 − b^2']);
    expect(figure(sc, 2).sort()).toEqual(['a', 'a', 'b']);
    expect(figure(sc, 4).sort()).toEqual(['a', 'a']);
    expect(figure(sc, 5).sort()).toEqual(['a', 'a', 'a + b', 'a − b']);
    expect(lines(sc, 6)).toEqual(['L = a^2 − b^2', '= (a + b) × (a − b)']);
    expect(lines(sc, 7)).toEqual(['a = 6, b = 2', '6^2 − 2^2 = 36 − 4 = 32', '(6 + 2)(6 − 2) = 8 × 4 = 32']);
  });
  it('the colours follow the letters', () => {
    const [sc] = buildDnaScenes('square-identity', SQ_SUM_SAMPLE, 'en', 'T');
    const time = sc.captions[6].t1 - 40;
    const col = (it: MotionScene['items'][number]) => (it.color as unknown as { init: string }).init;
    const vis = sc.items.filter((it) => it.kind === 'text' && evalItem(it, time).alpha > 0.5 && evalItem(it, time).x >= SQX - 4);
    const by = (txt: string) => vis.filter((it) => it.text === txt).map(col);
    expect(by('a^2')).toEqual([roleColor('a'), roleColor('a')]);
    expect(by('2ab')).toEqual([roleColor('c')]);
    expect(by('b^2')).toEqual([roleColor('b'), roleColor('b')]);
    expect(by('ab')).toEqual([roleColor('c'), roleColor('c')]);
  });
  it('each term appears one after the other, after the previous one', () => {
    const [sc] = buildDnaScenes('square-identity', SQ_SUM_SAMPLE, 'en', 'T');
    const t0 = sc.captions[6].t0;
    const first = (txt: string) => Math.min(...sc.items.filter((it) => it.kind === 'text' && it.text === txt && evalItem(it, sc.captions[6].t1).x >= SQX - 4).map((it) => { let t = t0; while (t < sc.captions[6].t1 && evalItem(it, t).alpha < 0.5) t += 20; return t; }));
    expect(first('a^2')).toBeLessThan(first('ab'));
    expect(first('ab')).toBeLessThan(first('b^2'));
    expect(first('b^2')).toBeLessThan(first('2ab'));
  });
});

describe('validation', () => {
  const ok = (p: SqPlan) => validatePlan('square-identity', p, RD);
  const q = (o: Partial<SqPlan>) => sqProblem({ kind: 'sum', a: 3, b: 2, steps: [], ...o } as SqPlan, 'p');
  it('the samples are valid', () => { for (const p of ALL) expect(ok(p)).toEqual([]); });
  it('sides', () => {
    expect(q({ kind: 'cube' as never })).toMatch(/kind must be/);
    expect(q({ a: 0 })).toMatch(/whole numbers, 1 or more/);
    expect(q({ b: 2.5 })).toMatch(/whole numbers/);
    expect(q({ a: 4, b: 4 })).toMatch(/must be different/);
    expect(q({ a: 8, b: 5 })).toMatch(/at most 12/);
    expect(q({ kind: 'difference', a: 3, b: 3 })).toMatch(/b must be smaller than a/);
    expect(q({ kind: 'difference', a: 13, b: 2 })).toMatch(/at most 12/);
    expect(q({ kind: 'product', a: 9, b: 4 })).toMatch(/a \+ b must be at most 12/);
    expect(q({ kind: 'difference', a: 12, b: 1, steps: S(['name']) })).toMatch(/too small to label/);
    expect(q({ kind: 'difference', a: 12, b: 1 })).toBeNull();
    expect(q({})).toBeNull();
    expect(q({ a: 2, b: 5 })).toBeNull();
  });
  it('steps', () => {
    const p = (kind: SqPlan['kind'], ops: string[], a = 5, b = 2) => ok({ kind, a: kind === 'sum' ? 3 : a, b, steps: S(ops) });
    expect(p('sum', ['tileA']).join()).toMatch(/needs \{"op":"square"\}/);
    expect(p('sum', ['square', 'square']).join()).toMatch(/only once/);
    expect(p('sum', ['square', 'name']).join()).toMatch(/needs "tileA" before it/);
    expect(p('sum', ['square', 'tileA', 'strips', 'tileB', 'build']).join()).toMatch(/needs "name"/);
    expect(p('sum', ['square', 'tileA', 'strips', 'tileB', 'name', 'check']).join()).toMatch(/needs "build"/);
    expect(p('sum', ['square', 'tileB', 'strips', 'tileA', 'name', 'build', 'check'])).toEqual([]);
    expect(p('sum', ['square', 'corner']).join()).toMatch(/not one of/);
    expect(p('difference', ['square', 'corner']).join()).toMatch(/needs "strips"/);
    expect(p('difference', ['square', 'strips', 'tileA']).join()).toMatch(/not one of/);
    expect(p('difference', DIFF_OPS)).toEqual([]);
    expect(p('product', ['square', 'cut']).join()).toMatch(/needs "remove"/);
    expect(p('product', ['square', 'remove', 'move']).join()).toMatch(/needs "cut"/);
    expect(p('product', ['square', 'remove', 'cut', 'move', 'build']).join()).toMatch(/needs "name"/);
    expect(p('product', PROD_OPS)).toEqual([]);
    expect(ok({ kind: 'sum', a: 3, b: 2, steps: [{ op: 'square', say: { en: '', ml: '' } }] }).join()).toMatch(/say is required/);
  });
});

describe('selection', () => {
  const pick = (text: string, kind: BookBlock['kind'] = 'prose') => selectDna(block(text, kind)).dna;
  it('the three identities → square-identity', () => {
    expect(pick('(a + b)² = a² + 2ab + b². This identity is true for all numbers a and b.')).toBe('square-identity');
    expect(pick('Prove that (a + b)^2 = a^2 + 2ab + b^2 using the area of a square.')).toBe('square-identity');
    expect(pick('(a − b)² = a² − 2ab + b²')).toBe('square-identity');
    expect(pick('The square of the sum of two numbers is the sum of their squares and twice their product.')).toBe('square-identity');
    expect(pick('a² − b² = (a + b)(a − b). The difference of two squares.')).toBe('square-identity');
    expect(pick('A visual proof of (x + y)² = x² + 2xy + y².')).toBe('square-identity');
  });
  it('the same words elsewhere stay elsewhere', () => {
    expect(pick('Find the product (x + 2)(x + 3).')).not.toBe('square-identity');
    expect(pick('Find the value of 102² using an identity.')).not.toBe('square-identity');
    expect(pick('The polynomial x² − 9 is a difference of two squares, so it factorises as (x + 3)(x − 3).')).not.toBe('square-identity');
    expect(pick('Solve the equation (x + 1)² = 16.')).not.toBe('square-identity');
    expect(pick('Draw the graph of y = 2x + 1.')).not.toBe('square-identity');
    expect(pick('The area of a parallelogram is its base multiplied by its height.')).toBe('area-figure');
    expect(pick('Find the distance between the points (1, 2) and (5, 5).', 'exercise')).toBe('coordinate-geometry');
  });
});

describe('offline planner', () => {
  it('recognises the three identities', () => {
    const s = offlineSquareIdentity('(a + b)² = a² + 2ab + b² for all numbers.')!;
    expect(s).toMatchObject({ kind: 'sum', a: 3, b: 2 });
    expect(s.steps.map((x) => x.op)).toEqual(SUM_OPS);
    const d = offlineSquareIdentity('Show that (a − b)^2 = a^2 − 2ab + b^2.')!;
    expect(d).toMatchObject({ kind: 'difference', a: 5, b: 2 });
    expect(d.steps.map((x) => x.op)).toEqual(DIFF_OPS);
    const p = offlineSquareIdentity('The difference of two squares: a² − b² = (a + b)(a − b).')!;
    expect(p).toMatchObject({ kind: 'product', a: 5, b: 2 });
    expect(p.steps.map((x) => x.op)).toEqual(PROD_OPS);
    for (const x of [s, d, p]) expect(validatePlan('square-identity', x, RD)).toEqual([]);
  });
  it('the first one written wins', () => {
    expect(offlineSquareIdentity('First (a − b)² and then (a + b)².')!.kind).toBe('difference');
  });
  it('null without an identity; falls back with a warning', () => {
    expect(offlineSquareIdentity('A visual proof is a picture.')).toBeNull();
    const pl = offlinePlan(block('A visual proof is a picture that shows why something is true.'), '', '');
    expect(pl.dna).toBe('concept-board');
    expect(pl.warnings?.join()).toMatch(/AI planner needed/);
    expect(offlinePlan(block('Prove that (a + b)² = a² + 2ab + b².', 'exercise'), '', '').dna).toBe('square-identity');
  });
});

describe('picture and class', () => {
  it('samples are real pictures', () => {
    for (const teach of ALL) {
      expect(textOnlyWarning({ dna: 'square-identity', teach })).toBeUndefined();
      expect(visualStats(buildDnaScenes('square-identity', teach, 'en', 'T')).graphics).toBeGreaterThanOrEqual(4);
    }
  });
  it('compiles into a class with one caption per step', () => {
    for (const teach of ALL) {
      const plan: BlockPlan = { blockId: 'b', dna: 'square-identity', read: RD, teach, source: 'fixture' };
      const segs = compileClass([block('Identity.')], new Map([['b', plan]]), { title: 'T' });
      for (const seg of segs.filter((x) => x.phase === 'teach')) expect(segmentReel(seg).parts[0].captions.length).toBe(teach.steps.length + (teach.title ? 1 : 0));
    }
  });
  it('draws without error in every format and theme', () => {
    const noop = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? (x: string) => ({ width: x.length * 10 }) : () => undefined), set: () => true }) as unknown as CanvasRenderingContext2D;
    for (const teach of ALL) {
      const sc = buildDnaScenes('square-identity', teach, 'ml', 'T')[0];
      for (const format of ['landscape', 'vertical', 'square'] as const) for (const theme of ['light', 'dark'] as const) for (const f of [0.1, 0.4, 0.7, 0.99]) drawMotionFrame(noop, sc, sc.durationMs * f, { format, theme } as never);
    }
  });
  it('nothing overlaps or leaves its area (every step, every size)', { timeout: 240000 }, () => {
    for (const teach of [...ALL, ...CASES]) {
      const sc = buildDnaScenes('square-identity', teach, 'en', 'T')[0];
      for (let k = 0; k < sc.captions.length; k++) {
        const time = sc.captions[k].t1 - 40;
        const st = sc.items.filter((it) => it.kind === 'text').map((it) => evalItem(it, time)).filter((s) => s.alpha > 0.5).map((q) => {
          const w = tokenWidth(q.text, q.size);
          return { q, l: q.x - w / 2, r: q.x + w / 2 };
        });
        const tag = JSON.stringify([teach.kind, teach.a, teach.b]);
        for (const b of st) {
          expect(b.l, `${tag} ${b.q.text}`).toBeGreaterThan(2);
          expect(b.r, `${tag} ${b.q.text}`).toBeLessThan(718);
          if (b.l > SQX - 4) expect(b.r, `${tag} ${b.q.text}`).toBeLessThanOrEqual(SQX + SQMAX + 1);
          else expect(b.r, `${tag} ${b.q.text}`).toBeLessThan(SQX - 4);
        }
        for (let i = 0; i < st.length; i++) for (let j = i + 1; j < st.length; j++) {
          if (Math.abs(st[i].q.y - st[j].q.y) > 14) continue;
          const gap = Math.max(st[i].l, st[j].l) - Math.min(st[i].r, st[j].r);
          expect(gap, `${tag} ${st[i].q.text} / ${st[j].q.text} at step ${k}`).toBeGreaterThanOrEqual(-1e-6);
        }
      }
    }
  });
  it('English and Malayalam pictures are identical; only captions differ', () => {
    const en = buildDnaScenes('square-identity', SQ_DIFF_SAMPLE, 'en', 'T')[0];
    const ml = buildDnaScenes('square-identity', SQ_DIFF_SAMPLE, 'ml', 'T')[0];
    expect(ml.items.map((it) => `${it.id}:${it.kind}:${it.text}`)).toEqual(en.items.map((it) => `${it.id}:${it.kind}:${it.text}`));
    expect(ml.captions.map((x) => x.text)).not.toEqual(en.captions.map((x) => x.text));
  });
  it('builds and validates every case', { timeout: 120000 }, () => {
    for (const p of CASES) {
      expect(validatePlan('square-identity', p, RD), JSON.stringify([p.kind, p.a, p.b])).toEqual([]);
      expect(() => buildDnaScenes('square-identity', p, 'en', 'T')).not.toThrow();
    }
  });
});
