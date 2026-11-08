/**
 * Picture layouts of the concept board (V51.9.52): a balance SCALE that tips toward the heavier
 * side, horizontal BARS that grow to their values, and a TREE of branches. As everywhere in Motion
 * Class the planner only supplies words and numbers; the app measures, places, tilts and draws.
 */

import { ease, Motion, type MotionScene } from '../../reels/motion/engine';
import { DUR, type Role } from '../../reels/motion/grammar';
import { tokenWidth } from '../../reels/motion/metrics';
import type { Lang } from '../../reels/motion/captions';
import { bubbleFit, bubbleOutline } from '../../reels/motion/mascot';
import type { BoardPlan } from './types';
import { plain } from './concept-math';
import { ROLES, frame, heading, pick, type Pt } from './concept-kit';
import { SC, beamShape, DISH, panTop, rowLayout, stringsOf, tiltFor } from './bal-math';

const labelOf = (p: BoardPlan['points'][number], lang: Lang): string => plain(p.board ? pick(p.board, lang) : (p.math ?? []).join(' '));

/* ====================================================================== */
/* SCALE: two ideas weighed against each other                              */
/* ====================================================================== */

const TILE_W = 150;
const SCALE_H = 540;
/** The scale hangs a little lower than the geometry of the equation scale so its tipped beam clears the title. */
const DY = 44;

interface Member {
  kind: 'poly' | 'text';
  side: 0 | 1;
  local: Pt[];
}

