import { describe, expect, it } from 'vitest';
import { drawMotionFrame, evalItem, type MotionScene } from '../reels/motion';
import { tokenWidth } from '../reels/motion/metrics';
import { selectDna } from './dna/registry';
import { buildDnaScenes } from './dna/builders';
import { RPX, RPMAX } from './dna/rp-builders';
import { BAR, RATIO_OPS, fmtNum, ratioFacts, ratioGeometry, ratioProblem, withUnit } from './dna/rp-math';
import type { BlockPlan, RatioPlan } from './dna/types';
import type { BookBlock } from './segment';
import { validatePlan } from './plan/validate';
import { offlinePlan, offlineRatio } from './plan/offline';
import { textOnlyWarning, visualStats } from './plan/visual-qa';
import { compileClass, segmentReel } from './class';
import { PERCENT_DOWN_SAMPLE, PERCENT_SAMPLE, PERCENT_UP_SAMPLE, RATIO_SHARE3_SAMPLE, RATIO_SHARE_SAMPLE } from './samples/ratio-percent';

const block = (text: string, kind: BookBlock['kind'] = 'prose'): BookBlock => ({ id: 'b', kind, page: 1, chapterId: 'c', sectionId: 's', lines: [{ text, math: false } as BookBlock['lines'][number]], text });
const say = { en: 'x', ml: 'എ' };
const RD = { en: 'x', ml: 'എ' };
const ALL = [RATIO_SHARE_SAMPLE, RATIO_SHARE3_SAMPLE, PERCENT_SAMPLE, PERCENT_UP_SAMPLE, PERCENT_DOWN_SAMPLE];
const full = (p: Omit<RatioPlan, 'steps'>): RatioPlan => ({ ...p, steps: RATIO_OPS[p.kind].map((op) => ({ op, say }) as RatioPlan['steps'][number]) });

const SHARES: RatioPlan[] = [];
for (let a = 1; a <= 9; a++) for (let b = 1; b <= 9; b++) {
  for (const c of [0, 1, 4, 9]) {
    const parts = c ? [a, b, c] : [a, b];
    const sum = parts.reduce((x, y) => x + y, 0);
    if (sum > 20) continue;
    for (const k of [1, 7, 25]) SHARES.push(full({ kind: 'share', parts, total: sum * k }));
  }
}
const PERCENTS: RatioPlan[] = [];
for (const whole of [10, 40, 45, 120, 250, 400, 999, 2000, 5000]) for (let pct = 1; pct <= 100; pct++) {
  if ((whole * pct) % 100) continue;
  PERCENTS.push(full({ kind: 'percent', whole, pct }));
  PERCENTS.push(full({ kind: 'change', whole, pct, dir: 'up' }));
  if (pct <= 90) PERCENTS.push(full({ kind: 'change', whole, pct, dir: 'down' }));
}

describe('numbers', () => {
  it('formats', () => {
    expect(fmtNum(30)).toBe('30');
    expect(fmtNum(4.5)).toBe('4.5');
    expect(fmtNum(12.25)).toBe('12.25');
    expect(withUnit(240, 'Rs')).toBe('Rs 240');
    expect(withUnit(30, 'kg')).toBe('30 kg');
    expect(withUnit(30)).toBe('30');
  });
  it('sharing: every share is whole, in the ratio, and they add up', () => {
    expect(SHARES.length).toBeGreaterThan(500);
    for (const p of SHARES) {
      const f = ratioFacts(p);
      expect(Number.isInteger(f.unitValue)).toBe(true);
      expect(f.partValues.reduce((a, b) => a + b, 0)).toBe(p.total);
      p.parts!.forEach((x, i) => expect(f.partValues[i] * f.sum).toBe(x * p.total!)); // share / total = part / sum, exactly
    }
  });
  it('percent: p% of the whole, a tenth, change up and down', () => {
    expect(PERCENTS.length).toBeGreaterThan(500);
    for (const p of PERCENTS) {
      const f = ratioFacts(p);
      expect(f.amount * 100, `${p.whole} ${p.pct}`).toBe(p.whole! * p.pct!);
      expect(f.tenth * 10).toBeCloseTo(p.whole!, 9);
      if (p.kind === 'percent') expect(f.result).toBe(f.amount);
      if (p.dir === 'up') expect(f.result * 100).toBe(p.whole! * (100 + p.pct!));
      if (p.dir === 'down') expect(f.result * 100).toBe(p.whole! * (100 - p.pct!));
    }
  });
});

