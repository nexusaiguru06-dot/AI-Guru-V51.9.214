/**
 * The numbers and words behind the arithmetic-sequence DNA (V51.9.29): a first term a and a common
 * difference d give every term, the n-th term formula, any term, the sum of the first n terms, and the
 * answer to "is this number a term?". Pure functions shared by the builder (what is written on the
 * board), the validator (what a plan may ask for) and the tests, so the board is always true.
 */

export const A_MAX = 50;
export const D_MAX = 12;
export const TERMS_MIN = 4;
export const TERMS_MAX = 7;
export const N_MAX = 100;
export const TEST_MAX = 999;

export const fmt = (n: number) => String(n).replace('-', '−');
export interface Seq {
  a: number;
  d: number;
}

export const nth = (s: Seq, n: number) => s.a + (n - 1) * s.d;
export const termsOf = (s: Seq, count: number): number[] => Array.from({ length: count }, (_, i) => nth(s, i + 1));
/** Sum of the first n terms. */
export const sumTo = (s: Seq, n: number) => (n * (2 * s.a + (n - 1) * s.d)) / 2;

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
/** "a + b" or "a − b" with the sign of b. */
const addSigned = (a: number, b: number) => `${fmt(a)} ${b < 0 ? '−' : '+'} ${Math.abs(b)}`;
const times = (d: number) => (d < 0 ? `(${fmt(d)})` : String(d));
/** A number as the second operand: negative ones in brackets. */
export const br = times;

/** "4n − 1", "n + 2", "−3n + 10", "5n", "−n": the simplified n-th term. */
export function formulaText(s: Seq): string {
  const c = s.a - s.d;
  const dn = s.d === 1 ? 'n' : s.d === -1 ? '−n' : `${fmt(s.d)}n`;
  if (c === 0) return dn;
  return `${dn} ${c < 0 ? '−' : '+'} ${Math.abs(c)}`;
}

/** The three lines of the n-th term formula: general, with the numbers, simplified. */
export function formulaLines(s: Seq): string[] {
  return ['x_n = a + (n − 1)d', `x_n = ${fmt(s.a)} + (n − 1) × ${times(s.d)}`, `x_n = ${formulaText(s)}`];
}

/** x_n worked out: put n in, multiply, add. */
export function termLines(s: Seq, n: number): string[] {
  const v = nth(s, n);
  return [`x_{${n}} = ${fmt(s.a)} + (${n} − 1) × ${times(s.d)}`, `x_{${n}} = ${addSigned(s.a, (n - 1) * s.d)}`, `x_{${n}} = ${fmt(v)}`];
}

/** Sum of the first n terms worked out. */
export function sumLines(s: Seq, n: number): string[] {
  const last = nth(s, n);
  const T = s.a + last;
  const S = sumTo(s, n);
  const first = `S_{${n}} = ${n} ÷ 2 × (${fmt(s.a)} + ${br(last)})`;
  if (n % 2 === 0) return [first, `S_{${n}} = ${n / 2} × ${br(T)}`, `S_{${n}} = ${fmt(S)}`];
  return [first, `S_{${n}} = ${n} × ${br(T)} ÷ 2`, `S_{${n}} = ${fmt(n * T)} ÷ 2`, `S_{${n}} = ${fmt(S)}`];
}

export interface Membership {
  /** The value (v − a) ÷ d, exact. */
  num: number;
  den: number;
  isTerm: boolean;
  /** Position n when it is a term (n ≥ 1). */
  n?: number;
  lines: string[];
}

/** "Is v a term?": v = a + (n − 1)d, so n − 1 = (v − a) ÷ d; a term exactly when n is a whole number ≥ 1. */
export function membership(s: Seq, v: number): Membership {
  const num = v - s.a;
  const den = s.d;
  const q = num / den;
  const isTerm = Number.isInteger(q) && q + 1 >= 1;
  const lines = [`${fmt(v)} = ${fmt(s.a)} + (n − 1) × ${times(s.d)}`, `n − 1 = ${fmt(num)} ÷ ${times(den)}`];
  if (Number.isInteger(q)) lines.push(`n = ${fmt(q + 1)}`);
  else {
    const g = gcd(num, den);
    let p = num / g;
    let r = den / g;
    if (r < 0) {
      p = -p;
      r = -r;
    }
    // n = p/r + 1 = (p + r)/r
    lines.push(`n = ${fmt(p + r)}/${r}`);
  }
  return { num, den, isTerm, n: isTerm ? q + 1 : undefined, lines };
}

/** The common difference, checked on the shown terms. */
export const differences = (terms: number[]): number[] => terms.slice(1).map((t, i) => t - terms[i]);

/** Gauss pairing for an even number of terms: pairs (first, last), (second, second last) … all with the same sum. */
export function gaussPairs(s: Seq, count: number): { pairs: Array<[number, number]>; sum: number; total: number } {
  const pairs: Array<[number, number]> = [];
  for (let i = 1; i <= count / 2; i++) pairs.push([i, count + 1 - i]);
  const sum = s.a + nth(s, count);
  return { pairs, sum, total: sumTo(s, count) };
}

/** Does `text` hold a list of whole numbers with one common difference? "2, 5, 8, 11, …" → { a: 2, d: 3, count: 4 }. */
export function listIn(text: string): { a: number; d: number; count: number } | null {
  const m = /(?<![\w.])([−-]?\d+)\s*,\s*([−-]?\d+)\s*,\s*([−-]?\d+)(?:\s*,\s*([−-]?\d+))*(?:\s*,\s*([−-]?\d+))*/.exec(text);
  if (!m) return null;
  const nums = m[0].split(',').map((x) => Number(x.trim().replace('−', '-')));
  if (nums.length < 3 || nums.some((n) => !Number.isInteger(n))) return null;
  const d = nums[1] - nums[0];
  if (d === 0 || nums.some((n, i) => i > 0 && n - nums[i - 1] !== d)) return null;
  return { a: nums[0], d, count: nums.length };
}
