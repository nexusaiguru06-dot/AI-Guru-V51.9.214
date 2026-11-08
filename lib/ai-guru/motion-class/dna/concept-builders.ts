/**
 * The concept board as PICTURES (V51.9.46): idea cards, a pyramid built from its base, and two
 * columns. The planner supplies words and (optionally) the layout; the app measures and places
 * everything. English and Malayalam differ only in the words.
 */

import type { Motion, MotionScene } from '../../reels/motion/engine';
import { DUR, type Role } from '../../reels/motion/grammar';
import { tokenWidth } from '../../reels/motion/metrics';
import type { Lang } from '../../reels/motion/captions';
import { bubbleFit, bubbleOutline } from '../../reels/motion/mascot';
import type { Bi, BoardPlan } from './types';
import { firstKey, layoutOf, plain } from './concept-math';
import { ROLES, circle, drawIcon, frame, heading, pick, type Pt } from './concept-kit';
import { iconFor, isIcon, type IconName } from './concept-icons';
import { buildBars, buildScale, buildTree } from './concept-pictures';


interface Item {
  key?: string;
  body: string;
  role: Role;
  n: number;
  say: string;
  col: 0 | 1;
  /** A small picture; the same in both languages (chosen from the English words). */
  icon?: IconName;
}

function itemsOf(plan: BoardPlan, lang: Lang): Item[] {
  return plan.points.map((p, i) => {
    const raw = p.board ? pick(p.board, lang) : (p.math ?? []).join(' ');
    const key = p.board ? (lang === 'ml' ? firstKey(pick(p.board, lang)) : firstKey(raw)) : undefined;
    const body = plain(raw);
    const icon: IconName | undefined = isIcon(p.icon) ? p.icon : (iconFor(p.board?.en ?? (p.math ?? []).join(' ')) ?? iconFor(p.say?.en ?? ''));
    return { key: key && key !== body ? key : undefined, body, role: ROLES[i % 3], n: i + 1, say: pick(p.say, lang), col: p.col ?? 0, icon };
  });
}

/* ---------------- one card ---------------- */

interface Measured {
  h: number;
  keySize: number;
  bodyLines: string[];
  bodySize: number;
  lh: number;
}

/** Width kept free for an icon on the right of a card. */
const ICON_SLOT = 66;

function measure(it: Item, w: number): Measured {
  const textW = w - 76 - (it.icon ? ICON_SLOT : 0);
  const minH = it.icon ? 70 : 54;
  if (!it.key) {
    const f = bubbleFit(it.body, textW + 36, 3, 24);
    return { h: Math.max(minH, f.lines.length * f.lh + 26), keySize: 0, bodyLines: f.lines, bodySize: f.size, lh: f.lh };
  }
  const f = bubbleFit(it.body, textW + 36, 2, 20);
  return { h: Math.max(minH, 14 + 34 + f.lines.length * f.lh + 14), keySize: 28, bodyLines: f.lines, bodySize: f.size, lh: f.lh };
}

function drawCard(m: Motion, id: string, cx: number, top: number, w: number, it: Item, t: number): { all: string[]; key?: string; end: number } {
  const ms = measure(it, w);
  const cy = top + ms.h / 2;
  const all: string[] = [];
  m.poly(`${id}_c`, bubbleOutline(cx, cy, w, ms.h), t, { color: it.role, fill: it.role, fillAlpha: 0.14, width: 3, dur: 500, silent: true });
  all.push(`${id}_c`);
  const bx = cx - w / 2 + 28;
  m.poly(`${id}_b`, circle(bx, cy, 15), t + 200, { color: it.role, fill: it.role, fillAlpha: 0.5, width: 2.5, dur: 300, silent: true });
  m.text(`${id}_n`, String(it.n), bx, cy, { size: 18, color: 'ink', z: 5 });
  all.push(`${id}_b`, `${id}_n`);
  const tx = cx + 22 - (it.icon ? ICON_SLOT / 2 : 0);
  const texts: string[] = [];
  let y = top + 14 + Math.max(0, (ms.h - ((it.key ? 34 : 0) + ms.bodyLines.length * ms.lh + 28)) / 2);
  let keyId: string | undefined;
  if (it.key) {
    keyId = m.text(`${id}_k`, it.key, tx, y + 17, { size: ms.keySize, color: it.role, z: 5 });
    texts.push(keyId);
    y += 34;
  }
  ms.bodyLines.forEach((ln, i) => texts.push(m.text(`${id}_t${i}`, ln, tx, y + ms.lh * (i + 0.5), { size: ms.bodySize, color: 'ink', z: 5 })));
  let end = m.write(texts, t + 350, 120);
  m.appear([`${id}_n`], t + 250, 0, false);
  all.push(...texts);
  if (it.icon) {
    const ic = drawIcon(m, `${id}_ic`, it.icon, cx + w / 2 - 44, cy, 52, it.role, t + 300);
    all.push(...ic.ids);
    end = Math.max(end, ic.end);
  }
  return { all, key: keyId, end: Math.max(end, t + 700) };
}

