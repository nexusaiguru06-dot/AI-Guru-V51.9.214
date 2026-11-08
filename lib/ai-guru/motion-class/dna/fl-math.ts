/**
 * Maths and geometry for the number-line fractions DNA (V51.9.36): marking fractions, equivalent
 * fractions (the same point on a finer line), comparing over a common denominator, adding and
 * subtracting by jumps. Every number written and every tick and dot drawn comes from here.
 */

import type { FracLineKind, FracLinePlan } from './types';

export type Pt = [number, number];
export type Frac = [number, number];
export type RoleF = 'a' | 'b' | 'c' | 'carry' | 'result' | 'ink';

export const FL_KINDS: FracLineKind[] = ['mark', 'equivalent', 'compare', 'add'];
export const FL_OPS: Record<FracLineKind, string[]> = {
  mark: ['show', 'divide', 'mark', 'mixed'],
  equivalent: ['show', 'scale', 'result'],
  compare: ['show', 'common', 'result'],
  add: ['show', 'jump', 'common', 'result'],
};
export const DEN_MIN = 2;
export const DEN_MAX = 12;
export const TICKS_MAX = 36;
export const K_MIN = 2;
export const K_MAX = 6;
export const FRAC_ROLES: RoleF[] = ['a', 'b', 'c', 'carry'];

export const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
export const lcm = (a: number, b: number): number => (a / gcd(a, b)) * b;
const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);

export const tok = (f: Frac): string => `{${f[0]}/${f[1]}}`;
export const val = (f: Frac): number => f[0] / f[1];
export const reduce = (n: number, d: number): Frac => { const g = gcd(n, d) || 1; return [n / g, d / g]; };

function fracProblem(f: unknown, path: string): string | null {
  if (!Array.isArray(f) || f.length !== 2 || !isInt(f[0]) || !isInt(f[1])) return `${path} must be [numerator, denominator] with whole numbers.`;
  const [n, d] = f as Frac;
  if (d < DEN_MIN || d > DEN_MAX) return `${path}: the denominator must be from ${DEN_MIN} to ${DEN_MAX} (got ${d}).`;
  if (n < 1) return `${path}: the numerator must be at least 1.`;
  if (gcd(n, d) !== 1) return `${path}: ${n}/${d} is not in lowest terms (write ${reduce(n, d).join('/')}).`;
  if (n / d > 3) return `${path}: ${n}/${d} is more than 3; the line shows 0 to 3 at most.`;
  return null;
}

/** Whole numbers the line shows: up to the largest value, at least 1. */
export const lineLength = (values: number[]): number => Math.max(1, Math.ceil(Math.max(...values) - 1e-9));

export interface AddFacts { D: number; a: Frac; c: Frac; ap: Frac; cp: Frac; S: number; sum: Frac; whole: number; rem: number }
/** The numbers of a/b ± c/d over the common denominator. */
export function addFacts(plan: FracLinePlan): AddFacts {
  const [a, c] = plan.fracs as [Frac, Frac];
  const D = lcm(a[1], c[1]);
  const ap: Frac = [a[0] * (D / a[1]), D];
  const cp: Frac = [c[0] * (D / c[1]), D];
  const S = plan.op === 'sub' ? ap[0] - cp[0] : ap[0] + cp[0];
  const sum = reduce(Math.max(S, 0), D);
  return { D, a, c, ap, cp, S, sum, whole: Math.floor(sum[0] / sum[1]), rem: sum[0] % sum[1] };
}

