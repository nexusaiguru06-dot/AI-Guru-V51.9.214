import { describe, expect, it } from 'vitest';
import { drawMotionFrame, evalItem, type MotionScene } from '../reels/motion';
import { tokenWidth } from '../reels/motion/metrics';
import { roleColor } from '../reels/motion/grammar';
import { selectDna } from './dna/registry';
import { buildDnaScenes } from './dna/builders';
import { APX, APMAX } from './dna/af-builders';
import { YB, afGeometry, afProblem, area, offset, slant } from './dna/af-math';
import type { AreaFigPlan, BlockPlan } from './dna/types';
import type { BookBlock } from './segment';
import { validatePlan } from './plan/validate';
import { offlineAreaFig, offlinePlan } from './plan/offline';
import { textOnlyWarning, visualStats } from './plan/visual-qa';
import { compileClass, segmentReel } from './class';
import { AF_PAR_LEFT_SAMPLE, AF_PAR_SAMPLE, AF_TRAP_COPY_SAMPLE, AF_TRAP_RIGHT_SAMPLE, AF_TRAP_TRI_SAMPLE } from './samples/area-figure';

const block = (text: string, kind: BookBlock['kind'] = 'prose'): BookBlock => ({ id: 'b', kind, page: 1, chapterId: 'c', sectionId: 's', lines: [{ text, math: false } as BookBlock['lines'][number]], text });
const say = { en: 'x', ml: 'എ' };
const RD = { en: 'x', ml: 'എ' };
const ALL = [AF_PAR_SAMPLE, AF_PAR_LEFT_SAMPLE, AF_TRAP_COPY_SAMPLE, AF_TRAP_TRI_SAMPLE, AF_TRAP_RIGHT_SAMPLE];
const S = (ops: string[]) => ops.map((op) => ({ op, say }) as AreaFigPlan['steps'][number]);

const PARS: AreaFigPlan[] = [];
const TRAPS: AreaFigPlan[] = [];
for (let b = 2; b <= 20; b += 2) for (let h = 2; h <= 20; h += 3) for (const lean of ['left', 'right'] as const) PARS.push({ kind: 'parallelogram', b: Math.min(20, b + (h % 2)), h, lean, unit: 'cm', steps: S(['show', 'height', 'cut', 'move', 'formula']) });
for (let b = 3; b <= 20; b += 2) for (let a = 1; a < b; a += 3) for (let h = 2; h <= 20; h += 4) for (const lean of ['left', 'right', 'centre'] as const) {
  const p: AreaFigPlan = { kind: 'trapezium', b, a, h, lean, steps: S(['show', 'height', 'copy', 'triangles', 'formula']) };
  if (!afProblem(p, 'p')) TRAPS.push(p);
}
const CASES = [...PARS, ...TRAPS];

