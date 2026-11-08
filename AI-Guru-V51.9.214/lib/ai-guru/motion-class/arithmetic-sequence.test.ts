import { describe, expect, it } from 'vitest';
import { drawMotionFrame, evalItem, type MotionScene } from '../reels/motion';
import { tokenWidth } from '../reels/motion/metrics';
import { selectDna } from './dna/registry';
import { buildDnaScenes } from './dna/builders';
import { differences, formulaLines, formulaText, gaussPairs, listIn, membership, nth, sumLines, sumTo, termLines, termsOf } from './dna/as-math';
import { LMAX, LX, ROW_Y, boxWidth, termX } from './dna/as-builders';
import type { BlockPlan, SeqPlan } from './dna/types';
import type { BookBlock } from './segment';
import { validatePlan } from './plan/validate';
import { offlinePlan, offlineSeq } from './plan/offline';
import { textOnlyWarning, visualStats } from './plan/visual-qa';
import { compileClass, segmentReel } from './class';
import { SEQ_FULL_SAMPLE, SEQ_PAIRS_SAMPLE } from './samples/arithmetic-sequence';

const block = (text: string, kind: BookBlock['kind'] = 'prose'): BookBlock => ({ id: 'b', kind, page: 1, chapterId: 'c', sectionId: 's', lines: [{ text, math: false } as BookBlock['lines'][number]], text });
const say = { en: 'x', ml: 'എ' };
const RD = { en: 'x', ml: 'എ' };
const AS = [-50, -17, -3, 0, 1, 4, 9, 22, 50];
const DS = [-12, -7, -3, -1, 1, 2, 3, 5, 12];

describe('the algebra is exact', () => {
  it('nth, sum and the simplified formula agree with brute force', () => {
    for (const a of AS) for (const d of DS) {
      const s = { a, d };
      let sum = 0;
      for (let n = 1; n <= 100; n++) {
        sum += a + (n - 1) * d;
        expect(nth(s, n)).toBe(a + (n - 1) * d);
        expect(sumTo(s, n)).toBe(sum);
      }
      // the simplified formula "dn + c" evaluates to nth for every n
      const c = a - d;
      expect(formulaText(s)).toBe(`${d === 1 ? 'n' : d === -1 ? '−n' : `${String(d).replace('-', '−')}n`}${c === 0 ? '' : ` ${c < 0 ? '−' : '+'} ${Math.abs(c)}`}`);
    }
  });
  it('the worked lines end on the right value', () => {
    for (const a of AS) for (const d of DS) for (const n of [5, 20, 37, 100]) {
      const s = { a, d };
      const v = String(nth(s, n)).replace('-', '−');
      expect(termLines(s, n)[2]).toBe(`x_{${n}} = ${v}`);
      const sl = sumLines(s, n);
      expect(sl[sl.length - 1]).toBe(`S_{${n}} = ${String(sumTo(s, n)).replace('-', '−')}`);
      expect(sl.length).toBe(n % 2 ? 4 : 3);
    }
  });
  it('lines read as maths: negatives are bracketed', () => {
    expect(formulaLines({ a: 5, d: -3 })).toEqual(['x_n = a + (n − 1)d', 'x_n = 5 + (n − 1) × (−3)', 'x_n = −3n + 8']);
    expect(termLines({ a: 3, d: 4 }, 20)).toEqual(['x_{20} = 3 + (20 − 1) × 4', 'x_{20} = 3 + 76', 'x_{20} = 79']);
    expect(termLines({ a: 5, d: -3 }, 15)).toEqual(['x_{15} = 5 + (15 − 1) × (−3)', 'x_{15} = 5 − 42', 'x_{15} = −37']);
    expect(sumLines({ a: 3, d: 4 }, 20)).toEqual(['S_{20} = 20 ÷ 2 × (3 + 79)', 'S_{20} = 10 × 82', 'S_{20} = 820']);
    expect(sumLines({ a: 5, d: -3 }, 15)).toEqual(['S_{15} = 15 ÷ 2 × (5 + (−37))', 'S_{15} = 15 × (−32) ÷ 2', 'S_{15} = −480 ÷ 2', 'S_{15} = −240']);
    expect(formulaText({ a: 3, d: 3 })).toBe('3n');
    expect(formulaText({ a: 4, d: 1 })).toBe('n + 3');
    expect(formulaText({ a: 0, d: -1 })).toBe('−n + 1');
  });
  it('membership: a term exactly when n is a whole number ≥ 1 (brute force over 300 terms)', () => {
    for (const a of [-9, 0, 3, 7]) for (const d of [-5, -2, 1, 4, 7]) {
      const s = { a, d };
      const set = new Set(termsOf(s, 300));
      for (let v = -120; v <= 160; v++) {
        const mb = membership(s, v);
        const inFirst = set.has(v);
        expect(mb.isTerm, `${a},${d},${v}`).toBe(inFirst);
        if (mb.isTerm) expect(nth(s, mb.n!)).toBe(v);
      }
    }
    expect(membership({ a: 3, d: 4 }, 99).lines).toEqual(['99 = 3 + (n − 1) × 4', 'n − 1 = 96 ÷ 4', 'n = 25']);
    expect(membership({ a: 5, d: -3 }, 7).lines).toEqual(['7 = 5 + (n − 1) × (−3)', 'n − 1 = 2 ÷ (−3)', 'n = 1/3']);
    expect(membership({ a: 3, d: 4 }, 1).isTerm).toBe(false); // would be n = 1/2
    expect(membership({ a: 3, d: 4 }, -1).isTerm).toBe(false); // n = 0: the sequence starts at n = 1
  });
  it('Gauss pairs all have the same sum and add up to S', () => {
    for (const a of AS) for (const d of DS) for (const N of [4, 6]) {
      const s = { a, d };
      const g = gaussPairs(s, N);
      for (const [i, j] of g.pairs) expect(nth(s, i) + nth(s, j)).toBe(g.sum);
      expect(g.pairs.length * g.sum).toBe(g.total);
      expect(g.total).toBe(sumTo(s, N));
    }
  });
  it('differences and list detection', () => {
    expect(differences([3, 7, 11, 15])).toEqual([4, 4, 4]);
    expect(listIn('Look at 2, 5, 8, 11, 14 …')).toEqual({ a: 2, d: 3, count: 5 });
    expect(listIn('the numbers 10, 7, 4, 1')).toEqual({ a: 10, d: -3, count: 4 });
    expect(listIn('1, 2, 4, 8')).toBeNull();
    expect(listIn('5, 5, 5')).toBeNull();
    expect(listIn('In 2023, 45 students')).toBeNull();
  });
});

