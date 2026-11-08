/**
 * The algebra behind the polynomial DNA (V51.9.31). A polynomial is a list of whole-number
 * coefficients from the highest power down to the constant term: [3, −2, 0, 5, −7] is
 * 3x⁴ − 2x³ + 5x − 7. Addition, subtraction, multiplication, division by x − r, the remainder P(r),
 * the factor theorem, the three square identities and the graph window are all computed here, so
 * what the board writes and draws is true whatever the plan says.
 */

export type Poly = number[];

export const COEF_MAX = 12;
export const COEF_MAX_Q = 9;
export const R_MAX = 9;
export const DEG_MIN = 2;
export const DEG_MAX = 4;
export const DIV_DEG_MAX = 3;

export const fmt = (n: number) => String(n).replace('-', '−');
const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);

/** Strips leading zeros; the zero polynomial is [0]. */
export function norm(p: Poly): Poly {
  let i = 0;
  while (i < p.length - 1 && p[i] === 0) i++;
  return p.slice(i).map((c) => c + 0);
}
export const degree = (p: Poly) => norm(p).length - 1;
export const isZero = (p: Poly) => norm(p).every((c) => c === 0);

/** Power of x of the coefficient at index i. */
const powOf = (p: Poly, i: number) => p.length - 1 - i;

/** "x", "x^3", "3x^4"; coefficient 1 hidden for powers ≥ 1. */
export function termText(c: number, k: number, first = true): string {
  const mag = Math.abs(c);
  const body = k === 0 ? String(mag) : `${mag === 1 ? '' : mag}x${k === 1 ? '' : `^${k}`}`;
  if (first) return `${c < 0 ? '−' : ''}${body}`;
  return `${c < 0 ? '−' : '+'} ${body}`;
}

/** "3x^4 − 2x^3 + 5x − 7"; "0" for the zero polynomial. */
export function polyText(p0: Poly): string {
  const p = norm(p0);
  let out = '';
  p.forEach((c, i) => {
    if (c === 0) return;
    out += (out ? ' ' : '') + termText(c, powOf(p, i), !out);
  });
  return out || '0';
}

export const addPoly = (a: Poly, b: Poly): Poly => {
  const n = Math.max(a.length, b.length);
  const pad = (p: Poly) => [...Array(n - p.length).fill(0), ...p];
  const pa = pad(a);
  const pb = pad(b);
  return norm(pa.map((c, i) => c + pb[i]));
};
export const negPoly = (p: Poly): Poly => p.map((c) => (c === 0 ? 0 : -c));
export const subPoly = (a: Poly, b: Poly): Poly => addPoly(a, negPoly(b));
export function mulPoly(a: Poly, b: Poly): Poly {
  const out = Array(a.length + b.length - 1).fill(0);
  a.forEach((x, i) => b.forEach((y, j) => (out[i + j] += x * y)));
  return norm(out);
}
export const evalPoly = (p: Poly, r: number): number => p.reduce((s, c) => s * r + c, 0) + 0;

/** The non-zero terms as { c, k } (coefficient, power), highest power first. */
export function termsOf(p0: Poly): Array<{ c: number; k: number }> {
  const p = norm(p0);
  const out: Array<{ c: number; k: number }> = [];
  p.forEach((c, i) => {
    if (c !== 0) out.push({ c, k: powOf(p, i) });
  });
  return out;
}

/* ---------------- checking a plan's numbers ---------------- */

export function polyProblem(p: Poly | undefined, path: string, o: { min?: number; max?: number; coef?: number } = {}): string | null {
  const min = o.min ?? DEG_MIN;
  const max = o.max ?? DEG_MAX;
  const coef = o.coef ?? COEF_MAX;
  if (!Array.isArray(p) || !p.length || !p.every(isInt)) return `${path} must be a list of whole numbers (highest power first, e.g. [3, −2, 0, 5, −7]).`;
  if (p[0] === 0) return `${path}: the first number (the highest power) must not be 0.`;
  const d = p.length - 1;
  if (d < min || d > max) return `${path} must have degree ${min} to ${max} (${min + 1} to ${max + 1} numbers).`;
  if (p.some((c) => Math.abs(c) > coef)) return `${path}: every coefficient must be between −${coef} and ${coef}.`;
  return null;
}

