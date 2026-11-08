/**
 * DNA builder for the area of a parallelogram and of a trapezium (V51.9.38): the figure to scale
 * with its base and height; for the parallelogram a right triangle cut off and slid across to make
 * a rectangle; for the trapezium a turned copy that completes a parallelogram of base a + b, or a
 * diagonal that makes two triangles; then the formula with the numbers. The planner gives the sizes
 * and the order; the app computes every point and number (af-math.ts). English and Malayalam
 * classes have identical pictures.
 */

import { Motion, type MotionScene } from '../../reels/motion/engine';
import { tokenWidth } from '../../reels/motion/metrics';
import type { Lang } from '../../reels/motion/captions';
import type { AreaFigPlan, Bi } from './types';
import { YB, afGeometry, copyLines, formulaLines, showLines, trianglesLines, type Line, type Pt } from './af-math';

const pick = (b: Bi | undefined, lang: Lang): string => (b ? (lang === 'ml' ? b.ml || b.en : b.en) : '');
const SCENE_W = 720;
const SCENE_H = 444;
export const APX = 440;
export const APMAX = 256;
export const APANEL_Y = (k: number) => 140 + 46 * k;

export function buildAreaFig(plan: AreaFigPlan, lang: Lang, title: string): MotionScene[] {
  const m = new Motion(title, SCENE_W, SCENE_H);
  m.fixView(SCENE_W / 2, SCENE_W);
  let t = 300;
  let uid = 0;
  let panel: string[] = [];
  let copyIds: string[] = [];
  let triId = '';
  const g = afGeometry(plan);
  const { b, h } = plan;
  const par = plan.kind === 'parallelogram';

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
      const words = l.split(' ').filter(Boolean).map((w) => { const mm = /^(.*?)@([a-z]+)(.*)$/.exec(w); return mm ? { text: mm[1] + mm[3], color: mm[2] } : { text: w, color }; });
      const total = (px: number) => words.reduce((w, x) => w + tokenWidth(x.text, px), 0) + Math.max(0, words.length - 1) * px * 0.3;
      let px = 24;
      if (total(px) > APMAX) px = Math.max(12, Math.floor((24 * APMAX) / total(24)));
      let x = APX;
      const ids: string[] = [];
      for (const w of words) {
        const wd = tokenWidth(w.text, px);
        ids.push(put(w.text, x + wd / 2, APANEL_Y(k), w.color, px));
        x += wd + px * 0.3;
      }
      t = m.appear(ids, t, 0, false) + 250;
      panel.push(...ids);
    });
  };
  const label = (text: string, x: number, y: number, color: string, size = 20): string => {
    const id = put(text, x, y, color, size);
    t = m.appear([id], t, 0, false) + 120;
    return id;
  };
  const shape = (pts: Pt[], color: string, o: { fill?: boolean; closed?: boolean; dashed?: boolean; width?: number; dur?: number } = {}): string => {
    const id = `pl${uid++}`;
    m.poly(id, pts, t, { color, closed: o.closed ?? true, fill: o.fill ? color : undefined, fillAlpha: 0.3, dashed: o.dashed, width: o.width ?? 3, dur: o.dur ?? 700, z: o.fill ? 1 : 2 });
    t += (o.dur ?? 700) + 100;
    return id;
  };

  const doShow = () => {
    shape(g.fig, 'ink', { width: 3.5, dur: 1000 });
    label('b', g.lab.b[0], g.lab.b[1] + 22, par ? 'a' : 'b');
    if (!par) label('a', g.lab.a[0], g.lab.a[1] - 16, 'a');
    showPanel(showLines(plan));
  };
  const doHeight = () => {
    shape([g.heightFrom, g.heightTo], 'c', { closed: false, dashed: true, dur: 600 });
    const [fx, fy] = g.heightTo;
    const s = 9 * g.markDir;
    shape([[fx, fy - 9], [fx + s, fy - 9], [fx + s, fy]], 'c', { closed: false, width: 2, dur: 300 });
    label('h', fx - g.markDir * 14, (g.heightFrom[1] + fy) / 2, 'c');
  };
  const doCut = () => {
    triId = shape(g.tri!, 'carry', { fill: true });
  };
  const doMove = () => {
    clear([triId], t);
    t += 250;
    const a = g.tri![2];
    const z = g.moved![2];
    const arc: Pt[] = Array.from({ length: 21 }, (_, i) => { const u = i / 20; return [a[0] + (z[0] - a[0]) * u, a[1] + (z[1] - a[1]) * u - 36 * Math.sin(Math.PI * u)] as Pt; });
    shape(arc, 'carry', { closed: false, dur: 700 });
    shape(g.moved!, 'carry', { fill: true });
    shape(rectPts(), 'result', { dashed: true, dur: 700 });
  };
  const slantX = (): number => g.W - b;
  const rectPts = (): Pt[] => [g.px(slantX(), 0), g.px(slantX() + b, 0), g.px(slantX() + b, h), g.px(slantX(), h)];

  const doCopy = () => {
    copyIds.push(shape(g.copy!, 'carry', { fill: true }));
    const x0 = g.px(0, 0)[0];
    const x1 = g.px(plan.a! + b, 0)[0];
    copyIds.push(shape([[x0, YB + 30], [x0, YB + 38], [x1, YB + 38], [x1, YB + 30]], 'carry', { closed: false, width: 2, dur: 400 }));
    copyIds.push(label('a + b', (x0 + x1) / 2, YB + 56, 'carry'));
    copyIds.push(label('a', g.px(b + plan.a! / 2, 0)[0], YB + 22, 'a'));
    showPanel(copyLines());
  };
  const doTriangles = () => {
    clear(copyIds, t);
    copyIds = [];
    t += 250;
    shape([g.fig[0], g.fig[2]], 'ink', { closed: false, dur: 600 });
    shape(g.triB!, 'b', { fill: true });
    shape(g.triA!, 'a', { fill: true });
    showPanel(trianglesLines(plan));
  };
  const doFormula = () => showPanel(formulaLines(plan));

  if (plan.title) t = m.step(pick(plan.title, lang), t, 1600);

  for (const st of plan.steps) {
    t = m.step(pick(st.say, lang), t, 2400);
    switch (st.op) {
      case 'show': doShow(); break;
      case 'height': doHeight(); break;
      case 'cut': doCut(); break;
      case 'move': doMove(); break;
      case 'copy': doCopy(); break;
      case 'triangles': doTriangles(); break;
      case 'formula': doFormula(); break;
    }
    t += 150;
    m.hold(t);
  }
  m.hold(t + 1400);
  return [m.build()];
}
