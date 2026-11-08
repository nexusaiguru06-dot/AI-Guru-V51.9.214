import { describe, expect, it } from 'vitest';
import { drawMotionFrame, evalItem, pointsAt, type MotionScene } from '../reels/motion';
import { measure, richRuns, richWidth } from '../reels/motion/metrics';
import { selectDna } from './dna/registry';
import { buildDnaScenes } from './dna/builders';
import type { BlockPlan, MatrixPlan } from './dna/types';
import type { BookBlock } from './segment';
import { validatePlan } from './plan/validate';
import { offlineMatrix, offlinePlan } from './plan/offline';
import { textOnlyWarning, visualStats } from './plan/visual-qa';
import { compileClass, segmentReel } from './class';
import { MATRIX_GRID_SAMPLE, MATRIX_NUMBERS_SAMPLE } from './samples/matrix-grid';
import { PLANE_SAMPLE } from './samples/plane-graph';

const block = (text: string, kind: BookBlock['kind'] = 'prose'): BookBlock => ({ id: 'b', kind, page: 1, chapterId: 'c', sectionId: 's', lines: [{ text, math: false } as BookBlock['lines'][number]], text });
const say = { en: 'x', ml: 'എ' };
const RD = { en: 'x', ml: 'എ' };
const end = (s: MotionScene) => s.durationMs + 10;
const item = (s: MotionScene, id: string) => s.items.find((i) => i.id === id)!;
const text = (s: MotionScene, id: string) => evalItem(item(s, id), end(s)).text;

describe('subscripts', () => {
  it('a_{12} and a_12 are a base and a subscript; plain text is untouched', () => {
    expect(richRuns('a_{12}')).toEqual([{ text: 'a', sup: false }, { text: '12', sup: false, sub: true }]);
    expect(richRuns('a_12')).toEqual(richRuns('a_{12}'));
    expect(richRuns('x^2')).toEqual([{ text: 'x', sup: false }, { text: '2', sup: true }]);
    expect(richRuns('_x')).toEqual([{ text: '_x', sup: false }]);
    expect(richRuns('2x + 1')).toEqual([{ text: '2x + 1', sup: false }]);
  });
  it('a subscript is narrower than the same digits at full size', () => {
    expect(richWidth('a_{12}', 30)).toBeLessThan(measure('a12', 30));
  });
});

describe('samples pass the same validator as AI plans', () => {
  it('anatomy sample and numbers sample (EN + ML)', () => {
    expect(validatePlan('matrix-grid', MATRIX_GRID_SAMPLE, RD)).toEqual([]);
    expect(validatePlan('matrix-grid', MATRIX_NUMBERS_SAMPLE, RD)).toEqual([]);
  });
});

describe('the grid is computed, not written by the planner', () => {
  const [s] = buildDnaScenes('matrix-grid', MATRIX_GRID_SAMPLE, 'en', 'T');
  it('every entry is a_{ij} with its own row and column, laid out on a regular grid', () => {
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) expect(item(s, `m0e${i}_${j}`).text).toBe(`a_{${i + 1}${j + 1}}`);
    const x = (j: number) => item(s, `m0e0_${j}`).x.at(0);
    expect(x(1) - x(0)).toBeCloseTo(x(2) - x(1), 5);
    const y = (i: number) => item(s, `m0e${i}_0`).y.at(0);
    expect(y(1) - y(0)).toBeCloseTo(y(2) - y(1), 5);
    expect(item(s, 'm0e2_2').x.at(0)).toBeGreaterThan(item(s, 'm0e0_0').x.at(0));
  });
  it('the row box sits on row 0 and the column box on column 0', () => {
    const row = s.items.find((i) => /^m0row/.test(i.id) && i.kind === 'rect')!;
    expect(row.y.at(0)).toBeCloseTo(item(s, 'm0e0_0').y.at(0), 5);
    const col = s.items.find((i) => /^m0col/.test(i.id) && i.kind === 'rect')!;
    expect(col.x.at(0)).toBeCloseTo(item(s, 'm0e0_0').x.at(0), 5);
  });
  it('the diagonal box lies along the line through a11 and a33', () => {
    const d = s.items.find((i) => /^m0diag\d+$/.test(i.id))!;
    const p = pointsAt(d, end(s))!;
    const long = [p[1][0] - p[0][0], p[1][1] - p[0][1]];
    const want = [item(s, 'm0e2_2').x.at(0) - item(s, 'm0e0_0').x.at(0), item(s, 'm0e2_2').y.at(0) - item(s, 'm0e0_0').y.at(0)];
    expect(Math.atan2(long[1], long[0])).toBeCloseTo(Math.atan2(want[1], want[0]), 5);
  });
  it('size and verdict follow the grid: 3×3 square, then n×n square, then m×n rectangular', () => {
    expect(text(s, s.items.find((i) => /^m0sz1/.test(i.id))!.id)).toBe('A ∈ ℝ^{3×3}');
    expect(text(s, s.items.find((i) => /^m0sz2/.test(i.id))!.id)).toBe('3 × 3 matrix');
    expect(text(s, s.items.find((i) => /^m0kind/.test(i.id))!.id)).toBe('Square Matrix');
    const gen = (g: number) => s.items.filter((i) => new RegExp(`^m${g}sz2`).test(i.id)).map((i) => i.text);
    expect(gen(1)).toEqual(['n × n matrix']);
    expect(gen(2)).toEqual(['m × n matrix']);
    expect(text(s, s.items.find((i) => /^m2kind/.test(i.id))!.id)).toBe('Rectangular Matrix');
    expect(item(s, 'm2e3_0').text).toBe('a_{m1}');
    expect(item(s, 'm2e3_3').text).toBe('a_{mn}');
    expect(item(s, 'm1e3_3').text).toBe('a_{nn}');
  });
  it('numbers sample writes the numbers and decides rectangular itself', () => {
    const [n] = buildDnaScenes('matrix-grid', MATRIX_NUMBERS_SAMPLE, 'en', 'T');
    expect([item(n, 'm0e0_0').text, item(n, 'm0e1_0').text, item(n, 'm0e1_2').text]).toEqual(['1', '4', '6']);
    expect(n.items.find((i) => /^m0sz2/.test(i.id))!.text).toBe('2 × 3 matrix');
    expect(n.items.find((i) => /^m0kind/.test(i.id))!.text).toBe('Rectangular Matrix');
  });
});

