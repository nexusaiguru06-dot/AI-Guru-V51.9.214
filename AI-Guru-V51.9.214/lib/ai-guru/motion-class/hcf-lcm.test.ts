import { describe, expect, it } from 'vitest';
import { drawMotionFrame, evalItem } from '../reels/motion';
import { tokenWidth } from '../reels/motion/metrics';
import { parseMath } from '../reels/motion/typeset';
import { selectDna } from './dna/registry';
import { buildDnaScenes } from './dna/builders';
import { HL_MAX, HL_PITCH, HL_TILE, gcd, hlColumns, hlLines, hlProblem, hlSplit, hlX, lcmOf, primeFactors } from './dna/hl-math';
import type { BlockPlan, HlPlan } from './dna/types';
import type { BookBlock } from './segment';
import { validatePlan } from './plan/validate';
import { offlineHclm, offlinePlan } from './plan/offline';
import { HL_SAMPLES, HL_SAMPLE_12_18, HL_SAMPLE_COPRIME } from './samples/hcf-lcm';

const block = (text: string, kind: BookBlock['kind'] = 'prose'): BookBlock => ({ id: 'b', kind, page: 1, chapterId: 'c', sectionId: 's', lines: [{ text, math: false } as BookBlock['lines'][number]], text });
const RD = { en: 'x', ml: 'എ' };
const noop = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? (x: string) => ({ width: x.length * 10 }) : () => undefined), set: () => true }) as unknown as CanvasRenderingContext2D;
const PAIRS: Array<[number, number]> = [];
for (let a = 2; a <= HL_MAX; a += 3) for (let b = a + 1; b <= HL_MAX; b += 7) PAIRS.push([a, b]);

describe('the numbers are true', () => {
  it('there are plenty of pairs', () => expect(PAIRS.length).toBeGreaterThan(300));
  it('prime factors multiply back and are prime', () => {
    for (let n = 2; n <= HL_MAX; n++) {
      const f = primeFactors(n);
      expect(f.reduce((p, x) => p * x, 1)).toBe(n);
      for (const p of f) expect(primeFactors(p)).toEqual([p]);
      expect([...f].sort((x, y) => x - y)).toEqual(f);
    }
  });
  it('HCF and LCM from the tiles equal the true values, and HCF × LCM = a × b', () => {
    for (const [a, b] of PAIRS) {
      const s = hlSplit(a, b);
      expect(s.hcf).toBe(gcd(a, b));
      expect(s.lcm).toBe(lcmOf(a, b));
      expect(s.hcf * s.lcm).toBe(a * b);
      expect(s.shared.length + s.aOnly.length).toBe(s.fa.length);
      expect(s.shared.length + s.bOnly.length).toBe(s.fb.length);
    }
  });
  it('the lines say the same numbers', () => {
    for (const [a, b] of PAIRS) {
      const L = hlLines(a, b);
      expect(L.texHcf).toMatch(new RegExp(`= ${L.hcf}$`));
      if (L.shared.length > 1) expect(L.texHcf).toContain(`= ${L.hcf}`);
      expect(L.texCheck).toBe(`${L.hcf} \\times ${L.lcm} = ${a * b} = ${a} \\times ${b}`);
      for (const f of [L.texA, L.texB, L.texHcf, L.texLcm, L.texCheck]) expect(() => parseMath(f), f).not.toThrow();
    }
  });
});

describe('the columns', () => {
  it('shared tiles share a column in both rows, no two tiles of a row share one', () => {
    for (const [a, b] of PAIRS) {
      const s = hlSplit(a, b); const C = hlColumns(a, b);
      for (const cols of [C.alignA, C.alignB]) expect(new Set(cols).size).toBe(cols.length);
      for (let c = 0; c < C.k; c++) {
        const pa = s.fa[C.alignA.indexOf(c)]; const pb = s.fb[C.alignB.indexOf(c)];
        expect(pa).toBe(pb);
      }
      expect(C.ncols).toBeLessThanOrEqual(7);
      for (const col of [...C.alignA, ...C.alignB]) expect(col).toBeLessThan(C.ncols);
    }
  });
  it('every tile stays on the board', () => {
    for (let c = 0; c < 7; c++) { expect(hlX(c) - HL_TILE / 2).toBeGreaterThan(150); expect(hlX(c) + HL_TILE / 2).toBeLessThan(718); }
    expect(HL_PITCH).toBeGreaterThan(HL_TILE);
  });
});

