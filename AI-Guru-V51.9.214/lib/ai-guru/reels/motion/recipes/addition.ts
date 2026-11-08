/**
 * ADDITION — column method with carries.
 *
 *  focus ........ the digits of one column (+ the carry above it) glow and pulse
 *  colour ....... operand 1 red, operand 2 purple, operand 3 green; carries orange;
 *                 answer indigo; finished columns fade to "done"
 *  movement ..... chalk copies of the column digits fly down and merge into the sum
 *  transformation the two-digit sum splits: units stay, the tens digit hops up and
 *                 shrinks into the carry row of the next column
 */

import { DUR } from '../grammar';
import { Motion, type MotionScene } from '../engine';
import { say, type Lang } from '../captions';
import { celebrate, centredGrid, colX, columnAdd, digitsOf, leftToRight, numberItems } from './column';

const OPERAND_ROLES = ['a', 'b', 'c', 'a', 'b', 'c'] as const;

export function buildAddition(nums: number[], lang: Lang = 'en'): MotionScene {
  if (nums.length < 2 || nums.some((n) => !Number.isInteger(n) || n < 0)) {
    throw new Error('addition: need two or more whole numbers ≥ 0');
  }
  const total = nums.reduce((a, b) => a + b, 0);
  const expr = nums.join(' + ');
  const cols = Math.max(digitsOf(total).length, ...nums.map((n) => digitsOf(n).length));
  const g = centredGrid(cols);
  const rowH = 78;
  const carryY = 50;
  const firstY = 120;
  const ruleY = firstY + (nums.length - 1) * rowH + 46;
  const resultY = ruleY + 52;
  const m = new Motion(`${expr} = ?`, 720, resultY + 70);

  let t = 300;
  t = m.step(say(lang, 'add.setup'), t);
  const rows = nums.map((n, r) => numberItems(m, `n${r}_`, n, firstY + r * rowH, g, OPERAND_ROLES[r]));
  for (const ids of rows) t = m.appear(leftToRight(ids), t, 110) + 120;
  const opX = colX(g, cols);
  m.text('op', '+', opX, firstY + (nums.length - 1) * rowH, { size: g.size, color: 'ink' });
  t = m.appear('op', t);
  t = m.rule('rule', opX - g.cw * 0.4, ruleY, colX(g, 0) + g.cw * 0.6, ruleY, t) + DUR.beat * 2;

  const res = columnAdd(m, {
    rows,
    values: nums.map((n) => digitsOf(n)),
    grid: g,
    carryY,
    resultY,
    t,
    lang,
    prefix: 's',
  });
  t = res.t;
  if (res.value !== total) throw new Error(`addition: engine produced ${res.value}, expected ${total}`);

  t = m.step(say(lang, 'add.answer', { expr, result: total }), t);
  t = celebrate(m, res.ids, g, resultY, t, 'ans');
  m.hold(t + 1200);
  return m.build();
}
