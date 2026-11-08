/**
 * DNA builders for the coordinate board: the plane with a matrix transformation
 * (grid, î / ĵ, vectors, shapes, the matrix, the determinant) and the graph of a
 * function (axes, curves, plotted points, a tracker dot, shaded area, a curve that
 * bends when a parameter changes).
 *
 * All the maths on screen is COMPUTED here (matrix entries, determinant, coordinates
 * read by the tracker, the curve itself), never typed by the planner, so what the
 * viewer sees is true whatever the plan says.
 */

import { ease, Motion, type MotionScene } from '../../reels/motion/engine';
import { DUR, type Role } from '../../reels/motion/grammar';
import { fmtNum, matDet, niceStep, Plane, IDENT, type Mat, type Pt } from '../../reels/motion/plane';
import { evalExpr } from '../../math/animation/expr';
import { tokenWidth } from '../../reels/motion/metrics';
import type { Lang } from '../../reels/motion/captions';
import type { Bi, GraphPlan, PlanePlan } from './types';

const pick = (b: Bi | undefined, lang: Lang): string => (b ? (lang === 'ml' ? b.ml || b.en : b.en) : '');

/** y = fn(x) as a function; NaN when the expression is not valid. */
export function fnOf(src: string): (x: number) => number {
  const clean = src.replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/').replace(/^\s*y\s*=\s*/i, '');
  return (x: number) => evalExpr(clean, { x });
}

/** Coefficient + base vector name: 1 → î, −1 → −î, 3 → 3î. */
const coef = (v: number, name: string) => (v === 1 ? name : v === -1 ? `−${name}` : `${fmtNum(v)}${name}`);

const SCENE_W = 720;
const SCENE_H = 444;

/* ---------------- plane with matrix transformation ---------------- */

