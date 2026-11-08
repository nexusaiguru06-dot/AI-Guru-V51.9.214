/**
 * Text measurement + "rich" maths text (superscripts, simple fractions).
 *
 * The engine lays out at BUILD time, so it needs widths before any canvas exists.
 * The browser installs a canvas-based measurer automatically; Node/tests install
 * one from @napi-rs/canvas. Without one, a calibrated serif width table is used,
 * so layout is deterministic everywhere.
 */

import { FONT } from './grammar';

export type Measurer = (text: string, px: number, weight?: string) => number;

/** Advance widths (em) for a typical serif face, used only as a fallback. */
const EM: Record<string, number> = {
  '0': 0.6, '1': 0.6, '2': 0.6, '3': 0.6, '4': 0.6, '5': 0.6, '6': 0.6, '7': 0.6, '8': 0.6, '9': 0.6,
  '+': 0.75, '−': 0.75, '-': 0.4, '×': 0.75, '÷': 0.75, '=': 0.75, '(': 0.38, ')': 0.38,
  ' ': 0.3, '.': 0.3, ',': 0.3, '/': 0.4, 'x': 0.55, 'y': 0.55, 'π': 0.62, '√': 0.62, '²': 0.4, '³': 0.4,
};

let measurer: Measurer | null = null;

export function setMeasurer(m: Measurer | null): void {
  measurer = m;
}

function browserMeasurer(): Measurer | null {
  if (typeof document === 'undefined') return null;
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return null;
  return (text, px, weight = '400') => {
    ctx.font = `${weight} ${px}px ${FONT.math}`;
    return ctx.measureText(text).width;
  };
}

/** Like measure, but counts leading and trailing spaces (some canvas back-ends drop them). */
export function measureSpaced(text: string, px: number, weight = '400'): number {
  if (text === text.trim()) return measure(text, px, weight);
  return measure(`|${text}|`, px, weight) - measure('||', px, weight);
}

export function measure(text: string, px: number, weight = '400'): number {
  if (!measurer) measurer = browserMeasurer();
  if (measurer) return measurer(text, px, weight);
  let em = 0;
  for (const ch of text) em += EM[ch] ?? 0.62;
  return em * px;
}

/* ---------------- rich maths text ---------------- */

export interface Run {
  text: string;
  sup: boolean;
  /** Subscript: "a_{12}", "a_12". */
  sub?: boolean;
  /** Square root: "√3", "√{x+1}". `text` is the radicand; the radical sign is drawn as a shape. */
  rad?: boolean;
  /** A drawn symbol the board font lacks: ∪ ∩ ∅ ∈ (V51.9.26). `text` is the symbol itself. */
  sym?: boolean;
}

/** Symbols drawn as shapes (the board font has no glyph for them). */
export const DRAWN_SYMBOLS = '∪∩∅∈';
/** Width of a drawn symbol, in em. */
export const SYM_WIDTH = 0.72;

/** Width of the drawn radical sign, in em (the board font has no √ glyph). */
export const RAD_SIGN = 0.58;
/** Width of one run at font size px. */
export function runWidth(r: Run, px: number, weight = '400'): number {
  if (r.sym) return px * SYM_WIDTH;
  if (r.rad) return measure(r.text, px, weight) + px * RAD_SIGN + px * 0.16;
  return measureSpaced(r.text, r.sup || r.sub ? px * SUP_SCALE : px, weight);
}

/** "x^2", "2^{3+4}", "a_{12}", "a_12" → runs. Everything else is plain text. */
export function richRuns(src: string): Run[] {
  const runs: Run[] = [];
  let buf = '';
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (DRAWN_SYMBOLS.includes(ch)) {
      if (buf) runs.push({ text: buf, sup: false });
      buf = '';
      runs.push({ text: ch, sup: false, sym: true });
    } else if (ch === '√') {
      if (buf) runs.push({ text: buf, sup: false });
      buf = '';
      let rad = '';
      if (src[i + 1] === '{') {
        const end = src.indexOf('}', i + 2);
        const stop = end < 0 ? src.length : end;
        rad = src.slice(i + 2, stop);
        i = stop;
      } else {
        let j = i + 1;
        while (j < src.length && /[0-9a-zA-Z]/.test(src[j])) j++;
        rad = src.slice(i + 1, j);
        i = j - 1;
      }
      runs.push({ text: rad, sup: false, rad: true });
    } else if (ch === '_' && i > 0 && /[A-Za-z0-9)]/.test(src[i - 1]) && (src[i + 1] === '{' || /[0-9a-zA-Z]/.test(src[i + 1] ?? ''))) {
      if (buf) runs.push({ text: buf, sup: false });
      buf = '';
      let sub = '';
      if (src[i + 1] === '{') {
        const end = src.indexOf('}', i + 2);
        const stop = end < 0 ? src.length : end;
        sub = src.slice(i + 2, stop);
        i = stop;
      } else {
        let j = i + 1;
        while (j < src.length && /[0-9a-zA-Z]/.test(src[j])) j++;
        sub = src.slice(i + 1, j);
        i = j - 1;
      }
      runs.push({ text: sub, sup: false, sub: true });
    } else if (ch === '^') {
      if (buf) runs.push({ text: buf, sup: false });
      buf = '';
      let sup = '';
      if (src[i + 1] === '{') {
        const end = src.indexOf('}', i + 2);
        const stop = end < 0 ? src.length : end;
        sup = src.slice(i + 2, stop);
        i = stop;
      } else {
        let j = i + 1;
        while (j < src.length && /[0-9a-zA-Z]/.test(src[j])) j++;
        sup = src.slice(i + 1, j);
        i = j - 1;
      }
      runs.push({ text: sup, sup: true });
    } else {
      buf += ch;
    }
  }
  if (buf) runs.push({ text: buf, sup: false });
  return runs;
}

export const SUP_SCALE = 0.6;

export function richWidth(src: string, px: number, weight = '400'): number {
  return richRuns(src).reduce((w, r) => w + runWidth(r, px, weight), 0);
}

/** A fraction token is written "a/b" inside braces: "{3/4}" or "{x+1/2}" (last slash splits). */
export function parseFrac(src: string): { num: string; den: string } | null {
  if (!(src.startsWith('{') && src.endsWith('}'))) return null;
  const body = src.slice(1, -1);
  const k = body.lastIndexOf('/');
  if (k <= 0) return null;
  return { num: body.slice(0, k), den: body.slice(k + 1) };
}

export const FRAC_SCALE = 0.8;

/** Width of any token: plain, rich (superscripts) or fraction. */
export function tokenWidth(src: string, px: number, weight = '400'): number {
  const f = parseFrac(src);
  if (f) {
    const s = px * FRAC_SCALE;
    return Math.max(richWidth(f.num, s, weight), richWidth(f.den, s, weight)) + px * 0.2;
  }
  return richWidth(src, px, weight);
}
