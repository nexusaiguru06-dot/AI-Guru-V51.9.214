import { describe, expect, it } from 'vitest';
import { drawMotionFrame, evalItem, type MotionScene } from '../reels/motion';
import { tokenWidth } from '../reels/motion/metrics';
import { roleColor } from '../reels/motion/grammar';
import { selectDna } from './dna/registry';
import { buildDnaScenes } from './dna/builders';
import { GPX, GPMAX } from './dna/cg-builders';
import { cgGeometry, cgProblem, distFacts, midpointOf, quadrant, fmt, formulaLines, midpointLines } from './dna/cg-math';
import type { BlockPlan, CoordPlan } from './dna/types';
import type { BookBlock } from './segment';
import { validatePlan } from './plan/validate';
import { offlineCoord, offlinePlan } from './plan/offline';
import { textOnlyWarning, visualStats } from './plan/visual-qa';
import { compileClass, segmentReel } from './class';
import { CG_DIST_SAMPLE, CG_DIST_SURD_SAMPLE, CG_MID_SAMPLE, CG_POINTS_SAMPLE } from './samples/coordinate-geometry';

const block = (text: string, kind: BookBlock['kind'] = 'prose'): BookBlock => ({ id: 'b', kind, page: 1, chapterId: 'c', sectionId: 's', lines: [{ text, math: false } as BookBlock['lines'][number]], text });
const say = { en: 'x', ml: 'എ' };
const RD = { en: 'x', ml: 'എ' };
const ALL = [CG_POINTS_SAMPLE, CG_DIST_SAMPLE, CG_DIST_SURD_SAMPLE, CG_MID_SAMPLE];
const S = (ops: string[]) => ops.map((op) => ({ op, say }) as CoordPlan['steps'][number]);
const DIST_OPS = ['axes', 'plot', 'segment', 'legs', 'formula'];
const MID_OPS = ['axes', 'plot', 'segment', 'midpoint'];

const PAIRS: CoordPlan[] = [];
for (let x1 = -6; x1 <= 6; x1 += 3) for (let y1 = -6; y1 <= 6; y1 += 4) for (let x2 = -5; x2 <= 6; x2 += 4) for (let y2 = -6; y2 <= 5; y2 += 3) {
  for (const kind of ['distance', 'midpoint'] as const) {
    const p: CoordPlan = { kind, points: [[x1, y1], [x2, y2]], steps: S(kind === 'distance' ? DIST_OPS : MID_OPS) };
    if (!cgProblem(p, 'p')) PAIRS.push(p);
  }
}
const MANY: CoordPlan[] = [];
for (let a = -6; a <= 6; a += 4) for (let b = -6; b <= 6; b += 3) {
  const pts: Array<[number, number]> = [[a, b], [-b || 1, a || 2], [b + 1, -a - 1], [a + 2, b - 2]].filter(([x, y]) => Math.abs(x) <= 6 && Math.abs(y) <= 6) as Array<[number, number]>;
  for (let n = 1; n <= pts.length; n++) {
    const p: CoordPlan = { kind: 'points', points: pts.slice(0, n), steps: S(['axes', ...pts.slice(0, n).map(() => 'plot'), 'quadrant']).map((s, i) => (s.op === 'plot' ? { ...s, i: i - 1 } : s)) as CoordPlan['steps'] };
    if (!cgProblem(p, 'p')) MANY.push(p);
  }
}
const CASES = [...PAIRS, ...MANY];