describe('validator', () => {
  const v = (plan: unknown) => validatePlan('arithmetic-sequence', plan, undefined, true).join(' | ');
  const show = { op: 'show' as const, say };
  const plan = (steps: SeqPlan['steps'], over: Partial<SeqPlan> = {}): SeqPlan => ({ a: 3, d: 4, terms: 6, steps, ...over });
  it('samples pass', () => {
    for (const p of [SEQ_FULL_SAMPLE, SEQ_PAIRS_SAMPLE]) expect(validatePlan('arithmetic-sequence', p, RD)).toEqual([]);
  });
  it('numbers', () => {
    expect(v(plan([show], { a: 51 }))).toMatch(/first term\) must be/);
    expect(v(plan([show], { d: 0 }))).toMatch(/non-zero/);
    expect(v(plan([show], { d: 13 }))).toMatch(/non-zero/);
    expect(v(plan([show], { terms: 3 }))).toMatch(/from 4 to 7/);
    expect(v(plan([show], { terms: 8 }))).toMatch(/from 4 to 7/);
    expect(v(plan([show], { a: 1.5 }))).toMatch(/whole number/);
  });
  it('order and arguments', () => {
    expect(v(plan([{ op: 'diff', say }]))).toMatch(/needs \{"op":"show"\}/);
    expect(v(plan([show, show]))).toMatch(/only once/);
    expect(v(plan([show, { op: 'term', n: 20, say }]))).toMatch(/"term" needs "formula"/);
    expect(v(plan([show, { op: 'formula', say }, { op: 'term', n: 5, say }]))).toMatch(/from 7/);
    expect(v(plan([show, { op: 'formula', say }, { op: 'term', n: 101, say }]))).toMatch(/to 100/);
    expect(v(plan([show, { op: 'test', value: 5, say }]))).toMatch(/"test" needs "formula"/);
    expect(v(plan([show, { op: 'formula', say }, { op: 'test', value: 1000, say }]))).toMatch(/from −999 to 999/);
    expect(v(plan([show, { op: 'sum', n: 1, say }]))).toMatch(/from 2 to 100/);
    expect(v(plan([show, { op: 'pairs', say }], { terms: 5 }))).toMatch(/even number of terms/);
    expect(v(plan([show, { op: 'formula', say }, { op: 'pairs', say }]))).toMatch(/before "formula" and "graph"/);
    expect(v(plan([show, { op: 'pairs', say }, { op: 'pairs', say }]))).toMatch(/"pairs" only once/);
    expect(v(plan([show, { op: 'graph', say }, { op: 'graph', say }]))).toMatch(/"graph" only once/);
    expect(v(plan([show, { op: 'spin' as 'show', say }]))).toMatch(/not one of/);
    expect(v(plan([show, { op: 'diff', say: { en: '', ml: 'എ' } }]))).toMatch(/say is required/);
    expect(v(plan([]))).toMatch(/must list the steps/);
  });
});

