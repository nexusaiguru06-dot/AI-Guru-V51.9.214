/**
 * Maths and geometry for the balance-scale DNA (V51.9.43): the one- and two-step linear equation
 * a x + b = c shown as a scale. Left pan: a tiles of x and one tile for b; right pan: one tile for c.
 * Whatever is done to one pan is done to the other (move b across, merge, divide by a), and the
 * equation is written line by line beside it. Every number written and every tile drawn comes
 * from here, so the picture and the working always agree.
 */

import type { BalPlan } from './types';

export type Pt = [number, number];
export type BalRole = 'a' | 'b' | 'c' | 'carry' | 'result' | 'ink';
/** One written token and its colour. */
export type Tok = [string, BalRole];

export const BAL_OPS = ['show', 'cancel', 'move', 'simplify', 'divide', 'answer', 'check'];
export const BAL_A_MAX = 4;
export const BAL_B_MAX = 12;
export const BAL_X_MAX = 100;
export const BAL_C_MAX = 600;
export const BAL_LETTERS = ['x', 'y', 'z', 'n', 'm', 'p', 't'];
export const BAL_SCALES = [1, 10, 100, 1000];

const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);

/** The reason a plan cannot be drawn, or null. */
export function balProblem(plan: BalPlan, path: string): string | null {
  if (!isInt(plan?.a) || plan.a < 1 || plan.a > BAL_A_MAX) return `${path}.a must be a whole number from 1 to ${BAL_A_MAX} (the number of x tiles).`;
  if (!isInt(plan.b) || Math.abs(plan.b) > BAL_B_MAX) return `${path}.b must be a whole number from −${BAL_B_MAX} to ${BAL_B_MAX}.`;
  if (!isInt(plan.c) || plan.c < 1 || plan.c > BAL_C_MAX) return `${path}.c must be a whole number from 1 to ${BAL_C_MAX}.`;
  if (plan.letter !== undefined && !BAL_LETTERS.includes(plan.letter)) return `${path}.letter must be one of ${BAL_LETTERS.join(', ')}.`;
  if (plan.scale !== undefined && !BAL_SCALES.includes(plan.scale)) return `${path}.scale must be 1, 10, 100 or 1000 (every value is written × scale).`;
  if (plan.d !== undefined && (!isInt(plan.d) || plan.d < 1 || plan.d >= plan.a)) return `${path}.d (x tiles on the right pan) must be a whole number from 1 to a − 1 (a is ${plan.a}).`;
  const d = plan.d ?? 0;
  if (plan.a === 1 && plan.b === 0) return `${path}: x = c has nothing to balance; use a ≥ 2 or b ≠ 0.`;
  const ae = plan.a - d;
  const n = plan.c - plan.b;
  if (n % ae !== 0) return `${path}: ${plan.a}x ${plan.b < 0 ? '−' : '+'} ${Math.abs(plan.b)} = ${d ? `${d}x + ` : ''}${plan.c} has no whole-number answer (${n} ÷ ${ae} is not whole). Choose c so that c − b is a multiple of ${ae}.`;
  const x = n / ae;
  if (x < 1 || x > BAL_X_MAX) return `${path}: the answer ${x} must be a whole number from 1 to ${BAL_X_MAX}.`;
  return null;
}

export interface BalFacts {
  /** The x tiles that are left once the same number is taken off both pans (a − d); the lines after "cancel" use this. */
  a: number;
  /** The x tiles on the left pan at the start. */
  a0: number;
  /** The x tiles on the right pan at the start (0 when x is on one side only). */
  d: number;
  b: number;
  c: number;
  letter: string;
  /** What is left on the right once b is moved across: c − b. */
  n: number;
  /** The answer. */
  x: number;
  /** The sign written between a x and b on the left: '+' or '−'. */
  sign: '+' | '−';
  /** The sign written on the right once b has moved: '−' when b is positive, '+' when negative. */
  moved: '+' | '−';
  /** Every value is written × k (1, 10, 100 or 1000): 3x = 3 tiles with 3000 written. */
  k: number;
}

/** A value as written on the board (× the plan's unit). */
export const sv = (f: Pick<BalFacts, 'k'>, v: number): string => String(v * f.k);

