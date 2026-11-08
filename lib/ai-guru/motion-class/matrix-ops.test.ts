import { describe, expect, it } from 'vitest';
import { drawMotionFrame, evalItem, type MotionScene } from '../reels/motion';
import { tokenWidth } from '../reels/motion/metrics';
import { selectDna } from './dna/registry';
import { buildDnaScenes } from './dna/builders';
import { MPX, MPMAX } from './dna/mo-builders';
import { CH, CW, cEntry, cell, moGeometry, moProblem, multiply, transpose } from './dna/mo-math';
import type { BlockPlan, MatrixOpsPlan } from './dna/types';
import type { BookBlock } from './segment';
import { validatePlan } from './plan/validate';
import { offlineMatrixOps, offlinePlan, parseMatrices } from './plan/offline';
import { textOnlyWarning, visualStats } from './plan/visual-qa';
import { compileClass, segmentReel } from './class';
import { MO_BIG_TRANSPOSE_SAMPLE, MO_MULTIPLY_SAMPLE, MO_SQUARE_SAMPLE, MO_TRANSPOSE_SAMPLE } from './samples/matrix-ops';

const block = (text: string, kind: BookBlock['kind'] = 'prose'): BookBlock => ({ id: 'b', kind, page: 1, chapterId: 'c', sectionId: 's', lines: [{ text, math: false } as BookBlock['lines'][number]], text });
const say = { en: 'x', ml: 'എ' };
const RD = { en: 'x', ml: 'എ' };
const ALL = [MO_MULTIPLY_SAMPLE, MO_SQUARE_SAMPLE, MO_TRANSPOSE_SAMPLE, MO_BIG_TRANSPOSE_SAMPLE];
const S = (ops: Array<[string, number?, number?]>) => ops.map(([op, i, j]) => ({ op, say, ...(i === undefined ? {} : { i, j }) }) as MatrixOpsPlan['steps'][number]);

/** Deterministic small matrices. */
let seed = 7;
const rnd = (n: number) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
const mat = (r: number, c: number, range = 5): number[][] => Array.from({ length: r }, () => Array.from({ length: c }, () => rnd(2 * range + 1) - range));
const MULS: MatrixOpsPlan[] = [];
const TRS: MatrixOpsPlan[] = [];
for (let m = 1; m <= 3; m++) for (let n = 1; n <= 3; n++) for (let p = 1; p <= 3; p++) for (let k = 0; k < 3; k++) {
  const pl: MatrixOpsPlan = { kind: 'multiply', a: mat(m, n), b: mat(n, p), steps: S([['show'], ['check'], ['entry', 0, 0], ['all']]) };
  if (!moProblem(pl, 'p')) MULS.push(pl);
}
for (let r = 1; r <= 4; r++) for (let c = 1; c <= 4; c++) for (let k = 0; k < 2; k++) TRS.push({ kind: 'transpose', a: mat(r, c, 9), steps: S([['show'], ['rows'], ['entry', r - 1, c - 1], ['size']]) });
const CASES = [...MULS, ...TRS];

describe('the numbers are true', () => {
  it('there are plenty of cases', () => { expect(MULS.length).toBeGreaterThan(70); expect(TRS.length).toBe(32); });
  it('every product entry is row · column; the order is m × p', () => {
    for (const p of MULS) {
      const c = multiply(p.a, p.b!);
      expect(c.length).toBe(p.a.length);
      expect(c[0].length).toBe(p.b![0].length);
      c.forEach((row, i) => row.forEach((x, j) => {
        let s = 0;
        for (let k = 0; k < p.b!.length; k++) s += p.a[i][k] * p.b![k][j];
        expect(x).toBe(s);
        expect(cEntry(p.a, p.b!, i, j)).toBe(s);
      }));
    }
  });
  it('known products', () => {
    expect(multiply([[1, 2, 3], [4, 5, 6]], [[1, 0], [0, 1], [2, 1]])).toEqual([[7, 5], [16, 11]]);
    expect(multiply([[2, -1], [0, 3]], [[1, 4], [-2, 5]])).toEqual([[4, 3], [-6, 15]]);
  });
  it('transpose: (Aᵀ)ᵀ = A, orders swap, (i, j) ↔ (j, i); (AB)ᵀ = BᵀAᵀ', () => {
    for (const p of TRS) {
      const t = transpose(p.a);
      expect(t.length).toBe(p.a[0].length);
      expect(t[0].length).toBe(p.a.length);
      expect(transpose(t)).toEqual(p.a);
      p.a.forEach((row, i) => row.forEach((x, j) => expect(t[j][i]).toBe(x)));
    }
    for (const p of MULS.slice(0, 30)) expect(transpose(multiply(p.a, p.b!))).toEqual(multiply(transpose(p.b!), transpose(p.a)));
  });
});

