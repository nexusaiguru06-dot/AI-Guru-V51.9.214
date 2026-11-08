/**
 * Formula, term by term (V51.9.51): the whole formula is written, then dimmed; each part lights up in its
 * own colour with a brace underneath and a label that says what the part MEANS. At the end everything
 * comes back, now colour-coded, so the viewer can "read" the formula. (Pattern from the 3brown1blue
 * rules, MIT; written fresh for this engine.)
 *
 * A part is named by a piece of the formula (LaTeX-like text, e.g. "a + b"); the app finds that run of
 * symbols inside the formula, so a part can never point at something that is not there.
 */

import type { Motion } from './engine';
import type { Role } from './grammar';
import { tokenWidth } from './metrics';
import { layoutMath, type MathHandle } from './typeset';

export const PART_ROLES: Role[] = ['a', 'b', 'c', 'carry', 'result'];
export const MAX_PARTS = 5;

/** Glyph texts of a formula as the typesetter lays it out (reading order). */
export function glyphTexts(tex: string, size = 40): string[] {
  return layoutMath(tex, size).glyphs.map((g) => g.text);
}

/** Index range [from, to) of the first run of `part` inside `whole` at or after `start`, or null. */
export function findRun(whole: string[], part: string[], start = 0): [number, number] | null {
  if (!part.length) return null;
  for (let i = start; i + part.length <= whole.length; i++) {
    let ok = true;
    for (let k = 0; k < part.length && ok; k++) if (whole[i + k] !== part[k]) ok = false;
    if (ok) return [i, i + part.length];
  }
  return null;
}

/**
 * Where each part sits in the formula (glyph index ranges), in the given order, without overlaps.
 * Returns a sentence for the first part that cannot be found, or that overlaps an earlier one.
 */
export function locateParts(tex: string, parts: Array<{ match: string }>): { ranges: Array<[number, number]> } | { error: string } {
  let whole: string[];
  try {
    whole = glyphTexts(tex);
  } catch (e) {
    return { error: `the formula does not typeset (${(e as Error).message})` };
  }
  const ranges: Array<[number, number]> = [];
  for (const [i, p] of parts.entries()) {
    let want: string[];
    try {
      want = glyphTexts(p.match);
    } catch (e) {
      return { error: `part ${i + 1} "${p.match}" does not typeset (${(e as Error).message})` };
    }
    // the first occurrence that does not overlap a part already placed
    let r: [number, number] | null = null;
    for (let from = 0; ; ) {
      r = findRun(whole, want, from);
      if (!r) break;
      const clash = ranges.some(([a, b]) => r![0] < b && a < r![1]);
      if (!clash) break;
      from = r[0] + 1;
    }
    if (!r) return { error: `part ${i + 1} "${p.match}" is not in the formula (write it exactly as it appears there)` };
    ranges.push(r);
  }
  return { ranges };
}

/** A curly brace under [x0, x1] at height y, opening downwards, drawn by pen. */
export function braceUnder(m: Motion, id: string, x0: number, x1: number, y: number, t: number, color: Role | string, depth = 12): number {
  const mid = (x0 + x1) / 2;
  const q = depth / 2;
  const pts: Array<[number, number]> = [
    [x0, y],
    [x0 + 3, y + q],
    [mid - 6, y + q],
    [mid, y + depth],
    [mid + 6, y + q],
    [x1 - 3, y + q],
    [x1, y],
  ];
  return m.poly(id, pts, t, { color, closed: false, width: 3, dur: 380, silent: true, z: 4 });
}

export interface DecomposePart {
  /** Range of glyph indexes in the formula (from locateParts). */
  range: [number, number];
  label: string;
  /** Caption spoken while the part is shown (defaults to the label). */
  say?: string;
}

/** Horizontal extent of glyphs [a, b) of a handle. */
function extent(h: MathHandle, [a, b]: [number, number]) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const g of h.glyphs.slice(a, b)) {
    const w = tokenWidth(g.text, g.size) / 2;
    x0 = Math.min(x0, g.x - w);
    x1 = Math.max(x1, g.x + w);
    y1 = Math.max(y1, g.y + g.size * 0.45);
  }
  return { x0, x1, y1 };
}

/** Rows for the labels so that no two labels overlap (each label on the first row where it fits). */
export function labelRows(spans: Array<{ cx: number; w: number }>, gap = 14): number[] {
  const rows: Array<Array<[number, number]>> = [];
  return spans.map((s) => {
    const a = s.cx - s.w / 2;
    const b = s.cx + s.w / 2;
    let r = 0;
    while (rows[r]?.some(([x, y]) => a < y + gap && x < b + gap)) r++;
    (rows[r] ??= []).push([a, b]);
    return r;
  });
}

export const LABEL_SIZE = 22;
export const LABEL_ROW = 30;

/**
 * Plays the term-by-term reading of a formula that is already on the board. One caption step per part.
 * Returns the time it ends.
 */
export function decomposeMath(m: Motion, prefix: string, h: MathHandle, parts: DecomposePart[], t: number, o: { boardW?: number } = {}): number {
  const all = h.glyphs.map((g) => g.id);
  const boardW = o.boardW ?? 720;
  t = m.dim([...all, ...h.strokes], t, 450) + 250;
  const ext = parts.map((p) => extent(h, p.range));
  // under the symbols, and under the box the rule is framed in afterwards (it reaches cy + down + 14)
  const braceY = Math.max(Math.max(...ext.map((e) => e.y1)) + 8, h.cy + h.down + 20);
  const widths = parts.map((p) => tokenWidth(p.label, LABEL_SIZE));
  const spans = ext.map((e, i) => {
    const cx = Math.max(widths[i] / 2 + 6, Math.min(boardW - widths[i] / 2 - 6, (e.x0 + e.x1) / 2));
    return { cx, w: widths[i] };
  });
  const rows = labelRows(spans);
  parts.forEach((p, i) => {
    const role = PART_ROLES[i % PART_ROLES.length];
    t = m.step(p.say || p.label, t, 2200);
    const ids = h.glyphs.slice(p.range[0], p.range[1]).map((g) => g.id);
    m.undim(ids, t);
    m.recolor(ids, role, t);
    t = m.focus(ids, t + 50) + 100;
    m.unfocus(ids, t + 400);
    const e = ext[i];
    t = braceUnder(m, `${prefix}_br${i}`, e.x0 - 2, e.x1 + 2, braceY, t, role) + 80;
    const ly = braceY + 12 + 18 + rows[i] * LABEL_ROW;
    m.text(`${prefix}_lb${i}`, p.label, spans[i].cx, ly, { size: LABEL_SIZE, color: role, z: 6 });
    t = m.write([`${prefix}_lb${i}`], t) + 250;
    m.hold(t);
  });
  // Everything back: the formula is now colour-coded.
  t = m.undim([...all, ...h.strokes], t + 200) + 300;
  return t;
}