export function balFacts(plan: BalPlan): BalFacts {
  const { b, c } = plan;
  const d = plan.d ?? 0;
  const a = plan.a - d;
  const n = c - b;
  return { a, a0: plan.a, d, b, c, letter: plan.letter ?? 'x', n, x: n / a, sign: b < 0 ? '−' : '+', moved: b < 0 ? '+' : '−', k: plan.scale ?? 1 };
}

/** The equation lines, in the order the steps write them, as coloured tokens. */
export function lineShow(plan: BalPlan): Tok[] {
  const f = balFacts(plan);
  const t: Tok[] = [];
  if (f.a0 > 1) t.push([String(f.a0), 'a']);
  t.push([f.letter, 'ink']);
  if (f.b !== 0) t.push([f.sign, 'ink'], [sv(f, Math.abs(f.b)), 'b']);
  t.push(['=', 'ink']);
  if (f.d > 0) {
    if (f.d > 1) t.push([String(f.d), 'a']);
    t.push([f.letter, 'ink'], ['+', 'ink']);
  }
  t.push([sv(f, f.c), 'c']);
  return t;
}
/** After "cancel": a x + b = c with the smaller number of x tiles (or x = c when nothing else is left). */
export function lineCancel(plan: BalPlan): Tok[] {
  const f = balFacts(plan);
  const t: Tok[] = [];
  if (f.a > 1) t.push([String(f.a), 'a']);
  t.push([f.letter, 'ink']);
  if (f.b !== 0) t.push([f.sign, 'ink'], [sv(f, Math.abs(f.b)), 'b']);
  t.push(['=', 'ink'], [sv(f, f.c), f.a === 1 && f.b === 0 ? 'result' : 'c']);
  return t;
}
/** The small note beside the cancel line. */
export const cancelNote = (plan: BalPlan, letter = 'x') => `− ${(plan.d ?? 0) > 1 ? plan.d : ''}${letter} both sides`;
/** a x = c − b, or a x = c + b. */
export function lineMove(plan: BalPlan): Tok[] {
  const f = balFacts(plan);
  const t: Tok[] = [];
  if (f.a > 1) t.push([String(f.a), 'a']);
  t.push([f.letter, 'ink'], ['=', 'ink'], [sv(f, f.c), 'c'], [f.moved, 'ink'], [sv(f, Math.abs(f.b)), 'b']);
  return t;
}
/** a x = n. */
export function lineSimplify(plan: BalPlan): Tok[] {
  const f = balFacts(plan);
  const t: Tok[] = [];
  if (f.a > 1) t.push([String(f.a), 'a']);
  t.push([f.letter, 'ink'], ['=', 'ink'], [sv(f, f.n), 'result']);
  return t;
}
/** x = n ÷ a. */
export function lineDivide(plan: BalPlan): Tok[] {
  const f = balFacts(plan);
  return [[f.letter, 'ink'], ['=', 'ink'], [sv(f, f.n), 'result'], ['÷', 'ink'], [String(f.a), 'a']];
}
/** x = value. */
export function lineAnswer(plan: BalPlan): Tok[] {
  const f = balFacts(plan);
  return [[f.letter, 'ink'], ['=', 'ink'], [sv(f, f.x), 'result']];
}
/** a × value + b = c. */
export function lineCheck(plan: BalPlan): Tok[] {
  const f = balFacts(plan);
  const t: Tok[] = [];
  if (f.a0 > 1) t.push([String(f.a0), 'a'], ['×', 'ink']);
  t.push([sv(f, f.x), 'result']);
  if (f.b !== 0) t.push([f.sign, 'ink'], [sv(f, Math.abs(f.b)), 'b']);
  t.push(['=', 'ink']);
  if (f.d > 0) {
    if (f.d > 1) t.push([String(f.d), 'a'], ['×', 'ink']);
    t.push([sv(f, f.x), 'result'], ['+', 'ink']);
  }
  t.push([sv(f, f.c), 'c']);
  return t;
}
/** The small note beside the divide line. */
export const divideNote = (a: number) => `÷ ${a} both sides`;
/** The small note beside the move line: "+5 both sides" turns into "−5". */
export function moveNote(plan: BalPlan): string {
  const f = balFacts(plan);
  return `${f.moved} ${sv(f, Math.abs(f.b))} both sides`;
}

