/**
 * Tiny, safe expression evaluator for board parameters.
 * Supports numbers, identifiers (parameters / x), + - * / ^, parentheses, unary minus,
 * implicit multiplication ("2x", "3(t+1)") and sin cos tan sqrt abs ln log exp floor round min max pow.
 * No eval/Function: a lesson authored by an LLM can never execute code.
 * Deliberately independent of mathjs so it is cheap to ship to a low-RAM Android browser.
 */
type Tok = { t: 'num'; v: number } | { t: 'id'; v: string } | { t: 'op'; v: string };
type Ast =
  | { k: 'num'; v: number } | { k: 'var'; v: string } | { k: 'neg'; a: Ast }
  | { k: 'bin'; op: string; a: Ast; b: Ast } | { k: 'call'; f: string; args: Ast[] };

const FUNCS: Record<string, (...a: number[]) => number> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, sqrt: Math.sqrt, abs: Math.abs, ln: Math.log, log: Math.log10,
  exp: Math.exp, floor: Math.floor, round: Math.round, min: Math.min, max: Math.max, pow: Math.pow,
};
const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E };

function lex(src: string): Tok[] {
  const out: Tok[] = [];
  const re = /\s*(?:(\d+\.?\d*|\.\d+)|([A-Za-z_][A-Za-z0-9_]*)|([-+*/^(),]))/y;
  let i = 0;
  while (i < src.length) {
    if (/^\s*$/.test(src.slice(i))) break;
    re.lastIndex = i;
    const m = re.exec(src);
    if (!m) throw new Error(`bad character at ${i}`);
    if (m[1] !== undefined) out.push({ t: 'num', v: Number(m[1]) });
    else if (m[2] !== undefined) out.push({ t: 'id', v: m[2] });
    else out.push({ t: 'op', v: m[3] });
    i = re.lastIndex;
  }
  return out;
}

function parse(tokens: Tok[]): Ast {
  let p = 0;
  const peek = () => tokens[p];
  const isOp = (v: string) => { const t = peek(); return t?.t === 'op' && t.v === v; };
  const expect = (v: string) => { if (!isOp(v)) throw new Error(`expected ${v}`); p++; };
  function expr(): Ast {
    let a = term();
    while (isOp('+') || isOp('-')) { const op = (tokens[p++] as { v: string }).v; a = { k: 'bin', op, a, b: term() }; }
    return a;
  }
  function term(): Ast {
    let a = unary();
    for (;;) {
      if (isOp('*') || isOp('/')) { const op = (tokens[p++] as { v: string }).v; a = { k: 'bin', op, a, b: unary() }; continue; }
      const t = peek();
      // implicit multiplication: 2x, 3(t+1), x(y)
      if (t && (t.t === 'num' || t.t === 'id' || (t.t === 'op' && t.v === '('))) { a = { k: 'bin', op: '*', a, b: power() }; continue; }
      return a;
    }
  }
  function unary(): Ast {
    if (isOp('-')) { p++; return { k: 'neg', a: unary() }; }
    if (isOp('+')) { p++; return unary(); }
    return power();
  }
  function power(): Ast {
    const base = atom();
    if (isOp('^')) { p++; return { k: 'bin', op: '^', a: base, b: unary() }; }
    return base;
  }
  function atom(): Ast {
    const t = tokens[p++];
    if (!t) throw new Error('unexpected end');
    if (t.t === 'num') return { k: 'num', v: t.v };
    if (t.t === 'id') {
      if (isOp('(') && Object.prototype.hasOwnProperty.call(FUNCS, t.v)) {
        p++;
        const args: Ast[] = [];
        if (!isOp(')')) { args.push(expr()); while (isOp(',')) { p++; args.push(expr()); } }
        expect(')');
        return { k: 'call', f: t.v, args };
      }
      return { k: 'var', v: t.v };
    }
    if (t.t === 'op' && t.v === '(') { const a = expr(); expect(')'); return a; }
    throw new Error(`unexpected ${t.v}`);
  }
  const ast = expr();
  if (p < tokens.length) throw new Error('trailing input');
  return ast;
}

function run(a: Ast, vars: Record<string, number>): number {
  switch (a.k) {
    case 'num': return a.v;
    case 'var': {
      // Own-property lookups only: names like `constructor` / `__proto__` must never resolve through the prototype chain.
      const v = Object.prototype.hasOwnProperty.call(vars, a.v) ? vars[a.v] : Object.prototype.hasOwnProperty.call(CONSTS, a.v) ? CONSTS[a.v] : undefined;
      return typeof v === 'number' ? v : NaN;
    }
    case 'neg': return -run(a.a, vars);
    case 'call': return FUNCS[a.f](...a.args.map(x => run(x, vars)));
    case 'bin': {
      const x = run(a.a, vars), y = run(a.b, vars);
      return a.op === '+' ? x + y : a.op === '-' ? x - y : a.op === '*' ? x * y : a.op === '/' ? x / y : Math.pow(x, y);
    }
  }
}

const cache = new Map<string, Ast | null>();
function compile(src: string): Ast | null {
  const key = String(src);
  if (cache.has(key)) return cache.get(key) ?? null;
  let ast: Ast | null = null;
  try { ast = key.length <= 200 ? parse(lex(key)) : null; } catch { ast = null; }
  if (cache.size > 400) cache.clear();
  cache.set(key, ast);
  return ast;
}

/** Evaluate `src` with the given variables. Returns NaN when the expression is invalid or uses an unknown name. */
export function evalExpr(src: string, vars: Record<string, number> = {}): number {
  const ast = compile(src);
  if (!ast) return NaN;
  try { return run(ast, vars); } catch { return NaN; }
}

/** True if the expression parses (unknown variable names are allowed; they are checked at render time). */
export function isValidExpr(src: string): boolean { return compile(src) !== null; }

/** Central-difference derivative of `src` with respect to `variable` at `at`. */
export function derivative(src: string, variable: string, at: number, vars: Record<string, number> = {}): number {
  const h = 1e-4 * Math.max(1, Math.abs(at));
  return (evalExpr(src, { ...vars, [variable]: at + h }) - evalExpr(src, { ...vars, [variable]: at - h })) / (2 * h);
}
