import { describe, expect, it } from 'vitest';
import { drawMotionFrame, evalItem, type MotionScene } from '../reels/motion';
import { tokenWidth } from '../reels/motion/metrics';
import { selectDna } from './dna/registry';
import { buildDnaScenes } from './dna/builders';
import { CIRCLE, POSITIONS, TRI_BOX, angleAt, circleGeometry, circleLines, degreesIn, deg, isInterior, labelRadius, parGeometry, parValue, partnerOf, polar, relationIsEqual, sector, triGeometry, triLines, type Pos, type Relation } from './dna/a-math';
import { PX, PMAX } from './dna/a-builders';
import type { AnglePlan, BlockPlan } from './dna/types';
import type { BookBlock } from './segment';
import { validatePlan } from './plan/validate';
import { offlineAngle, offlinePlan } from './plan/offline';
import { textOnlyWarning, visualStats } from './plan/visual-qa';
import { compileClass, segmentReel } from './class';
import { ANGLE_CIRCLE_SAMPLE, ANGLE_PARALLEL_SAMPLE, ANGLE_SEMICIRCLE_SAMPLE, ANGLE_TRIANGLE_SAMPLE } from './samples/angle-geometry';

const block = (text: string, kind: BookBlock['kind'] = 'prose'): BookBlock => ({ id: 'b', kind, page: 1, chapterId: 'c', sectionId: 's', lines: [{ text, math: false } as BookBlock['lines'][number]], text });
const say = { en: 'x', ml: 'എ' };
const RD = { en: 'x', ml: 'എ' };
const RELS: Relation[] = ['vertical', 'linear', 'corresponding', 'alternate', 'cointerior'];
const THETAS = Array.from({ length: 121 }, (_, i) => 30 + i).filter((x) => x !== 90);

