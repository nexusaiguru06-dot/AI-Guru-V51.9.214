/**
 * Plane — a coordinate plane on the motion engine (the 3Blue1Brown board).
 *
 * Maths coordinates (x right, y up) are mapped to board pixels. Everything drawn on the
 * plane remembers its MATHS coordinates, so one call (`setMatrix`) can shear, rotate, stretch
 * or reflect the whole space: every grid line, vector, dot, label and shape travels in a
 * straight line from where it was to where the matrix sends it — exactly how a matrix
 * transformation is interpolated in the Essence of Linear Algebra videos.
 *
 * The plane only talks to the engine through its verbs (poly, vector, morph, move, swap…),
 * so a plane scene has the same grammar, voice, captions and export as every other scene.
 */

import { Motion, textAt } from './engine';
import type { Role } from './grammar';

/* ---------------- small matrix algebra (row-major [a b; c d]) ---------------- */

/** (x, y) ↦ (a·x + b·y, c·x + d·y). Column 1 = where î lands, column 2 = where ĵ lands. */
export type Mat = [number, number, number, number];
export type Pt = [number, number];

export const IDENT: Mat = [1, 0, 0, 1];
export const matMul = (M: Mat, N: Mat): Mat => [
  M[0] * N[0] + M[1] * N[2],
  M[0] * N[1] + M[1] * N[3],
  M[2] * N[0] + M[3] * N[2],
  M[2] * N[1] + M[3] * N[3],
];
export const matDet = (M: Mat): number => M[0] * M[3] - M[1] * M[2];
export const matApply = (M: Mat, p: Pt): Pt => [M[0] * p[0] + M[1] * p[1], M[2] * p[0] + M[3] * p[1]];

/** 2.5 → "2.5", -3 → "−3", 0.333 → "0.33". */
export function fmtNum(v: number): string {
  const r = Math.round(v * 100) / 100;
  if (r === 0) return '0';
  return `${r < 0 ? '−' : ''}${Math.abs(r)}`;
}

/** A tidy tick step (1, 2, 5, 10, 20, 50…) giving at most `maxTicks` ticks over `range`. */
export function niceStep(range: number, maxTicks = 8): number {
  const raw = range / maxTicks;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const m of [1, 2, 5, 10]) if (m * pow >= raw) return m * pow;
  return 10 * pow;
}

/* ---------------- the plane ---------------- */

export interface PlaneSpec {
  /** Board rectangle of the plane (design px). */
  left: number;
  top: number;
  width: number;
  height: number;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

type Reg =
  | { k: 'poly'; id: string; pts: Pt[] }
  | { k: 'vec'; id: string; from: Pt; to: Pt }
  | { k: 'pt'; id: string; at: Pt; dx: number; dy: number; push?: Push };

/** Label offset measured along (or beside) a drawn vector, so it stays clear of the arrow however the space moves. */
export interface Push {
  from: Pt;
  dist: number;
  /** Beside the arrow (right-hand side of its direction) instead of beyond its tip. */
  perp?: boolean;
}

export const GRID_COLOR = '#b8c4f2';

export class Plane {
  /** Matrix the space is in right now (identity until the first transformation). */
  cur: Mat = IDENT;
  private regs: Reg[] = [];
  private ticks: string[] = [];
  private ghosted = false;
  private matrixIds: string[] = [];
  private matrixAt: Pt | null = null;
  private n = 0;
  /** Set by `grid({ transformable: true })`. */
  private showsGrid = false;
  private ext = 1;
  private step = 1;

  constructor(
    readonly m: Motion,
    readonly spec: PlaneSpec,
    readonly prefix = 'pl',
  ) {}

  /** Maths → board pixels. */
  px(x: number, y: number): Pt {
    const s = this.spec;
    return [s.left + ((x - s.xMin) / (s.xMax - s.xMin)) * s.width, s.top + ((s.yMax - y) / (s.yMax - s.yMin)) * s.height];
  }
  /** Maths point after the current matrix → board pixels. */
  at(p: Pt): Pt {
    const q = matApply(this.cur, p);
    return this.px(q[0], q[1]);
  }
  /** Everything drawn on the plane stays inside its box. */
  clipBox(): [number, number, number, number] {
    const s = this.spec;
    return [s.left - 2, s.top - 2, s.width + 4, s.height + 4];
  }
  private id(tag: string): string {
    return `${this.prefix}_${tag}${this.n++}`;
  }

