/**
 * Maths checker for derivation reels: every line that is shown must be TRUE.
 * A tiny, safe expression evaluator (no eval) over the same tokens the video shows.
 *
 *  - Lines with "=" : all sides must be equal (for at least one of the given
 *    solution sets); "or" splits alternatives (x = −2 or x = −3).
 *  - Lines without "=": must have the same value as the first checked line
 *    (a chain like 1/2 + 1/3 → 3/6 + 2/6 → 5/6).
 *  - Supports + − × ÷ * / ^, fractions {a/b}, powers x^2 / 2^{3+4}, %, "of",
 *    √, π, sin/cos/tan with °, brackets and implicit multiplication (2x, 3(x+1)).
 */

import { parseFrac } from './metrics';
import type { DerivationInput } from './recipes/derivation';

export type Vars = Record<string, number>;

const FUNCS: Record<string, (v: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  '√': Math.sqrt,
  sqrt: Math.sqrt,
};

/** Token list → plain expression text. */
export function tokensToExpr(tokens: string[]): string {
  return tokens
    .map((tk) => {
      const f = parseFrac(tk);
      const t = f ? `((${f.num})/(${f.den}))` : tk;
      return t.replace(/\^\{([^}]*)\}/g, '^($1)');
    })
    .join(' ');
}

class Parser {
  i = 0;
  constructor(
    private s: string,
    private vars: Vars,
  ) {}

  peek(): string {
    while (this.s[this.i] === ' ') this.i++;
    return this.s[this.i] ?? '';
  }

  eat(ch: string): boolean {
    if (this.peek() === ch) {
      this.i++;
      return true;
    }
    return false;
  }

  word(): string {
    this.peek();
    const m = /^[a-zA-Zα-ωπθ]+/.exec(this.s.slice(this.i));
    return m ? m[0] : '';
  }

  expr(): number {
    let v = this.term();
    for (;;) {
      if (this.eat('+')) v += this.term();
      else if (this.eat('-') || this.eat('−')) v -= this.term();
      else return v;
    }
  }

  startsPrimary(): boolean {
    const c = this.peek();
    if (!c) return false;
    if (/[0-9.(√]/.test(c)) return true;
    const w = this.word();
    return !!w && w !== 'of';
  }

  term(): number {
    let v = this.unary();
    for (;;) {
      if (this.eat('*') || this.eat('×')) v *= this.unary();
      else if (this.eat('/') || this.eat('÷')) v /= this.unary();
      else if (this.word() === 'of') {
        this.i += 2;
        v *= this.unary();
      } else if (this.startsPrimary()) v *= this.unary();
      else return v;
    }
  }

  unary(): number {
    if (this.eat('-') || this.eat('−')) return -this.unary();
    if (this.eat('+')) return this.unary();
    return this.power();
  }

  power(): number {
    const b = this.postfix();
    if (this.eat('^')) return Math.pow(b, this.unary());
    return b;
  }

  postfix(): number {
    let v = this.primary();
    for (;;) {
      if (this.eat('%')) v /= 100;
      else if (this.eat('°')) v = (v * Math.PI) / 180;
      else if (this.eat('²')) v = v * v;
      else if (this.eat('³')) v = v * v * v;
      else return v;
    }
  }

  primary(): number {
    const c = this.peek();
    if (c === '(') {
      this.i++;
      const v = this.expr();
      if (!this.eat(')')) throw new Error('missing )');
      return v;
    }
    if (c === '√') {
      this.i++;
      return Math.sqrt(this.power());
    }
    const num = /^[0-9]*\.?[0-9]+/.exec(this.s.slice(this.i));
    if (num) {
      this.i += num[0].length;
      return Number(num[0]);
    }
    const w = this.word();
    if (!w) throw new Error(`unexpected "${c}" in ${this.s}`);
    if (w in FUNCS) {
      this.i += w.length;
      // sin 30° : the argument includes its degree sign.
      return FUNCS[w](this.postfix());
    }
    if (w === 'π' || w === 'pi') {
      this.i += w.length;
      return Math.PI;
    }
    // Single-letter variables multiply implicitly (xy = x·y); known multi-letter names win.
    if (w in this.vars) {
      this.i += w.length;
      return this.vars[w];
    }
    const ch = w[0];
    if (!(ch in this.vars)) throw new Error(`unknown symbol "${ch}"`);
    this.i += 1;
    return this.vars[ch];
  }
}

export function evaluate(expr: string, vars: Vars = {}): number {
  const p = new Parser(expr, vars);
  const v = p.expr();
  if (p.peek()) throw new Error(`trailing "${p.peek()}" in ${expr}`);
  return v;
}

const close = (a: number, b: number) => Math.abs(a - b) <= 1e-9 + 1e-3 * Math.max(Math.abs(a), Math.abs(b));

function splitOn(tokens: string[], sep: string): string[][] {
  const out: string[][] = [[]];
  for (const tk of tokens) {
    if (tk === sep) out.push([]);
    else out[out.length - 1].push(tk);
  }
  return out;
}

function lineHolds(tokens: string[], vars: Vars): boolean {
  return splitOn(tokens, 'or').some((alt) => {
    const sides = splitOn(alt, '=').map((s) => evaluate(tokensToExpr(s), vars));
    return sides.every((v) => close(v, sides[0]));
  });
}

export interface LineCheck {
  line: number;
  ok: boolean;
  error?: string;
}

/** Checks every line; `solutions` lists the variable values that make the story true. */
export function verifyDerivation(input: DerivationInput, solutions: Vars[] = [{}]): LineCheck[] {
  const out: LineCheck[] = [];
  let chainValue: number | undefined;
  input.lines.forEach((ln, i) => {
    if (ln.check === false) return;
    try {
      if (ln.tokens.includes('=')) {
        out.push({ line: i, ok: solutions.some((v) => lineHolds(ln.tokens, v)) });
      } else {
        const v = evaluate(tokensToExpr(ln.tokens), solutions[0]);
        if (chainValue === undefined) chainValue = v;
        out.push({ line: i, ok: close(v, chainValue) });
      }
    } catch (e) {
      out.push({ line: i, ok: false, error: (e as Error).message });
    }
  });
  return out;
}