describe('parallel lines: the relations are true, checked against the drawn directions', () => {
  it('every angle at both intersections has the size its sector sweeps', () => {
    for (const th of THETAS) for (const pos of POSITIONS) {
      const [s0, s1] = sector(th, pos);
      expect(s1 - s0, `${th} ${pos}`).toBe(parValue(th, pos));
    }
    for (const th of THETAS) {
      // the four angles at one intersection fill the full turn
      const sum = (['tl', 'tr', 'bl', 'br'] as Pos[]).reduce((s, p) => s + parValue(th, p), 0);
      expect(sum).toBe(360);
    }
  });
  it('each relation joins the right pair: same-side / opposite-side, interior / exterior, same / other line', () => {
    for (const th of THETAS) {
      const g = parGeometry(th);
      // transversal direction (up-right) as an angle; the side of an angle = which side of the transversal its bisector is on
      const side = (pos: Pos) => {
        const [s0, s1] = sector(th, pos);
        const mid = ((s0 + s1) / 2) * (Math.PI / 180);
        const cross = Math.cos(th * (Math.PI / 180)) * Math.sin(mid) - Math.sin(th * (Math.PI / 180)) * Math.cos(mid);
        return Math.sign(cross);
      };
      const vertical = (pos: Pos) => {
        const [s0, s1] = sector(th, pos);
        return Math.sin(((s0 + s1) / 2) * (Math.PI / 180)) > 0 ? 'up' : 'down';
      };
      for (const from of POSITIONS) for (const rel of RELS) {
        const p = partnerOf(th, from, rel);
        expect(p.pos).not.toBe(from);
        expect(p.value).toBe(parValue(th, p.pos));
        expect(p.kind).toBe(parValue(th, from) === p.value ? 'equal' : 'sum');
        if (p.kind === 'sum') expect(parValue(th, from) + p.value).toBe(180);
        // the relation's truth: equal ones are equal, the others add up to 180°
        expect(p.kind === 'equal', `${th} ${from} ${rel}`).toBe(relationIsEqual(rel));
        const lowF = from.endsWith('2');
        const lowP = p.pos.endsWith('2');
        switch (rel) {
          case 'vertical':
            expect(lowP).toBe(lowF);
            expect(side(p.pos)).toBe(-side(from));
            expect(vertical(p.pos)).not.toBe(vertical(from));
            break;
          case 'linear':
            expect(lowP).toBe(lowF);
            expect(side(p.pos)).toBe(-side(from));
            expect(vertical(p.pos)).toBe(vertical(from));
            break;
          case 'corresponding':
            expect(lowP).toBe(!lowF);
            expect(side(p.pos)).toBe(side(from));
            expect(vertical(p.pos)).toBe(vertical(from));
            break;
          case 'alternate':
            expect(lowP).toBe(!lowF);
            expect(side(p.pos)).toBe(-side(from));
            expect(isInterior(p.pos)).toBe(isInterior(from));
            break;
          case 'cointerior':
            expect(lowP).toBe(!lowF);
            expect(side(p.pos)).toBe(side(from));
            expect(isInterior(p.pos)).toBe(isInterior(from));
            expect(vertical(p.pos)).not.toBe(vertical(from));
            break;
        }
      }
      // the figure: both intersections are on their lines and on the transversal
      expect(g.P[1]).toBe(g.top);
      expect(g.Q[1]).toBe(g.bottom);
      const dir = Math.atan2(g.P[1] - g.Q[1], g.P[0] - g.Q[0]);
      expect(Math.abs(Math.atan2(-(g.P[1] - g.Q[1]), g.P[0] - g.Q[0]) * (180 / Math.PI) - th)).toBeLessThan(1e-6);
      void dir;
      for (const p of [g.P, g.Q, g.t0, g.t1]) {
        expect(p[0]).toBeGreaterThan(30);
        expect(p[0]).toBeLessThan(420);
      }
    }
  });
  it('the lines of numbers are right', () => {
    expect(partnerOf(70, 'bl', 'alternate').lines).toEqual(['70° = 70°']);
    expect(partnerOf(70, 'bl', 'cointerior').lines).toEqual(['70° + 110° = 180°']);
    expect(partnerOf(70, 'tr', 'linear').lines).toEqual(['70° + 110° = 180°']);
    expect(partnerOf(70, 'tr', 'vertical').pos).toBe('bl');
    expect(partnerOf(70, 'bl', 'alternate').pos).toBe('tr2');
    expect(partnerOf(70, 'bl', 'cointerior').pos).toBe('tl2');
    expect(partnerOf(70, 'tl', 'alternate').pos).toBe('br2');
    expect(labelRadius(30)).toBeGreaterThan(labelRadius(120) - 1e-9);
  });
});