/* ---------------- division by x − r ---------------- */

export const divisorText = (r: number) => (r < 0 ? `x + ${-r}` : `x − ${r}`);

export interface DivStep {
  /** Quotient term c x^pw. */
  c: number;
  pw: number;
  /** c x^pw (x − r) written out. */
  product: Poly;
  /** What is left after subtracting it. */
  left: Poly;
}
export interface Division {
  q: Poly;
  rem: number;
  steps: DivStep[];
}

/** Long division of p by (x − r); every quotient term is an integer because the divisor is monic. */
export function divide(p0: Poly, r: number): Division {
  let cur = norm(p0);
  const steps: DivStep[] = [];
  const qCoef = new Map<number, number>();
  while (cur.length > 1) {
    const c = cur[0];
    const pw = cur.length - 2;
    const product = mulPoly([c], [1, -r]).concat(Array(pw).fill(0));
    const left = subPoly(cur, product);
    steps.push({ c, pw, product: norm(product), left });
    qCoef.set(pw, c);
    cur = left;
  }
  const rem = cur[0] + 0;
  const top = steps.length ? steps[0].pw : 0;
  const q = steps.length ? norm(Array.from({ length: top + 1 }, (_, i) => qCoef.get(top - i) ?? 0)) : [0];
  return { q, rem, steps };
}

/* ---------------- substitution P(r) ---------------- */

/** "(2)^3 − 4(2) + 5" – the polynomial with r put in for x. */
export function substText(p0: Poly, r: number): string {
  const ts = termsOf(p0);
  let out = '';
  ts.forEach(({ c, k }, i) => {
    const sign = i === 0 ? (c < 0 ? '−' : '') : c < 0 ? ' − ' : ' + ';
    const mag = Math.abs(c);
    const rv = `(${fmt(r)})`;
    const body = k === 0 ? String(mag) : `${mag === 1 ? '' : mag}${rv}${k === 1 ? '' : `^${k}`}`;
    out += `${sign}${body}`;
  });
  return out;
}
/** "8 − 8 + 5" – the value of each term. */
export function valuesText(p0: Poly, r: number): string {
  const ts = termsOf(p0);
  let out = '';
  ts.forEach(({ c, k }, i) => {
    const v = c * r ** k;
    out += i === 0 ? fmt(v) : ` ${v < 0 ? '−' : '+'} ${Math.abs(v)}`;
  });
  return out;
}

export interface Remainder {
  lines: string[];
  value: number;
}
export function remainderLines(p: Poly, r: number): Remainder {
  const v = evalPoly(p, r);
  const name = `P(${fmt(r)})`;
  return { lines: [`${name} = ${substText(p, r)}`, `${name} = ${valuesText(p, r)}`, `${name} = ${fmt(v)}`], value: v };
}

/* ---------------- roots and factorising ---------------- */

/** Integer roots with multiplicity (ascending), found by dividing out (x − r); the rest is what remains. */
export function integerRoots(p0: Poly): { roots: number[]; rest: Poly } {
  let p = norm(p0);
  const roots: number[] = [];
  if (isZero(p)) return { roots, rest: p };
  for (;;) {
    if (p.length < 2) break;
    const bound = 1 + Math.max(...p.slice(1).map(Math.abs)) / Math.abs(p[0]);
    let found: number | null = null;
    for (let r = -Math.floor(bound); r <= Math.floor(bound); r++) {
      if (evalPoly(p, r) === 0) {
        found = r;
        break;
      }
    }
    if (found === null) break;
    roots.push(found);
    p = divide(p, found).q;
  }
  return { roots: roots.sort((a, b) => a - b), rest: p };
}

