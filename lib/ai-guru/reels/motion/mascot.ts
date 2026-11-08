/**
 * Deepa — AI Guru's own mascot (V51.9.46): a little diya lamp whose flame is the body. A diya is the
 * Indian lamp of knowledge, so the character belongs to the app and to no other video series.
 *
 * She is built from ordinary engine items (a teardrop polygon, two eyes, two pupils, a mouth, two
 * brows, two cheeks, a lamp dish), so every verb works on her and every theme draws her. Poses are
 * morphs of the same items, never a different drawing:
 *
 *   idle   friendly smile, looking at the viewer
 *   think  eyes up to one side, small round mouth, one brow raised
 *   ask    wide eyes, brows up, open mouth  ("but why?")
 *   cheer  closed happy eyes, big smile, a hop
 *
 * Bubbles are outlined (no fill), like the reference style, so they read on the white and the black board.
 */

import type { Motion } from './engine';
import { tokenWidth } from './metrics';

export type Pose = 'idle' | 'think' | 'ask' | 'cheer';
export const POSES: Pose[] = ['idle', 'think', 'ask', 'cheer'];

type Pt = [number, number];

const BODY = '#ffb020';
const BODY_EDGE = '#e07b00';
const GLOW = '#ffe27a';
const DISH = '#a8602a';
const CHEEK = '#ff7a7a';
/** Dark enough to read on white eyes, light enough that the black board does not turn it white. */
const PUPIL = '#4033b0';

/** Local design: the flame body is about 100 wide and 140 tall, centred near (0, 0); the dish sits at y ≈ +72. */
const EYE_X = 16;
const EYE_Y = 6;
const MOUTH_Y = 32;

/** A teardrop (pointed top, round bottom) of half-width r and height h centred at (0, 0). */
export function teardrop(r: number, h: number, n = 40): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const x = r * Math.sin(t) * Math.pow(Math.sin(t / 2), 1.3);
    const y = (-h / 2) * Math.cos(t);
    pts.push([x, y]);
  }
  return pts;
}

function ellipse(cx: number, cy: number, rx: number, ry: number, n = 12): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    return [cx + rx * Math.cos(t), cy + ry * Math.sin(t)] as Pt;
  });
}

/** A mouth outline of 12 points: upper edge left→right, lower edge right→left. Same count for every pose so poses morph. */
function mouth(cx: number, w: number, up: number, low: number): Pt[] {
  const top: Pt[] = [];
  const bot: Pt[] = [];
  for (let i = 0; i < 6; i++) {
    const u = i / 5;
    const x = -w + 2 * w * u;
    const s = Math.sqrt(Math.max(0, 1 - (x / w) ** 2));
    top.push([cx + x, MOUTH_Y - up * s]);
    bot.push([cx + x, MOUTH_Y + low * s]);
  }
  return [...top, ...bot.reverse()];
}

/** A brow of 3 points on the side (−1 left, +1 right): inner end, middle, outer end. */
function brow(side: -1 | 1, raise: number, tilt: number): Pt[] {
  const x0 = side * (EYE_X - 9);
  const x1 = side * EYE_X;
  const x2 = side * (EYE_X + 9);
  const y = EYE_Y - 20 - raise;
  return [
    [x0, y + tilt],
    [x1, y - 3],
    [x2, y - tilt],
  ];
}

interface PoseSpec {
  eyeRx: number;
  eyeRy: number;
  /** Pupil offset (dx, dy); null hides the pupils (closed eyes). */
  pupil: Pt | null;
  mouth: Pt[];
  browL: Pt[];
  browR: Pt[];
}

/** `look` is +1 when the thought is up and to the right of her, −1 up and to the left. */
function spec(pose: Pose, look: 1 | -1): PoseSpec {
  switch (pose) {
    case 'think':
      return { eyeRx: 10.5, eyeRy: 12, pupil: [4.5 * look, -5], mouth: mouth(5 * look, 5, 4, 4), browL: brow(-1, look > 0 ? 0 : 5, 2), browR: brow(1, look > 0 ? 5 : 0, 2) };
    case 'ask':
      return { eyeRx: 12, eyeRy: 15, pupil: [0, 0], mouth: mouth(0, 7, 8, 8), browL: brow(-1, 7, 4), browR: brow(1, 7, 4) };
    case 'cheer':
      return { eyeRx: 11, eyeRy: 2, pupil: null, mouth: mouth(0, 16, 1, 15), browL: brow(-1, 5, -2), browR: brow(1, 5, -2) };
    default:
      return { eyeRx: 11, eyeRy: 13, pupil: [0, 1], mouth: mouth(0, 12, 0.5, 6), browL: brow(-1, 0, 1), browR: brow(1, 0, 1) };
  }
}