describe('triangle and circle: the numbers and the drawn points agree', () => {
  it('the drawn triangle has the angles asked for, the third angle and the exterior angle are right', () => {
    for (let A = 20; A <= 120; A += 5) for (let B = 20; B <= 120; B += 5) {
      if (A + B < 60 || A + B > 160) continue;
      const g = triGeometry(A, B);
      expect(angleAt(g.A, g.B, g.C)).toBeCloseTo(A, 6);
      expect(angleAt(g.B, g.A, g.C)).toBeCloseTo(B, 6);
      expect(angleAt(g.C, g.A, g.B)).toBeCloseTo(180 - A - B, 6);
      // exterior angle at C (between CA and the extension CD) = A + B
      expect(angleAt(g.C, g.A, g.D)).toBeCloseTo(A + B, 6);
      for (const p of [g.A, g.B, g.C, g.D]) {
        expect(p[0]).toBeGreaterThan(TRI_BOX.x0 - 1);
        expect(p[0]).toBeLessThan(TRI_BOX.x1 + 1);
        expect(p[1]).toBeGreaterThan(TRI_BOX.y0 - 1);
        expect(p[1]).toBeLessThan(TRI_BOX.y1 + 1);
      }
      const l = triLines(A, B);
      expect(l.C).toBe(180 - A - B);
      expect(l.exteriorValue).toBe(A + B);
    }
    expect(triLines(50, 60).find).toEqual(['C = 180° − 50° − 60°', 'C = 70°']);
    expect(triLines(50, 60).sum).toEqual(['50° + 60° + 70° = 180°']);
    expect(triLines(50, 60).exterior).toEqual(['70° + 110° = 180°', '110° = 50° + 60°']);
  });
  it('circle: centre = 2 × circumference, same arc equal, semicircle 90°, cyclic opposite angles add to 180°', () => {
    for (let beta = 20; beta <= 90; beta++) {
      const g = circleGeometry(beta);
      for (const p of [g.A, g.B, g.P, g.Q, g.M]) expect(Math.hypot(p[0] - g.O[0], p[1] - g.O[1])).toBeCloseTo(CIRCLE.r, 6);
      expect(angleAt(g.P, g.A, g.B), `P ${beta}`).toBeCloseTo(beta, 6);
      expect(angleAt(g.Q, g.A, g.B), `Q ${beta}`).toBeCloseTo(beta, 6);
      expect(angleAt(g.O, g.A, g.B), `O ${beta}`).toBeCloseTo(2 * beta, 6);
      expect(angleAt(g.M, g.A, g.B), `M ${beta}`).toBeCloseTo(180 - beta, 6);
      // Q is a different point on the same arc as P
      expect(Math.hypot(g.Q[0] - g.P[0], g.Q[1] - g.P[1])).toBeGreaterThan(30);
      const l = circleLines(beta);
      expect(l.alpha).toBe(2 * beta);
      expect(l.cyclicValue + beta).toBe(180);
    }
    expect(circleLines(40).double).toEqual(['2 × 40° = 80°']);
    expect(circleLines(40).cyclic).toEqual(['40° + 140° = 180°']);
    expect(polar([0, 0], 10, 90)[1]).toBeCloseTo(-10, 9);
  });
  it('degrees are read from text', () => {
    expect(degreesIn('The angle is 70° and another is 110 degrees; also 5 cm.')).toEqual([70, 110]);
    expect(deg(70)).toBe('70°');
  });
});

describe('validator', () => {
  const v = (plan: unknown) => validatePlan('angle-geometry', plan, undefined, true).join(' | ');
  const show = { op: 'show' as const, say };
  const par = (steps: AnglePlan['steps'], over: Partial<AnglePlan> = {}): AnglePlan => ({ figure: 'parallel', a: 70, steps, ...over });
  const tri = (steps: AnglePlan['steps'], over: Partial<AnglePlan> = {}): AnglePlan => ({ figure: 'triangle', A: 50, B: 60, steps, ...over });
  const cir = (steps: AnglePlan['steps'], over: Partial<AnglePlan> = {}): AnglePlan => ({ figure: 'circle', beta: 40, steps, ...over });
  it('samples pass', () => {
    for (const p of [ANGLE_PARALLEL_SAMPLE, ANGLE_TRIANGLE_SAMPLE, ANGLE_CIRCLE_SAMPLE, ANGLE_SEMICIRCLE_SAMPLE]) expect(validatePlan('angle-geometry', p, RD)).toEqual([]);
  });
  it('numbers and figure', () => {
    expect(v({ figure: 'square', steps: [show] })).toMatch(/figure must be/);
    expect(v(par([show], { a: 90 }))).toMatch(/not 90/);
    expect(v(par([show], { a: 29 }))).toMatch(/from 30 to 150/);
    expect(v(par([show], { a: 151 }))).toMatch(/from 30 to 150/);
    expect(v(par([show], { a: 70.5 }))).toMatch(/whole number/);
    expect(v(par([show], { at: 'middle' }))).toMatch(/at must be one of/);
    expect(v(tri([show], { A: 19 }))).toMatch(/from 20 to 120/);
    expect(v(tri([show], { A: 100, B: 70 }))).toMatch(/between 60 and 160/);
    expect(v(tri([show], { A: 20, B: 30 }))).toMatch(/between 60 and 160/);
    expect(v(cir([show], { beta: 19 }))).toMatch(/from 20 to 90/);
    expect(v(cir([show], { beta: 91 }))).toMatch(/from 20 to 90/);
  });
  it('steps belong to the figure and come in an order that works', () => {
    expect(v(par([{ op: 'vertical', say }]))).toMatch(/needs \{"op":"show"\}/);
    expect(v(par([show, show]))).toMatch(/only once/);
    expect(v(par([show, { op: 'sum', say }]))).toMatch(/not one of show, given/);
    expect(v(par([show, { op: 'alternate', say }]))).toMatch(/needs "given"/);
    expect(v(tri([show, { op: 'sum', say }]))).toMatch(/needs "angles"/);
    expect(v(tri([show, { op: 'angles', say }, { op: 'sum', say }, { op: 'find', say }]))).toMatch(/after "find"/);
    expect(v(tri([show, { op: 'angles', say }, { op: 'sum', say }]))).toBe('');
    expect(v(cir([show, { op: 'double', say }]))).toMatch(/needs "centre" and "circumference"/);
    expect(v(cir([show, { op: 'same-arc', say }]))).toMatch(/needs "circumference"/);
    expect(v(cir([show, { op: 'cyclic', say }]))).toMatch(/needs "circumference"/);
    expect(v(cir([show, { op: 'centre', say }, { op: 'centre', say }]))).toMatch(/"centre" only once/);
    expect(v(cir([show, { op: 'centre', say: { en: '', ml: 'എ' } }]))).toMatch(/say is required/);
    expect(v(cir([]))).toMatch(/must list the steps/);
  });
});

