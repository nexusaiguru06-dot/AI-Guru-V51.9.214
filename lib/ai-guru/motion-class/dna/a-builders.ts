/**
 * DNA builder for angles (V51.9.32): parallel lines cut by a transversal (the eight angles, with the
 * vertically opposite, linear-pair, corresponding, alternate and co-interior ones marked in turn), the
 * angle sum and exterior angle of a triangle, and the circle theorems (angle at the centre, in the same
 * segment, in a semicircle, opposite angles of a cyclic quadrilateral).
 *
 * The planner gives one or two whole-degree angles and the order. The app computes every other angle
 * and every point (a-math.ts), so the board is true whatever the plan says. Angles are drawn as arcs
 * and written in degrees; English and Malayalam classes have identical pictures.
 */

import { Motion, type MotionScene } from '../../reels/motion/engine';
import type { Role } from '../../reels/motion/grammar';
import { tokenWidth } from '../../reels/motion/metrics';
import type { Lang } from '../../reels/motion/captions';
import { angleArc, circlePts, rightAnglePts, type Pt } from '../../reels/motion/shapes';
import type { AnglePlan, Bi } from './types';
import { CIRCLE, PAR_BOTTOM, PAR_TOP, arcAt, circleGeometry, circleLines, deg, labelRadius, parGeometry, parValue, partnerOf, polar, sector, triGeometry, triLines, type Pos, type Relation } from './a-math';

const pick = (b: Bi | undefined, lang: Lang): string => (b ? (lang === 'ml' ? b.ml || b.en : b.en) : '');
const SCENE_W = 720;
const SCENE_H = 444;
export const PX = 440;
export const PMAX = 256;
export const PANEL_Y = (k: number) => 150 + 44 * k;

