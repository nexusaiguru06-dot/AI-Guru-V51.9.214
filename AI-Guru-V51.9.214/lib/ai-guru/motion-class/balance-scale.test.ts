import { describe, expect, it } from 'vitest';
import { drawMotionFrame, evalItem, type MotionScene } from '../reels/motion';
import { tokenWidth } from '../reels/motion/metrics';
import { selectDna } from './dna/registry';
import { buildDnaScenes } from './dna/builders';

/** The tipping-pan look (look: 'pans'); the default look is the beam. */
const pans = (p: Parameters<typeof buildDnaScenes>[1], lang: 'en' | 'ml') => buildDnaScenes('balance-scale', { ...(p as object), look: 'pans' } as never, lang, 'T');
import { BALX, BALMAX } from './dna/bal-builders';
import { BAL_OPS, DISH, PAN_INNER, SC, TW, balFacts, balProblem, beamPoint, beamShape, panTop, rowLayout, rowWidth, stringsOf, sv, tiltFor, findBalEquations, lineAnswer, lineCheck, lineDivide, lineMove, lineShow, lineSimplify, requiredOps, type Tok } from './dna/bal-math';
import type { BalPlan, BlockPlan } from './dna/types';
import type { BookBlock } from './segment';
import { validatePlan } from './plan/validate';
import { offlineBalance, offlinePlan } from './plan/offline';
import { textOnlyWarning, visualStats } from './plan/visual-qa';
import { compileClass } from './class';
import { BAL_CHAIR_SAMPLE, BAL_TABLE_SAMPLE, BAL_LETTER_SAMPLE, BAL_MINUS_SAMPLE, BAL_ONE_STEP_SAMPLE, BAL_SAMPLES, BAL_TWO_STEP_SAMPLE } from './samples/balance-scale';

const block = (text: string, kind: BookBlock['kind'] = 'prose'): BookBlock => ({ id: 'b', kind, page: 1, chapterId: 'c', sectionId: 's', lines: [{ text, math: false } as BookBlock['lines'][number]], text });
const say = { en: 'x', ml: 'എ' };
const RD = { en: 'x', ml: 'എ' };
const full = (p: Omit<BalPlan, 'steps'>): BalPlan => ({ ...p, steps: [...requiredOps(p as BalPlan), ...(p.a >= 2 ? ['answer'] : []), 'check'].map((op) => ({ op, say }) as BalPlan['steps'][number]) });
const txt = (t: Tok[]) => t.map(([s]) => s).join(' ');

/** Every legal equation: a 1–4, b −12…12, a whole answer 1–20. */
const CASES: BalPlan[] = [];
for (let a = 1; a <= 4; a++) for (let b = -12; b <= 12; b++) for (let x = 1; x <= 20; x++) {
  const c = a * x + b;
  if (c < 1 || c > 120) continue;
  if (a === 1 && b === 0) continue;
  CASES.push(full({ a, b, c }));
}

describe('the numbers are true', () => {
  it('there are plenty of cases and each one is legal', () => {
    expect(CASES.length).toBeGreaterThan(1000);
    for (const p of CASES) expect(balProblem(p, 'p'), JSON.stringify(p)).toBeNull();
  });
  it('the answer, the moved side and the check all agree', () => {
    for (const p of CASES) {
      const f = balFacts(p);
      expect(f.n).toBe(p.c - p.b);
      expect(f.x * p.a).toBe(f.n);
      expect(p.a * f.x + p.b).toBe(p.c);
      expect(Number.isInteger(f.x)).toBe(true);
    }
  });
  it('rejects what cannot be shown', () => {
    expect(balProblem({ a: 2, b: 5, c: 26, steps: [] }, 'p')).toMatch(/no whole-number answer/);
    expect(balProblem({ a: 1, b: 0, c: 5, steps: [] }, 'p')).toMatch(/nothing to balance/);
    expect(balProblem({ a: 5, b: 0, c: 10, steps: [] }, 'p')).toMatch(/1 to 4/);
    expect(balProblem({ a: 2, b: 13, c: 33, steps: [] }, 'p')).toMatch(/−12 to 12/);
    expect(balProblem({ a: 2, b: 5, c: 5, steps: [] }, 'p')).toMatch(/answer 0 must be/);
    expect(balProblem({ a: 1, b: 5, c: 130, steps: [] }, 'p')).toMatch(/answer 125 must be/);
    expect(balProblem({ a: 3, b: 2, c: 10, d: 3, steps: [] }, 'p')).toMatch(/1 to a − 1/);
    expect(balProblem({ a: 3, b: 2, c: 10, d: 1, steps: [] }, 'p')).toBeNull(); // 2x + 2 = 10, x = 4
    expect(balProblem({ a: 3, b: 2, c: 11, d: 1, steps: [] }, 'p')).toMatch(/multiple of 2/);
    expect(balProblem({ a: 2, b: 5, c: 25, letter: 'q', steps: [] }, 'p')).toMatch(/letter/);
    expect(balProblem({ a: 2.5, b: 5, c: 25, steps: [] } as unknown as BalPlan, 'p')).toMatch(/whole number/);
  });
});

