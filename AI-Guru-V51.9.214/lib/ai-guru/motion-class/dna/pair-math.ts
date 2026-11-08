/**
 * Maths and geometry for the pair-of-equations balance DNA (V51.9.55): two linear equations in two
 * unknowns, a1 x + b1 y = c1 and a2 x + b2 y = c2, each drawn as a scale that balances. The two scales
 * are put together (added or subtracted) so one unknown cancels, the one scale that is left is solved,
 * the value is put back into an equation to find the other unknown, and both scales are checked.
 *
 * Everything written and every tile drawn comes from here: the planner only gives the numbers and the
 * spoken captions. Only pairs that one add or subtract can solve are drawn (the same coefficient, or
 * opposite coefficients); anything else belongs to the pair-of-linear-equations lesson (linear-system).
 */

import type { PairPlan } from './types';

export type Pt = [number, number];
export type PairRole = 'a' | 'b' | 'c' | 'result' | 'ink' | 'carry';
export type Tok = [string, PairRole];

export const PAIR_OPS = ['show', 'combine', 'solve', 'back', 'check'];
export const PAIR_A_MAX = 4;
export const PAIR_B_MAX = 3;
export const PAIR_V_MAX = 99999;
export const PAIR_C_MAX = 999999;
export const PAIR_LETTERS = ['x', 'y', 'z', 'a', 'b', 'm', 'n', 'p', 'q', 't'];

const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);

export interface PairEq {
  /** x terms: 1–4 (always added). */
  a: number;
  /** y terms: −3…3 but not 0 (written a x − |b| y when negative). */
  b: number;
  c: number;
}

export interface Combine {
  kind: 'add' | 'sub';
  /** The unknown that cancels. */
  drop: 'x' | 'y';
  /** The unknown that is left (solved first). */
  keep: 'x' | 'y';
  /** For a subtraction: the equation the other is taken from (1 or 2). */
  first: 1 | 2;
  /** What is left: coef × keep = rhs. */
  coef: number;
  rhs: number;
}

export interface PairFacts {
  x: number;
  y: number;
  lx: string;
  ly: string;
  e1: PairEq;
  e2: PairEq;
  comb: Combine;
  /** The unknown found first and its value. */
  kLetter: string;
  kv: number;
  /** The unknown found second and its value. */
  uLetter: string;
  uv: number;
  /** The equation the first value is put back into (always one with a positive y term). */
  back: { eq: 1 | 2; coefK: number; coefU: number; num: number; n: number };
}

/** The one add or subtract that removes an unknown, or null when none does. */
export function combineOf(e1: PairEq, e2: PairEq): Combine | null {
  if (e1.b === -e2.b) return { kind: 'add', drop: 'y', keep: 'x', first: 1, coef: e1.a + e2.a, rhs: e1.c + e2.c };
  if (e1.a === e2.a && e1.b !== e2.b) {
    const first: 1 | 2 = e1.b > e2.b ? 1 : 2;
    const hi = first === 1 ? e1 : e2;
    const lo = first === 1 ? e2 : e1;
    return { kind: 'sub', drop: 'x', keep: 'y', first, coef: hi.b - lo.b, rhs: hi.c - lo.c };
  }
  if (e1.b === e2.b && e1.a !== e2.a) {
    const first: 1 | 2 = e1.a > e2.a ? 1 : 2;
    const hi = first === 1 ? e1 : e2;
    const lo = first === 1 ? e2 : e1;
    return { kind: 'sub', drop: 'y', keep: 'x', first, coef: hi.a - lo.a, rhs: hi.c - lo.c };
  }
  return null;
}

/** The reason a plan cannot be drawn, or null. */
export function pairProblem(plan: PairPlan, path: string): string | null {
  for (const k of ['e1', 'e2'] as const) {
    const e = plan?.[k];
    if (!e || !isInt(e.a) || e.a < 1 || e.a > PAIR_A_MAX) return `${path}.${k}.a must be a whole number from 1 to ${PAIR_A_MAX} (the number of x tiles).`;
    if (!isInt(e.b) || e.b === 0 || Math.abs(e.b) > PAIR_B_MAX) return `${path}.${k}.b must be a whole number from −${PAIR_B_MAX} to ${PAIR_B_MAX}, not 0 (the number of y tiles; negative when y is taken away).`;
    if (!isInt(e.c) || e.c < 1 || e.c > PAIR_C_MAX) return `${path}.${k}.c must be a whole number from 1 to ${PAIR_C_MAX}.`;
  }
  if (plan.letters !== undefined) {
    const l = plan.letters;
    if (!Array.isArray(l) || l.length !== 2 || l[0] === l[1] || !PAIR_LETTERS.includes(l[0]) || !PAIR_LETTERS.includes(l[1])) return `${path}.letters must be two different letters from ${PAIR_LETTERS.join(' ')}.`;
  }
  const { e1, e2 } = plan;
  const det = e1.a * e2.b - e2.a * e1.b;
  if (det === 0) return `${path}: the two equations have no single solution (the lines are parallel or the same). Choose different numbers.`;
  const xn = e1.c * e2.b - e2.c * e1.b;
  const yn = e1.a * e2.c - e2.a * e1.c;
  if (xn % det !== 0 || yn % det !== 0) return `${path}: the solution is not whole numbers (x = ${xn}/${det}, y = ${yn}/${det}). Choose c1 and c2 from a whole x and y.`;
  const x = xn / det;
  const y = yn / det;
  if (x < 1 || x > PAIR_V_MAX || y < 1 || y > PAIR_V_MAX) return `${path}: both answers must be whole numbers from 1 to ${PAIR_V_MAX} (got x = ${x}, y = ${y}).`;
  if (!combineOf(e1, e2)) return `${path}: one add or subtract must remove an unknown, so the two x coefficients must be equal or the two y coefficients equal or opposite. Use the pair-of-linear-equations lesson when an equation has to be multiplied first.`;
  if (e1.b < 0 && e2.b < 0) return `${path}: at least one equation needs a plus before y (b > 0); swap the unknowns or use another pair.`;
  return null;
}