describe('what the board shows', () => {
  const [p] = buildDnaScenes('angle-geometry', ANGLE_PARALLEL_SAMPLE, 'en', 'T');
  const [t] = buildDnaScenes('angle-geometry', ANGLE_TRIANGLE_SAMPLE, 'en', 'T');
  const [c] = buildDnaScenes('angle-geometry', ANGLE_CIRCLE_SAMPLE, 'en', 'T');
  const [s] = buildDnaScenes('angle-geometry', ANGLE_SEMICIRCLE_SAMPLE, 'en', 'T');
  const vis = (sc: MotionScene, time: number) => sc.items.filter((it) => it.kind === 'text').map((it) => evalItem(it, time)).filter((st) => st.alpha > 0.5);
  const at = (sc: MotionScene, k: number, title: boolean) => sc.captions[k + (title ? 1 : 0)].t1 - 40;
  const texts = (sc: MotionScene, k: number, title: boolean) => vis(sc, at(sc, k, title)).map((q) => q.text);
  it('parallel: each relation writes its numbers and keeps the given angle', () => {
    expect(texts(p, 1, true)).toContain('70°');
    const lines: Record<number, string> = { 2: '70° = 70°', 3: '70° + 110° = 180°', 4: '70° = 70°', 5: '70° = 70°', 6: '70° + 110° = 180°' };
    for (const k of [2, 3, 4, 5, 6]) {
      const st = texts(p, k, true);
      expect(st, `step ${k}`).toContain(lines[k]);
      expect(st.filter((x) => x === '70°').length + st.filter((x) => x === '110°').length).toBe(2); // the given angle and its partner on the figure
    }
    // the previous partner is gone when the next relation comes
    expect(texts(p, 3, true)).not.toContain('70° = 70°');
  });
  it('parallel: the partner label sits in its sector, clear of both lines', () => {
    const q = vis(p, at(p, 5, true)).filter((x) => x.text === '70°' && x.x < 430);
    expect(q.length).toBe(2);
    const g = parGeometry(70);
    // alternate of bl is tr2 at the lower intersection: label above the bottom line, right of the transversal
    const lab = q.find((x) => Math.abs(x.y - g.Q[1]) < 90 && x.y < g.Q[1])!;
    expect(lab.x).toBeGreaterThan(g.Q[0]);
    expect(Math.abs(lab.y - g.bottom)).toBeGreaterThan(8);
  });
  it('triangle: ? becomes the found angle; the sum and exterior angle are written', () => {
    expect(texts(t, 1, false)).toEqual(expect.arrayContaining(['A', 'B', 'C', '50°', '60°', '?']));
    expect(texts(t, 1, false)).not.toContain('70°');
    const f = texts(t, 2, false);
    expect(f).toEqual(expect.arrayContaining(['C = 180° − 50° − 60°', 'C = 70°', '70°']));
    expect(f).not.toContain('?');
    expect(texts(t, 3, false)).toContain('50° + 60° + 70° = 180°');
    const e = texts(t, 4, false);
    expect(e).toEqual(expect.arrayContaining(['110°', '70° + 110° = 180°', '110° = 50° + 60°']));
  });
  it('circle: centre angle, circumference angle, double, same arc, cyclic', () => {
    expect(texts(c, 1, false)).toContain('80°');
    expect(texts(c, 2, false)).toEqual(expect.arrayContaining(['80°', '40°', 'P']));
    expect(texts(c, 3, false)).toContain('2 × 40° = 80°');
    const same = texts(c, 4, false);
    expect(same).toContain('40° = 40°');
    expect(same.filter((x) => x === '40°').length).toBe(2); // at P and at Q
    const cy = texts(c, 5, false);
    expect(cy).toEqual(expect.arrayContaining(['40° + 140° = 180°', '140°', 'R']));
    expect(cy).not.toContain('80°'); // the centre angle stepped aside
    expect(cy).not.toContain('Q');
  });
  it('semicircle: 180° at the centre, a right-angle mark and 90° at P', () => {
    expect(texts(s, 1, false)).toContain('180°');
    expect(texts(s, 2, false)).toContain('90°');
    expect(texts(s, 3, false)).toContain('2 × 90° = 180°');
    expect(s.items.some((it) => it.kind === 'poly' && /^ra/.test(it.id))).toBe(true);
  });
  it('nothing overlaps or leaves its area', () => {
    for (const [sc, title] of [[p, true], [t, false], [c, false], [s, false]] as const) for (let k = 0; k < sc.captions.length; k++) {
      const time = sc.captions[k].t1 - 40;
      void title;
      const st = vis(sc, time).map((q) => {
        const w = tokenWidth(q.text, q.size);
        return { q, l: q.x - w / 2, r: q.x + w / 2 };
      });
      for (const b of st) {
        expect(b.l, b.q.text).toBeGreaterThan(2);
        expect(b.r, b.q.text).toBeLessThan(718);
        if (b.l > PX - 4) expect(b.r, b.q.text).toBeLessThanOrEqual(PX + PMAX + 1);
      }
      for (let i = 0; i < st.length; i++) for (let j = i + 1; j < st.length; j++) {
        if (Math.abs(st[i].q.y - st[j].q.y) > 14) continue;
        const gap = Math.max(st[i].l, st[j].l) - Math.min(st[i].r, st[j].r);
        expect(gap, `${st[i].q.text} / ${st[j].q.text} at ${time}`).toBeGreaterThanOrEqual(-1e-6);
      }
    }
  });
  it('English and Malayalam pictures are identical; only captions differ', () => {
    const ml = buildDnaScenes('angle-geometry', ANGLE_PARALLEL_SAMPLE, 'ml', 'T')[0];
    expect(ml.items.map((it) => `${it.id}:${it.kind}:${it.text}`)).toEqual(p.items.map((it) => `${it.id}:${it.kind}:${it.text}`));
    expect(ml.captions.map((x) => x.text)).not.toEqual(p.captions.map((x) => x.text));
  });
});