describe('the bars follow the numbers', () => {
  it('share: one block per part, groups in proportion, no gaps', () => {
    for (const p of SHARES) {
      const g = ratioGeometry(p);
      const sum = p.parts!.reduce((a, b) => a + b, 0);
      expect(g.blocks.length).toBe(sum);
      expect(g.groups.length).toBe(p.parts!.length);
      let x = BAR.x0;
      g.groups.forEach((gr, i) => {
        expect(gr.x0).toBeCloseTo(x, 9);
        expect((gr.x1 - gr.x0) / BAR.w).toBeCloseTo(p.parts![i] / sum, 9);
        x = gr.x1;
      });
      expect(x).toBeCloseTo(BAR.x0 + BAR.w, 9);
      g.blocks.forEach((b) => expect(b.x1 - b.x0).toBeCloseTo(BAR.w / sum, 9));
    }
  });
  it('percent: the shaded part is p% of the bar; the ten blocks fill it', () => {
    for (const p of PERCENTS.filter((x) => x.kind === 'percent')) {
      const g = ratioGeometry(p);
      expect((g.fill!.x1 - g.fill!.x0) / BAR.w).toBeCloseTo(p.pct! / 100, 9);
      expect(g.blocks.length).toBe(10);
      expect(g.blocks[9].x1).toBeCloseTo(BAR.x0 + BAR.w, 9);
    }
  });
  it('change: the extra or removed piece is p% of the original bar and stays on the board', () => {
    for (const p of PERCENTS.filter((x) => x.kind === 'change')) {
      const g = ratioGeometry(p);
      const orig = g.x100 - BAR.x0;
      expect((g.fill!.x1 - g.fill!.x0) / orig, `${p.pct} ${p.dir}`).toBeCloseTo(p.pct! / 100, 9);
      expect(g.xEnd).toBeLessThanOrEqual(BAR.x0 + BAR.w + 1e-9);
      if (p.dir === 'up') { expect(g.fill!.x0).toBeCloseTo(g.x100, 9); expect(g.xEnd - BAR.x0).toBeCloseTo((orig * (100 + p.pct!)) / 100, 9); }
      else { expect(g.fill!.x1).toBeCloseTo(g.x100, 9); expect(g.fill!.x0 - BAR.x0).toBeCloseTo((orig * (100 - p.pct!)) / 100, 9); }
    }
  });
});

describe('what is written', () => {
  const lines = (sc: MotionScene, k: number, title: boolean): string[] => {
    const time = sc.captions[k + (title ? 1 : 0)].t1 - 40;
    const vis = sc.items.filter((it) => it.kind === 'text').map((it) => evalItem(it, time)).filter((st) => st.alpha > 0.5 && st.x >= RPX - 4);
    const rows = new Map<number, Array<{ x: number; text: string }>>();
    for (const v of vis) { const key = Math.round(v.y); rows.set(key, [...(rows.get(key) ?? []), { x: v.x, text: v.text }]); }
    return [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, r]) => r.sort((a, b) => a.x - b.x).map((q) => q.text).join(' '));
  };
  const texts = (sc: MotionScene, k: number, title: boolean): string[] => {
    const time = sc.captions[k + (title ? 1 : 0)].t1 - 40;
    return sc.items.filter((it) => it.kind === 'text').map((it) => evalItem(it, time)).filter((st) => st.alpha > 0.5 && st.x < RPX - 4).map((q) => q.text);
  };
  const b = (p: RatioPlan) => buildDnaScenes('ratio-percent', p, 'en', 'T')[0];
  it('sharing 240 in 3 : 5', () => {
    const sc = b(RATIO_SHARE_SAMPLE);
    expect(lines(sc, 0, true)).toEqual(['A : B = 3 : 5', 'Total = Rs 240']);
    expect(texts(sc, 0, true)).toEqual(expect.arrayContaining(['Rs 240', 'A', 'B']));
    expect(lines(sc, 1, true)).toEqual(['3 + 5 = 8 parts', '1 part = Rs 240 ÷ 8', '= Rs 30']);
    expect(texts(sc, 1, true).filter((x) => x === '30').length).toBe(8);
    expect(lines(sc, 2, true)).toEqual(['A = 3 × 30 = Rs 90', 'B = 5 × 30 = Rs 150']);
    expect(texts(sc, 2, true)).toEqual(expect.arrayContaining(['90', '150']));
    expect(texts(sc, 2, true)).not.toContain('A');
    expect(lines(sc, 3, true)).toEqual(['90 + 150 = Rs 240']);
    expect(sc.items.some((it) => it.kind === 'tick')).toBe(true);
  });
  it('sharing 180 in 2 : 3 : 4', () => {
    const sc = b(RATIO_SHARE3_SAMPLE);
    expect(lines(sc, 2, false)).toEqual(['A = 2 × 20 = 40', 'B = 3 × 20 = 60', 'C = 4 × 20 = 80']);
    expect(lines(sc, 3, false)).toEqual(['40 + 60 + 80 = 180']);
  });
  it('12% of 250', () => {
    const sc = b(PERCENT_SAMPLE);
    expect(lines(sc, 0, false)).toEqual(['100% = 250', 'Find 12%']);
    expect(lines(sc, 1, false)).toEqual(['100% = 10 blocks', '10% = 250 ÷ 10', '= 25']);
    expect(texts(sc, 1, false).filter((x) => x === '25').length).toBe(10);
    expect(texts(sc, 1, false)).toEqual(expect.arrayContaining(['10%', '50%', '90%']));
    expect(lines(sc, 2, false)).toEqual(['12% of 250', '= {12/100} × 250', '= 30']);
    expect(texts(sc, 2, false)).toContain('12%');
    expect(texts(sc, 3, false)).toContain('30');
    expect(texts(sc, 3, false)).not.toContain('12%');
    expect(lines(sc, 3, false)).toEqual(['12% of 250 = 30']);
  });
  it('increase and decrease', () => {
    const up = b(PERCENT_UP_SAMPLE);
    expect(lines(up, 1, false)).toEqual(['20% of 250', '= {20/100} × 250', '= Rs 50']);
    expect(texts(up, 1, false)).toEqual(expect.arrayContaining(['+50', '20%']));
    expect(lines(up, 2, false)).toEqual(['250 + 50 = Rs 300', 'That is 120% of 250']);
    expect(texts(up, 2, false)).toContain('Rs 300');
    const down = b(PERCENT_DOWN_SAMPLE);
    expect(texts(down, 1, false)).toContain('−60');
    expect(lines(down, 2, false)).toEqual(['400 − 60 = Rs 340', 'That is 85% of 400']);
  });
});