describe('the numbers are true', () => {
  it('there are plenty of cases', () => { expect(PAIRS.length).toBeGreaterThan(300); expect(MANY.length).toBeGreaterThan(30); });
  it('distance: d² = dx² + dy², and it matches the plain formula', () => {
    for (const p of PAIRS.filter((x) => x.kind === 'distance')) {
      const f = distFacts(p);
      const [[x1, y1], [x2, y2]] = p.points;
      expect(f.d).toBeCloseTo(Math.hypot(x2 - x1, y2 - y1), 9);
      expect(f.d2).toBe(f.dx * f.dx + f.dy * f.dy);
      expect(f.exact).toBe(Number.isInteger(Math.sqrt(f.d2)));
      const last = formulaLines(p)[3][0];
      if (f.exact) expect(last).toBe(`d = √${f.d2} = ${f.d}`); else expect(last).toBe(`d = √${f.d2} ≈ ${fmt(f.d)}`);
    }
  });
  it('midpoint is the average, and equally far from both ends', () => {
    for (const p of PAIRS.filter((x) => x.kind === 'midpoint')) {
      const m = midpointOf(p);
      const [a, b] = p.points;
      expect(Math.hypot(m[0] - a[0], m[1] - a[1])).toBeCloseTo(Math.hypot(m[0] - b[0], m[1] - b[1]), 9);
      expect(m[0] * 2).toBe(a[0] + b[0]);
      expect(midpointLines(p)[2][0]).toBe(`M = (${fmt(m[0])}, ${fmt(m[1])})`.replace(/−?\d+(\.\d+)?/g, (s) => s));
    }
    expect(midpointOf(CG_MID_SAMPLE)).toEqual([-0.5, 2.5]);
  });
  it('quadrants', () => {
    expect(quadrant([3, 2])).toBe('I');
    expect(quadrant([-2, 4])).toBe('II');
    expect(quadrant([-3, -1])).toBe('III');
    expect(quadrant([2, -3])).toBe('IV');
    expect(quadrant([0, 3])).toBeNull();
    expect(quadrant([4, 0])).toBeNull();
    expect(quadrant([0, 0])).toBeNull();
  });
  it('the picture is to scale and fits the left area', () => {
    for (const p of CASES) {
      const g = cgGeometry(p);
      for (const q of p.points) {
        const [x, y] = g.px(q[0], q[1]);
        expect(x).toBeGreaterThanOrEqual(29); expect(x).toBeLessThanOrEqual(411);
        expect(y).toBeGreaterThan(20); expect(y).toBeLessThan(444 - 20);
      }
      const [ox, oy] = g.px(0, 0);
      const [x1, y1] = g.px(1, 1);
      expect(x1 - ox).toBeCloseTo(g.u, 9);
      expect(oy - y1).toBeCloseTo(g.u, 9);
      expect(g.spec.left + g.spec.width).toBeLessThanOrEqual(411);
    }
  });
});

describe('what is written', () => {
  const lines = (sc: MotionScene, k: number): string[] => {
    const time = sc.captions[k].t1 - 40;
    const vis = sc.items.filter((it) => it.kind === 'text').map((it) => evalItem(it, time)).filter((st) => st.alpha > 0.5 && st.x >= GPX - 4);
    const rows = new Map<number, Array<{ x: number; text: string }>>();
    for (const v of vis) { const key = Math.round(v.y); rows.set(key, [...(rows.get(key) ?? []), { x: v.x, text: v.text }]); }
    return [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, r]) => r.sort((a, b) => a.x - b.x).map((q) => q.text).join(' '));
  };
  const figure = (sc: MotionScene, k: number): string[] => {
    const time = sc.captions[k].t1 - 40;
    return sc.items.filter((it) => it.kind === 'text').map((it) => evalItem(it, time)).filter((st) => st.alpha > 0.5 && st.x < GPX - 4).map((q) => q.text);
  };
  it('points', () => {
    const [sc] = buildDnaScenes('coordinate-geometry', CG_POINTS_SAMPLE, 'en', 'T');
    expect(lines(sc, 1)).toEqual([]);
    expect(lines(sc, 2)).toEqual(['A = (3, 2)']);
    expect(lines(sc, 3)).toEqual(['A = (3, 2)', 'B = (−2, 4)']);
    expect(lines(sc, 5)).toEqual(['A = (3, 2)', 'B = (−2, 4)', 'C = (−3, −1)', 'D = (2, −3)']);
    expect(lines(sc, 6)).toEqual(['A (3, 2) : I', 'B (−2, 4) : II', 'C (−3, −1) : III', 'D (2, −3) : IV']);
    expect(figure(sc, 6)).toEqual(expect.arrayContaining(['I', 'II', 'III', 'IV', 'A', 'B', 'C', 'D']));
    expect(figure(sc, 2)).not.toContain('B');
  });
  it('distance, exact and not', () => {
    const [sc] = buildDnaScenes('coordinate-geometry', CG_DIST_SAMPLE, 'en', 'T');
    expect(lines(sc, 2)).toEqual(['A = (1, 2)', 'B = (5, 5)']);
    expect(lines(sc, 4)).toEqual(['dx = |5 − 1| = 4', 'dy = |5 − 2| = 3']);
    expect(lines(sc, 5)).toEqual(['d^2 = dx^2 + dy^2', '= 4^2 + 3^2', '= 16 + 9 = 25', 'd = √25 = 5']);
    expect(figure(sc, 4)).toEqual(expect.arrayContaining(['dx', 'dy']));
    const [sr] = buildDnaScenes('coordinate-geometry', CG_DIST_SURD_SAMPLE, 'en', 'T');
    expect(lines(sr, 3)).toEqual(['dx = |2 − (−3)| = 5', 'dy = |(−2) − 1| = 3']);
    expect(lines(sr, 4)[3]).toBe('d = √34 ≈ 5.83');
    expect(figure(sr, 1)).toEqual(expect.arrayContaining(['P', 'Q']));
  });
  it('midpoint', () => {
    const [sc] = buildDnaScenes('coordinate-geometry', CG_MID_SAMPLE, 'en', 'T');
    expect(lines(sc, 4)).toEqual(['x = ((−4) + 3) ÷ 2 = −0.5', 'y = (1 + 4) ÷ 2 = 2.5', 'M = (−0.5, 2.5)']);
    expect(figure(sc, 4)).toContain('M');
  });
  it('the colours follow the points', () => {
    const [sc] = buildDnaScenes('coordinate-geometry', CG_DIST_SAMPLE, 'en', 'T');
    const time = sc.captions[5].t1 - 40;
    const col = (it: MotionScene['items'][number]) => (it.color as unknown as { init: string }).init;
    const vis = sc.items.filter((it) => it.kind === 'text' && evalItem(it, time).alpha > 0.5 && evalItem(it, time).x >= GPX - 4);
    const by = (txt: string) => vis.filter((it) => it.text === txt).map(col);
    expect(by('dx^2')).toEqual([roleColor('a')]);
    expect(by('dy^2')).toEqual([roleColor('c')]);
    expect(by('4^2')).toEqual([roleColor('a')]);
    expect(by('3^2')).toEqual([roleColor('c')]);
    expect(by('5')).toEqual([roleColor('result')]);
  });
});