describe('the camera really zooms in on one entry and back out', () => {
  const [s] = buildDnaScenes('matrix-grid', MATRIX_GRID_SAMPLE, 'en', 'T');
  const zoomStep = s.captions.find((c) => /last entry/.test(c.text))!;
  const outStep = s.captions.find((c) => /step back/.test(c.text))!;
  it('deep zoom is on, centred on a33, 150 high; then back to the whole board', () => {
    expect(s.camX).toBeTruthy();
    const t = zoomStep.t1 - 50;
    expect(s.camH.at(t)).toBeCloseTo(150, 0);
    expect(s.camX!.at(t)).toBeCloseTo(item(s, 'm0e2_2').x.at(0), 0);
    expect(s.camY.at(t)).toBeCloseTo(item(s, 'm0e2_2').y.at(0), 0);
    const t2 = outStep.t1 - 50;
    expect(s.camH.at(t2)).toBeCloseTo(444, 0);
    expect(s.camX!.at(t2)).toBeCloseTo(360, 0);
  });
  it('the two arrows end under the two subscript digits of a33, rows on the left', () => {
    const arrows = s.items.filter((i) => i.kind === 'arrow');
    expect(arrows).toHaveLength(2);
    const [r, c] = arrows;
    expect(r.x2.at(0)).toBeLessThan(c.x2.at(0));
    const e = item(s, 'm0e2_2');
    expect(r.x2.at(0)).toBeLessThan(e.x.at(0) + 30);
    expect(c.x2.at(0)).toBeGreaterThan(e.x.at(0) - 10);
    expect(r.y2.at(0)).toBeGreaterThan(e.y.at(0));
  });
  it('other DNAs keep the old camera (no deep zoom)', () => {
    expect(buildDnaScenes('plane-transform', PLANE_SAMPLE, 'en', 'T')[0].camX).toBeUndefined();
  });
  it('drawing at the zoom scales the board by more than the old 1.6 cap', () => {
    const scales: number[] = [];
    const ctx = new Proxy({} as Record<string, unknown>, {
      get: (t, k: string) => {
        if (k === 'measureText') return (x: string) => ({ width: x.length * 8 });
        if (k === 'createLinearGradient') return () => ({ addColorStop() {} });
        if (k === 'scale') return (a: number) => scales.push(a);
        if (k in t) return t[k];
        return () => {};
      },
      set: (t, k: string, v) => ((t[k] = v), true),
    }) as unknown as CanvasRenderingContext2D;
    drawMotionFrame(ctx, s, zoomStep.t1 - 50, { format: 'vertical' } as never);
    expect(Math.max(...scales)).toBeGreaterThan(2.5);
    scales.length = 0;
    drawMotionFrame(ctx, s, 100, { format: 'vertical' } as never);
    expect(Math.max(...scales)).toBeLessThanOrEqual(1.7);
  });
});

