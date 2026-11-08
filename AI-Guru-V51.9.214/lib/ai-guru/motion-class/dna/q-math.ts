/**
 * The algebra behind the quadratic-equation DNA (V51.9.30): a x² + b x + c = 0 with whole-number
 * coefficients. Exact rational roots, the discriminant, factorising by splitting the middle term and
 * grouping, the quadratic formula worked out, and the graph window. Pure functions shared by the
 * builder (what is written and drawn), the validator and the tests, so the board is always true.
 *
 * Factorising and roots need a discriminant that is a perfect square (rational roots, whole-number
 * factors). A negative discriminant is allowed for the graph, the discriminant and the formula (no
 * real roots, the curve misses the x-axis).
 */

export const A_MAX = 6;
export const B_MAX = 20;
export const C_MAX = 36;

export interface Quad {
  a: number;
  b: number;
  c: number;
}
export interface Rat {
  n: number;
  d: number;
}

export const fmt = (n: number) => String(n).replace('-', '−');
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
export const rat = (n: number, d: number): Rat => {
  const g = gcd(n, d) || 1;
  const s = d < 0 ? -1 : 1;
  return { n: (s * n) / g + 0, d: (s * d) / g };
};
export const ratValue = (r: Rat) => r.n / r.d;
/** Fraction as one board token: "{−1/2}"; whole numbers as plain text. */
export const ratToken = (r: Rat) => (r.d === 1 ? fmt(r.n) : `{${fmt(r.n)}/${r.d}}`);
/** Same, written on one line ("−1/2") for places a stacked fraction cannot go. */
export const ratPlain = (r: Rat) => (r.d === 1 ? fmt(r.n) : `${fmt(r.n)}/${r.d}`);

export function problem(q: Quad | undefined, path: string): string | null {
  const ok = (v: unknown) => typeof v === 'number' && Number.isInteger(v);
  if (!q || !ok(q.a) || !ok(q.b) || !ok(q.c)) return `${path} needs whole numbers a, b, c (a x² + b x + c = 0).`;
  if (q.a === 0 || Math.abs(q.a) > A_MAX) return `${path}.a must be a non-zero whole number from −${A_MAX} to ${A_MAX}.`;
  if (Math.abs(q.b) > B_MAX) return `${path}.b must be a whole number from −${B_MAX} to ${B_MAX}.`;
  if (Math.abs(q.c) > C_MAX) return `${path}.c must be a whole number from −${C_MAX} to ${C_MAX}.`;
  return null;
}

export const disc = (q: Quad) => q.b * q.b - 4 * q.a * q.c;
/** √D when D is a perfect square ≥ 0, else null. */
export function sqrtExact(D: number): number | null {
  if (D < 0) return null;
  const k = Math.round(Math.sqrt(D));
  return k * k === D ? k : null;
}
export const rationalRoots = (q: Quad) => sqrtExact(disc(q)) !== null;

/** The roots, smaller first (one entry when D = 0). Needs a perfect-square D ≥ 0. */
export function roots(q: Quad): Rat[] {
  const k = sqrtExact(disc(q));
  if (k === null) return [];
  const r1 = rat(-q.b - k, 2 * q.a);
  const r2 = rat(-q.b + k, 2 * q.a);
  const lo = ratValue(r1) <= ratValue(r2) ? r1 : r2;
  const hi = lo === r1 ? r2 : r1;
  return k === 0 ? [lo] : [lo, hi];
}

/** Does x = r satisfy the equation, exactly? */
export const isRoot = (q: Quad, r: Rat) => q.a * r.n * r.n + q.b * r.n * r.d + q.c * r.d * r.d === 0;

/* ---------------- text ---------------- */

const xPow = (p: 1 | 2) => (p === 2 ? 'x^2' : 'x');
/** "x^2 − 5x + 6", "−2x^2 + 3", "x^2". The coefficient 1 is not written. */
export function polyText(q: Quad): string {
  const parts: string[] = [];
  const term = (c: number, v: string, first: boolean) => {
    if (c === 0) return;
    const mag = Math.abs(c) === 1 && v ? '' : String(Math.abs(c));
    const sign = c < 0 ? '−' : '+';
    parts.push(first ? `${c < 0 ? '−' : ''}${mag}${v}` : `${sign} ${mag}${v}`);
  };
  term(q.a, xPow(2), true);
  term(q.b, xPow(1), false);
  term(q.c, '', false);
  return parts.join(' ');
}
export const equationText = (q: Quad) => `${polyText(q)} = 0`;