describe('the scale tips like a real one', () => {
  it('the heavier pan goes down, equal weights stay level, and the tilt is limited', () => {
    expect(tiltFor(10, 10)).toBe(0);
    expect(tiltFor(0, 0)).toBe(0);
    expect(tiltFor(5, 25)).toBeGreaterThan(0); // right heavier → right side down (positive)
    expect(tiltFor(25, 5)).toBeLessThan(0);
    expect(Math.abs(tiltFor(1, 1000))).toBeLessThanOrEqual(SC.tiltMax + 1e-9);
    expect(Math.abs(tiltFor(20, 25))).toBeLessThan(Math.abs(tiltFor(5, 25)));
    const [, ly] = beamPoint(-SC.R, tiltFor(5, 25));
    const [, ry] = beamPoint(SC.R, tiltFor(5, 25));
    expect(ry).toBeGreaterThan(ly);
  });
  it('the beam, strings and pans stay joined at every tilt', () => {
    for (const th of [-SC.tiltMax, -0.05, 0, 0.07, SC.tiltMax]) {
      const beam = beamShape(th);
      expect(beam).toHaveLength(4);
      for (const side of ['L', 'R'] as const) {
        const top = panTop(side, th);
        for (const [onBeam, onPan] of stringsOf(side, th)) {
          expect(onPan[1]).toBeCloseTo(top[1]);
          expect(Math.abs(onBeam[0] - onPan[0])).toBeLessThan(1e-6); // strings hang straight down
          expect(onBeam[1]).toBeLessThan(onPan[1] - 60);
        }
      }
    }
    expect(DISH).toHaveLength(4);
  });
  it('every tile row fits in its pan and inside the picture, at the biggest sizes', () => {
    const rows = [[TW.x, TW.x, TW.x, TW.x, TW.b], [TW.c, TW.b], [TW.v, TW.v, TW.v, TW.v]];
    for (const r of rows) {
      expect(rowWidth(r)).toBeLessThanOrEqual(PAN_INNER);
      const cs = rowLayout(r);
      cs.forEach((c, i) => expect(Math.abs(c) + r[i] / 2).toBeLessThanOrEqual(SC.panW / 2));
      cs.slice(1).forEach((c, i) => expect(c - r[i + 1] / 2).toBeGreaterThanOrEqual(cs[i] + r[i] / 2));
    }
    for (const th of [-SC.tiltMax, SC.tiltMax]) {
      const l = panTop('L', th);
      const r = panTop('R', th);
      expect(l[0] - SC.panW / 2).toBeGreaterThanOrEqual(0);
      expect(r[0] + SC.panW / 2).toBeLessThanOrEqual(720);
    }
  });
  it('a unit scales every written value but not the number of tiles', () => {
    const p: BalPlan = { a: 3, b: 0, c: 3, scale: 1000, steps: [] };
    expect(balProblem(p, 'p')).toBeNull();
    expect(balProblem({ ...p, scale: 7 }, 'p')).toMatch(/scale must be/);
    const f = balFacts(p);
    expect(sv(f, f.c)).toBe('3000');
    expect(txt(lineShow(p))).toBe('3 x = 3000');
    expect(txt(lineDivide(p))).toBe('x = 3000 ÷ 3');
    expect(txt(lineAnswer(p))).toBe('x = 1000');
  });
});

