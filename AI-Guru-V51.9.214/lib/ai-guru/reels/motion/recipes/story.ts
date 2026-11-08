/**
 * V51.9.118 — STORY REELS: a history, literature or Malayalam story lesson told in pictured shots.
 *
 *  A story is a cast and a list of shots. Each shot is one part of the reel: a setting (a Kerala village with
 *  coconut palms, a temple, a river with a vallam, a school …), the characters in it, a few props, the narrator's
 *  line and, if someone speaks, a speech bubble. Everything is drawn with the motion engine's own shapes, so voice,
 *  captions, music, looks, export and loudness work exactly as for the maths reels — and nothing is paid for.
 *
 *  The same character looks the same in every shot: skin, hair and clothes come from the character's id, never from
 *  chance. Characters slide in, walk across, or a bird flies in; the camera drifts slowly (no frozen picture) and moves
 *  close to whoever speaks.
 *
 *  Written for AI Guru; no third-party code.
 */

import { Motion, type MotionScene } from '../engine';
import { tokenWidth } from '../metrics';
import { estimateSpeechMs } from '../speech';
import type { Lang } from '../captions';

/* ---------------- the story ---------------- */

export const CAST_KINDS = ['boy', 'girl', 'man', 'woman', 'elder', 'grandmother', 'king', 'queen', 'teacher', 'sage', 'elephant', 'bird', 'tiger', 'monkey'] as const;
export type CastKind = (typeof CAST_KINDS)[number];
export const SETTINGS = ['village', 'home', 'school', 'temple', 'palace', 'forest', 'river', 'field', 'sea', 'night', 'market'] as const;
export type Setting = (typeof SETTINGS)[number];
export const PROPS = ['pot', 'pot-full', 'pebbles', 'book', 'lamp', 'basket', 'purse', 'well', 'ball'] as const;
export type Prop = (typeof PROPS)[number];
export const ACTIONS = ['stand', 'enter', 'walk', 'fly'] as const;
export type Action = (typeof ACTIONS)[number];

export const SETTING_NAME: Record<Setting, string> = { village: 'Village', home: 'Home', school: 'School', temple: 'Temple', palace: 'Palace', forest: 'Forest', river: 'River', field: 'Paddy field', sea: 'Seashore', night: 'Night', market: 'Market' };
export const KIND_NAME: Record<CastKind, string> = { boy: 'Boy', girl: 'Girl', man: 'Man', woman: 'Woman', elder: 'Old man', grandmother: 'Grandmother', king: 'King', queen: 'Queen', teacher: 'Teacher', sage: 'Sage', elephant: 'Elephant', bird: 'Bird', tiger: 'Tiger', monkey: 'Monkey' };
export const PROP_NAME: Record<Prop, string> = { pot: 'Pot', 'pot-full': 'Pot (full)', pebbles: 'Pebbles', book: 'Book', lamp: 'Lamp', basket: 'Basket', purse: 'Purse', well: 'Well', ball: 'Ball' };
export const ACTION_NAME: Record<Action, string> = { stand: 'Standing', enter: 'Come in', walk: 'Walk across', fly: 'Fly in' };

/** Text in English and (when known) Malayalam. */
export interface Bi { en: string; ml?: string }
export interface CastMember { id: string; name: Bi; kind: CastKind }
export interface Shot {
  setting: Setting;
  /** Cast ids in the shot, left to right (up to 4). */
  who: string[];
  action: Action;
  props?: Prop[];
  narration: Bi;
  /** Someone speaks: shown in a speech bubble. */
  line?: { who: string; text: Bi } | null;
}
export interface StoryBoard { title: Bi; cast: CastMember[]; shots: Shot[] }

export const pick = (b: Bi | undefined, lang: Lang): string => (b ? (lang === 'ml' ? b.ml?.trim() || b.en : b.en) : '');

/* ---------------- shapes ---------------- */

type Pt = [number, number];
const W = 720, H = 540, GROUND = 430;

const ellipse = (cx: number, cy: number, rx: number, ry: number, n = 18, a0 = 0, a1 = Math.PI * 2): Pt[] => {
  const full = Math.abs(a1 - a0) >= Math.PI * 2 - 1e-6;
  const k = full ? n : n - 1;
  return Array.from({ length: n }, (_, i) => { const a = a0 + ((a1 - a0) * i) / k; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry] as Pt; });
};
const rect = (x: number, y: number, w: number, h: number): Pt[] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
const shift = (p: Pt[], dx: number, dy = 0): Pt[] => p.map(([x, y]) => [x + dx, y + dy] as Pt);