/** "2x − 3", "x + 4", "−x + 1", "3x" for a linear factor g x + h. */
export function linText(g: number, h: number): string {
  const gx = g === 1 ? 'x' : g === -1 ? '−x' : `${fmt(g)}x`;
  if (h === 0) return gx;
  return `${gx} ${h < 0 ? '−' : '+'} ${Math.abs(h)}`;
}

/* ---------------- factorising by splitting the middle term ---------------- */

export interface Factoring {
  /** The middle term b x is split into m x + n x (m + n = b, m n = a c). */
  m: number;
  n: number;
  /** a x² + m x = g1 x (a1 x + m1);  n x + c = g2 (a1 x + m1);  so  a x² + b x + c = (g1 x + g2)(a1 x + m1). */
  g1: number;
  a1: number;
  m1: number;
  g2: number;
  lines: string[];
  /** Roots as the two linear factors give them: −g2/g1 and −m1/a1. */
  r1: Rat;
  r2: Rat;
}

/** The splitting and grouping for a quadratic with c ≠ 0 and a perfect-square D; null otherwise. */
export function factoring(q: Quad): Factoring | null {
  const k = sqrtExact(disc(q));
  if (k === null || q.c === 0) return null;
  const m0 = (q.b + k) / 2;
  const n0 = (q.b - k) / 2;
  for (const [m, n] of [[m0, n0], [n0, m0]] as const) {
    const g = gcd(q.a, m);
    const g1 = Math.sign(q.a) * g;
    const a1 = q.a / g1;
    const m1 = m / g1;
    // second group n x + c must be g2 (a1 x + m1)
    if (n % a1 !== 0) continue;
    const g2 = n / a1;
    if (g2 * m1 !== q.c) continue;
    const inner = linText(a1, m1);
    const g1x = g1 === 1 ? 'x' : g1 === -1 ? '−x' : `${fmt(g1)}x`;
    const second = `${g2 < 0 ? '−' : '+'} ${Math.abs(g2) === 1 ? '' : Math.abs(g2)}(${inner})`;
    const split = `${polyText({ a: q.a, b: 0, c: 0 })} ${m < 0 ? '−' : '+'} ${Math.abs(m) === 1 ? '' : Math.abs(m)}x ${n < 0 ? '−' : '+'} ${Math.abs(n) === 1 ? '' : Math.abs(n)}x ${q.c < 0 ? '−' : '+'} ${Math.abs(q.c)}`;
    const lines = [
      `${split} = 0`,
      `${g1x}(${inner}) ${second} = 0`,
      `(${linText(g1, g2)})(${inner}) = 0`,
      `${linText(g1, g2)} = 0   or   ${inner} = 0`,
    ];
    return { m, n, g1, a1, m1, g2, lines, r1: rat(-g2, g1), r2: rat(-m1, a1) };
  }
  return null;
}

/** Factorising when c = 0: x(a x + b) = 0. */
export function factoringZero(q: Quad): { lines: string[]; r1: Rat; r2: Rat } | null {
  if (q.c !== 0 || q.b === undefined) return null;
  if (q.b === 0) return null;
  const inner = linText(q.a, q.b);
  return { lines: [`x(${inner}) = 0`, `x = 0   or   ${inner} = 0`], r1: rat(0, 1), r2: rat(-q.b, q.a) };
}

/* ---------------- the quadratic formula, worked ---------------- */

export interface FormulaWork {
  /** "D = b² − 4ac" style lines, then the numbers. */
  discLines: string[];
  D: number;
  /** √D when D is a perfect square. */
  k: number | null;
}

const br = (v: number) => (v < 0 ? `(${fmt(v)})` : String(v));
export function formulaWork(q: Quad): FormulaWork {
  const D = disc(q);
  return { discLines: ['D = b² − 4ac', `D = ${br(q.b)}² − 4(${fmt(q.a)})(${fmt(q.c)})`, `D = ${fmt(D)}`], D, k: sqrtExact(D) };
}

