import { describe, expect, it } from 'vitest';
import { drawMotionFrame, evalItem, pointsAt, type MotionScene } from '../reels/motion';
import { selectDna } from './dna/registry';
import { buildDnaScenes } from './dna/builders';
import { ANGLE_MAX, ANGLE_MIN, CENTER, EXACT, IDENTITY, RATIOS, RATIO_COLOR, fitRadius, geometry, identityHolds, labelPlace, ratioValue, segLength, tokenNumber, valueToken, type Ratio } from './dna/trig-math';
import type { BlockPlan, TrigPlan } from './dna/types';
import type { BookBlock } from './segment';
import { validatePlan } from './plan/validate';
import { offlinePlan, offlineTrig } from './plan/offline';
import { textOnlyWarning, visualStats } from './plan/visual-qa';
import { compileClass, segmentReel } from './class';
import { TRIG_RATIOS_SAMPLE, TRIG_SPECIAL_SAMPLE } from './samples/unit-circle';

const block = (text: string, kind: BookBlock['kind'] = 'prose'): BookBlock => ({ id: 'b', kind, page: 1, chapterId: 'c', sectionId: 's', lines: [{ text, math: false } as BookBlock['lines'][number]], text });
const say = { en: 'x', ml: 'എ' };
const RD = { en: 'x', ml: 'എ' };
const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol;
const texts = (s: MotionScene, at?: number) => s.items.filter((i) => i.kind === 'text').map((i) => evalItem(i, at ?? s.durationMs + 10)).filter((st) => st.alpha > 0.5).map((st) => st.text);

describe('each drawn segment IS its ratio (unit circle geometry)', () => {
  it('lengths = cos, sin, tan, cot, sec, csc × R for every angle', () => {
    for (let deg = ANGLE_MIN; deg <= ANGLE_MAX; deg++) {
      const R = 100;
      const g = geometry(deg, R);
      for (const r of RATIOS) expect(segLength(g, r) / R, `${r} at ${deg}°`).toBeCloseTo(ratioValue(r, deg), 9);
    }
  });
  it('P is on the circle; the tangent at P is perpendicular to the radius and meets the axes at X and Y', () => {
    for (let deg = ANGLE_MIN; deg <= ANGLE_MAX; deg += 5) {
      const g = geometry(deg, 90);
      const [ox, oy] = CENTER;
      expect(near(Math.hypot(g.P[0] - ox, g.P[1] - oy), 90, 1e-9)).toBe(true);
      expect(near((g.X[0] - g.P[0]) * (g.P[0] - ox) + (g.X[1] - g.P[1]) * (g.P[1] - oy), 0, 1e-6)).toBe(true);
      expect(near((g.Y[0] - g.P[0]) * (g.P[0] - ox) + (g.Y[1] - g.P[1]) * (g.P[1] - oy), 0, 1e-6)).toBe(true);
      expect(g.X[1]).toBe(oy);
      expect(g.Y[0]).toBe(ox);
      // P, X, Y on one line
      const cross = (g.X[0] - g.P[0]) * (g.Y[1] - g.P[1]) - (g.X[1] - g.P[1]) * (g.Y[0] - g.P[0]);
      expect(near(cross, 0, 1e-6)).toBe(true);
    }
  });
  it('cos and sin are the coordinates of P', () => {
    const g = geometry(40, 100);
    expect(near((g.P[0] - CENTER[0]) / 100, Math.cos((40 * Math.PI) / 180), 1e-9)).toBe(true);
    expect(near((CENTER[1] - g.P[1]) / 100, Math.sin((40 * Math.PI) / 180), 1e-9)).toBe(true);
  });
  it('the circle is sized so every segment stays on the board', () => {
    for (let deg = ANGLE_MIN; deg <= ANGLE_MAX; deg++) {
      const R = fitRadius([deg]);
      const g = geometry(deg, R);
      for (const r of RATIOS) for (const [x, y] of g.seg[r]) {
        expect(x).toBeGreaterThanOrEqual(20);
        expect(x).toBeLessThanOrEqual(CENTER[0] + 200);
        expect(y).toBeGreaterThanOrEqual(36);
      }
    }
    expect(fitRadius([30, 60])).toBeLessThanOrEqual(fitRadius([45]));
    expect(fitRadius([ANGLE_MIN, ANGLE_MAX])).toBeGreaterThanOrEqual(40);
  });
  it('labels read along their segments and never upside down', () => {
    for (let deg = ANGLE_MIN; deg <= ANGLE_MAX; deg += 5) {
      const g = geometry(deg, 90);
      for (const r of RATIOS) {
        const { rot } = labelPlace(g, r);
        expect(rot).toBeGreaterThanOrEqual(-Math.PI / 2 - 1e-9);
        expect(rot).toBeLessThanOrEqual(Math.PI / 2 + 1e-9);
      }
      // tan label parallel to the tangent segment
      const t = g.seg.tan;
      const slope = Math.atan((t[1][1] - t[0][1]) / (t[1][0] - t[0][0]));
      expect(near(labelPlace(g, 'tan').rot, slope, 1e-9)).toBe(true);
    }
  });
});

