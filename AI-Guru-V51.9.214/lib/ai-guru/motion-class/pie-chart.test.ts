import { describe, expect, it } from 'vitest';
import { drawMotionFrame, evalItem, type MotionScene } from '../reels/motion';
import { tokenWidth } from '../reels/motion/metrics';
import { selectDna } from './dna/registry';
import { buildDnaScenes } from './dna/builders';
import { CPX, CPMAX } from './dna/pc-builders';
import { PIE, PIE_COLORS, fmtNum, onPie, pieFacts, pieGeometry, pieProblem } from './dna/pc-math';
import type { BlockPlan, PiePlan } from './dna/types';
import type { BookBlock } from './segment';
import { validatePlan } from './plan/validate';
import { offlinePie, offlinePlan } from './plan/offline';
import { textOnlyWarning, visualStats } from './plan/visual-qa';
import { compileClass, segmentReel } from './class';
import { PIE_SIX_SAMPLE, PIE_SUBJECT_SAMPLE, PIE_TWO_SAMPLE } from './samples/pie-chart';

const block = (text: string, kind: BookBlock['kind'] = 'prose'): BookBlock => ({ id: 'b', kind, page: 1, chapterId: 'c', sectionId: 's', lines: [{ text, math: false } as BookBlock['lines'][number]], text });
const say = { en: 'x', ml: 'എ' };
const RD = { en: 'x', ml: 'എ' };
const ALL = [PIE_SUBJECT_SAMPLE, PIE_SIX_SAMPLE, PIE_TWO_SAMPLE];
const OPS = ['show', 'total', 'angle', 'percent', 'check'];
const full = (values: number[], labels?: string[]): PiePlan => ({ values, ...(labels ? { labels } : {}), steps: OPS.map((op) => ({ op, say }) as PiePlan['steps'][number]) });

/** Every split of a total that gives whole-degree sectors of at least 15°, 2 to 6 parts (sampled). */
const CASES: PiePlan[] = [];
for (const T of [24, 36, 40, 45, 60, 72, 90, 100, 120, 180, 360, 600]) {
  const m = T / gcd(T, 360);
  const unit = m; // values are multiples of m
  const n = T / unit;
  const rec = (left: number, parts: number[]) => {
    if (CASES.length > 3000) return;
    if (parts.length >= 2 && left === 0) { const p = full(parts); if (!pieProblem(p, 'p')) CASES.push(p); return; }
    if (parts.length === 6) return;
    for (let k = 1; k <= left / unit; k += Math.max(1, Math.floor(n / 6))) rec(left - k * unit, [...parts, k * unit]);
  };
  rec(T, []);
}
function gcd(a: number, b: number): number { return b ? gcd(b, a % b) : a; }

describe('angles and percentages are true', () => {
  it('there are plenty of cases', () => expect(CASES.length).toBeGreaterThan(150));
  it('every angle is value/total of 360°, they add up to 360°, percentages to 100%', () => {
    for (const p of CASES) {
      const f = pieFacts(p);
      p.values.forEach((v, i) => { expect(f.angles[i] * f.total, `${p.values}`).toBe(360 * v); expect(Number.isInteger(f.angles[i])).toBe(true); });
      expect(f.angles.reduce((a, b) => a + b, 0)).toBe(360);
      expect(f.percents.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 9);
    }
  });
  it('sectors: clockwise from the top, contiguous, each the right share of the disc', () => {
    for (const p of CASES.filter((_, i) => i % 3 === 0)) {
      const g = pieGeometry(p);
      const f = pieFacts(p);
      expect(g[0].start).toBe(0);
      expect(g[g.length - 1].end).toBeCloseTo(360, 9);
      g.forEach((s, i) => {
        if (i) expect(s.start).toBeCloseTo(g[i - 1].end, 9);
        expect(s.end - s.start).toBeCloseTo(f.angles[i], 9);
        // the outline starts at the centre, then the arc from start to end
        expect(s.pts[0]).toEqual([PIE.cx, PIE.cy]);
        const a = onPie(PIE.r, s.start), b = onPie(PIE.r, s.end);
        expect(s.pts[1][0]).toBeCloseTo(a[0], 9); expect(s.pts[1][1]).toBeCloseTo(a[1], 9);
        expect(s.pts[s.pts.length - 1][0]).toBeCloseTo(b[0], 9); expect(s.pts[s.pts.length - 1][1]).toBeCloseTo(b[1], 9);
        let area = 0;
        for (let k = 0; k < s.pts.length; k++) { const [x0, y0] = s.pts[k]; const [x1, y1] = s.pts[(k + 1) % s.pts.length]; area += x0 * y1 - x1 * y0; }
        const disc = Math.PI * PIE.r * PIE.r;
        expect(Math.abs(area) / 2 / disc / (f.angles[i] / 360), `${p.values} #${i}`).toBeGreaterThan(0.99);
        expect(Math.abs(area) / 2 / disc / (f.angles[i] / 360)).toBeLessThanOrEqual(1.0000001);
      });
      // the first sector's start is straight up (screen y smaller than the centre)
      expect(g[0].pts[1][1]).toBeLessThan(PIE.cy);
      expect(g[0].pts[1][0]).toBeCloseTo(PIE.cx, 9);
    }
  });
  it('formats numbers', () => {
    expect(fmtNum(41.6666667)).toBe('41.67');
    expect(fmtNum(25)).toBe('25');
  });
});