export function buildPlane(plan: PlanePlan, lang: Lang, title: string): MotionScene[] {
  const xMax = plan.xMax ?? 5;
  const yMax = plan.yMax ?? 4;
  const unit = Math.min(46, 450 / (2 * xMax), 390 / (2 * yMax));
  const cx = 250;
  const cy = 222;
  const m = new Motion(title, SCENE_W, SCENE_H);
  m.fixView(SCENE_W / 2, SCENE_W);
  const P = new Plane(m, { left: cx - xMax * unit, top: cy - yMax * unit, width: 2 * xMax * unit, height: 2 * yMax * unit, xMin: -xMax, xMax, yMin: -yMax, yMax });
  const COL = 612;
  let t = 300;
  let gridShown = false;
  let square: string | null = null;
  let nameId: string | null = null;
  let detId: string | null = null;

  const ensureGrid = () => {
    if (gridShown) return;
    gridShown = true;
    t = P.grid(t, { extend: 2, transformable: true, labels: !!plan.numbers }) + DUR.beat;
  };
  const showMatrix = () => {
    if (P.hasMatrix) return;
    t = P.showMatrix(COL, 178, t) + DUR.beat;
  };

  if (plan.title) t = m.step(pick(plan.title, lang), t, 1600);

  for (const s of plan.steps) {
    t = m.step(pick(s.say, lang), t, 2200);
    switch (s.op) {
      case 'grid':
        ensureGrid();
        break;
      case 'basis': {
        ensureGrid();
        const i = P.vector('bi', [0, 0], [1, 0], t, { color: 'c', width: 5 });
        const j = P.vector('bj', [0, 0], [0, 1], t + 250, { color: 'a', width: 5 });
        P.label('li', 'î', [1, 0], t + 500, { color: 'c', size: 32, push: { from: [0, 0], dist: 24 } });
        P.label('lj', 'ĵ', [0, 1], t + 600, { color: 'a', size: 32, push: { from: [0, 0], dist: 24 } });
        t = Math.max(i.end, j.end) + 700;
        break;
      }
      case 'vector': {
        ensureGrid();
        const v = P.vector('v', [0, 0], s.v, t, { color: s.color ?? 'b', width: 5 });
        if (s.label) P.label('vl', s.label, s.v, v.end - 200, { color: s.color ?? 'b', size: 28, push: { from: [0, 0], dist: 22 } });
        t = v.end + 400;
        break;
      }
      case 'combine': {
        ensureGrid();
        const [x, y] = s.v;
        let at = t;
        if (x !== 0) {
          const a = P.vector('cx', [0, 0], [x, 0], at, { color: 'c', width: 5 });
          P.label('cxl', coef(x, 'î'), [x / 2, 0], a.end - 200, { color: 'c', size: 28, push: { from: [0, 0], dist: 26, perp: true } });
          at = a.end + 300;
        }
        if (y !== 0) {
          const b = P.vector('cy', [x, 0], [x, y], at, { color: 'a', width: 5 });
          P.label('cyl', coef(y, 'ĵ'), [x, y / 2], b.end - 200, { color: 'a', size: 28, push: { from: [x, 0], dist: 28, perp: true } });
          at = b.end + 300;
        }
        const v = P.vector('cv', [0, 0], s.v, at, { color: 'b', width: 5 });
        P.label('cvl', 'v', s.v, v.end - 200, { color: 'b', size: 30, push: { from: [0, 0], dist: 22 } });
        t = v.end + 500;
        break;
      }
      case 'shape': {
        ensureGrid();
        const sh = P.shape('sh', s.points, t, { color: s.color ?? 'carry', fill: s.color ?? 'carry', fillAlpha: 0.38, dur: 900 });
        if (s.label) {
          const c: Pt = [s.points.reduce((a, p) => a + p[0], 0) / s.points.length, s.points.reduce((a, p) => a + p[1], 0) / s.points.length];
          P.label('shl', s.label, c, sh.end, { dx: 0, dy: 0, color: 'ink', size: 26 });
        }
        t = sh.end + 500;
        break;
      }
      case 'square': {
        ensureGrid();
        const sq = P.shape('sq', [[0, 0], [1, 0], [1, 1], [0, 1]], t, { color: 'b', fill: 'b', fillAlpha: 0.35, dur: 800 });
        square = sq.id;
        t = sq.end + 500;
        break;
      }
      case 'matrix':
        ensureGrid();
        showMatrix();
        break;
      case 'transform': {
        ensureGrid();
        showMatrix();
        if (s.name) {
          const text = pick(s.name, lang);
          if (!nameId) {
            nameId = m.text('tname', text, COL, 84, { size: 24, color: 'result', z: 4 });
            m.appear(nameId, t);
          } else m.swap(nameId, text, t);
        }
        t = P.apply(s.matrix as Mat, t + (s.name ? 250 : 0)) + 500;
        if (detId) m.swap(detId, `det = ${fmtNum(matDet(P.cur))}`, t - 600);
        break;
      }
      case 'det': {
        ensureGrid();
        showMatrix();
        const text = `det = ${fmtNum(matDet(P.cur))}`;
        if (!detId) {
          detId = m.text('tdet', text, COL, 296, { size: 34, color: 'result', z: 4 });
          m.appear(detId, t);
        } else m.swap(detId, text, t);
        if (square) {
          m.focus(square, t + 300);
          m.unfocus(square, t + 1700);
        }
        t += 1300;
        break;
      }
      case 'reset':
        ensureGrid();
        t = P.setMatrix(IDENT, t) + 400;
        if (nameId) m.swap(nameId, pick({ en: 'identity', ml: 'ഐഡന്റിറ്റി' }, lang), t - 900);
        if (detId) m.swap(detId, 'det = 1', t - 600);
        break;
    }
    t += 150;
    m.hold(t);
  }
  m.hold(t + 1400);
  return [m.build()];
}

/* ---------------- graph of a function ---------------- */

const CURVE_COLORS: Role[] = ['b', 'a', 'c', 'carry'];

