/**
 * Maths and geometry for the coordinate geometry DNA (V51.9.39): points and their quadrants, the
 * distance between two points (the right triangle on the grid, Pythagoras) and the midpoint (each
 * coordinate the average). Every number written and every position drawn comes from here.
 */

import type { CoordKind, CoordPlan } from './types';

export type Pt = [number, number];
export type RoleC = 'a' | 'b' | 'c' | 'carry' | 'result' | 'ink';
/** A line of text: words, each optionally coloured with "word@role". */
export type Line = [string, RoleC];

export const CG_KINDS: CoordKind[] = ['points', 'distance', 'midpoint'];
export const CG_OPS: Record<CoordKind, string[]> = {
  points: ['axes', 'plot', 'quadrant'],
  distance: ['axes', 'plot', 'segment', 'legs', 'formula'],
  midpoint: ['axes', 'plot', 'segment', 'midpoint'],
};
export const COORD_MAX = 6;
export const POINT_ROLES: RoleC[] = ['a', 'b', 'c', 'carry'];
const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);

export const num = (n: number): string => (n < 0 ? `−${-n}` : String(n));
/** A number as an operand: negatives in brackets. */
const fac = (n: number): string => (n < 0 ? `(−${-n})` : String(n));
/** 3 → "3", 2.5 → "2.5", −1.5 → "−1.5". */
export const fmt = (v: number): string => num(Math.round(v * 100) / 100);
const pair = (p: Pt): string => `(${num(p[0])}, ${num(p[1])})`;

export const defaultNames = (kind: CoordKind): string[] => ['A', 'B', 'C', 'D'].slice(0, kind === 'points' ? 4 : 2);
export const namesOf = (plan: CoordPlan): string[] => plan.names ?? defaultNames(plan.kind);

export function cgProblem(plan: CoordPlan, path: string): string | null {
  if (!CG_KINDS.includes(plan?.kind)) return `${path}.kind must be one of ${CG_KINDS.join(', ')}.`;
  const pts = plan.points;
  const [lo, hi] = plan.kind === 'points' ? [1, 4] : [2, 2];
  if (!Array.isArray(pts) || pts.length < lo || pts.length > hi) return `${path}.points must list ${lo === hi ? hi : `${lo} to ${hi}`} points.`;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (!Array.isArray(p) || p.length !== 2 || !isInt(p[0]) || !isInt(p[1])) return `${path}.points[${i}] must be [x, y] with whole numbers.`;
    if (Math.abs(p[0]) > COORD_MAX || Math.abs(p[1]) > COORD_MAX) return `${path}.points[${i}]: each coordinate must be from −${COORD_MAX} to ${COORD_MAX}.`;
  }
  if (new Set(pts.map((p) => `${p[0]},${p[1]}`)).size !== pts.length) return `${path}.points must be different from each other.`;
  if (plan.names !== undefined) {
    const n = plan.names;
    if (!Array.isArray(n) || n.length !== pts.length || n.some((x) => typeof x !== 'string' || !/^[A-Z]$/.test(x))) return `${path}.names must be one capital letter for each point.`;
    if (new Set(n).size !== n.length) return `${path}.names must all be different.`;
    if (plan.kind === 'midpoint' && n.includes('M')) return `${path}.names: "M" is kept for the midpoint.`;
  }
  if (plan.kind === 'distance') {
    if (pts[0][0] === pts[1][0] || pts[0][1] === pts[1][1]) return `${path}: the two points must differ in both x and y (a horizontal or vertical segment has no right triangle).`;
  }
  return null;
}

/** The quadrant of a point: "I".."IV", or null when it lies on an axis. */
export const quadrant = (p: Pt): string | null => (p[0] === 0 || p[1] === 0 ? null : p[0] > 0 ? (p[1] > 0 ? 'I' : 'IV') : p[1] > 0 ? 'II' : 'III');

export interface DistFacts { dx: number; dy: number; d2: number; d: number; exact: boolean }
export function distFacts(plan: CoordPlan): DistFacts {
  const [p, q] = plan.points;
  const dx = Math.abs(q[0] - p[0]);
  const dy = Math.abs(q[1] - p[1]);
  const d2 = dx * dx + dy * dy;
  const d = Math.sqrt(d2);
  return { dx, dy, d2, d, exact: Number.isInteger(d) };
}
export const midpointOf = (plan: CoordPlan): Pt => [(plan.points[0][0] + plan.points[1][0]) / 2, (plan.points[0][1] + plan.points[1][1]) / 2];