export interface Mascot {
  /** Every item of the character (for dim / fadeOut / move). */
  ids: string[];
  x: number;
  y: number;
  s: number;
  pose: Pose;
  look: 1 | -1;
  /** Item ids by part. */
  parts: { body: string; glow: string; dish: string; eyeL: string; eyeR: string; pupL: string; pupR: string; mouth: string; browL: string; browR: string; cheekL: string; cheekR: string };
  /** The size of the character on the board (design units): half-width and the top and bottom reach from (x, y). */
  box: { x0: number; x1: number; y0: number; y1: number };
}

export interface PoseOptions {
  look?: 1 | -1;
  dur?: number;
}

const place = (m: Mascot, p: Pt): Pt => [m.x + p[0] * m.s, m.y + p[1] * m.s];

/** Draws Deepa at (x, y) (the middle of her body) at scale s, in `pose`, starting at time t. Returns her and the time she is done. */
export function drawMascot(m: Motion, prefix: string, x: number, y: number, s: number, t: number, pose: Pose = 'idle', look: 1 | -1 = 1): { mascot: Mascot; end: number } {
  const id = (k: string) => `${prefix}_${k}`;
  const sp = spec(pose, look);
  const mc: Mascot = {
    ids: [],
    x,
    y,
    s,
    pose,
    look,
    parts: { body: id('body'), glow: id('glow'), dish: id('dish'), eyeL: id('eyeL'), eyeR: id('eyeR'), pupL: id('pupL'), pupR: id('pupR'), mouth: id('mouth'), browL: id('browL'), browR: id('browR'), cheekL: id('cheekL'), cheekR: id('cheekR') },
    box: { x0: x - 52 * s, x1: x + 52 * s, y0: y - 72 * s, y1: y + 86 * s },
  };
  const P = (pts: Pt[]) => pts.map((p) => place(mc, p));
  const common = { silent: true, z: 4 } as const;
  m.poly(mc.parts.dish, P([[-40, 70], [40, 70], [30, 86], [-30, 86]]), t, { ...common, color: DISH, fill: DISH, fillAlpha: 0.9, width: 2.5, dur: 400, z: 3 });
  m.poly(mc.parts.body, P(teardrop(50, 146)), t + 150, { ...common, color: BODY_EDGE, fill: BODY, fillAlpha: 0.95, width: 3.5, dur: 650, z: 4 });
  m.poly(mc.parts.glow, P(teardrop(26, 70).map(([px, py]) => [px, py + 34] as Pt)), t + 350, { ...common, color: GLOW, fill: GLOW, fillAlpha: 0.9, width: 1, dur: 450, z: 4 });
  const eyes = { ...common, color: 'ink', fill: '#ffffff', fillAlpha: 1, width: 2.5, dur: 350, z: 6 };
  m.poly(mc.parts.eyeL, P(ellipse(-EYE_X, EYE_Y, sp.eyeRx, sp.eyeRy)), t + 600, eyes);
  m.poly(mc.parts.eyeR, P(ellipse(EYE_X, EYE_Y, sp.eyeRx, sp.eyeRy)), t + 600, eyes);
  const pupil = sp.pupil ?? [0, 1];
  const pl = place(mc, [-EYE_X + pupil[0], EYE_Y + pupil[1]]);
  const pr = place(mc, [EYE_X + pupil[0], EYE_Y + pupil[1]]);
  m.dot(mc.parts.pupL, pl[0], pl[1], t + 800, { color: PUPIL, r: 5.2 * s });
  m.dot(mc.parts.pupR, pr[0], pr[1], t + 800, { color: PUPIL, r: 5.2 * s });
  m.get(mc.parts.pupL).z = 7;
  m.get(mc.parts.pupR).z = 7;
  const cl = place(mc, [-30, 22]);
  const cr = place(mc, [30, 22]);
  m.dot(mc.parts.cheekL, cl[0], cl[1], t + 800, { color: CHEEK, r: 6 * s });
  m.dot(mc.parts.cheekR, cr[0], cr[1], t + 800, { color: CHEEK, r: 6 * s });
  m.get(mc.parts.cheekL).fillAlpha.set(0, 0.55);
  m.get(mc.parts.cheekR).fillAlpha.set(0, 0.55);
  m.poly(mc.parts.mouth, P(sp.mouth), t + 900, { ...common, color: '#7a2a1a', fill: '#7a2a1a', fillAlpha: 0.9, width: 2.5, dur: 300, z: 6 });
  m.poly(mc.parts.browL, P(sp.browL), t + 900, { ...common, color: BODY_EDGE, closed: false, width: 3.5, dur: 250, z: 6 });
  m.poly(mc.parts.browR, P(sp.browR), t + 900, { ...common, color: BODY_EDGE, closed: false, width: 3.5, dur: 250, z: 6 });
  mc.ids = Object.values(mc.parts);
  if (!sp.pupil) {
    m.fadeOut([mc.parts.pupL, mc.parts.pupR], t + 1000, 50);
  }
  return { mascot: mc, end: t + 1250 };
}

