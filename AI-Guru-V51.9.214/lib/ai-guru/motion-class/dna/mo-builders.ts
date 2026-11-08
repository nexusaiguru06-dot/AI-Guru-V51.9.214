/**
 * DNA builder for matrix multiplication and transpose (V51.9.37): A × B laid out side by side,
 * the orders checked, each entry of the product made from a row of A and a column of B (boxed in
 * colour) with the products and their sum written out; and the transpose, row by row into columns.
 * The planner gives the matrices and the order; the app computes every entry and box (mo-math.ts).
 * English and Malayalam classes have identical pictures.
 */

import { Motion, type MotionScene } from '../../reels/motion/engine';
import { tokenWidth } from '../../reels/motion/metrics';
import type { Lang } from '../../reels/motion/captions';
import type { Bi, MatrixOpsPlan } from './types';
import { BR, CH, CW, CY, ROW_COLORS, cEntry, cell, checkLines, entryText, moGeometry, moveLines, sizeLines, termsLines, transpose, type Line, type MatBox } from './mo-math';

const pick = (b: Bi | undefined, lang: Lang): string => (b ? (lang === 'ml' ? b.ml || b.en : b.en) : '');
const SCENE_W = 720;
const SCENE_H = 444;
export const MPX = 440;
export const MPMAX = 256;
export const MPANEL_Y = (k: number) => 150 + 46 * k;
type Pt = [number, number];