describe('selection', () => {
  const pick = (text: string, kind: BookBlock['kind'] = 'prose') => selectDna(block(text, kind)).dna;
  it('angle talk → angle-geometry', () => {
    expect(pick('When a transversal cuts two parallel lines, the corresponding angles are equal.')).toBe('angle-geometry');
    expect(pick('The sum of the angles of a triangle is 180°.')).toBe('angle-geometry');
    expect(pick('An exterior angle of a triangle is equal to the sum of the two interior opposite angles.')).toBe('angle-geometry');
    expect(pick('The angle at the centre of a circle is twice the angle at the circumference on the same arc.')).toBe('angle-geometry');
    expect(pick('The angle in a semicircle is a right angle.')).toBe('angle-geometry');
    expect(pick('The opposite angles of a cyclic quadrilateral add up to 180°.')).toBe('angle-geometry');
    expect(pick('Two lines that cross make vertically opposite angles. A linear pair adds up to 180°.')).toBe('angle-geometry');
  });
  it('the same words elsewhere stay elsewhere', () => {
    expect(pick('Find the area of a circle of radius 5 cm.', 'exercise')).not.toBe('angle-geometry');
    expect(pick('Solve x² − 5x + 6 = 0 by factorising.', 'exercise')).toBe('quadratic-equation');
    expect(pick('By the remainder theorem, when a polynomial P(x) is divided by x − a, the remainder is P(a).')).toBe('polynomial');
    expect(pick('The sine of 30° is 1/2 and the cosine is √3/2.')).toBe('unit-circle');
    expect(pick('A pair of linear equations in two variables can be solved by the graphical method.')).toBe('linear-system');
    expect(pick('Draw a triangle whose sides are 3 cm, 4 cm and 5 cm.')).not.toBe('angle-geometry');
  });
});