/** Moves her face into another pose (eyes, pupils, mouth, brows morph). Returns the time it is done. */
export function setPose(m: Motion, mc: Mascot, pose: Pose, t: number, o: PoseOptions = {}): number {
  const look = o.look ?? mc.look;
  const dur = o.dur ?? 450;
  const sp = spec(pose, look);
  const P = (pts: Pt[]) => pts.map((p) => place(mc, p));
  m.morph(mc.parts.eyeL, P(ellipse(-EYE_X, EYE_Y, sp.eyeRx, sp.eyeRy)), t, { dur });
  m.morph(mc.parts.eyeR, P(ellipse(EYE_X, EYE_Y, sp.eyeRx, sp.eyeRy)), t, { dur });
  m.morph(mc.parts.mouth, P(sp.mouth), t, { dur });
  m.morph(mc.parts.browL, P(sp.browL), t, { dur });
  m.morph(mc.parts.browR, P(sp.browR), t, { dur });
  if (sp.pupil) {
    const pl = place(mc, [-EYE_X + sp.pupil[0], EYE_Y + sp.pupil[1]]);
    const pr = place(mc, [EYE_X + sp.pupil[0], EYE_Y + sp.pupil[1]]);
    m.move(mc.parts.pupL, pl[0], pl[1], t, { dur, sound: false });
    m.move(mc.parts.pupR, pr[0], pr[1], t, { dur, sound: false });
    if (mc.pose === 'cheer') m.appear([mc.parts.pupL, mc.parts.pupR], t + dur * 0.5, 0, false);
  } else {
    m.fadeOut([mc.parts.pupL, mc.parts.pupR], t, dur * 0.6);
  }
  mc.pose = pose;
  mc.look = look;
  return t + dur;
}

/** A little hop of the whole character (cheering). */
export function hopMascot(m: Motion, mc: Mascot, t: number, height = 18): number {
  let end = t;
  for (const id of mc.ids) {
    const p = m.pos(id, t);
    end = m.move(id, p.x, p.y, t, { dur: 520, arc: height * mc.s, sound: false });
  }
  return end;
}

/* ---------------- bubbles ---------------- */

function wrap(text: string, size: number, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && tokenWidth(next, size) > maxW) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** The size of a bubble that holds `text` in at most `maxW` width: lines, font size, and the box. */
export function bubbleFit(text: string, maxW: number, maxLines: number, startSize = 26): { lines: string[]; size: number; w: number; h: number; lh: number } {
  let size = startSize;
  let lines = wrap(text, size, maxW - 36);
  while (lines.length > maxLines && size > 15) {
    size -= 1;
    lines = wrap(text, size, maxW - 36);
  }
  const lh = Math.round(size * 1.35);
  const textW = Math.max(...lines.map((l) => tokenWidth(l, size)));
  return { lines, size, w: Math.min(maxW, Math.max(120, textW + 44)), h: lines.length * lh + 30, lh };
}

/** A rounded rectangle as a closed outline; with a tail on the bottom edge when `tail` is given (tip below the box). */
export function bubbleOutline(cx: number, cy: number, w: number, h: number, tail?: { tipX: number; tipY: number }): Pt[] {
  const r = Math.min(20, h / 2, w / 2);
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  const y0 = cy - h / 2;
  const y1 = cy + h / 2;
  const pts: Pt[] = [];
  const arc = (ax: number, ay: number, from: number, to: number) => {
    for (let i = 0; i <= 5; i++) {
      const a = from + ((to - from) * i) / 5;
      pts.push([ax + r * Math.cos(a), ay + r * Math.sin(a)]);
    }
  };
  arc(x1 - r, y0 + r, -Math.PI / 2, 0); // top right
  arc(x1 - r, y1 - r, 0, Math.PI / 2); // bottom right
  if (tail) {
    const base = Math.max(x0 + r + 24, Math.min(x1 - r - 8, tail.tipX + 30));
    pts.push([base, y1], [tail.tipX, tail.tipY], [Math.max(x0 + r + 2, base - 28), y1]);
  }
  arc(x0 + r, y1 - r, Math.PI / 2, Math.PI); // bottom left
  arc(x0 + r, y0 + r, Math.PI, (3 * Math.PI) / 2); // top left
  return pts;
}