describe('what the board shows', () => {
  const [s] = buildDnaScenes('arithmetic-sequence', SEQ_FULL_SAMPLE, 'en', 'T');
  const [p] = buildDnaScenes('arithmetic-sequence', SEQ_PAIRS_SAMPLE, 'en', 'T');
  const end = (sc: MotionScene) => sc.durationMs + 10;
  const vis = (sc: MotionScene, t: number) => sc.items.filter((i) => i.kind === 'text').map((i) => evalItem(i, t)).filter((st) => st.alpha > 0.5);
  const capEnd = (sc: MotionScene, k: number, title: boolean) => sc.captions[k + (title ? 1 : 0)].t1 - 40;
  it('the row shows the first terms in boxes, the arrows the common difference', () => {
    const st = vis(s, capEnd(s, 1, true));
    const row = st.filter((q) => Math.abs(q.y - ROW_Y) < 3).sort((a, b) => a.x - b.x).map((q) => q.text);
    expect(row).toEqual(['3', '7', '11', '15', '19', '23']);
    expect(st.filter((q) => q.text === '+4').length).toBe(5);
    expect(vis(p, capEnd(p, 1, false)).filter((q) => q.text === '−3').length).toBe(3);
    // each term sits at its box centre
    row.forEach((_, i) => expect(st.find((q) => q.text === row[i] && Math.abs(q.y - ROW_Y) < 3)!.x).toBeCloseTo(termX(i + 1, 6), 3));
  });
  it('formula, far term, test, sum are written by the app', () => {
    const t = (k: number) => vis(s, capEnd(s, k, true)).map((q) => q.text);
    for (const w of ['x_n = a + (n − 1)d', 'x_n = 3 + (n − 1) × 4', 'x_n = 4n − 1']) expect(t(2)).toContain(w);
    for (const w of ['x_{20} = 3 + (20 − 1) × 4', 'x_{20} = 3 + 76', 'x_{20} = 79']) expect(t(3)).toContain(w);
    expect(t(3)).not.toContain('99 = 3 + (n − 1) × 4'); // the earlier working was cleared
    expect(t(4)).toContain('n = 25');
    expect(t(5)).toContain('S_{20} = 820');
    expect(t(5)).not.toContain('n = 25');
  });
  it('a number that is not a term gets a cross, and the odd-n sum has four lines', () => {
    const st = vis(p, capEnd(p, 4, false)).map((q) => q.text);
    expect(st).toContain('n = 1/3');
    expect(p.items.some((i) => i.kind === 'poly' && evalItem(i, capEnd(p, 4, false)).color.toLowerCase() === '#d22d2d' && evalItem(i, capEnd(p, 4, false)).alpha > 0.5)).toBe(true);
    expect(vis(p, capEnd(p, 5, false)).filter((q) => q.text.startsWith('S_{15}')).length).toBe(4);
  });
  it('Gauss pairs: one bracket per pair, each labelled with the same sum', () => {
    const st = vis(p, capEnd(p, 2, false));
    expect(st.filter((q) => q.text === '1' && q.color.toLowerCase() === '#9d3bc8').length).toBe(2);
    expect(st.map((q) => q.text)).toContain('5 + (−4) = 1');
    expect(st.map((q) => q.text)).toContain('2 × 1 = 2');
    // the pairing is cleared when the next step comes
    expect(vis(p, capEnd(p, 3, false)).filter((q) => q.text === '1' && q.color.toLowerCase() === '#9d3bc8').length).toBe(0);
  });
  it('graph: the points are (n, x_n) and the dashed line passes through them', () => {
    const dots = s.items.filter((i) => i.kind === 'dot' && /^g_pt/.test(i.id));
    expect(dots.length).toBe(6);
    const pts = dots.map((d) => evalItem(d, end(s)));
    // collinear: equal steps in x and in y
    const dx = pts[1].x - pts[0].x;
    const dy = pts[1].y - pts[0].y;
    for (let i = 2; i < pts.length; i++) {
      expect(pts[i].x - pts[i - 1].x).toBeCloseTo(dx, 3);
      expect(pts[i].y - pts[i - 1].y).toBeCloseTo(dy, 3);
    }
    expect(dy).toBeLessThan(0); // upward on the board for d > 0 (y grows downward)
    const pd = p.items.filter((i) => i.kind === 'dot' && /^g_pt/.test(i.id)).map((d) => evalItem(d, end(p)));
    expect(pd[1].y - pd[0].y).toBeGreaterThan(0);
  });
  it('nothing overlaps or leaves its area', () => {
    for (const [sc, title] of [[s, true], [p, false]] as const) for (let k = 0; k < sc.captions.length; k++) {
      const t = sc.captions[k].t1 - 40;
      const st = vis(sc, t).map((q) => {
        const w = tokenWidth(q.text, q.size);
        return { q, l: q.x - w / 2, r: q.x + w / 2 };
      });
      for (const b of st) {
        expect(b.l, b.q.text).toBeGreaterThan(2);
        expect(b.r, b.q.text).toBeLessThan(718);
      }
      // the left-column working never reaches into the graph (x ≥ 380) and stays inside its width
      for (const b of st.filter((x) => x.q.y > 180 && Math.abs(x.l - LX) < 2)) expect(b.r, b.q.text).toBeLessThanOrEqual(LX + LMAX + 1);
      for (let i = 0; i < st.length; i++) for (let j = i + 1; j < st.length; j++) {
        if (Math.abs(st[i].q.y - st[j].q.y) > 10) continue;
        const gap = Math.max(st[i].l, st[j].l) - Math.min(st[i].r, st[j].r);
        expect(gap, `${st[i].q.text} / ${st[j].q.text} at ${t}`).toBeGreaterThanOrEqual(-1e-6);
      }
    }
  });
  it('boxes have equal width and sit inside the board', () => {
    for (const N of [4, 5, 6, 7]) {
      expect(termX(1, N) - boxWidth(N) / 2).toBeGreaterThan(10);
      expect(termX(N, N) + boxWidth(N) / 2).toBeLessThan(710);
      expect(termX(2, N) - termX(1, N)).toBeGreaterThan(boxWidth(N));
    }
  });
  it('English and Malayalam pictures are identical; only captions differ', () => {
    const ml = buildDnaScenes('arithmetic-sequence', SEQ_FULL_SAMPLE, 'ml', 'T')[0];
    expect(ml.items.map((i) => `${i.id}:${i.kind}:${i.text}`)).toEqual(s.items.map((i) => `${i.id}:${i.kind}:${i.text}`));
    expect(ml.captions.map((c) => c.text)).not.toEqual(s.captions.map((c) => c.text));
  });
});