describe('offline planner', () => {
  it('parallel lines: the first usable angle, the relations named in the text', () => {
    const q = offlineAngle('Two parallel lines are cut by a transversal. One angle is 65°. Find the corresponding angle and the alternate angle.')!;
    expect(q).toMatchObject({ figure: 'parallel', a: 65 });
    expect(q.steps.map((x) => x.op)).toEqual(['show', 'given', 'corresponding', 'alternate']);
    expect(validatePlan('angle-geometry', q, RD)).toEqual([]);
    const all = offlineAngle('A transversal cuts parallel lines and makes an angle of 70°.')!;
    expect(all.steps.map((x) => x.op)).toEqual(['show', 'given', 'vertical', 'corresponding', 'alternate', 'cointerior']);
    expect(validatePlan('angle-geometry', all, RD)).toEqual([]);
    expect(offlineAngle('Two parallel lines are cut by a transversal.')).toBeNull();
    expect(offlineAngle('A transversal makes a right angle of 90°.')).toBeNull();
  });
  it('triangle: two angles, the third found, the exterior angle when named', () => {
    const q = offlineAngle('The angles of a triangle are 50° and 60°. Find the third angle using the angle sum, and the exterior angle.')!;
    expect(q).toMatchObject({ figure: 'triangle', A: 50, B: 60 });
    expect(q.steps.map((x) => x.op)).toEqual(['show', 'angles', 'find', 'sum', 'exterior']);
    expect(validatePlan('angle-geometry', q, RD)).toEqual([]);
    expect(offlineAngle('The sum of the angles of a triangle is 180°.')).toBeNull();
  });
  it('circle: centre or circumference angle, semicircle, cyclic quadrilateral', () => {
    const a = offlineAngle('The angle at the centre of a circle is 80°. Find the angle at the circumference on the same arc.')!;
    expect(a).toMatchObject({ figure: 'circle', beta: 40 });
    expect(validatePlan('angle-geometry', a, RD)).toEqual([]);
    const b = offlineAngle('Prove that the angle in a semicircle is a right angle.')!;
    expect(b).toMatchObject({ figure: 'circle', beta: 90 });
    const c = offlineAngle('In a cyclic quadrilateral, an angle at the circumference is 70°.')!;
    expect(c.steps.map((x) => x.op)).toContain('cyclic');
    expect(validatePlan('angle-geometry', c, RD)).toEqual([]);
  });
  it('falls back with a warning when no angle is given', () => {
    const pl = offlinePlan(block('We study the angles made when a transversal cuts parallel lines.'), '', '');
    expect(pl.dna).toBe('concept-board');
    expect(pl.warnings?.join()).toMatch(/AI planner needed/);
    expect(offlinePlan(block('A transversal cuts two parallel lines and makes an angle of 70°. Find the alternate angle.', 'exercise'), '', '').dna).toBe('angle-geometry');
  });
});

