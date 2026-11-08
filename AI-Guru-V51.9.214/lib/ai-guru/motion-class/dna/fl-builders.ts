/**
 * DNA builder for fractions on the number line (V51.9.36): the line with its whole numbers, each
 * whole cut into equal parts, fractions marked as dots, mixed numbers, the same point on a finer
 * line (equivalent fractions), two fractions compared over a common denominator, and adding or
 * subtracting by a jump. The planner gives the fractions and the order; the app computes every
 * tick, position and number (fl-math.ts). English and Malayalam classes have identical pictures.
 */

import { Motion, type MotionScene } from '../../reels/motion/engine';
import { tokenWidth } from '../../reels/motion/metrics';
import type { Lang } from '../../reels/motion/captions';
import type { Bi, FracLinePlan } from './types';
import {
  EQ_Y, FRAC_ROLES, LINE, addFacts, addResultLines, commonLines, compareResultLines, divideLines, equivResultLines, flGeometry,
  jumpLines, markLines, mixedLines, mixedParts, scaleLines, showLines, tok, val, type Frac, type Line,
} from './fl-math';

const pick = (b: Bi | undefined, lang: Lang): string => (b ? (lang === 'ml' ? b.ml || b.en : b.en) : '');
const SCENE_W = 720;
const SCENE_H = 444;
export const FPX = 440;
export const FPMAX = 256;
export const FPANEL_Y = (k: number) => 130 + 54 * k;
type Pt = [number, number];

