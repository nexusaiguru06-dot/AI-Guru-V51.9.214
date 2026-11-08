/**
 * The quadratic formula, derived (V51.9.48): the rules for the `quadratic-derivation` DNA. A square of side x
 * and a strip of area b·x are drawn; the strip is split in half, the halves wrap two sides of the square, and
 * the missing corner square (b/2)² completes it. Beside the picture the same steps are typeset in letters and,
 * below them, with the numbers of one example (x² + bx + c = 0 with whole roots). The app computes every
 * point, brace and number; the planner only chooses b and c and writes the spoken captions.
 */

import type { QdPlan } from './types';
import { tokenWidth } from '../../reels/motion/metrics';
import { braceH, braceV, type Pt } from './sq-math';

export const QD_OPS = ['show', 'split', 'bend', 'corner', 'square', 'root', 'answer', 'formula'] as const;
export type QdOpName = (typeof QD_OPS)[number];
/** The steps in the order they must come; "formula" is optional. */
export const QD_REQUIRED: QdOpName[] = ['show', 'split', 'bend', 'corner', 'square', 'root', 'answer'];
export const QD_B_MAX = 16;
export const QD_R_MAX = 12;
export const QD_C_MAX = 80;

/** Half of b, and the root of the right-hand side: (b/2)² − c = r². */
export const qdHalf = (b: number) => b / 2;
export const qdR2 = (b: number, c: number) => (b / 2) * (b / 2) - c;
export function qdR(b: number, c: number): number {
  const r2 = qdR2(b, c);
  const r = Math.round(Math.sqrt(r2));
  return r * r === r2 ? r : -1;
}
/** The two whole roots, larger first. */
export const qdRoots = (b: number, c: number): [number, number] => [-b / 2 + qdR(b, c), -b / 2 - qdR(b, c)];

/** The reason a plan cannot be drawn, or null. */
export function qdProblem(plan: QdPlan, path: string): string | null {
  if (!plan || typeof plan !== 'object') return `${path} is not an object.`;
  const { b, c } = plan;
  if (!Number.isInteger(b) || b < 2 || b > QD_B_MAX || b % 2) return `${path}.b must be an even whole number from 2 to ${QD_B_MAX} (the number in front of x).`;
  if (!Number.isInteger(c) || Math.abs(c) > QD_C_MAX) return `${path}.c must be a whole number from −${QD_C_MAX} to ${QD_C_MAX} (the constant term).`;
  const r = qdR(b, c);
  if (r < 1) return `${path}: (b/2)² − c = ${qdR2(b, c)} must be a perfect square of at least 1, so that the example has two whole roots (try b=6, c=5).`;
  if (r > QD_R_MAX) return `${path}: the roots are too far apart for a classroom example; keep (b/2)² − c at most ${QD_R_MAX * QD_R_MAX}.`;
  if (!Array.isArray(plan.steps) || !plan.steps.length) return `${path}.steps must list the steps (${QD_REQUIRED.join(', ')}).`;
  const ops = plan.steps.map((s) => s?.op);
  for (const [i, s] of plan.steps.entries()) {
    if (!s || typeof s !== 'object') return `${path}.steps[${i}] is not an object.`;
    if (!QD_OPS.includes(s.op)) return `${path}.steps[${i}].op "${s.op}" is not one of ${QD_OPS.join(', ')}.`;
    if (ops.indexOf(s.op) !== i) return `${path}.steps[${i}]: "${s.op}" appears more than once.`;
  }
  const want = ops.includes('formula') ? [...QD_REQUIRED, 'formula'] : QD_REQUIRED;
  if (ops.length !== want.length || want.some((o, i) => ops[i] !== o)) return `${path}.steps must be exactly ${want.join(', ')} in that order ("formula" is optional and last).`;
  return null;
}

/* ---------------- the numbers ---------------- */

const paren = (n: number) => (n < 0 ? `(${n})` : `${n}`);

/** Every typeset line of the derivation, in letters (sym) and in numbers (num). */
export function qdLines(b: number, c: number) {
  const h = b / 2;
  const r = qdR(b, c);
  const rhs = (hh: number) => `${hh * hh} ${c >= 0 ? '-' : '+'} ${Math.abs(c)}`;
  const [x1, x2] = qdRoots(b, c);
  const d = b * b - 4 * c;
  const sym = {
    start: 'x^{2} + \\color{b}{b}x + \\color{c}{c} = 0',
    moved: 'x^{2} + \\color{b}{b}x = -\\color{c}{c}',
    split: 'x^{2} + 2 \\cdot \\frac{b}{2}x = -\\color{c}{c}',
    corner: 'x^{2} + \\color{b}{b}x + (\\frac{b}{2})^{2} = (\\frac{b}{2})^{2} - \\color{c}{c}',
    square: '(x + \\frac{b}{2})^{2} = (\\frac{b}{2})^{2} - \\color{c}{c}',
    root: 'x + \\frac{b}{2} = \\pm\\sqrt{(\\frac{b}{2})^{2} - \\color{c}{c}}',
    answer: 'x = -\\frac{b}{2} \\pm \\sqrt{(\\frac{b}{2})^{2} - \\color{c}{c}}',
    formula: 'x = \\frac{-b \\pm \\sqrt{b^{2} - 4\\color{c}{c}}}{2}',
    general: 'x = \\frac{-b \\pm \\sqrt{b^{2} - 4ac}}{2a}',
  };
  const num = {
    start: `x^{2} + \\color{b}{${b}}x ${c >= 0 ? '+' : '-'} \\color{c}{${Math.abs(c)}} = 0`,
    moved: `x^{2} + \\color{b}{${b}}x = ${-c}`,
    split: `x^{2} + 2 \\cdot ${h}x = ${-c}`,
    corner: `x^{2} + \\color{b}{${b}}x + ${h * h} = ${rhs(h)}`,
    square: `(x + ${h})^{2} = ${r * r}`,
    root: `x + ${h} = \\pm ${r}`,
    answer: `x = -${h} \\pm ${r}`,
    roots: `x = ${x1} \\text{ or } x = ${x2}`,
    formula: `x = \\frac{-${b} \\pm \\sqrt{${b}^{2} - 4 \\cdot ${paren(c)}}}{2}`,
    formula2: `x = \\frac{-${b} \\pm ${Math.sqrt(d)}}{2}`,
  };
  return { sym, num, d };
}