export function flProblem(plan: FracLinePlan, path: string): string | null {
  const k = plan?.kind;
  if (!FL_KINDS.includes(k)) return `${path}.kind must be one of ${FL_KINDS.join(', ')}.`;
  if (k === 'equivalent') {
    const e = fracProblem(plan.frac, `${path}.frac`);
    if (e) return e;
    const [n, d] = plan.frac!;
    if (n >= d) return `${path}.frac must be a proper fraction (numerator below denominator).`;
    if (!isInt(plan.k) || plan.k < K_MIN || plan.k > K_MAX) return `${path}.k must be a whole number from ${K_MIN} to ${K_MAX}.`;
    if (d * plan.k > TICKS_MAX) return `${path}: ${d} × ${plan.k} = ${d * plan.k} parts is too fine to draw (at most ${TICKS_MAX}).`;
    return null;
  }
  const f = plan.fracs;
  const [lo, hi] = k === 'mark' ? [1, 4] : [2, 2];
  if (!Array.isArray(f) || f.length < lo || f.length > hi) return `${path}.fracs must list ${lo === hi ? hi : `${lo} to ${hi}`} fractions.`;
  for (let i = 0; i < f.length; i++) { const e = fracProblem(f[i], `${path}.fracs[${i}]`); if (e) return e; }
  const vals = f.map(val);
  if (new Set(vals.map((v) => Math.round(v * 1e9))).size !== vals.length) return `${path}.fracs must be different from each other.`;
  const D = f.map((x) => x[1]).reduce(lcm, 1);
  if (k === 'add') {
    const s = addFacts(plan);
    if (plan.op !== undefined && plan.op !== 'add' && plan.op !== 'sub') return `${path}.op must be "add" or "sub".`;
    if (s.S < 1) return `${path}: ${tok(f[0])} − ${tok(f[1])} is not positive; the first fraction must be larger.`;
    const r = s.S / D;
    if (r > 3) return `${path}: the result ${s.sum.join('/')} is more than 3.`;
    const L = lineLength([r, vals[0], vals[1]]);
    if (D * L > TICKS_MAX) return `${path}: the common denominator ${D} over ${L} wholes gives ${D * L} parts, too fine to draw (at most ${TICKS_MAX}).`;
    return null;
  }
  const L = lineLength(vals);
  if (k === 'mark') {
    const unit = LINE.w / L;
    const v = [...vals].sort((x, y) => x - y);
    for (let i = 1; i < v.length; i++) if ((v[i] - v[i - 1]) * unit < 18) return `${path}: two of the fractions are too close together to mark apart on one line.`;
    for (let i = 2; i < v.length; i++) if ((v[i] - v[i - 2]) * unit < 40) return `${path}: three of the fractions are too close together to label on one line.`;
  }
  if (D * L > TICKS_MAX) return `${path}: the common denominator ${D} over ${L} wholes gives ${D * L} parts, too fine to draw (at most ${TICKS_MAX}).`;
  return null;
}

/* ---------------- the lines written on the board ---------------- */

export type Line = [string, RoleF];

export const mixedParts = (f: Frac): [number, Frac | null] => [Math.floor(f[0] / f[1]), f[0] % f[1] ? [f[0] % f[1], f[1]] : null];
const mixedText = (f: Frac): string => { const [w, r] = mixedParts(f); return r ? `${w} ${tok(r)}` : String(w); };