export function buildScale(plan: BoardPlan, lang: Lang, title: string): MotionScene {
  const m = new Motion(title, 720, SCALE_H);
  m.camH.set(0, SCALE_H);
  m.camY.set(0, SCALE_H / 2);
  m.fixView(360, 720);
  const heads = (plan.heads ?? [{ en: '' }, { en: '' }]).map((h) => pick(h, lang));
  let t = heading(m, pick(plan.heading, lang) || title, 300);
  const sides: Array<'L' | 'R'> = ['L', 'R'];
  let theta = 0;
  let uid = 0;
  const members = new Map<string, Member>();
  const tiles: Array<Array<{ w: number; weight: number; ids: string[]; cx: number }>> = [[], []];
  const weight = (s: 0 | 1) => tiles[s].reduce((a, x) => a + x.weight, 0);
  const world = (s: 0 | 1, p: Pt, th = theta): Pt => {
    const o = panTop(sides[s], th);
    return [o[0] + p[0], o[1] + p[1] + DY];
  };
  const track = (id: string, kind: 'poly' | 'text', side: 0 | 1, local: Pt[]) => members.set(id, { kind, side, local });
  const place = (id: string, at: number, dur: number, th: number, e?: (p: number) => number) => {
    const mem = members.get(id)!;
    if (mem.kind === 'poly') m.morph(id, mem.local.map((p) => world(mem.side, p, th)), at, { dur, e });
    else {
      const [x, y] = world(mem.side, mem.local[0], th);
      m.move(id, x, y, at, { dur, sound: false });
    }
  };

  // the scale itself
  const cx = SC.px;
  const down = (ps: Pt[]): Pt[] => ps.map(([x, y]) => [x, y + DY] as Pt);
  m.poly('base', down([[cx - 120, SC.py + 270], [cx + 120, SC.py + 270], [cx + 105, SC.py + 300], [cx - 105, SC.py + 300]]), t, { color: 'result', fill: 'result', fillAlpha: 0.75, closed: true, width: 3, dur: 500, z: 1, silent: true });
  m.poly('post', down([[cx - 15, SC.py], [cx + 15, SC.py], [cx + 26, SC.py + 270], [cx - 26, SC.py + 270]]), t + 150, { color: 'b', fill: 'b', fillAlpha: 0.55, closed: true, width: 3, dur: 600, z: 1, silent: true });
  m.poly('beam', down(beamShape(0)), t + 350, { color: 'ink', fill: 'carry', fillAlpha: 0.9, closed: true, width: 3, dur: 700, z: 2 });
  m.poly('hub', down(Array.from({ length: 16 }, (_, i) => [cx + 15 * Math.cos((i / 16) * Math.PI * 2), SC.py + 15 * Math.sin((i / 16) * Math.PI * 2)] as Pt)), t + 900, { color: 'ink', fill: 'accent', fillAlpha: 1, closed: true, width: 3, dur: 400, z: 4, silent: true });
  ([0, 1] as const).forEach((s, k) => {
    const at = t + 900 + k * 150;
    stringsOf(sides[s], 0).forEach((st, i) => m.poly(`str${s}${i}`, down([st[0], st[1]]), at, { color: 'ink', closed: false, width: 2.5, dur: 400, z: 1, silent: true }));
    track(`dish${s}`, 'poly', s, DISH);
    m.poly(`dish${s}`, DISH.map((p) => world(s, p)), at + 100, { color: 'ink', fill: 'carry', fillAlpha: 0.6, closed: true, width: 3, dur: 500, z: 2, silent: true });
  });
  // the two titles under the scale, in the colours of their tiles
  ([0, 1] as const).forEach((s) => {
    const size = tokenWidth(heads[s], 28) > 300 ? 20 : 28;
    m.text(`pt${s}`, heads[s], s === 0 ? 180 : 540, SC.py + DY + 345, { size, color: ROLES[s], z: 5 });
  });
  t += 1700;
  t = m.write(['pt0', 'pt1'], t, 0, 450) + 200;

  /** Tip the beam to what the weights say; pans, strings and tiles follow. */
  const retilt = (at: number, dur = 900, e?: (p: number) => number): number => {
    const to = tiltFor(weight(0), weight(1));
    if (Math.abs(to - theta) < 1e-9) return at;
    m.morph('beam', down(beamShape(to)), at, { dur, e });
    theta = to;
    for (const id of members.keys()) place(id, at, dur, to, e);
    sides.forEach((sd, s) => stringsOf(sd, to).forEach((st, i) => m.morph(`str${s}${i}`, down([st[0], st[1]]), at, { dur, e })));
    m.sound(at, 'swoosh', { dur });
    return at + dur;
  };

  const points = plan.points;
  let prev: string[] = [];
  points.forEach((p, k) => {
    t = m.step(pick(p.say, lang), t, 2400);
    if (prev.length) m.dim(prev, t);
    const s: 0 | 1 = p.col === 1 ? 1 : 0;
    const role: Role = ROLES[s];
    // make room for this tile: the tiles already on the pan shift aside
    const widths = [...tiles[s].map((x) => x.w), TILE_W];
    const cs = rowLayout(widths);
    tiles[s].forEach((old, i) => {
      const dx = cs[i] - old.cx;
      if (Math.abs(dx) < 1e-9) return;
      old.cx = cs[i];
      for (const id of old.ids) {
        const mem = members.get(id)!;
        mem.local = mem.local.map((q) => [q[0] + dx, q[1]] as Pt);
        place(id, t, 450, theta);
      }
    });
    const tcx = cs[cs.length - 1];
    const pid = `sc${uid++}`;
    const local: Pt[] = [[tcx - TILE_W / 2, -SC.tileH], [tcx + TILE_W / 2, -SC.tileH], [tcx + TILE_W / 2, 0], [tcx - TILE_W / 2, 0]];
    track(pid, 'poly', s, local);
    m.poly(pid, local.map((q) => world(s, q)), t + 150, { color: role, fill: role, fillAlpha: 0.4, closed: true, width: 3.2, dur: 450, z: 3, silent: true });
    const f = bubbleFit(labelOf(p, lang), TILE_W - 28 + 36, 3, 18);
    const ids = [pid];
    const texts: string[] = [];
    f.lines.forEach((ln, i) => {
      const tid = `sc${uid++}`;
      const ly = -SC.tileH / 2 + f.lh * (i - (f.lines.length - 1) / 2);
      track(tid, 'text', s, [[tcx, ly]]);
      const [wx, wy] = world(s, [tcx, ly]);
      m.text(tid, ln, wx, wy, { size: f.size, color: 'ink', z: 6, weight: '700' });
      texts.push(tid);
      ids.push(tid);
    });
    tiles[s].push({ w: TILE_W, weight: p.weight ?? 1, ids, cx: tcx });
    t = m.write(texts, t + 450, 80) + 250;
    t = retilt(t, 1000, ease.back) + DUR.beat;
    prev = ids;
    void k;
  });
  m.hold(t + 1200);
  return m.build(900);
}