describe('what is written', () => {
  const lines = (sc: MotionScene, k: number, title: boolean): string[] => {
    const time = sc.captions[k + (title ? 1 : 0)].t1 - 40;
    const vis = sc.items.filter((it) => it.kind === 'text').map((it) => evalItem(it, time)).filter((st) => st.alpha > 0.5 && st.x >= MPX - 4);
    const rows = new Map<number, Array<{ x: number; text: string }>>();
    for (const v of vis) { const key = Math.round(v.y); rows.set(key, [...(rows.get(key) ?? []), { x: v.x, text: v.text }]); }
    return [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, r]) => r.sort((a, b) => a.x - b.x).map((q) => q.text).join(' '));
  };
  const figure = (sc: MotionScene, k: number, title: boolean): string[] => {
    const time = sc.captions[k + (title ? 1 : 0)].t1 - 40;
    return sc.items.filter((it) => it.kind === 'text').map((it) => evalItem(it, time)).filter((st) => st.alpha > 0.5 && st.x < MPX - 4).map((q) => q.text);
  };
  it('multiply', () => {
    const [sc] = buildDnaScenes('matrix-ops', MO_MULTIPLY_SAMPLE, 'en', 'T');
    expect(figure(sc, 0, true).sort()).toEqual(['A', 'B', '×', '1', '2', '3', '4', '5', '6', '1', '0', '0', '1', '2', '1'].sort());
    expect(lines(sc, 1, true)).toEqual(['A : 2 × 3', 'B : 3 × 2', '3 = 3', 'AB : 2 × 2']);
    expect(lines(sc, 2, true)).toEqual(['1 × 1 + 2 × 0 + 3 × 2', '= 7']);
    expect(figure(sc, 2, true)).toContain('7');
    expect(lines(sc, 3, true)).toEqual(['4 × 0 + 5 × 1 + 6 × 1', '= 11']);
    expect(figure(sc, 4, true)).toEqual(expect.arrayContaining(['7', '5', '16', '11']));
    const [sq] = buildDnaScenes('matrix-ops', MO_SQUARE_SAMPLE, 'en', 'T');
    expect(lines(sq, 2, false)).toEqual(['2 × 1 + (−1) × (−2)', '= 4']);
    expect(figure(sq, 3, false)).toEqual(expect.arrayContaining(['4', '3', '−6', '15']));
  });
  it('transpose', () => {
    const [sc] = buildDnaScenes('matrix-ops', MO_TRANSPOSE_SAMPLE, 'en', 'T');
    expect(figure(sc, 0, true).sort()).toEqual(['1', '2', '3', '4', '5', '6', 'A =', '→', 'A^T ='].sort());
    expect(figure(sc, 1, true).filter((x) => /^\d$/.test(x)).sort()).toEqual(['1', '1', '2', '2', '3', '3', '4', '4', '5', '5', '6', '6']);
    expect(lines(sc, 2, true)).toEqual(['(1, 3) → (3, 1)']);
    expect(lines(sc, 3, true)).toEqual(['A : 2 × 3', 'A^T : 3 × 2']);
  });
});

