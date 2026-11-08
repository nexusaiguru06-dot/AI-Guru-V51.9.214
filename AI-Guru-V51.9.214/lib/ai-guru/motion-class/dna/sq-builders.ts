/**
 * DNA builder for the visual proofs of (a + b)², (a − b)² and (a + b)(a − b) (V51.9.40): a square
 * split into tiles, curly braces for the sides, the tiles named, and the identity written term by
 * term, each term lighting its tile. The planner gives the kind, the sides and the order; the app
 * computes every tile, brace and number (sq-math.ts). English and Malayalam classes have identical
 * pictures; only the spoken captions differ.
 */

import { Motion, type MotionScene } from '../../reels/motion/engine';
import { tokenWidth } from '../../reels/motion/metrics';
import type { Lang } from '../../reels/motion/captions';
import type { Bi, SqPlan } from './types';
import { buildRows, checkLines, rectMid, rectPts, sqGeometry, titleLines, type Brace, type Line, type Pt } from './sq-math';

const pick = (b: Bi | undefined, lang: Lang): string => (b ? (lang === 'ml' ? b.ml || b.en : b.en) : '');
const SCENE_W = 720;
const SCENE_H = 444;
export const SQX = 440;
export const SQMAX = 256;
export const SQPANEL_Y = (k: number) => 150 + 46 * k;

