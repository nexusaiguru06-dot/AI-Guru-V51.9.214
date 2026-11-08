/**
 * The geometry and arithmetic behind the angle DNA (V51.9.32): parallel lines cut by a transversal
 * (vertically opposite, linear pair, corresponding, alternate and co-interior angles), the angle sum
 * and the exterior angle of a triangle, and the circle theorems (angle at the centre, angle in a
 * semicircle, angles in the same segment, opposite angles of a cyclic quadrilateral).
 *
 * The planner gives one or two whole-degree angles. Every other angle, every line the board writes
 * and every point of every figure is computed here, so the picture and the numbers are true whatever
 * the plan says. Angles are drawn as arcs and written in degrees (the board font has no ∠ sign).
 */

export type Pt = [number, number];
export type Figure = 'parallel' | 'triangle' | 'circle';
export type Pos = 'tl' | 'tr' | 'bl' | 'br' | 'tl2' | 'tr2' | 'bl2' | 'br2';
export const POSITIONS: Pos[] = ['tl', 'tr', 'bl', 'br', 'tl2', 'tr2', 'bl2', 'br2'];
export type Relation = 'vertical' | 'linear' | 'corresponding' | 'alternate' | 'cointerior';

export const PAR_MIN = 30;
export const PAR_MAX = 150;
export const TRI_MIN = 20;
export const TRI_MAX = 120;
export const BETA_MIN = 20;
export const BETA_MAX = 90;

const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);
export const deg = (n: number) => `${String(n).replace('-', '−')}°`;
const rad = (d: number) => (d * Math.PI) / 180;

/* ---------------- plan checks ---------------- */

export function parallelProblem(a: unknown, at: unknown, path: string): string | null {
  if (!isInt(a) || a < PAR_MIN || a > PAR_MAX || a === 90) return `${path}.a must be a whole number of degrees from ${PAR_MIN} to ${PAR_MAX}, not 90 (a right angle makes all eight angles equal).`;
  if (at !== undefined && !POSITIONS.includes(at as Pos)) return `${path}.at must be one of ${POSITIONS.join(', ')}.`;
  return null;
}
export function triangleProblem(A: unknown, B: unknown, path: string): string | null {
  if (!isInt(A) || !isInt(B) || A < TRI_MIN || A > TRI_MAX || B < TRI_MIN || B > TRI_MAX) return `${path}.A and ${path}.B must be whole numbers of degrees from ${TRI_MIN} to ${TRI_MAX}.`;
  if (A + B > 160 || A + B < 60) return `${path}: A + B must be between 60 and 160 so the third angle is between 20 and 120.`;
  return null;
}
export function circleProblem(beta: unknown, path: string): string | null {
  if (!isInt(beta) || beta < BETA_MIN || beta > BETA_MAX) return `${path}.beta (the angle at the circumference) must be a whole number of degrees from ${BETA_MIN} to ${BETA_MAX}.`;
  return null;
}

/* ---------------- parallel lines and a transversal ---------------- */

/** Value of an angle at either intersection: tr and bl equal θ; tl and br equal 180° − θ. */
export const parValue = (theta: number, pos: Pos): number => (pos === 'tr' || pos === 'bl' || pos === 'tr2' || pos === 'bl2' ? theta : 180 - theta);

const BASE: Record<string, Pos> = { tl: 'tl', tr: 'tr', bl: 'bl', br: 'br', tl2: 'tl', tr2: 'tr', bl2: 'bl', br2: 'br' };
const lower = (p: Pos) => p.endsWith('2');
const withLevel = (p: Pos, low: boolean): Pos => (low ? (`${BASE[p]}2` as Pos) : BASE[p]);
const OPP: Record<string, Pos> = { tl: 'br', br: 'tl', tr: 'bl', bl: 'tr' };
const ACROSS: Record<string, Pos> = { tl: 'tr', tr: 'tl', bl: 'br', br: 'bl' };
const INTERIOR = (p: Pos) => (!lower(p) && (p === 'bl' || p === 'br')) || (lower(p) && (p === 'tl2' || p === 'tr2'));