describe('selection', () => {
  const pick = (t: string, kind: BookBlock['kind'] = 'prose') => selectDna(block(t, kind)).dna;
  it('arithmetic sequence talk → arithmetic-sequence', () => {
    expect(pick('In an arithmetic sequence each term is got by adding the common difference to the term before it.')).toBe('arithmetic-sequence');
    expect(pick('The first term of an arithmetic sequence is 3 and the common difference is 4. Find the 20th term.', 'exercise')).toBe('arithmetic-sequence');
    expect(pick('Look at the numbers 2, 5, 8, 11, 14, …')).toBe('arithmetic-sequence');
    expect(pick('What is the sum of the first 25 terms of the sequence?', 'exercise')).toBe('arithmetic-sequence');
  });
  it('the same words elsewhere stay elsewhere', () => {
    expect(pick('In a geometric sequence each term is the previous term times the common ratio: 2, 6, 18, 54.')).not.toBe('arithmetic-sequence');
    expect(pick('Sachin scored 45, 60, 38 and 72 runs in four matches.')).not.toBe('arithmetic-sequence');
    expect(pick('In 2023, 45 students joined the school.')).not.toBe('arithmetic-sequence');
    expect(pick('A pair of linear equations in two variables can be solved by the graphical method.')).toBe('linear-system');
  });
});