describe('the numbers are true', () => {
  it('there are plenty of cases', () => { expect(PARS.length).toBeGreaterThan(60); expect(TRAPS.length).toBeGreaterThan(100); });
  it('areas: parallelogram b × h; trapezium half (a + b) h, and the two triangles add up', () => {
    for (const p of PARS) expect(area(p)).toBe(p.b * p.h);
    for (const p of TRAPS) {
      expect(Number.isInteger(area(p))).toBe(true);
      expect(area(p) * 2).toBe((p.a! + p.b) * p.h);
      expect((p.b * p.h) / 2 + (p.a! * p.h) / 2).toBe(area(p));
    }
  });
  it('geometry: shoelace area of the picture is the formula (to scale)', () => {
    const shoe = (pts: Array<[number, number]>) => { let s = 0; pts.forEach(([x0, y0], i) => { const [x1, y1] = pts[(i + 1) % pts.length]; s += x0 * y1 - x1 * y0; }); return Math.abs(s) / 2; };
    for (const p of CASES) {
      const g = afGeometry(p);
      expect(shoe(g.fig) / (g.u * g.u), JSON.stringify(p)).toBeCloseTo(area(p), 6);
      if (p.kind === 'trapezium') {
        // the turned copy has the same area and together they are a parallelogram of base a + b and height h
        expect(shoe(g.copy!) / (g.u * g.u)).toBeCloseTo(area(p), 6);
        expect(shoe(g.triB!) / (g.u * g.u)).toBeCloseTo((p.b * p.h) / 2, 6);
        expect(shoe(g.triA!) / (g.u * g.u)).toBeCloseTo((p.a! * p.h) / 2, 6);
      } else {
        // the cut triangle moved by b makes a rectangle b × h
        expect(shoe(g.tri!) / (g.u * g.u)).toBeCloseTo((slant(p) * p.h) / 2, 6);
        expect(shoe(g.moved!) / (g.u * g.u)).toBeCloseTo((slant(p) * p.h) / 2, 6);
        const dx = g.moved![0][0] - g.tri![0][0];
        expect(Math.abs(dx) / g.u).toBeCloseTo(p.b, 6);
      }
    }
  });
  it('the figure fits the left area and rests on the base line', () => {
    for (const p of CASES) {
      const g = afGeometry(p);
      const all = [...g.fig, ...(g.copy ?? []), ...(g.tri ?? []), ...(g.moved ?? [])];
      for (const [x, y] of all) { expect(x).toBeGreaterThanOrEqual(29.9); expect(x).toBeLessThanOrEqual(410.1); expect(y).toBeLessThanOrEqual(YB + 1e-9); expect(y).toBeGreaterThan(YB - 205); }
      expect(g.fig[0][1]).toBeCloseTo(YB, 9);
      expect(g.fig[1][1]).toBeCloseTo(YB, 9);
    }
  });
  it('trapezium offsets and the slant', () => {
    expect(offset({ kind: 'trapezium', b: 10, a: 4, h: 6, steps: [] })).toBe(3);
    expect(offset({ kind: 'trapezium', b: 10, a: 4, h: 6, lean: 'left', steps: [] })).toBe(0);
    expect(offset({ kind: 'trapezium', b: 10, a: 4, h: 6, lean: 'right', steps: [] })).toBe(6);
    expect(slant({ kind: 'parallelogram', b: 2, h: 20, steps: [] })).toBe(1);
    expect(slant({ kind: 'parallelogram', b: 8, h: 5, steps: [] })).toBe(3);
  });
});