/** A deterministic number 0..1 from text (the same id always gives the same look). */
export function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10007) / 10007;
}
const SKIN = ['#8d5524', '#a0662f', '#c68642', '#7a4a26', '#b07040', '#94603a'];
const OUTFIT = ['#e11d48', '#2563eb', '#16a34a', '#9333ea', '#ea580c', '#0891b2', '#ca8a04', '#db2777', '#0d9488'];
const ACCENT = ['#facc15', '#f97316', '#22c55e', '#38bdf8', '#f472b6', '#a3e635'];
const DARK = '#1f1410';

/** The fixed look of a cast member (tested: the same in every shot). */
export function lookOf(c: Pick<CastMember, 'id' | 'kind'>): { skin: string; outfit: string; accent: string; hair: string } {
  const a = hash01(`${c.id}:skin`), b = hash01(`${c.id}:outfit`), d = hash01(`${c.id}:accent`);
  const outfit = c.kind === 'sage' ? '#f59e0b' : c.kind === 'king' ? '#7c3aed' : OUTFIT[Math.floor(b * OUTFIT.length)];
  return { skin: SKIN[Math.floor(a * SKIN.length)], outfit, accent: ACCENT[Math.floor(d * ACCENT.length)], hair: c.kind === 'elder' || c.kind === 'grandmother' || c.kind === 'sage' ? '#e5e7eb' : DARK };
}

/* ---------------- drawing on the board ---------------- */

interface Piece { id: string; pts: Pt[] }

/** Anything that can take filled shapes and lines (the board's Painter, or a list for stickers). */
export interface Sink {
  shape(pts: Pt[], fill: string, o?: { stroke?: string; width?: number; closed?: boolean; alpha?: number }): unknown;
  line(pts: Pt[], color: string, width: number): unknown;
}

class Painter implements Sink {
  pieces: Piece[] = [];
  constructor(private m: Motion, private prefix: string, private t: number, private z: number, private dur = 1) {}
  /** A filled shape (outline in a darker tone). */
  shape(pts: Pt[], fill: string, o: { stroke?: string; width?: number; closed?: boolean; alpha?: number } = {}) {
    const id = `${this.prefix}${this.pieces.length}`;
    const closed = o.closed ?? true;
    this.m.poly(id, pts, this.t, { color: o.stroke ?? (closed ? shade(fill) : fill), width: o.width ?? 2, fill: closed ? fill : undefined, fillAlpha: o.alpha ?? 1, closed, dur: this.dur, z: this.z, silent: true, background: true });
    this.pieces.push({ id, pts });
    return id;
  }
  line(pts: Pt[], color: string, width: number) { return this.shape(pts, color, { closed: false, width, stroke: color }); }
}

/** A darker tone of a colour (outlines). */
export function shade(hex: string, k = 0.68): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * k));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/* ----- settings ----- */

function palm(p: Painter, x: number, base: number, h: number, lean = 1) {
  const top: Pt = [x + 26 * lean, base - h];
  p.line([[x, base], [x + 10 * lean, base - h * 0.5], top], '#7c4a1e', 9);
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI + (i * Math.PI) / 5;
    p.line([top, [top[0] + Math.cos(a) * 40, top[1] + Math.sin(a) * 18 - 6], [top[0] + Math.cos(a) * 66, top[1] + Math.sin(a) * 14 + 14]], '#15803d', 6);
  }
  p.shape(ellipse(top[0], top[1] + 6, 7, 7, 10), '#a16207');
}
function hut(p: Painter, x: number, w: number, wall = '#d7a86e', roof = '#8d4e2a', lit = false) {
  p.shape(rect(x, GROUND - 70, w, 70), wall);
  p.shape([[x - 14, GROUND - 66], [x + w / 2, GROUND - 120], [x + w + 14, GROUND - 66]], roof);
  p.shape(rect(x + w / 2 - 11, GROUND - 40, 22, 40), lit ? '#fde047' : '#5b3a1a');
}
function tree(p: Painter, x: number, base: number, s = 1, green = '#16a34a') {
  p.shape(rect(x - 7 * s, base - 70 * s, 14 * s, 70 * s), '#78350f');
  p.shape(ellipse(x, base - 100 * s, 46 * s, 40 * s), green);
  p.shape(ellipse(x - 28 * s, base - 78 * s, 28 * s, 22 * s), shade(green, 0.85));
  p.shape(ellipse(x + 28 * s, base - 80 * s, 28 * s, 22 * s), shade(green, 0.9));
}
function waves(p: Painter, y0: number, y1: number, color: string) {
  for (let y = y0 + 14; y < y1; y += 24) for (let x = 20 + ((y / 24) % 2) * 40; x < W; x += 110) p.line([[x, y], [x + 16, y - 6], [x + 32, y]], color, 3);
}
function boat(p: Painter, x: number, y: number) {
  p.shape([[x - 70, y - 14], [x + 70, y - 14], [x + 52, y + 8], [x - 52, y + 8]], '#7c2d12');
  p.line([[x - 70, y - 14], [x - 82, y - 30]], '#7c2d12', 6);
  p.line([[x + 70, y - 14], [x + 82, y - 30]], '#7c2d12', 6);
}

