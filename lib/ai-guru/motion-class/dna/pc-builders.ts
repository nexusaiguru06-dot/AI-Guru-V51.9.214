/**
 * DNA builder for pie charts (V51.9.35): the data on the side, the total, each central angle as
 * value ÷ total × 360° with its sector drawn in turn, the percentages, and the check that the
 * angles make 360°. The planner gives the whole-number data and the order; the app computes every
 * angle, percentage and sector (pc-math.ts). English and Malayalam classes have identical pictures.
 */

import { Motion, type MotionScene } from '../../reels/motion/engine';
import { tokenWidth } from '../../reels/motion/metrics';
import type { Lang } from '../../reels/motion/captions';
import { circlePts } from '../../reels/motion/shapes';
import type { Bi, PiePlan } from './types';
import { PIE, angleLines, checkLines, fmtNum, pieFacts, pieGeometry, pieLabels, percentLines, tableLines, totalLines, type Line } from './pc-math';

const pick = (b: Bi | undefined, lang: Lang): string => (b ? (lang === 'ml' ? b.ml || b.en : b.en) : '');
const SCENE_W = 720;
const SCENE_H = 444;
export const CPX = 440;
export const CPMAX = 256;
export const CPANEL_Y = (k: number) => 140 + 38 * k;

export function buildPie(plan: PiePlan, lang: Lang, title: string): MotionScene[] {
  const m = new Motion(title, SCENE_W, SCENE_H);
  m.fixView(SCENE_W / 2, SCENE_W);
  let t = 300;
  let uid = 0;
  let panel: string[] = [];
  let degIds: string[] = [];
  const sectors = pieGeometry(plan);
  const f = pieFacts(plan);
  const names = pieLabels(plan);

  const put = (text: string, x: number, y: number, color: string, size = 22): string => {
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
      if (total(px) > CPMAX) px = Math.max(12, Math.floor((24 * CPMAX) / total(24)));
      let x = CPX;
      const ids: string[] = [];
      for (const w of words) {
        const wd = tokenWidth(w, px);
        ids.push(put(w, x + wd / 2, CPANEL_Y(k), color, px));
        x += wd + px * 0.3;
      }
      t = m.appear(ids, t, 0, false) + 250;
      panel.push(...ids);
    });
  };
  const label = (text: string, x: number, y: number, color: string, size: number): string => {
    const id = put(text, x, y, color, size);
    t = m.appear([id], t, 0, false) + 120;
    return id;
  };

  const doShow = () => {
    m.poly(`pl${uid++}`, circlePts(PIE.cx, PIE.cy, PIE.r), t, { color: 'ink', closed: true, width: 3.5, dur: 1000, z: 2 });
    t += 900;
    m.dot(`dt${uid++}`, PIE.cx, PIE.cy, t, { color: 'ink', r: 4 });
    t += 300;
    showPanel(tableLines(plan));
  };
  const doTotal = () => showPanel(totalLines(plan));
  const doAngle = () => {
    sectors.forEach((s, i) => {
      m.poly(`sc${uid++}`, s.pts, t, { color: s.color, fill: s.color, fillAlpha: 0.28, closed: true, width: 2.5, dur: 600, z: 2 });
      t += 450;
      if (s.inside) {
        const chord = 2 * PIE.r * 0.6 * Math.sin(((s.end - s.start) * Math.PI) / 360);
        if (tokenWidth(names[i], 16) <= chord - 6) label(names[i], s.inside[0], s.inside[1], 'ink', 16);
      }
      degIds.push(label(`${f.angles[i]}°`, s.label[0], s.label[1], s.color, 18));
    });
    t += 200;
    showPanel(angleLines(plan));
  };
  const doPercent = () => {
    clear(degIds, t);
    t += 300;
    degIds = sectors.map((s, i) => label(`${fmtNum(f.percents[i])}%`, s.label[0], s.label[1], s.color, 18));
    t += 150;
    showPanel(percentLines(plan));
  };
  const doCheck = () => {
    t = m.tick(`tk${uid++}`, 372, 392, t, 36) + 100;
    showPanel(checkLines(plan));
  };

  if (plan.title) t = m.step(pick(plan.title, lang), t, 1600);

  for (const st of plan.steps) {
    t = m.step(pick(st.say, lang), t, 2400);
    switch (st.op) {
      case 'show': doShow(); break;
      case 'total': doTotal(); break;
      case 'angle': doAngle(); break;
      case 'percent': doPercent(); break;
      case 'check': doCheck(); break;
    }
    t += 150;
    m.hold(t);
  }
  m.hold(t + 1400);
  return [m.build()];
}