describe('the picture is the maths', () => {
  const at = (sc: MotionScene, it: MotionScene['items'][number]) => evalItem(it, sc.durationMs);
  it('entries sit in their cells (A, B, product / transposed)', () => {
    for (const p of [MO_MULTIPLY_SAMPLE, MO_SQUARE_SAMPLE, ...MULS.slice(0, 20)]) {
      const sc = buildDnaScenes('matrix-ops', p, 'en', 'T')[0];
      const g = moGeometry(p);
      const c = multiply(p.a, p.b!);
      const texts = sc.items.filter((it) => it.kind === 'text').map((it) => at(sc, it));
      const want: Array<[number, number, string]> = [];
      p.a.forEach((r, i) => r.forEach((x, j) => { const [cx, cy] = cell(g.A, i, j); want.push([cx, cy, x < 0 ? `−${-x}` : String(x)]); }));
      p.b!.forEach((r, i) => r.forEach((x, j) => { const [cx, cy] = cell(g.B, i, j); want.push([cx, cy, x < 0 ? `−${-x}` : String(x)]); }));
      c.forEach((r, i) => r.forEach((x, j) => { const [cx, cy] = cell(g.C!, i, j); want.push([cx, cy, x < 0 ? `−${-x}` : String(x)]); }));
      for (const [cx, cy, text] of want) expect(texts.some((q) => Math.abs(q.x - cx) < 1e-6 && Math.abs(q.y - cy) < 1e-6 && q.text === text), `${text} at ${cx},${cy}`).toBe(true);
    }
  });
  it('transpose: entry (i, j) of A is at (j, i) of the transpose', () => {
    for (const p of [MO_TRANSPOSE_SAMPLE, MO_BIG_TRANSPOSE_SAMPLE, ...TRS.slice(0, 16)]) {
      const sc = buildDnaScenes('matrix-ops', p, 'en', 'T')[0];
      const g = moGeometry(p);
      const t = transpose(p.a);
      const texts = sc.items.filter((it) => it.kind === 'text').map((it) => at(sc, it));
      t.forEach((row, i) => row.forEach((x, j) => {
        const [cx, cy] = cell(g.B, i, j);
        const s = x < 0 ? `−${-x}` : String(x);
        expect(texts.some((q) => Math.abs(q.x - cx) < 1e-6 && Math.abs(q.y - cy) < 1e-6 && q.text === s)).toBe(true);
      }));
    }
  });
  it('the boxes are round the right row, column and cell', () => {
    const sc = buildDnaScenes('matrix-ops', MO_MULTIPLY_SAMPLE, 'en', 'T')[0];
    const g = moGeometry(MO_MULTIPLY_SAMPLE);
    const boxes = sc.items.filter((it) => it.kind === 'poly' && /^bx/.test(it.id));
    expect(boxes.length).toBe(6);
    const bb = (it: MotionScene['items'][number]) => ({ x0: Math.min(...it.points!.map((q) => q[0])), x1: Math.max(...it.points!.map((q) => q[0])), y0: Math.min(...it.points!.map((q) => q[1])), y1: Math.max(...it.points!.map((q) => q[1])) });
    // first entry (0,0): row 0 of A, column 0 of B, cell (0,0) of C
    const r = bb(boxes[0]); const c = bb(boxes[1]); const k = bb(boxes[2]);
    expect(r.x0).toBeLessThan(cell(g.A, 0, 0)[0]); expect(r.x1).toBeGreaterThan(cell(g.A, 0, 2)[0]);
    expect(r.y0).toBeLessThan(cell(g.A, 0, 0)[1]); expect(r.y1).toBeGreaterThan(cell(g.A, 0, 0)[1]); expect(r.y1).toBeLessThan(cell(g.A, 1, 0)[1]);
    expect(c.x0).toBeLessThan(cell(g.B, 0, 0)[0]); expect(c.x1).toBeGreaterThan(cell(g.B, 0, 0)[0]); expect(c.x1).toBeLessThan(cell(g.B, 0, 1)[0]);
    expect(c.y0).toBeLessThan(cell(g.B, 0, 0)[1]); expect(c.y1).toBeGreaterThan(cell(g.B, 2, 0)[1]);
    expect(k.x1 - k.x0).toBeLessThanOrEqual(CW); expect(k.y1 - k.y0).toBeLessThanOrEqual(CH);
    expect((k.x0 + k.x1) / 2).toBeCloseTo(cell(g.C!, 0, 0)[0], 6);
  });
});