/** A cloud outline (scalloped ellipse) as a closed polygon. */
export function cloudOutline(cx: number, cy: number, w: number, h: number, n = 60): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + 0.07 * Math.abs(Math.sin(a * 5));
    return [cx + (w / 2) * Math.cos(a) * k, cy + (h / 2) * Math.sin(a) * k] as Pt;
  });
}

export interface Bubble {
  ids: string[];
  /** Text lines (ids), to write. */
  lines: string[];
  box: { x0: number; x1: number; y0: number; y1: number };
}

export interface BubbleOptions {
  /** Centre of the bubble. */
  x: number;
  y: number;
  maxW?: number;
  maxLines?: number;
  size?: number;
  /** Where the tail points (a speech tail) or where the dots of a thought trail toward. */
  toward: Pt;
  color?: string;
}

/** Creates a speech bubble at time t (outline drawn by pen; the text is created hidden: write `lines`). */
export function speechBubble(m: Motion, prefix: string, text: string, t: number, o: BubbleOptions): Bubble {
  const fit = bubbleFit(text, o.maxW ?? 560, o.maxLines ?? 4, o.size ?? 26);
  const tip: Pt = [Math.max(o.x - fit.w / 2 + 14, Math.min(o.x + fit.w / 2 - 14, o.toward[0])), o.y + fit.h / 2 + 34];
  const outline = bubbleOutline(o.x, o.y, fit.w, fit.h, { tipX: tip[0], tipY: tip[1] });
  const ids: string[] = [];
  m.poly(`${prefix}_o`, outline, t, { color: o.color ?? 'ink', closed: true, width: 3, dur: 600, z: 2, silent: true });
  ids.push(`${prefix}_o`);
  const lines = fit.lines.map((ln, i) => {
    const id = `${prefix}_t${i}`;
    m.text(id, ln, o.x, o.y - fit.h / 2 + 15 + fit.lh * (i + 0.5), { size: fit.size, color: 'ink', z: 5 });
    ids.push(id);
    return id;
  });
  return { ids, lines, box: { x0: o.x - fit.w / 2, x1: o.x + fit.w / 2, y0: o.y - fit.h / 2, y1: tip[1] } };
}

/** Creates a thought bubble (cloud plus three dots trailing toward `toward`) at time t. */
export function thoughtBubble(m: Motion, prefix: string, text: string, t: number, o: BubbleOptions): Bubble {
  const fit = bubbleFit(text, o.maxW ?? 540, o.maxLines ?? 4, o.size ?? 26);
  const w = fit.w + 60;
  const h = fit.h + 44;
  const ids: string[] = [];
  m.poly(`${prefix}_o`, cloudOutline(o.x, o.y, w, h), t, { color: o.color ?? 'ink', closed: true, width: 3, dur: 700, z: 2, silent: true });
  ids.push(`${prefix}_o`);
  const start: Pt = [o.x + (o.toward[0] - o.x) * 0.0, o.y + h / 2 + 4];
  const dx = o.toward[0] - start[0];
  const dy = o.toward[1] - start[1];
  [0.16, 0.5, 0.82].forEach((u, i) => {
    const r = [13, 9, 6][i];
    const cx = start[0] + dx * u * 0.8;
    const cy = start[1] + dy * u * 0.8 + 6;
    const id = `${prefix}_d${i}`;
    m.poly(id, ellipse(cx, cy, r * 1.25, r, 14), t + 300 + i * 150, { color: o.color ?? 'ink', closed: true, width: 2.5, dur: 300, z: 2, silent: true });
    ids.push(id);
  });
  const lines = fit.lines.map((ln, i) => {
    const id = `${prefix}_t${i}`;
    m.text(id, ln, o.x, o.y - ((fit.lines.length - 1) * fit.lh) / 2 + i * fit.lh, { size: fit.size, color: 'ink', z: 5 });
    ids.push(id);
    return id;
  });
  return { ids, lines, box: { x0: o.x - w / 2, x1: o.x + w / 2, y0: o.y - h / 2, y1: o.toward[1] } };
}
