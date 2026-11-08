/**
 * Shared column-arithmetic building blocks: place-value grid, writing numbers
 * digit-by-digit, and the column-addition routine (also used to add the partial
 * rows of long multiplication).
 */

import { DUR, type Role } from '../grammar';
import type { Motion } from '../engine';
import { placeName, say, type Lang } from '../captions';

export interface Grid {
  /** x of the ones column. */
  right: number;
  /** Column width. */
  cw: number;
  /** Digit font size. */
  size: number;
}

export const colX = (g: Grid, c: number) => g.right - c * g.cw;

/** Digits, ones first. */
export function digitsOf(n: number): number[] {
  return String(Math.abs(Math.trunc(n)))
    .split('')
    .reverse()
    .map(Number);
}

/** Centre a block of `cols` columns (plus an operator column) on the 720 board. */
export function centredGrid(cols: number, size = 64, cw = 52, cx = 360): Grid {
  const blockW = (cols + 1) * cw; // +1 for the operator column
  return { right: cx + blockW / 2 - cw / 2, cw, size };
}

/** Creates hidden digit items for `n` (ids by column, ones = index 0). */
export function numberItems(
  m: Motion,
  prefix: string,
  n: number,
  y: number,
  g: Grid,
  color: Role | string,
  shift = 0,
): string[] {
  const ids: string[] = [];
  digitsOf(n).forEach((d, c) => {
    ids[c + shift] = m.text(`${prefix}${c + shift}`, String(d), colX(g, c + shift), y, { size: g.size, color });
  });
  return ids;
}

/** Ids from most significant to least (natural reading / writing order). */
export const leftToRight = (ids: (string | undefined)[]) => ids.filter((x): x is string => !!x).reverse();

export interface ColumnAddInput {
  rows: (string | undefined)[][];
  values: (number | undefined)[][];
  grid: Grid;
  carryY: number;
  resultY: number;
  t: number;
  lang: Lang;
  prefix: string;
  /** Scale of carry digits in the carry row. */
  carryScale?: number;
}

export interface ColumnAddResult {
  t: number;
  ids: string[];
  value: number;
}

/**
 * Column addition, right to left. For each column: focus the digits (and any carry),
 * chalk copies fly down and MERGE into the column sum; if the sum has two digits the
 * tens digit HOPS up into the carry row of the next column, shrinking as it goes.
 */
export function columnAdd(m: Motion, inp: ColumnAddInput): ColumnAddResult {
  const { rows, values, grid: g, lang } = inp;
  let t = inp.t;
  const ncol = Math.max(...rows.map((r) => r.length));
  const ids: string[] = [];
  let carry = 0;
  let carryId: string | undefined;
  let value = 0;

  for (let c = 0; c < ncol; c++) {
    const src = rows.map((r) => r[c]).filter((x): x is string => !!x);
    const vals = values.map((v) => v[c]).filter((x): x is number => x !== undefined);
    if (!src.length && !carry) continue;
    const sum = vals.reduce((a, b) => a + b, 0) + carry;
    const terms = [...(carry ? [carry] : []), ...vals];
    const expr = terms.length > 1 ? `${terms.join(' + ')} = ${sum}` : `${sum}`;

    t = m.step(say(lang, 'add.col', { place: placeName(lang, c), sum: expr }), t);
    const focusIds = [...src, ...(carryId ? [carryId] : [])];
    t = m.focus(focusIds, t) + DUR.beat;

    const clones = src.map((id) => m.clone(id, m.uid(`${inp.prefix}cp`), t));
    const unitsId = m.text(`${inp.prefix}r${c}`, String(sum % 10), colX(g, c), inp.resultY, { size: g.size, color: 'result' });
    const isLast = c === ncol - 1;
    let tensId: string | undefined;
    if (sum >= 10) {
      tensId = m.text(`${inp.prefix}r${c + 1}${isLast ? '' : 'c'}`, String(Math.floor(sum / 10)), colX(g, c + 1), inp.resultY, {
        size: g.size,
        color: isLast ? 'result' : 'carry',
      });
    }
    const flyers = [...clones, ...(carryId ? [carryId] : [])];
    const mx = sum >= 10 ? colX(g, c) - g.cw / 2 : colX(g, c);
    t = m.merge(flyers, tensId ? [unitsId, tensId] : unitsId, mx, inp.resultY, t);
    m.unfocus(focusIds, t);
    m.dim(src, t);
    ids[c] = unitsId;
    value += (sum % 10) * 10 ** c;

    if (tensId && !isLast) {
      const nextC = c + 1;
      t = m.step(say(lang, 'add.carry', { digit: sum % 10, carry: Math.floor(sum / 10), next: placeName(lang, nextC) }), t + DUR.beat);
      m.resize(tensId, inp.carryScale ?? 0.6, t);
      t = m.hop(tensId, colX(g, nextC), inp.carryY, t, 70);
      carry = Math.floor(sum / 10);
      carryId = tensId;
    } else {
      if (tensId) {
        ids[c + 1] = tensId;
        value += Math.floor(sum / 10) * 10 ** (c + 1);
      }
      carry = 0;
      carryId = undefined;
    }
    t += DUR.beat * 2;
    m.hold(t);
  }

  if (carry && carryId) {
    // A carry left over after the last column drops into the answer.
    const c = ncol;
    t = m.step(say(lang, 'add.lastCarry', { carry }), t);
    m.resize(carryId, 1, t);
    m.recolor(carryId, 'result', t);
    t = m.move(carryId, colX(g, c), inp.resultY, t);
    ids[c] = carryId;
    value += carry * 10 ** c;
    t += DUR.beat * 2;
  }
  return { t, ids, value };
}

/** Box + tick around a finished answer row. */
export function celebrate(m: Motion, ids: string[], g: Grid, y: number, t: number, prefix: string): number {
  const xs = ids.filter(Boolean).map((id) => m.pos(id, t).x);
  const x0 = Math.min(...xs) - g.cw * 0.6;
  const x1 = Math.max(...xs) + g.cw * 0.6;
  m.recolor(ids.filter(Boolean), 'result', t);
  for (const id of ids.filter(Boolean)) m.focus(id, t, true);
  let e = m.box(`${prefix}box`, (x0 + x1) / 2, y, x1 - x0, g.size * 1.35, t + 200);
  e = m.tick(`${prefix}tick`, x1 + 40, y, e - 200);
  m.unfocus(ids.filter(Boolean), e + 400);
  return e;
}
