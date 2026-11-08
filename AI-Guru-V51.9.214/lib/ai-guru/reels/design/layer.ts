/**
 * V51.9.119 — the Reel designer's layer: what the student moved, resized and recoloured on the reel.
 *
 *  - Built-in parts (title card, board, caption, footer, background) keep their content but can be moved, made
 *    bigger or smaller, recoloured or hidden (`parts`).
 *  - Added items (text, sticker, shape, character, prop, photo) sit on top, at a place, size, angle and colour, for the
 *    whole reel or only during one part (a shot / a step), and can arrive with a little animation (`items`).
 *
 *  Places and sizes are fractions of the frame's width (and height for y), so a design survives a change of format.
 *  The engine draws all of it (draw.ts → drawDesign), so the preview and the MP4 are the same picture. Pure.
 */
import type { CastKind, Prop } from '../motion/recipes/story';
import type { ShapeKind as CardShape } from '../motion/look';

export type { CardShape };
export const CARD_SHAPES: CardShape[] = ['rounded', 'bubble', 'ribbon', 'sticky', 'speech'];
export const CARD_SHAPE_NAME: Record<CardShape, string> = { rounded: 'Rounded', bubble: 'Pill', ribbon: 'Ribbon', sticky: 'Sticky note', speech: 'Speech bubble' };

export type PartId = 'title' | 'board' | 'caption' | 'footer' | 'background';
export const PART_IDS: PartId[] = ['title', 'board', 'caption', 'footer', 'background'];
export const PART_NAME: Record<PartId, string> = { title: 'Title card', board: 'Board', caption: 'Caption', footer: 'Footer', background: 'Background' };

export interface PartOverride {
  dx?: number; // fraction of frame width
  dy?: number; // fraction of frame height
  scale?: number;
  /** Card / background colour. */
  fill?: string;
  /** Text colour. */
  text?: string;
  hidden?: boolean;
  /** V51.9.121: the card's shape (title and caption). */
  shape?: CardShape;
}

export type ItemKind = 'text' | 'sticker' | 'shape' | 'character' | 'prop' | 'photo';
export type ShapeKind = 'rect' | 'round' | 'circle' | 'arrow' | 'star' | 'heart';
export type Entrance = 'none' | 'pop' | 'fade' | 'slide' | 'bounce';
export const ENTRANCES: Entrance[] = ['pop', 'fade', 'slide', 'bounce', 'none'];
export const ENTRANCE_NAME: Record<Entrance, string> = { none: 'No animation', pop: 'Pop in', fade: 'Fade in', slide: 'Slide in', bounce: 'Bounce in' };

export interface DesignItem {
  id: string;
  kind: ItemKind;
  /** Centre, as fractions of the frame (x of width, y of height). */
  cx: number;
  cy: number;
  /** Size: width as a fraction of the frame width (text: its font size as a fraction of the width). */
  size: number;
  /** Degrees. */
  rot: number;
  color: string;
  opacity: number;
  /** Text: the words, font, bold, background pill colour ('' = none). */
  text?: string;
  font?: string;
  bold?: boolean;
  bg?: string;
  /** Sticker: an emoji. */
  emoji?: string;
  shape?: ShapeKind;
  cast?: CastKind;
  prop?: Prop;
  /** Photo: a small JPEG data URL; round = cut as a circle. */
  src?: string;
  round?: boolean;
  /** Shown only during this part of the reel (index), or the whole reel when null. */
  part: number | null;
  entrance: Entrance;
}

export interface DesignLayer { parts: Partial<Record<PartId, PartOverride>>; items: DesignItem[] }
export const EMPTY_DESIGN: DesignLayer = { parts: {}, items: [] };