/**
 * V51.9.125 — the small note written to the right of every line of the working, in the class language: what this
 * line did ("− 5 both sides", "25 − 5 = 20", "÷ 2 both sides", "20 ÷ 2 = 10"). Every number comes from the plan.
 */
export function stepNote(plan: BalPlan, op: string, lang: 'en' | 'ml'): string {
  const f = balFacts(plan);
  const ml = lang === 'ml';
  const both = (s: string) => (ml ? `ഇരുവശത്തും ${s}` : `${s} both sides`);
  switch (op) {
    case 'show': return ml ? 'ചോദ്യം' : 'the problem';
    case 'cancel': return both(`− ${f.d > 1 ? f.d : ''}${f.letter}`);
    case 'move': return both(`${f.moved} ${sv(f, Math.abs(f.b))}`);
    case 'simplify': return `${sv(f, f.c)} ${f.moved} ${sv(f, Math.abs(f.b))} = ${sv(f, f.n)}`;
    case 'divide': return both(`÷ ${f.a}`);
    case 'answer': return `${sv(f, f.n)} ÷ ${f.a} = ${sv(f, f.x)}`;
    case 'check': return ml ? 'ഇരുവശവും തുല്യം' : 'both sides equal';
    default: return '';
  }
}

/** The steps the plan must contain, in order, to reach the answer. */
export function requiredOps(plan: BalPlan): string[] {
  const ops = ['show'];
  if ((plan.d ?? 0) > 0) ops.push('cancel');
  if (plan.b !== 0) ops.push('move', 'simplify');
  if (plan.a - (plan.d ?? 0) >= 2) ops.push('divide');
  return ops;
}

/* ---------------- finding the equation in a textbook paragraph ---------------- */

const BAL_RE = /(?<![A-Za-z0-9²^])(\d{1,2})?\s*([xyznmpt])\s*([+−–-])\s*(\d{1,3})\s*=\s*(\d{1,3})(?![\d²^/A-Za-z]|[.,]\d)|(?<![A-Za-z0-9²^])(\d{1,2})\s*([xyznmpt])\s*=\s*(\d{1,3})(?![\d²^/A-Za-z]|[.,]\d)/g;
/** Words and shapes that mean the text is about something a single scale cannot show. */
export const BAL_EXCLUDE = /\b(simultaneous|quadratic|inequalit\w*|matri(?:x|ces)|polynomials?|roots?|slope|gradient|functions?|sequences?)\b|[²^]|(?<![A-Za-z])[a-z]\s*[+−]\s*[a-z](?![A-Za-z])|\by\s*=\s*[a-z\d]*\s*[a-z]|\d\s*[xyznmpt]\s*[+−–-]\s*\d+\s*[xyznmpt]/i;

/** x on both sides: a x + b = d x + c (the left side has more x). */
const BAL2_RE = /(?<![A-Za-z0-9²^])(\d{1,2})?\s*([xyznmpt])\s*(?:([+−–-])\s*(\d{1,3}))?\s*=\s*(\d{1,2})?\s*\2\s*\+\s*(\d{1,3})(?![\d²^/A-Za-z]|[.,]\d)/g;

export interface BalEq {
  a: number;
  b: number;
  c: number;
  letter: string;
  d?: number;
}

/** Every equation a x + b = c (or a x = c, or a x + b = d x + c) in the text that a scale can show: whole answer 1–100, a 1–4, |b| ≤ 12. */
export function findBalEquations(text: string): BalEq[] {
  const out: BalEq[] = [];
  for (const m of text.matchAll(BAL_RE)) {
    const two = m[2] !== undefined;
    const a = two ? (m[1] ? Number(m[1]) : 1) : Number(m[6]);
    const letter = (two ? m[2] : m[7]) as string;
    const b = two ? (m[3] === '+' ? 1 : -1) * Number(m[4]) : 0;
    const c = two ? Number(m[5]) : Number(m[8]);
    if (!balProblem({ a, b, c, letter, steps: [] }, 'find')) out.push({ a, b, c, letter });
  }
  for (const m of text.matchAll(BAL2_RE)) {
    const a = m[1] ? Number(m[1]) : 1;
    const letter = m[2];
    const b = m[3] ? (m[3] === '+' ? 1 : -1) * Number(m[4]) : 0;
    const d = m[5] ? Number(m[5]) : 1;
    const c = Number(m[6]);
    if (!balProblem({ a, b, c, d, letter, steps: [] }, 'find')) out.push({ a, b, c, d, letter });
  }
  return out;
}

