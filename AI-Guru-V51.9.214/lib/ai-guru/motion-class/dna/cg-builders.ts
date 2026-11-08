/**
 * DNA builder for coordinate geometry (V51.9.39): points plotted with dashed lines to the axes and
 * their quadrants, the distance between two points (the right triangle on the grid, then
 * d² = dx² + dy²) and the midpoint (each coordinate the average of the two). The planner gives the
 * points and the order; the app computes every position and number (cg-math.ts). English and
 * Malayalam classes have identical pictures.
 */

import { Motion, type MotionScene } from '../../reels/motion/engine';
import { tokenWidth } from '../../reels/motion/metrics';
import { Plane } from '../../reels/motion/plane';
import type { Lang } from '../../reels/motion/captions';
import type { Bi, CoordPlan } from './types';
import { POINT_ROLES, cgGeometry, formulaLines, legsLines, midpointLines, midpointOf, namesOf, num, plotLines, quadrantLines, type Line, type Pt } from './cg-math';

const pick = (b: Bi | undefined, lang: Lang): string => (b ? (lang === 'ml' ? b.ml || b.en : b.en) : '');
const SCENE_W = 720;
const SCENE_H = 444;
export const GPX = 440;
export const GPMAX = 256;
export const GPANEL_Y = (k: number) => 150 + 46 * k;