/** Monic with every root a whole number: x³ − 4x² + x + 6 = (x + 1)(x − 2)(x − 3). */
export function fullyFactorable(p: Poly): number[] | null {
  const n = norm(p);
  if (n[0] !== 1 || n.length < 3) return null;
  const { roots, rest } = integerRoots(n);
  return rest.length === 1 && rest[0] === 1 ? roots : null;
}

const factorText = (r: number) => `(${divisorText(r)})`;
export interface FactorWork {
  lines: string[];
  /** The quotient after taking out (x − at). */
  quotient: Poly;
}
/** The factor theorem at `at`: P(at) = 0, the first factor, the rest, and every factor. */
export function factorLines(p: Poly, at: number): FactorWork | null {
  const rs = fullyFactorable(p);
  if (!rs || !rs.includes(at)) return null;
  const name = `P(${fmt(at)})`;
  const { q } = divide(p, at);
  const all = [at, ...(() => {
    const rest = [...rs];
    rest.splice(rest.indexOf(at), 1);
    return rest;
  })()];
  const lines = [`${name} = ${valuesText(p, at)} = 0`, `P(x) = ${factorText(at)}(${polyText(q)})`];
  if (all.length > 2) lines.push(`= ${all.map(factorText).join('')}`);
  return { lines, quotient: q };
}

/* ---------------- the three square identities ---------------- */

export type IdentityKind = 'diff-squares' | 'square-sum' | 'square-diff';
export interface Identity {
  kind: IdentityKind;
  k: number;
  lines: string[];
  check: string[];
  /** Factor form, e.g. "(x − 3)(x + 3)". */
  factored: string;
}

/** Which square identity the polynomial is, if any: x² − k², x² + 2kx + k², x² − 2kx + k². */
export function identityOf(p0: Poly): Identity | null {
  const p = norm(p0);
  if (p.length !== 3 || p[0] !== 1) return null;
  const [, b, c] = p;
  const k2 = Math.round(Math.sqrt(Math.abs(c)));
  if (b === 0 && c < 0 && k2 * k2 === -c && k2 >= 1) {
    const k = k2;
    return {
      kind: 'diff-squares',
      k,
      lines: [polyText(p), `= x^2 − ${k}^2`, `= (x − ${k})(x + ${k})`],
      check: [`(x − ${k})(x + ${k}) = x^2 + ${k}x − ${k}x − ${k * k}`, `= ${polyText(p)}`],
      factored: `(x − ${k})(x + ${k})`,
    };
  }
  if (c > 0 && k2 * k2 === c && (b === 2 * k2 || b === -2 * k2) && k2 >= 1) {
    const k = k2;
    const plus = b > 0;
    const s = plus ? '+' : '−';
    return {
      kind: plus ? 'square-sum' : 'square-diff',
      k,
      lines: [polyText(p), `= x^2 ${s} 2(x)(${k}) + ${k}^2`, `= (x ${s} ${k})^2`],
      check: [`(x ${s} ${k})(x ${s} ${k}) = x^2 ${s} ${k}x ${s} ${k}x + ${k * k}`, `= ${polyText(p)}`],
      factored: `(x ${s} ${k})^2`,
    };
  }
  return null;
}

/* ---------------- the graph window ---------------- */

