/**
 * Tiny algebra kernel: parses school expressions into an UNCOMBINED list of terms, so the board can
 * show "3(x - 4) + 2" -> "3x - 12 + 2" (expanded, not yet combined) -> "3x - 10" (combined), exactly the
 * order a teacher writes them. Exact rational coefficients, any single-letter variables.
 */
import { Fr, F } from './rational';

export interface Term { c: Fr; v: Record<string, number> }
export type Terms = Term[];

const MINUS = '\u2212';
const SUP: Record<string, string> = { '2': '\u00b2', '3': '\u00b3' };

export function normalizeMathText(input: string): string {
  return String(input)
    .replace(/[\u2212\u2013\u2014\uf02d]/g, '-')
    .replace(/[\u00d7\u00b7\u22c5]/g, '*')
    .replace(/\u00f7/g, '/')
    .replace(/\u00b2/g, '^2').replace(/\u00b3/g, '^3')
    .replace(/\u221a\s*\(/g, 'sqrt(').replace(/\u221a\s*(\d+)/g, 'sqrt($1)')
    .replace(/\s+/g, ' ')
    .trim();
}

type Tok = { t: 'num' | 'id' | 'op'; s: string };
function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  const s = normalizeMathText(src);
  for (let i = 0; i < s.length;) {
    const ch = s[i];
    if (ch === ' ') { i++; continue; }
    const num = /^(\d+(?:\.\d+)?|\.\d+)/.exec(s.slice(i));
    if (num) { out.push({ t: 'num', s: num[1] }); i += num[1].length; continue; }
    if (/[a-zA-Z]/.test(ch)) { out.push({ t: 'id', s: ch }); i++; continue; }
    if ('+-*/^()'.includes(ch)) { out.push({ t: 'op', s: ch }); i++; continue; }
    throw new Error(`Unexpected character "${ch}"`);
  }
  return out;
}

const one = (): Terms => [{ c: F(1), v: {} }];
const mulTerm = (a: Term, b: Term): Term => {
  const v: Record<string, number> = { ...a.v };
  for (const [k, e] of Object.entries(b.v)) v[k] = (v[k] || 0) + e;
  return { c: a.c.mul(b.c), v };
};
export const mulTerms = (A: Terms, B: Terms): Terms => A.flatMap(a => B.map(b => mulTerm(a, b)));
export const negTerms = (A: Terms): Terms => A.map(t => ({ c: t.c.neg(), v: t.v }));

export function parseTerms(src: string): Terms {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const isOp = (s: string) => peek()?.t === 'op' && peek().s === s;

  function expr(): Terms {
    let acc = term();
    while (isOp('+') || isOp('-')) {
      const op = toks[p++].s;
      const rhs = term();
      acc = acc.concat(op === '-' ? negTerms(rhs) : rhs);
    }
    return acc;
  }
  function startsFactor() {
    const t = peek();
    return !!t && (t.t === 'num' || t.t === 'id' || (t.t === 'op' && t.s === '('));
  }
  function term(): Terms {
    let acc = factor();
    for (;;) {
      if (isOp('*')) { p++; acc = mulTerms(acc, factor()); continue; }
      if (isOp('/')) {
        p++;
        const div = factor();
        if (div.length !== 1 || Object.keys(div[0].v).length) throw new Error('Division by a variable is not supported');
        acc = acc.map(t => ({ c: t.c.div(div[0].c), v: t.v }));
        continue;
      }
      if (startsFactor()) { acc = mulTerms(acc, factor()); continue; } // implicit multiplication: 2x, 3(x+1), (a)(b)
      break;
    }
    return acc;
  }
  function factor(): Terms {
    if (isOp('+')) { p++; return factor(); }
    if (isOp('-')) { p++; return negTerms(factor()); }
    return power();
  }
  function power(): Terms {
    let base = atom();
    if (isOp('^')) {
      p++;
      const neg = isOp('-'); if (neg) p++;
      const e = toks[p++];
      if (!e || e.t !== 'num' || !/^\d+$/.test(e.s) || neg) throw new Error('Only whole-number powers are supported');
      let r = one();
      for (let i = 0; i < Number(e.s); i++) r = mulTerms(r, base);
      base = r;
    }
    return base;
  }
  function atom(): Terms {
    const t = toks[p++];
    if (!t) throw new Error('Unexpected end of expression');
    if (t.t === 'num') return [{ c: Fr.parse(t.s), v: {} }];
    if (t.t === 'id') return [{ c: F(1), v: { [t.s]: 1 } }];
    if (t.t === 'op' && t.s === '(') {
      const inner = expr();
      if (!isOp(')')) throw new Error('Missing )');
      p++;
      return inner;
    }
    throw new Error(`Unexpected "${t.s}"`);
  }

  const result = expr();
  if (p !== toks.length) throw new Error(`Unexpected "${toks[p].s}"`);
  return result;
}