  /* ----- axes, grid, tick labels ----- */

  /**
   * Axes with tick numbers and (optionally) the grid. `extend` > 1 draws grid lines far beyond the
   * visible plane so that a transformed grid still fills the board. With `transformable` the grid and
   * axes move with `setMatrix`; the tick numbers fade out at the first transformation.
   */
  grid(t: number, o: { extend?: number; step?: number; lines?: boolean; vlines?: boolean; labels?: boolean | 'y'; transformable?: boolean } = {}): number {
    const s = this.spec;
    const ext = o.extend ?? 1;
    const step = o.step ?? niceStep(Math.max(s.xMax - s.xMin, s.yMax - s.yMin) / 2 + 0.001, 6);
    this.ext = ext;
    this.step = step;
    this.showsGrid = !!o.transformable;
    const reg = !!o.transformable;
    const x0 = s.xMin * ext;
    const x1 = s.xMax * ext;
    const y0 = s.yMin * ext;
    const y1 = s.yMax * ext;
    const axisY = Math.max(s.yMin, Math.min(0, s.yMax));
    const axisX = Math.max(s.xMin, Math.min(0, s.xMax));
    let end = t;
    const line = (tag: string, a: Pt, b: Pt, color: string, width: number, at: number, z: number): string => {
      const id = this.id(tag);
      end = Math.max(end, this.m.poly(id, [this.px(a[0], a[1]), this.px(b[0], b[1])], at, { color, closed: false, width, dur: 520, z, silent: true, background: true, clip: this.clipBox() }));
      if (reg) this.regs.push({ k: 'poly', id, pts: [a, b] });
      return id;
    };
    if (o.lines !== false) {
      const kx0 = Math.ceil(x0 / step);
      const kx1 = Math.floor(x1 / step);
      for (let k = kx0; o.vlines !== false && k <= kx1; k++) {
        if (k === 0 && axisX === 0) continue;
        const d = Math.min(Math.abs(k * step) / (s.xMax - s.xMin), 1);
        line('gv', [k * step, y0], [k * step, y1], GRID_COLOR, 1.6, t + d * 700, 0);
      }
      const ky0 = Math.ceil(y0 / step);
      const ky1 = Math.floor(y1 / step);
      for (let k = ky0; k <= ky1; k++) {
        if (k === 0 && axisY === 0) continue;
        const d = Math.min(Math.abs(k * step) / (s.yMax - s.yMin), 1);
        line('gh', [x0, k * step], [x1, k * step], GRID_COLOR, 1.6, t + d * 700, 0);
      }
    }
    // Axes on top of the grid.
    line('ax', [x0, axisY], [x1, axisY], 'ink', 3.2, t, 1);
    line('ay', [axisX, y0], [axisX, y1], 'ink', 3.2, t, 1);
    this.m.sound(t, 'scribble', { dur: 700 });
    if (o.labels !== false) {
      const lab: string[] = [];
      const size = 18;
      for (let k = Math.ceil(s.xMin / step); k <= Math.floor(s.xMax / step) && o.labels !== 'y'; k++) {
        if (k === 0 && axisX === 0 && axisY === 0) continue;
        const [x, y] = this.px(k * step, axisY);
        lab.push(this.m.text(this.id('tx'), fmtNum(k * step), x, y + 17, { size, color: 'ink', z: 2 }));
      }
      for (let k = Math.ceil(s.yMin / step); k <= Math.floor(s.yMax / step); k++) {
        if (k === 0 && axisX === 0 && axisY === 0) continue;
        const [x, y] = this.px(axisX, k * step);
        lab.push(this.m.text(this.id('ty'), fmtNum(k * step), x - 18, y, { size, color: 'ink', z: 2 }));
      }
      this.ticks.push(...lab);
      end = Math.max(end, this.m.appear(lab, t + 500, 12, false));
    }
    this.m.until(end + 200);
    return end;
  }