describe('what is written', () => {
  it('2x + 5 = 25 line by line, in the reel\'s colours', () => {
    const p = BAL_TWO_STEP_SAMPLE;
    expect(txt(lineShow(p))).toBe('2 x + 5 = 25');
    expect(lineShow(p).map(([, r]) => r)).toEqual(['a', 'ink', 'ink', 'b', 'ink', 'c']);
    expect(txt(lineMove(p))).toBe('2 x = 25 − 5');
    expect(txt(lineSimplify(p))).toBe('2 x = 20');
    expect(txt(lineDivide(p))).toBe('x = 20 ÷ 2');
    expect(txt(lineAnswer(p))).toBe('x = 10');
    expect(txt(lineCheck(p))).toBe('2 × 10 + 5 = 25');
  });
  it('x − 3 = 9 adds the tile back; one x needs no dividing', () => {
    const p = BAL_MINUS_SAMPLE;
    expect(txt(lineShow(p))).toBe('x − 3 = 9');
    expect(txt(lineMove(p))).toBe('x = 9 + 3');
    expect(txt(lineSimplify(p))).toBe('x = 12');
    expect(txt(lineCheck(p))).toBe('12 − 3 = 9');
  });
  it('4x = 28 has no b', () => {
    const p = BAL_ONE_STEP_SAMPLE;
    expect(txt(lineShow(p))).toBe('4 x = 28');
    expect(txt(lineDivide(p))).toBe('x = 28 ÷ 4');
    expect(txt(lineCheck(p))).toBe('4 × 7 = 28');
  });
  it('another letter is used throughout', () => {
    expect(txt(lineShow(BAL_LETTER_SAMPLE))).toBe('3 n + 4 = 22');
    expect(txt(lineAnswer(BAL_LETTER_SAMPLE))).toBe('n = 6');
  });
  const lines = (sc: MotionScene, k: number, title: boolean): string[] => {
    const time = sc.captions[k + (title ? 1 : 0)].t1 - 40;
    const vis = sc.items.filter((it) => it.kind === 'text').map((it) => evalItem(it, time)).filter((st) => st.alpha > 0.5 && st.y >= 380);
    const rows = new Map<number, Array<{ x: number; text: string }>>();
    for (const v of vis) { const key = Math.round(v.y); rows.set(key, [...(rows.get(key) ?? []), { x: v.x, text: v.text }]); }
    return [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, r]) => r.sort((a, b) => a.x - b.x).map((q) => q.text).join(' '));
  };
  const tiles = (sc: MotionScene, k: number, title: boolean): string[] => {
    const time = sc.captions[k + (title ? 1 : 0)].t1 - 40;
    return sc.items.filter((it) => it.kind === 'text').map((it) => evalItem(it, time)).filter((st) => st.alpha > 0.5 && st.y < 380).sort((a, b) => a.x - b.x).map((q) => q.text);
  };
  it('the panel grows one line per step; the tiles change as the scale is worked', () => {
    const sc = pans(BAL_TWO_STEP_SAMPLE, 'en')[0];
    expect(lines(sc, 0, true)).toEqual(['2 x + 5 = 25']);
    expect(tiles(sc, 0, true)).toEqual(['x', 'x', '5', '25']);
    expect(lines(sc, 1, true).slice(0, 2)).toEqual(['2 x + 5 = 25', '2 x = 25 − 5 − 5 both sides']);
    expect(tiles(sc, 1, true)).toEqual(['x', 'x', '20']); // the 5 has lifted off both pans
    expect(tiles(sc, 2, true)).toEqual(['x', 'x', '20']);
    expect(tiles(sc, 3, true)).toEqual(['x', '10']); // one group of each is left
    expect(tiles(sc, 4, true)).toEqual(['10', '10']); // x has become its value
    expect(lines(sc, 4, true).slice(-1)).toEqual(['x = 10']);
    expect(lines(sc, 5, true).slice(-1)).toEqual(['2 × 10 + 5 = 25']);
  });
  it('x − 3 = 9: a +3 tile cancels the −3 and the same +3 joins the 9', () => {
    const sc = pans(BAL_MINUS_SAMPLE, 'en')[0];
    expect(tiles(sc, 0, false)).toEqual(['x', '−3', '9']);
    expect(tiles(sc, 1, false)).toEqual(['x', '12']);
    expect(tiles(sc, 2, false)).toEqual(['x', '12']);
  });
});