export function buildCoord(plan: CoordPlan, lang: Lang, title: string): MotionScene[] {
  const m = new Motion(title, SCENE_W, SCENE_H);
  m.fixView(SCENE_W / 2, SCENE_W);
  const g = cgGeometry(plan);
  const P = new Plane(m, g.spec, 'c');
  const names = namesOf(plan);
  let t = 300;
  let uid = 0;
  let panel: string[] = [];
  const plotted: number[] = [];

  const put = (text: string, x: number, y: number, color: string, size = 22): string => {
    const id = `tx${uid++}`;
    m.text(id, text, x, y, { size, color, z: 5 });
    return id;
  };
  const clear = (ids: string[], at: number) => {
    if (ids.length) m.fadeOut(ids, at, 300);
  };
  const showPanel = (lines: Line[]) => {
    clear(panel, t);
    panel = [];
    lines.forEach(([l, color], k) => {
      const words = l.split(' ').filter(Boolean).map((w) => { const mm = /^(.*?)@([a-z]+)(.*)$/.exec(w); return mm ? { text: mm[1] + mm[3], color: mm[2] } : { text: w, color }; });
      const total = (px: number) => words.reduce((w, x) => w + tokenWidth(x.text, px), 0) + Math.max(0, words.length - 1) * px * 0.3;
      let px = 24;
      if (total(px) > GPMAX) px = Math.max(12, Math.floor((24 * GPMAX) / total(24)));
      let x = GPX;
      const ids: string[] = [];
      for (const w of words) {
        const wd = tokenWidth(w.text, px);
        ids.push(put(w.text, x + wd / 2, GPANEL_Y(k), w.color, px));
        x += wd + px * 0.3;
      }
      t = m.appear(ids, t, 0, false) + 250;
      panel.push(...ids);
    });
  };
  const line = (pts: Pt[], color: string, o: { dashed?: boolean; width?: number; dur?: number } = {}) => {
    const r = P.shape(`s${uid++}`, pts, t, { color, closed: false, width: o.width ?? 3, dashed: o.dashed, dur: o.dur ?? 600 });
    t = r.end + 100;
  };
  const dotAt = (p: Pt, color: string, name: string, dx: number, dy: number) => {
    const d = P.dot(`d${uid++}`, p, t, { color, r: 7 });
    t = d.end + 80;
    const l = P.label(`l${uid++}`, name, p, t, { dx, dy, color, size: 22 });
    t = l.end + 100;
  };

  const doAxes = () => {
    // when the unit is small the numbers beside the origin would touch, so only the even ones are written
    t = P.grid(t, { extend: 1, step: 1, labels: !g.sparse }) + 250;
    if (g.sparse) {
      const lab: string[] = [];
      const [ox, oy] = g.px(0, 0);
      for (let k = Math.ceil(g.xMin); k <= Math.floor(g.xMax); k++) if (k !== 0 && k % 2 === 0) lab.push(put(num(k), g.px(k, 0)[0], oy + 17, 'ink', 18));
      for (let k = Math.ceil(g.yMin); k <= Math.floor(g.yMax); k++) if (k !== 0 && k % 2 === 0) lab.push(put(num(k), ox - 18, g.px(0, k)[1], 'ink', 18));
      t = m.appear(lab, t, 12, false) + 200;
    }
  };
  const plotOne = (i: number) => {
    const p = plan.points[i];
    const col = POINT_ROLES[i];
    if (p[0] !== 0) line([[p[0], 0], [p[0], p[1]]], col, { dashed: true, width: 2, dur: 450 });
    if (p[1] !== 0) line([[0, p[1]], [p[0], p[1]]], col, { dashed: true, width: 2, dur: 450 });
    dotAt(p, col, names[i], g.letter[i][0], g.letter[i][1]);
    plotted.push(i);
  };
  const doPlot = (i?: number) => {
    if (plan.kind === 'points') plotOne(i ?? 0);
    else plan.points.forEach((p, k) => dotAt(p, POINT_ROLES[k], names[k], g.letter[k][0], g.letter[k][1]));
    showPanel(plotLines(plan, plan.kind === 'points' ? plotted : [0, 1]));
  };
  const doQuadrant = () => {
    for (const n of g.numerals) {
      const [x, y] = g.px(n.at[0], n.at[1]);
      const id = put(n.text, x, y, 'ink', 22);
      t = m.appear([id], t, 0, false) + 150;
    }
    showPanel(quadrantLines(plan));
  };
  const doSegment = () => line(plan.points, 'carry', { width: 3.5, dur: 700 });
  const doLegs = () => {
    const [p, q] = plan.points;
    const c: Pt = [q[0], p[1]];
    line([p, c], 'a', { dashed: true, width: 3 });
    line([c, q], 'c', { dashed: true, width: 3 });
    const [cx, cy] = g.px(c[0], c[1]);
    const sx = Math.sign(g.px(p[0], p[1])[0] - cx);
    const sy = Math.sign(g.px(q[0], q[1])[1] - cy);
    const sq: Pt[] = [[cx + 9 * sx, cy], [cx + 9 * sx, cy + 9 * sy], [cx, cy + 9 * sy]];
    m.poly(`rm${uid++}`, sq, t, { color: 'ink', closed: false, width: 2, dur: 300, silent: true, z: 3 });
    t += 350;
    // dx beside the horizontal leg and dy beside the vertical one: the first spot that keeps clear of tick numbers, dots and letters
    const mid = (a: number, b: number) => (a + b) / 2;
    const taken: Array<[number, number]> = [...g.letterAt];
    const free = (x: number, y: number, hw: number): boolean =>
      x - hw > 32 && x + hw < 408 && y > 16 && y < 428 &&
      !g.ticks.some(([tx, ty, w]) => Math.abs(x - tx) < w + hw && Math.abs(y - ty) < 18) &&
      !g.dots.some(([ox, oy]) => Math.abs(x - ox) < hw + 9 && Math.abs(y - oy) < 17) &&
      !taken.some(([ox, oy]) => Math.abs(x - ox) < hw + 9 && Math.abs(y - oy) < 20);
    const place = (text: string, cands: Array<[number, number]>, color: string) => {
      const hw = tokenWidth(text, 20) / 2;
      const at = cands.find(([x, y]) => free(x, y, hw)) ?? cands[0];
      taken.push(at);
      t = m.appear([put(text, at[0], at[1], color, 20)], t, 0, false) + 150;
    };
    const [hx, hy] = g.px(mid(p[0], c[0]), p[1]);
    const dv = p[1] === 0 ? (q[1] < 0 ? 18 : -18) : (q[1] > p[1] ? 18 : -18);
    place('dx', [[hx, hy + dv], [hx, hy - dv], [hx + 22, hy + dv], [hx - 22, hy + dv], [hx + 22, hy - dv], [hx - 22, hy - dv]], 'a');
    const [vx, vy] = g.px(c[0], mid(c[1], q[1]));
    const dh = q[0] === 0 ? (p[0] > 0 ? -20 : 20) : (q[0] > p[0] ? 20 : -20);
    place('dy', [[vx + dh, vy], [vx - dh, vy], [vx + dh, vy - 18], [vx + dh, vy + 18], [vx - dh, vy - 18], [vx - dh, vy + 18]], 'c');
    showPanel(legsLines(plan));
  };
  const doFormula = () => showPanel(formulaLines(plan));
  const doMidpoint = () => {
    const mp = midpointOf(plan);
    const [p, q] = plan.points;
    if (mp[0] !== 0) line([mp, [mp[0], 0]], 'result', { dashed: true, width: 2, dur: 450 });
    if (mp[1] !== 0) line([mp, [0, mp[1]]], 'result', { dashed: true, width: 2, dur: 450 });
    dotAt(mp, 'result', 'M', g.mLetter[0], g.mLetter[1]);
    // equal marks across the two halves
    for (const half of [[p, mp], [mp, q]] as Array<[Pt, Pt]>) {
      const a = g.px(half[0][0], half[0][1]);
      const b = g.px(half[1][0], half[1][1]);
      const mx = (a[0] + b[0]) / 2;
      const my = (a[1] + b[1]) / 2;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const nx = -(b[1] - a[1]) / len;
      const ny = (b[0] - a[0]) / len;
      m.poly(`eq${uid++}`, [[mx - 6 * nx, my - 6 * ny], [mx + 6 * nx, my + 6 * ny]], t, { color: 'carry', closed: false, width: 3, dur: 250, silent: true, z: 3 });
      t += 150;
    }
    t += 150;
    showPanel(midpointLines(plan));
  };

  if (plan.title) t = m.step(pick(plan.title, lang), t, 1600);

  for (const st of plan.steps) {
    t = m.step(pick(st.say, lang), t, 2400);
    switch (st.op) {
      case 'axes': doAxes(); break;
      case 'plot': doPlot(st.i); break;
      case 'quadrant': doQuadrant(); break;
      case 'segment': doSegment(); break;
      case 'legs': doLegs(); break;
      case 'formula': doFormula(); break;
      case 'midpoint': doMidpoint(); break;
    }
    t += 150;
    m.hold(t);
  }
  m.hold(t + 1400);
  return [m.build()];
}