export function drawSetting(m: Motion, s: Setting, t: number, prefix = 'bg'): string[] {
  const p = new Painter(m, prefix, t, -3, 360);
  const sky = (c: string, to = GROUND) => p.shape(rect(0, 0, W, to), c, { stroke: c });
  const ground = (c: string, from = GROUND) => p.shape(rect(0, from, W, H - from), c, { stroke: c });
  const sun = (x = 600, y = 80, r = 34) => p.shape(ellipse(x, y, r, r), '#fbbf24', { stroke: '#f59e0b' });
  switch (s) {
    case 'village':
      sky('#9bd7f5'); sun(); ground('#7cb342');
      p.shape(ellipse(180, 70, 46, 16), '#ffffff', { stroke: '#e2e8f0' });
      hut(p, 70, 120); hut(p, 470, 110, '#e8c48f', '#9a3412');
      palm(p, 300, GROUND, 230, 1); palm(p, 650, GROUND, 250, -1);
      break;
    case 'home':
      p.shape(rect(0, 0, W, GROUND), '#f3d9b1', { stroke: '#f3d9b1' }); ground('#b07a4a');
      p.shape(rect(80, 90, 150, 120), '#7dd3fc', { stroke: '#7c4a1e', width: 6 });
      for (let i = 1; i < 4; i++) p.line([[80 + i * 37.5, 90], [80 + i * 37.5, 210]], '#7c4a1e', 4);
      p.shape(rect(420, 380, 210, 40), '#b91c1c');
      p.shape([[650, 400], [672, 400], [666, 330], [656, 330]], '#ca8a04'); p.shape(ellipse(661, 322, 10, 6), '#fde047');
      break;
    case 'school':
      p.shape(rect(0, 0, W, GROUND), '#fde68a', { stroke: '#fde68a' }); ground('#a16207');
      p.shape(rect(170, 70, 380, 170), '#14532d', { stroke: '#78350f', width: 8 });
      p.line([[200, 120], [260, 120]], '#f8fafc', 3); p.line([[200, 150], [330, 150]], '#f8fafc', 3); p.line([[200, 180], [300, 180]], '#f8fafc', 3);
      p.shape(rect(560, 330, 120, 20), '#92400e'); p.line([[575, 350], [575, 420]], '#78350f', 6); p.line([[665, 350], [665, 420]], '#78350f', 6);
      break;
    case 'temple':
      sky('#fcd9a0'); ground('#c9a26b');
      for (let i = 0; i < 4; i++) { const w = 220 - i * 46, y = GROUND - 90 - i * 46; p.shape(rect(360 - w / 2, y, w, 46), i % 2 ? '#b45309' : '#c2410c'); }
      p.shape(rect(330, GROUND - 90, 60, 90), '#78350f');
      p.shape(ellipse(360, GROUND - 278, 12, 12), '#facc15');
      p.shape([[110, GROUND], [130, GROUND], [124, GROUND - 120], [116, GROUND - 120]], '#a16207'); p.shape(ellipse(120, GROUND - 128, 14, 7), '#fde047');
      palm(p, 620, GROUND, 220, -1);
      break;
    case 'palace':
      sky('#c7d2fe'); ground('#e5e7eb');
      for (const x of [90, 230, 490, 630]) { p.shape(rect(x - 18, 120, 36, GROUND - 120), '#f5f5f4', { stroke: '#a8a29e' }); p.shape(rect(x - 26, 108, 52, 16), '#ca8a04'); }
      p.shape(ellipse(360, 150, 120, 70, 18, Math.PI, Math.PI * 2), '#fde68a', { stroke: '#ca8a04' });
      p.shape(rect(320, 300, 80, 130), '#ca8a04'); p.shape(rect(330, 360, 60, 30), '#b91c1c');
      break;
    case 'forest':
      sky('#a7f3d0'); ground('#4d7c0f');
      tree(p, 90, GROUND, 1.2); tree(p, 250, GROUND - 10, 0.9, '#15803d'); tree(p, 470, GROUND, 1.1, '#166534'); tree(p, 640, GROUND - 6, 1.3);
      for (const x of [170, 380, 560]) p.shape(ellipse(x, GROUND, 40, 18, 14, Math.PI, Math.PI * 2), '#65a30d');
      break;
    case 'river':
      sky('#bae6fd'); sun(120, 80, 30); ground('#65a30d', GROUND - 120);
      p.shape(rect(0, GROUND - 90, W, 60), '#0ea5e9', { stroke: '#0ea5e9' }); waves(p, GROUND - 90, GROUND - 30, '#e0f2fe');
      boat(p, 470, GROUND - 62);
      ground('#84cc16', GROUND - 30);
      palm(p, 640, GROUND - 120, 170, -1);
      break;
    case 'field':
      sky('#fef3c7'); sun(560, 90, 46);
      p.shape([[0, 300], [140, 220], [300, 300], [470, 230], [720, 300], [720, 320], [0, 320]], '#86efac', { stroke: '#4ade80' });
      ground('#a3e635', 300);
      for (let y = 320; y < H; y += 26) for (let x = 20 + (y % 52); x < W; x += 52) p.line([[x, y + 10], [x - 6, y - 6]], '#4d7c0f', 3);
      break;
    case 'sea':
      sky('#93c5fd'); sun(600, 90, 36);
      p.shape(rect(0, 230, W, 120), '#0369a1', { stroke: '#0369a1' }); waves(p, 230, 350, '#bae6fd');
      boat(p, 220, 300);
      ground('#fde68a', 350);
      palm(p, 660, 380, 220, -1);
      break;
    case 'night':
      sky('#0f172a'); p.shape(ellipse(580, 90, 34, 34), '#fef9c3'); p.shape(ellipse(596, 82, 30, 30), '#0f172a', { stroke: '#0f172a' });
      for (let i = 0; i < 18; i++) { const x = 30 + hash01(`star${i}`) * 660, y = 20 + hash01(`sy${i}`) * 220; p.shape(ellipse(x, y, 2.4, 2.4, 6), '#f8fafc', { stroke: '#f8fafc' }); }
      ground('#14532d'); hut(p, 90, 120, '#334155', '#1e293b', true); hut(p, 470, 110, '#334155', '#1e293b', true);
      palm(p, 330, GROUND, 220, 1);
      break;
    case 'market':
      sky('#fde2e4'); ground('#d6d3d1');
      [70, 290, 510].forEach((x, k) => {
        p.shape(rect(x, GROUND - 100, 150, 60), '#a16207');
        for (let i = 0; i < 5; i++) p.shape(rect(x - 10 + i * 34, GROUND - 170, 34, 30), i % 2 ? '#ffffff' : ['#dc2626', '#2563eb', '#16a34a'][k], { stroke: '#94a3b8' });
        p.line([[x, GROUND - 140], [x, GROUND - 40]], '#78350f', 5); p.line([[x + 150, GROUND - 140], [x + 150, GROUND - 40]], '#78350f', 5);
        for (let i = 0; i < 4; i++) p.shape(ellipse(x + 26 + i * 32, GROUND - 108, 12, 12, 10), ['#f97316', '#facc15', '#ef4444', '#84cc16'][(i + k) % 4]);
      });
      break;
  }
  return p.pieces.map((x) => x.id);
}