  /** A faint copy of the untransformed grid stays behind while the space moves. */
  private ghost(t: number): void {
    if (this.ghosted || !this.showsGrid) return;
    this.ghosted = true;
    const s = this.spec;
    const step = this.step;
    const mk = (a: Pt, b: Pt) => {
      const id = this.id('gh');
      this.m.poly(id, [this.px(a[0], a[1]), this.px(b[0], b[1])], t, { color: GRID_COLOR, closed: false, width: 1.4, dur: 1, z: -1, silent: true, background: true, clip: this.clipBox() });
      this.m.get(id).alpha.to(t + 1, 300, 0.45);
    };
    for (let k = Math.ceil(s.xMin / step); k <= Math.floor(s.xMax / step); k++) mk([k * step, s.yMin], [k * step, s.yMax]);
    for (let k = Math.ceil(s.yMin / step); k <= Math.floor(s.yMax / step); k++) mk([s.xMin, k * step], [s.xMax, k * step]);
  }

  /* ----- things on the plane (all remember their maths coordinates) ----- */

  vector(tag: string, from: Pt, to: Pt, t: number, o: { color?: Role | string; width?: number; dur?: number } = {}): { id: string; end: number } {
    const id = this.id(tag);
    const a = this.at(from);
    const b = this.at(to);
    const end = this.m.vector(id, a[0], a[1], b[0], b[1], t, o);
    this.regs.push({ k: 'vec', id, from, to });
    return { id, end };
  }

  /** Text that sits next to a maths point and follows it. */
  label(tag: string, text: string, p: Pt, t: number, o: { dx?: number; dy?: number; color?: Role | string; size?: number; push?: Push } = {}): { id: string; end: number } {
    const id = this.id(tag);
    const reg: Reg = { k: 'pt', id, at: p, dx: o.dx ?? 16, dy: o.dy ?? -16, push: o.push };
    const [x, y] = this.where(reg);
    this.m.text(id, text, x, y, { size: o.size ?? 24, color: o.color ?? 'ink', z: 4 });
    this.regs.push(reg);
    return { id, end: this.m.appear(id, t) };
  }

  /** Board position of a registered point-like item under the current matrix. */
  private where(r: Extract<Reg, { k: 'pt' }>): Pt {
    const q = this.at(r.at);
    if (!r.push) return [q[0] + r.dx, q[1] + r.dy];
    const a = this.at(r.push.from);
    let ux = q[0] - a[0];
    let uy = q[1] - a[1];
    const len = Math.hypot(ux, uy);
    if (len < 1e-6) {
      ux = 0;
      uy = -1;
    } else {
      ux /= len;
      uy /= len;
    }
    return r.push.perp ? [q[0] - uy * r.push.dist, q[1] + ux * r.push.dist] : [q[0] + ux * r.push.dist, q[1] + uy * r.push.dist];
  }

  dot(tag: string, p: Pt, t: number, o: { color?: Role | string; r?: number } = {}): { id: string; end: number } {
    const id = this.id(tag);
    const q = this.at(p);
    const end = this.m.dot(id, q[0], q[1], t, { color: o.color ?? 'ink', r: o.r ?? 6 });
    this.regs.push({ k: 'pt', id, at: p, dx: 0, dy: 0 });
    return { id, end };
  }

  /** A polygon / polyline in maths coordinates; follows every transformation. */
  shape(tag: string, pts: Pt[], t: number, o: { color?: Role | string; fill?: Role | string; fillAlpha?: number; closed?: boolean; width?: number; dashed?: boolean; dur?: number } = {}): { id: string; end: number } {
    const id = this.id(tag);
    const end = this.m.poly(
      id,
      pts.map((p) => this.at(p)),
      t,
      { color: o.color ?? 'ink', fill: o.fill, fillAlpha: o.fillAlpha, closed: o.closed ?? true, width: o.width ?? 3, dashed: o.dashed, dur: o.dur ?? 800, z: 1, clip: this.clipBox() },
    );
    this.regs.push({ k: 'poly', id, pts });
    return { id, end };
  }

  /** A function curve sampled on [x0, x1]; `reg` makes it follow transformations. */
  curvePoints(fn: (x: number) => number, x0: number, x1: number, n = 96): Pt[] {
    const pts: Pt[] = [];
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n;
      pts.push([x, fn(x)]);
    }
    return pts;
  }