describe('what is written', () => {
  const lines = (sc: MotionScene, k: number, title: boolean): string[] => {
    const time = sc.captions[k + (title ? 1 : 0)].t1 - 40;
    const vis = sc.items.filter((it) => it.kind === 'text').map((it) => evalItem(it, time)).filter((st) => st.alpha > 0.5 && st.x >= CPX - 4);
    const rows = new Map<number, Array<{ x: number; text: string }>>();
    for (const v of vis) { const key = Math.round(v.y); rows.set(key, [...(rows.get(key) ?? []), { x: v.x, text: v.text }]); }
    return [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, r]) => r.sort((a, b) => a.x - b.x).map((q) => q.text).join(' '));
  };
  const texts = (sc: MotionScene, k: number, title: boolean): string[] => {
    const time = sc.captions[k + (title ? 1 : 0)].t1 - 40;
    return sc.items.filter((it) => it.kind === 'text').map((it) => evalItem(it, time)).filter((st) => st.alpha > 0.5 && st.x < CPX - 4).map((q) => q.text);
  };
  const [sc] = buildDnaScenes('pie-chart', PIE_SUBJECT_SAMPLE, 'en', 'T');
  it('data, total, angles, percentages, check', () => {
    expect(lines(sc, 0, true)).toEqual(['Maths = 30', 'Art = 50', 'Music = 40']);
    expect(texts(sc, 0, true)).toEqual([]);
    expect(lines(sc, 1, true)).toEqual(['Maths = 30', 'Art = 50', 'Music = 40', 'Total = 30 + 50 + 40 = 120']);
    expect(lines(sc, 2, true)).toEqual(['Maths: {30/120} × 360° = 90°', 'Art: {50/120} × 360° = 150°', 'Music: {40/120} × 360° = 120°']);
    expect(texts(sc, 2, true)).toEqual(expect.arrayContaining(['90°', '150°', '120°', 'Maths', 'Art', 'Music']));
    expect(lines(sc, 3, true)).toEqual(['Maths: {30/120} × 100% = 25%', 'Art: {50/120} × 100% ≈ 41.67%', 'Music: {40/120} × 100% ≈ 33.33%']);
    expect(texts(sc, 3, true)).toEqual(expect.arrayContaining(['25%', '41.67%', '33.33%']));
    expect(texts(sc, 3, true)).not.toContain('90°');
    expect(lines(sc, 4, true)).toEqual(['90° + 150° + 120° = 360°']);
    expect(sc.items.some((it) => it.kind === 'tick')).toBe(true);
  });
  it('default labels A, B …', () => {
    const [two] = buildDnaScenes('pie-chart', PIE_TWO_SAMPLE, 'en', 'T');
    expect(lines(two, 0, false)).toEqual(['A = 45', 'B = 75']);
    expect(lines(two, 1, false)).toEqual(['A: {45/120} × 360° = 135°', 'B: {75/120} × 360° = 225°']);
  });
  it('the sectors drawn are the sectors computed (one polygon each, in their colours)', () => {
    const polys = sc.items.filter((it) => it.kind === 'poly' && /^sc/.test(it.id));
    expect(polys.length).toBe(3);
    polys.forEach((it, i) => expect((it.color as unknown as { init: string }).init).toBe(PIE_COLORS[i]));
  });
});

