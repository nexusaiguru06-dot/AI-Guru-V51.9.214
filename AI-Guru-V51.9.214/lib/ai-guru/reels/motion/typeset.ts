/**
 * Maths typesetting for the motion engine (V51.9.45).
 *
 * The engine draws text tokens, pen strokes and polygons. This module lays a formula out as exactly
 * those pieces, so a fraction, a root, a power or a bracketed matrix is made of ordinary engine items
 * that every verb (appear, write, dim, focus, move, fadeOut) already knows how to animate.
 *
 *  - `parseMath` reads a small LaTeX-like language (\frac{a}{b}, \sqrt{x}, x^{2}, x_{1}, \begin{bmatrix}…
 *    \end{bmatrix}, \color{a}{x}, \vec{v}, \hat{i}, \text{…}) and also plain maths such as "x² + 3/4 = √16".
 *  - `layoutMath` turns the tree into positioned glyphs and strokes (pure maths, no engine).
 *  - `placeMath` / `showMath` create the items; `becomeMath` turns one formula into the next by moving
 *    the symbols they share (3Blue1Brown's "transform matching"), fading what goes and writing what comes.
 *
 * Everything is computed here; a planner only supplies the text of the formula.
 */

import type { Motion } from './engine';
import { STAGGER_TEXT } from './curves';
import type { Role } from './grammar';
import { tokenWidth } from './metrics';

/* ---------------- the tree ---------------- */

export type SymClass = 'num' | 'var' | 'op' | 'rel' | 'punct' | 'fn' | 'open' | 'close' | 'other';
export type Bracket = '[' | '(' | '|' | '';

export type TexNode =
  | { k: 'sym'; s: string; c: SymClass }
  | { k: 'text'; s: string }
  | { k: 'row'; c: TexNode[] }
  | { k: 'frac'; n: TexNode; d: TexNode }
  | { k: 'script'; b: TexNode; sup?: TexNode; sub?: TexNode }
  | { k: 'sqrt'; c: TexNode }
  | { k: 'vec'; c: TexNode }
  | { k: 'color'; role: Role; c: TexNode }
  | { k: 'mat'; rows: TexNode[][]; br: Bracket }
  | { k: 'space'; w: number };

export const MATH_MAX_CHARS = 400;
export const MATH_MAX_NODES = 260;
export const MATH_MAX_DEPTH = 7;
const ROLES: Role[] = ['a', 'b', 'c', 'carry', 'result', 'ink', 'accent'];

/* ---------------- parser ---------------- */