/* ----- props ----- */

function drawProp(p: Sink, prop: Prop, x: number) {
  const g = GROUND + 4;
  switch (prop) {
    case 'pot': case 'pot-full':
      p.shape(ellipse(x, g - 34, 34, 34), '#b45309');
      p.shape(rect(x - 16, g - 82, 32, 20), '#b45309');
      p.shape(ellipse(x, g - 82, 18, 6, 12), prop === 'pot-full' ? '#38bdf8' : '#451a03');
      break;
    case 'pebbles':
      for (let i = 0; i < 7; i++) p.shape(ellipse(x - 30 + (i % 4) * 20, g - 8 - Math.floor(i / 4) * 12, 9, 7, 10), ['#9ca3af', '#6b7280', '#a8a29e'][i % 3]);
      break;
    case 'book':
      p.shape(rect(x - 30, g - 14, 60, 14), '#1d4ed8'); p.shape(rect(x - 27, g - 18, 54, 4), '#f8fafc');
      break;
    case 'lamp':
      p.shape([[x - 12, g], [x + 12, g], [x + 5, g - 70], [x - 5, g - 70]], '#ca8a04'); p.shape(ellipse(x, g - 74, 16, 6, 12), '#eab308'); p.shape(ellipse(x, g - 86, 5, 9, 10), '#f97316');
      break;
    case 'basket':
      p.shape(ellipse(x, g - 18, 38, 20, 16, 0, Math.PI), '#a16207');
      for (let i = 0; i < 4; i++) p.shape(ellipse(x - 24 + i * 16, g - 22, 9, 9, 10), ['#ef4444', '#f97316', '#84cc16', '#facc15'][i]);
      p.line(ellipse(x, g - 22, 34, 34, 12, Math.PI, Math.PI * 2), '#78350f', 4);
      break;
    case 'purse':
      p.shape(rect(x - 20, g - 22, 40, 22), '#be123c'); p.shape(ellipse(x, g - 22, 8, 5, 10), '#fbbf24');
      break;
    case 'well':
      p.shape(rect(x - 44, g - 60, 88, 60), '#9ca3af'); p.shape(ellipse(x, g - 60, 44, 10), '#1e3a8a');
      p.line([[x - 40, g - 60], [x - 40, g - 130]], '#78350f', 6); p.line([[x + 40, g - 60], [x + 40, g - 130]], '#78350f', 6); p.line([[x - 48, g - 130], [x + 48, g - 130]], '#78350f', 7);
      break;
    case 'ball':
      p.shape(ellipse(x, g - 16, 16, 16), '#ef4444'); p.line([[x - 16, g - 16], [x + 16, g - 16]], '#ffffff', 3);
      break;
  }
}