/* ---------------- geometry (design space 720 × BAL_H): a real scale that tips ---------------- */

export type Pt2 = Pt;
export const BAL_H = 590;
/** Pivot, beam half-length, where the pans hang (distance from the pivot), string length, pan size. */
export const SC = { px: 360, py: 104, R: 345, hang: 180, S: 112, panW: 330, dish: 24, tileH: 78, gap: 6, tiltMax: 0.14, strings: 150 };
/** Tile widths: x, b, c / n, and the equal pieces after the split. */
export const TW = { x: 52, b: 78, c: 130, v: 70 };
/** Where the equation is written below the scale: left edge, widest line, baseline of slot k. */
export const BALX = 60;
export const BALMAX = 600;
export const PANEL_Y0 = 430;
export const PANEL_DY = 42;
export const PANEL_ROWS = 4;
export const BALPANEL_Y = (k: number) => PANEL_Y0 + PANEL_DY * k;

/** How far the beam tips (radians, positive = right side down) for the weights on each pan. */
export function tiltFor(left: number, right: number): number {
  const m = Math.max(Math.abs(left), Math.abs(right));
  if (m === 0 || left === right) return 0;
  const d = (right - left) / m;
  return Math.max(-1, Math.min(1, d * 2)) * SC.tiltMax;
}

/** A point on the beam at distance s from the pivot (negative = left) when it is tipped by theta. */
export function beamPoint(s: number, theta: number): Pt {
  return [SC.px + s * Math.cos(theta), SC.py + s * Math.sin(theta)];
}

/** The middle of a pan's top surface (where the tiles stand). */
export function panTop(side: 'L' | 'R', theta: number): Pt {
  const [x, y] = beamPoint(side === 'L' ? -SC.hang : SC.hang, theta);
  return [x, y + SC.S];
}

/** The beam as a slim four-corner shape (so it can turn by morphing). */
export function beamShape(theta: number): Pt[] {
  const [lx, ly] = beamPoint(-SC.R, theta);
  const [rx, ry] = beamPoint(SC.R, theta);
  const nx = -Math.sin(theta) * 7;
  const ny = Math.cos(theta) * 7;
  return [[lx - nx, ly - ny], [rx - nx, ry - ny], [rx + nx, ry + ny], [lx + nx, ly + ny]];
}

/** The pan dish, relative to the middle of its top surface. */
export const DISH: Pt[] = [[-SC.panW / 2, 0], [SC.panW / 2, 0], [SC.panW / 2 - 28, SC.dish], [-SC.panW / 2 + 28, SC.dish]];

/** The two strings of a pan: from the beam to the corners of the dish (world coordinates). */
export function stringsOf(side: 'L' | 'R', theta: number): [Pt, Pt][] {
  const top = panTop(side, theta);
  return [-SC.strings, SC.strings].map((o) => {
    const x = top[0] + o;
    return [beamPoint((x - SC.px) / Math.cos(theta), theta), [x, top[1]]] as [Pt, Pt];
  });
}

/** x positions (relative to the pan's middle) of tiles of the given widths, centred, with a gap. */
export function rowLayout(widths: number[]): number[] {
  const total = widths.reduce((a, b) => a + b, 0) + SC.gap * Math.max(0, widths.length - 1);
  let x = -total / 2;
  return widths.map((w) => {
    const c = x + w / 2;
    x += w + SC.gap;
    return c;
  });
}

/** The widest a pan's row can be (tiles must fit inside the dish). */
export const rowWidth = (widths: number[]) => widths.reduce((a, b) => a + b, 0) + SC.gap * Math.max(0, widths.length - 1);
export const PAN_INNER = SC.panW - 12;
export const mid = (r: { x0: number; x1: number; y0: number; y1: number }): Pt => [(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2];