export function pairFacts(plan: PairPlan): PairFacts {
  const { e1, e2 } = plan;
  const lx = plan.letters?.[0] ?? 'x';
  const ly = plan.letters?.[1] ?? 'y';
  const det = e1.a * e2.b - e2.a * e1.b;
  const x = (e1.c * e2.b - e2.c * e1.b) / det;
  const y = (e1.a * e2.c - e2.a * e1.c) / det;
  const comb = combineOf(e1, e2)!;
  const kIsX = comb.keep === 'x';
  const kv = kIsX ? x : y;
  const uv = kIsX ? y : x;
  const eq: 1 | 2 = e1.b > 0 ? 1 : 2;
  const e = eq === 1 ? e1 : e2;
  const coefK = kIsX ? e.a : e.b;
  const coefU = kIsX ? e.b : e.a;
  const num = coefK * kv;
  return { x, y, lx, ly, e1, e2, comb, kLetter: kIsX ? lx : ly, kv, uLetter: kIsX ? ly : lx, uv, back: { eq, coefK, coefU, num, n: e.c - num } };
}

const termTok = (coef: number, letter: string, role: PairRole): Tok => [`${coef > 1 ? coef : ''}${letter}`, role];

/** a x + b y = c, as written. */
export function lineEq(e: PairEq, lx: string, ly: string): Tok[] {
  return [termTok(e.a, lx, 'a'), [e.b < 0 ? '−' : '+', 'ink'], termTok(Math.abs(e.b), ly, 'b'), ['=', 'ink'], [String(e.c), 'c']];
}
/** coef × kept unknown = rhs. */
export function lineCombine(f: PairFacts): Tok[] {
  return [termTok(f.comb.coef, f.kLetter, f.comb.keep === 'x' ? 'a' : 'b'), ['=', 'ink'], [String(f.comb.rhs), 'result']];
}
/** The note beside the combine line. */
export function combineNote(f: PairFacts): string {
  if (f.comb.kind === 'add') return '(1) + (2)';
  return f.comb.first === 1 ? '(1) − (2)' : '(2) − (1)';
}
export function lineDivide(f: PairFacts): Tok[] {
  return [[f.kLetter, f.comb.keep === 'x' ? 'a' : 'b'], ['=', 'ink'], [String(f.comb.rhs), 'result'], ['÷', 'ink'], [String(f.comb.coef), 'a']];
}
export const divideNote = (coef: number) => `÷ ${coef} both sides`;
export function lineKnown(f: PairFacts): Tok[] {
  return [[f.kLetter, f.comb.keep === 'x' ? 'a' : 'b'], ['=', 'ink'], [String(f.kv), 'result']];
}
/** The chosen equation with the first value put in. */
export function lineSubst(f: PairFacts): Tok[] {
  const e = f.back.eq === 1 ? f.e1 : f.e2;
  const kx = f.comb.keep === 'x';
  const num = (coef: number, v: number): Tok => [coef > 1 ? `${coef} × ${v}` : String(v), 'result'];
  const left: Tok = kx ? num(e.a, f.kv) : termTok(e.a, f.lx, 'a');
  const right: Tok = kx ? termTok(e.b, f.ly, 'b') : num(e.b, f.kv);
  return [left, ['+', 'ink'], right, ['=', 'ink'], [String(e.c), 'c']];
}
/** coefU × U = c − number. */
export function lineReduced(f: PairFacts): Tok[] {
  return [termTok(f.back.coefU, f.uLetter, f.comb.keep === 'x' ? 'b' : 'a'), ['=', 'ink'], [String(f.back.n), 'result']];
}
export const reducedNote = (f: PairFacts) => `− ${f.back.num} both sides`;
export function lineDivideU(f: PairFacts): Tok[] {
  return [[f.uLetter, f.comb.keep === 'x' ? 'b' : 'a'], ['=', 'ink'], [String(f.back.n), 'result'], ['÷', 'ink'], [String(f.back.coefU), 'a']];
}
export function lineUnknown(f: PairFacts): Tok[] {
  return [[f.uLetter, f.comb.keep === 'x' ? 'b' : 'a'], ['=', 'ink'], [String(f.uv), 'result']];
}
/** a × x + b × y = c with the answers in. */
export function lineCheck(e: PairEq, f: PairFacts): Tok[] {
  const t = (coef: number, v: number): string => (coef > 1 ? `${coef} × ${v}` : String(v));
  return [[t(e.a, f.x), 'a'], [e.b < 0 ? '−' : '+', 'ink'], [t(Math.abs(e.b), f.y), 'b'], ['=', 'ink'], [String(e.c), 'c']];
}