export interface Partner {
  pos: Pos;
  /** The two angles are equal, or they add up to 180°. */
  kind: 'equal' | 'sum';
  value: number;
  /** Text lines for the board. */
  lines: string[];
}

/** The angle related to `from` by the relation, with its value and the sentence of numbers. */
export function partnerOf(theta: number, from: Pos, rel: Relation): Partner {
  const low = lower(from);
  const b = BASE[from];
  let pos: Pos;
  switch (rel) {
    case 'vertical':
      pos = withLevel(OPP[b], low);
      break;
    case 'linear':
      pos = withLevel(ACROSS[b], low);
      break;
    case 'corresponding':
      pos = withLevel(b, !low);
      break;
    case 'alternate':
      // interior pairs: bl ↔ tr2, br ↔ tl2; exterior pairs: tl ↔ br2, tr ↔ bl2 (and back)
      pos = withLevel(OPP[b], !low);
      break;
    case 'cointerior':
      // interior pairs: bl ↔ tl2, br ↔ tr2; exterior pairs: tl ↔ bl2, tr ↔ br2 (and back)
      pos = withLevel(b === 'tl' ? 'bl' : b === 'bl' ? 'tl' : b === 'tr' ? 'br' : 'tr', !low);
      break;
  }
  const v = parValue(theta, from);
  const w = parValue(theta, pos);
  const equal = v === w;
  const lines = equal ? [`${deg(v)} = ${deg(w)}`] : [`${deg(v)} + ${deg(w)} = ${deg(180)}`];
  return { pos, kind: equal ? 'equal' : 'sum', value: w, lines };
}

/** The expected truth of a relation, used by tests: vertical, corresponding and alternate are equal; linear and co-interior add to 180°. */
export const relationIsEqual = (rel: Relation) => rel === 'vertical' || rel === 'corresponding' || rel === 'alternate';

/** Is the angle between the lines (interior)? */
export const isInterior = INTERIOR;

/** Direction range (degrees, counter-clockwise, y up) swept by an angle at an intersection. */
export function sector(theta: number, pos: Pos): [number, number] {
  switch (BASE[pos]) {
    case 'tr':
      return [0, theta];
    case 'tl':
      return [theta, 180];
    case 'bl':
      return [180, 180 + theta];
    default:
      return [180 + theta, 360];
  }
}

export interface ParGeom {
  top: number;
  bottom: number;
  x0: number;
  x1: number;
  P: Pt;
  Q: Pt;
  /** Ends of the transversal. */
  t0: Pt;
  t1: Pt;
}
export const PAR_TOP = 170;
export const PAR_BOTTOM = 300;
export function parGeometry(theta: number): ParGeom {
  const cot = Math.cos(rad(theta)) / Math.sin(rad(theta));
  const P: Pt = [230 + 65 * cot, PAR_TOP];
  const Q: Pt = [230 - 65 * cot, PAR_BOTTOM];
  const ux = Math.cos(rad(theta));
  const uy = -Math.sin(rad(theta));
  return { top: PAR_TOP, bottom: PAR_BOTTOM, x0: 40, x1: 410, P, Q, t0: [Q[0] - ux * 60, Q[1] - uy * 60], t1: [P[0] + ux * 60, P[1] + uy * 60] };
}
/** Screen point at distance r from an intersection in direction `a` degrees (counter-clockwise, y up). */
export const polar = (c: Pt, r: number, a: number): Pt => [c[0] + r * Math.cos(rad(a)), c[1] - r * Math.sin(rad(a))];
/** Points of an arc about c from a0 to a1 degrees. */
export function arcAt(c: Pt, r: number, a0: number, a1: number, n = 24): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) out.push(polar(c, r, a0 + ((a1 - a0) * i) / n));
  return out;
}
/** Where an angle's label sits: along the bisector, further out when the angle is narrow. */
export function labelRadius(sweep: number, base = 30): number {
  const half = Math.max(rad(sweep / 2), 0.05);
  return Math.min(86, Math.max(base + 18, 24 / Math.sin(half)));
}

/* ---------------- triangle ---------------- */

