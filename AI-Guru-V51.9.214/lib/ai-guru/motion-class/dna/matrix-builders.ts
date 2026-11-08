/**
 * DNA builder for "a matrix as a grid" (V51.9.24): bracketed entries a_ij, a row / a column / the
 * diagonal boxed in turn, the camera zooming into one entry to show that its two subscripts are
 * its row and column, the size A ∈ ℝ^{r×c}, the general n × n and m × n grids with dots, and the
 * Square / Rectangular verdict.
 *
 * The planner chooses what to show; the app writes every subscript, every size and the verdict.
 * The few words on the board (row, column, diagonal, Square Matrix …) come from a fixed
 * two-language dictionary below, so English and Malayalam classes have identical pictures: same
 * items, same places, only those labels change language.
 */

import { Motion, type MotionScene } from '../../reels/motion/engine';
import { DUR, type Role } from '../../reels/motion/grammar';
import { measure, tokenWidth } from '../../reels/motion/metrics';
import { fmtNum, type Pt } from '../../reels/motion/plane';
import type { Lang } from '../../reels/motion/captions';
import type { Bi, MatrixPlan } from './types';

const pick = (b: Bi | undefined, lang: Lang): string => (b ? (lang === 'ml' ? b.ml || b.en : b.en) : '');
const SCENE_W = 720;
const SCENE_H = 444;
const CX = 340;
const CY = 228;
const KIND_Y = 410;
const BLUE = '#1d8fe0';

/** Board words in both languages. The Malayalam is a draft for a teacher to check. */
export const MATRIX_WORDS: Record<string, Bi> = {
  row: { en: 'row', ml: 'വരി' },
  column: { en: 'column', ml: 'നിര' },
  diagonal: { en: 'diagonal', ml: 'വികർണം' },
  rows: { en: '# of rows', ml: '# വരികൾ' },
  columns: { en: '# of columns', ml: '# നിരകൾ' },
  matrix: { en: 'matrix', ml: 'മാട്രിക്സ്' },
  square: { en: 'Square Matrix', ml: 'സമചതുര മാട്രിക്സ്' },
  rectangular: { en: 'Rectangular Matrix', ml: 'ദീർഘചതുര മാട്രിക്സ്' },
};
const word = (k: keyof typeof MATRIX_WORDS, lang: Lang) => (lang === 'ml' ? MATRIX_WORDS[k].ml || MATRIX_WORDS[k].en : MATRIX_WORDS[k].en);

export interface MatrixLayout {
  nr: number;
  nc: number;
  /** Text of the cell (subscripted a_{ij}, a number, or a dots glyph). */
  cell: (i: number, j: number) => string;
  isDots: (i: number, j: number) => boolean;
  dotRow?: number;
  dotCol?: number;
  /** Logical size shown by `size` and decided by `kind`. */
  rowsName: string;
  colsName: string;
  symbolic: boolean;
}

const fmt = (v: number) => fmtNum(v).replace('-', '−');

export function plainLayout(plan: Pick<MatrixPlan, 'rows' | 'cols' | 'entries'>): MatrixLayout {
  return {
    nr: plan.rows,
    nc: plan.cols,
    cell: (i, j) => (plan.entries ? fmt(plan.entries[i][j]) : `a_{${i + 1}${j + 1}}`),
    isDots: () => false,
    rowsName: String(plan.rows),
    colsName: String(plan.cols),
    symbolic: !plan.entries,
  };
}

/** a_{11} a_{12} … a_{1c} / a_{21} a_{22} … a_{2c} / ⋮ ⋮ ⋱ ⋮ / a_{r1} a_{r2} … a_{rc} */
export function generalLayout(r: string, c: string): MatrixLayout {
  const rowTag = (i: number) => (i === 0 ? '1' : i === 1 ? '2' : r);
  const colTag = (j: number) => (j === 0 ? '1' : j === 1 ? '2' : c);
  const dr = (i: number) => (i === 2 ? 2 : -1);
  return {
    nr: 4,
    nc: 4,
    cell: (i, j) => (i === 2 && j === 2 ? '⋱' : i === 2 ? '⋮' : j === 2 ? '…' : `a_{${rowTag(i)}${colTag(j)}}`),
    isDots: (i, j) => i === 2 || j === 2,
    dotRow: dr(2),
    dotCol: 2,
    rowsName: r,
    colsName: c,
    symbolic: true,
  };
}

export const isSquare = (l: MatrixLayout) => l.rowsName === l.colsName;