describe('what is written', () => {
  const lines = (sc: MotionScene, k: number, title: boolean): string[] => {
    const time = sc.captions[k + (title ? 1 : 0)].t1 - 40;
    const vis = sc.items.filter((it) => it.kind === 'text').map((it) => evalItem(it, time)).filter((st) => st.alpha > 0.5 && st.x >= APX - 4);
    const rows = new Map<number, Array<{ x: number; text: string }>>();
    for (const v of vis) { const key = Math.round(v.y); rows.set(key, [...(rows.get(key) ?? []), { x: v.x, text: v.text }]); }
    return [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, r]) => r.sort((a, b) => a.x - b.x).map((q) => q.text).join(' '));
  };
  const figure = (sc: MotionScene, k: number, title: boolean): string[] => {
    const time = sc.captions[k + (title ? 1 : 0)].t1 - 40;
    return sc.items.filter((it) => it.kind === 'text').map((it) => evalItem(it, time)).filter((st) => st.alpha > 0.5 && st.x < APX - 4).map((q) => q.text);
  };
  it('parallelogram', () => {
    const [sc] = buildDnaScenes('area-figure', AF_PAR_SAMPLE, 'en', 'T');
    expect(lines(sc, 0, true)).toEqual(['b = 8 cm', 'h = 5 cm']);
    expect(figure(sc, 0, true)).toEqual(['b']);
    expect(figure(sc, 1, true).sort()).toEqual(['b', 'h']);
    expect(lines(sc, 4, true)).toEqual(['A = b × h', '= 8 × 5', '= 40 cm^2']);
    const [lf] = buildDnaScenes('area-figure', AF_PAR_LEFT_SAMPLE, 'en', 'T');
    expect(lines(lf, 4, false)).toEqual(['A = b × h', '= 12 × 7', '= 84']);
  });
  it('trapezium', () => {
    const [sc] = buildDnaScenes('area-figure', AF_TRAP_COPY_SAMPLE, 'en', 'T');
    expect(lines(sc, 0, true)).toEqual(['a = 4 cm', 'b = 10 cm', 'h = 6 cm']);
    expect(figure(sc, 0, true).sort()).toEqual(['a', 'b']);
    expect(lines(sc, 2, true)).toEqual(['2 × A = (a + b) × h']);
    expect(figure(sc, 2, true)).toEqual(expect.arrayContaining(['a + b']));
    expect(lines(sc, 3, true)).toEqual(['A = {1/2} × (a + b) × h', '= {1/2} × (4 + 10) × 6', '= {1/2} × 14 × 6', '= 42 cm^2']);
    const [tr] = buildDnaScenes('area-figure', AF_TRAP_TRI_SAMPLE, 'en', 'T');
    expect(lines(tr, 2, false)).toEqual(['{1/2} × 9 × 4 = 18', '{1/2} × 5 × 4 = 10', '18 + 10 = 28']);
    expect(lines(tr, 3, false)[3]).toBe('= 28');
  });
  it('the colours follow the letters', () => {
    const [sc] = buildDnaScenes('area-figure', AF_TRAP_COPY_SAMPLE, 'en', 'T');
    const time = sc.captions[4].t1 - 40;
    const col = (it: MotionScene['items'][number]) => (it.color as unknown as { init: string }).init;
    const vis = sc.items.filter((it) => it.kind === 'text' && evalItem(it, time).alpha > 0.5 && evalItem(it, time).x >= APX - 4);
    const by = (txt: string) => vis.filter((it) => it.text === txt).map(col);
    expect(by('(a')).toEqual([roleColor('a')]);
    expect(by('b)')).toEqual([roleColor('b')]);
    expect(by('h')).toEqual([roleColor('c')]);
    expect(by('(4')).toEqual([roleColor('a')]);
    expect(by('10)')).toEqual([roleColor('b')]);
    expect(new Set(by('6'))).toEqual(new Set([roleColor('c')]));
    expect(by('42')).toEqual([roleColor('result')]);
  });
});

describe('validation', () => {
  const ok = (p: AreaFigPlan) => validatePlan('area-figure', p, RD);
  it('the samples are valid', () => { for (const p of ALL) expect(ok(p)).toEqual([]); });
  it('sizes', () => {
    const q = (o: Partial<AreaFigPlan>) => afProblem({ kind: 'trapezium', b: 10, a: 4, h: 6, steps: [], ...o } as AreaFigPlan, 'p');
    expect(q({ kind: 'cube' as never })).toMatch(/kind must be/);
    expect(q({ b: 1 })).toMatch(/b must be a whole number from 2 to 20/);
    expect(q({ h: 21 })).toMatch(/h must be a whole number from 2 to 20/);
    expect(q({ b: 10.5 })).toMatch(/whole number/);
    expect(q({ a: 10 })).toMatch(/from 1 to b − 1/);
    expect(q({ a: 0 })).toMatch(/from 1 to b − 1/);
    expect(q({ a: 4, b: 9, h: 3 })).toMatch(/is odd/);
    expect(q({ unit: 'km' as never })).toMatch(/unit must be/);
    expect(q({ lean: 'up' as never })).toMatch(/lean must be/);
    expect(q({})).toBeNull();
    expect(q({ kind: 'parallelogram', lean: 'centre' })).toMatch(/"left" or "right"/);
    expect(q({ kind: 'parallelogram', b: 7, h: 5 })).toBeNull();
    expect(q({ a: 5, b: 9, h: 3, steps: S(['show', 'triangles']) })).toMatch(/needs b × h and a × h even/);
  });
  it('steps', () => {
    const p = (kind: 'parallelogram' | 'trapezium', ops: string[]) => ok({ kind, b: 10, a: 4, h: 6, steps: S(ops) });
    expect(p('parallelogram', ['height']).join()).toMatch(/needs \{"op":"show"\}/);
    expect(p('parallelogram', ['show', 'show']).join()).toMatch(/"show" only once/);
    expect(p('parallelogram', ['show', 'cut']).join()).toMatch(/needs "height"/);
    expect(p('parallelogram', ['show', 'height', 'move']).join()).toMatch(/needs "cut"/);
    expect(p('parallelogram', ['show', 'copy']).join()).toMatch(/not one of/);
    expect(p('trapezium', ['show', 'cut']).join()).toMatch(/not one of/);
    expect(p('trapezium', ['show', 'copy']).join()).toMatch(/needs "height"/);
    expect(p('trapezium', ['show', 'height', 'height']).join()).toMatch(/only once/);
    expect(p('trapezium', ['show', 'height', 'copy', 'triangles', 'formula'])).toEqual([]);
    expect(ok({ kind: 'parallelogram', b: 4, h: 3, steps: [{ op: 'show', say: { en: '', ml: '' } }] }).join()).toMatch(/say is required/);
  });
});