describe('validation', () => {
  const ok = (p: CoordPlan) => validatePlan('coordinate-geometry', p, RD);
  const q = (o: Partial<CoordPlan>) => cgProblem({ kind: 'distance', points: [[1, 2], [4, 6]], steps: [], ...o } as CoordPlan, 'p');
  it('the samples are valid', () => { for (const p of ALL) expect(ok(p)).toEqual([]); });
  it('points and names', () => {
    expect(q({ kind: 'cube' as never })).toMatch(/kind must be/);
    expect(q({ points: [[1, 2]] })).toMatch(/must list 2 points/);
    expect(q({ kind: 'points', points: [] })).toMatch(/1 to 4/);
    expect(q({ kind: 'points', points: [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4]] })).toMatch(/1 to 4/);
    expect(q({ points: [[1.5, 2], [4, 6]] })).toMatch(/whole numbers/);
    expect(q({ points: [[1, 2], [7, 6]] })).toMatch(/from −6 to 6/);
    expect(q({ points: [[1, 2], [1, 2]] })).toMatch(/different from each other/);
    expect(q({ points: [[1, 2], [1, 6]] })).toMatch(/differ in both x and y/);
    expect(q({ points: [[1, 2], [4, 2]] })).toMatch(/differ in both x and y/);
    expect(q({ kind: 'points', points: [[1, 2], [1, 6]] })).toBeNull();
    expect(q({ names: ['A'] })).toMatch(/one capital letter for each point/);
    expect(q({ names: ['A', 'b'] })).toMatch(/capital letter/);
    expect(q({ names: ['A', 'A'] })).toMatch(/different/);
    expect(q({ kind: 'midpoint', names: ['A', 'M'] })).toMatch(/kept for the midpoint/);
    expect(q({ names: ['P', 'Q'] })).toBeNull();
    expect(q({})).toBeNull();
  });
  it('steps', () => {
    const p = (kind: CoordPlan['kind'], ops: string[], pts: CoordPlan['points'] = [[1, 2], [4, 6]]) => ok({ kind, points: pts, steps: S(ops).map((s, i) => (kind === 'points' && s.op === 'plot' ? { ...s, i: i - 1 } : s)) as CoordPlan['steps'] });
    expect(p('distance', ['plot']).join()).toMatch(/needs \{"op":"axes"\}/);
    expect(p('distance', ['axes', 'axes']).join()).toMatch(/only once/);
    expect(p('distance', ['axes', 'legs']).join()).toMatch(/needs "segment"/);
    expect(p('distance', ['axes', 'plot', 'formula']).join()).toMatch(/needs "legs"/);
    expect(p('distance', ['axes', 'plot', 'midpoint']).join()).toMatch(/not one of/);
    expect(p('midpoint', ['axes', 'plot', 'midpoint']).join()).toMatch(/needs "segment"/);
    expect(p('midpoint', ['axes', 'plot', 'legs']).join()).toMatch(/not one of/);
    expect(p('points', ['axes', 'segment'], [[1, 1]]).join()).toMatch(/not one of/);
    expect(p('distance', DIST_OPS)).toEqual([]);
    expect(p('midpoint', MID_OPS)).toEqual([]);
    expect(p('points', ['axes', 'plot', 'plot', 'quadrant'], [[1, 1], [-2, 3]])).toEqual([]);
    const bad = ok({ kind: 'points', points: [[1, 1], [2, 2]], steps: [{ op: 'axes', say }, { op: 'plot', i: 0, say }, { op: 'plot', i: 0, say }] });
    expect(bad.join()).toMatch(/already plotted|once|different/i);
    const missing = ok({ kind: 'points', points: [[1, 1], [2, 2]], steps: [{ op: 'axes', say }, { op: 'plot', say }] as CoordPlan['steps'] });
    expect(missing.join()).toMatch(/\bi\b/);
    expect(ok({ kind: 'distance', points: [[1, 2], [4, 6]], steps: [{ op: 'axes', say: { en: '', ml: '' } }] }).join()).toMatch(/say is required/);
  });
});

