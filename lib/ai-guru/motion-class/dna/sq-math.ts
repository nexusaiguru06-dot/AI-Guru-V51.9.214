/**
 * Maths and geometry for the square-identity DNA (V51.9.40): visual proofs of (a + b)² = a² + 2ab + b²,
 * (a − b)² = a² − 2ab + b² and (a + b)(a − b) = a² − b². Every tile, brace, label size and number
 * written comes from here; the planner only chooses the kind, the sides a and b and the order.
 */

import { tokenWidth } from '../../reels/motion/metrics';
import type { SqKind, SqPlan } from './types';

export type Pt = [number, number];
export type RoleS = 'a' | 'b' | 'c' | 'carry' | 'result' | 'ink';
/** A line of text: words, each optionally coloured with "word@role". */
export type Line = [string, RoleS];
export interface Rect { x0: number; y0: number; x1: number; y1: number }

export const SQ_KINDS: SqKind[] = ['sum', 'difference', 'product'];
export const SQ_OPS: Record<SqKind, string[]> = {
  sum: ['square', 'tileA', 'strips', 'tileB', 'name', 'build', 'check'],
  difference: ['square', 'strips', 'corner', 'name', 'build', 'check'],
  product: ['square', 'remove', 'cut', 'move', 'name', 'build', 'check'],
};
export const SQ_TOTAL_MAX = 12;
export const SQ_LABEL_MIN = 11;
const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);

export function sqProblem(plan: SqPlan, path: string): string | null {
  if (!SQ_KINDS.includes(plan?.kind)) return `${path}.kind must be one of ${SQ_KINDS.join(', ')}.`;
  const { a, b, kind } = plan;
  if (!isInt(a) || !isInt(b) || a < 1 || b < 1) return `${path}.a and ${path}.b must be whole numbers, 1 or more.`;
  if (kind === 'sum') {
    if (a === b) return `${path}: a and b must be different (the two a × b strips would look like the a × a tile).`;
    if (a + b > SQ_TOTAL_MAX) return `${path}: a + b must be at most ${SQ_TOTAL_MAX} so the square fits and its tiles can be labelled.`;
  } else {
    if (b >= a) return `${path}: b must be smaller than a (the smaller square is taken out of the larger).`;
    if (a < 2) return `${path}.a must be at least 2.`;
    if (kind === 'product' ? a + b > SQ_TOTAL_MAX : a > SQ_TOTAL_MAX) return `${path}: ${kind === 'product' ? 'a + b' : 'a'} must be at most ${SQ_TOTAL_MAX}.`;
  }
  if (plan.steps?.some((s) => s?.op === 'name') && kind !== 'product') {
    const small = Object.values(sqGeometry(plan).labels).find((l) => l.size < SQ_LABEL_MIN);
    if (small) return `${path}: with a = ${a}, b = ${b} the piece "${small.text}" is too small to label; use a bigger b or a smaller a.`;
  }
  return null;
}

/* ---------------- the lines written on the board ---------------- */

export function titleLines(plan: SqPlan): Line[] {
  if (plan.kind === 'sum') return [['(a@a + b@b)^2', 'ink']];
  if (plan.kind === 'difference') return [['(a@a − b@b)^2', 'ink']];
  return [['a^2@a − b^2@b', 'ink']];
}

/** The identity as rows of words; `flash` says which pieces light up when a word of row `flashRow` appears. */
export function buildRows(plan: SqPlan): { rows: Line[]; flashRow: number; flash: Record<number, string[]> } {
  if (plan.kind === 'sum') {
    return {
      rows: [['(a + b)^2', 'ink'], ['= a^2@a + ab@c + ab@c + b^2@b', 'ink'], ['= a^2@a + 2ab@c + b^2@b', 'result']],
      flashRow: 1,
      flash: { 1: ['A'], 3: ['AB1'], 5: ['AB2'], 7: ['B'] },
    };
  }
  if (plan.kind === 'difference') {
    return {
      rows: [['(a − b)^2', 'ink'], ['= a^2@a − ab@c − ab@carry + b^2@b', 'ink'], ['= a^2@a − 2ab@c + b^2@b', 'result']],
      flashRow: 1,
      flash: { 1: ['outer'], 3: ['strR'], 5: ['strB'], 7: ['corner'] },
    };
  }
  return {
    rows: [['L = a^2@a − b^2@b', 'ink'], ['= (a@a + b@b) × (a@a − b@b)', 'result']],
    flashRow: 0,
    flash: { 2: ['outer'], 4: ['corner'] },
  };
}

