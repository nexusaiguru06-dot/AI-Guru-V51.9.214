/**
 * DNA builder for quadratic equations (V51.9.30): the equation a x² + b x + c = 0, the parabola
 * y = a x² + b x + c on a plane, the discriminant D = b² − 4ac with D > 0, D = 0 or D < 0, factorising
 * by splitting the middle term and grouping, the quadratic formula worked out, the roots marked where
 * the curve meets the x-axis, and each whole-number root checked in the equation.
 *
 * The planner gives a, b, c and the order. The app computes every line (q-math.ts), so the board is
 * true whatever the plan says. English and Malayalam classes have identical pictures; only the
 * captions change language.
 */

import { Motion, type MotionScene } from '../../reels/motion/engine';
import { STAGGER_TEXT } from '../../reels/motion/curves';
import type { Role } from '../../reels/motion/grammar';
import { tokenWidth } from '../../reels/motion/metrics';
import { mathIds, placeMath } from '../../reels/motion/typeset';
import { Plane } from '../../reels/motion/plane';
import type { Lang } from '../../reels/motion/captions';
import type { Bi, QuadPlan } from './types';
import { checkText, disc, equationText, factoring, factoringZero, formulaFraction, formulaWork, graphWindow, polyText, ratPlain, ratToken, ratValue, roots, sqrtExact, fmt } from './q-math';

const pick = (b: Bi | undefined, lang: Lang): string => (b ? (lang === 'ml' ? b.ml || b.en : b.en) : '');
const SCENE_W = 720;
const SCENE_H = 444;
export const LX = 24;
export const LMAX = 340;
export const EQ_Y = 54;
export const WORK_Y = (k: number) => 106 + 36 * k;
/** Rows that hold a stacked fraction are taller. */
export const hasFraction = (parts: string[]) => parts.some((p) => p.startsWith('{'));
export function rowYs(items: Array<{ parts: string[] }>): number[] {
  const ys: number[] = [];
  let y = 106;
  for (const it of items) {
    const tall = hasFraction(it.parts);
    y += tall ? 24 : 0;
    ys.push(y);
    y += tall ? 32 : 36;
  }
  return ys;
}
export const GRAPH = { left: 392, top: 54, width: 296, height: 296 };