describe('validation', () => {
  const ok = (p: RatioPlan) => validatePlan('ratio-percent', p, RD);
  it('the samples are valid', () => {
    for (const p of ALL) expect(ok(p)).toEqual([]);
  });
  it('numbers', () => {
    expect(ratioProblem(full({ kind: 'share', parts: [3], total: 24 }), 'p')).toMatch(/2 or 3 whole numbers/);
    expect(ratioProblem(full({ kind: 'share', parts: [3, 10], total: 26 }), 'p')).toMatch(/2 or 3 whole numbers/);
    expect(ratioProblem(full({ kind: 'share', parts: [9, 9, 9], total: 270 }), 'p')).toMatch(/at most 20/);
    expect(ratioProblem(full({ kind: 'share', parts: [3, 5], total: 100 }), 'p')).toMatch(/multiple of 8/);
    expect(ratioProblem(full({ kind: 'share', parts: [3, 5], total: 6000 }), 'p')).toMatch(/to 5000/);
    expect(ratioProblem(full({ kind: 'percent', whole: 250, pct: 7 }), 'p')).toMatch(/not a whole number/);
    expect(ratioProblem(full({ kind: 'percent', whole: 5, pct: 20 }), 'p')).toMatch(/from 10 to 5000/);
    expect(ratioProblem(full({ kind: 'percent', whole: 250, pct: 120 }), 'p')).toMatch(/from 1 to 100/);
    expect(ratioProblem(full({ kind: 'change', whole: 250, pct: 100, dir: 'down' }), 'p')).toMatch(/from 1 to 90/);
    expect(ratioProblem(full({ kind: 'change', whole: 250, pct: 20 }), 'p')).toMatch(/dir/);
    expect(ratioProblem(full({ kind: 'percent', whole: 250, pct: 20, unit: '$' as 'Rs' }), 'p')).toMatch(/unit/);
    expect(ratioProblem({ kind: 'ratio' as 'share', steps: [] }, 'p')).toMatch(/kind must be/);
  });
  it('steps', () => {
    const sh: Omit<RatioPlan, 'steps'> = { kind: 'share', parts: [3, 5], total: 240 };
    const st = (ops: string[]) => ops.map((op) => ({ op, say }) as RatioPlan['steps'][number]);
    expect(ok({ ...sh, steps: st(['unit']) }).join()).toMatch(/needs \{"op":"show"\}/);
    expect(ok({ ...sh, steps: st(['show', 'parts']) }).join()).toMatch(/needs "unit"/);
    expect(ok({ ...sh, steps: st(['show', 'unit', 'check']) }).join()).toMatch(/needs "parts"/);
    expect(ok({ ...sh, steps: st(['show', 'unit', 'unit']) }).join()).toMatch(/only once/);
    expect(ok({ ...sh, steps: st(['show', 'tenth']) }).join()).toMatch(/not one of show, unit, parts, check/);
    const pc: Omit<RatioPlan, 'steps'> = { kind: 'percent', whole: 250, pct: 12 };
    expect(ok({ ...pc, steps: st(['show', 'result']) }).join()).toMatch(/needs "part"/);
    expect(ok({ ...pc, steps: st(['show', 'part', 'tenth']) }).join()).toMatch(/"tenth" must come before "part"/);
    expect(ok({ ...pc, steps: st(['show', 'part', 'result']) })).toEqual([]);
    const ch: Omit<RatioPlan, 'steps'> = { kind: 'change', whole: 250, pct: 20, dir: 'up' };
    expect(ok({ ...ch, steps: st(['show', 'result']) }).join()).toMatch(/needs "change"/);
    expect(ok({ ...ch, steps: [{ op: 'show', say: { en: '', ml: '' } }] }).join()).toMatch(/say is required/);
  });
});

