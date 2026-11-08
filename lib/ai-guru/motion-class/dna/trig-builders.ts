/**
 * DNA builder for trigonometric ratios on the unit circle (V51.9.27): axes and a circle of radius 1;
 * a point (x, y) at angle θ with its right triangle; then each ratio appears as a coloured SEGMENT
 * labelled along it (cos and sin are the legs, tan and cot are the two pieces of the tangent line,
 * sec and csc reach the axes), with its formula in the same colour; the point can slide to a new
 * angle while every segment follows; the values (exact for 30°, 45°, 60°) and the Pythagorean
 * identities close the lesson.
 *
 * The planner chooses the angle and the order. The app computes every point and length (trig-math.ts),
 * so each drawn segment IS the ratio it is labelled with, and writes every value. English and
 * Malayalam classes have identical pictures; only the captions change language.
 */

import { Motion, ease, type MotionScene } from '../../reels/motion/engine';
import { DUR, type Role } from '../../reels/motion/grammar';
import { tokenWidth } from '../../reels/motion/metrics';
import { circlePts, rightAnglePts } from '../../reels/motion/shapes';
import type { Lang } from '../../reels/motion/captions';
import type { Bi, TrigPlan } from './types';
import { CENTER, FORMULA, IDENTITY, RATIO_COLOR, geometry, fitRadius, identityHolds, labelPlace, valueToken, type Pt, type Ratio } from './trig-math';

const pick = (b: Bi | undefined, lang: Lang): string => (b ? (lang === 'ml' ? b.ml || b.en : b.en) : '');
const SCENE_W = 720;
const SCENE_H = 444;
const PANEL_X = 586;
const SLOT_Y0 = 78;
const SLOT_DY = 62;
const EQ_SIZE = 24;
const AXIS = '#8d8d9b';
const CIRCLE = '#7d7d8c';

/** Angles the plan visits (start and every sweep target): the circle is sized so all of them fit. */
export const anglesOf = (plan: TrigPlan): number[] => [plan.angle, ...plan.steps.flatMap((s) => (s.op === 'sweep' ? [s.to] : []))];