describe('the tipping is real (V51.9.47)', () => {
  const tipAt = (sc: MotionScene, time: number) => {
    const beam = sc.items.find((i) => i.id === 'beam')!;
    const p = evalItem(beam, time).points!;
    return p[1][1] - p[0][1]; // right end minus left end (design y, down is positive)
  };
  it('the scale is level at the end of every step (both pans always end equal)', { timeout: 120000 }, () => {
    for (const teach of [...BAL_SAMPLES, ...CASES.filter((_, i) => i % 97 === 0)]) {
      const sc = pans(teach, 'en')[0];
      sc.captions.forEach((c, k) => { if (k > 0) expect(Math.abs(tipAt(sc, c.t1 - 40)), `${JSON.stringify([teach.a, teach.b, teach.c])} step ${k}`).toBeLessThan(1.5); });
    }
  });
  it('it tips right when the 5 comes off the left, and left when +3 is added to the left', () => {
    const sc = pans(BAL_TWO_STEP_SAMPLE, 'en')[0];
    const move = sc.captions[2];
    let max = 0;
    for (let tm = move.t0; tm < move.t1; tm += 100) max = Math.max(max, tipAt(sc, tm));
    expect(max).toBeGreaterThan(15);
    const sc2 = pans(BAL_MINUS_SAMPLE, 'en')[0];
    const mv = sc2.captions[1];
    let min = 0;
    for (let tm = mv.t0; tm < mv.t1; tm += 100) min = Math.min(min, tipAt(sc2, tm));
    expect(min).toBeLessThan(-15);
  });
  it('while it tips, the pans, strings and tiles move with it (tiles stay on the dish)', () => {
    const sc = pans(BAL_TWO_STEP_SAMPLE, 'en')[0];
    const move = sc.captions[2];
    let peak = move.t0;
    for (let tm = move.t0; tm < move.t1; tm += 50) if (tipAt(sc, tm) > tipAt(sc, peak)) peak = tm;
    expect(tipAt(sc, peak)).toBeGreaterThan(15);
    const dish = evalItem(sc.items.find((i) => i.id === 'dishL')!, peak).points!;
    const topY = dish[0][1];
    const standing = sc.items.filter((x) => x.kind === 'poly' && x.id.startsWith('pl')).map((x) => ({ x, st: evalItem(x, peak) })).filter(({ st }) => st.alpha > 0.9 && st.points && st.points[0][0] < 360);
    expect(standing.length).toBeGreaterThanOrEqual(2); // the two x tiles
    for (const { x, st } of standing) expect(Math.abs(Math.max(...st.points!.map((p) => p[1])) - topY), x.id).toBeLessThan(1.5);
    // the left pan has gone up and the right pan down by the same kind of amount
    const dishR = evalItem(sc.items.find((i) => i.id === 'dishR')!, peak).points!;
    expect(dishR[0][1]).toBeGreaterThan(topY + 15);
  });
  it('the equation panel never shows more than four lines and nothing is left behind', () => {
    for (const teach of [BAL_TWO_STEP_SAMPLE, BAL_MINUS_SAMPLE]) {
      const sc = pans(teach, 'en')[0];
      sc.captions.forEach((c) => {
        const rows = new Set(sc.items.filter((i) => i.kind === 'text').map((i) => evalItem(i, c.t1 - 40)).filter((s) => s.alpha > 0.5 && s.y >= 380).map((s) => Math.round(s.y)));
        expect(rows.size).toBeLessThanOrEqual(4);
      });
      const end = sc.durationMs - 50;
      const boxes = sc.items.filter((i) => i.kind === 'rect').map((i) => evalItem(i, end)).filter((s) => s.alpha > 0.5);
      expect(boxes.length).toBeLessThanOrEqual(1);
    }
  });
});