export function showLines(plan: FracLinePlan): Line[] {
  if (plan.kind === 'equivalent') return [[tok(plan.frac!), 'a']];
  if (plan.kind === 'add') {
    const [a, c] = plan.fracs!;
    return [[`${tok(a)} ${plan.op === 'sub' ? '−' : '+'} ${tok(c)}`, 'ink']];
  }
  return plan.fracs!.map((f, i) => [tok(f), FRAC_ROLES[i]] as Line);
}
export function divideLines(plan: FracLinePlan): Line[] {
  const D = plan.fracs!.map((x) => x[1]).reduce(lcm, 1);
  return [[`Each whole = ${D} equal parts`, 'ink'], [`1 part = ${tok([1, D])}`, 'carry']];
}
export function markLines(plan: FracLinePlan): Line[] {
  const D = plan.fracs!.map((x) => x[1]).reduce(lcm, 1);
  return plan.fracs!.map((f, i) => [`${tok(f)} = ${f[0] * (D / f[1])} × ${tok([1, D])}`, FRAC_ROLES[i]] as Line);
}
export function mixedLines(plan: FracLinePlan): Line[] {
  return plan.fracs!.map((f, i) => [f[0] > f[1] ? `${tok(f)} = ${mixedText(f)}` : '', FRAC_ROLES[i]] as Line).filter((l) => l[0]);
}
export function scaleLines(plan: FracLinePlan): Line[] {
  const [n, d] = plan.frac!;
  const k = plan.k!;
  return [[`${tok([n, d])} = ${tok([n, d])} × ${tok([k, k])}`, 'a'], [`= ${tok([n * k, d * k])}`, 'result']];
}
export function equivResultLines(plan: FracLinePlan): Line[] {
  const [n, d] = plan.frac!;
  return [[`${tok([n, d])} = ${tok([n * plan.k!, d * plan.k!])}`, 'result']];
}
export function commonLines(plan: FracLinePlan): Line[] {
  const [a, c] = plan.fracs!;
  const D = lcm(a[1], c[1]);
  const out: Line[] = [];
  if (a[1] !== D) out.push([`${tok(a)} = ${tok([a[0] * (D / a[1]), D])}`, 'a']);
  if (c[1] !== D) out.push([`${tok(c)} = ${tok([c[0] * (D / c[1]), D])}`, 'b']);
  return out;
}
export function compareResultLines(plan: FracLinePlan): Line[] {
  const [a, c] = plan.fracs!;
  const D = lcm(a[1], c[1]);
  const ap: Frac = [a[0] * (D / a[1]), D];
  const cp: Frac = [c[0] * (D / c[1]), D];
  const sym = ap[0] < cp[0] ? '<' : '>';
  const out: Line[] = [];
  if (a[1] !== c[1]) out.push([`${tok(ap)} ${sym} ${tok(cp)}`, 'carry']);
  out.push([`${tok(a)} ${sym} ${tok(c)}`, 'result']);
  return out;
}
export function jumpLines(plan: FracLinePlan): Line[] {
  const [a, c] = plan.fracs!;
  return [[`${tok(a)} ${plan.op === 'sub' ? '−' : '+'} ${tok(c)}`, 'ink'], [plan.op === 'sub' ? `${tok(c)} to the left` : `${tok(c)} to the right`, 'carry']];
}
export function addResultLines(plan: FracLinePlan): Line[] {
  const s = addFacts(plan);
  const sign = plan.op === 'sub' ? '−' : '+';
  const out: Line[] = [];
  if (s.a[1] !== s.c[1]) out.push([`= ${tok(s.ap)} ${sign} ${tok(s.cp)}`, 'ink']);
  out.push([`= ${tok([s.S, s.D])}`, 'ink']);
  if (s.sum[0] !== s.S || s.sum[1] !== s.D) out.push([s.sum[1] === 1 ? `= ${s.sum[0]}` : `= ${tok(s.sum)}`, 'ink']);
  if (s.sum[0] > s.sum[1] && s.sum[1] !== 1) out.push([`= ${mixedText(s.sum)}`, 'result']);
  else out[out.length - 1][1] = 'result';
  return out;
}

/* ---------------- geometry ---------------- */

export const LINE = { x0: 50, w: 340, y: 285 };
export const EQ_Y = [225, 345];

export interface FlGeom {
  L: number;
  /** Parts per whole used for the sub-ticks. */
  D: number;
  unit: number;
  x: (v: number) => number;
}
export function flGeometry(plan: FracLinePlan): FlGeom {
  let L = 1;
  let D = 1;
  if (plan.kind === 'equivalent') D = plan.frac![1];
  else if (plan.kind === 'add') {
    const s = addFacts(plan);
    D = s.D;
    L = lineLength([s.S / s.D, val(s.a), val(s.c)]);
  } else {
    D = plan.fracs!.map((x) => x[1]).reduce(lcm, 1);
    L = lineLength(plan.fracs!.map(val));
  }
  const unit = LINE.w / L;
  return { L, D, unit, x: (v: number) => LINE.x0 + unit * v };
}