export function buildMatrix(plan: MatrixPlan, lang: Lang, title: string): MotionScene[] {
  const m = new Motion(title, SCENE_W, SCENE_H);
  m.fixView(SCENE_W / 2, SCENE_W);
  const name = plan.name || 'A';
  let layout = plainLayout(plan);
  let gen = 0;
  let uid = 0;
  let t = 300;
  /** Everything drawn for the current grid, so a new grid can replace it. */
  let group: string[] = [];
  let zoomed: { i: number; j: number; id: string; cx: number; cy: number; px: number } | null = null;
  let dims: string[] = [];
  let geo = { cw: 0, ch: 0, left: 0, top: 0 };
  let tag = 'm0';

  const setGeo = () => {
    const cw = Math.min(92, 400 / layout.nc);
    const ch = Math.min(56, 230 / layout.nr);
    geo = { cw, ch, left: CX - (layout.nc * cw) / 2, top: CY - (layout.nr * ch) / 2 };
  };
  const cellX = (j: number) => geo.left + (j + 0.5) * geo.cw;
  const cellY = (i: number) => geo.top + (i + 0.5) * geo.ch;
  const entryPx = () => Math.min(34, geo.ch * 0.6);
  const fade = (ids: string[], at: number, dur = 350) => {
    for (const id of ids) m.get(id).alpha.to(at, dur, 0);
  };

  const drawGrid = () => {
    setGeo();
    tag = `m${gen++}`;
    const { left, top, cw, ch } = geo;
    const right = left + layout.nc * cw;
    const bot = top + layout.nr * ch;
    const ids: string[] = [];
    const nameId = m.text(`${tag}nm`, `${name} =`, left - 56, CY, { size: 36, color: 'ink', z: 4 });
    ids.push(nameId);
    const bl = `${tag}bl`;
    const br = `${tag}br`;
    let end = m.poly(bl, [[left + 5, top - 4], [left - 4, top - 4], [left - 4, bot + 4], [left + 5, bot + 4]], t, { color: 'ink', closed: false, width: 4, dur: 700, silent: true, z: 2 });
    end = Math.max(end, m.poly(br, [[right - 5, top - 4], [right + 4, top - 4], [right + 4, bot + 4], [right - 5, bot + 4]], t, { color: 'ink', closed: false, width: 4, dur: 700, silent: true, z: 2 }));
    ids.push(bl, br);
    const px = entryPx();
    let k = 0;
    for (let i = 0; i < layout.nr; i++) {
      for (let j = 0; j < layout.nc; j++) {
        const id = `${tag}e${i}_${j}`;
        if (layout.isDots(i, j)) {
          // Dots are drawn as shapes (⋮ ⋱ … are missing from many fonts).
          const step = Math.min(geo.ch, geo.cw) * 0.22;
          const offs = i === 2 && j === 2 ? [[-1, -1], [0, 0], [1, 1]] : i === 2 ? [[0, -1], [0, 0], [0, 1]] : [[-1, 0], [0, 0], [1, 0]];
          offs.forEach(([ox, oy], n) => {
            const did = `${id}d${n}`;
            m.dot(did, cellX(j) + ox * step, cellY(i) + oy * step, t + 300 + k * 60 + n * 80, { color: 'done', r: 3.4 });
            ids.push(did);
          });
        } else {
          m.text(id, layout.cell(i, j), cellX(j), cellY(i), { size: px, color: 'ink', z: 3 });
          m.appear(id, t + 300 + k * 60, 0, false);
          ids.push(id);
        }
        k++;
      }
    }
    m.appear(nameId, t + 100, 0, false);
    m.sound(t, 'scribble', { dur: 800 });
    t = Math.max(end, t + 300 + k * 60 + 350) + 200;
    group = ids;
  };

  const label = (id: string, text: string, x: number, y: number, size: number, color: Role | string) => {
    m.text(id, text, x, y, { size, color, z: 4 });
    group.push(id);
    return id;
  };

  if (plan.title) t = m.step(pick(plan.title, lang), t, 1600);

  for (const s of plan.steps) {
    t = m.step(pick(s.say, lang), t, 2400);
    switch (s.op) {
      case 'show':
        drawGrid();
        break;
      case 'row': {
        const y = cellY(s.index);
        const id = `${tag}row${uid++}`;
        const end = m.box(id, CX, y, layout.nc * geo.cw + 14, geo.ch * 0.92, t, 'carry');
        group.push(id);
        const w = tokenWidth(word('row', lang), 22);
        const lid = label(`${id}t`, word('row', lang), geo.left + layout.nc * geo.cw + 22 + w / 2, y, 22, 'carry');
        t = m.appear(lid, end - 250) + DUR.beat;
        break;
      }
      case 'column': {
        const x = cellX(s.index);
        const id = `${tag}col${uid++}`;
        const end = m.box(id, x, CY, geo.cw * 0.9, layout.nr * geo.ch + 14, t, 'b');
        group.push(id);
        const lid = label(`${id}t`, word('column', lang), x, geo.top + layout.nr * geo.ch + 26, 22, 'b');
        t = m.appear(lid, end - 250) + DUR.beat;
        break;
      }
      case 'diagonal': {
        const k = Math.min(layout.nr, layout.nc);
        const p0: Pt = [cellX(0), cellY(0)];
        const p1: Pt = [cellX(k - 1), cellY(k - 1)];
        const dx = p1[0] - p0[0];
        const dy = p1[1] - p0[1];
        const len = Math.hypot(dx, dy) || 1;
        const d: Pt = [dx / len, dy / len];
        const n: Pt = [-d[1], d[0]];
        const e = Math.min(geo.cw, geo.ch) * 0.55;
        const hw = Math.min(26, geo.ch * 0.5);
        const a: Pt = [p0[0] - d[0] * e, p0[1] - d[1] * e];
        const b: Pt = [p1[0] + d[0] * e, p1[1] + d[1] * e];
        const id = `${tag}diag${uid++}`;
        const end = m.poly(id, [[a[0] + n[0] * hw, a[1] + n[1] * hw], [b[0] + n[0] * hw, b[1] + n[1] * hw], [b[0] - n[0] * hw, b[1] - n[1] * hw], [a[0] - n[0] * hw, a[1] - n[1] * hw]], t, { color: BLUE, closed: true, width: 3.5, dur: 900, z: 2 });
        group.push(id);
        const w = tokenWidth(word('diagonal', lang), 22);
        const lid = label(`${id}t`, word('diagonal', lang), geo.left + w / 2 + 4, geo.top - 22, 22, BLUE);
        t = m.appear(lid, end - 300) + DUR.beat;
        break;
      }
      case 'entry': {
        const id = `${tag}e${s.i}_${s.j}`;
        const cx = cellX(s.j);
        const cy = cellY(s.i);
        m.focus(id, t);
        m.recolor(id, 'c', t + 150);
        t = m.look(t + 200, cy, 150, 900, cx) + 300;
        zoomed = { i: s.i, j: s.j, id, cx, cy, px: entryPx() };
        break;
      }
      case 'indices': {
        const z = zoomed!;
        const text = layout.cell(z.i, z.j);
        const sub = /^a_\{(.)(.)\}$/.exec(text)!;
        const wA = measure('a', z.px);
        const w1 = measure(sub[1], z.px * 0.6);
        const w2 = measure(sub[2], z.px * 0.6);
        const total = wA + w1 + w2;
        const x1 = z.cx - total / 2 + wA + w1 / 2;
        const x2 = z.cx - total / 2 + wA + w1 + w2 / 2;
        const ty = z.cy + z.px * 0.62;
        const ly = z.cy + 60;
        const idr = `${tag}ir${uid++}`;
        const idc = `${tag}ic${uid++}`;
        const lr = m.text(`${idr}t`, word('rows', lang), z.cx - 50, ly, { size: 16, color: 'carry', z: 5 });
        const lc = m.text(`${idc}t`, word('columns', lang), z.cx + 50, ly, { size: 16, color: 'b', z: 5 });
        m.appear([lr, lc], t, 200);
        const e1 = m.arrow(idr, z.cx - 50, ly - 13, x1, ty, t + 300, 'ink');
        const e2 = m.arrow(idc, z.cx + 50, ly - 13, x2, ty, t + 500, 'ink');
        dims.push(lr, lc, idr, idc);
        t = Math.max(e1, e2) + 500;
        break;
      }
      case 'zoomOut': {
        const z = zoomed;
        if (z) {
          m.recolor(z.id, 'ink', t, 350);
          m.unfocus(z.id, t);
        }
        fade(dims, t, 300);
        dims = [];
        t = m.look(t + 100, SCENE_H / 2, SCENE_H, 900) + 300;
        zoomed = null;
        break;
      }
      case 'size': {
        const r = layout.rowsName;
        const c = layout.colsName;
        const a = label(`${tag}sz1${uid++}`, `${name} ∈ ℝ^{${r}×${c}}`, CX, 28, 30, 'ink');
        const b = label(`${tag}sz2${uid++}`, `${r} × ${c} ${word('matrix', lang)}`, CX, 66, 26, isSquare(layout) ? 'c' : 'carry');
        t = m.appear([a, b], t, 250) + DUR.beat;
        break;
      }
      case 'kind': {
        const sq = isSquare(layout);
        const id = label(`${tag}kind${uid++}`, word(sq ? 'square' : 'rectangular', lang), CX, KIND_Y, 32, sq ? 'c' : 'carry');
        t = m.appear(id, t) + DUR.beat;
        break;
      }
      case 'general': {
        fade(group, t, 400);
        t += 500;
        layout = generalLayout(s.rows, s.cols);
        drawGrid();
        break;
      }
    }
    t += 150;
    m.hold(t);
  }
  m.hold(t + 1400);
  return [m.build()];
}
