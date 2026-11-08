/**
 * SUBTRACTION — column method with borrowing.
 *
 *  focus ........ top and bottom digit of the column glow; when the top is too small
 *                 the neighbour we borrow from is focused next
 *  colour ....... top number red, bottom purple, borrowed values orange, answer indigo
 *  movement ..... a small orange "1" HOPS from the neighbour to the needy column;
 *                 chalk copies fly down and merge into the difference
 *  transformation the neighbour is struck through and its new value (one less, or 9
 *                 for a passing zero) pops above it; the needy digit and the hopping
 *                 "1" MERGE into its new value (6 → 16)
 */

import { DUR } from '../grammar';
import { Motion, type MotionScene } from '../engine';
import { placeName, say, type Lang } from '../captions';
import { celebrate, centredGrid, colX, digitsOf, leftToRight, numberItems } from './column';

const SMALL = 36;

export function buildSubtraction(a: number, b: number, lang: Lang = 'en'): MotionScene {
  if (![a, b].every((n) => Number.isInteger(n) && n >= 0)) throw new Error('subtraction: whole numbers only');
  const negative = a < b;
  const top = negative ? b : a;
  const bot = negative ? a : b;
  const answer = top - bot;
  const expr = `${a} − ${b}`;

  const cols = digitsOf(top).length;
  const g = centredGrid(cols);
  const topY = 150;
  const botY = topY + 78;
  const ruleY = botY + 46;
  const resultY = ruleY + 52;
  const borrowY = topY - 50;
  const m = new Motion(`${expr} = ?`, 720, resultY + 70);

  let t = 300;
  if (negative) t = m.step(say(lang, 'sub.swap', { a, b }), t, 2600);
  t = m.step(say(lang, 'sub.setup'), t);
  const topIds = numberItems(m, 't', top, topY, g, 'a');
  const botIds = numberItems(m, 'b', bot, botY, g, 'b');
  t = m.appear(leftToRight(topIds), t, 110) + 120;
  t = m.appear(leftToRight(botIds), t, 110) + 120;
  const opX = colX(g, cols);
  m.text('op', '−', opX, botY, { size: g.size });
  t = m.appear('op', t);
  t = m.rule('rule', opX - g.cw * 0.4, ruleY, colX(g, 0) + g.cw * 0.6, ruleY, t) + DUR.beat * 2;

  const val = digitsOf(top);
  const bdig = digitsOf(bot);
  const disp = [...topIds];
  const level = val.map(() => 0); // how many replacement values are stacked above a column
  const resultIds: string[] = [];
  let result = 0;

  const smallAt = (c: number) => borrowY - (level[c] - 1) * 34;

  /** Strike the current display of column j and show `v` above it. */
  const replace = (j: number, v: number, at: number): number => {
    m.strike(disp[j], at);
    m.dim(disp[j], at + DUR.strike);
    level[j] += 1;
    const id = m.text(m.uid('bw'), String(v), colX(g, j), smallAt(j), { size: SMALL, color: 'carry' });
    disp[j] = id;
    val[j] = v;
    return m.appear(id, at + DUR.strike);
  };

  for (let c = 0; c < cols; c++) {
    const bd = bdig[c];
    if (bd !== undefined && val[c] < bd) {
      let k = c + 1;
      while (val[k] === 0) k++;
      t = m.step(say(lang, 'sub.borrow', { top: val[c], bottom: bd, from: placeName(lang, k) }), t);
      t = m.focus([disp[c], botIds[c]], t) + DUR.beat;
      // Walk the borrow from k down to c+1.
      for (let j = k; j > c; j--) {
        if (j < k) t = m.step(say(lang, 'sub.pass', { place: placeName(lang, j) }), t);
        t = m.focus(disp[j], t);
        t = replace(j, j === k ? val[j] - 1 : 9, t) + DUR.beat;
        // The "1" hops one column right.
        const one = m.text(m.uid('one'), '1', colX(g, j), smallAt(j), { size: SMALL, color: 'carry' });
        m.appear(one, t, 0, false);
        if (j - 1 > c) {
          t = m.hop(one, colX(g, j - 1), borrowY, t);
          m.fadeOut(one, t, 200);
        } else {
          // Arrives at the needy column: the old digit and the 1 merge into its new value.
          const cur = val[c];
          const newV = cur + 10;
          level[c] += 1;
          const target = m.text(m.uid('bw'), String(newV), colX(g, c), smallAt(c), { size: SMALL, color: 'carry' });
          const copy = m.clone(disp[c], m.uid('cp'), t, { color: 'carry' });
          m.strike(disp[c], t);
          m.dim(disp[c], t + DUR.strike);
          m.resize(copy, SMALL / g.size, t);
          t = m.hop(one, colX(g, c) - 12, smallAt(c), t);
          t = m.merge([one, copy], target, colX(g, c), smallAt(c), t - 150, 450);
          disp[c] = target;
          val[c] = newV;
          t = m.step(say(lang, 'sub.borrowed', { top: cur, now: newV }), t);
          t = m.focus(target, t) + DUR.beat;
        }
      }
    }

    const tv = val[c];
    const diff = tv - (bd ?? 0);
    // Zeros in front of the answer are not written (700 − 700 = 0, not 000).
    const isLeadingZero = c >= String(answer).length;
    if (bd === undefined) t = m.step(say(lang, 'sub.down', { place: placeName(lang, c), top: tv }), t);
    else t = m.step(say(lang, 'sub.col', { place: placeName(lang, c), top: tv, bottom: bd, diff }), t);
    const src = [disp[c], ...(botIds[c] ? [botIds[c]] : [])];
    t = m.focus(src, t) + DUR.beat;
    if (!isLeadingZero) {
      const rid = m.text(`r${c}`, String(diff), colX(g, c), resultY, { size: g.size, color: 'result' });
      const clones = src.map((id) => m.clone(id, m.uid('cp'), t));
      t = m.merge(clones, rid, colX(g, c), resultY, t);
      resultIds[c] = rid;
      result += diff * 10 ** c;
    }
    m.unfocus(src, t);
    m.dim(src, t);
    t += DUR.beat * 2;
    m.hold(t);
  }

  if (result !== answer) throw new Error(`subtraction: engine produced ${result}, expected ${answer}`);
  if (!resultIds.length) {
    resultIds[0] = m.text('r0', '0', colX(g, 0), resultY, { size: g.size, color: 'result' });
    t = m.appear('r0', t);
  }
  if (negative) {
    const lead = resultIds.length - 1;
    const minus = m.text('neg', '−', colX(g, lead + 1), resultY, { size: g.size, color: 'result' });
    t = m.appear(minus, t) + DUR.beat;
    resultIds.push(minus);
  }
  t = m.step(say(lang, 'sub.answer', { expr, result: negative ? `−${answer}` : answer }), t);
  t = celebrate(m, resultIds, g, resultY, t, 'ans');
  m.hold(t + 1200);
  return m.build();
}