describe('values and identities', () => {
  it('the exact table is true', () => {
    for (const deg of [30, 45, 60] as const) for (const r of RATIOS) expect(tokenNumber(EXACT[deg][r]), `${r} ${deg}`).toBeCloseTo(ratioValue(r, deg), 9);
  });
  it('special angles are exact, others are rounded decimals', () => {
    expect(valueToken('sin', 30)).toEqual({ text: '{1/2}', exact: true });
    expect(valueToken('tan', 60)).toEqual({ text: '√3', exact: true });
    expect(valueToken('sin', 37)).toEqual({ text: '0.6', exact: false });
    expect(valueToken('tan', 55)).toEqual({ text: '1.43', exact: false });
    expect(tokenNumber('{1/√3}')).toBeCloseTo(0.57735, 4);
  });
  it('the three Pythagorean identities hold at every angle', () => {
    for (const k of Object.keys(IDENTITY) as Array<keyof typeof IDENTITY>) for (let deg = ANGLE_MIN; deg <= ANGLE_MAX; deg++) expect(identityHolds(k, deg)).toBe(true);
  });
  it('reciprocal and quotient relations (what the formulas say)', () => {
    for (let deg = ANGLE_MIN; deg <= ANGLE_MAX; deg += 3) {
      const v = (r: Ratio) => ratioValue(r, deg);
      expect(near(v('tan'), v('sin') / v('cos'), 1e-9)).toBe(true);
      expect(near(v('cot'), v('cos') / v('sin'), 1e-9)).toBe(true);
      expect(near(v('sec'), 1 / v('cos'), 1e-9)).toBe(true);
      expect(near(v('csc'), 1 / v('sin'), 1e-9)).toBe(true);
    }
  });
});

describe('samples pass the same validator as AI plans', () => {
  it('ratios and special-angle samples (EN + ML)', () => {
    for (const p of [TRIG_RATIOS_SAMPLE, TRIG_SPECIAL_SAMPLE]) expect(validatePlan('unit-circle', p, RD)).toEqual([]);
  });
});