export interface TriGeom {
  A: Pt;
  B: Pt;
  C: Pt;
  /** Interior angles in degrees. */
  a: number;
  b: number;
  c: number;
  /** Extension of BC beyond C. */
  D: Pt;
}
export const TRI_BOX = { x0: 50, x1: 400, y0: 120, y1: 400 };
export function triGeometry(A: number, B: number): TriGeom {
  const C = 180 - A - B;
  // B at the origin, C along the x-axis, A above (y up): the law of sines gives AB
  const L = 1;
  const AB = (L * Math.sin(rad(C))) / Math.sin(rad(A));
  const ax = AB * Math.cos(rad(B));
  const ay = AB * Math.sin(rad(B));
  const minX = Math.min(0, ax);
  const maxX = Math.max(L, ax);
  const w = maxX - minX;
  const h = ay;
  const room = { w: TRI_BOX.x1 - TRI_BOX.x0 - 90, h: TRI_BOX.y1 - TRI_BOX.y0 - 40 };
  const s = Math.min(room.w / w, room.h / h);
  const ox = TRI_BOX.x0 + 20 - minX * s;
  const oy = TRI_BOX.y1 - 10;
  const toS = (x: number, y: number): Pt => [ox + x * s, oy - y * s];
  const Bp = toS(0, 0);
  const Cp = toS(L, 0);
  return { A: toS(ax, ay), B: Bp, C: Cp, a: A, b: B, c: C, D: [Cp[0] + 70, Cp[1]] };
}

export function triLines(A: number, B: number) {
  const C = 180 - A - B;
  return {
    C,
    find: [`C = ${deg(180)} − ${deg(A)} − ${deg(B)}`, `C = ${deg(C)}`],
    sum: [`${deg(A)} + ${deg(B)} + ${deg(C)} = ${deg(180)}`],
    exterior: [`${deg(C)} + ${deg(A + B)} = ${deg(180)}`, `${deg(A + B)} = ${deg(A)} + ${deg(B)}`],
    exteriorValue: A + B,
  };
}

/* ---------------- circle ---------------- */

export const CIRCLE = { cx: 230, cy: 250, r: 125 };
export interface CircleGeom {
  O: Pt;
  A: Pt;
  B: Pt;
  P: Pt;
  Q: Pt;
  /** Second point on the minor arc (for the cyclic quadrilateral). */
  M: Pt;
  alpha: number;
  beta: number;
  /** Directions (degrees) of A and B from O. */
  aA: number;
  aB: number;
}
export function circleGeometry(beta: number): CircleGeom {
  const alpha = 2 * beta;
  const O: Pt = [CIRCLE.cx, CIRCLE.cy];
  const aA = 270 - alpha / 2;
  const aB = 270 + alpha / 2;
  const half = Math.min(55, 180 - alpha / 2 - 15);
  return {
    O,
    A: polar(O, CIRCLE.r, aA),
    B: polar(O, CIRCLE.r, aB),
    P: polar(O, CIRCLE.r, 90),
    Q: polar(O, CIRCLE.r, 90 + half),
    M: polar(O, CIRCLE.r, 270),
    alpha,
    beta,
    aA,
    aB,
  };
}
/** Angle at a point X of the circle between XA and XB, from coordinates (an independent check of the theorems). */
export function angleAt(X: Pt, A: Pt, B: Pt): number {
  const a = Math.atan2(-(A[1] - X[1]), A[0] - X[0]);
  const b = Math.atan2(-(B[1] - X[1]), B[0] - X[0]);
  let d = Math.abs(a - b);
  if (d > Math.PI) d = 2 * Math.PI - d;
  return (d * 180) / Math.PI;
}

export function circleLines(beta: number) {
  const alpha = 2 * beta;
  return {
    alpha,
    double: [`2 × ${deg(beta)} = ${deg(alpha)}`],
    same: [`${deg(beta)} = ${deg(beta)}`],
    cyclic: [`${deg(beta)} + ${deg(180 - beta)} = ${deg(180)}`],
    cyclicValue: 180 - beta,
  };
}

/* ---------------- reading angles from text ---------------- */

/** Whole-degree numbers written like 70° or 70 degrees, in order of appearance. */
export function degreesIn(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/(\d{1,3})\s*(?:°|º|degrees?)/gi)) out.push(parseInt(m[1], 10));
  return out;
}