export function checkLines(plan: SqPlan): Line[] {
  const { a, b } = plan;
  const head: Line = [`a@a = ${a}@a, b@b = ${b}@b`, 'ink'];
  if (plan.kind === 'sum') return [head, [`(${a} + ${b})^2 = ${a + b}^2 = ${(a + b) ** 2}`, 'ink'], [`${a * a} + ${2 * a * b} + ${b * b} = ${(a + b) ** 2}`, 'result']];
  if (plan.kind === 'difference') return [head, [`(${a} − ${b})^2 = ${a - b}^2 = ${(a - b) ** 2}`, 'ink'], [`${a * a} − ${2 * a * b} + ${b * b} = ${(a - b) ** 2}`, 'result']];
  return [head, [`${a}^2 − ${b}^2 = ${a * a} − ${b * b} = ${a * a - b * b}`, 'ink'], [`(${a} + ${b})(${a} − ${b}) = ${a + b} × ${a - b} = ${a * a - b * b}`, 'result']];
}

/* ---------------- geometry (design px) ---------------- */

export const L = 250;
export const UCAP = 36;
export const CXS = 220;
export const CYS = 235;
const BRACE_PX = 12;

export interface Label { text: string; at: Pt; size: number; role: RoleS }
export interface Brace { pts: Pt[]; text: string; at: Pt; role: RoleS; size: number }
export interface SqGeom {
  u: number; X0: number; Y0: number;
  tiles: Record<string, Rect>;
  labels: Record<string, Label>;
  braces: Record<string, Brace>;
}

