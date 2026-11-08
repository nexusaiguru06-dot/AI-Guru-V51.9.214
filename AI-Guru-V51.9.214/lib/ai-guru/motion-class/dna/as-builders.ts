/**
 * DNA builder for arithmetic sequences (V51.9.29): the first terms in boxes, an arrow from each to
 * the next carrying the common difference, the n-th term formula (general, with the numbers,
 * simplified), a far term worked out, the sum by Gauss's pairing and by formula, "is this number a
 * term?" with a tick or a cross, and the points (n, x_n) on a plane lying on a straight line.
 *
 * The planner gives a, d and the order. The app computes every number and line (as-math.ts).
 * English and Malayalam classes have identical pictures; only the captions change language.
 */

import { Motion, type MotionScene } from '../../reels/motion/engine';
import type { Role } from '../../reels/motion/grammar';
import { tokenWidth } from '../../reels/motion/metrics';
import { Plane, niceStep } from '../../reels/motion/plane';
import type { Lang } from '../../reels/motion/captions';
import type { Bi, SeqPlan } from './types';
import { br, fmt, formulaLines, gaussPairs, membership, nth, sumLines, termLines, termsOf } from './as-math';

const pick = (b: Bi | undefined, lang: Lang): string => (b ? (lang === 'ml' ? b.ml || b.en : b.en) : '');
const SCENE_W = 720;
const SCENE_H = 444;
export const ROW_Y = 92;
export const BOX_H = 50;
export const IDX_Y = 128;
export const LX = 24;
export const LMAX = 332;
export const FORMULA_Y = [190, 224, 258];
export const WORK_Y = [304, 338, 372, 406];
export const GRAPH = { left: 396, top: 170, width: 300, height: 240 };

/** x centre of term k (1-based) in a row of count terms. */
export function termX(k: number, count: number): number {
  const sp = Math.min(100, 640 / count);
  return 360 + (k - (count + 1) / 2) * sp;
}
export const boxWidth = (count: number) => Math.min(100, 640 / count) * 0.74;

/** The plane of the graph step: n from 0 to N + 1, x_n wide enough for the points and the dashed line. */
export function seqGraphSpec(s: { a: number; d: number }, N: number) {
  const ys = [0, ...termsOf(s, N), nth(s, 0), nth(s, N + 1)];
  let lo = Math.min(...ys);
  let hi = Math.max(...ys);
  const pad = Math.max(1, (hi - lo) * 0.14);
  lo -= pad;
  hi += pad;
  return { spec: { left: GRAPH.left, top: GRAPH.top, width: GRAPH.width, height: GRAPH.height, xMin: 0, xMax: N + 1, yMin: lo, yMax: hi }, lo, hi };
}