describe('the table-and-chair problem on the scale (V51.9.47)', () => {
  const text = "The price of a table and chair is 11000 rupees. The price of the table and four chairs is 14000 rupees. What's the price of each ?";
  const blk: BookBlock = { id: 'b', kind: 'problem', page: 1, chapterId: 'c', sectionId: 's', lines: [{ text, math: false } as BookBlock['lines'][number]], text };
  const wp = (offlinePlan(blk, 'Pairs', 'S') as BlockPlan).teach as Record<string, unknown>;
  const composite = { blockId: 'b', dna: 'ai-custom', read: RD, source: 'ai', teach: { segments: [
    { dna: 'word-problem', plan: { ...wp, solvedLater: true, answer: undefined } },
    { dna: 'balance-scale', plan: BAL_CHAIR_SAMPLE },
    { dna: 'balance-scale', plan: BAL_TABLE_SAMPLE },
  ] } } as unknown as BlockPlan;
  it('both scales are legal and give the textbook answers (chair 1000, table 10000)', () => {
    for (const p of [BAL_CHAIR_SAMPLE, BAL_TABLE_SAMPLE]) expect(balProblem(p, 'p')).toBeNull();
    expect(sv(balFacts(BAL_CHAIR_SAMPLE), balFacts(BAL_CHAIR_SAMPLE).x)).toBe('1000');
    expect(sv(balFacts(BAL_TABLE_SAMPLE), balFacts(BAL_TABLE_SAMPLE).x)).toBe('10000');
    expect(txt(lineCheck(BAL_TABLE_SAMPLE))).toBe('10000 + 1000 = 11000');
    expect(validatePlan('balance-scale', BAL_CHAIR_SAMPLE, RD)).toEqual([]);
    expect(validatePlan('balance-scale', BAL_TABLE_SAMPLE, RD)).toEqual([]);
  });
  it('the class models the problem, then solves it on the scales, with the problem pinned on every scene', () => {
    const seg = compileClass([blk], new Map([['b', composite]]), { title: 'T' }, { read: false, languages: ['en'] }).find((s) => s.phase === 'teach')!;
    const scenes = seg.build();
    expect(scenes.length).toBeGreaterThanOrEqual(3);
    expect(scenes.every((s) => s.problem === text.replace(/\s+/g, ' ').trim() || s.problem === text)).toBe(true);
    expect(scenes.filter((s) => s.items.some((i) => i.id === 'beam')).length).toBe(2);
    const spoken = scenes.flatMap((s) => s.captions.map((c) => c.text)).join(' | ');
    expect(spoken).not.toMatch(/check the answer: put x/i); // solvedLater: the scales do the solving
    expect(spoken).toMatch(/Three chairs cost 3000/);
  });
  it('draws in every format and theme', () => {
    const noop = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? (x: string) => ({ width: x.length * 10 }) : () => undefined), set: () => true }) as unknown as CanvasRenderingContext2D;
    const seg = compileClass([blk], new Map([['b', composite]]), { title: 'T' }, { read: false, languages: ['en'] }).find((s) => s.phase === 'teach')!;
    for (const sc of seg.build()) for (const format of ['vertical', 'landscape', 'square'] as const) for (const theme of ['light', 'dark'] as const) for (const f of [0.2, 0.6, 0.98]) drawMotionFrame(noop, sc, sc.durationMs * f, { format, theme } as never);
  });
});

describe('the validator', () => {
  const ok = (p: unknown) => validatePlan('balance-scale', p, RD);
  it('accepts every sample and every case', () => {
    for (const p of BAL_SAMPLES) expect(ok(p), JSON.stringify(p)).toEqual([]);
    for (const p of CASES.filter((_, i) => i % 9 === 0)) expect(ok(p), JSON.stringify(p)).toEqual([]);
  });
  it('explains what is wrong', () => {
    const st = (...ops: string[]) => ops.map((op) => ({ op, say }));
    expect(ok({ a: 2, b: 5, c: 26, steps: st('show') }).join(' ')).toMatch(/no whole-number answer/);
    expect(ok({ a: 2, b: 5, c: 25, steps: st('move', 'show') }).join(' ')).toMatch(/needs \{"op":"show"\} before it/);
    expect(ok({ a: 2, b: 5, c: 25, steps: st('show', 'simplify', 'move') }).join(' ')).toMatch(/"simplify" needs "move" before it/);
    expect(ok({ a: 2, b: 5, c: 25, steps: st('show', 'move', 'divide') }).join(' ')).toMatch(/"divide" needs "simplify" before it/);
    expect(ok({ a: 2, b: 5, c: 25, steps: st('show', 'move', 'simplify', 'divide', 'answer', 'answer') }).join(' ')).toMatch(/"answer" only once/);
    expect(ok({ a: 2, b: 5, c: 25, steps: st('show', 'move', 'simplify') }).join(' ')).toMatch(/"divide" is missing/);
    expect(ok({ a: 2, b: 0, c: 8, steps: st('show', 'move', 'divide', 'answer') }).join(' ')).toMatch(/needs b ≠ 0/);
    expect(ok({ a: 1, b: 5, c: 9, steps: st('show', 'move', 'simplify', 'divide') }).join(' ')).toMatch(/needs a − d ≥ 2/);
    expect(ok({ a: 1, b: 5, c: 9, steps: st('show', 'move', 'simplify', 'answer') }).join(' ')).toMatch(/with one x/);
    expect(ok({ a: 2, b: 5, c: 25, steps: st('show', 'move', 'simplify', 'divide', 'check') }).join(' ')).toMatch(/"check" needs "answer"/);
    expect(ok({ a: 2, b: 5, c: 25, steps: st('show', 'jump') }).join(' ')).toMatch(new RegExp(`one of ${BAL_OPS.join(', ')}`));
    expect(ok({ a: 2, b: 5, c: 25, steps: [{ op: 'show' }] }).join(' ')).toMatch(/say is required/);
  });
});