/* ====================================================================== */
/* BARS: quantities compared by length                                      */
/* ====================================================================== */

const fmtNum = (v: number): string => (Number.isInteger(v) ? v.toLocaleString('en-IN') : v.toLocaleString('en-IN', { maximumFractionDigits: 2 }));

export function buildBars(plan: BoardPlan, lang: Lang, title: string): MotionScene {
  const n = plan.points.length;
  const ROW = 64;
  const top = 108;
  const H = Math.max(380, top + n * ROW + 40);
  const m = frame(title, H);
  let t = heading(m, pick(plan.heading, lang) || title, 300);
  const unit = plan.unit ? pick(plan.unit, lang) : '';
  const max = Math.max(...plan.points.map((p) => p.value ?? 0));
  const x0 = 262;
  const full = 330;
  m.rule('axis', x0, top - 6, x0, top + n * ROW - 6, t, { color: 'ink', width: 3 });
  t += 400;
  let best = 0;
  plan.points.forEach((p, i) => {
    if ((p.value ?? 0) > (plan.points[best].value ?? 0)) best = i;
  });
  let prev: string[] = [];
  let bestIds: string[] = [];
  plan.points.forEach((p, i) => {
    t = m.step(pick(p.say, lang), t, 2400);
    if (prev.length) m.dim(prev, t);
    const cy = top + i * ROW + ROW / 2 - 6;
    const role: Role = ROLES[i % 3];
    const label = labelOf(p, lang);
    const f = bubbleFit(label, 212 + 36, 2, 24);
    const ids: string[] = [];
    f.lines.forEach((ln, k) => ids.push(m.text(`bl${i}_${k}`, ln, 136, cy + f.lh * (k - (f.lines.length - 1) / 2), { size: f.size, color: 'ink', z: 5 })));
    const w = max > 0 ? Math.max(4, ((p.value ?? 0) / max) * full) : 4;
    const bh = 36;
    const rect = (len: number): Pt[] => [[x0 + 2, cy - bh / 2], [x0 + 2 + len, cy - bh / 2], [x0 + 2 + len, cy + bh / 2], [x0 + 2, cy + bh / 2]];
    let e = m.write(ids, t + 100, 80);
    m.poly(`bb${i}`, rect(4), t + 250, { color: role, fill: role, fillAlpha: 0.55, closed: true, width: 3, dur: 120, z: 3, silent: true });
    e = Math.max(e, m.morph(`bb${i}`, rect(w), t + 420, { dur: 1100, e: ease.land }));
    const val = `${fmtNum(p.value ?? 0)}${unit ? ` ${unit}` : ''}`;
    const vs = tokenWidth(val, 26) > 150 ? 20 : 26;
    const vx = x0 + 2 + w + 10 + tokenWidth(val, vs) / 2;
    m.text(`bv${i}`, val, vx, cy, { size: vs, color: role, z: 5, weight: '700' });
    e = Math.max(e, m.appear([`bv${i}`], t + 1300, 0, false));
    ids.push(`bb${i}`, `bv${i}`);
    t = e + DUR.beat;
    prev = ids;
    if (i === best) bestIds = [`bv${i}`];
  });
  if (bestIds.length) {
    m.focus(bestIds, t);
    t += 600;
  }
  m.hold(t + 1200);
  return m.build(900);
}

/* ====================================================================== */
/* TREE: a topic and its kinds                                              */
/* ====================================================================== */

interface TNode {
  i: number;
  lines: string[];
  size: number;
  lh: number;
  w: number;
  h: number;
  x: number;
  y: number;
}

