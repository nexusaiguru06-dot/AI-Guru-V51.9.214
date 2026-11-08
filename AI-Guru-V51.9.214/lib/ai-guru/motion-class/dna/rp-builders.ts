/**
 * DNA builder for ratios and percentages (V51.9.34): a bar model. Sharing in a ratio (the bar in as
 * many equal blocks as the ratio has parts, one block's value, each person's share, the check),
 * a percentage of a quantity (the bar in ten tenths, p% shaded, the result) and a percentage
 * increase or decrease (the extra or removed piece, the new amount).
 *
 * The planner gives the kind, the whole numbers and the order. The app computes every value and every
 * block (rp-math.ts); English and Malayalam classes have identical pictures.
 */

import { Motion, type MotionScene } from '../../reels/motion/engine';
import type { Role } from '../../reels/motion/grammar';
import { tokenWidth } from '../../reels/motion/metrics';
import type { Lang } from '../../reels/motion/captions';
import type { Bi, RatioPlan } from './types';
import { PART_LETTERS, PART_ROLES, changeLines, changeResultLines, checkLines, fmtNum, partLines, partsLines, ratioFacts, ratioGeometry, resultLines, showLines, tenthLines, unitLines, withUnit, type Line, type Pt } from './rp-math';

const pick = (b: Bi | undefined, lang: Lang): string => (b ? (lang === 'ml' ? b.ml || b.en : b.en) : '');
const SCENE_W = 720;
const SCENE_H = 444;
export const RPX = 440;
export const RPMAX = 256;
export const RPANEL_Y = (k: number) => 150 + 44 * k;