describe('selection', () => {
  const pick = (text: string, kind: BookBlock['kind'] = 'prose') => selectDna(block(text, kind)).dna;
  it('ratio and percent talk → ratio-percent', () => {
    expect(pick('Share Rs 240 between Anu and Binu in the ratio 3 : 5.', 'exercise')).toBe('ratio-percent');
    expect(pick('Find 12% of 250.', 'exercise')).toBe('ratio-percent');
    expect(pick('The price of a shirt is increased by 20%. What is the new price?', 'problem')).toBe('ratio-percent');
    expect(pick('A discount of 15 percent is given on a shirt costing Rs 400.', 'problem')).toBe('ratio-percent');
    expect(pick('Percentage means out of one hundred.')).toBe('ratio-percent');
    expect(pick('The money is divided in the ratio 2 : 3 : 4.')).toBe('ratio-percent');
  });
  it('the same words elsewhere stay elsewhere', () => {
    expect(pick('The sine of 30° is 1/2 and the cosine is √3/2.')).toBe('unit-circle');
    expect(pick('The common ratio of a geometric sequence is 2.')).not.toBe('ratio-percent');
    expect(pick('The sum of the angles of a triangle is 180°.')).toBe('angle-geometry');
    expect(pick('The volume of a cylinder is π r² h.')).toBe('solid-figure');
    expect(pick('Solve x² − 5x + 6 = 0 by factorising.', 'exercise')).toBe('quadratic-equation');
    expect(pick('In a 30-60-90 triangle the sides are in the ratio 1 : √3 : 2.')).not.toBe('ratio-percent');
    expect(pick('The probability of heads is 50%.')).not.toBe('ratio-percent');
    expect(pick('Find the area of a circle of radius 5 cm.', 'exercise')).not.toBe('ratio-percent');
  });
});

describe('offline planner', () => {
  it('sharing', () => {
    const p = offlineRatio('Share Rs 240 between Anu and Binu in the ratio 3 : 5.')!;
    expect(p).toMatchObject({ kind: 'share', parts: [3, 5], total: 240, unit: 'Rs' });
    expect(p.steps.map((x) => x.op)).toEqual(['show', 'unit', 'parts', 'check']);
    expect(validatePlan('ratio-percent', p, RD)).toEqual([]);
    expect(offlineRatio('Divide 180 in the ratio 2 : 3 : 4.')).toMatchObject({ parts: [2, 3, 4], total: 180 });
    expect(offlineRatio('Share 100 in the ratio 3 : 5.')).toBeNull();
  });
  it('percent of, increase, decrease', () => {
    const a = offlineRatio('Find 12% of 250.')!;
    expect(a).toMatchObject({ kind: 'percent', whole: 250, pct: 12 });
    expect(validatePlan('ratio-percent', a, RD)).toEqual([]);
    const b = offlineRatio('The price Rs 250 is increased by 20%.')!;
    expect(b).toMatchObject({ kind: 'change', dir: 'up', whole: 250, pct: 20, unit: 'Rs' });
    expect(validatePlan('ratio-percent', b, RD)).toEqual([]);
    const c = offlineRatio('A shirt costs Rs 400. A discount of 15% is given.')!;
    expect(c).toMatchObject({ kind: 'change', dir: 'down', whole: 400, pct: 15 });
    expect(validatePlan('ratio-percent', c, RD)).toEqual([]);
    expect(offlineRatio('Find 7% of 250.')).toBeNull();
    expect(offlineRatio('Percentages are out of 100.')).toBeNull();
  });
  it('falls back with a warning when the numbers are missing', () => {
    const pl = offlinePlan(block('Percentages are everywhere: shops give a discount in percent.'), '', '');
    expect(pl.dna).toBe('concept-board');
    expect(pl.warnings?.join()).toMatch(/AI planner needed/);
    expect(offlinePlan(block('Find 12% of 250.', 'exercise'), '', '').dna).toBe('ratio-percent');
  });
});