export function buildTrig(plan: TrigPlan, lang: Lang, title: string): MotionScene[] {
  const m = new Motion(title, SCENE_W, SCENE_H);
  m.fixView(SCENE_W / 2, SCENE_W);
  const R = fitRadius(anglesOf(plan));
  const O = CENTER;
  let theta = plan.angle;
  let t = 300;
  let uid = 0;
  const segIds: Partial<Record<Ratio, string>> = {};
  const segLbl: Partial<Record<Ratio, string>> = {};
  const drawn: Ratio[] = [];
  let formulas: string[] = [];
  let values: string[] = [];
  const f: { radius?: string; dot?: string; arc?: string; thetaL?: string; oneL?: string; ptL?: string; mark?: string; xLeg?: string; yLeg?: string; xL?: string; yL?: string } = {};

  const slotY = (k: number) => SLOT_Y0 + k * SLOT_DY;
  const fade = (ids: string[], at: number, dur = 300) => {
    for (const i of ids) m.get(i).alpha.to(at, dur, 0);
  };
  const place = (id: string, p: Pt, at: number, dur: number) => {
    const it = m.get(id);
    it.x.to(at, dur, p[0], ease.linear);
    it.y.to(at, dur, p[1], ease.linear);
  };

  /** Moves every angle-dependent item to angle `deg` over [at, at + dur]. */
  const follow = (deg: number, at: number, dur: number) => {
    const g = geometry(deg, R, O);
    const lin = { dur, e: ease.linear };
    const mid: Pt = [(O[0] + g.P[0]) / 2, (O[1] + g.P[1]) / 2];
    if (f.radius) m.morph(f.radius, [O, g.P], at, lin);
    if (f.dot) place(f.dot, g.P, at, dur);
    if (f.arc) m.morph(f.arc, g.arc, at, lin);
    if (f.thetaL) place(f.thetaL, g.thetaAt, at, dur);
    if (f.oneL) place(f.oneL, [mid[0] - 10, mid[1] - 13], at, dur);
    if (f.ptL) place(f.ptL, [g.P[0] + 36, g.P[1] - 12], at, dur);
    if (f.mark) m.morph(f.mark, rightAnglePts(g.foot, [-1, 0], [0, -1], 12), at, lin);
    if (f.xLeg) m.morph(f.xLeg, [O, g.foot], at, lin);
    if (f.yLeg) m.morph(f.yLeg, [g.foot, g.P], at, lin);
    if (f.xL) place(f.xL, [(O[0] + g.foot[0]) / 2, O[1] + 16], at, dur);
    if (f.yL) place(f.yL, [g.foot[0] + 14, (g.foot[1] + g.P[1]) / 2], at, dur);
    for (const r of drawn) {
      if (r !== 'sin') m.morph(segIds[r]!, [g.seg[r][0], g.seg[r][1]], at, lin);
      const lp = labelPlace(g, r);
      place(segLbl[r]!, lp.at, at, dur);
      m.turn(segLbl[r]!, lp.rot, at, dur);
    }
  };

  /** "left" then "right" side by side, centred on x; the right side may be a stacked fraction. */
  const eqLine = (left: string, right: string, y: number, color: Role | string): string[] => {
    const lw = tokenWidth(left, EQ_SIZE);
    const rw = tokenWidth(right, EQ_SIZE);
    const gap = 8;
    const x0 = PANEL_X - (lw + gap + rw) / 2;
    const a = `eq${uid++}`;
    const b = `eq${uid++}`;
    m.text(a, left, x0 + lw / 2, y, { size: EQ_SIZE, color, z: 4 });
    m.text(b, right, x0 + lw + gap + rw / 2, y, { size: EQ_SIZE, color, z: 4 });
    return [a, b];
  };

  const drawShow = () => {
    const e1 = m.vector('axx', 24, O[1], 452, O[1], t, { color: AXIS, width: 2.5, dur: 700, z: 1 });
    const e2 = m.vector('axy', O[0], O[1] + 128, O[0], 38, t + 150, { color: AXIS, width: 2.5, dur: 700, z: 1 });
    const e3 = m.poly('circ', circlePts(O[0], O[1], R), t + 300, { color: CIRCLE, closed: true, width: 2.5, dur: 1000, silent: true, z: 2 });
    t = Math.max(e1, e2, e3) + 250;
  };

  const drawPoint = () => {
    const g = geometry(theta, R, O);
    f.radius = 'rad';
    f.dot = 'pdot';
    f.arc = 'tarc';
    f.thetaL = 'thL';
    f.oneL = 'oneL';
    f.ptL = 'ptL';
    let end = m.poly(f.radius, [O, g.P], t, { color: 'ink', closed: false, width: 3.5, dur: 800, silent: true, z: 3 });
    m.dot(f.dot, g.P[0], g.P[1], t + 700, { color: 'ink', r: 5 });
    end = Math.max(end, m.poly(f.arc, g.arc, t + 500, { color: 'ink', closed: false, width: 2, dur: 500, silent: true, z: 3 }));
    m.text(f.thetaL, 'θ', g.thetaAt[0], g.thetaAt[1], { size: 20, color: 'ink', z: 4 });
    m.text(f.oneL, '1', (O[0] + g.P[0]) / 2 - 10, (O[1] + g.P[1]) / 2 - 13, { size: 20, color: 'ink', z: 4 });
    m.text(f.ptL, '(x, y)', g.P[0] + 36, g.P[1] - 12, { size: 20, color: 'ink', z: 4 });
    m.sound(t, 'scribble', { dur: 800 });
    t = Math.max(end, m.appear([f.thetaL, f.oneL, f.ptL], t + 900, 120, false)) + 200;
  };

  const drawLegs = () => {
    const g = geometry(theta, R, O);
    f.xLeg = 'xleg';
    f.yLeg = 'yleg';
    f.mark = 'rmark';
    f.xL = 'xL';
    f.yL = 'yL';
    let end = m.poly(f.xLeg, [O, g.foot], t, { color: RATIO_COLOR.cos, closed: false, width: 4, dur: 700, silent: true, z: 3 });
    end = Math.max(end, m.poly(f.yLeg, [g.foot, g.P], t + 500, { color: RATIO_COLOR.sin, closed: false, width: 4, dur: 700, silent: true, z: 3 }));
    end = Math.max(end, m.poly(f.mark, rightAnglePts(g.foot, [-1, 0], [0, -1], 12), t + 900, { color: 'ink', closed: false, width: 1.8, dur: 300, silent: true, z: 3 }));
    m.text(f.xL, 'x', (O[0] + g.foot[0]) / 2, O[1] + 16, { size: 20, color: RATIO_COLOR.cos, z: 4 });
    m.text(f.yL, 'y', g.foot[0] + 14, (g.foot[1] + g.P[1]) / 2, { size: 20, color: RATIO_COLOR.sin, z: 4 });
    m.sound(t, 'scribble', { dur: 900 });
    t = Math.max(end, m.appear([f.xL, f.yL], t + 1000, 150, false)) + 200;
  };

  const drawRatio = (r: Ratio) => {
    const g = geometry(theta, R, O);
    const lp = labelPlace(g, r);
    const lid = `lab${uid++}`;
    m.text(lid, `${r}(θ)`, lp.at[0], lp.at[1], { size: 18, color: RATIO_COLOR[r], z: 5 });
    m.turn(lid, lp.rot);
    segLbl[r] = lid;
    let end = t;
    if (r === 'sin') {
      // The vertical leg already is sin θ: its "y" label becomes sin(θ).
      segIds.sin = f.yLeg!;
      if (f.yL) m.get(f.yL).alpha.to(t, 250, 0);
    } else {
      const id = `seg${uid++}`;
      segIds[r] = id;
      end = m.poly(id, [g.seg[r][0], g.seg[r][1]], t, { color: RATIO_COLOR[r], closed: false, width: 4, dur: 800, silent: true, z: 3 });
      m.sound(t, 'scribble', { dur: 800 });
    }
    drawn.push(r);
    end = Math.max(end, m.appear(lid, end - 300, 0, false));
    const k = drawn.length - 1;
    const ids = eqLine(FORMULA[r].left, FORMULA[r].right, slotY(k), RATIO_COLOR[r]);
    formulas.push(...ids);
    t = m.appear(ids, end, 100, false) + 250;
  };

  if (plan.title) t = m.step(pick(plan.title, lang), t, 1600);

  for (const s of plan.steps) {
    t = m.step(pick(s.say, lang), t, 2400);
    switch (s.op) {
      case 'show':
        drawShow();
        break;
      case 'point':
        drawPoint();
        break;
      case 'legs':
        drawLegs();
        break;
      case 'ratio':
        drawRatio(s.which);
        break;
      case 'sweep': {
        const steps = Math.max(8, Math.min(40, Math.round(Math.abs(s.to - theta) * 1.2)));
        const total = 2600;
        const dt = total / steps;
        for (let k = 1; k <= steps; k++) follow(theta + ((s.to - theta) * k) / steps, t + (k - 1) * dt, dt);
        theta = s.to;
        t += total + 300;
        break;
      }
      case 'values': {
        fade(formulas, t, 300);
        fade(values, t, 300);
        values = [];
        drawn.forEach((r, k) => {
          const v = valueToken(r, theta);
          const ids = eqLine(`${r}(${theta}°) ${v.exact ? '=' : '≈'}`, v.text, slotY(k), RATIO_COLOR[r]);
          values.push(...ids);
        });
        t = m.appear(values, t + 350, 120, false) + 300;
        break;
      }
      case 'identity': {
        if (!identityHolds(s.which, theta)) throw new Error(`identity ${s.which} does not hold at ${theta}°`);
        const id = `idn${uid++}`;
        m.text(id, IDENTITY[s.which], O[0], 392, { size: 26, color: 'ink', z: 4 });
        t = m.appear(id, t, 0, false) + DUR.beat;
        break;
      }
      case 'box': {
        const n = Math.max(1, drawn.length);
        const top = slotY(0) - 36;
        const bot = slotY(n - 1) + 36;
        t = m.poly(`box${uid++}`, [[PANEL_X - 108, top], [PANEL_X + 108, top], [PANEL_X + 108, bot], [PANEL_X - 108, bot]], t, { color: '#c8b400', closed: true, width: 3, dur: 900, silent: true, z: 2 }) + DUR.beat;
        break;
      }
    }
    t += 150;
    m.hold(t);
  }
  m.hold(t + 1400);
  return [m.build()];
}
