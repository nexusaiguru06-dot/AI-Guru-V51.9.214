import { describe, expect, it } from 'vitest';
import { drawMotionFrame, evalItem } from '../reels/motion';
import { tokenWidth } from '../reels/motion/metrics';
import { parseMath } from '../reels/motion/typeset';
import { selectDna } from './dna/registry';
import { buildDnaScenes } from './dna/builders';
import { QD_PIECES as P, QD_H, QD_S, QD_B_MAX, qdBendPts, qdBraces, qdLines, qdProblem, qdR, qdRoots } from './dna/qd-math';
import { QD_PW, QD_PX } from './dna/qd-builders';
import type { BlockPlan, QdPlan } from './dna/types';
import type { BookBlock } from './segment';
import { validatePlan } from './plan/validate';
import { offlinePlan, offlineQuadraticDerivation } from './plan/offline';
import { compileClass } from './class';
import { QD_SAMPLES, QD_SAMPLE_2_M8, QD_SAMPLE_6_5, QD_SAMPLE_8_12 } from './samples/quadratic-derivation';

const block = (text: string, kind: BookBlock['kind'] = 'prose'): BookBlock => ({ id: 'b', kind, page: 1, chapterId: 'c', sectionId: 's', lines: [{ text, math: false } as BookBlock['lines'][number]], text });
const RD = { en: 'x', ml: 'എ' };
const noop = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? (x: string) => ({ width: x.length * 10 }) : () => undefined), set: () => true }) as unknown as CanvasRenderingContext2D;
const CASES: Array<[number, number]> = [];
for (let b = 2; b <= QD_B_MAX; b += 2) for (let c = -80; c <= 80; c++) if (!qdProblem({ b, c, steps: [] } as unknown as QdPlan, 'p')?.includes('.b must') && qdR(b, c) >= 1 && qdR(b, c) <= 12) CASES.push([b, c]);
const area = (r: { x0: number; x1: number; y0: number; y1: number }) => (r.x1 - r.x0) * (r.y1 - r.y0);

describe('the numbers are true', () => {
  it('there are plenty of examples', () => expect(CASES.length).toBeGreaterThan(40));
  it('both roots satisfy x² + bx + c = 0 and match the formula', () => {
    for (const [b, c] of CASES) {
      const [x1, x2] = qdRoots(b, c);
      expect(x1 * x1 + b * x1 + c).toBe(0);
      expect(x2 * x2 + b * x2 + c).toBe(0);
      const d = b * b - 4 * c;
      expect(Math.sqrt(d)).toBe(2 * qdR(b, c));
      expect((-b + Math.sqrt(d)) / 2).toBe(x1);
      expect((-b - Math.sqrt(d)) / 2).toBe(x2);
      expect((b / 2) ** 2 - c).toBe(qdR(b, c) ** 2);
    }
  });
  it('every numeric line says what the algebra says', () => {
    for (const [b, c] of CASES) {
      const h = b / 2; const r = qdR(b, c); const { num } = qdLines(b, c);
      expect(num.moved).toContain(`= ${-c}`);
      expect(num.split).toContain(`2 \\cdot ${h}x`);
      expect(num.corner).toContain(`+ ${h * h} =`);
      expect(num.square).toBe(`(x + ${h})^{2} = ${r * r}`);
      expect(num.root).toBe(`x + ${h} = \\pm ${r}`);
      expect(num.roots).toBe(`x = ${qdRoots(b, c)[0]} \\text{ or } x = ${qdRoots(b, c)[1]}`);
      expect(num.formula2).toContain(`\\pm ${2 * r}}`);
      // the right-hand side of the corner line is (b/2)² − c
      const rhs = num.corner.split('=')[1].replace(/\s/g, '');
      expect(rhs).toBe(c >= 0 ? `${h * h}-${c}` : `${h * h}+${-c}`);
    }
  });
  it('every line parses', () => {
    for (const [b, c] of CASES) { const { sym, num } = qdLines(b, c); for (const f of [...Object.values(sym), ...Object.values(num)]) expect(() => parseMath(f), f).not.toThrow(); }
  });
});