describe('validator rejects what cannot be drawn or is not true', () => {
  const v = (plan: unknown) => validatePlan('unit-circle', plan, undefined, true).join(' | ');
  const show = { op: 'show' as const, say };
  const point = { op: 'point' as const, say };
  const legs = { op: 'legs' as const, say };
  const plan = (steps: TrigPlan['steps'], angle = 30): TrigPlan => ({ angle, steps });
  it('angle', () => {
    expect(v(plan([show], 10))).toMatch(/whole number of degrees from 20 to 70/);
    expect(v(plan([show], 45.5))).toMatch(/whole number/);
    expect(v({ steps: [show] })).toMatch(/angle must be/);
  });
  it('order', () => {
    expect(v(plan([point]))).toMatch(/needs \\{"op":"show"\\}|needs \{"op":"show"\}/);
    expect(v(plan([show, show]))).toMatch(/only once/);
    expect(v(plan([show, legs]))).toMatch(/"legs" needs "point"/);
    expect(v(plan([show, point, { op: 'ratio', which: 'tan', say }]))).toMatch(/needs "legs"/);
    expect(v(plan([show, point, legs, { op: 'ratio', which: 'tan', say }, { op: 'ratio', which: 'tan', say }]))).toMatch(/already drawn/);
    expect(v(plan([show, point, legs, { op: 'ratio', which: 'sinh' as 'sin', say }]))).toMatch(/which must be one of/);
    expect(v(plan([show, point, { op: 'values', say }]))).toMatch(/at least one "ratio"/);
    expect(v(plan([show, { op: 'box', say }]))).toMatch(/at least one "ratio"/);
    expect(v(plan([show, { op: 'sweep', to: 40, say }]))).toMatch(/needs "point"/);
    expect(v(plan([show, { op: 'identity', which: 'pythagorean', say }]))).toMatch(/needs "point"/);
  });
  it('sweep and identity', () => {
    expect(v(plan([show, point, { op: 'sweep', to: 80, say }]))).toMatch(/from 20 to 70/);
    expect(v(plan([show, point, { op: 'sweep', to: 30, say }]))).toMatch(/already at \(30°\)/);
    expect(v(plan([show, point, { op: 'sweep', to: 45, say }, { op: 'sweep', to: 45, say }]))).toMatch(/already at \(45°\)/);
    expect(v(plan([show, point, { op: 'identity', which: 'sin-cos' as 'pythagorean', say }]))).toMatch(/pythagorean, tan-sec or cot-csc/);
  });
  it('captions, unknown ops, empty steps', () => {
    expect(v(plan([show, { op: 'point', say: { en: '', ml: 'എ' } }]))).toMatch(/say is required/);
    expect(v(plan([show, { op: 'spin' as 'point', say }]))).toMatch(/not one of/);
    expect(validatePlan('unit-circle', { angle: 30, steps: [] }, undefined, true).join()).toMatch(/must list the steps/);
  });
});