describe('selection', () => {
  const pick = (text: string, kind: BookBlock['kind'] = 'prose') => selectDna(block(text, kind)).dna;
  it('plotting, distance, midpoint → coordinate-geometry', () => {
    expect(pick('Plot the points A(3, 2) and B(−2, 4) on the coordinate plane.')).toBe('coordinate-geometry');
    expect(pick('Find the distance between the points (1, 2) and (5, 5).', 'exercise')).toBe('coordinate-geometry');
    expect(pick('Find the midpoint of the line segment joining A(−4, 1) and B(3, 4).', 'exercise')).toBe('coordinate-geometry');
    expect(pick('In which quadrant does the point (−3, −1) lie?', 'exercise')).toBe('coordinate-geometry');
  });
  it('the same words elsewhere stay elsewhere', () => {
    expect(pick('Draw the graph of y = 2x + 1.')).not.toBe('coordinate-geometry');
    expect(pick('Solve the equations x + y = 5 and x − y = 1 by drawing the lines.')).not.toBe('coordinate-geometry');
    expect(pick('The area of a parallelogram is its base multiplied by its height.')).toBe('area-figure');
    expect(pick('To multiply two matrices, multiply each row of the first by the columns of the second.')).toBe('matrix-ops');
    expect(pick('The volume of a cylinder is π r² h.')).toBe('solid-figure');
    expect(pick('The distance travelled is speed times time.')).not.toBe('coordinate-geometry');
  });
});

describe('offline planner', () => {
  it('reads points, distance and midpoint', () => {
    const d = offlineCoord('Find the distance between A(1, 2) and B(5, 5).')!;
    expect(d).toMatchObject({ kind: 'distance', points: [[1, 2], [5, 5]], names: ['A', 'B'] });
    expect(d.steps.map((s) => s.op)).toEqual(DIST_OPS);
    const m = offlineCoord('Find the midpoint of (−4, 1) and (3, 4).')!;
    expect(m).toMatchObject({ kind: 'midpoint', points: [[-4, 1], [3, 4]] });
    expect(m.steps.map((s) => s.op)).toEqual(MID_OPS);
    const p = offlineCoord('Plot A(3, 2), B(-2, 4) and C(-3, -1). Name the quadrant of each.')!;
    expect(p).toMatchObject({ kind: 'points', names: ['A', 'B', 'C'] });
    expect(p.steps.map((s) => s.op)).toEqual(['axes', 'plot', 'plot', 'plot', 'quadrant']);
    for (const x of [d, m, p]) expect(validatePlan('coordinate-geometry', x, RD)).toEqual([]);
  });
  it('null when the points do not fit', () => {
    expect(offlineCoord('Plot a point on the plane.')).toBeNull();
    expect(offlineCoord('Find the distance between (1, 2) and (1, 6).')).toBeNull();
    expect(offlineCoord('Find the distance between (1, 2) and (9, 6).')).toBeNull();
  });
  it('falls back with a warning without points', () => {
    const pl = offlinePlan(block('We use the coordinate plane to find the distance between two points.'), '', '');
    expect(pl.dna).toBe('concept-board');
    expect(pl.warnings?.join()).toMatch(/AI planner needed/);
    expect(offlinePlan(block('Find the distance between the points A(1, 2) and B(5, 5).', 'exercise'), '', '').dna).toBe('coordinate-geometry');
  });
});