/** Numerator and denominator as written under the formula: (−b ± k) and 2a. */
export function formulaFraction(q: Quad, k: number): { top: string; bottom: string } {
  return { top: `${fmt(-q.b)} ± ${k}`, bottom: String(fmt(2 * q.a)) };
}

/* ---------------- the check ---------------- */

/** "(2)² − 5(2) + 6 = 0": the root put into the equation (integer roots only). */
export function checkText(q: Quad, r: number): string {
  const v = r < 0 ? `(${fmt(r)})` : `(${r})`;
  const t = (c: number, body: string, first: boolean) => {
    const mag = Math.abs(c) === 1 && !body.startsWith('(') ? '' : Math.abs(c) === 1 ? '' : String(Math.abs(c));
    return first ? `${c < 0 ? '−' : ''}${mag}${body}` : ` ${c < 0 ? '−' : '+'} ${mag}${body}`;
  };
  void t;
  const first = `${q.a === 1 ? '' : q.a === -1 ? '−' : fmt(q.a)}${v}²`;
  const second = q.b === 0 ? '' : ` ${q.b < 0 ? '−' : '+'} ${Math.abs(q.b) === 1 ? '' : Math.abs(q.b)}${v}`;
  const third = q.c === 0 ? '' : ` ${q.c < 0 ? '−' : '+'} ${Math.abs(q.c)}`;
  return `${first}${second}${third} = 0`;
}

/* ---------------- the graph window ---------------- */

export interface Window {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}
export const vertex = (q: Quad): { h: number; k: number } => ({ h: -q.b / (2 * q.a), k: q.c - (q.b * q.b) / (4 * q.a) });

/** A window that shows the vertex, the roots and the axes, with the curve running off the open side. */
export function graphWindow(q: Quad): Window {
  const { h, k } = vertex(q);
  const rs = roots(q).map(ratValue);
  const spread = rs.length ? Math.max(...rs.map((r) => Math.abs(r - h))) : 0;
  const hw = Math.max(3, Math.ceil(spread + 1.5));
  const x0 = Math.round(h) - hw;
  const x1 = Math.round(h) + hw;
  const lo0 = Math.min(0, k);
  const hi0 = Math.max(0, k);
  const pad = Math.max(1, (hi0 - lo0) * 0.18);
  // the y range is about as tall as the x range is wide, so the parabola keeps a natural shape
  const span = Math.max(6, 2 * hw * 0.95, hi0 - lo0 + 2 * pad);
  const yLo = q.a > 0 ? Math.floor(lo0 - pad) : Math.ceil(hi0 + pad) - Math.ceil(span);
  return { xMin: x0, xMax: x1, yMin: yLo, yMax: yLo + Math.ceil(span) };
}

/* ---------------- reading an equation from text ---------------- */

/**
 * Finds "a x² + b x + c = 0" in text ("x² − 5x + 6 = 0", "2x^2-3x-2=0", "x² = 9"-style is NOT read).
 * Only the plain form with 0 on the right is accepted, with whole-number coefficients; otherwise null.
 */
export function parseQuad(text: string): Quad | null {
  const s = text
    .replace(/[−–—]/g, '-')
    .replace(/[×·*]/g, '')
    .replace(/\s+/g, '')
    .replace(/²/g, '^2');
  const m = s.match(/((?:[+-]?\d*x(?:\^2)?|[+-]?\d+)+)=0(?!\d|\.\d)/i);
  if (!m) return null;
  const body = m[1];
  const q: Quad = { a: 0, b: 0, c: 0 };
  let rest = body;
  let seenSquare = false;
  const re = /^([+-]?)(\d*)(x\^2|x)?/i;
  while (rest.length) {
    const t = re.exec(rest);
    if (!t || !t[0].length) return null;
    const sign = t[1] === '-' ? -1 : 1;
    const val = sign * (t[2] === '' ? (t[3] ? 1 : 0) : parseInt(t[2], 10));
    if (t[3]?.toLowerCase() === 'x^2') {
      q.a += val;
      seenSquare = true;
    } else if (t[3]) q.b += val;
    else q.c += val;
    rest = rest.slice(t[0].length);
  }
  if (!seenSquare || q.a === 0) return null;
  return q;
}