export function buildFracLine(plan: FracLinePlan, lang: Lang, title: string): MotionScene[] {
  const m = new Motion(title, SCENE_W, SCENE_H);
  m.fixView(SCENE_W / 2, SCENE_W);
  let t = 300;
  let uid = 0;
  let panel: string[] = [];
  let temp: string[] = [];
  const g = flGeometry(plan);
  const Y = LINE.y;

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
      const words = l.split(' ').filter(Boolean);
      const total = (px: number) => words.reduce((w, x) => w + tokenWidth(x, px), 0) + Math.max(0, words.length - 1) * px * 0.3;
      let px = 24;
      if (total(px) > FPMAX) px = Math.max(12, Math.floor((24 * FPMAX) / total(24)));
      let x = FPX;
      const ids: string[] = [];
      for (const w of words) {
        const wd = tokenWidth(w, px);
        ids.push(put(w, x + wd / 2, FPANEL_Y(k), color, px));
        x += wd + px * 0.3;
      }
      t = m.appear(ids, t, 0, false) + 250;
      panel.push(...ids);
    });
  };
  const label = (text: string, x: number, y: number, color: string, size = 22): string => {
    const id = put(text, x, y, color, size);
    t = m.appear([id], t, 0, false) + 120;
    return id;
  };
  const stroke = (pts: Pt[], color: string, width: number, dur = 250, extra: { dashed?: boolean; z?: number } = {}) => {
    m.poly(`pl${uid++}`, pts, t, { color, closed: false, width, dur, silent: true, z: extra.z ?? 1, dashed: extra.dashed });
  };
  /** Axis rule, whole ticks and numbers at height y. */
  const axis = (y: number, L: number, numY: number) => {
    t = m.rule(`ax${uid++}`, LINE.x0 - 10, y, g.x(L) + 16, y, t, { color: 'ink', width: 3 }) + 100;
    for (let i = 0; i <= L; i++) stroke([[g.x(i), y - 14], [g.x(i), y + 14]], 'ink', 3);
    t += 250;
    const ids = Array.from({ length: L + 1 }, (_, i) => put(String(i), g.x(i), numY, 'ink', 18));
    t = m.appear(ids, t, 60, false) + 150;
  };
  /** Sub-ticks that cut every whole into D parts (the whole-number positions are already ticked). */
  const subTicks = (y: number, L: number, D: number) => {
    for (let i = 1; i < D * L; i++) if (i % D) stroke([[g.x(i / D), y - 7], [g.x(i / D), y + 7]], 'ink', 2);
    t += 350;
  };
  const markAt = (f: Frac, color: string, y: number, labelY: number, stem: boolean, text?: string) => {
    const x = g.x(val(f));
    m.dot(`dt${uid++}`, x, y, t, { color, r: 7 });
    t += 250;
    if (stem) stroke([[x, y + (labelY > y ? 10 : -10)], [x, labelY + (labelY > y ? -20 : 20)]], color, 1.5, 200);
    return label(text ?? tok(f), x, labelY, color, 22);
  };
  const rank = (fs: Frac[]) => fs.map((f) => fs.filter((o) => val(o) < val(f)).length);

  /* ---- mark ---- */
  const markShow = () => {
    axis(Y, g.L, Y + 30);
    showPanel(showLines(plan));
  };
  const markDivide = () => {
    subTicks(Y, g.L, g.D);
    stroke([[g.x(0), Y], [g.x(1 / g.D), Y]], 'carry', 7, 500, { z: 2 });
    t += 550;
    temp.push(label(tok([1, g.D]), g.x(0.5 / g.D), Y - 45, 'carry'));
    showPanel(divideLines(plan));
  };
  const markDots = () => {
    clear(temp, t);
    temp = [];
    const fs = plan.fracs!;
    const r = rank(fs);
    fs.forEach((f, i) => markAt(f, FRAC_ROLES[i], Y, r[i] % 2 === 0 ? Y - 47 : Y - 95, r[i] % 2 === 1));
    showPanel(markLines(plan));
  };
  const markMixed = () => {
    plan.fracs!.forEach((f, i) => {
      if (f[0] <= f[1]) return;
      const [w, rest] = mixedParts(f);
      const x = g.x(val(f));
      const ww = tokenWidth(String(w), 22);
      const rw = rest ? tokenWidth(tok(rest), 22) : 0;
      const tot = ww + (rest ? rw + 8 : 0);
      const l0 = x - tot / 2;
      const ids = [put(String(w), l0 + ww / 2, Y + 78, FRAC_ROLES[i], 22)];
      if (rest) ids.push(put(tok(rest), l0 + ww + 8 + rw / 2, Y + 78, FRAC_ROLES[i], 22));
      t = m.appear(ids, t, 0, false) + 200;
    });
    showPanel(mixedLines(plan));
  };

  /* ---- equivalent ---- */
  const eqTop = EQ_Y[0];
  const eqBot = EQ_Y[1];
  const eqShow = () => {
    const [n, d] = plan.frac!;
    axis(eqTop, 1, eqTop + 27);
    subTicks(eqTop, 1, d);
    markAt([n, d], 'a', eqTop, eqTop - 45, false);
    showPanel(showLines(plan));
  };
  const eqScale = () => {
    const [n, d] = plan.frac!;
    const k = plan.k!;
    axis(eqBot, 1, eqBot + 27);
    subTicks(eqBot, 1, d * k);
    const x = g.x(n / d);
    stroke([[x, eqTop + 10], [x, eqBot - 10]], 'carry', 2, 500, { dashed: true });
    t += 450;
    m.dot(`dt${uid++}`, x, eqBot, t, { color: 'result', r: 7 });
    t += 250;
    stroke([[x, eqBot + 10], [x, eqBot + 40]], 'result', 1.5, 200);
    label(tok([n * k, d * k]), x, eqBot + 62, 'result');
    showPanel(scaleLines(plan));
  };
  const eqResult = () => {
    const [n, d] = plan.frac!;
    const x = g.x(n / d);
    stroke([[g.x(0), eqTop], [x, eqTop]], 'result', 7, 500, { z: 2 });
    stroke([[g.x(0), eqBot], [x, eqBot]], 'result', 7, 500, { z: 2 });
    t += 600;
    showPanel(equivResultLines(plan));
  };

  /* ---- compare ---- */
  const cmpAt: Array<{ id: string; x: number; y: number }> = [];
  const cmpShow = () => {
    axis(Y, g.L, Y + 30);
    const fs = plan.fracs!;
    const r = rank(fs);
    fs.forEach((f, i) => {
      const y = r[i] % 2 === 0 ? Y - 47 : Y - 95;
      cmpAt.push({ id: markAt(f, FRAC_ROLES[i], Y, y, r[i] % 2 === 1), x: g.x(val(f)), y });
    });
    showPanel(showLines(plan));
  };
  const cmpCommon = () => {
    subTicks(Y, g.L, g.D);
    const [a, c] = plan.fracs!;
    [a, c].forEach((f, i) => {
      if (f[1] === g.D) return;
      const nf: Frac = [f[0] * (g.D / f[1]), g.D];
      // the label above the dot is rewritten in place over the common denominator
      clear([cmpAt[i].id], t);
      t += 300;
      cmpAt[i].id = label(tok(nf), cmpAt[i].x, cmpAt[i].y, FRAC_ROLES[i], 22);
    });
    showPanel(commonLines(plan));
  };
  const cmpResult = () => {
    const fs = plan.fracs!;
    fs.forEach((f, i) => {
      const y = 392 + 20 * i;
      const x1 = g.x(val(f));
      m.poly(`pl${uid++}`, [[g.x(0), y - 6], [x1, y - 6], [x1, y + 6], [g.x(0), y + 6]], t, { color: FRAC_ROLES[i], fill: FRAC_ROLES[i], fillAlpha: 0.35, closed: true, width: 2, dur: 500, silent: true, z: 2 });
      t += 550;
    });
    showPanel(compareResultLines(plan));
  };

  /* ---- add / subtract ---- */
  const addS = plan.kind === 'add' ? addFacts(plan) : (null as unknown as ReturnType<typeof addFacts>);
  const endV = addS ? addS.S / addS.D : 0;
  const addShow = () => {
    axis(Y, g.L, Y + 30);
    subTicks(Y, g.L, g.D);
    markAt(addS.a, 'a', Y, Y + 78, false);
    showPanel(showLines(plan));
  };
  const addJump = () => {
    const x0 = g.x(val(addS.a));
    const x1 = g.x(endV);
    const h = Math.min(60, Math.max(22, Math.abs(x1 - x0) / 2));
    const pts: Pt[] = Array.from({ length: 25 }, (_, i) => {
      const u = i / 24;
      return [x0 + (x1 - x0) * u, Y - 8 - h * Math.sin(Math.PI * u)] as Pt;
    });
    m.poly(`pl${uid++}`, pts, t, { color: 'carry', closed: false, width: 3.5, dur: 800, z: 2 });
    t += 850;
    label(tok(addS.c), (x0 + x1) / 2, Y - 8 - h - 24, 'carry');
    showPanel(jumpLines(plan));
  };
  const addCommon = () => {
    showPanel(commonLines(plan));
  };
  const addResult = () => {
    const x0 = g.x(val(addS.a));
    const x1 = g.x(endV);
    m.dot(`dt${uid++}`, x1, Y, t, { color: 'result', r: 7 });
    t += 250;
    const close = Math.abs(x1 - x0) < 60;
    const ly = close ? Y + 118 : Y + 78;
    if (close) stroke([[x1, Y + 38], [x1, ly - 20]], 'result', 1.5, 200);
    const s = addS.sum;
    if (s[1] === 1) label(String(s[0]), x1, ly, 'result');
    else if (s[0] > s[1]) {
      const [w, rest] = mixedParts(s);
      const ww = tokenWidth(String(w), 22);
      const rw = rest ? tokenWidth(tok(rest), 22) : 0;
      const l0 = x1 - (ww + (rest ? rw + 8 : 0)) / 2;
      const ids = [put(String(w), l0 + ww / 2, ly, 'result', 22)];
      if (rest) ids.push(put(tok(rest), l0 + ww + 8 + rw / 2, ly, 'result', 22));
      t = m.appear(ids, t, 0, false) + 200;
    } else label(tok(s), x1, ly, 'result');
    showPanel(addResultLines(plan));
  };

  if (plan.title) t = m.step(pick(plan.title, lang), t, 1600);

  for (const st of plan.steps) {
    t = m.step(pick(st.say, lang), t, 2400);
    switch (plan.kind) {
      case 'mark':
        if (st.op === 'show') markShow();
        else if (st.op === 'divide') markDivide();
        else if (st.op === 'mark') markDots();
        else if (st.op === 'mixed') markMixed();
        break;
      case 'equivalent':
        if (st.op === 'show') eqShow();
        else if (st.op === 'scale') eqScale();
        else if (st.op === 'result') eqResult();
        break;
      case 'compare':
        if (st.op === 'show') cmpShow();
        else if (st.op === 'common') cmpCommon();
        else if (st.op === 'result') cmpResult();
        break;
      case 'add':
        if (st.op === 'show') addShow();
        else if (st.op === 'jump') addJump();
        else if (st.op === 'common') addCommon();
        else if (st.op === 'result') addResult();
        break;
    }
    t += 150;
    m.hold(t);
  }
  m.hold(t + 1400);
  return [m.build()];
}