/* ----- characters (feet at x, GROUND) ----- */

function drawFigure(p: Sink, c: CastMember, x: number, talking: boolean, face: 1 | -1) {
  const L = lookOf(c);
  const y = GROUND;
  const eyes = (ex: number, ey: number, gap: number, r = 2.8) => { p.shape(ellipse(ex - gap, ey, r, r, 8), DARK); p.shape(ellipse(ex + gap, ey, r, r, 8), DARK); };
  switch (c.kind) {
    case 'elephant': {
      const f = face;
      p.shape(rect(x - 52, y - 60, 22, 60), '#6b7280'); p.shape(rect(x + 18, y - 60, 22, 60), '#6b7280');
      p.shape(ellipse(x - 8, y - 92, 78, 54), '#9ca3af');
      p.shape(rect(x - 34, y - 60, 22, 60), '#9ca3af'); p.shape(rect(x + 36, y - 60, 22, 60), '#9ca3af');
      p.shape(ellipse(x + f * 66, y - 118, 38, 36), '#9ca3af');
      p.shape(ellipse(x + f * 48, y - 118, 24, 32), '#6b7280');
      p.line([[x + f * 96, y - 112], [x + f * 110, y - 70], [x + f * 102, y - 36]], '#9ca3af', 14);
      p.shape(ellipse(x + f * 78, y - 128, 3.5, 3.5, 8), DARK);
      return { head: [x + f * 66, y - 160] as Pt };
    }
    case 'tiger': {
      const f = face;
      p.line([[x - f * 66, y - 70], [x - f * 96, y - 100], [x - f * 104, y - 84]], '#ea580c', 8);
      for (const dx of [-44, -20, 22, 44]) p.shape(rect(x + dx - 7, y - 50, 14, 50), '#ea580c');
      p.shape(ellipse(x, y - 70, 70, 32), '#f97316');
      for (const dx of [-36, -12, 12]) p.line([[x + dx, y - 98], [x + dx + 6, y - 74]], DARK, 5);
      p.shape(ellipse(x + f * 70, y - 92, 30, 28), '#f97316');
      p.shape(ellipse(x + f * 54, y - 118, 8, 8, 8), '#ea580c'); p.shape(ellipse(x + f * 84, y - 118, 8, 8, 8), '#ea580c');
      p.shape(ellipse(x + f * 76, y - 84, 14, 10), '#fff7ed');
      eyes(x + f * 70, y - 98, 9, 3);
      return { head: [x + f * 70, y - 126] as Pt };
    }
    case 'bird': {
      // a crow by default: black with a grey neck
      const f = face;
      p.line([[x - 6, y], [x - 4, y - 24]], '#f59e0b', 4); p.line([[x + 8, y], [x + 6, y - 24]], '#f59e0b', 4);
      p.shape([[x - f * 40, y - 46], [x - f * 70, y - 60], [x - f * 66, y - 40]], '#111827');
      p.shape(ellipse(x, y - 46, 40, 24), '#1f2937');
      p.shape(ellipse(x - f * 4, y - 48, 26, 13), '#111827');
      p.shape(ellipse(x + f * 34, y - 72, 20, 19), '#374151');
      p.shape([[x + f * 50, y - 76], [x + f * 74, y - 70], [x + f * 50, y - 64]], '#f59e0b');
      p.shape(ellipse(x + f * 40, y - 78, 4, 4, 8), '#f8fafc'); p.shape(ellipse(x + f * 41, y - 78, 2, 2, 6), DARK);
      return { head: [x + f * 34, y - 92] as Pt };
    }
    case 'monkey': {
      p.line([[x + 20, y - 40], [x + 54, y - 60], [x + 50, y - 96], [x + 36, y - 100]], '#78350f', 6);
      p.line([[x - 12, y - 40], [x - 16, y]], '#92400e', 8); p.line([[x + 12, y - 40], [x + 16, y]], '#92400e', 8);
      p.shape(ellipse(x, y - 64, 26, 34), '#92400e');
      p.line([[x - 22, y - 80], [x - 40, y - (talking ? 120 : 50)]], '#92400e', 8); p.line([[x + 22, y - 80], [x + 36, y - 50]], '#92400e', 8);
      p.shape(ellipse(x - 22, y - 120, 9, 9, 10), '#a16207'); p.shape(ellipse(x + 22, y - 120, 9, 9, 10), '#a16207');
      p.shape(ellipse(x, y - 116, 24, 24), '#92400e'); p.shape(ellipse(x, y - 110, 16, 14), '#fde68a');
      eyes(x, y - 116, 7); p.line([[x - 6, y - 104], [x, y - 101], [x + 6, y - 104]], DARK, 2);
      return { head: [x, y - 142] as Pt };
    }
  }
  // people
  const small = c.kind === 'boy' || c.kind === 'girl';
  const s = small ? 0.8 : c.kind === 'elder' || c.kind === 'grandmother' ? 0.94 : 1;
  const Y = (v: number) => y - v * s, X = (v: number) => x + v * s;
  const female = c.kind === 'girl' || c.kind === 'woman' || c.kind === 'queen' || c.kind === 'grandmother' || (c.kind === 'teacher' && hash01(`${c.id}:g`) > 0.5);
  // legs, lower garment
  p.line([[X(-10), Y(72)], [X(-12), Y(0)]], L.skin, 8 * s); p.line([[X(10), Y(72)], [X(12), Y(0)]], L.skin, 8 * s);
  if (c.kind === 'boy') p.shape([[X(-24), Y(98)], [X(24), Y(98)], [X(26), Y(58)], [X(-26), Y(58)]], '#1e3a8a');
  else if (female) p.shape([[X(-20), Y(112)], [X(20), Y(112)], [X(c.kind === 'girl' ? 34 : 30), Y(c.kind === 'girl' ? 44 : 2)], [X(c.kind === 'girl' ? -34 : -30), Y(c.kind === 'girl' ? 44 : 2)]], c.kind === 'girl' ? L.outfit : L.outfit);
  else p.shape([[X(-24), Y(98)], [X(24), Y(98)], [X(26), Y(6)], [X(-26), Y(6)]], c.kind === 'sage' ? '#f59e0b' : c.kind === 'king' ? '#fde68a' : '#f8fafc', { stroke: '#cbd5e1' });
  if (!female && c.kind !== 'boy' && c.kind !== 'sage' && c.kind !== 'king') p.line([[X(-26), Y(40)], [X(26), Y(40)]], c.kind === 'elder' ? '#94a3b8' : '#ca8a04', 3); // mundu border
  // body
  const top = c.kind === 'elder' || c.kind === 'grandmother' ? '#f8fafc' : L.outfit;
  p.shape([[X(-24), Y(150)], [X(24), Y(150)], [X(21), Y(94)], [X(-21), Y(94)]], top);
  if (female && c.kind !== 'girl') p.shape([[X(-24), Y(150)], [X(-12), Y(150)], [X(24), Y(96)], [X(12), Y(94)]], L.accent); // saree drape
  if (c.kind === 'king' || c.kind === 'queen') p.shape([[X(-24), Y(150)], [X(24), Y(150)], [X(24), Y(140)], [X(-24), Y(140)]], '#facc15');
  // arms (the speaker raises one)
  p.line([[X(-24), Y(144)], [X(-32), Y(96)]], L.skin, 7 * s);
  p.line([[X(24), Y(144)], talking ? [X(46), Y(178)] : [X(32), Y(96)]], L.skin, 7 * s);
  if (c.kind === 'teacher') p.shape(rect(X(-50), Y(112), 26 * s, 32 * s), '#1d4ed8');
  if (c.kind === 'elder') p.line([[X(-34), Y(98)], [X(-40), Y(0)]], '#78350f', 5);
  // head
  p.shape(rect(X(-6), Y(158), 12 * s, 10 * s), L.skin);
  p.shape(ellipse(X(0), Y(178), 22 * s, 24 * s), L.skin);
  p.shape(ellipse(X(0), Y(186), 23 * s, 18 * s, 14, Math.PI, Math.PI * 2), L.hair);
  if (c.kind === 'girl') { p.shape(ellipse(X(-22), Y(160), 6 * s, 14 * s, 10), L.hair); p.shape(ellipse(X(22), Y(160), 6 * s, 14 * s, 10), L.hair); p.shape(ellipse(X(0), Y(202), 6, 6, 8), L.accent); }
  if (c.kind === 'woman' || c.kind === 'grandmother' || c.kind === 'queen' || (c.kind === 'teacher' && female)) p.shape(ellipse(X(-20), Y(190), 11 * s, 11 * s, 10), L.hair);
  if (c.kind === 'sage') p.shape([[X(-16), Y(170)], [X(16), Y(170)], [X(0), Y(128)]], '#f1f5f9', { stroke: '#cbd5e1' });
  if (c.kind === 'king' || c.kind === 'queen') p.shape([[X(-18), Y(198)], [X(-18), Y(222)], [X(-9), Y(210)], [X(0), Y(226)], [X(9), Y(210)], [X(18), Y(222)], [X(18), Y(198)]], '#facc15', { stroke: '#ca8a04' });
  if (female && c.kind !== 'girl') p.shape(ellipse(X(0), Y(184), 2.5, 2.5, 6), '#dc2626'); // pottu
  eyes(X(0), Y(178), 8 * s);
  p.line(talking ? ellipse(X(0), Y(166), 5 * s, 4 * s, 10) : [[X(-6), Y(168)], [X(0), Y(165)], [X(6), Y(168)]], DARK, 2);
  return { head: [X(0), Y(206)] as Pt };
}