describe('selection', () => {
  const pick = (text: string, kind: BookBlock['kind'] = 'prose') => selectDna(block(text, kind)).dna;
  it('area of these figures → area-figure', () => {
    expect(pick('The area of a parallelogram is its base multiplied by its height.')).toBe('area-figure');
    expect(pick('Find the area of a trapezium whose parallel sides are 4 cm and 10 cm and height 6 cm.', 'exercise')).toBe('area-figure');
    expect(pick('The area of a trapezoid is half the sum of the bases times the height.')).toBe('area-figure');
  });
  it('the same words elsewhere stay elsewhere', () => {
    expect(pick('The opposite angles of a parallelogram are equal.')).not.toBe('area-figure');
    expect(pick('Find the area of a rectangle of length 8 cm and width 5 cm.', 'exercise')).not.toBe('area-figure');
    expect(pick('The diagonals of a parallelogram bisect each other.')).not.toBe('area-figure');
    expect(pick('The volume of a cylinder is π r² h.')).toBe('solid-figure');
    expect(pick('To multiply two matrices, multiply each row of the first by the columns of the second.')).toBe('matrix-ops');
  });
});

describe('offline planner', () => {
  it('reads the sizes', () => {
    const p = offlineAreaFig('Find the area of a parallelogram with base 8 cm and height 5 cm.')!;
    expect(p).toMatchObject({ kind: 'parallelogram', b: 8, h: 5, unit: 'cm' });
    expect(p.steps.map((s) => s.op)).toEqual(['show', 'height', 'cut', 'move', 'formula']);
    const t = offlineAreaFig('The parallel sides of a trapezium are 10 cm and 4 cm and its height is 6 cm.')!;
    expect(t).toMatchObject({ kind: 'trapezium', b: 10, a: 4, h: 6, unit: 'cm' });
    expect(t.steps.map((s) => s.op)).toEqual(['show', 'height', 'copy', 'formula']);
    for (const x of [p, t]) expect(validatePlan('area-figure', x, RD)).toEqual([]);
  });
  it('null when the sizes do not fit', () => {
    expect(offlineAreaFig('A parallelogram has an area.')).toBeNull();
    expect(offlineAreaFig('A trapezium has parallel sides 5 cm and 8 cm and height 3 cm.')).toBeNull(); // (5+8)×3 odd
    expect(offlineAreaFig('A parallelogram with base 30 cm and height 5 cm.')).toBeNull();
  });
  it('falls back with a warning without sizes', () => {
    const pl = offlinePlan(block('The area of a trapezium depends on its parallel sides and its height.'), '', '');
    expect(pl.dna).toBe('concept-board');
    expect(pl.warnings?.join()).toMatch(/AI planner needed/);
    expect(offlinePlan(block('Find the area of a parallelogram with base 8 cm and height 5 cm.', 'exercise'), '', '').dna).toBe('area-figure');
  });
});