describe('picture and class', () => {
  it('samples are real pictures', () => {
    for (const teach of ALL) {
      expect(textOnlyWarning({ dna: 'coordinate-geometry', teach })).toBeUndefined();
      expect(visualStats(buildDnaScenes('coordinate-geometry', teach, 'en', 'T')).graphics).toBeGreaterThanOrEqual(4);
    }
  });
  it('compiles into a class with one caption per step', () => {
    for (const teach of ALL) {
      const plan: BlockPlan = { blockId: 'b', dna: 'coordinate-geometry', read: RD, teach, source: 'fixture' };
      const segs = compileClass([block('Plane.')], new Map([['b', plan]]), { title: 'T' });
      for (const seg of segs.filter((x) => x.phase === 'teach')) expect(segmentReel(seg).parts[0].captions.length).toBe(teach.steps.length + (teach.title ? 1 : 0));
    }
  });
  it('draws without error in every format and theme', () => {
    const noop = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? (x: string) => ({ width: x.length * 10 }) : () => undefined), set: () => true }) as unknown as CanvasRenderingContext2D;
    for (const teach of ALL) {
      const sc = buildDnaScenes('coordinate-geometry', teach, 'ml', 'T')[0];
      for (const format of ['landscape', 'vertical', 'square'] as const) for (const theme of ['light', 'dark'] as const) for (const f of [0.1, 0.4, 0.7, 0.99]) drawMotionFrame(noop, sc, sc.durationMs * f, { format, theme } as never);
    }
  });
  it('nothing overlaps or leaves its area (every step, many pictures)', { timeout: 180000 }, () => {
    const cases = [...ALL, ...CASES.filter((_, i) => i % 3 === 0)];
    for (const teach of cases) {
      const sc = buildDnaScenes('coordinate-geometry', teach, 'en', 'T')[0];
      for (let k = 0; k < sc.captions.length; k++) {
        const time = sc.captions[k].t1 - 40;
        const st = sc.items.filter((it) => it.kind === 'text').map((it) => evalItem(it, time)).filter((s) => s.alpha > 0.5).map((q) => {
          const w = tokenWidth(q.text, q.size);
          return { q, l: q.x - w / 2, r: q.x + w / 2 };
        });
        const tag = JSON.stringify([teach.kind, teach.points]);
        for (const b of st) {
          expect(b.l, `${tag} ${b.q.text}`).toBeGreaterThan(2);
          expect(b.r, `${tag} ${b.q.text}`).toBeLessThan(718);
          if (b.l > GPX - 4) expect(b.r, `${tag} ${b.q.text}`).toBeLessThanOrEqual(GPX + GPMAX + 1);
          else expect(b.r, `${tag} ${b.q.text}`).toBeLessThan(GPX - 4);
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
    const en = buildDnaScenes('coordinate-geometry', CG_DIST_SAMPLE, 'en', 'T')[0];
    const ml = buildDnaScenes('coordinate-geometry', CG_DIST_SAMPLE, 'ml', 'T')[0];
    expect(ml.items.map((it) => `${it.id}:${it.kind}:${it.text}`)).toEqual(en.items.map((it) => `${it.id}:${it.kind}:${it.text}`));
    expect(ml.captions.map((x) => x.text)).not.toEqual(en.captions.map((x) => x.text));
  });
  it('builds and validates every case', { timeout: 120000 }, () => {
    for (const p of CASES.filter((_, i) => i % 3 === 0)) {
      expect(validatePlan('coordinate-geometry', p, RD), JSON.stringify(p.points)).toEqual([]);
      expect(() => buildDnaScenes('coordinate-geometry', p, 'en', 'T')).not.toThrow();
    }
  });
});