export const SWATCHES = ['#111827', '#ffffff', '#ef4444', '#f97316', '#facc15', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#a16207', '#64748b'];
export const STICKERS = ['⭐', '🎉', '👍', '💡', '❓', '✅', '❌', '🔥', '🏆', '📚', '✏️', '🧠', '🌴', '🪔', '🐘', '🥥', '❤️', '😀', '😮', '👏'];

let seq = 0;
export const newId = () => `d${Date.now().toString(36)}${(seq++).toString(36)}`;

/** A new item of a kind, centred at (cx, cy). */
export function newItem(kind: ItemKind, o: Partial<DesignItem> = {}): DesignItem {
  const base: DesignItem = { id: newId(), kind, cx: 0.5, cy: 0.5, size: 0.2, rot: 0, color: '#111827', opacity: 1, part: null, entrance: 'pop' };
  const byKind: Partial<DesignItem> =
    kind === 'text' ? { text: 'Your text', size: 0.06, color: '#111827', bold: true, bg: '#facc15', font: 'rounded' }
      : kind === 'sticker' ? { emoji: '⭐', size: 0.16 }
        : kind === 'shape' ? { shape: 'round', size: 0.3, color: '#3b82f6' }
          : kind === 'character' ? { cast: 'girl', size: 0.2 }
            : kind === 'prop' ? { prop: 'book', size: 0.14 }
              : { size: 0.3, round: true };
  return { ...base, ...byKind, ...o, id: o.id ?? base.id };
}

/** Is this item on screen in part `partIndex`? */
export const visibleIn = (it: DesignItem, partIndex: number) => it.part === null || it.part === partIndex;

/** Entrance of an item `ms` after it appeared: opacity, scale and offset (fractions of width). */
export function entranceAt(e: Entrance, ms: number): { a: number; s: number; dx: number; dy: number } {
  const d = 450;
  if (e === 'none' || ms >= d) return { a: 1, s: 1, dx: 0, dy: 0 };
  const p = Math.max(0, ms / d);
  const out = 1 - Math.pow(1 - p, 3);
  if (e === 'fade') return { a: out, s: 1, dx: 0, dy: 0 };
  if (e === 'slide') return { a: out, s: 1, dx: -(1 - out) * 0.6, dy: 0 };
  if (e === 'bounce') { const b = p < 0.6 ? p / 0.6 : 1; const y = (1 - b) * -0.25 + (p >= 0.6 ? Math.sin(((p - 0.6) / 0.4) * Math.PI) * -0.03 : 0); return { a: Math.min(1, p * 3), s: 1, dx: 0, dy: y }; }
  // pop: grows a little past full size and settles
  const s = p < 0.7 ? 0.3 + (p / 0.7) * 0.82 : 1.12 - ((p - 0.7) / 0.3) * 0.12;
  return { a: Math.min(1, p * 2.5), s, dx: 0, dy: 0 };
}

/** Keeps every item's part inside the reel (a shorter reel moves items of missing parts to its last part). */
export function fitToParts(d: DesignLayer, partCount: number): DesignLayer {
  if (!d.items.some((i) => i.part !== null && i.part >= partCount)) return d;
  return { ...d, items: d.items.map((i) => (i.part !== null && i.part >= partCount ? { ...i, part: Math.max(0, partCount - 1) } : i)) };
}

/** Checks a design read back from storage (drops anything broken). */
export function cleanDesign(raw: unknown): DesignLayer {
  const o = (raw ?? {}) as Partial<DesignLayer>;
  const num = (v: unknown, lo: number, hi: number, dflt: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : dflt);
  const col = (v: unknown) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : undefined);
  const parts: DesignLayer['parts'] = {};
  for (const id of PART_IDS) {
    const p = (o.parts as Record<string, PartOverride> | undefined)?.[id];
    if (!p) continue;
    parts[id] = { dx: num(p.dx, -1, 1, 0), dy: num(p.dy, -1, 1, 0), scale: num(p.scale, 0.3, 2.5, 1), fill: col(p.fill), text: col(p.text), hidden: !!p.hidden, ...(CARD_SHAPES.includes(p.shape as CardShape) ? { shape: p.shape } : {}) };
  }
  const kinds: ItemKind[] = ['text', 'sticker', 'shape', 'character', 'prop', 'photo'];
  const items = (Array.isArray(o.items) ? o.items : []).filter((i): i is DesignItem => !!i && kinds.includes((i as DesignItem).kind)).slice(0, 60).map((i) => ({
    ...i,
    id: String(i.id || newId()),
    cx: num(i.cx, -0.5, 1.5, 0.5), cy: num(i.cy, -0.5, 1.5, 0.5), size: num(i.size, 0.01, 2, 0.2), rot: num(i.rot, -360, 360, 0),
    color: col(i.color) ?? '#111827', opacity: num(i.opacity, 0.05, 1, 1),
    part: typeof i.part === 'number' && i.part >= 0 ? Math.floor(i.part) : null,
    entrance: ENTRANCES.includes(i.entrance) ? i.entrance : 'pop',
    ...(i.kind === 'photo' && !(typeof i.src === 'string' && i.src.startsWith('data:image/')) ? { src: undefined } : {}),
  }));
  return { parts, items };
}

const KEY = 'ai-guru:reel-design:v1';
export function loadDesign(): DesignLayer { try { const s = localStorage.getItem(KEY); return s ? cleanDesign(JSON.parse(s)) : EMPTY_DESIGN; } catch { return EMPTY_DESIGN; } }
export function saveDesign(d: DesignLayer): boolean { try { localStorage.setItem(KEY, JSON.stringify(d)); return true; } catch { return false; } }

/** A design is empty when nothing was moved, recoloured or added. */
export const isEmptyDesign = (d: DesignLayer | null | undefined) => !d || (!d.items.length && !Object.values(d.parts).some((p) => p && (p.dx || p.dy || (p.scale && p.scale !== 1) || p.fill || p.text || p.hidden || p.shape)));