const cardHeight = (it: Item, w: number) => measure(it, w).h;

/* ---------------- layouts ---------------- */

function buildCards(plan: BoardPlan, lang: Lang, title: string): MotionScene {
  const items = itemsOf(plan, lang);
  const w = 600;
  const gap = 12;
  const hs = items.map((it) => cardHeight(it, w));
  const H = Math.max(380, 96 + hs.reduce((a, b) => a + b, 0) + gap * (items.length - 1) + 30);
  const m = frame(title, H);
  let t = heading(m, pick(plan.heading, lang) || title, 300);
  let y = 94;
  let prev: string[] = [];
  items.forEach((it, i) => {
    t = m.step(it.say, t, 2400);
    if (prev.length) m.dim(prev, t);
    const c = drawCard(m, `cd${i}`, 360, y, w, it, t + 150);
    t = c.end + DUR.beat;
    if (c.key) {
      m.focus([c.key], t);
      t += 500;
    }
    prev = c.all;
    y += hs[i] + gap;
  });
  m.hold(t + 1200);
  return m.build(900);
}

function buildColumns(plan: BoardPlan, lang: Lang, title: string): MotionScene {
  const items = itemsOf(plan, lang);
  const w = 326;
  const cxs = [185, 535];
  const gap = 12;
  const heads = (plan.heads ?? [{ en: '' }, { en: '' }]).map((h) => pick(h, lang));
  const tops = [150, 150];
  const placed = items.map((it) => {
    const col = it.col;
    const h = cardHeight(it, w);
    const y = tops[col];
    tops[col] += h + gap;
    return { y, col };
  });
  const H = Math.max(380, Math.max(...tops) + 24);
  const m = frame(title, H);
  let t = heading(m, pick(plan.heading, lang) || title, 300);
  [0, 1].forEach((c) => {
    m.text(`ch${c}`, heads[c], cxs[c], 104, { size: tokenWidth(heads[c], 28) > w ? 22 : 28, color: ROLES[c] });
    t = m.write([`ch${c}`], t, 0, 450) + 100;
    m.rule(`chr${c}`, cxs[c] - w / 2, 126, cxs[c] + w / 2, 126, t - 300, { color: ROLES[c], width: 3 });
  });
  let prev: string[] = [];
  items.forEach((it, i) => {
    t = m.step(it.say, t, 2400);
    if (prev.length) m.dim(prev, t);
    const colored: Item = { ...it, role: ROLES[it.col] };
    const c = drawCard(m, `cl${i}`, cxs[it.col], placed[i].y, w, colored, t + 150);
    t = c.end + DUR.beat;
    if (c.key) {
      m.focus([c.key], t);
      t += 500;
    }
    prev = c.all;
  });
  m.hold(t + 1200);
  return m.build(900);
}

function buildPyramid(plan: BoardPlan, lang: Lang, title: string): MotionScene {
  const items = itemsOf(plan, lang);
  const n = items.length;
  const y0 = 96;
  const bh = 64;
  const H = y0 + n * bh + 40;
  const m = frame(title, H);
  let t = heading(m, pick(plan.heading, lang) || title, 300);
  const hw = (y: number) => 110 + (300 - 110) * ((y - y0) / (n * bh));
  let prev: string[] = [];
  items.forEach((it, k) => {
    const j = n - 1 - k; // row from the top; the first point is the base
    const ya = y0 + j * bh;
    const yb = ya + bh;
    t = m.step(it.say, t, 2400);
    if (prev.length) m.dim(prev, t);
    const id = `py${k}`;
    const band: Pt[] = [
      [360 - hw(ya), ya],
      [360 + hw(ya), ya],
      [360 + hw(yb), yb],
      [360 - hw(yb), yb],
    ];
    m.poly(`${id}_p`, band, t + 150, { color: it.role, fill: it.role, fillAlpha: 0.3, width: 3, dur: 600, silent: false });
    const label = it.key ?? it.body;
    const avail = 2 * hw((ya + yb) / 2) - 44;
    let size = 26;
    while (size > 18 && tokenWidth(label, size) > avail) size -= 1;
    const ids: string[] = [];
    if (tokenWidth(label, size) <= avail) {
      ids.push(m.text(`${id}_t`, label, 360, (ya + yb) / 2, { size, color: 'ink', z: 5 }));
    } else {
      const f = bubbleFit(label, avail + 36, 2, 18);
      f.lines.forEach((ln, i) => ids.push(m.text(`${id}_t${i}`, ln, 360, (ya + yb) / 2 + f.lh * (i - (f.lines.length - 1) / 2), { size: f.size, color: 'ink', z: 5 })));
    }
    t = m.write(ids, t + 500, 100) + DUR.beat;
    prev = [`${id}_p`, ...ids];
  });
  m.hold(t + 1200);
  return m.build(900);
}

