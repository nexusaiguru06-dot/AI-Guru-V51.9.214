/**
 * DIVISION — long division (divide, multiply, subtract, bring down).
 *
 *  focus ........ the part of the dividend being divided and the divisor glow together;
 *                 the camera glides down to follow the working
 *  colour ....... dividend red, divisor purple, quotient indigo, products green,
 *                 remainders orange, finished lines fade to "done"
 *  movement ..... quotient digit × divisor copies fly down and merge into the product;
 *                 the next dividend digit is carried DOWN along an arrow
 *  transformation the number and the product merge into their difference (the
 *                 remainder), which then grows by the brought-down digit
 */

import { DUR } from '../grammar';
import { Motion, type MotionScene } from '../engine';
import { say, type Lang } from '../captions';
import { celebrate, digitsOf, type Grid } from './column';
import { measure } from '../metrics';

export function buildDivision(a: number, d: number, lang: Lang = 'en'): MotionScene {
  if (!Number.isInteger(a) || !Number.isInteger(d) || a < 0 || d <= 0) throw new Error('division: whole numbers, divisor > 0');
  const digits = String(a).split('').map(Number);
  const n = digits.length;
  const size = 60;
  const cw = 48;
  const dW = measure(String(d), size);
  const blockW = dW + 34 + n * cw;
  const x0 = 360 - blockW / 2 + dW + 34 + cw / 2; // centre of dividend column 0
  const colX = (i: number) => x0 + i * cw;
  const qY = 70;
  const barY = 106;
  const divY = 148;
  const rowH = 70;
  const rowY = (k: number) => divY + rowH * k;
  const g: Grid = { right: colX(n - 1), cw, size };

  // Work out the steps first so the scene height is known.
  let rowsUsed = 0;
  {
    let cur = 0;
    let started = false;
    for (let i = 0; i < n; i++) {
      cur = cur * 10 + digits[i];
      if (!started && cur < d && i < n - 1) continue;
      started = true;
      const q = Math.floor(cur / d);
      if (q > 0) rowsUsed += 2;
      cur -= q * d;
    }
  }
  const height = rowY(rowsUsed) + 70;
  const m = new Motion(`${a} ÷ ${d} = ?`, 720, height);
  const view = Math.min(height, 700);
  const scrolls = height > view;
  m.camH.set(0, view);
  m.camY.set(0, view / 2);

  let t = 300;
  t = m.step(say(lang, 'div.setup'), t);
  const dv = m.text('dv', String(d), colX(0) - cw / 2 - 26 - dW / 2, divY, { size, color: 'b' });
  const dIds = digits.map((v, i) => m.text(`n${i}`, String(v), colX(i), divY, { size, color: 'a' }));
  t = m.appear(dv, t) + 100;
  // Bracket ")" and bar.
  t = m.rule('br', colX(0) - cw / 2 - 12, barY, colX(0) - cw / 2 + 2, divY + 34, t);
  t = m.rule('bar', colX(0) - cw / 2 - 12, barY, colX(n - 1) + cw / 2 + 6, barY, t - 200);
  t = m.appear(dIds, t, 110) + DUR.beat * 2;

  /** Items for value v right-aligned so its last digit sits in column `end`. */
  const numberAt = (prefix: string, v: number, end: number, y: number, color: string): string[] =>
    digitsOf(v)
      .map((dg, k) => m.text(m.uid(prefix), String(dg), colX(end - k), y, { size, color }))
      .reverse();

  let cur = 0;
  let started = false;
  let curIds: string[] = [];
  let row = 0; // index of the line that holds the current number (0 = dividend line)
  const qIds: string[] = [];
  let qValue = 0;

  for (let i = 0; i < n; i++) {
    cur = cur * 10 + digits[i];
    if (row === 0) curIds.push(dIds[i]);
    if (!started && cur < d && i < n - 1) continue;
    started = true;
    const q = Math.floor(cur / d);
    const prod = q * d;
    const r = cur - prod;
    qValue = qValue * 10 + q;

    if (q === 0) {
      t = m.step(say(lang, 'div.zero', { d, cur }), t);
      t = m.focus([...curIds, dv], t) + DUR.beat;
      const qi = m.text(`q${i}`, '0', colX(i), qY, { size, color: 'result' });
      qIds.push(qi);
      if (scrolls) t = m.look(t, view / 2, view, 500);
      t = m.appear(qi, t) + DUR.beat;
      m.unfocus([...curIds, dv], t);
    } else {
      t = m.step(say(lang, 'div.fits', { d, cur, q, prod }), t, 2600);
      t = m.focus([...curIds, dv], t) + DUR.beat;
      const qi = m.text(`q${i}`, String(q), colX(i), qY, { size, color: 'result' });
      qIds.push(qi);
      if (scrolls) t = m.look(t, view / 2, view, 500);
      t = m.appear(qi, t) + DUR.beat;
      m.focus(qi, t);

      // Multiply: q × d lands under the current number.
      const pRow = row + 1;
      if (scrolls) m.look(t, rowY(pRow + 1) - view * 0.35);
      const prodIds = numberAt('pd', prod, i, rowY(pRow), 'c');
      const minus = m.text(m.uid('mn'), '−', colX(i - digitsOf(prod).length) - 4, rowY(pRow), { size, color: 'ink' });
      const flyers = [m.clone(qi, m.uid('cp'), t), m.clone(dv, m.uid('cp'), t)];
      const px = (colX(i) + colX(i - digitsOf(prod).length + 1)) / 2;
      t = m.merge(flyers, prodIds, px, rowY(pRow), t);
      m.appear(minus, t - 200, 0, false);
      const ruleY = rowY(pRow) + 38;
      t = m.rule(m.uid('rl'), colX(i - digitsOf(prod).length + 1) - cw / 2 - 6, ruleY, colX(i) + cw / 2 + 6, ruleY, t) + DUR.beat;
      m.unfocus([...curIds, dv, qi], t);

      // Subtract.
      t = m.step(say(lang, 'div.sub', { cur, prod, r }), t);
      t = m.focus([...curIds, ...prodIds], t) + DUR.beat;
      const rRow = pRow + 1;
      const remIds = numberAt('rm', r, i, rowY(rRow), 'carry');
      const clones = [...curIds, ...prodIds].map((id) => m.clone(id, m.uid('cp'), t));
      t = m.merge(clones, remIds, px, rowY(rRow), t);
      m.unfocus([...curIds, ...prodIds], t);
      m.dim([...curIds, ...prodIds, minus], t);
      row = rRow;
      // A zero remainder is not written in front of the next digit.
      if (r === 0 && i < n - 1) {
        m.dim(remIds, t + 600);
        curIds = [];
      } else curIds = remIds;
    }
    cur = r;
    t += DUR.beat * 2;

    if (i < n - 1) {
      // Bring down the next digit.
      const next = dIds[i + 1];
      t = m.step(say(lang, 'div.down', { digit: digits[i + 1] }), t);
      t = m.focus(next, t);
      if (row > 0) {
        const copy = m.clone(next, m.uid('bd'), t, { color: 'carry' });
        m.arrow(m.uid('ar'), colX(i + 1) + cw * 0.45, divY + 20, colX(i + 1) + cw * 0.45, rowY(row) - 22, t);
        t = m.move(copy, colX(i + 1), rowY(row), t);
        m.unfocus(next, t);
        m.dim(next, t);
        curIds = [...curIds, copy];
      } else {
        m.unfocus(next, t);
      }
      t += DUR.beat;
    }
    m.hold(t);
  }

  const rem = cur;
  if (qValue !== Math.floor(a / d) || rem !== a % d) throw new Error(`division: engine produced ${qValue} r ${rem}`);
  t = m.step(say(lang, 'div.answer', { a, d, q: qValue, r: rem }), t, 2600);
  if (scrolls) m.look(t, view / 2);
  if (rem && curIds.length) m.focus(curIds, t + 200);
  t = celebrate(m, qIds, g, qY, t + 300, 'ans');
  m.hold(t + 1400);
  return m.build();
}