export function buildSeq(plan: SeqPlan, lang: Lang, title: string): MotionScene[] {
  const s = { a: plan.a, d: plan.d };
  const N = plan.terms;
  const vals = termsOf(s, N);
  const m = new Motion(title, SCENE_W, SCENE_H);
  m.fixView(SCENE_W / 2, SCENE_W);
  let t = 300;
  let uid = 0;
  let pin: string[] = [];
  let work: string[] = [];
  let stage: string[] = [];
  const gids: string[] = [];
  const boxes: string[] = [];
  const termTexts: string[] = [];

  const fade = (ids: string[], at: number) => {
    if (ids.length) m.fadeOut(ids, at, 300);
  };
  const clearWork = (at: number) => {
    fade(work, at);
    work = [];
  };
  const clearStage = (at: number) => {
    fade(stage, at);
    stage = [];
  };
  /** A left-aligned line, shrunk to fit the left column. */
  const line = (text: string, y: number, color: Role | string, size = 22): string => {
    let px = size;
    let w = tokenWidth(text, px);
    if (w > LMAX) {
      px = Math.max(13, Math.floor((px * LMAX) / w));
      w = tokenWidth(text, px);
    }
    const id = `ln${uid++}`;
    m.text(id, text, LX + w / 2, y, { size: px, color, z: 4 });
    return id;
  };
  const lines = (texts: string[], ys: number[], last: Role | string = 'result'): string[] =>
    texts.map((tx, i) => line(tx, ys[i], i === texts.length - 1 ? last : 'ink', i === texts.length - 1 ? 24 : 22));
  const writeLines = (ids: string[]) => {
    t = m.appear(ids, t, 420, false) + 400;
  };

  const drawShow = () => {
    const w = boxWidth(N);
    vals.forEach((v, i) => {
      const x = termX(i + 1, N);
      const bid = `bx${i}`;
      const tid = `tm${i}`;
      const ixid = `ix${i}`;
      m.text(tid, fmt(v), x, ROW_Y, { size: 28, color: 'ink', z: 4 });
      m.text(ixid, `x_${i + 1}`, x, IDX_Y, { size: 18, color: 'ink', z: 4 });
      boxes.push(bid);
      termTexts.push(tid);
      const end = m.box(bid, x, ROW_Y, w, BOX_H, t + i * 200, 'ink');
      m.appear([tid, ixid], t + i * 200 + 250, 0, false);
      if (i === N - 1) t = end + 300;
    });
  };

  const drawDiff = () => {
    const label = `${s.d > 0 ? '+' : '−'}${Math.abs(s.d)}`;
    const top = ROW_Y - BOX_H / 2;
    let end = t;
    for (let k = 0; k < N - 1; k++) {
      const x1 = termX(k + 1, N);
      const x2 = termX(k + 2, N);
      const pts: Array<[number, number]> = [];
      for (let i = 0; i <= 12; i++) {
        const u = i / 12;
        pts.push([x1 + (x2 - x1) * u, top - 5 - 24 * Math.sin(Math.PI * u)]);
      }
      const at = t + k * 280;
      const id = `ar${uid++}`;
      end = Math.max(end, m.poly(id, pts, at, { color: 'carry', closed: false, width: 3, dur: 500, silent: true, z: 3 }));
      const [px, py] = pts[pts.length - 2];
      const [ex, ey] = pts[pts.length - 1];
      const ang = Math.atan2(ey - py, ex - px);
      const head = (da: number): [number, number] => [ex - 10 * Math.cos(ang + da), ey - 10 * Math.sin(ang + da)];
      const hid = `ah${uid++}`;
      m.poly(hid, [head(0.5), [ex, ey], head(-0.5)], at + 300, { color: 'carry', closed: false, width: 3, dur: 250, silent: true, z: 3 });
      const lid = `dl${uid++}`;
      m.text(lid, label, (x1 + x2) / 2, top - 38, { size: 22, color: 'carry', z: 4 });
      end = Math.max(end, m.appear(lid, at + 350, 0, false));
    }
    t = end + 350;
  };

  const drawFormula = () => {
    clearStage(t);
    clearWork(t);
    const ids = lines(formulaLines(s), FORMULA_Y);
    pin = ids;
    writeLines(ids);
  };

  const drawTerm = (n: number) => {
    clearStage(t);
    clearWork(t);
    work = lines(termLines(s, n), WORK_Y);
    writeLines(work);
  };

  const drawSum = (n: number) => {
    clearStage(t);
    clearWork(t);
    work = lines(sumLines(s, n), WORK_Y);
    writeLines(work);
  };

  const drawTest = (value: number) => {
    clearStage(t);
    clearWork(t);
    const mb = membership(s, value);
    const texts = mb.lines;
    work = lines(texts, WORK_Y.slice(0, texts.length), mb.isTerm ? 'result' : 'a');
    writeLines(work);
    const y = WORK_Y[texts.length - 1];
    const w = tokenWidth(texts[texts.length - 1], 24);
    if (mb.isTerm) {
      const id = `tk${uid++}`;
      t = m.tick(id, LX + w + 30, y, t) + 200;
      work.push(id);
      if (mb.n! <= N) {
        m.focus([boxes[mb.n! - 1], termTexts[mb.n! - 1]], t);
        t += 800;
      }
    } else {
      const cx = LX + w + 30;
      const a = `cx${uid++}`;
      const b = `cx${uid++}`;
      m.poly(a, [[cx - 11, y - 11], [cx + 11, y + 11]], t, { color: 'a', closed: false, width: 5, dur: 250, z: 4 });
      t = m.poly(b, [[cx + 11, y - 11], [cx - 11, y + 11]], t + 200, { color: 'a', closed: false, width: 5, dur: 250, z: 4 }) + 250;
      work.push(a, b);
    }
  };

  const drawPairs = () => {
    clearWork(t);
    fade(pin, t);
    pin = [];
    const g = gaussPairs(s, N);
    const P = g.pairs.length;
    const y0 = IDX_Y + 16;
    let end = t;
    g.pairs.forEach(([i, j], p) => {
      const depth = 14 + 26 * (P - p);
      const xi = termX(i, N);
      const xj = termX(j, N);
      const id = `pr${uid++}`;
      const at = t + p * 900;
      end = Math.max(end, m.poly(id, [[xi, y0], [xi, y0 + depth], [xj, y0 + depth], [xj, y0]], at, { color: 'b', closed: false, width: 3, dur: 700, silent: true, z: 3 }));
      const lid = `ps${uid++}`;
      m.text(lid, fmt(g.sum), (xi + xj) / 2, y0 + depth + 15, { size: 20, color: 'b', z: 4 });
      end = Math.max(end, m.appear(lid, at + 600, 0, false));
      stage.push(id, lid);
    });
    t = end + 400;
    work = lines([`${fmt(s.a)} + ${br(nth(s, N))} = ${fmt(g.sum)}`, `${P} × ${br(g.sum)} = ${fmt(g.total)}`], WORK_Y);
    writeLines(work);
  };

  const drawGraph = () => {
    clearStage(t);
    const { spec, lo, hi } = seqGraphSpec(s, N);
    const P = new Plane(m, spec, 'g');
    t = P.grid(t, { extend: 1, labels: 'y', step: niceStep(hi - lo, 6) });
    const xl: string[] = [];
    for (let k = 1; k <= N; k++) {
      const q = P.px(k, lo);
      const id = `g_t${k}`;
      m.text(id, String(k), q[0], q[1] + 15, { size: 16, color: 'ink', z: 2 });
      xl.push(id);
      gids.push(id);
    }
    m.appear(xl, t - 300, 40, false);
    const xr = P.px(N + 1, 0);
    const yt = P.px(0, hi);
    const lx = m.text('g_n', 'n', xr[0] - 10, xr[1] - 16, { size: 22, color: 'ink', z: 2 });
    const ly = m.text('g_x', 'x_n', yt[0] + 24, yt[1] + 8, { size: 20, color: 'ink', z: 2 });
    gids.push(lx, ly);
    t = m.appear([lx, ly], t) + 200;
    vals.forEach((v, i) => {
      const d = P.dot(`pt${i}`, [i + 1, v], t, { color: 'result', r: 6 });
      gids.push(d.id);
      t = d.end + 120;
    });
    const ln = P.shape('gl', [[0, nth(s, 0)], [N + 1, nth(s, N + 1)]], t + 100, { color: 'carry', closed: false, width: 3, dur: 900, dashed: true });
    gids.push(ln.id);
    t = ln.end + 300;
  };

  if (plan.title) t = m.step(pick(plan.title, lang), t, 1600);

  for (const st of plan.steps) {
    t = m.step(pick(st.say, lang), t, 2400);
    switch (st.op) {
      case 'show':
        drawShow();
        break;
      case 'diff':
        drawDiff();
        break;
      case 'formula':
        drawFormula();
        break;
      case 'term':
        drawTerm(st.n);
        break;
      case 'pairs':
        drawPairs();
        break;
      case 'sum':
        drawSum(st.n);
        break;
      case 'test':
        drawTest(st.value);
        break;
      case 'graph':
        drawGraph();
        break;
    }
    t += 150;
    m.hold(t);
  }
  m.hold(t + 1400);
  return [m.build()];
}