describe('offline planner', () => {
  it('reads a list or the first term and common difference', () => {
    const p = offlineSeq('Find the 25th term of 2, 5, 8, 11, 14, 17 and the sum of the first 25 terms.')!;
    expect(p).toMatchObject({ a: 2, d: 3, terms: 6 });
    expect(p.steps.find((x) => x.op === 'term')).toMatchObject({ n: 25 });
    expect(p.steps.some((x) => x.op === 'sum')).toBe(true);
    expect(validatePlan('arithmetic-sequence', p, RD)).toEqual([]);
    const q = offlineSeq('An arithmetic sequence has first term 10 and common difference −3.')!;
    expect(q).toMatchObject({ a: 10, d: -3, terms: 4 });
    expect(validatePlan('arithmetic-sequence', q, RD)).toEqual([]);
    expect(offlineSeq('Arithmetic sequences are important.')).toBeNull();
    expect(offlineSeq('first term 70 and common difference 2')).toBeNull();
  });
  it('falls back with a warning when no numbers are given', () => {
    const pl = offlinePlan(block('We study arithmetic sequences and the common difference.'), '', '');
    expect(pl.dna).toBe('concept-board');
    expect(pl.warnings?.join()).toMatch(/AI planner needed/);
    const good = offlinePlan(block('Find the 20th term of 3, 7, 11, 15, 19.', 'exercise'), '', '');
    expect(good.dna).toBe('arithmetic-sequence');
  });
});

describe('picture and class', () => {
  it('samples are real pictures', () => {
    for (const teach of [SEQ_FULL_SAMPLE, SEQ_PAIRS_SAMPLE]) {
      expect(textOnlyWarning({ dna: 'arithmetic-sequence', teach })).toBeUndefined();
      expect(visualStats(buildDnaScenes('arithmetic-sequence', teach, 'en', 'T')).graphics).toBeGreaterThanOrEqual(5);
    }
  });
  it('compiles into a class with one caption per step', () => {
    const plan: BlockPlan = { blockId: 'b', dna: 'arithmetic-sequence', read: RD, teach: SEQ_FULL_SAMPLE, source: 'fixture' };
    const segs = compileClass([block('Arithmetic sequences.')], new Map([['b', plan]]), { title: 'T' });
    for (const seg of segs.filter((x) => x.phase === 'teach')) expect(segmentReel(seg).parts[0].captions.length).toBe(SEQ_FULL_SAMPLE.steps.length + 1);
  });
  it('draws without error in every format and theme', () => {
    const noop = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? (x: string) => ({ width: x.length * 10 }) : () => undefined), set: () => true }) as unknown as CanvasRenderingContext2D;
    for (const teach of [SEQ_FULL_SAMPLE, SEQ_PAIRS_SAMPLE]) {
      const sc = buildDnaScenes('arithmetic-sequence', teach, 'ml', 'T')[0];
      for (const format of ['landscape', 'vertical', 'square'] as const) for (const theme of ['light', 'dark'] as const) for (const f of [0.1, 0.4, 0.7, 0.99]) drawMotionFrame(noop, sc, sc.durationMs * f, { format, theme } as never);
    }
  });
  it('builds and validates for many a, d, terms and every step', () => {
    for (const a of AS) for (const d of DS) for (const terms of [4, 6, 7]) {
      const steps: SeqPlan['steps'] = [{ op: 'show', say }, { op: 'diff', say }, ...(terms % 2 ? [] : [{ op: 'pairs' as const, say }]), { op: 'formula', say }, { op: 'term', n: 100, say }, { op: 'test', value: a + 2 * d, say }, { op: 'sum', n: 99, say }, { op: 'graph', say }];
      const plan: SeqPlan = { a, d, terms, steps };
      expect(validatePlan('arithmetic-sequence', plan, RD), JSON.stringify([a, d, terms])).toEqual([]);
      expect(() => buildDnaScenes('arithmetic-sequence', plan, 'en', 'T')).not.toThrow();
    }
  });
});