describe('what the board shows', () => {
  const [s] = buildDnaScenes('unit-circle', TRIG_RATIOS_SAMPLE, 'en', 'T');
  const end = s.durationMs + 10;
  const item = (id: string) => s.items.find((i) => i.id === id)!;
  it('after the sweep every drawn segment, the point and the labels sit where the new angle puts them', () => {
    const R = fitRadius([35, 55]);
    const g = geometry(55, R);
    const segs = s.items.filter((i) => /^seg\d+$/.test(i.id));
    expect(segs.length).toBe(5); // cos, tan, cot, sec, csc (sin reuses the vertical leg)
    const want = [g.seg.cos, g.seg.tan, g.seg.cot, g.seg.sec, g.seg.csc];
    segs.forEach((seg, k) => {
      const p = pointsAt(seg, end)!;
      expect(p[0][0]).toBeCloseTo(want[k][0][0], 3);
      expect(p[0][1]).toBeCloseTo(want[k][0][1], 3);
      expect(p[1][0]).toBeCloseTo(want[k][1][0], 3);
      expect(p[1][1]).toBeCloseTo(want[k][1][1], 3);
    });
    const dot = evalItem(item('pdot'), end);
    expect(dot.x).toBeCloseTo(g.P[0], 3);
    expect(dot.y).toBeCloseTo(g.P[1], 3);
    const yLeg = pointsAt(item('yleg'), end)!;
    expect(yLeg[1][0]).toBeCloseTo(g.P[0], 3);
    expect(yLeg[1][1]).toBeCloseTo(g.P[1], 3);
  });
  it('labels turn with their segments (rotation follows the sweep)', () => {
    const g0 = geometry(35, fitRadius([35, 55]));
    const g1 = geometry(55, fitRadius([35, 55]));
    const lab = s.items.find((i) => i.kind === 'text' && i.text === 'tan(θ)')!;
    expect(evalItem(lab, 0).rot).toBeCloseTo(labelPlace(g0, 'tan').rot, 6);
    expect(evalItem(lab, end).rot).toBeCloseTo(labelPlace(g1, 'tan').rot, 6);
    expect(labelPlace(g0, 'tan').rot).not.toBeCloseTo(labelPlace(g1, 'tan').rot, 2);
  });
  it('formulas are written in the ratio colour; the identity and box appear', () => {
    const t = texts(s);
    for (const w of ['cos(θ) =', 'sin(θ) =', 'tan(θ) =', '{sin(θ)/cos(θ)}', '{1/cos(θ)}', '{1/sin(θ)}', IDENTITY.pythagorean]) expect(t).toContain(w);
    const eq = s.items.find((i) => i.text === 'cot(θ) =')!;
    expect(evalItem(eq, end).color.toLowerCase()).toBe(RATIO_COLOR.cot);
    expect(s.items.some((i) => /^box\d+$/.test(i.id))).toBe(true);
  });
  it('special-angle values are exact at 30, 45 and 60 degrees', () => {
    const [sp] = buildDnaScenes('unit-circle', TRIG_SPECIAL_SAMPLE, 'en', 'T');
    const caps = sp.captions;
    const at = (k: number) => caps[k].t1 + 3000; // after the values have appeared
    const first = texts(sp, at(6));
    for (const w of ['cos(30°) =', '{√3/2}', 'sin(30°) =', '{1/2}', 'tan(30°) =', '{1/√3}']) expect(first).toContain(w);
    const last = texts(sp);
    for (const w of ['cos(60°) =', '{1/2}', 'sin(60°) =', '{√3/2}', 'tan(60°) =', '√3']) expect(last).toContain(w);
    expect(last).not.toContain('cos(30°) =');
  });
  it('other angles show rounded values with ≈', () => {
    const plan: TrigPlan = { angle: 37, steps: [{ op: 'show', say }, { op: 'point', say }, { op: 'legs', say }, { op: 'ratio', which: 'sin', say }, { op: 'ratio', which: 'tan', say }, { op: 'values', say }] };
    const [sc] = buildDnaScenes('unit-circle', plan, 'en', 'T');
    const t = texts(sc);
    expect(t).toContain('sin(37°) ≈');
    expect(t).toContain('0.6');
    expect(t).toContain('tan(37°) ≈');
    expect(t).toContain('0.75');
  });
});

describe('English and Malayalam share the same picture', () => {
  it('identical items, kinds, texts and places; only the captions change language', () => {
    const en = buildDnaScenes('unit-circle', TRIG_RATIOS_SAMPLE, 'en', 'T')[0];
    const ml = buildDnaScenes('unit-circle', TRIG_RATIOS_SAMPLE, 'ml', 'T')[0];
    expect(ml.items.map((i) => `${i.id}:${i.kind}:${i.text}`)).toEqual(en.items.map((i) => `${i.id}:${i.kind}:${i.text}`));
    expect(ml.captions.map((c) => c.text)).not.toEqual(en.captions.map((c) => c.text));
  });
});

describe('rotated text (engine)', () => {
  it('drawing a rotated label rotates the canvas', () => {
    let rot = 0;
    const ctx = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? (s: string) => ({ width: s.length * 10 }) : k === 'rotate' ? () => rot++ : () => undefined), set: () => true }) as unknown as CanvasRenderingContext2D;
    const sc = buildDnaScenes('unit-circle', TRIG_RATIOS_SAMPLE, 'en', 'T')[0];
    drawMotionFrame(ctx, sc, sc.durationMs, { format: 'landscape' } as never);
    expect(rot).toBeGreaterThanOrEqual(3); // tan, cot, csc, sin labels
  });
});