/* ---------------- flow, cycle, timeline (V51.9.51): subject-neutral pictures ---------------- */

/** Steps in order with an arrow from each to the next (a process: photosynthesis, digestion, a method). */
function buildFlow(plan: BoardPlan, lang: Lang, title: string): MotionScene {
  const items = itemsOf(plan, lang);
  const w = 580;
  const arrow = 34;
  const hs = items.map((it) => cardHeight(it, w));
  const H = Math.max(380, 96 + hs.reduce((a, b) => a + b, 0) + arrow * (items.length - 1) + 30);
  const m = frame(title, H);
  let t = heading(m, pick(plan.heading, lang) || title, 300);
  let y = 94;
  let prev: string[] = [];
  items.forEach((it, i) => {
    t = m.step(it.say, t, 2400);
    if (prev.length) m.dim(prev, t);
    if (i > 0) {
      const ay = y - arrow + 4;
      m.vector(`fa${i}`, 360, ay, 360, y - 4, t, { color: 'accent', width: 4, dur: 450 });
    }
    const c = drawCard(m, `fl${i}`, 360, y, w, it, t + (i > 0 ? 400 : 150));
    t = c.end + DUR.beat;
    if (c.key) {
      m.focus([c.key], t);
      t += 500;
    }
    prev = c.all;
    y += hs[i] + arrow;
  });
  m.hold(t + 1200);
  return m.build(900);
}

/** Where a ray from a rectangle's centre in direction (dx,dy) leaves the rectangle (distance along the unit ray). */
function exitDist(dx: number, dy: number, hw: number, hh: number): number {
  const ax = Math.abs(dx) < 1e-6 ? Infinity : hw / Math.abs(dx);
  const ay = Math.abs(dy) < 1e-6 ? Infinity : hh / Math.abs(dy);
  return Math.min(ax, ay);
}

/** 3–5 stages round a ring; the last arrow leads back to the first (water cycle, life cycle, a loop). */
function buildCycle(plan: BoardPlan, lang: Lang, title: string): MotionScene {
  const items = itemsOf(plan, lang);
  const n = items.length;
  const nw = n >= 5 ? 200 : 236;
  const meas = items.map((it) => measure({ ...it, icon: undefined }, nw + 76));
  const anyIcon = items.some((it) => it.icon);
  const nh = Math.max(...meas.map((x) => x.h)) + (anyIcon ? 50 : 0);
  const rx = 230;
  const ry = n === 3 ? 210 : 190;
  const cy = 96 + nh / 2 + 24 + ry;
  const H = cy + ry + nh / 2 + 40;
  const m = frame(title, H);
  let t = heading(m, pick(plan.heading, lang) || title, 300);
  const centre = (k: number): Pt => {
    const a = -Math.PI / 2 + (k / n) * Math.PI * 2;
    return [360 + rx * Math.cos(a), cy + ry * Math.sin(a)];
  };
  let prev: string[] = [];
  items.forEach((it, k) => {
    t = m.step(it.say, t, 2400);
    if (prev.length) m.dim(prev, t);
    const [x, y] = centre(k);
    const id = `cy${k}`;
    const ms = meas[k];
    const ids: string[] = [];
    m.poly(`${id}_c`, bubbleOutline(x, y, nw, nh), t + 150, { color: it.role, fill: it.role, fillAlpha: 0.16, width: 3, dur: 500, silent: true });
    ids.push(`${id}_c`);
    const texts: string[] = [];
    const total = (it.key ? 28 : 0) + ms.bodyLines.length * ms.lh;
    let ty = y - total / 2 + (anyIcon ? 26 : 0);
    if (it.icon) {
      const ic = drawIcon(m, `${id}_ic`, it.icon, x, y - nh / 2 + 32, 48, it.role, t + 250);
      ids.push(...ic.ids);
    }
    let keyId: string | undefined;
    if (it.key) {
      keyId = m.text(`${id}_k`, it.key, x, ty + 14, { size: Math.min(ms.keySize, 24), color: it.role, z: 5 });
      texts.push(keyId);
      ty += 28;
    }
    ms.bodyLines.forEach((ln, i) => texts.push(m.text(`${id}_t${i}`, ln, x, ty + ms.lh * (i + 0.5), { size: Math.min(ms.bodySize, 20), color: 'ink', z: 5 })));
    let e = m.write(texts, t + 350, 100);
    ids.push(...texts);
    if (k > 0) {
      const [px, py] = centre(k - 1);
      const dx = x - px;
      const dy = y - py;
      const len = Math.hypot(dx, dy);
      const ux = dx / len;
      const uy = dy / len;
      const d0 = exitDist(ux, uy, nw / 2, nh / 2) + 8;
      m.vector(`ca${k}`, px + ux * d0, py + uy * d0, x - ux * d0, y - uy * d0, t, { color: 'accent', width: 4, dur: 500 });
      ids.push(`ca${k}`);
      e = Math.max(e, t + 500);
    }
    t = Math.max(e, t + 700) + DUR.beat;
    if (k === n - 1) {
      const [px, py] = centre(k);
      const [qx, qy] = centre(0);
      const ux = (qx - px) / Math.hypot(qx - px, qy - py);
      const uy = (qy - py) / Math.hypot(qx - px, qy - py);
      const d0 = exitDist(ux, uy, nw / 2, nh / 2) + 8;
      t = m.vector('ca0', px + ux * d0, py + uy * d0, qx - ux * d0, qy - uy * d0, t, { color: 'accent', width: 4, dur: 600 }) + DUR.beat;
    }
    prev = ids;
  });
  m.hold(t + 1200);
  return m.build(900);
}