export function buildMatrixOps(plan: MatrixOpsPlan, lang: Lang, title: string): MotionScene[] {
  const m = new Motion(title, SCENE_W, SCENE_H);
  m.fixView(SCENE_W / 2, SCENE_W);
  let t = 300;
  let uid = 0;
  let panel: string[] = [];
  let boxes: string[] = [];
  const g = moGeometry(plan);
  const a = plan.a;
  const isMul = plan.kind === 'multiply';

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
      if (total(px) > MPMAX) px = Math.max(12, Math.floor((24 * MPMAX) / total(24)));
      let x = MPX;
      const ids: string[] = [];
      for (const w of words) {
        const wd = tokenWidth(w, px);
        ids.push(put(w, x + wd / 2, MPANEL_Y(k), color, px));
        x += wd + px * 0.3;
      }
      t = m.appear(ids, t, 0, false) + 250;
      panel.push(...ids);
    });
  };
  const bracket = (b: MatBox) => {
    const bot = b.top + b.h;
    m.poly(`pl${uid++}`, [[b.x + 6, b.top], [b.x, b.top], [b.x, bot], [b.x + 6, bot]], t, { color: 'ink', closed: false, width: 3, dur: 400, silent: true, z: 1 });
    m.poly(`pl${uid++}`, [[b.x + b.w - 6, b.top], [b.x + b.w, b.top], [b.x + b.w, bot], [b.x + b.w - 6, bot]], t, { color: 'ink', closed: false, width: 3, dur: 400, silent: true, z: 1 });
    t += 450;
  };
  const rect = (x0: number, y0: number, x1: number, y1: number, color: string): string => {
    const id = `bx${uid++}`;
    m.poly(id, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], t, { color, closed: true, width: 3, dur: 350, z: 3 });
    t += 380;
    return id;
  };
  const rowBox = (b: MatBox, i: number, color: string) => rect(b.x + 3, b.top + 6 + i * CH + 2, b.x + b.w - 3, b.top + 6 + (i + 1) * CH - 2, color);
  const colBox = (b: MatBox, j: number, color: string) => rect(b.x + BR + j * CW + 2, b.top + 3, b.x + BR + (j + 1) * CW - 2, b.top + b.h - 3, color);
  const cellBox = (b: MatBox, i: number, j: number, color: string) => {
    const [cx, cy] = cell(b, i, j);
    return rect(cx - CW / 2 + 2, cy - CH / 2 + 2, cx + CW / 2 - 2, cy + CH / 2 - 2, color);
  };
  const entries = (b: MatBox, mat: number[][], color: string, stagger = 40): string[] => {
    const ids: string[] = [];
    mat.forEach((row, i) => row.forEach((x, j) => { const [cx, cy] = cell(b, i, j); ids.push(put(entryText(x), cx, cy, color, entryText(x).length >= 3 ? 17 : 20)); }));
    t = m.appear(ids, t, stagger, false) + 250;
    return ids;
  };
  const label = (text: string, x: number, y: number, color: string, size = 22) => {
    const id = put(text, x, y, color, size);
    t = m.appear([id], t, 0, false) + 150;
    return id;
  };
  const dropBoxes = () => { clear(boxes, t); boxes = []; t += 200; };

  /* ---- multiply ---- */
  const filled = new Set<string>();
  const writeC = (i: number, j: number) => {
    const [cx, cy] = cell(g.C!, i, j);
    filled.add(`${i},${j}`);
    const s = entryText(cEntry(a, plan.b!, i, j));
    return label(s, cx, cy, 'result', s.length >= 3 ? 17 : 20);
  };
  const mulShow = () => {
    bracket(g.A);
    t = m.appear([put('A', g.A.x + g.A.w / 2, g.A.top - 16, 'a', 20)], t, 0, false) + 100;
    entries(g.A, a, 'a');
    label('×', g.marks[0], CY, 'ink', 26);
    bracket(g.B);
    label('B', g.B.x + g.B.w / 2, g.B.top - 16, 'b', 20);
    entries(g.B, plan.b!, 'b');
  };
  const mulCheck = () => {
    label('=', g.marks[1], CY, 'ink', 26);
    bracket(g.C!);
    label('AB', g.C!.x + g.C!.w / 2, g.C!.top - 16, 'result', 20);
    showPanel(checkLines(plan));
    const tk = `tk${uid++}`;
    t = m.tick(tk, MPX + 215, MPANEL_Y(2) - 4, t, 30) + 100;
    panel.push(tk);
  };
  const mulEntry = (i: number, j: number) => {
    dropBoxes();
    boxes.push(rowBox(g.A, i, 'a'), colBox(g.B, j, 'b'), cellBox(g.C!, i, j, 'result'));
    showPanel(termsLines(plan, i, j));
    writeC(i, j);
  };
  const mulAll = () => {
    dropBoxes();
    clear(panel, t);
    panel = [];
    for (let i = 0; i < a.length; i++) for (let j = 0; j < plan.b![0].length; j++) if (!filled.has(`${i},${j}`)) { writeC(i, j); t -= 60; }
    t += 300;
  };

  /* ---- transpose ---- */
  const AT = transpose(a);
  const trShow = () => {
    label('A =', g.marks[0], CY, 'a', 22);
    bracket(g.A);
    entries(g.A, a, 'a');
    label('→', g.marks[1], CY, 'ink', 26);
    label('A^T =', g.marks[2], CY, 'result', 22);
    bracket(g.B);
  };
  const trRows = () => {
    a.forEach((row, i) => {
      const color = ROW_COLORS[i % ROW_COLORS.length];
      const bid = rowBox(g.A, i, color);
      const ids = row.map((x, j) => { const [cx, cy] = cell(g.B, j, i); return put(entryText(x), cx, cy, color, entryText(x).length >= 3 ? 17 : 20); });
      t = m.appear(ids, t, 80, false) + 250;
      clear([bid], t);
      t += 250;
    });
  };
  const trEntry = (i: number, j: number) => {
    dropBoxes();
    boxes.push(cellBox(g.A, i, j, 'carry'), cellBox(g.B, j, i, 'carry'));
    showPanel(moveLines(i, j));
  };
  const trSize = () => showPanel(sizeLines(plan));

  if (plan.title) t = m.step(pick(plan.title, lang), t, 1600);

  for (const st of plan.steps) {
    t = m.step(pick(st.say, lang), t, 2400);
    if (isMul) {
      if (st.op === 'show') mulShow();
      else if (st.op === 'check') mulCheck();
      else if (st.op === 'entry') mulEntry(st.i, st.j);
      else if (st.op === 'all') mulAll();
    } else {
      if (st.op === 'show') trShow();
      else if (st.op === 'rows') trRows();
      else if (st.op === 'entry') trEntry(st.i, st.j);
      else if (st.op === 'size') trSize();
    }
    t += 150;
    m.hold(t);
  }
  void AT;
  m.hold(t + 1400);
  return [m.build()];
}