export function buildSquareIdentity(plan: SqPlan, lang: Lang, title: string): MotionScene[] {
  const m = new Motion(title, SCENE_W, SCENE_H);
  m.fixView(SCENE_W / 2, SCENE_W);
  const g = sqGeometry(plan);
  let t = 300;
  let uid = 0;
  let panel: string[] = [];
  const rows = buildRows(plan);
  let r2Id = '';
  let rightBIds: string[] = [];

  const put = (text: string, x: number, y: number, color: string, size = 22): string => {
    const id = `tx${uid++}`;
    m.text(id, text, x, y, { size, color, z: 5 });
    return id;
  };
  const clear = (ids: string[], at: number) => {
    if (ids.length) m.fadeOut(ids, at, 300);
  };
  const parse = (l: string, color: string) => l.split(' ').filter(Boolean).map((w) => { const mm = /^(.*?)@([a-z]+)(.*)$/.exec(w); return mm ? { text: mm[1] + mm[3], color: mm[2] } : { text: w, color }; });
  const shape = (pts: Pt[], color: string, o: { fill?: boolean; closed?: boolean; dashed?: boolean; width?: number; dur?: number; alpha?: number } = {}): string => {
    const id = `pl${uid++}`;
    m.poly(id, pts, t, { color, closed: o.closed ?? true, fill: o.fill ? color : undefined, fillAlpha: o.alpha ?? 0.4, dashed: o.dashed, width: o.width ?? 3, dur: o.dur ?? 700, z: o.fill ? 1 : 2 });
    t += (o.dur ?? 700) + 100;
    return id;
  };
  const tile = (name: string, color: string, o: { fill?: boolean; dashed?: boolean; dur?: number; alpha?: number } = {}): string => shape(rectPts(g.tiles[name]), color, { fill: o.fill ?? true, dashed: o.dashed, dur: o.dur ?? 600, alpha: o.alpha });
  const flash = (names: string[]) => {
    const ids = names.map((n) => shape(rectPts(g.tiles[n]), 'result', { width: 6, dur: 300 }));
    clear(ids, t);
    t += 250;
  };
  const brace = (key: string): string[] => {
    const br: Brace = g.braces[key];
    const id = shape(br.pts, br.role, { closed: false, width: 2.5, dur: 450 });
    const lid = put(br.text, br.at[0], br.at[1], br.role, br.size);
    t = m.appear([lid], t, 0, false) + 100;
    return [id, lid];
  };
  const label = (key: string): string => {
    const l = g.labels[key];
    const id = put(l.text, l.at[0], l.at[1], l.role, l.size);
    t = m.appear([id], t, 0, false) + 150;
    return id;
  };

  const showPanel = (lines: Line[], hooks: Record<number, string[]> = {}, hookRow = 0) => {
    clear(panel, t);
    panel = [];
    lines.forEach(([l, color], k) => {
      const words = parse(l, color);
      const total = (px: number) => words.reduce((w, x) => w + tokenWidth(x.text, px), 0) + Math.max(0, words.length - 1) * px * 0.3;
      let px = 24;
      if (total(px) > SQMAX) px = Math.max(12, Math.floor((24 * SQMAX) / total(24)));
      let x = SQX;
      const ids: string[] = [];
      const stepwise = k === hookRow && Object.keys(hooks).length > 0;
      words.forEach((w, i) => {
        const wd = tokenWidth(w.text, px);
        const id = put(w.text, x + wd / 2, SQPANEL_Y(k), w.color, px);
        ids.push(id);
        x += wd + px * 0.3;
        if (stepwise) {
          t = m.appear([id], t, 0, false) + 200;
          if (hooks[i]) flash(hooks[i]);
        }
      });
      if (!stepwise) t = m.appear(ids, t, 0, false) + 250;
      else t += 150;
      panel.push(...ids);
    });
  };

  const doSquare = () => {
    shape(rectPts(g.tiles.outer), 'ink', { width: 3.5, dur: 1000 });
    if (plan.kind === 'sum') { brace('botSum'); brace('rightSum'); }
    else if (plan.kind === 'difference') { brace('topA'); brace('leftA'); }
    else { brace('botA'); brace('leftA'); }
    showPanel(titleLines(plan));
  };
  const doTileA = () => { tile('A', 'a'); brace('topA'); brace('leftA'); };
  const doStrips = () => {
    if (plan.kind === 'sum') { tile('AB1', 'c'); tile('AB2', 'c'); brace('topB'); brace('leftB'); }
    else { tile('strR', 'c', { alpha: 0.35 }); tile('strB', 'carry', { alpha: 0.35 }); brace('botB'); brace('rightB'); }
  };
  const doTileB = () => { tile('B', 'b'); };
  const doCorner = () => { tile('corner', 'b', { alpha: 0.55 }); };
  const doName = () => {
    if (plan.kind === 'sum') { label('A'); label('AB1'); label('AB2'); label('B'); }
    else if (plan.kind === 'difference') { label('centre'); label('visR'); label('visB'); label('corner'); brace('botAB'); brace('rightAB'); }
    else { brace('topAB'); brace('rightAB'); }
  };
  const doRemove = () => { tile('corner', 'b', { dashed: true, alpha: 0.3 }); rightBIds = brace('rightB'); };
  const doCut = () => {
    const r1 = g.tiles.r1;
    shape([[r1.x0, r1.y1], [g.tiles.r2.x1, r1.y1]], 'ink', { closed: false, dashed: true, dur: 500 });
    tile('r1', 'a');
    r2Id = tile('r2', 'c');
  };
  const doMove = () => {
    clear([r2Id, ...rightBIds], t);
    t += 250;
    const [fx, fy] = rectMid(g.tiles.r2);
    const [tx, ty] = rectMid(g.tiles.r2m);
    const arc: Pt[] = Array.from({ length: 21 }, (_, i) => { const w = i / 20; return [fx + (tx - fx) * w, fy + (ty - fy) * w - 40 * Math.sin(Math.PI * w)] as Pt; });
    shape(arc, 'c', { closed: false, dur: 700 });
    tile('r2m', 'c');
    shape(rectPts(g.tiles.rect), 'result', { dashed: true, dur: 700, width: 3 });
  };
  const doBuild = () => showPanel(rows.rows, rows.flash, rows.flashRow);
  const doCheck = () => showPanel(checkLines(plan));

  if (plan.title) t = m.step(pick(plan.title, lang), t, 1600);

  for (const st of plan.steps) {
    t = m.step(pick(st.say, lang), t, 2400);
    switch (st.op) {
      case 'square': doSquare(); break;
      case 'tileA': doTileA(); break;
      case 'strips': doStrips(); break;
      case 'tileB': doTileB(); break;
      case 'corner': doCorner(); break;
      case 'remove': doRemove(); break;
      case 'cut': doCut(); break;
      case 'move': doMove(); break;
      case 'name': doName(); break;
      case 'build': doBuild(); break;
      case 'check': doCheck(); break;
    }
    t += 150;
    m.hold(t);
  }
  m.hold(t + 1400);
  return [m.build()];
}