describe('picture and class', () => {
  it('samples are real pictures', () => {
    for (const teach of ALL) {
      expect(textOnlyWarning({ dna: 'ratio-percent', teach })).toBeUndefined();
      expect(visualStats(buildDnaScenes('ratio-percent', teach, 'en', 'T')).graphics).toBeGreaterThanOrEqual(5);
    }
  });
  it('compiles into a class with one caption per step', () => {
    for (const teach of ALL) {
      const plan: BlockPlan = { blockId: 'b', dna: 'ratio-percent', read: RD, teach, source: 'fixture' };
      const segs = compileClass([block('Ratio and percent.')], new Map([['b', plan]]), { title: 'T' });
      for (const seg of segs.filter((x) => x.phase === 'teach')) expect(segmentReel(seg).parts[0].captions.length).toBe(teach.steps.length + (teach.title ? 1 : 0));
    }
  });
  it('draws without error in every format and theme', () => {
    const noop = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? (x: string) => ({ width: x.length * 10 }) : () => undefined), set: () => true }) as unknown as CanvasRenderingContext2D;
    for (const teach of ALL) {
      const sc = buildDnaScenes('ratio-percent', teach, 'ml', 'T')[0];
      for (const format of ['landscape', 'vertical', 'square'] as const) for (const theme of ['light', 'dark'] as const) for (const f of [0.1, 0.4, 0.7, 0.99]) drawMotionFrame(noop, sc, sc.durationMs * f, { format, theme } as never);
    }
  });
  it('nothing overlaps or leaves its area (every step of every case)', { timeout: 120000 }, () => {
    const cases = [...ALL, ...SHARES.filter((_, i) => i % 40 === 0), ...PERCENTS.filter((_, i) => i % 25 === 0)];
    for (const teach of cases) {
      const sc = buildDnaScenes('ratio-percent', teach, 'en', 'T')[0];
      for (let k = 0; k < sc.captions.length; k++) {
        const time = sc.captions[k].t1 - 40;
        const st = sc.items.filter((it) => it.kind === 'text').map((it) => evalItem(it, time)).filter((s) => s.alpha > 0.5).map((q) => {
          const w = tokenWidth(q.text, q.size);
          return { q, l: q.x - w / 2, r: q.x + w / 2 };
        });
        const tag = `${teach.kind} ${JSON.stringify(teach.parts ?? [teach.whole, teach.pct, teach.dir])}`;
        for (const b of st) {
          expect(b.l, `${tag} ${b.q.text}`).toBeGreaterThan(2);
          expect(b.r, `${tag} ${b.q.text}`).toBeLessThan(718);
          if (b.l > RPX - 4) expect(b.r, `${tag} ${b.q.text}`).toBeLessThanOrEqual(RPX + RPMAX + 1);
          else expect(b.r, `${tag} ${b.q.text}`).toBeLessThan(RPX - 4);
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
    const en = buildDnaScenes('ratio-percent', RATIO_SHARE_SAMPLE, 'en', 'T')[0];
    const ml = buildDnaScenes('ratio-percent', RATIO_SHARE_SAMPLE, 'ml', 'T')[0];
    expect(ml.items.map((it) => `${it.id}:${it.kind}:${it.text}`)).toEqual(en.items.map((it) => `${it.id}:${it.kind}:${it.text}`));
    expect(ml.captions.map((x) => x.text)).not.toEqual(en.captions.map((x) => x.text));
  });
  it('builds and validates every case', { timeout: 120000 }, () => {
    for (const p of [...SHARES.filter((_, i) => i % 7 === 0), ...PERCENTS.filter((_, i) => i % 5 === 0)]) {
      expect(validatePlan('ratio-percent', p, RD), JSON.stringify(p)).toEqual([]);
      expect(() => buildDnaScenes('ratio-percent', p, 'en', 'T')).not.toThrow();
    }
  });
});