describe('dark board (the reference clip is black)', () => {
  it('paints the board black, turns navy ink light, keeps role colours, and light stays the default', () => {
    const run = (theme?: 'dark') => {
      const fills: string[] = [];
      const textFills: string[] = [];
      let cur = '';
      const ctx = new Proxy({} as Record<string, unknown>, {
        get: (t, k: string) => {
          if (k === 'measureText') return (x: string) => ({ width: x.length * 8 });
          if (k === 'createLinearGradient') return () => ({ addColorStop() {} });
          if (k === 'fillRect') return () => fills.push(cur);
          if (k === 'fillText') return () => textFills.push(cur);
          if (k in t) return t[k];
          return () => {};
        },
        set: (t, k: string, v) => {
          if (k === 'fillStyle') cur = String(v);
          t[k] = v;
          return true;
        },
      }) as unknown as CanvasRenderingContext2D;
      const sc = buildDnaScenes('matrix-grid', MATRIX_GRID_SAMPLE, 'en', 'T')[0];
      drawMotionFrame(ctx, sc, sc.captions[1].t1, { format: 'landscape', theme } as never);
      return { first: fills[0], textFills };
    };
    const dark = run('dark');
    const light = run();
    expect(dark.first).toBe('#000000');
    expect(light.first).toBe('#ffffff');
    expect(dark.textFills).toContain('#f2f2f6');
    expect(light.textFills).toContain('#150b55');
    expect(light.textFills).not.toContain('#f2f2f6');
    expect(dark.textFills).not.toContain('#150b55'); // no navy ink left on the black board
  });
});

describe('validator rejects plans that cannot be right', () => {
  const v = (plan: unknown) => validatePlan('matrix-grid', plan, undefined, true).join(' | ');
  const base = (steps: MatrixPlan['steps'], over: Partial<MatrixPlan> = {}): MatrixPlan => ({ rows: 3, cols: 3, steps, ...over });
  const show = { op: 'show' as const, say };
  it('size, entries, order of steps', () => {
    expect(v(base([show], { rows: 6 }))).toMatch(/1–5/);
    expect(v(base([show], { entries: [[1, 2], [3, 4]] }))).toMatch(/entries must be 3 rows of 3/);
    expect(v(base([{ op: 'row', index: 0, say }]))).toMatch(/needs \{"op":"show"\}/);
    expect(v(base([show, show]))).toMatch(/only once/);
    expect(v(base([{ op: 'size', say }]))).toMatch(/needs/);
  });
  it('indices, rows, columns, zoom', () => {
    expect(v(base([show, { op: 'row', index: 3, say }]))).toMatch(/must be a row/);
    expect(v(base([show, { op: 'column', index: -1, say }]))).toMatch(/must be a column/);
    expect(v(base([show, { op: 'entry', i: 3, j: 0, say }]))).toMatch(/must name an entry/);
    expect(v(base([show, { op: 'indices', say }]))).toMatch(/needs an "entry"/);
    expect(v(base([show, { op: 'zoomOut', say }]))).toMatch(/needs an "entry"/);
    expect(v(base([show, { op: 'entry', i: 0, j: 0, say }, { op: 'indices', say }], { entries: [[1, 2, 3], [4, 5, 6], [7, 8, 9]] }))).toMatch(/a_\{ij\}/);
  });
  it('general grids', () => {
    expect(v(base([show, { op: 'general', rows: 'N', cols: 'n', say }]))).toMatch(/single lowercase/);
    expect(v(base([show, { op: 'general', rows: 'n', cols: 'n', say }, { op: 'row', index: 2, say }]))).toMatch(/dots row/);
    expect(v(base([show, { op: 'general', rows: 'n', cols: 'n', say }, { op: 'entry', i: 0, j: 2, say }]))).toMatch(/not the dots/);
    expect(v(base([show, { op: 'general', rows: 'n', cols: 'n', say }, { op: 'general', rows: 'm', cols: 'n', say }, { op: 'general', rows: 'p', cols: 'q', say }]))).toMatch(/at most two/);
    expect(v(base([show, { op: 'explode' as 'show', say }]))).toMatch(/not one of/);
  });
});

describe('English and Malayalam share the same picture', () => {
  it('same items, kinds and places; only the board words and captions change language', () => {
    const en = buildDnaScenes('matrix-grid', MATRIX_GRID_SAMPLE, 'en', 'T')[0];
    const ml = buildDnaScenes('matrix-grid', MATRIX_GRID_SAMPLE, 'ml', 'T')[0];
    expect(ml.items.map((i) => `${i.id}:${i.kind}`)).toEqual(en.items.map((i) => `${i.id}:${i.kind}`));
    const wordy = (id: string) => /t$|sz2|kind/.test(id) && !/nm$/.test(id);
    const fixed = (s: MotionScene) => s.items.filter((i) => !wordy(i.id)).map((i) => `${i.id}:${i.text}@${Math.round(i.x.at(0))},${Math.round(i.y.at(0))}`);
    expect(fixed(ml)).toEqual(fixed(en));
    const words = (s: MotionScene) => s.items.filter((i) => /^m0(row|col|diag)\d+t$/.test(i.id) || /kind/.test(i.id)).map((i) => i.text);
    expect(words(ml)).not.toEqual(words(en));
    expect(ml.captions.map((c) => c.text)).not.toEqual(en.captions.map((c) => c.text));
  });
});

