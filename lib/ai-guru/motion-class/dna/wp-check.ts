/**
 * The "check" of a word problem (V51.9.44): put the answers back into every equation of the problem.
 * The equations are the ones written on the board as token lists (["4","x","+","y","=","14000"]);
 * the values are the solution. Everything shown is computed here, and a check is offered only when
 * every equation really holds, so the board can never "verify" something false.
 */

export type Vars = Record<string, number>;
export interface CheckLine {
  /** The equation with the numbers put in: 4 × 1000 + 10000 = 14000. */
  tokens: string[];
  /** The left side evaluated, the right side as written. */
  left: number;
  right: number;
  ok: boolean;
}

const MINUS = /^[−–-]$/;
const isNum = (t: string) => /^\d+(?:\.\d+)?$/.test(t);

/** Recursive-descent evaluator over tokens (+ − × ÷ ( ), numbers, letters from vars, implicit multiplication). */
function evalSide(tokens: string[], vars: Vars): number | null {
  let i = 0;
  const startsFactor = (t: string | undefined) => t !== undefined && (isNum(t) || t === '(' || (t in vars));
  void 0;
  const factor = (): number | null => {
    let v = atom();
    // Powers written as a superscript token: x ² , ( a + b ) ² (V51.9.46, for identities).
    while (v !== null && (tokens[i] === '²' || tokens[i] === '³')) v = v ** (tokens[i++] === '²' ? 2 : 3);
    return v;
  };
  const atom = (): number | null => {
    const t = tokens[i];
    if (t === undefined) return null;
    if (MINUS.test(t)) { i++; const v = factor(); return v === null ? null : -v; }
    if (t === '+') { i++; return factor(); }
    if (t === '(') {
      i++;
      const v = expr();
      if (tokens[i] !== ')') return null;
      i++;
      return v;
    }
    if (isNum(t)) { i++; return Number(t); }
    if (t in vars) { i++; return vars[t]; }
    return null;
  };
  const term = (): number | null => {
    let v = factor();
    if (v === null) return null;
    for (;;) {
      const t = tokens[i];
      if (t === '×' || t === '*' || t === '·') { i++; const r = factor(); if (r === null) return null; v *= r; }
      else if (t === '÷' || t === '/') { i++; const r = factor(); if (r === null || r === 0) return null; v /= r; }
      else if (startsFactor(t)) { const r = factor(); if (r === null) return null; v *= r; }
      else return v;
    }
  };
  const expr = (): number | null => {
    let v = term();
    if (v === null) return null;
    for (;;) {
      const t = tokens[i];
      if (t === '+') { i++; const r = term(); if (r === null) return null; v += r; }
      else if (t !== undefined && MINUS.test(t)) { i++; const r = term(); if (r === null) return null; v -= r; }
      else return v;
    }
  };
  const v = expr();
  return v !== null && i === tokens.length ? v : null;
}

const fmt = (n: number) => String(Math.round(n * 1e6) / 1e6);

/** Substitute the values into the tokens; implicit products get an explicit "×" so the line reads 4 × 1000. */
function substitute(tokens: string[], vars: Vars): string[] {
  const out: string[] = [];
  const val = (t: string) => (t in vars ? fmt(vars[t]) : t);
  tokens.forEach((t, k) => {
    const prev = tokens[k - 1];
    const isValue = (x: string | undefined) => x !== undefined && (isNum(x) || x in vars || x === ')');
    const startsValue = isNum(t) || t in vars || t === '(';
    if (k > 0 && isValue(prev) && startsValue) out.push('×');
    out.push(val(t));
  });
  return out;
}

/** The check lines for every equation, or null when there is nothing to check or any equation fails. */
export function checkLines(equations: Array<{ tokens: string[] }>, vars: Vars | undefined): CheckLine[] | null {
  if (!vars || !Object.keys(vars).length || !equations.length) return null;
  const lines: CheckLine[] = [];
  for (const e of equations) {
    const at = e.tokens.indexOf('=');
    if (at <= 0 || at === e.tokens.length - 1) return null;
    const lhs = e.tokens.slice(0, at);
    const rhs = e.tokens.slice(at + 1);
    const l = evalSide(lhs, vars);
    const r = evalSide(rhs, vars);
    if (l === null || r === null) return null;
    const ok = Math.abs(l - r) < 1e-9 * Math.max(1, Math.abs(l), Math.abs(r));
    if (!ok) return null;
    const left = substitute(lhs, vars);
    const right = substitute(rhs, vars);
    lines.push({ tokens: [...left, '=', ...right], left: l, right: r, ok });
  }
  return lines;
}