/** The numeric example as one text, for the review and the tests: "x² + 6x + 5 = 0". */
export function qdTitle(b: number, c: number): string {
  return `x² + ${b}x ${c < 0 ? '−' : '+'} ${Math.abs(c)} = 0`;
}

/* ---------------- the picture ---------------- */

export const QD_X0 = 110;
export const QD_Y0 = 124;
/** Side of the x-square, and the width of half the strip (b/2). */
export const QD_S = 140;
export const QD_H = 40;

export interface QdRect { x0: number; y0: number; x1: number; y1: number }
export const qdRect = (r: QdRect): Pt[] => [[r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1]];

const X1 = QD_X0 + QD_S;
const Y1 = QD_Y0 + QD_S;
export const QD_PIECES = {
  square: { x0: QD_X0, y0: QD_Y0, x1: X1, y1: Y1 },
  /** The whole strip b × x, to the right of the square. */
  strip: { x0: X1, y0: QD_Y0, x1: X1 + 2 * QD_H, y1: Y1 },
  /** The half that stays where it is (right of the square). */
  halfStay: { x0: X1, y0: QD_Y0, x1: X1 + QD_H, y1: Y1 },
  /** The half before it moves, and after it has turned and wrapped the bottom of the square. */
  halfFrom: { x0: X1 + QD_H, y0: QD_Y0, x1: X1 + 2 * QD_H, y1: Y1 },
  halfTo: { x0: QD_X0, y0: Y1, x1: X1, y1: Y1 + QD_H },
  corner: { x0: X1, y0: Y1, x1: X1 + QD_H, y1: Y1 + QD_H },
  whole: { x0: QD_X0, y0: QD_Y0, x1: X1 + QD_H, y1: Y1 + QD_H },
};

/** The moving half's corners, in an order that makes the straight-line morph look like a quarter turn. */
export function qdBendPts(): { from: Pt[]; to: Pt[] } {
  const f = QD_PIECES.halfFrom;
  const t = QD_PIECES.halfTo;
  return {
    from: [[f.x0, f.y0], [f.x1, f.y0], [f.x1, f.y1], [f.x0, f.y1]],
    // top-left goes to top-right, and so on round: a quarter turn
    to: [[t.x1, t.y0], [t.x1, t.y1], [t.x0, t.y1], [t.x0, t.y0]],
  };
}

export interface QdBrace { pts: Pt[]; text: string; at: Pt; size: number }
const BR = 12;
const hBrace = (x0: number, x1: number, y: number, up: boolean, text: string, size = 22): QdBrace => ({ pts: braceH(x0, x1, y, up ? -1 : 1), text, at: [(x0 + x1) / 2, up ? y - BR - 14 : y + BR + 14], size });
const vBrace = (y0: number, y1: number, x: number, left: boolean, text: string, size = 22): QdBrace => ({ pts: braceV(y0, y1, x, left ? -1 : 1), text, at: [left ? x - BR - 6 - tokenWidth(text, size) / 2 : x + BR + 6 + tokenWidth(text, size) / 2, (y0 + y1) / 2], size });

export function qdBraces() {
  const P = QD_PIECES;
  return {
    side: vBrace(P.square.y0, P.square.y1, P.square.x0 - 6, true, 'x'),
    top: hBrace(P.square.x0, P.square.x1, P.square.y0 - 6, true, 'x'),
    stripW: hBrace(P.strip.x0, P.strip.x1, P.strip.y0 - 6, true, 'b'),
    halfW: hBrace(P.halfFrom.x0, P.halfFrom.x1, P.halfFrom.y0 - 6, true, 'b/2', 18),
    stayW: hBrace(P.halfStay.x0, P.halfStay.x1, P.halfStay.y0 - 6, true, 'b/2', 18),
    bottomH: vBrace(P.halfTo.y0, P.halfTo.y1, P.halfTo.x0 - 6, true, 'b/2', 16),
    wholeTop: hBrace(P.whole.x0, P.whole.x1, P.whole.y0 - 6, true, 'x + b/2', 20),
    wholeSide: vBrace(P.whole.y0, P.whole.y1, P.whole.x0 - 6, true, 'x + b/2', 16),
  };
}