const SYMBOLS: Record<string, string> = {
  times: '×', cdot: '·', div: '÷', pm: '±', mp: '∓', le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠', neq: '≠', approx: '≈', equiv: '≡',
  pi: 'π', theta: 'θ', alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', lambda: 'λ', mu: 'μ', sigma: 'σ', phi: 'φ', omega: 'ω', Delta: 'Δ', Sigma: 'Σ',
  infty: '∞', to: '→', rightarrow: '→', Rightarrow: '⇒', implies: '⇒', Leftrightarrow: '⇔', degree: '°', circ: '°', in: '∈', subset: '⊂', cup: '∪', cap: '∩',
  neg: '¬', angle: '∠', perp: '⊥', parallel: '∥', ldots: '…', dots: '…', cdots: '…', prime: '′', sum: '∑', partial: '∂', nabla: '∇', therefore: '∴', because: '∵',
  lt: '<', gt: '>',
};
const REL = new Set(['=', '≠', '≈', '≤', '≥', '<', '>', '≡', '→', '⇒', '⇔', '∈', '⊂']);
const OP = new Set(['+', '−', '-', '×', '÷', '±', '∓', '·', '∪', '∩', '*']);
const FUNCS = ['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'log', 'ln', 'exp', 'lim', 'det', 'max', 'min', 'gcd', 'lcm'];
const SUP_CHARS: Record<string, string> = { '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '¹': '1', '⁰': '0', 'ⁿ': 'n' };
const HAT: Record<string, string> = { i: 'î', j: 'ĵ', k: 'k̂' };

export class MathParseError extends Error {}

function classOf(ch: string): SymClass {
  if (REL.has(ch)) return 'rel';
  if (OP.has(ch)) return 'op';
  if (ch === ',' || ch === ';' || ch === ':') return 'punct';
  if (ch === '(' || ch === '[' || ch === '{') return 'open';
  if (ch === ')' || ch === ']' || ch === '}') return 'close';
  if (/[A-Za-zα-ωΑ-Ωϕ]/.test(ch)) return 'var';
  if (/\d/.test(ch)) return 'num';
  return 'other';
}

export function parseMath(src: string): TexNode {
  if (typeof src !== 'string') throw new MathParseError('the formula must be text');
  const text = src.trim();
  if (!text) throw new MathParseError('the formula is empty');
  if (text.length > MATH_MAX_CHARS) throw new MathParseError(`the formula has ${text.length} characters; use at most ${MATH_MAX_CHARS}`);
  let i = 0;
  let nodes = 0;
  const count = (n: TexNode, depth: number): TexNode => {
    if (++nodes > MATH_MAX_NODES) throw new MathParseError(`the formula is too big (more than ${MATH_MAX_NODES} parts)`);
    if (depth > MATH_MAX_DEPTH) throw new MathParseError(`the formula is nested more than ${MATH_MAX_DEPTH} levels deep`);
    return n;
  };
  const peek = () => text[i];
  const ws = () => { while (i < text.length && /\s/.test(text[i])) i++; };

  /** A sequence until `}`, `&`, `\\`, `\end` or the end. */
  const seq = (depth: number, untilParen = false): TexNode => {
    const items: TexNode[] = [];
    let open = 0;
    for (;;) {
      ws();
      if (i >= text.length) break;
      const ch = peek();
      if (ch === '}' || ch === '&') break;
      if (untilParen && ch === ')' && open === 0) break;
      if (untilParen && ch === '(') open++;
      else if (untilParen && ch === ')') open--;
      if (text.startsWith('\\\\', i) || text.startsWith('\\end', i)) break;
      items.push(withScripts(atom(depth), depth));
    }
    return count(items.length === 1 ? items[0] : { k: 'row', c: items }, depth);
  };

  const group = (depth: number): TexNode => {
    ws();
    if (peek() !== '{') return withScripts(atom(depth), depth, true);
    i++;
    const r = seq(depth + 1);
    ws();
    if (peek() !== '}') throw new MathParseError('a { is not closed');
    i++;
    return r;
  };

  /** The argument of ^ or _: a group, a command, one letter, or a whole number. */
  const scriptArg = (depth: number): TexNode => {
    ws();
    if (peek() === '{') return group(depth + 1);
    const m = /^\d+(?:\.\d+)?/.exec(text.slice(i));
    if (m) { i += m[0].length; return count({ k: 'sym', s: m[0], c: 'num' }, depth); }
    if (peek() === '−' || peek() === '-') {
      i++;
      const a = scriptArg(depth);
      return count({ k: 'row', c: [{ k: 'sym', s: '−', c: 'other' }, a] }, depth);
    }
    return atom(depth + 1);
  };

  const withScripts = (base: TexNode, depth: number, noScripts = false): TexNode => {
    if (noScripts) return base;
    let sup: TexNode | undefined;
    let sub: TexNode | undefined;
    for (;;) {
      ws();
      const ch = peek();
      if (ch === '^' && !sup) { i++; sup = scriptArg(depth); continue; }
      if (ch === '_' && !sub) { i++; sub = scriptArg(depth); continue; }
      if (ch !== undefined && SUP_CHARS[ch] && !sup) { i++; sup = { k: 'sym', s: SUP_CHARS[ch], c: 'num' }; continue; }
      break;
    }
    return sup || sub ? count({ k: 'script', b: base, sup, sub }, depth) : base;
  };

  const readWord = (): string => {
    const m = /^[A-Za-z]+/.exec(text.slice(i));
    if (!m) return '';
    i += m[0].length;
    return m[0];
  };

  const matrix = (depth: number, kind: string): TexNode => {
    const rows: TexNode[][] = [[]];
    for (;;) {
      ws();
      if (i >= text.length) throw new MathParseError('\\begin{' + kind + '} has no \\end');
      if (text.startsWith('\\end', i)) {
        i += 4;
        ws();
        if (peek() === '{') { const close = text.indexOf('}', i); if (close < 0) throw new MathParseError('a { is not closed'); i = close + 1; }
        break;
      }
      const cell = seq(depth + 1);
      rows[rows.length - 1].push(cell);
      ws();
      if (peek() === '&') { i++; continue; }
      if (text.startsWith('\\\\', i)) { i += 2; rows.push([]); continue; }
    }
    if (!rows[rows.length - 1].length) rows.pop();
    if (!rows.length) throw new MathParseError('the matrix is empty');
    const w = rows[0].length;
    if (rows.some((r) => r.length !== w)) throw new MathParseError('every row of the matrix needs the same number of entries');
    if (rows.length > 6 || w > 6) throw new MathParseError('a matrix can have at most 6 rows and 6 columns');
    const br: Bracket = kind === 'pmatrix' ? '(' : kind === 'vmatrix' ? '|' : kind === 'matrix' ? '' : '[';
    return count({ k: 'mat', rows, br }, depth);
  };

  const atom = (depth: number): TexNode => {
    ws();
    if (i >= text.length) throw new MathParseError('the formula ends too early (something is missing after the last symbol)');
    const ch = peek();
    if (ch === '{') return group(depth);
    if (/\d/.test(ch)) {
      const m = /^\d+(?:\.\d+)?/.exec(text.slice(i))!;
      i += m[0].length;
      // 3/4 written plainly becomes a fraction
      const f = /^\/(\d+)(?![\d.])/.exec(text.slice(i));
      if (f && !/\d/.test(text[i - m[0].length - 1] ?? '')) {
        i += f[0].length;
        return count({ k: 'frac', n: { k: 'sym', s: m[0], c: 'num' }, d: { k: 'sym', s: f[1], c: 'num' } }, depth);
      }
      return count({ k: 'sym', s: m[0], c: 'num' }, depth);
    }
    if (/[A-Za-z]/.test(ch)) {
      const rest = text.slice(i);
      for (const fn of FUNCS) if (rest.startsWith(fn) && !/^[A-Za-z]/.test(rest.slice(fn.length))) { i += fn.length; return count({ k: 'sym', s: fn, c: 'fn' }, depth); }
      i++;
      return count({ k: 'sym', s: ch, c: 'var' }, depth);
    }
    if (ch === '√') {
      i++;
      ws();
      if (peek() === '(') {
        // √(x + 1): the bracket is the radicand
        i++;
        const r = seq(depth + 1, true);
        ws();
        if (peek() !== ')') throw new MathParseError('a ( after √ is not closed');
        i++;
        return count({ k: 'sqrt', c: r }, depth);
      }
      return count({ k: 'sqrt', c: atom(depth + 1) }, depth);
    }
    if (ch === '\\') {
      i++;
      if (/[,;:! ]/.test(peek() ?? '')) { i++; return count({ k: 'space', w: 0.2 }, depth); }
      const name = readWord();
      if (!name) {
        const c = text[i++];
        if (c === '{' || c === '}' || c === '%' || c === '$' || c === '&' || c === '#' || c === '_') return count({ k: 'sym', s: c, c: 'other' }, depth);
        throw new MathParseError(`unknown command \\${c ?? ''}`);
      }
      switch (name) {
        case 'frac': case 'dfrac': case 'tfrac': { const n = group(depth + 1); const d = group(depth + 1); return count({ k: 'frac', n, d }, depth); }
        case 'sqrt': {
          ws();
          if (peek() === '[') throw new MathParseError('roots with an index like \\sqrt[3]{x} are not supported; use x^{1/3} or a power');
          return count({ k: 'sqrt', c: group(depth + 1) }, depth);
        }
        case 'text': case 'mathrm': case 'textrm': case 'mbox': {
          ws();
          if (peek() !== '{') throw new MathParseError('\\text needs {words}');
          const close = text.indexOf('}', i);
          if (close < 0) throw new MathParseError('a { is not closed');
          const s = text.slice(i + 1, close);
          i = close + 1;
          return count({ k: 'text', s }, depth);
        }
        case 'vec': case 'overrightarrow': return count({ k: 'vec', c: group(depth + 1) }, depth);
        case 'hat': {
          const g = group(depth + 1);
          if (g.k === 'sym' && HAT[g.s]) return count({ k: 'sym', s: HAT[g.s], c: 'var' }, depth);
          return g;
        }
        case 'color': case 'textcolor': {
          ws();
          if (peek() !== '{') throw new MathParseError('\\color needs {role}');
          const close = text.indexOf('}', i);
          if (close < 0) throw new MathParseError('a { is not closed');
          const role = text.slice(i + 1, close).trim() as Role;
          i = close + 1;
          if (!ROLES.includes(role)) throw new MathParseError(`colour "${role}" is not one of ${ROLES.join(', ')}`);
          return count({ k: 'color', role, c: group(depth + 1) }, depth);
        }
        case 'left': case 'right': {
          ws();
          const c = text[i++];
          if (c === '.' || c === undefined) return count({ k: 'space', w: 0 }, depth);
          if (c === '\\') { readWord(); return count({ k: 'space', w: 0 }, depth); }
          return count({ k: 'sym', s: c, c: classOf(c) }, depth);
        }
        case 'quad': return count({ k: 'space', w: 1 }, depth);
        case 'qquad': return count({ k: 'space', w: 2 }, depth);
        case 'begin': {
          ws();
          if (peek() !== '{') throw new MathParseError('\\begin needs {name}');
          const close = text.indexOf('}', i);
          if (close < 0) throw new MathParseError('a { is not closed');
          const kind = text.slice(i + 1, close);
          i = close + 1;
          if (!['matrix', 'bmatrix', 'pmatrix', 'vmatrix'].includes(kind)) throw new MathParseError(`\\begin{${kind}} is not supported (use matrix, bmatrix, pmatrix or vmatrix)`);
          return matrix(depth, kind);
        }
        default: {
          if (FUNCS.includes(name)) return count({ k: 'sym', s: name, c: 'fn' }, depth);
          const s = SYMBOLS[name];
          if (s) return count({ k: 'sym', s, c: classOf(s) === 'var' ? 'other' : classOf(s) === 'other' ? 'other' : classOf(s) }, depth);
          throw new MathParseError(`unknown command \\${name}`);
        }
      }
    }
    i++;
    const norm = ch === '-' ? '−' : ch === '*' ? '×' : ch;
    return count({ k: 'sym', s: norm, c: classOf(norm) }, depth);
  };

  const tree = seq(0);
  ws();
  if (i < text.length) throw new MathParseError(`unexpected "${text.slice(i, i + 6)}" (a } or & with nothing to close?)`);
  return tree;
}

/** Null when the text is a formula the typesetter can lay out, else the reason it cannot. */
export function mathProblem(src: unknown): string | null {
  if (typeof src !== 'string') return 'the formula must be text';
  try {
    parseMath(src);
    return null;
  } catch (e) {
    return e instanceof MathParseError ? e.message : String((e as Error)?.message ?? e);
  }
}

/** True when the formula has something to typeset beyond a plain line: a fraction, root, power, subscript, vector arrow or matrix. */
export function mathHasStructure(tex: string): boolean {
  const walk = (n: TexNode): boolean => {
    switch (n.k) {
      case 'frac': case 'sqrt': case 'vec': case 'mat': case 'script': return true;
      case 'row': return n.c.some(walk);
      case 'color': return walk(n.c);
      default: return false;
    }
  };
  try {
    return walk(parseMath(tex));
  } catch {
    return false;
  }
}

/* ---------------- layout ---------------- */

export interface Glyph {
  text: string;
  x: number;
  y: number;
  size: number;
  role?: Role;
  weight?: string;
  /** "text@size#n": the n-th glyph with this text and size (used to match symbols between formulas). */
  key: string;
}
export interface Stroke {
  pts: Array<[number, number]>;
  width: number;
}
export interface MathBox {
  /** Width; the formula starts at x = 0. */
  w: number;
  /** Height above and below the maths axis (y = 0, the middle of ordinary text). */
  up: number;
  down: number;
  glyphs: Glyph[];
  strokes: Stroke[];
}

const H = 0.46;
const empty = (): MathBox => ({ w: 0, up: 0, down: 0, glyphs: [], strokes: [] });

function shift(b: MathBox, dx: number, dy: number): { glyphs: Glyph[]; strokes: Stroke[] } {
  return {
    glyphs: b.glyphs.map((g) => ({ ...g, x: g.x + dx, y: g.y + dy })),
    strokes: b.strokes.map((s) => ({ ...s, pts: s.pts.map(([x, y]) => [x + dx, y + dy] as [number, number]) })),
  };
}

function layout(n: TexNode, s: number, role: Role | undefined): MathBox {
  switch (n.k) {
    case 'sym': {
      const wd = tokenWidth(n.s, s);
      return { w: wd, up: H * s, down: H * s, glyphs: [{ text: n.s, x: wd / 2, y: 0, size: s, role, key: '' }], strokes: [] };
    }
    case 'text': {
      const wd = tokenWidth(n.s, s * 0.9);
      return { w: wd, up: H * s, down: H * s, glyphs: [{ text: n.s, x: wd / 2, y: 0, size: s * 0.9, role, key: '' }], strokes: [] };
    }
    case 'space': return { ...empty(), w: n.w * s * 0.5, up: 0, down: 0 };
    case 'color': return layout(n.c, s, n.role);
    case 'row': {
      const kids = n.c;
      let x = 0;
      let up = 0;
      let down = 0;
      const glyphs: Glyph[] = [];
      const strokes: Stroke[] = [];
      kids.forEach((k, idx) => {
        const prev = kids[idx - 1];
        const next = kids[idx + 1];
        const cls = k.k === 'sym' ? k.c : undefined;
        const prevCls = prev && prev.k === 'sym' ? prev.c : undefined;
        const unary = cls === 'op' && (k as { s: string }).s !== '·' && (idx === 0 || prevCls === 'op' || prevCls === 'rel' || prevCls === 'open' || prevCls === 'punct');
        let padL = 0;
        let padR = 0;
        if (cls === 'rel') { padL = 0.3 * s; padR = 0.3 * s; }
        else if (cls === 'op' && !unary) { padL = 0.2 * s; padR = 0.2 * s; }
        else if (cls === 'punct') padR = 0.14 * s;
        else if (cls === 'fn' && next && !(next.k === 'sym' && next.c === 'open')) padR = 0.1 * s;
        else if (prev && ((prev.k === 'sym' && prev.c === 'num' && cls === 'var') || (prev.k === 'sym' && prev.c === 'var' && cls === 'var'))) padL = 0.03 * s;
        if (k.k === 'mat') { padL = Math.max(padL, 0.14 * s); padR = Math.max(padR, 0.14 * s); }
        x += padL;
        const b = layout(k, s, role);
        const sh = shift(b, x, 0);
        glyphs.push(...sh.glyphs);
        strokes.push(...sh.strokes);
        up = Math.max(up, b.up);
        down = Math.max(down, b.down);
        x += b.w + padR;
      });
      return { w: x, up, down, glyphs, strokes };
    }
    case 'frac': {
      const sn = s * 0.82;
      const a = layout(n.n, sn, role);
      const d = layout(n.d, sn, role);
      const w = Math.max(a.w, d.w) + 0.36 * s;
      const g = 0.15 * s;
      const sa = shift(a, (w - a.w) / 2, -(g + a.down));
      const sd = shift(d, (w - d.w) / 2, g + d.up);
      return {
        w,
        up: g + a.down + a.up,
        down: g + d.up + d.down,
        glyphs: [...sa.glyphs, ...sd.glyphs],
        strokes: [{ pts: [[0.06 * s, 0], [w - 0.06 * s, 0]], width: Math.max(2, 0.07 * s) }, ...sa.strokes, ...sd.strokes],
      };
    }
    case 'script': {
      const b = layout(n.b, s, role);
      const ss = s * 0.64;
      const sup = n.sup ? layout(n.sup, ss, role) : null;
      const sub = n.sub ? layout(n.sub, ss, role) : null;
      const x = b.w + 0.04 * s;
      const glyphs = [...b.glyphs];
      const strokes = [...b.strokes];
      let up = b.up;
      let down = b.down;
      let w = b.w;
      if (sup) {
        const dy = -(b.up * 0.9 - sup.down * 0.15);
        const sh = shift(sup, x, dy);
        glyphs.push(...sh.glyphs);
        strokes.push(...sh.strokes);
        up = Math.max(up, -dy + sup.up);
        w = Math.max(w, x + sup.w);
      }
      if (sub) {
        const dy = b.down * 0.55 + sub.up * 0.35;
        const sh = shift(sub, x, dy);
        glyphs.push(...sh.glyphs);
        strokes.push(...sh.strokes);
        down = Math.max(down, dy + sub.down);
        w = Math.max(w, x + sub.w);
      }
      return { w: w + 0.02 * s, up, down, glyphs, strokes };
    }
    case 'sqrt': {
      const c = layout(n.c, s, role);
      const top = -(c.up + 0.12 * s);
      const bottom = c.down + 0.06 * s;
      const mid = (top + bottom) / 2;
      const left = 0.62 * s;
      const sh = shift(c, left, 0);
      return {
        w: left + c.w + 0.12 * s,
        up: -top + 0.06 * s,
        down: bottom,
        glyphs: sh.glyphs,
        strokes: [
          { pts: [[0.02 * s, mid + 0.1 * s], [0.15 * s, mid + 0.02 * s], [0.31 * s, bottom], [0.55 * s, top], [left + c.w + 0.1 * s, top]], width: Math.max(2, 0.06 * s) },
          ...sh.strokes,
        ],
      };
    }
    case 'vec': {
      const c = layout(n.c, s, role);
      const y = -(c.up + 0.03 * s);
      const x0 = 0.08 * s;
      const x1 = Math.max(x0 + 0.3 * s, c.w - 0.04 * s);
      const h = 0.09 * s;
      return {
        ...c,
        up: c.up + 0.14 * s,
        strokes: [...c.strokes, { pts: [[x0, y], [x1, y]], width: Math.max(1.6, 0.05 * s) }, { pts: [[x1 - h, y - h], [x1, y], [x1 - h, y + h]], width: Math.max(1.6, 0.05 * s) }],
      };
    }
    case 'mat': {
      const rows = n.rows.map((r) => r.map((c) => layout(c, s, role)));
      const nr = rows.length;
      const nc = rows[0].length;
      const colW = Array.from({ length: nc }, (_, j) => Math.max(...rows.map((r) => r[j].w)));
      const rowUp = rows.map((r) => Math.max(H * s, ...r.map((c) => c.up)));
      const rowDown = rows.map((r) => Math.max(H * s, ...r.map((c) => c.down)));
      const rowGap = 0.3 * s;
      const colGap = 0.7 * s;
      const totalH = rowUp.reduce((a, b) => a + b, 0) + rowDown.reduce((a, b) => a + b, 0) + rowGap * (nr - 1);
      const innerW = colW.reduce((a, b) => a + b, 0) + colGap * (nc - 1);
      const pad = n.br ? 0.3 * s : 0;
      const glyphs: Glyph[] = [];
      const strokes: Stroke[] = [];
      let y = -totalH / 2;
      rows.forEach((r, i) => {
        const cy = y + rowUp[i];
        let x = pad;
        r.forEach((c, j) => {
          const sh = shift(c, x + (colW[j] - c.w) / 2, cy);
          glyphs.push(...sh.glyphs);
          strokes.push(...sh.strokes);
          x += colW[j] + colGap;
        });
        y += rowUp[i] + rowDown[i] + rowGap;
      });
      const top = -totalH / 2 - 0.08 * s;
      const bot = totalH / 2 + 0.08 * s;
      const w = innerW + pad * 2;
      const wBr = Math.max(1.8, 0.06 * s);
      const arm = 0.17 * s;
      if (n.br === '[') {
        strokes.push({ pts: [[arm, top], [0.02 * s, top], [0.02 * s, bot], [arm, bot]], width: wBr });
        strokes.push({ pts: [[w - arm, top], [w - 0.02 * s, top], [w - 0.02 * s, bot], [w - arm, bot]], width: wBr });
      } else if (n.br === '(') {
        const arc = (sign: 1 | -1) => Array.from({ length: 11 }, (_, k) => {
          const u = (k / 10) * 2 - 1;
          const bx = sign === 1 ? 0.03 * s : w - 0.03 * s;
          return [bx + sign * 0.17 * s * u * u, (top + bot) / 2 + (u * (bot - top)) / 2] as [number, number];
        });
        strokes.push({ pts: arc(1), width: wBr }, { pts: arc(-1), width: wBr });
      } else if (n.br === '|') {
        strokes.push({ pts: [[0.06 * s, top], [0.06 * s, bot]], width: wBr }, { pts: [[w - 0.06 * s, top], [w - 0.06 * s, bot]], width: wBr });
      }
      return { w, up: totalH / 2 + 0.1 * s, down: totalH / 2 + 0.1 * s, glyphs, strokes };
    }
  }
}

export interface MathLayout extends MathBox {
  /** The size used (may be smaller than asked when the formula had to fit a width). */
  size: number;
}

/** Lays the formula out at `size`; when `maxWidth` is given the size shrinks until it fits. */
export function layoutMath(tex: string | TexNode, size: number, maxWidth?: number): MathLayout {
  const tree = typeof tex === 'string' ? parseMath(tex) : tex;
  let s = size;
  let box = layout(tree, s, undefined);
  for (let k = 0; k < 4 && maxWidth && box.w > maxWidth && s > 10; k++) {
    s = Math.max(10, (s * maxWidth) / box.w - 0.2);
    box = layout(tree, s, undefined);
  }
  // keys: n-th glyph with the same text and size
  const seen = new Map<string, number>();
  const glyphs = box.glyphs.map((g) => {
    const base = `${g.text}@${Math.round(g.size)}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return { ...g, key: `${base}#${n}` };
  });
  return { ...box, glyphs, size: s };
}

/* ---------------- on the board ---------------- */

export interface MathItem {
  id: string;
  text: string;
  key: string;
  x: number;
  y: number;
  size: number;
  color: Role | string;
}
export interface MathHandle {
  glyphs: MathItem[];
  strokes: string[];
  /** Where the formula's centre (on its axis) is. */
  cx: number;
  cy: number;
  w: number;
  up: number;
  down: number;
  size: number;
}

export interface PlaceOpts {
  size?: number;
  color?: Role | string;
  /** Roles by glyph text, e.g. { x: 'a', y: 'b' } (a \color inside the formula wins). */
  colors?: Record<string, Role>;
  maxWidth?: number;
  align?: 'center' | 'left';
  z?: number;
}

export const mathIds = (h: MathHandle): string[] => [...h.glyphs.map((g) => g.id), ...h.strokes];
/** Left edge, right edge, top and bottom of the formula (design units). */
export const mathBox = (h: MathHandle) => ({ x0: h.cx - h.w / 2, x1: h.cx + h.w / 2, y0: h.cy - h.up, y1: h.cy + h.down });
/** The glyph ids whose text is one of `texts` (e.g. every "x"). */
export const mathGlyphs = (h: MathHandle, texts: string[]): string[] => h.glyphs.filter((g) => texts.includes(g.text)).map((g) => g.id);

function colorFor(g: Glyph, o: PlaceOpts): Role | string {
  return g.role ?? o.colors?.[g.text] ?? o.color ?? 'ink';
}

/** Creates the formula's items at time t: glyphs hidden (show them with appear / write), strokes drawn by pen from t. */
export function placeMath(m: Motion, prefix: string, tex: string | TexNode, cx: number, cy: number, t: number, o: PlaceOpts = {}): MathHandle {
  const L = layoutMath(tex, o.size ?? 40, o.maxWidth);
  const left = o.align === 'left' ? cx : cx - L.w / 2;
  const centre = left + L.w / 2;
  const glyphs: MathItem[] = L.glyphs.map((g, i) => {
    const id = `${prefix}_g${i}`;
    const x = left + g.x;
    const y = cy + g.y;
    const color = colorFor(g, o);
    m.text(id, g.text, x, y, { size: g.size, color, z: o.z ?? 5 });
    return { id, text: g.text, key: g.key, x, y, size: g.size, color };
  });
  const strokes = L.strokes.map((st, i) => {
    const id = `${prefix}_s${i}`;
    m.poly(id, st.pts.map(([x, y]) => [left + x, cy + y] as [number, number]), t, { color: o.color ?? 'ink', closed: false, width: st.width, dur: 450, z: o.z ?? 5, silent: true });
    return id;
  });
  return { glyphs, strokes, cx: centre, cy, w: L.w, up: L.up, down: L.down, size: L.size };
}

/** Places the formula and writes it; returns the handle and the time it is finished. */
export function showMath(m: Motion, prefix: string, tex: string | TexNode, cx: number, cy: number, t: number, o: PlaceOpts = {}): { h: MathHandle; end: number } {
  const h = placeMath(m, prefix, tex, cx, cy, t, o);
  const end = Math.max(m.appear(h.glyphs.map((g) => g.id), t, 40, false), t + (h.strokes.length ? 450 : 0));
  return { h, end };
}

/**
 * Turns `prev` into the formula `tex`: symbols that are in both (same text, same size, in order) glide to
 * their new places, the others fade out, new ones appear, strokes (bars, roots, brackets) are redrawn.
 * `cx`/`cy` default to where the old formula was.
 */
export function becomeMath(m: Motion, prev: MathHandle, prefix: string, tex: string | TexNode, t: number, o: PlaceOpts & { cx?: number; cy?: number; dur?: number } = {}): { h: MathHandle; end: number; kept: number } {
  const L = layoutMath(tex, o.size ?? prev.size, o.maxWidth);
  const cx = o.cx ?? prev.cx;
  const cy = o.cy ?? prev.cy;
  const left = o.align === 'left' ? cx : cx - L.w / 2;
  const dur = o.dur ?? 950;
  const free = new Map<string, MathItem[]>();
  for (const g of prev.glyphs) free.set(g.key.replace(/#\d+$/, ''), [...(free.get(g.key.replace(/#\d+$/, '')) ?? []), g]);
  const used = new Set<string>();
  const out: MathItem[] = [];
  const created: string[] = [];
  let kept = 0;
  L.glyphs.forEach((g, i) => {
    const x = left + g.x;
    const y = cy + g.y;
    const color = colorFor(g, o);
    const pool = free.get(g.key.replace(/#\d+$/, ''));
    const hit = pool?.shift();
    if (hit) {
      used.add(hit.id);
      kept++;
      m.move(hit.id, x, y, t, { dur, sound: false });
      if (hit.color !== color) m.recolor(hit.id, color, t, 500);
      out.push({ ...hit, x, y, key: g.key, color });
    } else {
      const id = `${prefix}_g${i}`;
      m.text(id, g.text, x, y, { size: g.size, color, z: o.z ?? 5 });
      created.push(id);
      out.push({ id, text: g.text, key: g.key, x, y, size: g.size, color });
    }
  });
  const gone = prev.glyphs.filter((g) => !used.has(g.id)).map((g) => g.id);
  if (gone.length || prev.strokes.length) m.fadeOut([...gone, ...prev.strokes], t, 350);
  let end = t + dur;
  if (created.length) end = Math.max(end, m.appear(created, t + dur * 0.7, STAGGER_TEXT, false));
  const strokes = L.strokes.map((st, i) => {
    const id = `${prefix}_s${i}`;
    m.poly(id, st.pts.map(([x, y]) => [left + x, cy + y] as [number, number]), t + dur * 0.6, { color: o.color ?? 'ink', closed: false, width: st.width, dur: 450, z: o.z ?? 5, silent: true });
    end = Math.max(end, t + dur * 0.6 + 450);
    return id;
  });
  return { h: { glyphs: out, strokes, cx: left + L.w / 2, cy, w: L.w, up: L.up, down: L.down, size: L.size }, end, kept };
}