const monoKey = (v: Record<string, number>) => Object.keys(v).filter(k => v[k]).sort().map(k => `${k}^${v[k]}`).join('*');
const degreeOf = (v: Record<string, number>) => Object.values(v).reduce((a, b) => a + b, 0);

/** Merge like terms; higher degree first; zeros dropped. */
export function combine(A: Terms): Terms {
  const map = new Map<string, Term>();
  for (const t of A) {
    const k = monoKey(t.v);
    const cur = map.get(k);
    if (cur) map.set(k, { c: cur.c.add(t.c), v: cur.v }); else map.set(k, { c: t.c, v: { ...t.v } });
  }
  return [...map.values()].filter(t => !t.c.isZero()).sort((a, b) => degreeOf(b.v) - degreeOf(a.v) || monoKey(a.v).localeCompare(monoKey(b.v)));
}

export const isConstant = (t: Term) => degreeOf(t.v) === 0;
export function coefficientOf(A: Terms, variable: string, power = 1): Fr {
  return combine(A).filter(t => (t.v[variable] || 0) === power && degreeOf(t.v) === power).reduce((s, t) => s.add(t.c), F(0));
}
export const constantOf = (A: Terms): Fr => combine(A).filter(isConstant).reduce((s, t) => s.add(t.c), F(0));
export function degreeIn(A: Terms, variable: string): number {
  return combine(A).reduce((m, t) => Math.max(m, t.v[variable] || 0), 0);
}
export function variablesOf(A: Terms): string[] {
  return [...new Set(A.flatMap(t => Object.keys(t.v).filter(k => t.v[k])))].sort();
}

export function evaluate(A: Terms, values: Record<string, Fr>): Fr {
  return A.reduce((sum, t) => {
    let x = t.c;
    for (const [k, e] of Object.entries(t.v)) x = x.mul((values[k] ?? F(0)).pow(e));
    return sum.add(x);
  }, F(0));
}

/** "1/2" style number for display, using the true minus sign. */
export const fmtFr = (x: Fr) => x.toString().replace('-', MINUS);
const fmtMono = (v: Record<string, number>) => Object.keys(v).filter(k => v[k]).sort().map(k => `${k}${v[k] === 1 ? '' : (SUP[String(v[k])] ?? `^${v[k]}`)}`).join('');

/** Pretty text for a term list, keeping the given order ("3x − 12 + 2"). */
export function formatTerms(A: Terms): string {
  if (!A.length) return '0';
  return A.map((t, i) => {
    const mono = fmtMono(t.v);
    const abs = t.c.abs();
    const coef = mono ? (abs.eq(F(1)) ? '' : abs.isInt() ? String(abs.n) : `(${abs.toString()})`) : abs.toString();
    const body = `${coef}${mono}`;
    if (i === 0) return `${t.c.isNeg() ? MINUS : ''}${body}`;
    return `${t.c.isNeg() ? MINUS : '+'} ${body}`;
  }).join(' ').replace(/\+ /g, '+ ');
}
