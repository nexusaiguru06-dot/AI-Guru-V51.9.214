/**
 * DNA builder for solids (V51.9.33): a cuboid, right triangular prism, cylinder, cone or sphere is
 * drawn in oblique projection (hidden edges dashed, the sizes written in the colour of the letter that
 * names them); the base is shaded and its area worked out; the volume and surface area are written
 * line by line; the surface opens into a flat net with the area of every piece.
 *
 * The planner gives the solid, its whole-number sizes and the order. The app computes every length,
 * area and volume and every point (s-math.ts); English and Malayalam classes have identical pictures.
 */

import { Motion, type MotionScene } from '../../reels/motion/engine';
import type { Role } from '../../reels/motion/grammar';
import { tokenWidth } from '../../reels/motion/metrics';
import type { Lang } from '../../reels/motion/captions';
import type { Bi, SolidPlan } from './types';
import { baseLines, legendLines, netGeometry, netLines, slantLines, solidGeometry, surfaceLines, volumeLines, type Line, type Pt } from './s-math';

const pick = (b: Bi | undefined, lang: Lang): string => (b ? (lang === 'ml' ? b.ml || b.en : b.en) : '');
const SCENE_W = 720;
const SCENE_H = 444;
export const SPX = 440;
export const SPMAX = 256;
export const SPANEL_Y = (k: number) => 150 + 44 * k;

export function buildSolid(plan: SolidPlan, lang: Lang, title: string): MotionScene[] {
  const m = new Motion(title, SCENE_W, SCENE_H);
  m.fixView(SCENE_W / 2, SCENE_W);
  let t = 300;
  let uid = 0;
  let panel: string[] = [];
  const solidIds: string[] = [];
  const geom = solidGeometry(plan);
  const stepOps = plan.steps.map((s) => s.op);

  const put = (text: string, x: number, y: number, color: Role | string, size = 22): string => {
    const id = `tx${uid++}`;
    m.text(id, text, x, y, { size, color, z: 5 });
    return id;
  };
  const fit = (text: string, size: number, max: number) => {
    const w = tokenWidth(text, size);
    return w > max ? Math.max(12, Math.floor((size * max) / w)) : size;
  };
  const clear = (ids: string[], at: number) => {
    if (ids.length) m.fadeOut(ids, at, 300);
  };
  const showPanel = (lines: Line[]) => {
    clear(panel, t);
    panel = [];
    lines.forEach(([l, color], k) => {
      // a line is a row of words (a fraction is a word of its own), left-aligned at the panel
      const words = l.split(' ').filter(Boolean);
      const total = (px: number) => words.reduce((w, x) => w + tokenWidth(x, px), 0) + Math.max(0, words.length - 1) * px * 0.3;
      let px = 24;
      if (total(px) > SPMAX) px = Math.max(12, Math.floor((24 * SPMAX) / total(24)));
      let x = SPX;
      const ids: string[] = [];
      for (const w of words) {
        const wd = tokenWidth(w, px);
        ids.push(put(w, x + wd / 2, SPANEL_Y(k), color, px));
        x += wd + px * 0.3;
      }
      t = m.appear(ids, t, 0, false) + 300;
      panel.push(...ids);
    });
  };
  const draw = (pts: Pt[], color: Role | string, o: { dashed?: boolean; width?: number; fill?: boolean; closed?: boolean; z?: number; dur?: number } = {}): string => {
    const id = `pl${uid++}`;
    m.poly(id, pts, t, { color, fill: o.fill ? color : undefined, fillAlpha: o.fill ? 0.22 : undefined, closed: o.closed ?? false, dashed: o.dashed, width: o.width ?? 3, dur: o.dur ?? 600, z: o.z ?? 3 });
    t += 220;
    return id;
  };
  const label = (text: string, at: Pt, color: Role | string, size = 20): string => {
    const id = put(text, at[0], at[1], color, size);
    t = m.appear([id], t, 0, false) + 150;
    return id;
  };

  const doShow = () => {
    if (geom.circles) {
      // sphere: outline, equator, radius
      for (const e of geom.edges) solidIds.push(draw(e.pts, e.role ?? 'ink', { dashed: e.dashed, width: e.width, closed: false }));
    } else {
      for (const e of geom.edges.filter((x) => !x.dashed)) solidIds.push(draw(e.pts, e.role ?? 'ink', { width: e.width, closed: false }));
      for (const e of geom.edges.filter((x) => x.dashed)) solidIds.push(draw(e.pts, e.role ?? 'ink', { dashed: true, width: e.width, closed: false }));
    }
    for (const l of geom.labels) solidIds.push(label(l.text, l.at, l.role, l.size ?? 20));
    t += 200;
    showPanel(legendLines(plan));
  };
  const doBase = () => {
    solidIds.push(draw(geom.base, 'a', { fill: true, closed: true, z: 1, width: 2.5 }));
    showPanel(baseLines(plan));
  };
  const doSlant = () => {
    if (geom.slantEdge) solidIds.push(draw(geom.slantEdge, 'carry', { width: 5 }));
    if (geom.slantLabel) solidIds.push(label(geom.slantLabel.text, geom.slantLabel.at, 'carry'));
    showPanel(slantLines(plan));
  };
  const doVolume = () => {
    const withBase = stepOps.indexOf('base') >= 0 && stepOps.indexOf('base') < stepOps.indexOf('volume');
    showPanel(volumeLines(plan, withBase));
  };
  const doNet = () => {
    const net = netGeometry(plan);
    if (!net) return;
    clear(solidIds, t);
    t += 400;
    for (const p of net.pieces) {
      solidIds.push(draw(p.pts, p.role, { fill: true, closed: true, z: 2, dur: 700, width: 3 }));
      const xs = p.pts.map((q) => q[0]);
      const ys = p.pts.map((q) => q[1]);
      const room = Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
      const px = fit(p.text, 20, Math.max(24, room * 0.9));
      solidIds.push(label(p.text, p.at, p.role, px));
    }
    for (const l of net.labels) solidIds.push(label(l.text, l.at, l.role, 18));
    t += 200;
    showPanel(netLines(plan));
  };
  const doSurface = () => {
    if (geom.circles) {
      for (const c of geom.circles) {
        const pts: Pt[] = Array.from({ length: 64 }, (_, i) => [c.c[0] + c.r * Math.cos((i / 64) * Math.PI * 2), c.c[1] + c.r * Math.sin((i / 64) * Math.PI * 2)] as Pt);
        solidIds.push(draw(pts, 'a', { fill: true, closed: true, z: 2, dur: 500 }));
        solidIds.push(label('π r^2', c.c, 'a', 16));
      }
      t += 200;
    }
    showPanel(surfaceLines(plan));
  };

  if (plan.title) t = m.step(pick(plan.title, lang), t, 1600);

  for (const st of plan.steps) {
    t = m.step(pick(st.say, lang), t, 2400);
    switch (st.op) {
      case 'show': doShow(); break;
      case 'base': doBase(); break;
      case 'slant': doSlant(); break;
      case 'volume': doVolume(); break;
      case 'net': doNet(); break;
      case 'surface': doSurface(); break;
    }
    t += 150;
    m.hold(t);
  }
  m.hold(t + 1400);
  return [m.build()];
}