describe('picture and class', () => {
  const ALL = [ANGLE_PARALLEL_SAMPLE, ANGLE_TRIANGLE_SAMPLE, ANGLE_CIRCLE_SAMPLE, ANGLE_SEMICIRCLE_SAMPLE];
  it('samples are real pictures', () => {
    for (const teach of ALL) {
      expect(textOnlyWarning({ dna: 'angle-geometry', teach })).toBeUndefined();
      expect(visualStats(buildDnaScenes('angle-geometry', teach, 'en', 'T')).graphics).toBeGreaterThanOrEqual(5);
    }
  });
  it('compiles into a class with one caption per step', () => {
    const plan: BlockPlan = { blockId: 'b', dna: 'angle-geometry', read: RD, teach: ANGLE_CIRCLE_SAMPLE, source: 'fixture' };
    const segs = compileClass([block('Angles in a circle.')], new Map([['b', plan]]), { title: 'T' });
    for (const seg of segs.filter((x) => x.phase === 'teach')) expect(segmentReel(seg).parts[0].captions.length).toBe(ANGLE_CIRCLE_SAMPLE.steps.length + (ANGLE_CIRCLE_SAMPLE.title ? 1 : 0));
  });
  it('draws without error in every format and theme', () => {
    const noop = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? (x: string) => ({ width: x.length * 10 }) : () => undefined), set: () => true }) as unknown as CanvasRenderingContext2D;
    for (const teach of ALL) {
      const sc = buildDnaScenes('angle-geometry', teach, 'ml', 'T')[0];
      for (const format of ['landscape', 'vertical', 'square'] as const) for (const theme of ['light', 'dark'] as const) for (const f of [0.1, 0.4, 0.7, 0.99]) drawMotionFrame(noop, sc, sc.durationMs * f, { format, theme } as never);
    }
  });
  it('builds and validates for every angle, position and figure', { timeout: 120000 }, () => {
    for (const th of THETAS.filter((x) => x % 7 === 0 || x === 30 || x === 150)) for (const pos of POSITIONS) {
      const plan: AnglePlan = { figure: 'parallel', a: th, at: pos, steps: [{ op: 'show', say }, { op: 'given', say }, ...RELS.map((op) => ({ op, say }) as AnglePlan['steps'][number])] };
      expect(validatePlan('angle-geometry', plan, RD), `${th} ${pos}`).toEqual([]);
      expect(() => buildDnaScenes('angle-geometry', plan, 'en', 'T')).not.toThrow();
    }
    for (let A = 20; A <= 120; A += 10) for (let B = 20; B <= 120; B += 10) {
      if (A + B < 60 || A + B > 160) continue;
      const plan: AnglePlan = { figure: 'triangle', A, B, steps: [{ op: 'show', say }, { op: 'angles', say }, { op: 'find', say }, { op: 'sum', say }, { op: 'exterior', say }] };
      expect(validatePlan('angle-geometry', plan, RD), `${A} ${B}`).toEqual([]);
      expect(() => buildDnaScenes('angle-geometry', plan, 'en', 'T')).not.toThrow();
    }
    for (let beta = 20; beta <= 90; beta += 5) {
      const plan: AnglePlan = { figure: 'circle', beta, steps: [{ op: 'show', say }, { op: 'centre', say }, { op: 'circumference', say }, { op: 'double', say }, { op: 'same-arc', say }, { op: 'cyclic', say }] };
      expect(validatePlan('angle-geometry', plan, RD), `${beta}`).toEqual([]);
      expect(() => buildDnaScenes('angle-geometry', plan, 'en', 'T')).not.toThrow();
    }
  });
});