describe('the plan', () => {
  const ok = (p: unknown) => validatePlan('hcf-lcm', p, RD);
  it('the samples are valid', () => { for (const p of Object.values(HL_SAMPLES)) expect(ok(p)).toEqual([]); });
  it('rejects bad numbers, order, repeats and missing captions', () => {
    const s = HL_SAMPLE_12_18;
    expect(ok({ ...s, a: 1 }).length).toBeGreaterThan(0);
    expect(ok({ ...s, b: 121 }).length).toBeGreaterThan(0);
    expect(ok({ ...s, a: 18, b: 12 }).length).toBeGreaterThan(0);
    expect(ok({ ...s, a: 12, b: 12 }).length).toBeGreaterThan(0);
    expect(ok({ ...s, a: 12.5 }).length).toBeGreaterThan(0);
    expect(ok({ ...s, steps: [...s.steps].reverse() }).length).toBeGreaterThan(0);
    expect(ok({ ...s, steps: s.steps.slice(0, 3) }).length).toBeGreaterThan(0);
    expect(ok({ ...s, steps: [...s.steps, s.steps[0]] }).length).toBeGreaterThan(0);
    expect(ok({ ...s, steps: s.steps.map((x) => ({ op: x.op })) }).length).toBeGreaterThan(0);
    expect(hlProblem({ ...s, steps: s.steps.filter((x) => x.op !== 'check') }, 'p')).toBeNull();
  });
});

describe('selection and the offline planner', () => {
  it('HCF/LCM text picks this DNA; fractions and others do not', () => {
    expect(selectDna(block('Find the HCF and LCM of 12 and 18.')).dna).toBe('hcf-lcm');
    expect(selectDna(block('The highest common factor of 36 and 48 is found by prime factorisation.')).dna).toBe('hcf-lcm');
    expect(selectDna(block('To add the fractions, find the LCM of the denominators.')).dna).not.toBe('hcf-lcm');
    expect(selectDna(block('Solve 2x + 5 = 25')).dna).not.toBe('hcf-lcm');
    expect(selectDna(block('Solve the quadratic equation x² − 5x + 6 = 0.')).dna).not.toBe('hcf-lcm');
  });
  it('takes the numbers from the text, smaller first, else 12 and 18', () => {
    expect(offlineHclm('HCF of 48 and 36')).toMatchObject({ a: 36, b: 48 });
    expect(offlineHclm('LCM of 8, 15')).toMatchObject({ a: 8, b: 15 });
    expect(offlineHclm('HCF of 7 and 7')).toMatchObject({ a: 12, b: 18 });
    expect(offlineHclm('HCF of 500 and 600')).toMatchObject({ a: 12, b: 18 });
    expect(offlineHclm('')).toMatchObject({ a: 12, b: 18 });
  });
  it('the offline plan validates', () => {
    const plan = offlinePlan(block('Find the HCF and LCM of 24 and 36.', 'problem'), 'Numbers', 'Sec') as BlockPlan;
    expect(plan.dna).toBe('hcf-lcm');
    expect(validatePlan('hcf-lcm', plan.teach, RD)).toEqual([]);
  });
});