describe('selection', () => {
  const pick = (t: string, kind: BookBlock['kind'] = 'prose') => selectDna(block(t, kind)).dna;
  it('trigonometry talk → the unit circle', () => {
    expect(pick('Trigonometric ratios: in a right triangle the sine of an angle is the opposite side divided by the hypotenuse.')).toBe('unit-circle');
    expect(pick('On the unit circle the cosine of an angle θ is the x coordinate of the point and the sine is the y coordinate.')).toBe('unit-circle');
    expect(pick('Find the value of sin 30° + cos 60°.', 'exercise')).not.toBe('shape-formula');
    expect(pick('The tangent of an angle is sine divided by cosine; cosecant and secant are their reciprocals.')).toBe('unit-circle');
  });
  it('the same words elsewhere stay elsewhere', () => {
    expect(pick('A tangent to a circle is perpendicular to the radius at the point of contact.')).not.toBe('unit-circle');
    expect(pick('The area of a circle of radius r is πr² and its circumference is 2πr.')).toBe('shape-formula');
    expect(pick('The union of two sets A and B contains every element that is in A or in B. The intersection A ∩ B.')).toBe('venn-sets');
    expect(pick('A secant of a circle meets it at two points.')).not.toBe('unit-circle');
  });
});

describe('offline planner', () => {
  it('builds valid plans, using the angle in the text', () => {
    const t = 'Trigonometric ratios of 45° : sine, cosine and tangent. Also cot, sec and cosec.';
    const p = offlinePlan(block(t), '', '');
    expect(p.dna).toBe('unit-circle');
    expect(validatePlan('unit-circle', p.teach, { en: t, ml: 'എ' })).toEqual([]);
    expect((p.teach as TrigPlan).angle).toBe(45);
    expect((p.teach as TrigPlan).steps.filter((s) => s.op === 'ratio').length).toBe(6);
    const small = offlineTrig('The sine and cosine of an angle.');
    expect(small.angle).toBe(30);
    expect(small.steps.filter((s) => s.op === 'ratio').length).toBe(3);
    expect(validatePlan('unit-circle', small, RD)).toEqual([]);
  });
});

describe('picture and class', () => {
  it('samples are real pictures', () => {
    for (const teach of [TRIG_RATIOS_SAMPLE, TRIG_SPECIAL_SAMPLE]) {
      expect(textOnlyWarning({ dna: 'unit-circle', teach })).toBeUndefined();
      expect(visualStats(buildDnaScenes('unit-circle', teach, 'en', 'T')).graphics).toBeGreaterThanOrEqual(8);
    }
  });
  it('compiles into a class with one caption per step', () => {
    const plan: BlockPlan = { blockId: 'b', dna: 'unit-circle', read: RD, teach: TRIG_RATIOS_SAMPLE, source: 'fixture' };
    const segs = compileClass([block('Trigonometric ratios.')], new Map([['b', plan]]), { title: 'T' });
    for (const seg of segs.filter((s) => s.phase === 'teach')) expect(segmentReel(seg).parts[0].captions.length).toBe(TRIG_RATIOS_SAMPLE.steps.length + 1);
  });
  it('draws without error in every format and theme', () => {
    const noop = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? (s: string) => ({ width: s.length * 10 }) : () => undefined), set: () => true }) as unknown as CanvasRenderingContext2D;
    for (const teach of [TRIG_RATIOS_SAMPLE, TRIG_SPECIAL_SAMPLE]) {
      const sc = buildDnaScenes('unit-circle', teach, 'ml', 'T')[0];
      for (const format of ['landscape', 'vertical', 'square'] as const) for (const theme of ['light', 'dark'] as const) for (const f of [0.1, 0.4, 0.7, 0.99]) drawMotionFrame(noop, sc, sc.durationMs * f, { format, theme } as never);
    }
  });
});