describe('validation', () => {
  const ok = (p: MatrixOpsPlan) => validatePlan('matrix-ops', p, RD);
  it('the samples are valid', () => { for (const p of ALL) expect(ok(p)).toEqual([]); });
  it('matrices', () => {
    const m = (a: unknown, b?: unknown, kind = 'multiply') => moProblem({ kind, a, b, steps: [] } as unknown as MatrixOpsPlan, 'p');
    expect(m([], [[1]])).toMatch(/1 to 3 rows/);
    expect(m([[1, 2], [3]], [[1], [2]])).toMatch(/same number of entries/);
    expect(m([[1.5]], [[1]])).toMatch(/whole numbers/);
    expect(m([[10]], [[1]])).toMatch(/from −9 to 9/);
    expect(m([[1, 2, 3, 4]], [[1], [2], [3], [4]])).toMatch(/1 to 3 columns/);
    expect(m([[1, 2]], [[1, 2]])).toMatch(/A has 2 columns but B has 1 rows/);
    expect(m([[9, 9, 9]], [[9], [9], [9]])).toMatch(/beyond ±99/);
    expect(m([[1, 2], [3, 4]], [[1, 2], [3, 4]])).toBeNull();
    expect(m([[1, 2, 3, 4]], undefined, 'transpose')).toBeNull();
    expect(m([[1, 2, 3, 4, 5]], undefined, 'transpose')).toMatch(/1 to 4 columns/);
    expect(moProblem({ kind: 'cube', a: [[1]], steps: [] } as unknown as MatrixOpsPlan, 'p')).toMatch(/kind must be/);
  });
  it('steps', () => {
    const p = (kind: 'multiply' | 'transpose', ops: Array<[string, number?, number?]>) => ok({ kind, a: [[1, 2], [3, 4]], b: [[1, 0], [0, 1]], steps: S(ops) });
    expect(p('multiply', [['check']]).join()).toMatch(/needs \{"op":"show"\}/);
    expect(p('multiply', [['show'], ['show']]).join()).toMatch(/"show" only once/);
    expect(p('multiply', [['show'], ['entry', 0, 0]]).join()).toMatch(/needs "check"/);
    expect(p('multiply', [['show'], ['check'], ['entry', 2, 0]]).join()).toMatch(/outside the 2 × 2 product/);
    expect(p('multiply', [['show'], ['check'], ['entry', 0, 0], ['entry', 0, 0]]).join()).toMatch(/already used/);
    expect(p('multiply', [['show'], ['check'], ['all'], ['entry', 0, 0]]).join()).toMatch(/"all" must be the last/);
    expect(p('multiply', [['show'], ['all']]).join()).toMatch(/needs "check"/);
    expect(p('multiply', [['show'], ['rows']]).join()).toMatch(/not one of/);
    expect(p('transpose', [['show'], ['check']]).join()).toMatch(/not one of/);
    expect(p('transpose', [['show'], ['entry', 0, 1]]).join()).toMatch(/needs "rows"/);
    expect(p('transpose', [['show'], ['rows'], ['rows']]).join()).toMatch(/only once/);
    expect(p('transpose', [['show'], ['rows'], ['entry', 0, 1], ['size']])).toEqual([]);
    expect(ok({ kind: 'transpose', a: [[1, 2]], steps: [{ op: 'show', say: { en: '', ml: '' } }] }).join()).toMatch(/say is required/);
  });
});

describe('selection', () => {
  const pick = (text: string, kind: BookBlock['kind'] = 'prose') => selectDna(block(text, kind)).dna;
  it('matrix products and transposes → matrix-ops', () => {
    expect(pick('To multiply two matrices, multiply each row of the first by the columns of the second.')).toBe('matrix-ops');
    expect(pick('The transpose of a matrix is obtained by interchanging its rows and columns.')).toBe('matrix-ops');
    expect(pick('Find the product of the matrices A and B.', 'exercise')).toBe('matrix-ops');
    expect(pick('Write the transpose of the matrix [[1,2],[3,4]].', 'exercise')).toBe('matrix-ops');
  });
  it('the same words elsewhere stay elsewhere', () => {
    expect(pick('A matrix has rows and columns. The entry a_11 is in row 1, column 1. This is a 3 × 3 matrix.')).toBe('matrix-grid');
    expect(pick('Multiply the matrix by the vector (1, 2) to get the image.')).not.toBe('matrix-ops');
    expect(pick('The matrix of a rotation through 90° multiplies the position vector.')).not.toBe('matrix-ops');
    expect(pick('Transpose the terms to solve the equation 3x + 5 = 11.')).not.toBe('matrix-ops');
    expect(pick('Draw a pie chart for the data given in the table.', 'exercise')).toBe('pie-chart');
  });
});

describe('offline planner', () => {
  it('parses matrices', () => {
    expect(parseMatrices('A = [[1,2],[3,4]] and B = [[0,−1],[5,6]]')).toEqual([[[1, 2], [3, 4]], [[0, -1], [5, 6]]]);
    expect(parseMatrices('A = [1 2; 3 4]')).toEqual([[[1, 2], [3, 4]]]);
    expect(parseMatrices('[[1,2],[3]]')).toEqual([]);
  });
  it('multiply and transpose', () => {
    const m = offlineMatrixOps('Multiply the matrices A = [[1,2,3],[4,5,6]] and B = [[1,0],[0,1],[2,1]].')!;
    expect(m).toMatchObject({ kind: 'multiply', a: [[1, 2, 3], [4, 5, 6]], b: [[1, 0], [0, 1], [2, 1]] });
    expect(m.steps.map((x) => x.op)).toEqual(['show', 'check', 'entry', 'all']);
    const t = offlineMatrixOps('Write the transpose of A = [1 2 3; 4 5 6].')!;
    expect(t).toMatchObject({ kind: 'transpose', a: [[1, 2, 3], [4, 5, 6]] });
    for (const p of [m, t]) expect(validatePlan('matrix-ops', p, RD)).toEqual([]);
  });
  it('null when they do not fit', () => {
    expect(offlineMatrixOps('Multiply two matrices.')).toBeNull();
    expect(offlineMatrixOps('Multiply A = [[1,2]] and B = [[1,2]].')).toBeNull();
    expect(offlineMatrixOps('Multiply A = [[1,2],[3,4]] and B = [[50,2],[3,4]].')).toBeNull();
  });
  it('falls back with a warning without matrices', () => {
    const pl = offlinePlan(block('To multiply two matrices, multiply each row by the columns.'), '', '');
    expect(pl.dna).toBe('concept-board');
    expect(pl.warnings?.join()).toMatch(/AI planner needed/);
    expect(offlinePlan(block('Find the transpose of the matrix [[1,2],[3,4]].', 'exercise'), '', '').dna).toBe('matrix-ops');
  });
});