describe('picture and class', () => {
  it('samples are real pictures', () => {
    for (const teach of ALL) {
      expect(textOnlyWarning({ dna: 'area-figure', teach })).toBeUndefined();
      expect(visualStats(buildDnaScenes('area-figure', teach, 'en', 'T')).graphics).toBeGreaterThanOrEqual(4);
    }
  });
  it('compiles into a class with one caption per step', () => {
    for (const teach of ALL) {
      const plan: BlockPlan = { blockId: 'b', dna: 'area-figure', read: RD, teach, source: 'fixture' };
      const segs = compileClass([block('Area.')], new Map([['b', plan]]), { title: 'T' });
      for (const seg of segs.filter((x) => x.phase === 'teach')) expect(segmentReel(seg).parts[0].captions.length).toBe(teach.steps.length + (teach.title ? 1 : 0));
    }
  });
  it('draws without error in every format and theme', () => {
    const noop = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? (x: string) => ({ width: x.length * 10 }) : () => undefined), set: () => true }) as unknown as CanvasRenderingContext2D;
    for (const teach of ALL) {
      const sc = buildDnaScenes('area-figure', teach, 'ml', 'T')[0];
      for (const format of ['landscape', 'vertical', 'square'] as const) for (const theme of ['light', 'dark'] as const) for (const f of [0.1, 0.4, 0.7, 0.99]) drawMotionFrame(noop, sc, sc.durationMs * f, { format, theme } as never);
    }
  });
  it('nothing overlaps or leaves its area (every step, many figures)', { timeout: 120000 }, () => {
    const cases = [...ALL, ...CASES.filter((_, i) => i % 7 === 0)];
    for (const teach of cases) {
      const sc = buildDnaScenes('area-figure', teach, 'en', 'T')[0];
      for (let k = 0; k < sc.captions.length; k++) {
        const time = sc.captions[k].t1 - 40;
        const st = sc.items.filter((it) => it.kind === 'text').map((it) => evalItem(it, time)).filter((s) => s.alpha > 0.5).map((q) => {
          const w = tokenWidth(q.text, q.size);
          return { q, l: q.x - w / 2, r: q.x + w / 2 };
        });
        const tag = JSON.stringify([teach.kind, teach.b, teach.a, teach.h, teach.lean]);
        for (const b of st) {
          expect(b.l, `${tag} ${b.q.text}`).toBeGreaterThan(2);
          expect(b.r, `${tag} ${b.q.text}`).toBeLessThan(718);
          if (b.l > APX - 4) expect(b.r, `${tag} ${b.q.text}`).toBeLessThanOrEqual(APX + APMAX + 1);
          else expect(b.r, `${tag} ${b.q.text}`).toBeLessThan(APX - 4);
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
    const en = buildDnaScenes('area-figure', AF_TRAP_COPY_SAMPLE, 'en', 'T')[0];
    const ml = buildDnaScenes('area-figure', AF_TRAP_COPY_SAMPLE, 'ml', 'T')[0];
    expect(ml.items.map((it) => `${it.id}:${it.kind}:${it.text}`)).toEqual(en.items.map((it) => `${it.id}:${it.kind}:${it.text}`));
    expect(ml.captions.map((x) => x.text)).not.toEqual(en.captions.map((x) => x.text));
  });
  it('builds and validates every case', { timeout: 120000 }, () => {
    for (const p of CASES.filter((_, i) => i % 3 === 0)) {
      expect(validatePlan('area-figure', p, RD), JSON.stringify([p.b, p.a, p.h])).toEqual([]);
      expect(() => buildDnaScenes('area-figure', p, 'en', 'T')).not.toThrow();
    }
  });
});