interface CurveRef {
  id: string;
  fn: string;
  from: number;
  to: number;
  color: Role;
  labelId?: string;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Keeps labels from sitting on top of each other or on plotted points. */
class Placer {
  private taken: Rect[] = [];
  constructor(private bounds: Rect) {}
  reserve(cx: number, cy: number, w: number, h: number): void {
    this.taken.push({ x: cx - w / 2, y: cy - h / 2, w, h });
  }
  /** First free spot around (x, y), trying the preferred offsets in order. */
  place(x: number, y: number, text: string, size: number, prefer: Array<[number, number]>): [number, number] {
    const w = tokenWidth(text, size) + 14;
    const h = size * 1.15;
    const spots: Array<[number, number]> = [...prefer, [0, -(size + 6)], [0, size + 6], [w / 2 + 12, 0], [-(w / 2 + 12), 0], [w / 2 + 10, -(size + 4)], [-(w / 2 + 10), -(size + 4)], [w / 2 + 10, size + 4], [-(w / 2 + 10), size + 4]];
    for (const [dx, dy] of spots) {
      const r: Rect = { x: x + dx - w / 2, y: y + dy - h / 2, w, h };
      const inside = r.x >= this.bounds.x && r.y >= this.bounds.y && r.x + r.w <= this.bounds.x + this.bounds.w && r.y + r.h <= this.bounds.y + this.bounds.h;
      if (inside && !this.taken.some((o) => r.x < o.x + o.w && o.x < r.x + r.w && r.y < o.y + o.h && o.y < r.y + r.h)) {
        this.taken.push(r);
        return [x + dx, y + dy];
      }
    }
    const [dx, dy] = prefer[0] ?? [0, -(size + 6)];
    this.reserve(x + dx, y + dy, w, h);
    return [x + dx, y + dy];
  }
}

export function buildGraph(plan: GraphPlan, lang: Lang, title: string): MotionScene[] {
  const m = new Motion(title, SCENE_W, SCENE_H);
  m.fixView(SCENE_W / 2, SCENE_W);
  const spec = { left: 78, top: 34, width: 430, height: 330, xMin: plan.xMin, xMax: plan.xMax, yMin: plan.yMin, yMax: plan.yMax };
  const P = new Plane(m, spec);
  const placer = new Placer({ x: spec.left + 4, y: spec.top + 2, w: spec.width - 8, h: spec.height - 4 });
  const COL = 616;
  const axisY = Math.max(spec.yMin, Math.min(0, spec.yMax));
  const axisX = Math.max(spec.xMin, Math.min(0, spec.xMax));
  let t = 300;
  let axes = false;
  let curves = 0;
  let labelled = 0;
  let last: CurveRef | null = null;
  let readout: { x: string; y: string } | null = null;
  /** Things tied to the current curve (points, tracker, readout, segments, shading): they fade when the curve morphs. */
  let eph: string[] = [];
  let n = 0;

  const ensureAxes = () => {
    if (axes) return;
    axes = true;
    t = P.grid(t, { extend: 1 });
    const xr = P.px(spec.xMax, axisY);
    const yt = P.px(axisX, spec.yMax);
    const lx = m.text('axname_x', 'x', xr[0] + 20, xr[1], { size: 26, color: 'ink', z: 2 });
    const ly = m.text('axname_y', 'y', yt[0], yt[1] - 16, { size: 26, color: 'ink', z: 2 });
    t = m.appear([lx, ly], t) + DUR.beat;
  };
  const dropLines = (x: number, y: number, tt: number, color: Role | string = 'done'): number => {
    const q = P.px(x, y);
    const a = P.px(x, axisY);
    const b = P.px(axisX, y);
    const id = `drop${n++}`;
    let end = m.poly(id, [q, a], tt, { color, closed: false, width: 2, dashed: true, dur: 350, silent: true });
    end = Math.max(end, m.poly(`${id}b`, [q, b], tt, { color, closed: false, width: 2, dashed: true, dur: 350, silent: true }));
    eph.push(id, `${id}b`);
    return end;
  };

  if (plan.title) t = m.step(pick(plan.title, lang), t, 1600);

  for (const s of plan.steps) {
    t = m.step(pick(s.say, lang), t, 2200);
    switch (s.op) {
      case 'axes':
        ensureAxes();
        break;
      case 'curve': {
        ensureAxes();
        const f = fnOf(s.fn);
        const from = s.from ?? spec.xMin;
        const to = s.to ?? spec.xMax;
        const color = s.color ?? CURVE_COLORS[curves++ % CURVE_COLORS.length];
        const c = P.curve(`c${n++}`, f, from, to, t, { color });
        const ref: CurveRef = { id: c.id, fn: s.fn, from, to, color };
        if (s.label) {
          // The equation is written in the right-hand column, in the curve's own colour.
          // Fit the equation inside the right-hand column (≈190 px wide).
          const w30 = tokenWidth(s.label, 30);
          ref.labelId = m.text(`cl${n++}`, s.label, COL, 62 + labelled++ * 46, { size: w30 > 190 ? Math.max(20, (30 * 190) / w30) : 30, color, z: 4 });
          m.appear(ref.labelId, c.end - 300);
        }
        last = ref;
        t = c.end + 600;
        break;
      }
      case 'point': {
        ensureAxes();
        const [x, y] = s.at;
        const q = P.px(x, y);
        const color = s.color ?? 'a';
        placer.reserve(q[0], q[1], 16, 16);
        const ptId = `pt${n++}`;
        eph.push(ptId);
        let end = m.dot(ptId, q[0], q[1], t, { color, r: 7 });
        if (s.drop) end = Math.max(end, dropLines(x, y, end));
        if (s.label) {
          const right = q[0] < spec.left + spec.width * 0.55;
          const [lx, ly] = placer.place(q[0], q[1], s.label, 24, [right ? [48, -22] : [-48, -22], [right ? 48 : -48, 24]]);
          const id = m.text(`ptl${n++}`, s.label, lx, ly, { size: 24, color, z: 4 });
          eph.push(id);
          end = Math.max(end, m.appear(id, end - 100));
        }
        t = end + 500;
        break;
      }
      case 'tracker': {
        if (!last || !s.stops.length) break;
        const f = fnOf(last.fn);
        const stops = s.stops;
        const at = (x: number): Pt => P.px(x, f(x));
        const first = at(stops[0]);
        const dotId = `trk${n++}`;
        eph.push(dotId);
        t = m.dot(dotId, first[0], first[1], t, { color: 'carry', r: 9 });
        // Coordinates are read off in the right-hand column: x = …, y = …
        if (!readout) {
          const base = 62 + Math.max(labelled, 1) * 46 + 40;
          readout = { x: m.text(`rdx${n++}`, `x = ${fmtNum(stops[0])}`, COL, base, { size: 34, color: 'result', z: 4 }), y: m.text(`rdy${n++}`, `y = ${fmtNum(f(stops[0]))}`, COL, base + 52, { size: 34, color: 'result', z: 4 }) };
          eph.push(readout.x, readout.y);
          t = m.appear([readout.x, readout.y], t, 120);
        } else {
          m.swap(readout.x, `x = ${fmtNum(stops[0])}`, t);
          t = m.swap(readout.y, `y = ${fmtNum(f(stops[0]))}`, t + 60);
        }
        t = dropLines(stops[0], f(stops[0]), t, 'carry') + 200;
        let cur = stops[0];
        const dot = m.get(dotId);
        for (const x1 of stops.slice(1)) {
          const span = Math.abs(x1 - cur);
          const steps = Math.max(8, Math.round((span / (spec.xMax - spec.xMin)) * 60));
          const dur = 600 + (span / (spec.xMax - spec.xMin)) * 1500;
          for (let k = 1; k <= steps; k++) {
            const q = at(cur + ((x1 - cur) * k) / steps);
            const t0 = t + ((k - 1) * dur) / steps;
            dot.x.to(t0, dur / steps, q[0], ease.linear);
            dot.y.to(t0, dur / steps, q[1], ease.linear);
          }
          t += dur;
          m.swap(readout.x, `x = ${fmtNum(x1)}`, t);
          m.swap(readout.y, `y = ${fmtNum(f(x1))}`, t + 60);
          t = dropLines(x1, f(x1), t + 150, 'carry') + 450;
          cur = x1;
        }
        m.until(t);
        break;
      }
      case 'shade': {
        if (!last) break;
        const f = fnOf(last.fn);
        const pts: Pt[] = [P.px(s.from, axisY)];
        const N = 48;
        for (let k = 0; k <= N; k++) {
          const x = s.from + ((s.to - s.from) * k) / N;
          pts.push(P.px(x, f(x)));
        }
        pts.push(P.px(s.to, axisY));
        const shId = `sh${n++}`;
        eph.push(shId);
        t = m.poly(shId, pts, t, { color: s.color ?? 'c', fill: s.color ?? 'c', fillAlpha: 0.38, width: 2, dur: 1200, z: 0 }) + 500;
        break;
      }
      case 'morph': {
        if (!last) break;
        for (const id of eph) m.get(id).alpha.to(t, 450, 0);
        eph = [];
        readout = null;
        t = P.morphCurve(last.id, fnOf(s.fn), last.from, last.to, t) + 500;
        last.fn = s.fn;
        if (s.label && last.labelId) m.swap(last.labelId, s.label, t - 700);
        break;
      }
      case 'segment': {
        ensureAxes();
        const a = P.px(s.from[0], s.from[1]);
        const b = P.px(s.to[0], s.to[1]);
        const sgId = `sg${n++}`;
        eph.push(sgId);
        t = m.poly(sgId, [a, b], t, { color: s.color ?? 'c', closed: false, width: 3.5, dashed: s.dashed, dur: 800 });
        if (s.label) {
          // Beside the segment, on the side away from the curve's start when possible.
          const dx = b[0] - a[0];
          const dy = b[1] - a[1];
          const len = Math.hypot(dx, dy) || 1;
          const nx = -dy / len;
          const ny = dx / len;
          const mx = (a[0] + b[0]) / 2;
          const my = (a[1] + b[1]) / 2;
          const d = 24;
          const [lx, ly] = placer.place(mx, my, s.label, 24, [[nx * d, ny * d], [-nx * d, -ny * d]]);
          const id = m.text(`sgl${n++}`, s.label, lx, ly, { size: 24, color: s.color ?? 'c', z: 4 });
          eph.push(id);
          t = m.appear(id, t - 200);
        }
        t += 400;
        break;
      }
    }
    t += 150;
    m.hold(t);
  }
  m.hold(t + 1400);
  return [m.build()];
}

export { niceStep };