describe('picture and class', () => {
  it('samples are real pictures', () => {
    for (const teach of ALL) {
      expect(textOnlyWarning({ dna: 'matrix-ops', teach })).toBeUndefined();
      expect(visualStats(buildDnaScenes('matrix-ops', teach, 'en', 'T')).graphics).toBeGreaterThanOrEqual(4);
    }
  });
  it('compiles into a class with one caption per step', () => {
    for (const teach of ALL) {
      const plan: BlockPlan = { blockId: 'b', dna: 'matrix-ops', read: RD, teach, source: 'fixture' };
      const segs = compileClass([block('Matrices.')], new Map([['b', plan]]), { title: 'T' });
      for (const seg of segs.filter((x) => x.phase === 'teach')) expect(segmentReel(seg).parts[0].captions.length).toBe(teach.steps.length + (teach.title ? 1 : 0));
    }
  });
  it('draws without error in every format and theme', () => {
    const noop = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? (x: string) => ({ width: x.length * 10 }) : () => undefined), set: () => true }) as unknown as CanvasRenderingContext2D;
    for (const teach of ALL) {
      const sc = buildDnaScenes('matrix-ops', teach, 'ml', 'T')[0];
      for (const format of ['landscape', 'vertical', 'square'] as const) for (const theme of ['light', 'dark'] as const) for (const f of [0.1, 0.4, 0.7, 0.99]) drawMotionFrame(noop, sc, sc.durationMs * f, { format, theme } as never);
    }
  });
  it('nothing overlaps or leaves its area (every step, many matrices)', { timeout: 120000 }, () => {
    const cases = [...ALL, ...CASES.filter((_, i) => i % 4 === 0)];
    for (const teach of cases) {
      const sc = buildDnaScenes('matrix-ops', teach, 'en', 'T')[0];
      for (let k = 0; k < sc.captions.length; k++) {
        const time = sc.captions[k].t1 - 40;
        const st = sc.items.filter((it) => it.kind === 'text').map((it) => evalItem(it, time)).filter((s) => s.alpha > 0.5).map((q) => {
          const w = tokenWidth(q.text, q.size);
          return { q, l: q.x - w / 2, r: q.x + w / 2 };
        });
        const tag = JSON.stringify(teach.a) + (teach.b ? JSON.stringify(teach.b) : '');
        for (const b of st) {
          expect(b.l, `${tag} ${b.q.text}`).toBeGreaterThan(2);
          expect(b.r, `${tag} ${b.q.text}`).toBeLessThan(718);
          if (b.l > MPX - 4) expect(b.r, `${tag} ${b.q.text}`).toBeLessThanOrEqual(MPX + MPMAX + 1);
          else expect(b.r, `${tag} ${b.q.text}`).toBeLessThan(MPX - 4);
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
    const en = buildDnaScenes('matrix-ops', MO_MULTIPLY_SAMPLE, 'en', 'T')[0];
    const ml = buildDnaScenes('matrix-ops', MO_MULTIPLY_SAMPLE, 'ml', 'T')[0];
    expect(ml.items.map((it) => `${it.id}:${it.kind}:${it.text}`)).toEqual(en.items.map((it) => `${it.id}:${it.kind}:${it.text}`));
    expect(ml.captions.map((x) => x.text)).not.toEqual(en.captions.map((x) => x.text));
  });
  it('builds and validates every case', { timeout: 120000 }, () => {
    for (const p of CASES.filter((_, i) => i % 2 === 0)) {
      expect(validatePlan('matrix-ops', p, RD), JSON.stringify(p.a)).toEqual([]);
      expect(() => buildDnaScenes('matrix-ops', p, 'en', 'T')).not.toThrow();
    }
  });
});