describe('choosing the DNA', () => {
  const dna = (t: string, kind: BookBlock['kind'] = 'math') => selectDna(block(t, kind), 'Linear equations').dna;
  it('picks the scale for a single linear equation', () => {
    expect(dna('Solve 2x + 5 = 25', 'problem')).toBe('balance-scale');
    expect(dna('2x + 5 = 25')).toBe('balance-scale');
    expect(dna('x − 3 = 9')).toBe('balance-scale');
    expect(dna('4x = 28')).toBe('balance-scale');
    expect(dna('2x − 10 = 100', 'math')).toBe('balance-scale'); // x = 55 (answers up to 100)
    expect(dna('3x + 2 = x + 10')).toBe('balance-scale'); // x on both sides
    expect(dna('3n + 4 = 22', 'exercise')).toBe('balance-scale');
    expect(dna('Solve 4y - 7 = 17.', 'problem')).toBe('balance-scale');
  });
  it('leaves alone what a scale cannot show', () => {
    expect(dna('2x + 5 = 26')).not.toBe('balance-scale'); // x = 10.5
    expect(dna('x² + 5x + 6 = 0')).not.toBe('balance-scale');
    expect(dna('2x + 3y = 12 and x − y = 1')).not.toBe('balance-scale');
    expect(dna('x + 5 = 3x + 9')).not.toBe('balance-scale'); // more x on the right: not drawn
    expect(dna('y = 2x + 1')).not.toBe('balance-scale');
    expect(dna('The max + 5 = 25 ways')).not.toBe('balance-scale');
    expect(dna('The sum of the first 20 terms is 5 = 5')).not.toBe('balance-scale');
  });
  it('a story with unknowns stays a word problem', () => {
    const t = 'There are 100 beads, black and white, in a box. There are 10 more black than white. How many black and how many white? Let the number of black beads be x. Then 2x − 10 = 100.';
    expect(selectDna(block(t, 'problem'), 'Pairs of equations').dna).not.toBe('balance-scale');
  });
  it('finds the equations in a paragraph', () => {
    expect(findBalEquations('First 2x + 5 = 25, then 3x = 12 and 7x + 1 = 99.')).toEqual([{ a: 2, b: 5, c: 25, letter: 'x' }, { a: 3, b: 0, c: 12, letter: 'x' }]);
  });
});

describe('the offline planner', () => {
  it('writes the lesson from the equation in the text', () => {
    const p = offlineBalance('Solve 2x + 5 = 25.')!;
    expect(p).toMatchObject({ a: 2, b: 5, c: 25 });
    expect(p.steps.map((s) => s.op)).toEqual(['show', 'move', 'simplify', 'divide', 'answer', 'check']);
    expect(validatePlan('balance-scale', p, RD)).toEqual([]);
    const q = offlineBalance('x - 3 = 9')!;
    expect(q.steps.map((s) => s.op)).toEqual(['show', 'move', 'simplify', 'check']);
    const r = offlineBalance('4x = 28')!;
    expect(r.steps.map((s) => s.op)).toEqual(['show', 'divide', 'answer', 'check']);
    expect(offlineBalance('no equation here')).toBeNull();
    expect(offlineBalance('2x + 5 = 26')).toBeNull();
    expect(offlineBalance('3n + 4 = 22')!.letter).toBe('n');
  });
  it('every offline plan is bilingual and valid for every case', () => {
    for (const p of CASES.filter((_, i) => i % 11 === 0)) {
      const t = `${p.a > 1 ? p.a : ''}x ${p.b < 0 ? '−' : '+'} ${Math.abs(p.b)} = ${p.c}`.replace(' + 0', '').replace(' − 0', '');
      const o = offlineBalance(p.b === 0 ? `${p.a}x = ${p.c}` : t);
      expect(o, t).not.toBeNull();
      expect(validatePlan('balance-scale', o, RD), t).toEqual([]);
      for (const s of o!.steps) { expect(s.say.en.length).toBeGreaterThan(5); expect(/[ഀ-ൿ]/.test(s.say.ml ?? ''), s.say.ml).toBe(true); }
    }
  });
  it('offlinePlan uses it, and falls back to the chain when the scale cannot show the numbers', () => {
    const plan = offlinePlan(block('Solve 2x + 5 = 25', 'problem'), 'Linear equations', 'Solving');
    expect(plan.dna).toBe('balance-scale');
    expect((plan.teach as BalPlan).c).toBe(25);
    const other = offlinePlan(block('2x + 5 = 26', 'math'), 'Pairs of equations', 'Solving');
    expect(other.dna).not.toBe('balance-scale');
  });
});