export function buildTree(plan: BoardPlan, lang: Lang, title: string): MotionScene {
  const pts = plan.points;
  const firsts = pts.map((p, i) => ({ p, i })).filter(({ p }) => p.parent === undefined).map(({ i }) => i);
  const n1 = firsts.length;
  const w1 = Math.min(190, Math.floor(660 / n1) - 14);
  const fit = (i: number, w: number) => {
    const f = bubbleFit(labelOf(pts[i], lang), w - 16 + 36, 3, 20);
    return { lines: f.lines, size: f.size, lh: f.lh, h: Math.max(54, f.lines.length * f.lh + 22) };
  };
  const nodes = new Map<number, TNode>();
  const rootW = Math.min(520, Math.max(240, tokenWidth(pick(plan.heading, lang) || title, 30) + 60));
  const rootY = 74;
  const rootH = 56;
  firsts.forEach((i, k) => {
    const f = fit(i, w1);
    nodes.set(i, { i, ...f, w: w1, x: 360 + (k - (n1 - 1) / 2) * (w1 + 14), y: 0 });
  });
  const row1 = Math.max(...firsts.map((i) => nodes.get(i)!.h));
  const y1 = rootY + rootH / 2 + 56 + row1 / 2;
  firsts.forEach((i) => (nodes.get(i)!.y = y1));
  let bottom = y1 + row1 / 2;
  firsts.forEach((par) => {
    let y = y1 + row1 / 2;
    let prevBottom = y;
    void prevBottom;
    const px = nodes.get(par)!.x;
    pts.forEach((p, i) => {
      if (p.parent !== par) return;
      const f = fit(i, w1);
      y += 30 + f.h / 2;
      nodes.set(i, { i, ...f, w: w1, x: px, y });
      y += f.h / 2;
    });
    bottom = Math.max(bottom, y);
  });
  const H = Math.max(380, bottom + 40);
  const m = frame(title, H);
  const rootText = pick(plan.heading, lang) || title;
  const rootSize = tokenWidth(rootText, 30) > rootW - 30 ? 22 : 30;
  m.poly('rt_b', bubbleOutline(360, rootY, rootW, rootH), 300, { color: 'accent', fill: 'accent', fillAlpha: 0.18, width: 3.5, dur: 500, silent: true });
  m.text('rt_t', rootText, 360, rootY, { size: rootSize, color: 'ink', z: 5 });
  let t = m.write(['rt_t'], 600, 0, 450) + 200;
  let prev: string[] = [];
  pts.forEach((p, k) => {
    t = m.step(pick(p.say, lang), t, 2400);
    if (prev.length) m.dim(prev, t);
    const nd = nodes.get(k)!;
    const first = p.parent === undefined;
    const role: Role = ROLES[first ? firsts.indexOf(k) % 3 : firsts.indexOf(p.parent!) % 3];
    const ids: string[] = [];
    // the line from its parent (the root, or the branch above)
    const from: Pt = first ? [360, rootY + rootH / 2] : (() => {
      const above = [...nodes.values()].filter((q) => q.x === nd.x && q.y < nd.y).sort((a, b) => b.y - a.y)[0];
      return [above.x, above.y + above.h / 2] as Pt;
    })();
    const lid = `tl${k}`;
    m.rule(lid, from[0], from[1], nd.x, nd.y - nd.h / 2, t + 100, { color: role, width: 3 });
    ids.push(lid);
    m.poly(`tn${k}_b`, bubbleOutline(nd.x, nd.y, nd.w, nd.h), t + 400, { color: role, fill: role, fillAlpha: 0.16, width: 3, dur: 450, silent: true, z: 2 });
    ids.push(`tn${k}_b`);
    const texts = nd.lines.map((ln, i) => m.text(`tn${k}_t${i}`, ln, nd.x, nd.y + nd.lh * (i - (nd.lines.length - 1) / 2), { size: nd.size, color: 'ink', z: 5 }));
    const e = m.write(texts, t + 700, 100);
    ids.push(...texts);
    t = e + DUR.beat;
    prev = ids;
  });
  m.hold(t + 1200);
  return m.build(900);
}