/* ---------------- the lines written on the board ---------------- */

export function plotLines(plan: CoordPlan, which: number[]): Line[] {
  const names = namesOf(plan);
  return [...which].sort((a, b) => a - b).map((i) => [`${names[i]} = ${pair(plan.points[i])}`, POINT_ROLES[i]] as Line);
}
export function quadrantLines(plan: CoordPlan): Line[] {
  const names = namesOf(plan);
  return plan.points.map((p, i) => {
    const q = quadrant(p);
    const where = q ?? (p[0] === 0 && p[1] === 0 ? 'x = 0, y = 0' : p[1] === 0 ? 'y = 0' : 'x = 0');
    return [`${names[i]} ${pair(p)} : ${where}`, POINT_ROLES[i]] as Line;
  });
}
export function legsLines(plan: CoordPlan): Line[] {
  const [p, q] = plan.points;
  const f = distFacts(plan);
  return [
    [`dx = |${fac(q[0])} − ${fac(p[0])}| = ${f.dx}`, 'a'],
    [`dy = |${fac(q[1])} − ${fac(p[1])}| = ${f.dy}`, 'c'],
  ];
}
export function formulaLines(plan: CoordPlan): Line[] {
  const f = distFacts(plan);
  return [
    ['d^2 = dx^2@a + dy^2@c', 'ink'],
    [`= ${f.dx}^2@a + ${f.dy}^2@c`, 'ink'],
    [`= ${f.dx * f.dx} + ${f.dy * f.dy} = ${f.d2}`, 'ink'],
    [f.exact ? `d = √${f.d2} = ${f.d}` : `d = √${f.d2} ≈ ${fmt(f.d)}`, 'result'],
  ];
}
export function midpointLines(plan: CoordPlan): Line[] {
  const [p, q] = plan.points;
  const m = midpointOf(plan);
  return [
    [`x = (${fac(p[0])} + ${fac(q[0])}) ÷ 2 = ${fmt(m[0])}`, 'a'],
    [`y = (${fac(p[1])} + ${fac(q[1])}) ÷ 2 = ${fmt(m[1])}`, 'c'],
    [`M = ${pair(m)}`, 'result'],
  ];
}

/* ---------------- geometry (design px) ---------------- */

export const CX = 220;
export const CY = 235;
export const WMAX = 340;
export const HMAX = 290;
export const UMAX = 40;

export interface CgGeom {
  xMin: number; xMax: number; yMin: number; yMax: number;
  u: number;
  spec: { left: number; top: number; width: number; height: number; xMin: number; xMax: number; yMin: number; yMax: number };
  px: (x: number, y: number) => Pt;
  /** Offset of each point's letter from its dot (design px). */
  letter: Array<[number, number]>;
  /** Offset of the midpoint's letter M. */
  mLetter: [number, number];
  /** True when the unit is small and only the even numbers are written on the axes. */
  sparse: boolean;
  /** Tick-number boxes: [x, y, half width]. */
  ticks: Array<[number, number, number]>;
  /** Dots (and the midpoint) in design px. */
  dots: Pt[];
  /** Where each point's letter is drawn. */
  letterAt: Array<[number, number]>;
  /** Positions (maths coordinates) of the I, II, III, IV numerals. */
  numerals: Array<{ text: string; at: Pt }>;
}