describe('the scenes', () => {
  const PLANS: HlPlan[] = [...Object.values(HL_SAMPLES), offlineHclm('HCF of 64 and 96'), offlineHclm('HCF of 64 and 81'), offlineHclm('HCF of 90 and 120')];
  it('draw in every format and theme', () => {
    for (const p of PLANS) for (const lang of ['en', 'ml'] as const) {
      const sc = buildDnaScenes('hcf-lcm', p, lang, 'T')[0];
      expect(sc.captions.length).toBe(p.steps.length + 1);
      for (const format of ['landscape', 'vertical', 'square'] as const) for (const theme of ['light', 'dark'] as const) for (const f of [0.1, 0.4, 0.7, 0.99]) drawMotionFrame(noop, sc, sc.durationMs * f, { format, theme } as never);
    }
  });
  it('no text leaves the board or overlaps another at the end of any step', () => {
    for (const p of PLANS) {
      const sc = buildDnaScenes('hcf-lcm', p, 'en', 'T')[0];
      for (let k = 0; k < sc.captions.length; k++) {
        const time = sc.captions[k].t1 - 40;
        const st = sc.items.filter((it) => it.kind === 'text').map((it) => evalItem(it, time)).filter((s) => s.alpha > 0.6).map((q) => {
          const w = tokenWidth(q.text, q.size);
          return { q, l: q.x - w / 2, r: q.x + w / 2, t: q.y - q.size * 0.4, b: q.y + q.size * 0.4 };
        });
        for (const s of st) { expect(s.l, s.q.text).toBeGreaterThan(2); expect(s.r, s.q.text).toBeLessThan(718); expect(s.b).toBeLessThan(444); }
        for (let i = 0; i < st.length; i++) for (let j = i + 1; j < st.length; j++) {
          const ox = Math.min(st[i].r, st[j].r) - Math.max(st[i].l, st[j].l);
          const oy = Math.min(st[i].b, st[j].b) - Math.max(st[i].t, st[j].t);
          expect(ox > 0.5 && oy > 0.5, `${st[i].q.text} / ${st[j].q.text} at step ${k} (${p.a},${p.b})`).toBe(false);
        }
      }
    }
  });
  it('shared tiles end in the same column in both rows', () => {
    const sc = buildDnaScenes('hcf-lcm', HL_SAMPLE_12_18, 'en', 'T')[0];
    const end = sc.captions[4].t0 - 50;
    const polys = sc.items.filter((i) => i.kind === 'poly' && i.id.startsWith('ht')).map((i) => evalItem(i, end)).filter((s) => s.alpha > 0.5 && (s.points?.length ?? 0) === 4);
    const cx = polys.map((s) => Math.round(((s.points![0][0] + s.points![1][0]) / 2) * 10) / 10);
    const row = (s: (typeof polys)[number]) => (s.points![0][1] < 150 ? 'a' : 'b');
    const colsA = polys.filter((s) => row(s) === 'a').map((s) => (s.points![0][0] + s.points![1][0]) / 2).sort((x, y) => x - y);
    const colsB = polys.filter((s) => row(s) === 'b').map((s) => (s.points![0][0] + s.points![1][0]) / 2).sort((x, y) => x - y);
    expect(cx.length).toBe(6);
    expect(colsA[0]).toBeCloseTo(colsB[0], 3);
    expect(colsA[1]).toBeCloseTo(colsB[1], 3);
    expect(colsA[2]).toBeCloseTo(colsB[2], 3);
  });
  it('co-prime numbers have no joining lines and an HCF of 1', () => {
    const sc = buildDnaScenes('hcf-lcm', HL_SAMPLE_COPRIME, 'en', 'T')[0];
    expect(sc.items.filter((i) => i.id.startsWith('hj')).length).toBe(0);
    expect(hlLines(8, 15).texHcf).toBe('\\text{HCF} = 1');
  });
  it('English and Malayalam pictures are identical', () => {
    for (const p of PLANS) {
      const en = buildDnaScenes('hcf-lcm', p, 'en', 'T')[0];
      const ml = buildDnaScenes('hcf-lcm', p, 'ml', 'T')[0];
      const pic = (s: typeof en) => s.items.map((it) => `${it.id}:${it.kind}:${it.text}`);
      expect(pic(ml)).toEqual(pic(en));
      expect(ml.durationMs).toBe(en.durationMs);
    }
  });
});
