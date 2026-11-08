/**
 * MULTIPLICATION — long multiplication with carries and partial rows.
 *
 *  focus ........ the multiplier digit in use stays lit for its whole pass; each
 *                 multiplicand digit lights up with it, plus the waiting carry
 *  colour ....... multiplicand red, multiplier purple, carries orange, products
 *                 indigo, placeholder zeros grey, finished digits fade to "done"
 *  movement ..... copies of the two digits (and the carry) fly into the product slot;
 *                 the tens of the product hops up into the carry row
 *  transformation the two digits MERGE into their product; the carry is swallowed
 *                 into the next product; partial rows are then added by the shared
 *                 column-addition routine (same motion as the addition reels)
 */

import { DUR } from '../grammar';
import { Motion, type MotionScene } from '../engine';
import { placeName, say, type Lang } from '../captions';
import { celebrate, centredGrid, colX, columnAdd, digitsOf, leftToRight, numberItems } from './column';

export function buildMultiplication(a: number, b: number, lang: Lang = 'en'): MotionScene {
  if (![a, b].every((n) => Number.isInteger(n) && n >= 0)) throw new Error('multiplication: whole numbers only');
  const product = a * b;
  const expr = `${a} × ${b}`;
  const ad = digitsOf(a);
  const bd = digitsOf(b);
  const multi = bd.length > 1;
  const cols = Math.max(digitsOf(product).length, ad.length, bd.length);
  const g = centredGrid(cols);

  const carryY = 52;
  const aY = 120;
  const bY = aY + 78;
  const rule1Y = bY + 46;
  const addCarryY = rule1Y + 26;
  const pY = (j: number) => rule1Y + (multi ? 82 : 52) + j * 76;
  const rule2Y = pY(bd.length - 1) + 46;
  const finalY = rule2Y + 52;
  const m = new Motion(`${expr} = ?`, 720, (multi ? finalY : pY(0)) + 70);

  let t = 300;
  t = m.step(say(lang, 'mul.setup'), t);
  const aIds = numberItems(m, 'a', a, aY, g, 'a');
  const bIds = numberItems(m, 'b', b, bY, g, 'b');
  t = m.appear(leftToRight(aIds), t, 110) + 120;
  t = m.appear(leftToRight(bIds), t, 110) + 120;
  const opX = colX(g, cols);
  m.text('op', '×', opX, bY, { size: g.size });
  t = m.appear('op', t);
  t = m.rule('rule1', opX - g.cw * 0.4, rule1Y, colX(g, 0) + g.cw * 0.6, rule1Y, t) + DUR.beat * 2;

  const partialIds: string[][] = [];
  const partialVals: number[][] = [];

  bd.forEach((d, j) => {
    const row: string[] = [];
    const vals: number[] = [];
    t = m.step(say(lang, 'mul.by', { a, place: placeName(lang, j), d }), t);
    m.undim(bIds[j], t);
    t = m.focus(bIds[j], t) + DUR.beat;
    if (j > 0) {
      t = m.step(say(lang, 'mul.zero', { place: placeName(lang, j), n: '0'.repeat(j) }), t);
      const zs: string[] = [];
      for (let z = 0; z < j; z++) {
        row[z] = m.text(`p${j}_${z}`, '0', colX(g, z), pY(j), { size: g.size, color: '#8f8aa8' });
        vals[z] = 0;
        zs.push(row[z]);
      }
      t = m.appear(zs.reverse(), t, 120) + DUR.beat;
    }

    let carry = 0;
    let carryId: string | undefined;
    ad.forEach((x, i) => {
      const pp = x * d;
      const p = pp + carry;
      const col = i + j;
      const last = i === ad.length - 1;
      t = m.step(
        carry ? say(lang, 'mul.prodCarry', { x, y: d, pp, c: carry, p }) : say(lang, 'mul.prod', { x, y: d, p }),
        t,
      );
      m.undim(aIds[i], t);
      const lit = [aIds[i], ...(carryId ? [carryId] : [])];
      t = m.focus(lit, t) + DUR.beat;

      const flyers = [m.clone(aIds[i], m.uid('cp'), t), m.clone(bIds[j], m.uid('cp'), t), ...(carryId ? [carryId] : [])];
      const units = m.text(`p${j}_${col}`, String(p % 10), colX(g, col), pY(j), { size: g.size, color: 'result' });
      row[col] = units;
      vals[col] = p % 10;
      let tens: string | undefined;
      if (p >= 10) {
        tens = m.text(last ? `p${j}_${col + 1}` : m.uid('mc'), String(Math.floor(p / 10)), colX(g, col + 1), pY(j), {
          size: g.size,
          color: last ? 'result' : 'carry',
        });
      }
      const mx = p >= 10 ? colX(g, col) - g.cw / 2 : colX(g, col);
      t = m.merge(flyers, tens ? [units, tens] : units, mx, pY(j), t);
      m.unfocus(lit, t);
      if (j === bd.length - 1) m.dim(aIds[i], t);

      if (tens && last) {
        row[col + 1] = tens;
        vals[col + 1] = Math.floor(p / 10);
        carry = 0;
        carryId = undefined;
      } else if (tens) {
        t = m.step(say(lang, 'mul.carry', { digit: p % 10, carry: Math.floor(p / 10) }), t + DUR.beat);
        m.resize(tens, 0.6, t);
        t = m.hop(tens, colX(g, i + 1), carryY, t, 80);
        carry = Math.floor(p / 10);
        carryId = tens;
      } else {
        carry = 0;
        carryId = undefined;
      }
      t += DUR.beat * 2;
      m.hold(t);
    });
    m.unfocus(bIds[j], t);
    m.dim(bIds[j], t);
    partialIds.push(row);
    partialVals.push(vals);
    const value = vals.reduce((s, v, c) => s + (v ?? 0) * 10 ** c, 0);
    if (value !== a * d * 10 ** j) throw new Error(`multiplication: partial ${j} = ${value}, expected ${a * d * 10 ** j}`);
    t += DUR.beat;
  });

  let answerIds: string[];
  let answerY: number;
  if (multi) {
    t = m.step(say(lang, 'mul.add'), t);
    const plusX = colX(g, cols);
    m.text('plus2', '+', plusX, pY(bd.length - 1), { size: g.size });
    t = m.appear('plus2', t);
    t = m.rule('rule2', plusX - g.cw * 0.4, rule2Y, colX(g, 0) + g.cw * 0.6, rule2Y, t) + DUR.beat;
    for (const r of partialIds) m.recolor(r.filter(Boolean), 'ink', t);
    const res = columnAdd(m, {
      rows: partialIds,
      values: partialVals,
      grid: g,
      carryY: addCarryY,
      resultY: finalY,
      t: t + DUR.beat,
      lang,
      prefix: 'f',
      carryScale: 0.55,
    });
    t = res.t;
    if (res.value !== product) throw new Error(`multiplication: sum ${res.value}, expected ${product}`);
    answerIds = res.ids;
    answerY = finalY;
  } else {
    answerIds = partialIds[0];
    answerY = pY(0);
  }

  t = m.step(say(lang, 'mul.answer', { expr, result: product }), t);
  t = celebrate(m, answerIds, g, answerY, t, 'ans');
  m.hold(t + 1200);
  return m.build();
}