describe('the class', () => {
  it('is a picture, not text', () => {
    for (const teach of BAL_SAMPLES) {
      expect(textOnlyWarning({ dna: 'balance-scale', teach })).toBeUndefined();
      expect(visualStats(buildDnaScenes('balance-scale', teach, 'en', 'T')).graphics).toBeGreaterThanOrEqual(5);
    }
  });
  it('compiles into a class and draws every frame in every format', { timeout: 120000 }, () => {
    const plan: BlockPlan = { blockId: 'b', dna: 'balance-scale', teach: BAL_TWO_STEP_SAMPLE, read: { en: 'x' }, warnings: [] } as unknown as BlockPlan;
    const segs = compileClass([block('Solve 2x + 5 = 25')], new Map([['b', plan]]), { title: 'T' });
    expect(segs.length).toBeGreaterThan(0);
    const noop = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? (x: string) => ({ width: x.length * 10 }) : () => undefined), set: () => true }) as unknown as CanvasRenderingContext2D;
    for (const teach of BAL_SAMPLES) {
      const sc = pans(teach, 'en')[0];
      for (const format of ['landscape', 'vertical', 'square'] as const) for (const theme of ['light', 'dark'] as const) for (const f of [0.1, 0.4, 0.7, 0.99]) drawMotionFrame(noop, sc, sc.durationMs * f, { format, theme } as never);
    }
  });
  it('nothing overlaps or leaves its area (every step of many cases)', { timeout: 180000 }, () => {
    const cases = [...BAL_SAMPLES, ...CASES.filter((_, i) => i % 7 === 0)];
    for (const teach of cases) {
      const sc = pans(teach, 'en')[0];
      for (let k = 0; k < sc.captions.length; k++) {
        const time = sc.captions[k].t1 - 40;
        const st = sc.items.filter((it) => it.kind === 'text').map((it) => evalItem(it, time)).filter((s) => s.alpha > 0.5).map((q) => {
          const w = tokenWidth(q.text, q.size);
          return { q, l: q.x - w / 2, r: q.x + w / 2 };
        });
        const tag = JSON.stringify([teach.a, teach.b, teach.c]);
        for (const b of st) {
          expect(b.l, `${tag} ${b.q.text}`).toBeGreaterThan(2);
          expect(b.r, `${tag} ${b.q.text}`).toBeLessThan(718);
          if (b.q.y >= 380) { expect(b.l, `${tag} ${b.q.text}`).toBeGreaterThanOrEqual(BALX - 1); expect(b.q.y, `${tag} ${b.q.text}`).toBeLessThan(560); }
          else expect(b.q.y, `${tag} ${b.q.text}`).toBeLessThan(330);
        }
        for (let i = 0; i < st.length; i++) for (let j = i + 1; j < st.length; j++) {
          if (Math.abs(st[i].q.y - st[j].q.y) > 14) continue;
          const gap = Math.max(st[i].l, st[j].l) - Math.min(st[i].r, st[j].r);
          expect(gap, `${tag} ${st[i].q.text} / ${st[j].q.text} at step ${k}`).toBeGreaterThanOrEqual(-1e-6);
        }
      }
    }
  });
  it('every tile label fits inside its tile', { timeout: 120000 }, () => {
    for (const teach of CASES.filter((_, i) => i % 13 === 0)) {
      const sc = pans(teach, 'en')[0];
      const t = sc.durationMs - 100;
      const labels = sc.items.filter((it) => it.kind === 'text').map((it) => evalItem(it, t)).filter((s) => s.y < 380 && s.alpha > 0.01);
      for (const l of labels) expect(tokenWidth(l.text, l.size), `${JSON.stringify([teach.a, teach.b, teach.c])} ${l.text}`).toBeLessThanOrEqual(TW.c);
    }
  });
  it('English and Malayalam pictures are identical; only captions differ', () => {
    const en = pans(BAL_TWO_STEP_SAMPLE, 'en')[0];
    const ml = pans(BAL_TWO_STEP_SAMPLE, 'ml')[0];
    expect(ml.items.map((it) => `${it.id}:${it.kind}:${it.text}`)).toEqual(en.items.map((it) => `${it.id}:${it.kind}:${it.text}`));
    expect(ml.captions.map((x) => x.text)).not.toEqual(en.captions.map((x) => x.text));
  });
  it('builds every case without throwing', { timeout: 120000 }, () => {
    for (const p of CASES.filter((_, i) => i % 5 === 0)) expect(() => buildDnaScenes('balance-scale', p, 'en', 'T')).not.toThrow();
  });
});