export function buildQuad(plan: QuadPlan, lang: Lang, title: string): MotionScene[] {
  const q = { a: plan.a, b: plan.b, c: plan.c };
  const D = disc(q);
  const rs = roots(q);
  const m = new Motion(title, SCENE_W, SCENE_H);
  m.fixView(SCENE_W / 2, SCENE_W);
  let t = 300;
  let uid = 0;
  let work: string[] = [];
  let plane: Plane | null = null;

  const clearWork = (at: number) => {
    if (work.length) m.fadeOut(work, at, 300);
    work = [];
  };
  /** Parts side by side from LX, shrunk to fit the left column. */
  const partsLine = (parts: string[], y: number, color: Role | string, size = 22): string[] => {
    const gap = 10;
    let px = size;
    let ws = parts.map((p) => tokenWidth(p, px));
    let total = ws.reduce((a, b) => a + b, 0) + gap * (parts.length - 1);
    if (total > LMAX) {
      px = Math.max(13, Math.floor((px * LMAX) / total));
      ws = parts.map((p) => tokenWidth(p, px));
      total = ws.reduce((a, b) => a + b, 0) + gap * (parts.length - 1);
    }
    let x = LX;
    return parts.map((p, i) => {
      const id = `ln${uid++}`;
      m.text(id, p, x + ws[i] / 2, y, { size: px, color, z: 4 });
      x += ws[i] + gap;
      return id;
    });
  };
  const rows = (items: Array<{ parts: string[]; color?: Role | string; size?: number }>): string[] => {
    const ys = rowYs(items);
    const ids: string[][] = items.map((it, k) => partsLine(it.parts, ys[k], it.color ?? 'ink', it.size ?? 22));
    let all: string[] = [];
    ids.forEach((g, k) => {
      t = m.appear(g, t, 80, false) + 330;
      all = all.concat(g);
      void k;
    });
    return all;
  };
  const rootsRow = (): string[] => {
    if (rs.length === 1) return ['x =', ratToken(rs[0])];
    return ['x =', ratToken(rs[0]), 'or', 'x =', ratToken(rs[1])];
  };

  const drawShow = () => {
    const w = tokenWidth(equationText(q), 28);
    const id = 'eq';
    m.text(id, equationText(q), LX + w / 2, EQ_Y, { size: 28, color: 'result', z: 4 });
    t = m.appear(id, t, 0, false) + 450;
  };

  const drawGraph = () => {
    const win = graphWindow(q);
    const spec = { left: GRAPH.left, top: GRAPH.top, width: GRAPH.width, height: GRAPH.height, ...win };
    plane = new Plane(m, spec, 'g');
    t = plane.grid(t, { extend: 1, labels: true });
    const pts: Array<[number, number]> = [];
    const n = 140;
    for (let i = 0; i <= n; i++) {
      const x = win.xMin + ((win.xMax - win.xMin) * i) / n;
      pts.push(plane.px(x, q.a * x * x + q.b * x + q.c));
    }
    const end = m.poly('curve', pts, t, { color: 'b', closed: false, width: 4, dur: 1800, z: 2, clip: plane.clipBox() });
    const capId = 'gcap';
    const capText = `y = ${polyText(q)}`;
    const cw = tokenWidth(capText, 20);
    m.text(capId, capText, GRAPH.left + GRAPH.width / 2, GRAPH.top + GRAPH.height + 34, { size: 20, color: 'b', z: 4 });
    void cw;
    t = Math.max(end, m.appear(capId, end - 600, 0, false)) + 400;
  };

  const drawDiscriminant = () => {
    clearWork(t);
    const fw = formulaWork(q);
    const nature = D > 0 ? { text: 'D > 0', color: 'c' } : D === 0 ? { text: 'D = 0', color: 'carry' } : { text: 'D < 0', color: 'a' };
    work = rows([...fw.discLines.map((l) => ({ parts: [l] })), { parts: [nature.text], color: nature.color, size: 26 }]);
  };

  const drawFactorise = () => {
    clearWork(t);
    const f = factoring(q);
    const z = factoringZero(q);
    const lines = f ? f.lines : z ? z.lines : [];
    work = rows([...lines.map((l) => ({ parts: [l] })), { parts: rootsRow(), color: 'result', size: 24 }]);
  };

  /** A formula typeset in the left column (stacked fraction, real root sign), centred on y; returns its ids. */
  const typed = (tex: string, y: number, color: Role | string = 'ink'): string[] => {
    const h = placeMath(m, `fx${uid++}`, tex, LX, y, t, { size: 30, maxWidth: LMAX, color, align: 'left' });
    const ids = h.glyphs.map((g) => g.id);
    t = Math.max(m.write(ids, t, STAGGER_TEXT), t + (h.strokes.length ? 450 : 0)) + 300;
    return mathIds(h);
  };

  const drawFormula = () => {
    clearWork(t);
    const fw = formulaWork(q);
    const items: Array<{ parts: string[]; color?: Role | string; size?: number }> = fw.discLines.map((l) => ({ parts: [l] }));
    if (D < 0) {
      items.push({ parts: ['D < 0'], color: 'a', size: 26 });
      work = rows(items);
      return;
    }
    work = rows(items);
    const y0 = rowYs(items)[items.length - 1] + 62;
    work = work.concat(typed('x = \\frac{-b \\pm \\sqrt{D}}{2a}', y0));
    const k = sqrtExact(D);
    if (k !== null) {
      const f = formulaFraction(q, k);
      work = work.concat(typed(`x = \\frac{${f.top}}{${f.bottom}}`, y0 + 78));
      const g = partsLine(rootsRow(), y0 + 150, 'result', 24);
      t = m.appear(g, t, 80, false) + 330;
      work = work.concat(g);
    } else {
      work = work.concat(typed(`x = \\frac{${fmt(-q.b)} \\pm \\sqrt{${D}}}{${fmt(2 * q.a)}}`, y0 + 78, 'result'));
    }
  };

  const drawRoots = () => {
    if (!plane) return;
    let end = t;
    const ids: string[] = [];
    rs.forEach((r, i) => {
      const d = plane!.dot(`rt${i}`, [ratValue(r), 0], t + i * 350, { color: 'result', r: 7 });
      const lb = plane!.label(`rl${i}`, ratPlain(r), [ratValue(r), 0], d.end - 100, { dx: 0, dy: -20, color: 'result', size: 20 });
      ids.push(d.id, lb.id);
      end = Math.max(end, d.end, lb.end);
    });
    t = end + 500;
  };

  const drawCheck = () => {
    clearWork(t);
    const ids: string[] = [];
    rs.forEach((r, k) => {
      const text = checkText(q, r.n);
      const g = partsLine([text], WORK_Y(k), 'ink');
      t = m.appear(g, t, 0, false) + 300;
      const w = tokenWidth(text, 22);
      const tk = `tk${uid++}`;
      t = m.tick(tk, LX + w + 30, WORK_Y(k), t) + 200;
      ids.push(...g, tk);
    });
    work = ids;
  };

  if (plan.title) t = m.step(pick(plan.title, lang), t, 1600);

  for (const st of plan.steps) {
    t = m.step(pick(st.say, lang), t, 2400);
    switch (st.op) {
      case 'show':
        drawShow();
        break;
      case 'graph':
        drawGraph();
        break;
      case 'discriminant':
        drawDiscriminant();
        break;
      case 'factorise':
        drawFactorise();
        break;
      case 'formula':
        drawFormula();
        break;
      case 'roots':
        drawRoots();
        break;
      case 'check':
        drawCheck();
        break;
    }
    t += 150;
    m.hold(t);
  }
  m.hold(t + 1400);
  return [m.build()];
}