/* ---------------- shots → scenes ---------------- */

/** Feet positions for n characters (left to right). */
export function slots(n: number): number[] {
  if (n <= 1) return [360];
  if (n === 2) return [235, 485];
  if (n === 3) return [150, 360, 570];
  return [110, 270, 450, 610];
}
const PROP_X = [600, 505, 115];

/** Breaks a speech-bubble line into rows that fit `maxW` at `size`. */
export function wrap(text: string, size: number, maxW: number, maxRows = 3): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const rows: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && tokenWidth(next, size) > maxW) { rows.push(cur); cur = w; } else cur = next;
  }
  if (cur) rows.push(cur);
  if (rows.length > maxRows) { const keep = rows.slice(0, maxRows); keep[maxRows - 1] = `${keep[maxRows - 1].replace(/[.,;:!?]?$/, '')}…`; return keep; }
  return rows;
}

export function buildStoryShot(board: StoryBoard, index: number, lang: Lang): MotionScene {
  const shot = board.shots[index];
  const title = pick(board.title, lang) || 'Story';
  const m = new Motion(title, W, H);
  m.fixView(W / 2, W);
  const cast = new Map(board.cast.map((c) => [c.id, c]));
  const who = shot.who.map((id) => cast.get(id)).filter((c): c is CastMember => !!c).slice(0, 4);
  const xs = slots(who.length);
  const firstSeen = new Set<string>();
  board.shots.slice(0, index).forEach((s) => s.who.forEach((id) => firstSeen.add(id)));

  drawSetting(m, shot.setting, 0);
  const props = new Painter(m, 'prop', 200, -1, 1);
  (shot.props ?? []).slice(0, 3).forEach((p, k) => drawProp(props, p, PROP_X[k]));

  // the camera drifts slowly in, so the picture is never still
  m.camY.set(0, H / 2); m.camH.set(0, H);

  const speaker = shot.line?.who;
  const heads = new Map<string, Pt>();
  const enterAt = 260;
  who.forEach((c, k) => {
    const x = xs[k];
    const face: 1 | -1 = x > W / 2 ? -1 : 1;
    const talk = !!speaker && speaker === c.id;
    // where it starts: off the side (come in / walk), above (fly) or in place
    const from = shot.action === 'enter' ? (x < W / 2 ? -180 : W + 180) : shot.action === 'walk' ? x - 150 : x;
    const dy = shot.action === 'fly' && (c.kind === 'bird') ? -300 : 0;
    const fp = new Painter(m, `c${k}_`, enterAt + k * 120, 2 + k * 0.01, 1);
    const { head } = drawFigure(fp, c, from, talk, face);
    heads.set(c.id, [head[0] + (x - from), head[1]]);
    let arrive = enterAt + k * 120 + 300;
    if (from !== x || dy) {
      // draw it at the start and slide every piece to its place
      const t0 = enterAt + k * 120 + 80;
      const dur = shot.action === 'walk' ? 2600 : shot.action === 'fly' ? 1300 : 1100;
      arrive = t0 + dur;
      for (const piece of fp.pieces) {
        if (dy) { const it = m.get(piece.id); it.points = shift(piece.pts, 0, dy); }
        m.morph(piece.id, shift(piece.pts, x - from, 0), t0, { dur });
      }
    }
    // the name under a character the first time the story shows it
    if (!firstSeen.has(c.id)) {
      const nm = pick(c.name, lang);
      if (nm) {
        // on a white tag, so it reads on every setting (night, river, forest …)
        const tw = tokenWidth(nm, 22, '700') + 22;
        new Painter(m, `tag${k}_`, arrive, 3.5, 1).shape(rect(x - tw / 2, GROUND + 18, tw, 32), '#ffffff', { stroke: '#cbd5e1' });
        const id = m.text(`name${k}`, nm, x, GROUND + 34, { size: 22, weight: '700', color: '#111827', z: 4 });
        m.appear(id, arrive, 0, false);
      }
    }
  });

  // narration
  const narr = pick(shot.narration, lang);
  // without a voice-over the caption stays long enough to read
  const tNarr = m.step(narr, 300, Math.max(2600, estimateSpeechMs(narr, lang) + 600));
  let t = tNarr;
  m.hold(t + 2200);

  // someone speaks: a bubble above their head, the camera moves a little closer to them
  const line = shot.line && pick(shot.line.text, lang);
  const sp = speaker ? cast.get(speaker) : undefined;
  if (line && sp) {
    const capt = `${pick(sp.name, lang) || KIND_NAME[sp.kind]}: “${line}”`;
    t = m.step(capt, t + 200, Math.max(2400, estimateSpeechMs(line, lang) + 500), line);
    m.camH.to(tNarr + 200, Math.max(300, t - tNarr - 400), H * 0.94); // the slow drift ends where the close-up begins
    const head = heads.get(sp.id) ?? [360, 220];
    const size = 24;
    const rows = wrap(line, size, 360);
    const bw = Math.max(...rows.map((r) => tokenWidth(r, size))) + 36;
    const bh = rows.length * (size * 1.3) + 26;
    const bx = Math.max(12, Math.min(W - bw - 12, head[0] - bw / 2));
    const by = Math.max(12, head[1] - bh - 40);
    const tipX = Math.max(bx + 24, Math.min(bx + bw - 24, head[0]));
    const bubble = new Painter(m, 'bub', t, 6, 1);
    bubble.shape([...rect(bx, by, bw, bh).slice(0, 3), [tipX + 14, by + bh], [tipX, head[1] - 6], [tipX - 14, by + bh], [bx, by + bh]], '#ffffff', { stroke: '#111827', width: 3 });
    const ids = rows.map((r, i) => m.text(`say${i}`, r, bx + bw / 2, by + 13 + size * 0.65 + i * size * 1.3, { size, color: '#111827', z: 7 }));
    m.write(ids, t + 120, 160, 360);
    const k = who.findIndex((c) => c.id === sp.id);
    if (k >= 0) m.look(t, Math.min(H / 2, GROUND - 140), H * 0.8, 900, Math.max(250, Math.min(W - 250, xs[k])));
    m.hold(t + 2200);
  } else m.camH.to(tNarr + 200, 5200, H * 0.92);
  const scene = m.build(700);
  scene.group = 'story';
  scene.pill = lang === 'ml' ? 'കഥ' : 'STORY';
  return scene;
}