export interface Window {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

/** Real roots found by sign changes of P over [−bound, bound] and bisection (all roots of the polynomial, any real values). */
export function realRoots(p0: Poly): number[] {
  const p = norm(p0);
  if (p.length < 2) return [];
  const bound = 1 + Math.max(...p.slice(1).map(Math.abs)) / Math.abs(p[0]);
  const out: number[] = [];
  const N = 4000;
  let prevX = -bound;
  let prevV = evalPoly(p, prevX);
  for (let i = 1; i <= N; i++) {
    const x = -bound + (2 * bound * i) / N;
    const v = evalPoly(p, x);
    if (v === 0) out.push(x);
    else if (prevV !== 0 && Math.sign(v) !== Math.sign(prevV)) {
      let lo = prevX;
      let hi = x;
      for (let it = 0; it < 60; it++) {
        const mid = (lo + hi) / 2;
        if (Math.sign(evalPoly(p, mid)) === Math.sign(prevV)) lo = mid;
        else hi = mid;
      }
      out.push((lo + hi) / 2);
    }
    prevX = x;
    prevV = v;
  }
  // repeated roots (touching the axis) do not change sign: add integer roots
  for (const r of integerRoots(p).roots) if (!out.some((o) => Math.abs(o - r) < 1e-6)) out.push(r);
  return out.sort((a, b) => a - b);
}

const derivative = (p: Poly): Poly => {
  const d = p.length - 1;
  return p.length < 2 ? [0] : norm(p.slice(0, -1).map((c, i) => c * (d - i)));
};

/** A window that shows every real root, every turning point and both axes. */
export function graphWindow(p0: Poly): Window {
  const p = norm(p0);
  const rr = realRoots(p);
  const crit = realRoots(derivative(p));
  const xs = [...rr, ...crit];
  let x0 = Math.min(-3, ...xs.map((x) => x - 1));
  let x1 = Math.max(3, ...xs.map((x) => x + 1));
  x0 = Math.floor(x0);
  x1 = Math.ceil(x1);
  const ys = [0, ...crit.map((x) => evalPoly(p, x))];
  if (crit.length === 0) ys.push(evalPoly(p, x0), evalPoly(p, x1));
  let lo = Math.min(...ys);
  let hi = Math.max(...ys);
  const pad = Math.max(1, (hi - lo) * 0.18);
  lo = Math.floor(lo - pad);
  hi = Math.ceil(hi + pad);
  if (hi - lo < 4) {
    lo -= 1;
    hi += 1;
  }
  return { xMin: x0, xMax: x1, yMin: lo, yMax: hi };
}

/* ---------------- reading a polynomial from text ---------------- */

const SUP: Record<string, string> = { '²': '2', '³': '3', '⁴': '4' };

/**
 * The first polynomial of degree 2 to 4 in text, such as "3x⁴ − 2x³ + 5x − 7" or "x^3 - 6x^2 + 11x - 6";
 * null when there is none or its coefficients are too large.
 */
export function parsePoly(text: string): Poly | null {
  const s = text
    .replace(/[−–—]/g, '-')
    .replace(/[×·*]/g, '')
    .replace(/[²³⁴]/g, (m) => `^${SUP[m]}`)
    .replace(/\s*([+-])\s*/g, '$1')
    .replace(/\s*\^\s*/g, '^');
  const re = /(?<![A-Za-z0-9^])(?:[+-]?\d*x(?:\^[2-4])?|[+-]?\d+)+/gi;
  for (const m of s.matchAll(re)) {
    const body = m[0];
    if (!/x\^[2-4]/i.test(body)) continue;
    if (/^[+-][A-Za-z(]/.test(s.slice((m.index ?? 0) + body.length))) continue;
    const coef = new Map<number, number>();
    let rest = body;
    const t = /^([+-]?)(\d*)(x\^([2-4])|x)?/i;
    let ok = true;
    while (rest.length) {
      const g = t.exec(rest);
      if (!g || !g[0].length) {
        ok = false;
        break;
      }
      const sign = g[1] === '-' ? -1 : 1;
      const mag = g[2] === '' ? (g[3] ? 1 : 0) : parseInt(g[2], 10);
      const k = g[3] ? (g[4] ? parseInt(g[4], 10) : 1) : 0;
      coef.set(k, (coef.get(k) ?? 0) + sign * mag);
      rest = rest.slice(g[0].length);
    }
    if (!ok) continue;
    const d = Math.max(...coef.keys());
    const p = Array.from({ length: d + 1 }, (_, i) => coef.get(d - i) ?? 0);
    if (polyProblem(p, 'p')) continue;
    if (termsOf(p).length < 2) continue;
    return norm(p);
  }
  return null;
}