describe('the picture is true', () => {
  it('the pieces fill the (x + b/2)² square exactly and do not overlap', () => {
    expect(area(P.square) + area(P.halfStay) + area(P.halfTo) + area(P.corner)).toBe(area(P.whole));
    expect(P.whole.x1 - P.whole.x0).toBe(QD_S + QD_H);
    expect(P.whole.y1 - P.whole.y0).toBe(QD_S + QD_H);
    expect(area(P.halfFrom)).toBe(area(P.halfTo));
    expect(area(P.strip)).toBe(area(P.halfStay) + area(P.halfFrom));
    expect(area(P.corner)).toBe(QD_H * QD_H);
    const rs = [P.square, P.halfStay, P.halfTo, P.corner];
    for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
      const ox = Math.min(rs[i].x1, rs[j].x1) - Math.max(rs[i].x0, rs[j].x0);
      const oy = Math.min(rs[i].y1, rs[j].y1) - Math.max(rs[i].y0, rs[j].y0);
      expect(ox > 0 && oy > 0).toBe(false);
    }
  });
  it('the turning half ends exactly on its place, with the same number of corners', () => {
    const { from, to } = qdBendPts();
    expect(from.length).toBe(to.length);
    const key = (ps: Array<[number, number]>) => ps.map((p) => p.join(',')).sort().join('|');
    const T = P.halfTo;
    expect(key(to)).toBe(key([[T.x0, T.y0], [T.x1, T.y0], [T.x1, T.y1], [T.x0, T.y1]]));
  });
  it('all braces stay on the board and left of the equations', () => {
    for (const br of Object.values(qdBraces())) {
      for (const [x, y] of br.pts) { expect(x).toBeGreaterThan(0); expect(x).toBeLessThan(720); expect(y).toBeGreaterThan(0); expect(y).toBeLessThan(444); }
      expect(br.at[0] - tokenWidth(br.text, br.size) / 2).toBeGreaterThan(2);
    }
    expect(P.whole.x1 + 46 + 30).toBeLessThan(QD_PX - QD_PW / 2 + 10);
  });
});

describe('the plan', () => {
  const ok = (p: unknown) => validatePlan('quadratic-derivation', p, RD);
  it('the samples are valid', () => { for (const p of Object.values(QD_SAMPLES)) expect(ok(p)).toEqual([]); });
  it('rejects wrong numbers and wrong step order', () => {
    const s = QD_SAMPLE_6_5;
    expect(ok({ ...s, b: 5 }).length).toBeGreaterThan(0);
    expect(ok({ ...s, c: 6 }).length).toBeGreaterThan(0); // 9 − 6 = 3 is not a square
    expect(ok({ ...s, b: 8, c: 16 }).length).toBeGreaterThan(0); // r = 0
    expect(ok({ ...s, steps: [...s.steps].reverse() }).length).toBeGreaterThan(0);
    expect(ok({ ...s, steps: s.steps.slice(0, 5) }).length).toBeGreaterThan(0);
    expect(ok({ ...s, steps: [...s.steps, s.steps[0]] }).length).toBeGreaterThan(0);
    expect(ok({ ...s, steps: s.steps.map((x) => ({ op: x.op })) }).length).toBeGreaterThan(0); // no captions
    expect(ok({ ...s, steps: s.steps.filter((x) => x.op !== 'formula') })).toEqual([]);
  });
});

describe('selection and the offline planner', () => {
  it('derivation text picks the derivation; numeric quadratics keep their lesson', () => {
    expect(selectDna(block('Where does the quadratic formula come from? We derive it by completing the square.')).dna).toBe('quadratic-derivation');
    expect(selectDna(block('Prove the quadratic formula by completing the square.', 'result')).dna).toBe('quadratic-derivation');
    expect(selectDna(block('Solve the quadratic equation x² − 5x + 6 = 0 using the discriminant.')).dna).toBe('quadratic-equation');
    expect(selectDna(block('Solve x² − 5x + 6 = 0 by completing the square.')).dna).toBe('quadratic-equation');
    expect(selectDna(block('The roots are given by x = (−b ± √(b² − 4ac)) / 2a.')).dna).toBe('typeset-chain');
  });
  it('uses the equation in the text when it has two whole roots, else the default', () => {
    expect(offlineQuadraticDerivation('Derive the formula using x² + 8x + 12 = 0.')).toMatchObject({ b: 8, c: 12 });
    expect(offlineQuadraticDerivation('x² + 2x − 8 = 0, derive the quadratic formula')).toMatchObject({ b: 2, c: -8 });
    expect(offlineQuadraticDerivation('x² + 3x + 1 = 0')).toMatchObject({ b: 6, c: 5 });
    expect(offlineQuadraticDerivation('')).toMatchObject({ b: 6, c: 5 });
  });
  it('the offline plan validates and compiles into a class', () => {
    const plan = offlinePlan(block('Derive the quadratic formula by completing the square.', 'result'), 'Quadratic', 'Sec') as BlockPlan;
    expect(plan.dna).toBe('quadratic-derivation');
    expect(validatePlan('quadratic-derivation', plan.teach, RD)).toEqual([]);
    expect(compileClass).toBeTypeOf('function');
  });
});