describe('the beam look (V51.9.65)', () => {
  it('is the default and draws a flat beam, tiles and aligned lines', () => {
    const sc = buildDnaScenes('balance-scale', BAL_TWO_STEP_SAMPLE, 'en', 'T')[0];
    const ids = sc.items.map((i) => i.id);
    expect(ids).toContain('beam');
    expect(ids).toContain('tri');
    expect(ids.some((i) => i.startsWith('rg'))).toBe(true); // rings on the working digits
    expect(ids.some((i) => i.startsWith('bl'))).toBe(false);
    expect(ids.some((i) => i.startsWith('hub'))).toBe(false);
  });
  it('digits that carry over fly: the same digit is drawn on a line and moves to the next', () => {
    const sc = buildDnaScenes('balance-scale', BAL_TWO_STEP_SAMPLE, 'en', 'T')[0];
    const texts = sc.items.filter((i) => i.kind === 'text' && i.text === '25');
    expect(texts.length).toBeGreaterThanOrEqual(3);
  });
  it('look pans keeps the old scale', () => {
    const sc = pans(BAL_TWO_STEP_SAMPLE, 'en')[0];
    expect(sc.items.some((i) => i.id === 'hub')).toBe(true);
  });
  it('English and Malayalam pictures are identical', () => {
    const shape = (l: 'en' | 'ml') => buildDnaScenes('balance-scale', BAL_TWO_STEP_SAMPLE, l, 'T')[0].items.map((i) => i.id + ':' + i.kind);
    expect(shape('en')).toEqual(shape('ml'));
  });
});

describe('V51.9.125 beam: every step stays, a note beside every line', () => {
  it('keeps all six lines on the board at the end, each with its note, in both languages', async () => {
    const { offlineBalance } = await import('./plan/offline');
    const { buildBeam } = await import('./dna/beam-builders');
    const { stepNote } = await import('./dna/bal-math');
    const plan = offlineBalance('Solve 2x + 5 = 25')!;
    expect(plan.steps.map((s) => s.op)).toEqual(['show', 'move', 'simplify', 'divide', 'answer', 'check']);
    for (const lang of ['en', 'ml'] as const) {
      const sc = buildBeam(plan, lang, 'Solve 2x + 5 = 25')[0];
      const end = sc.durationMs - 1;
      const shown = sc.items.filter((it) => it.kind === 'text' && it.alpha.at(end) > 0.5).map((it) => it.text);
      for (const op of plan.steps.map((s) => s.op)) expect(shown).toContain(stepNote(plan, op, lang));
      // all the working: 2x + 5 = 25, 2x = 25 − 5, 2x = 20, x = 20/2, x = 10, 2 × 10 + 5 = 25
      expect(shown.filter((s) => s === '=').length).toBeGreaterThanOrEqual(6);
    }
    expect(stepNote(plan, 'simplify', 'en')).toBe('25 − 5 = 20');
    expect(stepNote(plan, 'answer', 'ml')).toBe('20 ÷ 2 = 10');
    expect(stepNote(plan, 'move', 'ml')).toBe('ഇരുവശത്തും − 5');
  });
});