  curve(tag: string, fn: (x: number) => number, x0: number, x1: number, t: number, o: { color?: Role | string; width?: number; dur?: number; n?: number } = {}): { id: string; end: number; pts: Pt[] } {
    const pts = this.curvePoints(fn, x0, x1, o.n);
    const id = this.id(tag);
    const end = this.m.poly(
      id,
      pts.map((p) => this.px(p[0], p[1])),
      t,
      { color: o.color ?? 'b', closed: false, width: o.width ?? 4, dur: o.dur ?? 1500, z: 1 },
    );
    return { id, end, pts };
  }

  /** Bend an existing curve into another function (same x samples). */
  morphCurve(id: string, fn: (x: number) => number, x0: number, x1: number, t: number, dur = 1600, n = 96): number {
    const pts = this.curvePoints(fn, x0, x1, n).map((p) => this.px(p[0], p[1]));
    return this.m.morph(id, pts, t, { dur });
  }

  /* ----- the transformation ----- */

  /** Send the whole space to the matrix `M` (absolute: [1,0,0,1] = back to normal). */
  setMatrix(M: Mat, t: number, o: { dur?: number } = {}): number {
    const dur = o.dur ?? 1800;
    this.ghost(t);
    this.cur = M;
    for (const r of this.regs) {
      if (r.k === 'poly') this.m.morph(r.id, r.pts.map((p) => this.at(p)), t, { dur });
      else if (r.k === 'vec') {
        const a = this.at(r.from);
        const b = this.at(r.to);
        this.m.moveVector(r.id, a[0], a[1], b[0], b[1], t, dur);
      } else {
        const q = this.where(r);
        this.m.move(r.id, q[0], q[1], t, { dur, sound: false });
      }
    }
    for (const id of this.ticks) this.m.get(id).alpha.to(t, 350, 0);
    this.ticks = [];
    this.m.sound(t, 'whoosh', { dur });
    this.syncMatrix(t + dur * 0.35, M);
    this.m.until(t + dur);
    return t + dur;
  }

  /** Apply `M` after whatever transformation is already in place (composition: M · cur). */
  apply(M: Mat, t: number, o: { dur?: number } = {}): number {
    return this.setMatrix(matMul(M, this.cur), t, o);
  }

  /* ----- the matrix on the board ----- */

  /** Show the 2×2 matrix at board position (x, y); its columns are coloured like î (green) and ĵ (red). */
  showMatrix(x: number, y: number, t: number, size = 38): number {
    this.matrixAt = [x, y];
    const dx = size * 1.35;
    const dy = size * 1.15;
    const ids: string[] = [];
    this.cur.forEach((v, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const id = this.m.text(this.id('mx'), fmtNum(v), x + (col - 0.5) * dx, y + (row - 0.5) * dy, { size, color: col === 0 ? 'c' : 'a', z: 4 });
      ids.push(id);
    });
    this.matrixIds = ids;
    const hw = dx + size * 0.25;
    const hh = dy + size * 0.1;
    const br = (sign: 1 | -1, tag: string) =>
      this.m.poly(
        this.id(tag),
        [
          [x + sign * (hw - 9), y - hh],
          [x + sign * hw, y - hh],
          [x + sign * hw, y + hh],
          [x + sign * (hw - 9), y + hh],
        ],
        t,
        { color: 'ink', closed: false, width: 3.5, dur: 450, z: 4, silent: true },
      );
    br(-1, 'bl');
    br(1, 'br');
    return this.m.appear(ids, t + 150, 90);
  }

  /** Roll the four numbers to the current (or given) matrix. */
  private syncMatrix(t: number, M: Mat = this.cur): void {
    if (!this.matrixIds.length) return;
    M.forEach((v, i) => {
      const id = this.matrixIds[i];
      const next = fmtNum(v);
      if (textAt(this.m.get(id), t + i * 60).text !== next) this.m.swap(id, next, t + i * 60);
    });
  }

  get hasMatrix(): boolean {
    return this.matrixIds.length > 0;
  }
  get matrixCentre(): Pt | null {
    return this.matrixAt;
  }
}