describe('the scenes', () => {
  it('draw in every format and theme', () => {
    for (const p of [QD_SAMPLE_6_5, QD_SAMPLE_8_12, QD_SAMPLE_2_M8]) for (const lang of ['en', 'ml'] as const) {
      const sc = buildDnaScenes('quadratic-derivation', p, lang, 'T')[0];
      expect(sc.captions.length).toBe(p.steps.length + 1);
      for (const format of ['landscape', 'vertical', 'square'] as const) for (const theme of ['light', 'dark'] as const) for (const f of [0.1, 0.4, 0.7, 0.99]) drawMotionFrame(noop, sc, sc.durationMs * f, { format, theme } as never);
    }
  });
  it('nothing visible leaves the board, and no two texts overlap, at the end of any step', () => {
    for (const p of Object.values(QD_SAMPLES)) {
      const sc = buildDnaScenes('quadratic-derivation', p, 'en', 'T')[0];
      for (let k = 0; k < sc.captions.length; k++) {
        const time = sc.captions[k].t1 - 40;
        const st = sc.items.filter((it) => it.kind === 'text' && !it.id.startsWith('cap')).map((it) => evalItem(it, time)).filter((s) => s.alpha > 0.6).map((q) => {
          const w = tokenWidth(q.text, q.size);
          return { q, l: q.x - w / 2, r: q.x + w / 2, t: q.y - q.size * 0.4, b: q.y + q.size * 0.4 };
        });
        for (const s of st) { expect(s.l, s.q.text).toBeGreaterThan(2); expect(s.r, s.q.text).toBeLessThan(718); expect(s.t).toBeGreaterThan(0); expect(s.b).toBeLessThan(444); }
        for (let i = 0; i < st.length; i++) for (let j = i + 1; j < st.length; j++) {
          const ox = Math.min(st[i].r, st[j].r) - Math.max(st[i].l, st[j].l);
          const oy = Math.min(st[i].b, st[j].b) - Math.max(st[i].t, st[j].t);
          expect(ox > 0.5 && oy > 0.5, `${st[i].q.text} / ${st[j].q.text} at step ${k}`).toBe(false);
        }
      }
    }
  });
  it('English and Malayalam pictures are identical; only captions and row tags differ', () => {
    for (const p of Object.values(QD_SAMPLES)) {
      const en = buildDnaScenes('quadratic-derivation', p, 'en', 'T')[0];
      const ml = buildDnaScenes('quadratic-derivation', p, 'ml', 'T')[0];
      const pic = (s: typeof en) => s.items.filter((it) => !it.id.startsWith('qdt')).map((it) => `${it.id}:${it.kind}:${it.text}`);
      expect(pic(ml)).toEqual(pic(en));
      expect(ml.durationMs).toBe(en.durationMs);
    }
  });
  it('the half really lands under the square and the corner square is where the missing piece is', () => {
    const sc = buildDnaScenes('quadratic-derivation', QD_SAMPLE_6_5, 'en', 'T')[0];
    const end = sc.captions[4].t0 - 50; // before the corner step: the turned half has settled
    const polys = sc.items.filter((i) => i.kind === 'poly').map((i) => ({ i, s: evalItem(i, end) })).filter((x) => x.s.alpha > 0.5);
    const cx = polys.map((x) => x.s.points ?? []).filter((pts) => pts.length === 4).map((pts) => ({ x0: Math.min(...pts.map((p) => p[0])), x1: Math.max(...pts.map((p) => p[0])), y0: Math.min(...pts.map((p) => p[1])), y1: Math.max(...pts.map((p) => p[1])) }));
    expect(cx.some((r) => Math.abs(r.x0 - P.halfTo.x0) < 0.5 && Math.abs(r.x1 - P.halfTo.x1) < 0.5 && Math.abs(r.y0 - P.halfTo.y0) < 0.5 && Math.abs(r.y1 - P.halfTo.y1) < 0.5)).toBe(true);
  });
});
