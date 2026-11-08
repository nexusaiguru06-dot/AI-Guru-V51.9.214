/**
 * HCF and LCM (V51.9.49): the rules for the `hcf-lcm` DNA. Two numbers are split into prime tiles; the
 * primes they share line up in the same columns; the HCF is the product of the shared tiles and the LCM
 * the product of every column. The app computes every factor, product and position; the planner only
 * chooses the two numbers and writes the spoken captions.
 */

import type { HlPlan } from './types';

export const HL_OPS = ['show', 'factorise', 'common', 'hcf', 'lcm', 'check'] as const;
export const HL_REQUIRED = ['show', 'factorise', 'common', 'hcf', 'lcm'];
export const HL_MIN = 2;
export const HL_MAX = 120;

export function primeFactors(n: number): number[] {
  const out: number[] = [];
  let m = n;
  for (let p = 2; p * p <= m; p++) while (m % p === 0) { out.push(p); m /= p; }
  if (m > 1) out.push(m);
  return out;
}
export const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
export const lcmOf = (a: number, b: number) => (a / gcd(a, b)) * b;
const prod = (xs: number[]) => xs.reduce((p, x) => p * x, 1);

/** The primes of a and b: the shared ones (with multiplicity), and what each has left over. */
export function hlSplit(a: number, b: number) {
  const fa = primeFactors(a);
  const rest = [...primeFactors(b)];
  const shared: number[] = [];
  const aOnly: number[] = [];
  for (const p of fa) {
    const i = rest.indexOf(p);
    if (i >= 0) { shared.push(p); rest.splice(i, 1); } else aOnly.push(p);
  }
  return { fa, fb: primeFactors(b), shared, aOnly, bOnly: rest, hcf: prod(shared), lcm: prod(shared) * prod(aOnly) * prod(rest) };
}

/** The reason a plan cannot be drawn, or null. */
export function hlProblem(plan: HlPlan, path: string): string | null {
  if (!plan || typeof plan !== 'object') return `${path} is not an object.`;
  for (const k of ['a', 'b'] as const) {
    const v = plan[k];
    if (!Number.isInteger(v) || v < HL_MIN || v > HL_MAX) return `${path}.${k} must be a whole number from ${HL_MIN} to ${HL_MAX}.`;
  }
  if (plan.a === plan.b) return `${path}: a and b must be different numbers.`;
  if (plan.a > plan.b) return `${path}: a must be the smaller number (swap them).`;
  if (!Array.isArray(plan.steps) || !plan.steps.length) return `${path}.steps must list the steps (${HL_REQUIRED.join(', ')}).`;
  const ops = plan.steps.map((s) => s?.op);
  for (const [i, s] of plan.steps.entries()) {
    if (!s || typeof s !== 'object') return `${path}.steps[${i}] is not an object.`;
    if (!(HL_OPS as readonly string[]).includes(s.op)) return `${path}.steps[${i}].op "${s.op}" is not one of ${HL_OPS.join(', ')}.`;
    if (ops.indexOf(s.op) !== i) return `${path}.steps[${i}]: "${s.op}" appears more than once.`;
  }
  const want = ops.includes('check') ? [...HL_REQUIRED, 'check'] : HL_REQUIRED;
  if (ops.length !== want.length || want.some((o, i) => ops[i] !== o)) return `${path}.steps must be exactly ${want.join(', ')} in that order ("check" is optional and last).`;
  return null;
}

/* ---------------- the lines ---------------- */

const times = (xs: number[]) => xs.join(' \\times ');
export function hlLines(a: number, b: number) {
  const s = hlSplit(a, b);
  const cols = [...s.shared, ...s.aOnly, ...s.bOnly];
  return {
    ...s,
    texA: `${a} = ${times(s.fa)}`,
    texB: `${b} = ${times(s.fb)}`,
    texHcf: s.shared.length ? `\\text{HCF} = ${times(s.shared)}${s.shared.length > 1 ? ` = ${s.hcf}` : ''}` : '\\text{HCF} = 1',
    texLcm: `\\text{LCM} = ${times(cols)}${cols.length > 1 ? ` = ${s.lcm}` : ''}`,
    texCheck: `${s.hcf} \\times ${s.lcm} = ${s.hcf * s.lcm} = ${a} \\times ${b}`,
  };
}

/* ---------------- the picture ---------------- */

export const HL_TX0 = 198;
export const HL_PITCH = 74;
export const HL_RA = 104;
export const HL_RB = 186;
export const HL_TILE = 54;
export const HL_LABEL_X = 70;
/** Rows of typeset lines at the bottom. */
export const HL_LINE_Y = [296, 352, 408];

export const hlX = (col: number) => HL_TX0 + col * HL_PITCH;
export const hlTilePts = (col: number, y: number): Array<[number, number]> => {
  const x = hlX(col);
  const h = HL_TILE / 2;
  return [[x - h, y - h], [x + h, y - h], [x + h, y + h], [x - h, y + h]];
};

/** Column of each tile: before the match, each row in its own order; after, the shared primes line up first. */
export function hlColumns(a: number, b: number) {
  const s = hlSplit(a, b);
  const k = s.shared.length;
  return {
    k,
    ncols: k + Math.max(s.aOnly.length, s.bOnly.length),
    /** Natural columns: the tile's place in its own number's list. */
    natA: s.fa.map((_, i) => i),
    natB: s.fb.map((_, i) => i),
    /** Which tile of each row (index into fa / fb) is shared, in column order, and the aligned column of every tile. */
    alignA: (() => { const out: number[] = []; let sh = 0; let ao = 0; const pool = [...s.shared]; for (const p of s.fa) { const i = pool.indexOf(p); if (i >= 0) { pool.splice(i, 1); out.push(sh++); } else out.push(k + ao++); } return out; })(),
    alignB: (() => { const out: number[] = []; let ao = 0; const pool = [...s.shared]; const colOf = new Map<number, number[]>(); s.shared.forEach((p, i) => colOf.set(p, [...(colOf.get(p) ?? []), i])); for (const p of s.fb) { const cs = colOf.get(p); if (cs && cs.length && pool.length) { out.push(cs.shift()!); const pi = pool.indexOf(p); if (pi >= 0) pool.splice(pi, 1); } else out.push(k + ao++); } return out; })(),
  };
}