export function buildAngle(plan: AnglePlan, lang: Lang, title: string): MotionScene[] {
  const m = new Motion(title, SCENE_W, SCENE_H);
  m.fixView(SCENE_W / 2, SCENE_W);
  let t = 300;
  let uid = 0;
  let panel: string[] = [];
  let extra: string[] = [];
  let partner: string[] = [];
  let centreIds: string[] = [];

  const put = (text: string, x: number, y: number, color: Role | string, size = 22): string => {
    const id = `tx${uid++}`;
    m.text(id, text, x, y, { size, color, z: 5 });
    return id;
  };
  const fit = (text: string, size: number, max: number) => {
    const w = tokenWidth(text, size);
    return w > max ? Math.max(13, Math.floor((size * max) / w)) : size;
  };
  const clear = (ids: string[], at: number) => {
    if (ids.length) m.fadeOut(ids, at, 300);
  };
  const showPanel = (lines: string[], color: Role | string = 'result') => {
    clear(panel, t);
    panel = [];
    lines.forEach((l, k) => {
      const px = fit(l, 24, PMAX);
      const id = put(l, PX + tokenWidth(l, px) / 2, PANEL_Y(k), color, px);
      t = m.appear([id], t, 0, false) + 300;
      panel.push(id);
    });
  };
  const line = (id: string, a: Pt, b: Pt, color: Role | string, width = 3): string => {
    const end = m.rule(id, a[0], a[1], b[0], b[1], t, { color, width });
    t = Math.max(t, end - 200);
    return id;
  };
  const arc = (pts: Pt[], color: Role | string, width = 3.5): string => {
    const id = `ac${uid++}`;
    m.poly(id, pts, t, { color, closed: false, width, dur: 600, z: 3 });
    return id;
  };
  const dotAt = (p: Pt, color: Role | string = 'ink'): string => {
    const id = `dt${uid++}`;
    m.dot(id, p[0], p[1], t, { color, r: 5 });
    return id;
  };
  const wait = (ids: string[], more = 350) => {
    t = m.appear(ids, t, 0, false) + more;
  };

  /* ---------------- parallel lines ---------------- */

  const a = plan.a ?? 70;
  const at: Pos = (plan.at as Pos) ?? 'tr';
  const pg = parGeometry(a);
  const center = (pos: Pos): Pt => (pos.endsWith('2') ? pg.Q : pg.P);
  /** Arc and label of the angle at a position. */
  const markAngle = (pos: Pos, color: Role | string, value: number): string[] => {
    const c = center(pos);
    const [s0, s1] = sector(a, pos);
    const ids = [arc(arcAt(c, 30, s0, s1), color)];
    const lb = polar(c, labelRadius(s1 - s0, 30), (s0 + s1) / 2);
    const tid = put(deg(value), lb[0], lb[1], color, 20);
    t = m.appear([tid], t, 0, false) + 200;
    ids.push(tid);
    return ids;
  };

  const drawParallelShow = () => {
    const ids: string[] = [];
    ids.push(line('lt', [pg.x0, PAR_TOP], [pg.x1, PAR_TOP], 'ink'));
    ids.push(line('lb', [pg.x0, PAR_BOTTOM], [pg.x1, PAR_BOTTOM], 'ink'));
    for (const y of [PAR_TOP, PAR_BOTTOM]) {
      const id = `ch${uid++}`;
      m.poly(id, [[pg.x0 + 24, y - 7], [pg.x0 + 36, y], [pg.x0 + 24, y + 7]], t, { color: 'ink', closed: false, width: 3, dur: 400, z: 3, silent: true });
      ids.push(id);
    }
    ids.push(line('tr', pg.t0, pg.t1, 'b'));
    t += 200;
    wait([dotAt(pg.P), dotAt(pg.Q)], 400);
    void ids;
  };

  const drawGiven = () => {
    markAngle(at, 'a', parValue(a, at));
    showPanel([deg(parValue(a, at))], 'a');
  };
  const drawRelation = (rel: Relation) => {
    clear(partner, t);
    partner = [];
    const p = partnerOf(a, at, rel);
    partner = markAngle(p.pos, p.kind === 'equal' ? 'c' : 'b', p.value);
    showPanel(p.lines, p.kind === 'equal' ? 'c' : 'b');
  };

  /* ---------------- triangle ---------------- */

  const tg = plan.figure === 'triangle' ? triGeometry(plan.A ?? 50, plan.B ?? 60) : null;
  const tl = plan.figure === 'triangle' ? triLines(plan.A ?? 50, plan.B ?? 60) : null;
  const hasFind = plan.steps.some((s) => s.op === 'find');
  let cQuestion = '';
  let cValue = '';
  const outward = (v: Pt, d = 24): Pt => {
    if (!tg) return v;
    const cx = (tg.A[0] + tg.B[0] + tg.C[0]) / 3;
    const cy = (tg.A[1] + tg.B[1] + tg.C[1]) / 3;
    const dx = v[0] - cx;
    const dy = v[1] - cy;
    const n = Math.hypot(dx, dy) || 1;
    return [v[0] + (dx / n) * d, v[1] + (dy / n) * d];
  };
  const drawTriShow = () => {
    if (!tg) return;
    const id = 'tri';
    t = m.poly(id, [tg.A, tg.B, tg.C], t, { color: 'ink', width: 3.5, dur: 1200, z: 2 }) + 200;
    const ls = (['A', 'B', 'C'] as const).map((n, i) => {
      const p = outward([tg.A, tg.B, tg.C][i]);
      return put(n, p[0], p[1], 'ink', 24);
    });
    wait(ls, 300);
  };
  const triArc = (v: Pt, p: Pt, q: Pt, color: Role | string, value: string, r = 34, big = false): string[] => {
    const aa = angleArc(v, p, q, r, 24);
    const lr = Math.max(r + 22, labelRadius(aa.degrees, r) * (big ? 0.9 : 1));
    const mid = Math.atan2(aa.label[1] - v[1], aa.label[0] - v[0]);
    const lp: Pt = [v[0] + lr * Math.cos(mid), v[1] + lr * Math.sin(mid)];
    const ids = [arc(aa.arc, color)];
    const tid = put(value, lp[0], lp[1], color, 20);
    ids.push(tid);
    return ids;
  };
  const drawAngles = () => {
    if (!tg || !tl) return;
    const ids = [...triArc(tg.A, tg.B, tg.C, 'a', deg(tg.a)), ...triArc(tg.B, tg.C, tg.A, 'b', deg(tg.b))];
    // C: a question mark when the next step finds it, otherwise its value
    const cArc = angleArc(tg.C, tg.A, tg.B, 34, 24);
    ids.push(arc(cArc.arc, 'c'));
    const lr = Math.max(56, labelRadius(cArc.degrees, 34));
    const mid = Math.atan2(cArc.label[1] - tg.C[1], cArc.label[0] - tg.C[0]);
    const lp: Pt = [tg.C[0] + lr * Math.cos(mid), tg.C[1] + lr * Math.sin(mid)];
    cQuestion = put('?', lp[0], lp[1], 'c', 20);
    cValue = put(deg(tl.C), lp[0], lp[1], 'c', 20);
    ids.push(hasFind ? cQuestion : cValue);
    wait(ids, 500);
  };
  const drawFind = () => {
    if (!tl) return;
    showPanel(tl.find, 'result');
    clear([cQuestion], t);
    wait([cValue], 400);
  };
  const drawSum = () => {
    if (!tl) return;
    showPanel(tl.sum, 'result');
  };
  const drawExterior = () => {
    if (!tg || !tl) return;
    const id = 'ext';
    t = m.poly(id, [tg.C, tg.D], t, { color: 'ink', closed: false, width: 3, dashed: true, dur: 600, z: 2 }) + 100;
    const ex = angleArc(tg.C, tg.A, tg.D, 54, 22);
    const lr = Math.max(76, labelRadius(ex.degrees, 54));
    const mid = Math.atan2(ex.label[1] - tg.C[1], ex.label[0] - tg.C[0]);
    const lp: Pt = [tg.C[0] + lr * Math.cos(mid), tg.C[1] + lr * Math.sin(mid)];
    const ids = [arc(ex.arc, 'carry', 4)];
    const tid = put(deg(tl.exteriorValue), lp[0], lp[1], 'carry', 20);
    wait([tid], 300);
    ids.push(tid, id);
    showPanel(tl.exterior, 'carry');
  };

  /* ---------------- circle ---------------- */

  const cg = plan.figure === 'circle' ? circleGeometry(plan.beta ?? 40) : null;
  const cl = plan.figure === 'circle' ? circleLines(plan.beta ?? 40) : null;
  const unit = (from: Pt, to: Pt): Pt => {
    const d = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1;
    return [(to[0] - from[0]) / d, (to[1] - from[1]) / d];
  };
  const letter = (name: string, p: Pt, dx: number, dy: number, color: Role | string = 'ink') => put(name, p[0] + dx, p[1] + dy, color, 24);
  /** The angle at X between XA and XB: an arc (or a right-angle square) and its value. */
  const angleMark = (X: Pt, color: Role | string, value: number, r: number): string[] => {
    if (!cg) return [];
    if (value === 90) {
      const u1 = unit(X, cg.A);
      const u2 = unit(X, cg.B);
      const id = `ra${uid++}`;
      m.poly(id, rightAnglePts(X, u1, u2, 16), t, { color, closed: false, width: 3.5, dur: 500, z: 3 });
      const bis: Pt = [u1[0] + u2[0], u1[1] + u2[1]];
      const bn = Math.hypot(bis[0], bis[1]) || 1;
      const tid = put(deg(value), X[0] + (bis[0] / bn) * 52, X[1] + (bis[1] / bn) * 52, color, 20);
      t = m.appear([tid], t, 0, false) + 300;
      return [id, tid];
    }
    const aa = angleArc(X, cg.A, cg.B, r, 24);
    const lr = Math.min(104, Math.max(r + 22, 26 / Math.sin(Math.max((aa.degrees * Math.PI) / 360, 0.05))));
    const mid = Math.atan2(aa.label[1] - X[1], aa.label[0] - X[0]);
    const tid = put(deg(value), X[0] + lr * Math.cos(mid), X[1] + lr * Math.sin(mid), color, 20);
    const ids = [arc(aa.arc, color), tid];
    t = m.appear([tid], t, 0, false) + 300;
    return ids;
  };
  const drawCircleShow = () => {
    if (!cg) return;
    t = m.poly('circ', circlePts(CIRCLE.cx, CIRCLE.cy, CIRCLE.r), t, { color: 'ink', width: 3.5, dur: 1400, z: 2 }) + 200;
    const ids = [dotAt(cg.O), dotAt(cg.A), dotAt(cg.B), letter('O', cg.O, 14, -12), letter('A', cg.A, -18, 14), letter('B', cg.B, 18, 14)];
    wait(ids, 400);
  };
  const drawCentre = () => {
    if (!cg) return;
    const l1 = line('oa', cg.O, cg.A, 'carry');
    const l2 = line('ob', cg.O, cg.B, 'carry');
    t += 200;
    const aa = arcAt(cg.O, 34, cg.aA, cg.aB, 28);
    const id = arc(aa, 'carry', 4);
    const tid = put(deg(cg.alpha), cg.O[0], cg.O[1] + 58, 'carry', 20);
    t = m.appear([tid], t, 0, false) + 300;
    centreIds = [l1, l2, id, tid];
  };
  const drawCircumference = () => {
    if (!cg) return;
    wait([dotAt(cg.P), letter('P', cg.P, 0, -20)], 200);
    line('pa', cg.P, cg.A, 'b');
    line('pb', cg.P, cg.B, 'b');
    t += 200;
    angleMark(cg.P, 'b', cg.beta, 38);
  };
  const drawDouble = () => {
    if (!cl) return;
    showPanel(cl.double, 'result');
  };
  const drawSameArc = () => {
    if (!cg || !cl) return;
    clear(extra, t);
    extra = [];
    const ids = [dotAt(cg.Q, 'c'), letter('Q', cg.Q, -20, -12, 'c')];
    wait(ids, 200);
    extra.push(...ids, line('qa', cg.Q, cg.A, 'c'), line('qb', cg.Q, cg.B, 'c'));
    t += 200;
    extra.push(...angleMark(cg.Q, 'c', cg.beta, 38));
    showPanel(cl.same, 'c');
  };
  const drawCyclic = () => {
    if (!cg || !cl) return;
    clear(extra, t);
    extra = [];
    // the picture is crowded around O: the centre angle steps aside while the cyclic quadrilateral is shown
    clear(centreIds, t);
    centreIds = [];
    const ids = [dotAt(cg.M, 'c'), letter('R', cg.M, 0, 22, 'c')];
    wait(ids, 200);
    extra.push(...ids, line('ra', cg.M, cg.A, 'c'), line('rb', cg.M, cg.B, 'c'));
    t += 200;
    // the angle at R is 180° − β: measured between RA and RB
    extra.push(...angleMark(cg.M, 'c', cl.cyclicValue, 40));
    showPanel(cl.cyclic, 'c');
  };

  if (plan.title) t = m.step(pick(plan.title, lang), t, 1600);

  for (const st of plan.steps) {
    t = m.step(pick(st.say, lang), t, 2400);
    switch (st.op) {
      case 'show':
        if (plan.figure === 'parallel') drawParallelShow();
        else if (plan.figure === 'triangle') drawTriShow();
        else drawCircleShow();
        break;
      case 'given':
        drawGiven();
        break;
      case 'vertical':
      case 'linear':
      case 'corresponding':
      case 'alternate':
      case 'cointerior':
        drawRelation(st.op);
        break;
      case 'angles':
        drawAngles();
        break;
      case 'find':
        drawFind();
        break;
      case 'sum':
        drawSum();
        break;
      case 'exterior':
        drawExterior();
        break;
      case 'centre':
        drawCentre();
        break;
      case 'circumference':
        drawCircumference();
        break;
      case 'double':
        drawDouble();
        break;
      case 'same-arc':
        drawSameArc();
        break;
      case 'cyclic':
        drawCyclic();
        break;
    }
    t += 150;
    m.hold(t);
  }
  m.hold(t + 1400);
  return [m.build()];
}