export function buildRatio(plan: RatioPlan, lang: Lang, title: string): MotionScene[] {
  const m = new Motion(title, SCENE_W, SCENE_H);
  m.fixView(SCENE_W / 2, SCENE_W);
  let t = 300;
  let uid = 0;
  let panel: string[] = [];
  let letters: string[] = [];
  let regionLabel = '';
  const g = ratioGeometry(plan);
  const f = ratioFacts(plan);
  const top = g.bar.y;
  const bottom = g.bar.y + g.bar.h;
  const u = plan.unit;

  const put = (text: string, x: number, y: number, color: Role | string, size = 22): string => {
    const id = `tx${uid++}`;
    m.text(id, text, x, y, { size, color, z: 5 });
    return id;
  };
  const clear = (ids: string[], at: number) => {
    if (ids.length) m.fadeOut(ids, at, 300);
  };
  const showPanel = (lines: Line[]) => {
    clear(panel, t);
    panel = [];
    lines.forEach(([l, color], k) => {
      const words = l.split(' ').filter(Boolean);
      const total = (px: number) => words.reduce((w, x) => w + tokenWidth(x, px), 0) + Math.max(0, words.length - 1) * px * 0.3;
      let px = 24;
      if (total(px) > RPMAX) px = Math.max(12, Math.floor((24 * RPMAX) / total(24)));
      let x = RPX;
      const ids: string[] = [];
      for (const w of words) {
        const wd = tokenWidth(w, px);
        ids.push(put(w, x + wd / 2, RPANEL_Y(k), color, px));
        x += wd + px * 0.3;
      }
      t = m.appear(ids, t, 0, false) + 300;
      panel.push(...ids);
    });
  };
  const rect = (x0: number, x1: number, color: Role | string, o: { fill?: boolean; width?: number; z?: number; dur?: number } = {}): string => {
    const id = `pl${uid++}`;
    const pts: Pt[] = [[x0, top], [x1, top], [x1, bottom], [x0, bottom]];
    m.poly(id, pts, t, { color, fill: o.fill ? color : undefined, fillAlpha: o.fill ? 0.25 : undefined, closed: true, width: o.width ?? 2.5, dur: o.dur ?? 500, z: o.z ?? 2 });
    return id;
  };
  /** An open bracket above (up = true) or below the bar between x0 and x1, at distance d. */
  const bracket = (x0: number, x1: number, d: number, up: boolean, color: Role | string): string => {
    const id = `pl${uid++}`;
    const y0 = up ? top - d : bottom + d;
    const y1 = up ? y0 - 8 : y0 + 8;
    m.poly(id, [[x0, y0], [x0, y1], [x1, y1], [x1, y0]], t, { color, closed: false, width: 3, dur: 500, z: 3 });
    t += 200;
    return id;
  };
  const label = (text: string, x: number, y: number, color: Role | string, size = 20): string => {
    const id = put(text, x, y, color, size);
    t = m.appear([id], t, 0, false) + 120;
    return id;
  };
  const fitSize = (text: string, size: number, max: number) => {
    const w = tokenWidth(text, size);
    return w > max ? Math.max(11, Math.floor((size * max) / w)) : size;
  };
  const rowY = (i: number) => bottom + 24 + 26 * (i % 2);

  /* ---------------- share ---------------- */

  const shareShow = () => {
    for (const b of g.blocks) { rect(b.x0, b.x1, PART_ROLES[b.part], { fill: true }); t += 80; }
    t += 300;
    bracket(g.bar.x0, g.bar.x0 + g.bar.w, 18, true, 'ink');
    label(withUnit(plan.total!, u), g.bar.x0 + g.bar.w / 2, top - 44, 'result', 22);
    letters = g.groups.map((gr, i) => label(PART_LETTERS[i], (gr.x0 + gr.x1) / 2, rowY(i), PART_ROLES[i], 20));
    t += 150;
    showPanel(showLines(plan));
  };
  const shareUnit = () => {
    const txt = fmtNum(f.unitValue);
    for (const b of g.blocks) label(txt, (b.x0 + b.x1) / 2, (top + bottom) / 2, PART_ROLES[b.part], fitSize(txt, 20, b.x1 - b.x0 - 4));
    t += 150;
    showPanel(unitLines(plan));
  };
  const shareParts = () => {
    clear(letters, t);
    t += 300;
    g.groups.forEach((gr, i) => label(fmtNum(f.partValues[i]), (gr.x0 + gr.x1) / 2, rowY(i), PART_ROLES[i], 22));
    t += 150;
    showPanel(partsLines(plan));
  };
  const shareCheck = () => {
    t = m.tick(`tk${uid++}`, g.bar.x0 + g.bar.w / 2, bottom + 92, t, 36) + 100;
    showPanel(checkLines(plan));
  };

  /* ---------------- percent and change ---------------- */

  const tenthBar = () => {
    for (const b of g.blocks) { rect(b.x0, b.x1, 'ink', { width: 2.5 }); t += 70; }
    t += 250;
  };
  const percentShow = () => {
    tenthBar();
    bracket(g.bar.x0, g.x100, 18, true, 'ink');
    label(withUnit(plan.whole!, u), (g.bar.x0 + g.x100) / 2, top - 44, 'result', 22);
    label('0%', g.bar.x0, bottom + 22, 'ink', 14);
    label('100%', g.x100, bottom + 22, 'ink', 14);
    showPanel(showLines(plan));
  };
  const percentTenth = () => {
    const txt = fmtNum(f.tenth);
    g.blocks.forEach((b, i) => {
      label(txt, (b.x0 + b.x1) / 2, (top + bottom) / 2, 'carry', fitSize(txt, 20, b.x1 - b.x0 - 4));
      if (i > 0) label(`${10 * i}%`, b.x0, bottom + 22, 'ink', 13);
    });
    t += 150;
    showPanel(tenthLines(plan));
  };
  const percentPart = () => {
    const fl = g.fill!;
    rect(fl.x0, fl.x1, 'a', { fill: true, width: 3.5, z: 3 });
    t += 400;
    bracket(fl.x0, fl.x1, 34, false, 'a');
    regionLabel = label(`${plan.pct}%`, (fl.x0 + fl.x1) / 2, bottom + 78, 'a', 20);
    showPanel(partLines(plan));
  };
  const percentResult = () => {
    const fl = g.fill!;
    clear([regionLabel], t);
    t += 300;
    label(withUnit(f.amount, u), (fl.x0 + fl.x1) / 2, bottom + 78, 'result', 22);
    showPanel(resultLines(plan));
  };
  const changeShow = () => {
    tenthBar();
    bracket(g.bar.x0, g.x100, 18, true, 'ink');
    label(withUnit(plan.whole!, u), (g.bar.x0 + g.x100) / 2, top - 44, 'result', 22);
    showPanel(showLines(plan));
  };
  const changeAmount = () => {
    const fl = g.fill!;
    const up = plan.dir !== 'down';
    const color = up ? 'c' : 'b';
    rect(fl.x0, fl.x1, color, { fill: true, width: 3.5, z: 3 });
    t += 400;
    bracket(fl.x0, fl.x1, 34, false, color);
    label(`${plan.pct}%`, (fl.x0 + fl.x1) / 2, bottom + 78, color, 20);
    label(`${up ? '+' : '−'}${fmtNum(f.amount)}`, (fl.x0 + fl.x1) / 2, bottom + 22, color, 20);
    showPanel(changeLines(plan));
  };
  const changeResult = () => {
    const up = plan.dir !== 'down';
    const x1 = up ? g.xEnd : g.fill!.x0;
    bracket(g.bar.x0, x1, 56, true, 'result');
    label(withUnit(f.result, u), (g.bar.x0 + x1) / 2, top - 82, 'result', 22);
    showPanel(changeResultLines(plan));
  };

  if (plan.title) t = m.step(pick(plan.title, lang), t, 1600);

  for (const st of plan.steps) {
    t = m.step(pick(st.say, lang), t, 2400);
    const k = plan.kind;
    switch (st.op) {
      case 'show': k === 'share' ? shareShow() : k === 'percent' ? percentShow() : changeShow(); break;
      case 'unit': shareUnit(); break;
      case 'parts': shareParts(); break;
      case 'check': shareCheck(); break;
      case 'tenth': percentTenth(); break;
      case 'part': percentPart(); break;
      case 'result': k === 'percent' ? percentResult() : changeResult(); break;
      case 'change': changeAmount(); break;
    }
    t += 150;
    m.hold(t);
  }
  m.hold(t + 1400);
  return [m.build()];
}