export function cgGeometry(plan: CoordPlan): CgGeom {
  const xs = plan.points.map((p) => p[0]);
  const ys = plan.points.map((p) => p[1]);
  const xMin = Math.min(-1, Math.min(...xs) - 1);
  const xMax = Math.max(1, Math.max(...xs) + 1);
  const yMin = Math.min(-1, Math.min(...ys) - 1);
  const yMax = Math.max(1, Math.max(...ys) + 1);
  const u = Math.min(WMAX / (xMax - xMin), HMAX / (yMax - yMin), UMAX);
  const width = u * (xMax - xMin);
  const height = u * (yMax - yMin);
  const left = CX - width / 2;
  const top = CY - height / 2;
  const px = (x: number, y: number): Pt => [left + (x - xMin) * u, top + (yMax - y) * u];
  // tick numbers sit below the x-axis and left of the y-axis; a letter must stay clear of them and of the other dots
  const sparse = u < 31;
  const [axX, axY] = px(0, 0);
  const ticks: Array<[number, number, number]> = [];
  for (let k = Math.ceil(xMin); k <= Math.floor(xMax); k++) if (k !== 0 && (!sparse || k % 2 === 0)) ticks.push([px(k, 0)[0], axY + 17, k < 0 ? 13 : 7]);
  for (let k = Math.ceil(yMin); k <= Math.floor(yMax); k++) if (k !== 0 && (!sparse || k % 2 === 0)) ticks.push([axX - 18, px(0, k)[1], k < 0 ? 13 : 7]);
  const dots: Pt[] = plan.points.map((p) => px(p[0], p[1]));
  const mid = plan.kind === 'midpoint' ? midpointOf(plan) : null;
  if (mid) dots.push(px(mid[0], mid[1]));
  const sx = (v: number) => (v < 0 ? -1 : 1);
  const pickLetter = (at: Pt, taken: Array<[number, number]>): [number, number] => {
    const [bx, by] = px(at[0], at[1]);
    const pref: Array<[number, number]> = [[sx(at[0]) * 11, at[1] < 0 ? 14 : -12]];
    for (const dx of [11, -11]) for (const dy of [-12, 14]) pref.push([dx, dy]);
    for (const dx of [18, -18]) for (const dy of [-6, 6]) pref.push([dx, dy]);
    for (const dx of [28, -28]) for (const dy of [-8, 8, -18, 18]) pref.push([dx, dy]);
    pref.push([0, -18], [0, 20]);
    const free = (o: [number, number]) => {
      const lx = bx + o[0];
      const ly = by + o[1];
      if (ticks.some(([tx, ty, hw]) => Math.abs(lx - tx) < hw + 7 && Math.abs(ly - ty) < 17)) return false;
      if (dots.some(([ox, oy]) => Math.hypot(lx - ox, ly - oy) < 13)) return false;
      if (Math.abs(lx - axX) < 11 || Math.abs(ly - axY) < 11) return false;
      if (plan.kind !== 'points') {
        const [a, b] = [dots[0], dots[1]];
        const vx = b[0] - a[0]; const vy = b[1] - a[1];
        const tt = Math.max(0, Math.min(1, ((lx - a[0]) * vx + (ly - a[1]) * vy) / (vx * vx + vy * vy)));
        if (Math.hypot(lx - (a[0] + tt * vx), ly - (a[1] + tt * vy)) < 13) return false;
      }
      if (taken.some(([ox, oy]) => Math.abs(lx - ox) < 14 && Math.abs(ly - oy) < 18)) return false;
      return true;
    };
    return pref.find(free) ?? pref[0];
  };
  const letter: Array<[number, number]> = [];
  const placed: Array<[number, number]> = [];
  plan.points.forEach((p) => {
    const o = pickLetter(p, placed);
    letter.push(o);
    const [bx, by] = px(p[0], p[1]);
    placed.push([bx + o[0], by + o[1]]);
  });
  const mLetter = mid ? pickLetter(mid, placed) : ([11, -12] as [number, number]);
  // numerals: corner of the quadrant, or along an axis end, whichever keeps clear of the dots and letters
  const clear = (at: Pt): boolean => !ticks.some(([tx, ty, hw]) => { const [ax, ay] = px(at[0], at[1]); return Math.abs(ax - tx) < hw + 20 && Math.abs(ay - ty) < 20; }) && plan.points.every((p, i) => {
    const [ax, ay] = px(at[0], at[1]);
    const [bx, by] = px(p[0], p[1]);
    const lx = bx + letter[i][0];
    const ly = by + letter[i][1];
    return Math.hypot(ax - bx, ay - by) >= 30 && Math.hypot(ax - lx, ay - ly) >= 26;
  });
  const numerals: CgGeom['numerals'] = [];
  for (const [text, sx, sy] of [['I', 1, 1], ['II', -1, 1], ['III', -1, -1], ['IV', 1, -1]] as Array<[string, number, number]>) {
    const ex = sx > 0 ? xMax : -xMin;
    const ey = sy > 0 ? yMax : -yMin;
    const cands: Pt[] = [[sx * (ex - 0.5), sy * (ey - 0.5)], [sx * (ex - 0.5), sy * 1.5], [sx * 1.5, sy * (ey - 0.5)], [sx * (ex - 1.5), sy * (ey - 1.5)], [sx * (ex - 1.5), sy * 2.5], [sx * 2.5, sy * (ey - 1.5)]];
    numerals.push({ text, at: cands.find(clear) ?? cands[0] });
  }
  return { xMin, xMax, yMin, yMax, u, spec: { left, top, width, height, xMin, xMax, yMin, yMax }, px, letter, mLetter, numerals, sparse, ticks, dots, letterAt: placed };
}