describe('validation', () => {
  const ok = (p: PiePlan) => validatePlan('pie-chart', p, RD);
  it('the samples are valid', () => { for (const p of ALL) expect(ok(p)).toEqual([]); });
  it('data', () => {
    expect(pieProblem(full([10]), 'p')).toMatch(/2 to 6 whole numbers/);
    expect(pieProblem(full([1, 2, 3, 4, 5, 6, 7]), 'p')).toMatch(/2 to 6 whole numbers/);
    expect(pieProblem(full([10.5, 20]), 'p')).toMatch(/whole numbers/);
    expect(pieProblem(full([30, 50, 41]), 'p')).toMatch(/not a whole number/);
    expect(pieProblem(full([1, 59]), 'p')).toMatch(/below 15°/);
    expect(pieProblem(full([500, 600]), 'p')).toMatch(/at most 1000/);
    expect(pieProblem(full([30, 90], ['A']), 'p')).toMatch(/one name for each/);
    expect(pieProblem(full([30, 90], ['A', 'A']), 'p')).toMatch(/all be different/);
    expect(pieProblem(full([30, 90], ['A', 'Averyverylongname']), 'p')).toMatch(/1 to 10 characters/);
    expect(pieProblem(full([30, 90], ['A', 'B']), 'p')).toBeNull();
  });
  it('steps', () => {
    const st = (ops: string[]) => ops.map((op) => ({ op, say }) as PiePlan['steps'][number]);
    expect(ok({ values: [30, 90], steps: st(['angle']) }).join()).toMatch(/needs \{"op":"show"\}/);
    expect(ok({ values: [30, 90], steps: st(['show', 'percent']) }).join()).toMatch(/needs "angle"/);
    expect(ok({ values: [30, 90], steps: st(['show', 'check']) }).join()).toMatch(/needs "angle"/);
    expect(ok({ values: [30, 90], steps: st(['show', 'angle', 'angle']) }).join()).toMatch(/only once/);
    expect(ok({ values: [30, 90], steps: st(['show', 'bars']) }).join()).toMatch(/not one of/);
    expect(ok({ values: [30, 90], steps: [{ op: 'show', say: { en: '', ml: '' } }] }).join()).toMatch(/say is required/);
    expect(ok({ values: [30, 90], steps: st(['show', 'angle']) })).toEqual([]);
  });
});

describe('selection', () => {
  const pick = (text: string, kind: BookBlock['kind'] = 'prose') => selectDna(block(text, kind)).dna;
  it('pie talk → pie-chart', () => {
    expect(pick('Draw a pie chart for the data given in the table.', 'exercise')).toBe('pie-chart');
    expect(pick('A pie diagram shows how the whole is divided into sectors.')).toBe('pie-chart');
    expect(pick('The circle graph shows the favourite sports of 120 students.')).toBe('pie-chart');
  });
  it('the same words elsewhere stay elsewhere', () => {
    expect(pick('Draw a bar graph for the data given in the table.', 'exercise')).not.toBe('pie-chart');
    expect(pick('The angle at the centre of a circle is twice the angle at the circumference.')).toBe('angle-geometry');
    expect(pick('Find 12% of 250.', 'exercise')).toBe('ratio-percent');
    expect(pick('The volume of a cylinder is π r² h.')).toBe('solid-figure');
    expect(pick('Find the area of a circle of radius 5 cm.', 'exercise')).not.toBe('pie-chart');
  });
});

describe('offline planner', () => {
  it('reads Name value pairs', () => {
    const p = offlinePie('Draw a pie chart for: Football 30, Cricket 50, Tennis 40.')!;
    expect(p).toMatchObject({ labels: ['Football', 'Cricket', 'Tennis'], values: [30, 50, 40] });
    expect(p.steps.map((x) => x.op)).toEqual(['show', 'total', 'angle', 'check']);
    expect(validatePlan('pie-chart', p, RD)).toEqual([]);
    const q = offlinePie('Draw a pie chart and give the percentages: Rice 12, Wheat 9, Maize 15.')!;
    expect(q.steps.map((x) => x.op)).toContain('percent');
    expect(validatePlan('pie-chart', q, RD)).toEqual([]);
  });
  it('null when the data does not give whole degrees', () => {
    expect(offlinePie('A pie chart: Football 30, Cricket 51.')).toBeNull();
    expect(offlinePie('A pie chart shows data.')).toBeNull();
    expect(offlinePie('Football 30.')).toBeNull();
  });
  it('falls back with a warning without data', () => {
    const pl = offlinePlan(block('A pie chart shows the parts of a whole.'), '', '');
    expect(pl.dna).toBe('concept-board');
    expect(pl.warnings?.join()).toMatch(/AI planner needed/);
    expect(offlinePlan(block('Draw a pie chart: Football 30, Cricket 50, Tennis 40.', 'exercise'), '', '').dna).toBe('pie-chart');
  });
});