/** All the shots of a story, as reel parts. */
export function buildStory(board: StoryBoard, lang: Lang): MotionScene[] {
  if (!board.shots.length) throw new Error('This story has no shots yet.');
  return board.shots.map((_, i) => buildStoryShot(board, i, lang));
}

/* ---------------- V51.9.119: characters and props as stickers (the Reel designer) ---------------- */

export interface ShapeOp { pts: Pt[]; fill: string; stroke: string; width: number; closed: boolean }
class Collect implements Sink {
  ops: ShapeOp[] = [];
  shape(pts: Pt[], fill: string, o: { stroke?: string; width?: number; closed?: boolean } = {}) { const closed = o.closed ?? true; this.ops.push({ pts, fill, stroke: o.stroke ?? (closed ? shade(fill) : fill), width: o.width ?? 2, closed }); }
  line(pts: Pt[], color: string, width: number) { this.ops.push({ pts, fill: color, stroke: color, width, closed: false }); }
}
/** The shapes of a character or a prop, and their bounds (design units, feet / base at y = GROUND). */
export function stickerShapes(what: { cast: CastKind; id?: string; talking?: boolean; face?: 1 | -1 } | { prop: Prop }): { ops: ShapeOp[]; box: { x0: number; y0: number; x1: number; y1: number } } {
  const c = new Collect();
  if ('cast' in what) drawFigure(c, { id: what.id ?? what.cast, name: { en: '' }, kind: what.cast }, 0, !!what.talking, what.face ?? 1);
  else drawProp(c, what.prop, 0);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const o of c.ops) for (const [x, y] of o.pts) { const h = o.closed ? 0 : o.width / 2; x0 = Math.min(x0, x - h); x1 = Math.max(x1, x + h); y0 = Math.min(y0, y - h); y1 = Math.max(y1, y + h); }
  return { ops: c.ops, box: { x0, y0, x1, y1 } };
}