export const rectPts = (r: Rect): Pt[] => [[r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1]];
export const rectMid = (r: Rect): Pt => [(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2];

/** A curly brace along a horizontal span, bulging up (d = −1) or down (d = 1) from baseline y. */
export function braceH(x0: number, x1: number, y: number, d: 1 | -1): Pt[] {
  const r = Math.min(BRACE_PX / 2, (x1 - x0) / 4);
  const xm = (x0 + x1) / 2;
  const pts: Pt[] = [];
  const arc = (cx: number, cy: number, from: number, to: number) => { for (let i = 0; i <= 6; i++) { const th = from + ((to - from) * i) / 6; pts.push([cx + r * Math.cos(th), cy + d * r * Math.sin(th)]); } };
  // left tail: centre (x0 + r, y), from the point (x0, y) round to (x0 + r, y + d r)
  arc(x0 + r, y, Math.PI, Math.PI / 2);
  // up to the cusp: centre (xm − r, y + 2 d r), from (xm − r, y + d r) to (xm, y + 2 d r)
  arc(xm - r, y + 2 * d * r, -Math.PI / 2, 0);
  arc(xm + r, y + 2 * d * r, Math.PI, 3 * Math.PI / 2);
  arc(x1 - r, y, Math.PI / 2, 0);
  return pts;
}
/** A curly brace along a vertical span, bulging left (d = −1) or right (d = 1) from baseline x. */
export function braceV(y0: number, y1: number, x: number, d: 1 | -1): Pt[] {
  return braceH(y0, y1, x, d).map(([p, q]) => [q, p] as Pt);
}

export function sqGeometry(plan: SqPlan): SqGeom {
  const { a, b, kind } = plan;
  const wU = kind === 'sum' ? a + b : kind === 'product' ? a + b : a;
  const hU = kind === 'sum' ? a + b : a;
  const u = Math.min(L / Math.max(wU, hU), UCAP);
  const X0 = CXS - (wU * u) / 2;
  const Y0 = CYS - (hU * u) / 2;
  const R = (x0: number, y0: number, x1: number, y1: number): Rect => ({ x0: X0 + x0 * u, y0: Y0 + y0 * u, x1: X0 + x1 * u, y1: Y0 + y1 * u });
  const tiles: Record<string, Rect> = {};
  const labels: Record<string, Label> = {};
  const braces: Record<string, Brace> = {};
  const fit = (text: string, r: Rect): number => Math.floor(Math.min(20, (20 * (r.x1 - r.x0 - 8)) / tokenWidth(text, 20), r.y1 - r.y0 - 8));
  const lab = (key: string, text: string, r: Rect, role: RoleS) => { labels[key] = { text, at: rectMid(r), size: fit(text, r), role }; };
  const BS = 18;
  const top = (key: string, ua: number, ub: number, text: string, role: RoleS) => {
    const y = Y0 - 6;
    const x0 = X0 + ua * u; const x1 = X0 + ub * u;
    braces[key] = { pts: braceH(x0, x1, y, -1), text, at: [(x0 + x1) / 2, y - BRACE_PX - 13], role, size: BS };
  };
  const bottom = (key: string, ua: number, ub: number, text: string, role: RoleS, hu: number) => {
    const y = Y0 + hu * u + 6;
    const x0 = X0 + ua * u; const x1 = X0 + ub * u;
    braces[key] = { pts: braceH(x0, x1, y, 1), text, at: [(x0 + x1) / 2, y + BRACE_PX + 13], role, size: BS };
  };
  const left = (key: string, ua: number, ub: number, text: string, role: RoleS) => {
    const x = X0 - 6;
    const y0 = Y0 + ua * u; const y1 = Y0 + ub * u;
    braces[key] = { pts: braceV(y0, y1, x, -1), text, at: [x - BRACE_PX - 6 - tokenWidth(text, BS) / 2, (y0 + y1) / 2], role, size: BS };
  };
  const right = (key: string, ua: number, ub: number, text: string, role: RoleS, wu: number) => {
    const x = X0 + wu * u + 6;
    const y0 = Y0 + ua * u; const y1 = Y0 + ub * u;
    braces[key] = { pts: braceV(y0, y1, x, 1), text, at: [x + BRACE_PX + 6 + tokenWidth(text, BS) / 2, (y0 + y1) / 2], role, size: BS };
  };

  if (kind === 'sum') {
    const S = a + b;
    tiles.outer = R(0, 0, S, S);
    tiles.A = R(0, 0, a, a);
    tiles.AB1 = R(a, 0, S, a);
    tiles.AB2 = R(0, a, a, S);
    tiles.B = R(a, a, S, S);
    lab('A', 'a^2', tiles.A, 'a'); lab('AB1', 'ab', tiles.AB1, 'c'); lab('AB2', 'ab', tiles.AB2, 'c'); lab('B', 'b^2', tiles.B, 'b');
    bottom('botSum', 0, S, 'a + b', 'ink', S);
    right('rightSum', 0, S, 'a + b', 'ink', S);
    top('topA', 0, a, 'a', 'a'); left('leftA', 0, a, 'a', 'a');
    top('topB', a, S, 'b', 'b'); left('leftB', a, S, 'b', 'b');
  } else if (kind === 'difference') {
    const d = a - b;
    tiles.outer = R(0, 0, a, a);
    tiles.centre = R(0, 0, d, d);
    tiles.strR = R(d, 0, a, a);
    tiles.strB = R(0, d, a, a);
    tiles.corner = R(d, d, a, a);
    tiles.visR = R(d, 0, a, d);
    tiles.visB = R(0, d, d, a);
    lab('centre', '(a − b)^2', tiles.centre, 'result'); lab('visR', 'ab', tiles.visR, 'c'); lab('visB', 'ab', tiles.visB, 'carry'); lab('corner', 'b^2', tiles.corner, 'b');
    top('topA', 0, a, 'a', 'a'); left('leftA', 0, a, 'a', 'a');
    bottom('botB', d, a, 'b', 'b', a); right('rightB', d, a, 'b', 'b', a);
    bottom('botAB', 0, d, 'a − b', 'c', a); right('rightAB', 0, d, 'a − b', 'c', a);
  } else {
    const d = a - b;
    tiles.outer = R(0, 0, a, a);
    tiles.corner = R(d, d, a, a);
    tiles.r1 = R(0, 0, a, d);
    tiles.r2 = R(0, d, d, a);
    tiles.r2m = R(a, 0, a + b, d);
    tiles.rect = R(0, 0, a + b, d);
    bottom('botA', 0, a, 'a', 'a', a); left('leftA', 0, a, 'a', 'a');
    right('rightB', d, a, 'b', 'b', a);
    top('topAB', 0, a + b, 'a + b', 'ink'); right('rightAB', 0, d, 'a − b', 'c', a + b);
  }
  return { u, X0, Y0, tiles, labels, braces };
}