describe('picture and class', () => {
  it('samples are real pictures', () => {
    for (const teach of ALL) {
      expect(textOnlyWarning({ dna: 'pie-chart', teach })).toBeUndefined();
      expect(visualStats(buildDnaScenes('pie-chart', teach, 'en', 'T')).graphics).toBeGreaterThanOrEqual(4);
    }
  });
  it('compiles into a class with one caption per step', () => {
    for (const teach of ALL) {
      const plan: BlockPlan = { blockId: 'b', dna: 'pie-chart', read: RD, teach, source: 'fixture' };
      const segs = compileClass([block('Pie chart.')], new Map([['b', plan]]), { title: 'T' });
      for (const seg of segs.filter((x) => x.phase === 'teach')) expect(segmentReel(seg).parts[0].captions.length).toBe(teach.steps.length + (teach.title ? 1 : 0));
    }
  });
  it('draws without error in every format and theme', () => {
    const noop = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? (x: string) => ({ width: x.length * 10 }) : () => undefined), set: () => true }) as unknown as CanvasRenderingContext2D;
    for (const teach of ALL) {
      const sc = buildDnaScenes('pie-chart', teach, 'ml', 'T')[0];
      for (const format of ['landscape', 'vertical', 'square'] as const) for (const theme of ['light', 'dark'] as const) for (const f of [0.1, 0.4, 0.7, 0.99]) drawMotionFrame(noop, sc, sc.durationMs * f, { format, theme } as never);
    }
  });
  it('nothing overlaps or leaves its area (every step, many splits)', { timeout: 120000 }, () => {
    const cases = [...ALL, ...CASES.filter((_, i) => i % 12 === 0)];
    for (const teach of cases) {
      const sc = buildDnaScenes('pie-chart', teach, 'en', 'T')[0];
      for (let k = 0; k < sc.captions.length; k++) {
        const time = sc.captions[k].t1 - 40;
        const st = sc.items.filter((it) => it.kind === 'text').map((it) => evalItem(it, time)).filter((s) => s.alpha > 0.5).map((q) => {
          const w = tokenWidth(q.text, q.size);
          return { q, l: q.x - w / 2, r: q.x + w / 2 };
        });
        const tag = `${teach.values}`;
        for (const b of st) {
          expect(b.l, `${tag} ${b.q.text}`).toBeGreaterThan(2);
          expect(b.r, `${tag} ${b.q.text}`).toBeLessThan(718);
          if (b.l > CPX - 4) expect(b.r, `${tag} ${b.q.text}`).toBeLessThanOrEqual(CPX + CPMAX + 1);
          else expect(b.r, `${tag} ${b.q.text}`).toBeLessThan(CPX - 4);
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
    const en = buildDnaScenes('pie-chart', PIE_SUBJECT_SAMPLE, 'en', 'T')[0];
    const ml = buildDnaScenes('pie-chart', PIE_SUBJECT_SAMPLE, 'ml', 'T')[0];
    expect(ml.items.map((it) => `${it.id}:${it.kind}:${it.text}`)).toEqual(en.items.map((it) => `${it.id}:${it.kind}:${it.text}`));
    expect(ml.captions.map((x) => x.text)).not.toEqual(en.captions.map((x) => x.text));
  });
  it('builds and validates every case', { timeout: 120000 }, () => {
    for (const p of CASES.filter((_, i) => i % 6 === 0)) {
      expect(validatePlan('pie-chart', p, RD), `${p.values}`).toEqual([]);
      expect(() => buildDnaScenes('pie-chart', p, 'en', 'T')).not.toThrow();
    }
  });
});