describe('selection', () => {
  const pick = (t: string, kind: BookBlock['kind'] = 'prose') => selectDna(block(t, kind)).dna;
  it('what a matrix is → the grid; what a matrix does → the plane', () => {
    expect(pick('A matrix is a rectangular arrangement of numbers in rows and columns. A 3 × 3 matrix has 3 rows and 3 columns; the entry a12 is in row 1, column 2.')).toBe('matrix-grid');
    expect(pick('A matrix with equal numbers of rows and columns is called a square matrix. Its diagonal runs from the top left.')).toBe('matrix-grid');
    expect(pick('A matrix can rotate every vector of the plane by the same angle.')).toBe('plane-transform');
    expect(pick('To multiply two matrices, multiply the rows of the first by the columns of the second.')).not.toBe('matrix-grid');
  });
  it('rows and columns without a matrix are not a matrix grid', () => {
    expect(pick('The table has 5 rows and 3 columns, and each entry is a price in rupees.')).not.toBe('matrix-grid');
  });
});

describe('offline planner', () => {
  it('reads the size from the text and draws the anatomy without AI', () => {
    const m = offlineMatrix('A 2 × 3 matrix has 2 rows and 3 columns.');
    expect([m.rows, m.cols]).toEqual([2, 3]);
    expect(validatePlan('matrix-grid', m, RD)).toEqual([]);
    expect(offlineMatrix('A matrix is a grid.')).toMatchObject({ rows: 3, cols: 3 });
    const plan = offlinePlan(block('A matrix is a rectangular arrangement of numbers in rows and columns. The entry a12 is in row 1, column 2.'), 'Matrices', 'S');
    expect(plan.dna).toBe('matrix-grid');
    expect(textOnlyWarning(plan)).toBeUndefined();
    const [s] = buildDnaScenes('matrix-grid', plan.teach, 'en', 'T');
    expect(s.items.find((i) => /^m0kind/.test(i.id))!.text).toBe('Square Matrix');
  });
});

describe('visual QA, the class and drawing', () => {
  it('is a picture, and compiles Read/Teach in both languages', () => {
    // The grid of entries is the picture; the anatomy sample also draws boxes, arrows and dots.
    for (const p of [MATRIX_GRID_SAMPLE, MATRIX_NUMBERS_SAMPLE]) expect(textOnlyWarning({ dna: 'matrix-grid', teach: p })).toBeUndefined();
    expect(visualStats(buildDnaScenes('matrix-grid', MATRIX_GRID_SAMPLE, 'en', 'T')).graphics).toBeGreaterThanOrEqual(10);
    const plan: BlockPlan = { blockId: 'b', dna: 'matrix-grid', read: { en: 'A matrix.', ml: 'മാട്രിക്സ്.' }, teach: MATRIX_GRID_SAMPLE, source: 'fixture' };
    const segs = compileClass([block('A matrix is a grid.')], new Map([['b', plan]]), { title: 'T' });
    expect(segs.map((s) => `${s.phase}:${s.lang}`)).toEqual(['read:en', 'teach:en', 'read:ml', 'teach:ml']);
    for (const seg of segs.filter((s) => s.phase === 'teach')) expect(segmentReel(seg).parts[0].captions.length).toBe(MATRIX_GRID_SAMPLE.steps.length + 1);
  });
  it('draws in every format without errors', () => {
    const ctx = new Proxy({} as Record<string, unknown>, {
      get: (t, k: string) => {
        if (k === 'measureText') return (x: string) => ({ width: x.length * 8 });
        if (k === 'createLinearGradient') return () => ({ addColorStop() {} });
        if (k in t) return t[k];
        return () => {};
      },
      set: (t, k: string, v) => ((t[k] = v), true),
    }) as unknown as CanvasRenderingContext2D;
    for (const lang of ['en', 'ml'] as const) {
      const sc = buildDnaScenes('matrix-grid', MATRIX_GRID_SAMPLE, lang, 'T')[0];
      for (const format of ['landscape', 'vertical', 'square'] as const) for (const f of [0.1, 0.35, 0.5, 0.7, 0.95]) drawMotionFrame(ctx, sc, sc.durationMs * f, { format } as never);
    }
  });
});