/** The steps a plan must contain, in this order. */
export const requiredPairOps = (): string[] => ['show', 'combine', 'solve', 'back', 'check'];

/* ---------------- finding the pair in a textbook paragraph ---------------- */

const PAIR_RE = /(?<![A-Za-z0-9²^])(\d{0,2})\s*x\s*([+−–-])\s*(\d{0,2})\s*y\s*=\s*(\d{1,6})(?![\d²^/A-Za-z]|[.,]\d)/g;
/** Words that mean the pair is about something else (the graph, a matrix, or three unknowns). */
export const PAIR_EXCLUDE = /\b(graph\w*|plot\w*|matri(?:x|ces)|determinants?|inverse|parallel lines?|intersect\w*|consistent|inconsistent|cross[- ]multipl\w*|quadratic)\b|[²^]|\bz\b/i;

/** The first two equations a x ± b y = c in the text that one add or subtract can solve with whole answers; [] when there are none. */
export function findPairEquations(text: string): Array<{ e1: PairEq; e2: PairEq }> {
  const eqs: PairEq[] = [];
  for (const m of text.matchAll(PAIR_RE)) {
    eqs.push({ a: m[1] === '' ? 1 : Number(m[1]), b: (m[2] === '+' ? 1 : -1) * (m[3] === '' ? 1 : Number(m[3])), c: Number(m[4]) });
  }
  const out: Array<{ e1: PairEq; e2: PairEq }> = [];
  for (let i = 0; i + 1 < eqs.length; i += 2) {
    const plan = { e1: eqs[i], e2: eqs[i + 1], steps: [] };
    if (!pairProblem(plan, 'find')) out.push({ e1: plan.e1, e2: plan.e2 });
  }
  return out;
}

/* ---------------- geometry (design space 720 × PAIR_H): two compact scales, one above the other ---------------- */

export const PAIR_H = 700;
/** A compact scale: pivot x, beam half-length, where the pans hang, string length, pan size, tile height. */
export const PS = { px: 360, R: 214, hang: 112, S: 70, panW: 210, dish: 16, tileH: 52, gap: 5, strings: 96, tiltMax: 0.12, post: 172 };
/** The two scale slots (y of the pivot) and the width of tiles: unknown tiles, value tiles. */
export const PY = [48, 292];
export const PW = { t: 68, v: 96 };
export const PAIR_PAN_INNER = PS.panW - 12;
/** The written lines under the scales. */
export const PBALX = 60;
export const PBALMAX = 600;
export const PPANEL_Y0 = 540;
export const PPANEL_DY = 38;
export const PPANEL_ROWS = 4;

export function tilt(left: number, right: number): number {
  const m = Math.max(Math.abs(left), Math.abs(right));
  if (m === 0 || left === right) return 0;
  const d = (right - left) / m;
  return Math.max(-1, Math.min(1, d * 2)) * PS.tiltMax;
}
export const beamPt = (s: number, th: number, py: number): Pt => [PS.px + s * Math.cos(th), py + s * Math.sin(th)];
export function panTopPt(side: 'L' | 'R', th: number, py: number): Pt {
  const [x, y] = beamPt(side === 'L' ? -PS.hang : PS.hang, th, py);
  return [x, y + PS.S];
}
export function beamPoly(th: number, py: number): Pt[] {
  const [lx, ly] = beamPt(-PS.R, th, py);
  const [rx, ry] = beamPt(PS.R, th, py);
  const nx = -Math.sin(th) * 5;
  const ny = Math.cos(th) * 5;
  return [[lx - nx, ly - ny], [rx - nx, ry - ny], [rx + nx, ry + ny], [lx + nx, ly + ny]];
}
export const DISH_P: Pt[] = [[-PS.panW / 2, 0], [PS.panW / 2, 0], [PS.panW / 2 - 22, PS.dish], [-PS.panW / 2 + 22, PS.dish]];
export function stringsAt(side: 'L' | 'R', th: number, py: number): [Pt, Pt][] {
  const top = panTopPt(side, th, py);
  return [-PS.strings, PS.strings].map((o) => {
    const x = top[0] + o;
    return [beamPt((x - PS.px) / Math.cos(th), th, py), [x, top[1]]] as [Pt, Pt];
  });
}
export function rowAt(widths: number[]): number[] {
  const total = widths.reduce((a, b) => a + b, 0) + PS.gap * Math.max(0, widths.length - 1);
  let x = -total / 2;
  return widths.map((w) => {
    const c = x + w / 2;
    x += w + PS.gap;
    return c;
  });
}
export const rowW = (widths: number[]) => widths.reduce((a, b) => a + b, 0) + PS.gap * Math.max(0, widths.length - 1);