/** Events down a line, the date or year on the left, what happened on the right (history, a life, a process over time). */
function buildTimeline(plan: BoardPlan, lang: Lang, title: string): MotionScene {
  const items = itemsOf(plan, lang);
  const lineX = 196;
  const cardW = 440;
  const cardCx = 268 + cardW / 2;
  const fits = items.map((it) => {
    const body = it.key ? it.body.replace(it.key, '').replace(/^[\s,:;–-]+/, '').trim() || it.body : it.body;
    const f = bubbleFit(body, cardW - 8, 3, 22);
    return { f, h: Math.max(60, f.lines.length * f.lh + 24) };
  });
  const gap = 16;
  const ys: number[] = [];
  let y = 110;
  fits.forEach((x) => {
    ys.push(y + x.h / 2);
    y += x.h + gap;
  });
  const H = Math.max(380, y + 24);
  const m = frame(title, H);
  let t = heading(m, pick(plan.heading, lang) || title, 300);
  let prev: string[] = [];
  items.forEach((it, i) => {
    t = m.step(it.say, t, 2400);
    if (prev.length) m.dim(prev, t);
    const cy = ys[i];
    const ids: string[] = [];
    if (i > 0) {
      m.rule(`tl${i}`, lineX, ys[i - 1] + 8, lineX, cy - 8, t, { color: 'ink', width: 3 });
      ids.push(`tl${i}`);
    }
    m.dot(`td${i}`, lineX, cy, t + 200, { color: it.role, r: 9 });
    ids.push(`td${i}`);
    const date = it.key ?? String(it.n);
    const dsize = tokenWidth(date, 28) > 150 ? 20 : 28;
    const dId = m.text(`tk${i}`, date, 108, cy, { size: dsize, color: it.role, z: 5 });
    m.poly(`tc${i}`, bubbleOutline(cardCx, cy, cardW, fits[i].h), t + 250, { color: it.role, fill: it.role, fillAlpha: 0.12, width: 3, dur: 500, silent: true });
    const texts = fits[i].f.lines.map((ln, k) => m.text(`tt${i}_${k}`, ln, cardCx, cy + fits[i].f.lh * (k - (fits[i].f.lines.length - 1) / 2), { size: fits[i].f.size, color: 'ink', z: 5 }));
    const e = m.write([dId, ...texts], t + 350, 100);
    ids.push(`tc${i}`, dId, ...texts);
    t = Math.max(e, t + 700) + DUR.beat;
    prev = ids;
  });
  m.hold(t + 1200);
  return m.build(900);
}

export function buildConcept(plan: BoardPlan, lang: Lang, title: string): MotionScene[] {
  const layout = layoutOf(plan);
  if (layout === 'pyramid') return [buildPyramid(plan, lang, title)];
  if (layout === 'columns') return [buildColumns(plan, lang, title)];
  if (layout === 'flow') return [buildFlow(plan, lang, title)];
  if (layout === 'scale') return [buildScale(plan, lang, title)];
  if (layout === 'bars') return [buildBars(plan, lang, title)];
  if (layout === 'tree') return [buildTree(plan, lang, title)];
  if (layout === 'cycle') return [buildCycle(plan, lang, title)];
  if (layout === 'timeline') return [buildTimeline(plan, lang, title)];
  return [buildCards(plan, lang, title)];
}
