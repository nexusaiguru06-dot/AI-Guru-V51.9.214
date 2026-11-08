/**
 * Draws a MotionScene into a reel frame (title pill, @handle, board, step caption).
 * Works with any CanvasRenderingContext2D-compatible context (browser canvas,
 * OffscreenCanvas, @napi-rs/canvas in tests).
 */

import { drawExplainerFrame } from '../explainer/draw';
import { drawDesignItems } from '../design/draw-design';
import type { DesignLayer, PartId, PartOverride } from '../design/layer';
import { FONT, ROLE } from './grammar';
import { drawBrandMark } from './brand';
import { profileLines, profileWhatsapp, type StudentProfile } from '../../student/profile';
import { captionAt, sceneStateAt, type Caption, type Item, type ItemState, type MotionScene } from './engine';
import { reelPartAt, type MotionReel } from './reel';
import { drawLayer3d } from './layer3d';
import { FRAC_SCALE, RAD_SIGN, SYM_WIDTH, SUP_SCALE, parseFrac, richRuns, runWidth, tokenWidth } from './metrics';
import { drawTeacherBubble, type TeacherOnReel } from './avatar-draw';
import { drawBgVideo, type BgVideoDraw } from './bg-video';
import { CLASSIC, LOOK_FONT, NIGHT, lookColor, onColor, rgba, roleMap, withBoardFont, type FontKind, type ReelLook } from './look';
import { TRANSITION_MS, beginTransition, drawBoard, drawCard, endTransition } from './look-draw';
import { boardFx, type CameraKind } from './camera';
import { beatKindOf, hashText, movesFor, pickBeatPresets, readMovesSetting, shotAt, type Box, type CameraPresetId, type Flavour, type MovesMode, type MovesSetting, type Shot, type ShotInput } from './camera-presets';
import { drawSeasonDecor, type SeasonId } from './season';

export type ReelFormat = 'square' | 'vertical' | 'landscape';

export const FORMAT_SIZE: Record<ReelFormat, { width: number; height: number }> = {
  square: { width: 1080, height: 1080 },
  vertical: { width: 1080, height: 1920 },
  landscape: { width: 1280, height: 720 },
};

// Minimal structural type so the module works with DOM and @napi-rs/canvas.
type Ctx = CanvasRenderingContext2D;

export interface DrawOptions {
  format: ReelFormat;
  /** V51.9.157 (Way 4): a stock video behind the reel, shaded so the lesson stays readable. */
  bgVideo?: BgVideoDraw | null;
  handle?: string;
  /** Label of the step pill, e.g. "STEP" / "ഘട്ടം". */
  stepLabel?: string;
  /** Added to step numbers (multi-part reels keep counting). */
  stepOffset?: number;
  /** Show the second-language caption line when the reel has one (default true). */
  subtitles?: boolean;
  /** 'dark' = black board with light ink (the 3Blue1Brown look). Default 'light' (white whiteboard). */
  theme?: 'light' | 'dark';
  /** V51.9.66: the AI Guru footer (logo, tagline, follow pill) and the student's details, on vertical frames. Off by default. */
  footer?: boolean;
  student?: StudentProfile | null;
  /**
   * V51.9.99: the student's photo (square, already decoded), drawn on downloaded reels only when the
   * student switched "show my photo on my reels" on: beside their details in the footer, beside the
   * link on square reels, and as "Shared by" on the closing cards.
   */
  photo?: CanvasImageSource | null;
  /** True while an MP4 is being made: the logo (title card, footer) is drawn only then, not in the live class. */
  download?: boolean;
  /** V51.9.100: the teacher's face in a corner bubble, lips moving with the voice (null / absent = no bubble). */
  teacher?: TeacherOnReel | null;
  /** Reel time of this frame (set by drawReelFrame; the bubble's mouth follows the whole reel's voice track). */
  reelT?: number;
  /** V51.9.101: the reel's look (board, colours, shapes, fonts, transitions). Default: classic, or night with theme 'dark'. */
  look?: ReelLook | null;
  /** V51.9.101: extra camera moves on the board (close-ups, drift). Default 'steady' (none). */
  camera?: CameraKind;
  /**
   * V51.9.161: the camera presets (push-in, crash zoom, whip pan …), one per step, on top of a 'steady' camera.
   * Absent = the student's setting on this device (Auto: calm in the live class, lively in a downloaded video).
   * With Auto, a camera other than 'steady' (punch, drift, close-ups) keeps its own moves; Calm or Lively replace it.
   */
  moves?: MovesSetting;
  /** V51.9.101: little badges beside the student's details ("🍬 120 toffees", "🔥 5-day streak", "Class 9A"). */
  badges?: string[];
  /** V51.9.101: seasonal decorations behind the board (Onam, Vishu, Christmas …). */
  season?: SeasonId | null;
  /** V51.9.101 duet: the teacher's face, shown asking on the 'duet-ask' scene (the student's face is `teacher`). */
  duet?: TeacherOnReel | null;
  /** V51.9.101 speed run: a stopwatch on the board between these reel times (ms). */
  stopwatch?: { from: number; to: number } | null;
  /** V51.9.106: the font of the maths on the board (the reel must have been built with the same one). */
  boardFont?: FontKind | null;
  /** V51.9.110 (interactive class): each step's caption written small, to the right of the line it wrote. */
  stepNotes?: boolean;
  /** V51.9.111: with the notes, small step buttons (# ✓ ^ ⟲) after each line; their places go to `stepButtonsOf(canvas)`. */
  stepButtons?: boolean;
  /** Reel time at which this part starts (set by drawReelFrame). */
  partStartMs?: number;
  /** The class is paused (the current step's # shows filled). */
  stepPaused?: boolean;
  /** V51.9.119: the Reel designer's changes: built-in parts moved / resized / recoloured, and added items on top. */
  design?: DesignLayer | null;
  /** The reel is paused in the designer: added items show in full, without their entrance. */
  designStill?: boolean;
}

/** V51.9.111: a step button drawn on the board, in canvas pixels, with the reel times it acts on. */
export interface StepButton { x: number; y: number; w: number; h: number; action: 'pause' | 'go' | 'up' | 'restart'; stepMs: number; prevMs: number; current: boolean }
const BUTTONS = new WeakMap<object, StepButton[]>();
/** The step buttons drawn in the last frame on this canvas (for clicks). */
export const stepButtonsOf = (canvas: object): StepButton[] => BUTTONS.get(canvas) ?? [];

/* ---- theme: set once per frame; items keep their build-time colours and are remapped here ---- */
let DARK = false;
/** V51.9.101: the look of this frame, its colour map and the font of its cards / captions. */
let LK: ReelLook = CLASSIC;
let LKMAP = roleMap(CLASSIC);
let UI: string = FONT.ui;
const P = () => LK.palette;
/** Frame transform drawMotionFrame starts from (identity; a transition moves / scales it for a moment). */
let BASE: [number, number, number, number, number, number] = [1, 0, 0, 1, 0, 0];
const HALO = () => LK.palette.roles?.halo ?? ROLE.halo;
function setLook(opts: DrawOptions) {
  const next = opts.look ?? (opts.theme === 'dark' ? NIGHT : CLASSIC);
  if (next !== LK) { LK = next; LKMAP = roleMap(next); }
  DARK = LK.palette.dark;
  UI = LOOK_FONT[LK.font];
}
function lum(hex: string): number {
  const f = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(1) + 0.7152 * f(3) + 0.0722 * f(5);
}
/** Very dark ink (the whiteboard's navy and near-black) becomes light on the black board; role colours stay. */
/** The QR card keeps its own black-on-white colours on every look (a re-coloured QR would not scan). */
let NOREMAP = false;
/** V51.9.118: the reel being drawn is a story (its footer's words change). */
let STORY_REEL = false;
const th = (c: string): string => (NOREMAP ? c : lookColor(c, LK, LKMAP));

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Layout {
  /** Design units → pixels. */
  k: number;
  dw: number;
  dh: number;
  title: Rect;
  handleY: number;
  board: Rect;
  caption: Rect;
}

/** The problem card: wrapped text sized to fit, and the card's height. */
interface ProblemFit {
  lines: string[];
  size: number;
  lh: number;
  h: number;
}

function fitProblem(ctx: Ctx, text: string, format: ReelFormat): ProblemFit {
  const maxW = format === 'landscape' ? 960 : 640;
  const maxLines = format === 'vertical' ? 6 : format === 'square' ? 3 : 2;
  const start = format === 'vertical' ? 32 : format === 'square' ? 26 : 26;
  const clean = text.replace(/\s+/g, ' ').trim();
  let size = start;
  let lines: string[] = [];
  for (; size >= 15; size -= 1) {
    ctx.font = `600 ${size}px ${UI}`;
    lines = wrap(ctx, clean, maxW);
    if (lines.length <= maxLines) break;
  }
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    let last = lines[maxLines - 1];
    while (last.length > 4 && ctx.measureText(`${last}…`).width > maxW) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last.trimEnd()}…`;
  }
  const lh = Math.round(size * 1.3);
  return { lines, size, lh, h: 30 + lines.length * lh + 14 };
}

/** With the footer the caption moves up and the board gets a little shorter (vertical frames only). */
function withFooter(L: Layout, format: ReelFormat, footer?: boolean): Layout {
  if (footer && format === 'landscape') return { ...L, caption: { ...L.caption, y: 588, h: 92 } };
  if (!footer || format !== 'vertical') return L;
  return { ...L, board: { ...L.board, h: Math.min(L.board.h, 925 - L.board.y) }, caption: { ...L.caption, y: 945, h: 118 } };
}

function layoutFor(format: ReelFormat, prob?: ProblemFit | null, footer?: boolean): Layout {
  return withFooter(layoutFor0(format, prob), format, footer);
}

/** V51.9.119: the rectangles of the frame's built-in parts (design units), for the designer's handles. */
export function designPartRects(format: ReelFormat, footer?: boolean): { dw: number; dh: number; rects: Partial<Record<PartId, Rect>> } {
  const L = layoutFor(format, null, footer);
  const rects: Partial<Record<PartId, Rect>> = { title: partRectOf('title', L)!, board: L.board, caption: L.caption };
  if (footer && format === 'vertical') rects.footer = partRectOf('footer', L)!;
  return { dw: L.dw, dh: L.dh, rects };
}
function partRectOf(id: PartId, L: Layout): Rect | null {
  if (id === 'title') return { x: L.title.x, y: L.title.y, w: L.title.w, h: Math.max(L.title.h, L.handleY + 16 - L.title.y) };
  if (id === 'board') return L.board;
  if (id === 'caption') return L.caption;
  if (id === 'footer') return { x: 0, y: L.caption.y + L.caption.h + 8, w: L.dw, h: L.dh - (L.caption.y + L.caption.h + 8) };
  return null;
}

/**
 * V51.9.119: draws one built-in part with the designer's changes: moved, scaled about its centre, its card and text
 * colours swapped in, or not at all when hidden.
 */
function withPart(ctx: Ctx, L: Layout, over: PartOverride | undefined, rect: Rect | null, draw: () => void): void {
  if (!over) { draw(); return; }
  if (over.hidden) return;
  ctx.save();
  if (rect && (over.dx || over.dy || (over.scale && over.scale !== 1))) {
    const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2, k = over.scale ?? 1;
    ctx.translate(cx + (over.dx ?? 0) * L.dw, cy + (over.dy ?? 0) * L.dh);
    ctx.scale(k, k);
    ctx.translate(-cx, -cy);
  }
  const keep = LK;
  if (over.shape) LK = { ...LK, shape: over.shape };
  if (over.fill || over.text) {
    const pal = { ...LK.palette };
    if (over.fill) { pal.panel = over.fill; pal.paper = over.fill; }
    if (over.text) { pal.panelText = over.text; pal.text = over.text; pal.cap = { ...pal.cap, idle: over.text, spoken: over.text, next: over.text }; }
    LK = { ...LK, palette: pal };
  }
  try { draw(); } finally { LK = keep; ctx.restore(); }
}

function layoutFor0(format: ReelFormat, prob?: ProblemFit | null): Layout {
  const L = baseLayout(format);
  if (!prob) return L;
  // The problem card takes the place of the title pill and the handle; the board starts under it.
  if (format === 'vertical') {
    const top = 56;
    const bottom = top + prob.h;
    return { ...L, title: { x: 18, y: top, w: 684, h: prob.h }, handleY: bottom + 26, board: { x: 0, y: bottom + 44, w: 720, h: 985 - (bottom + 44) } };
  }
  if (format === 'landscape') {
    const top = 6;
    const bottom = top + prob.h;
    return { ...L, title: { x: 140, y: top, w: 1000, h: prob.h }, handleY: bottom + 12, board: { x: 0, y: bottom + 22, w: 1280, h: 584 - (bottom + 22) } };
  }
  const top = 6;
  const bottom = top + prob.h;
  return { ...L, title: { x: 12, y: top, w: 696, h: prob.h }, handleY: bottom + 16, board: { x: 0, y: bottom + 28, w: 720, h: 584 - (bottom + 28) } };
}

function baseLayout(format: ReelFormat): Layout {
  const { width } = FORMAT_SIZE[format];
  if (format === 'vertical') {
    const k = width / 720;
    return {
      k, dw: 720, dh: 1280,
      title: { x: 18, y: 70, w: 684, h: 84 },
      handleY: 190,
      board: { x: 0, y: 215, w: 720, h: 760 },
      caption: { x: 34, y: 1000, w: 652, h: 150 },
    };
  }
  if (format === 'landscape') {
    const k = width / 1280;
    return {
      k, dw: 1280, dh: 720,
      title: { x: 220, y: 10, w: 840, h: 70 },
      handleY: 100,
      board: { x: 0, y: 110, w: 1280, h: 470 },
      caption: { x: 200, y: 590, w: 880, h: 118 },
    };
  }
  const k = width / 720;
  return {
    k, dw: 720, dh: 720,
    title: { x: 12, y: 8, w: 696, h: 72 },
    handleY: 118,
    board: { x: 0, y: 128, w: 720, h: 450 },
    caption: { x: 34, y: 590, w: 652, h: 112 },
  };
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

function fitFont(ctx: Ctx, text: string, maxW: number, start: number, weight: string, family: string): number {
  let px = start;
  for (; px > 12; px -= 1) {
    ctx.font = `${weight} ${px}px ${family}`;
    if (ctx.measureText(text).width <= maxW) break;
  }
  return px;
}

function wrap(ctx: Ctx, text: string, maxW: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

/* ---------------- maths text ---------------- */

/** ∪ ∩ ∅ ∈ as pen strokes: the board font has no glyph for them. `x` is the left edge of the symbol's box. */
function drawSymbol(ctx: Ctx, sym: string, x: number, cy: number, px: number) {
  const w = px * SYM_WIDTH;
  const x0 = x + w * 0.16;
  const x1 = x + w * 0.84;
  const mx = (x0 + x1) / 2;
  const r = (x1 - x0) / 2;
  const top = cy - px * 0.34;
  const bot = cy + px * 0.3;
  ctx.save();
  ctx.lineWidth = Math.max(1.6, px * 0.075);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'butt';
  ctx.beginPath();
  if (sym === '∪') {
    ctx.moveTo(x0, top);
    ctx.lineTo(x0, bot - r);
    ctx.arc(mx, bot - r, r, Math.PI, 0, true);
    ctx.lineTo(x1, top);
  } else if (sym === '∩') {
    ctx.moveTo(x0, bot);
    ctx.lineTo(x0, top + r);
    ctx.arc(mx, top + r, r, Math.PI, 0, false);
    ctx.lineTo(x1, bot);
  } else if (sym === '∅') {
    ctx.arc(mx, cy - px * 0.02, px * 0.27, 0, Math.PI * 2);
    ctx.moveTo(mx - px * 0.34, cy + px * 0.3);
    ctx.lineTo(mx + px * 0.34, cy - px * 0.34);
  } else {
    // ∈
    const q = px * 0.18;
    ctx.moveTo(x1, top + px * 0.04);
    ctx.lineTo(x0 + q, top + px * 0.04);
    ctx.quadraticCurveTo(x0, top + px * 0.04, x0, cy - px * 0.02);
    ctx.quadraticCurveTo(x0, bot, x0 + q, bot);
    ctx.lineTo(x1, bot);
    ctx.moveTo(x0, cy - px * 0.02);
    ctx.lineTo(x1 - px * 0.04, cy - px * 0.02);
  }
  ctx.stroke();
  ctx.restore();
}

function drawRich(ctx: Ctx, src: string, cx: number, cy: number, px: number, weight: string) {
  const runs = richRuns(src);
  const total = runs.reduce((w, r) => w + runWidth(r, px, weight), 0);
  let x = cx - total / 2;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (const r of runs) {
    if (r.sym) {
      drawSymbol(ctx, r.text, x, cy, px);
      x += px * SYM_WIDTH;
      continue;
    }
    if (r.rad) {
      // The board font has no √, so the radical is a drawn path: tick, down-stroke, rise, overbar.
      const sw = px * RAD_SIGN;
      const w = runWidth(r, px, weight);
      x += px * 0.1; // air between the sign and whatever stands before it
      const wEnd = w - px * 0.1;
      const top = cy - px * 0.52;
      const bot = cy + px * 0.4;
      ctx.save();
      ctx.lineWidth = Math.max(1.6, px * 0.07);
      ctx.lineJoin = 'miter';
      ctx.beginPath();
      ctx.moveTo(x + sw * 0.02, cy + px * 0.08);
      ctx.lineTo(x + sw * 0.2, cy + px * 0.02);
      ctx.lineTo(x + sw * 0.5, bot);
      ctx.lineTo(x + sw * 0.9, top);
      ctx.lineTo(x + wEnd - px * 0.04, top);
      ctx.stroke();
      ctx.restore();
      ctx.font = `${weight} ${px}px ${FONT.math}`;
      ctx.fillText(r.text, x + sw + px * 0.04, cy + px * 0.04);
      x += wEnd;
      continue;
    }
    const size = r.sup || r.sub ? px * SUP_SCALE : px;
    ctx.font = `${weight} ${size}px ${FONT.math}`;
    ctx.fillText(r.text, x + (r.sup || r.sub ? px * 0.02 : 0), r.sup ? cy - px * 0.3 : r.sub ? cy + px * 0.22 : cy);
    x += runWidth(r, px, weight);
  }
}

/** Plain, superscript or fraction token, centred on (cx, cy). */
export function drawToken(ctx: Ctx, src: string, cx: number, cy: number, px: number, weight = '400') {
  const f = parseFrac(src);
  if (!f) {
    drawRich(ctx, src, cx, cy, px, weight);
    return;
  }
  const s = px * FRAC_SCALE;
  const w = tokenWidth(src, px, weight);
  drawRich(ctx, f.num, cx, cy - s * 0.62, s, weight);
  drawRich(ctx, f.den, cx, cy + s * 0.68, s, weight);
  ctx.beginPath();
  ctx.moveTo(cx - w / 2 + px * 0.06, cy);
  ctx.lineTo(cx + w / 2 - px * 0.06, cy);
  ctx.lineWidth = Math.max(2, px * 0.05);
  ctx.strokeStyle = ctx.fillStyle as string;
  ctx.stroke();
}

function tokenHeight(src: string, px: number): number {
  return parseFrac(src) ? px * 1.9 : px;
}

/* ---------------- items ---------------- */

function dashed(ctx: Ctx, len: number, p: number) {
  if (p >= 1) ctx.setLineDash([]);
  else ctx.setLineDash([Math.max(0.01, len * p), len + 1]);
}

function drawItem(ctx: Ctx, s: ItemState) {
  ctx.save();
  ctx.globalAlpha = s.alpha;
  ctx.fillStyle = th(s.color);
  ctx.strokeStyle = th(s.color);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // V51.9.105 neon: the maths glows in its own colour (blur in pixels, so it scales with the frame)
  if (LK.palette.glow && !NOREMAP) { ctx.shadowColor = th(s.color); ctx.shadowBlur = 9 * Math.abs(ctx.getTransform().a); }
  if (s.clip) {
    ctx.beginPath();
    ctx.rect(s.clip[0], s.clip[1], s.clip[2], s.clip[3]);
    ctx.clip();
  }

  if (s.kind === 'text') {
    const w = tokenWidth(s.text, s.size, s.weight);
    const h = tokenHeight(s.text, s.size);
    if (s.halo > 0) {
      ctx.save();
      const rx = w / 2 + s.size * 0.32;
      const ry = h / 2 + s.size * 0.18;
      ctx.globalAlpha = s.alpha * s.halo * LK.palette.haloAlpha;
      ctx.fillStyle = HALO();
      roundRect(ctx, s.x - rx, s.y - ry, rx * 2, ry * 2, Math.min(rx, ry));
      ctx.fill();
      ctx.restore();
    }
    ctx.translate(s.x, s.y);
    ctx.scale(s.scale, s.scale);
    if (s.rot) ctx.rotate(s.rot);
    if (s.draw < 1) {
      ctx.beginPath();
      ctx.rect(-w / 2 - 4, -h, (w + 8) * s.draw, h * 2);
      ctx.clip();
    }
    if (s.swap) {
      const p = s.swap.p;
      const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      const rise = s.size * 0.75;
      ctx.beginPath();
      const ww = Math.max(w, tokenWidth(s.swap.from, s.size, s.weight)) + 16;
      ctx.rect(-ww / 2, -h * 0.85, ww, h * 1.7);
      ctx.clip();
      ctx.globalAlpha = s.alpha * (1 - e);
      drawToken(ctx, s.swap.from, 0, -e * rise, s.size, s.weight);
      ctx.globalAlpha = s.alpha * e;
      drawToken(ctx, s.swap.to, 0, (1 - e) * rise, s.size, s.weight);
    } else {
      drawToken(ctx, s.text, 0, 0, s.size, s.weight);
    }
  } else if (s.kind === 'line') {
    ctx.lineWidth = s.size;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x + (s.x2 - s.x) * s.draw, s.y + (s.y2 - s.y) * s.draw);
    ctx.stroke();
  } else if (s.kind === 'rect') {
    const w = s.x2;
    const h = s.y2;
    ctx.lineWidth = s.size;
    roundRect(ctx, s.x - w / 2, s.y - h / 2, w, h, 16);
    dashed(ctx, 2 * (w + h), s.draw);
    ctx.stroke();
  } else if (s.kind === 'tick') {
    const z = s.size;
    ctx.lineWidth = z * 0.16;
    ctx.beginPath();
    ctx.moveTo(s.x - z * 0.45, s.y);
    ctx.lineTo(s.x - z * 0.1, s.y + z * 0.35);
    ctx.lineTo(s.x + z * 0.5, s.y - z * 0.4);
    dashed(ctx, z * 1.4, s.draw);
    ctx.stroke();
  } else if (s.kind === 'poly' && s.points && s.points.length >= 2) {
    const pts = s.points;
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (s.closed) len += Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]);
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    if (s.closed) ctx.closePath();
    if (s.fillAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = s.alpha * s.fillAlpha;
      ctx.fillStyle = th(s.fill);
      ctx.fill();
      ctx.restore();
    }
    if (s.halo > 0) {
      ctx.save();
      ctx.globalAlpha = s.alpha * s.halo * 0.6;
      ctx.strokeStyle = HALO();
      ctx.lineWidth = s.size + 12;
      ctx.stroke();
      ctx.restore();
    }
    ctx.lineWidth = s.size;
    if (s.dashed && s.draw >= 1) ctx.setLineDash([8, 7]);
    else dashed(ctx, len + 1, s.draw);
    ctx.stroke();
  } else if (s.kind === 'region' && s.region) {
    // Each Venn region = the universe, clipped to "inside" or "outside" every circle in turn.
    const { rect, circles, codes } = s.region;
    ctx.fillStyle = th(s.fill);
    ctx.globalAlpha = s.alpha * s.fillAlpha;
    for (const code of codes) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(rect[0], rect[1], rect[2], rect[3]);
      ctx.clip();
      circles.forEach(([cx, cy, r], i) => {
        ctx.beginPath();
        if ((code >> i) & 1) {
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.clip();
        } else {
          ctx.rect(rect[0] - 4, rect[1] - 4, rect[2] + 8, rect[3] + 8);
          ctx.arc(cx, cy, r, 0, Math.PI * 2, true);
          ctx.clip();
        }
      });
      ctx.fillRect(rect[0], rect[1], rect[2], rect[3]);
      ctx.restore();
    }
  } else if (s.kind === 'dot') {
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size * s.scale, 0, Math.PI * 2);
    ctx.fillStyle = th(s.fill);
    ctx.fill();
    if (s.halo > 0) {
      ctx.globalAlpha = s.alpha * s.halo * 0.6;
      ctx.strokeStyle = HALO();
      ctx.lineWidth = 8;
      ctx.stroke();
    }
  } else if (s.kind === 'vec') {
    // Straight arrow with a filled head; the pen draws the shaft first, the head follows.
    const dx = s.x2 - s.x;
    const dy = s.y2 - s.y;
    const len = Math.hypot(dx, dy);
    if (len > 0.5) {
      const ux = dx / len;
      const uy = dy / len;
      const head = Math.min(16 + s.size, len * 0.5);
      const tipX = s.x + dx * s.draw;
      const tipY = s.y + dy * s.draw;
      ctx.lineWidth = s.size;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(tipX - ux * head * 0.6 * Math.min(1, s.draw * 2), tipY - uy * head * 0.6 * Math.min(1, s.draw * 2));
      ctx.stroke();
      if (s.draw > 0.35) {
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(tipX - ux * head + uy * head * 0.4, tipY - uy * head - ux * head * 0.4);
        ctx.lineTo(tipX - ux * head - uy * head * 0.4, tipY - uy * head + ux * head * 0.4);
        ctx.closePath();
        ctx.fill();
      }
    }
  } else if (s.kind === 'arrow') {
    const mx = (s.x + s.x2) / 2 + (s.y2 - s.y) * 0.25;
    const my = (s.y + s.y2) / 2 - Math.abs(s.x2 - s.x) * 0.25;
    const len = Math.hypot(s.x2 - s.x, s.y2 - s.y) * 1.2;
    ctx.lineWidth = s.size;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.quadraticCurveTo(mx, my, s.x2, s.y2);
    dashed(ctx, len, s.draw);
    ctx.stroke();
    if (s.draw >= 0.98) {
      ctx.setLineDash([]);
      const a = Math.atan2(s.y2 - my, s.x2 - mx);
      ctx.beginPath();
      ctx.moveTo(s.x2, s.y2);
      ctx.lineTo(s.x2 - 12 * Math.cos(a - 0.45), s.y2 - 12 * Math.sin(a - 0.45));
      ctx.moveTo(s.x2, s.y2);
      ctx.lineTo(s.x2 - 12 * Math.cos(a + 0.45), s.y2 - 12 * Math.sin(a + 0.45));
      ctx.stroke();
    }
  }
  ctx.restore();
}

/* ---------------- captions ---------------- */


/**
 * Caption text. With a voice-over the words light up as they are spoken
 * (karaoke): spoken words dark, the current word red, the rest pale.
 */
function drawCaptionText(ctx: Ctx, cap: Caption, t: number, C: Rect, showSub: boolean) {
  const sub = showSub ? cap.sub : undefined;
  let size = 34;
  let lines: string[] = [];
  let subLines: string[] = [];
  let subSize = 0;
  for (; size >= 18; size -= 2) {
    ctx.font = `600 ${size}px ${UI}`;
    lines = wrap(ctx, cap.text, C.w - 60);
    subSize = Math.max(15, Math.round(size * 0.62));
    if (sub) {
      ctx.font = `400 ${subSize}px ${UI}`;
      subLines = wrap(ctx, sub, C.w - 60);
    }
    const h = lines.length * size * 1.25 + (sub ? subLines.length * subSize * 1.3 + 6 : 0);
    if (h <= C.h - 26) break;
  }
  const lh = size * 1.25;
  const slh = subSize * 1.3;
  const total = lines.length * lh + (sub ? subLines.length * slh + 6 : 0);
  let y = C.y + C.h / 2 + 4 - total / 2 + lh / 2;

  const voiced = cap.voiceT0 !== undefined && !!cap.voiceMs;
  const p = voiced ? Math.max(0, Math.min(1, (t - cap.voiceT0!) / cap.voiceMs!)) : 1;
  const chars = cap.text.replace(/\s+/g, '').length || 1;
  let seen = 0;
  ctx.font = `600 ${size}px ${UI}`;
  ctx.textAlign = 'left';
  const space = ctx.measureText(' ').width;
  for (const ln of lines) {
    const words = ln.split(' ');
    const widths = words.map((w) => ctx.measureText(w).width);
    const lineW = widths.reduce((a, b) => a + b, 0) + space * (words.length - 1);
    let x = C.x + C.w / 2 - lineW / 2;
    words.forEach((w, i) => {
      const a = seen / chars;
      seen += w.length;
      const b = seen / chars;
      const K = LK.palette.cap;
      ctx.fillStyle = !voiced ? K.idle : p >= b ? K.spoken : p >= a ? K.now : K.next;
      ctx.fillText(w, x, y);
      x += widths[i] + space;
    });
    y += lh;
  }
  if (sub) {
    y += 6 - lh / 2 + slh / 2;
    ctx.font = `400 ${subSize}px ${UI}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = LK.palette.cap.sub;
    for (const ln of subLines) {
      ctx.fillText(ln, C.x + C.w / 2, y);
      y += slh;
    }
  }
  // Speaking indicator: three bars bounce while the voice talks.
  if (voiced && p > 0 && p < 1) {
    ctx.fillStyle = LK.palette.cap.now;
    for (let k = 0; k < 3; k++) {
      const h = 6 + 10 * Math.abs(Math.sin(t / 140 + k * 1.3));
      ctx.fillRect(C.x + C.w - 44 + k * 9, C.y + 18 - h / 2, 5, h);
    }
  }
  ctx.textAlign = 'center';
}

/* ---------------- frame ---------------- */

export function drawMotionFrame(ctx: Ctx, scene: MotionScene, t: number, opts: DrawOptions): void {
  setLook(opts);
  NOREMAP = scene.group === 'qr-card' || scene.group === 'story'; // V51.9.118: story pictures keep their own colours on every look
  const DP = opts.design?.parts ?? {};
  // V51.9.119: a background colour chosen in the designer (the board's soft edges match it)
  if (DP.background?.fill) LK = { ...LK, palette: { ...LK.palette, paper: DP.background.fill, ...(LK.palette.paper2 ? { paper2: DP.background.fill } : {}) } };
  const prob = scene.problem ? fitProblem(ctx, scene.problem, opts.format) : null;
  const L = layoutFor(opts.format, prob, opts.footer);
  if (scene.layer3d && drawLayer3d(ctx, scene.layer3d, t, L.dw * L.k, L.dh * L.k)) return; // 3D intro covers the whole frame
  // V51.9.124: an explainer shot draws the whole frame its own (cinematic) way
  if (scene.explainer) {
    ctx.save();
    ctx.setTransform(BASE[0], BASE[1], BASE[2], BASE[3], BASE[4], BASE[5]);
    ctx.scale(L.k, L.k);
    drawExplainerFrame(ctx, scene, t, { dw: L.dw, dh: L.dh, handle: opts.handle, subtitles: opts.subtitles });
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.setTransform(BASE[0], BASE[1], BASE[2], BASE[3], BASE[4], BASE[5]);
  ctx.scale(L.k, L.k);
  if (DP.background?.fill) { ctx.fillStyle = DP.background.fill; ctx.fillRect(0, 0, L.dw, L.dh); } else if (opts.bgVideo?.frame) drawBgVideo(ctx, opts.bgVideo, L.dw, L.dh, P().dark); else drawBoard(ctx, LK, L.dw, L.dh, { t: opts.reelT ?? t, p: scene.durationMs > 0 ? t / scene.durationMs : 0 });
  if (opts.season && !DP.background?.hidden) drawSeasonDecor(ctx, opts.season, L, opts.reelT ?? t, P().dark);

  const closing = scene.group === 'end-card' || scene.group === 'qr-card';
  withPart(ctx, L, DP.title, partRectOf('title', L), () => {
  // Title pill, or the problem card when the scene has a problem.
  const T = L.title;
  drawCard(ctx, LK, T.x, T.y, T.w, T.h, 18, P().frame, 4);
  if (prob) {
    const label = scene.problemLabel ?? 'PROBLEM';
    ctx.font = `700 18px ${UI}`;
    const lw = ctx.measureText(label).width + 30;
    roundRect(ctx, T.x + 26, T.y - 16, lw, 32, 16);
    ctx.fillStyle = P().panel;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = P().frame;
    ctx.stroke();
    ctx.fillStyle = P().frame;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, T.x + 26 + lw / 2, T.y + 1);
    ctx.font = `600 ${prob.size}px ${UI}`;
    ctx.fillStyle = P().panelText;
    ctx.textAlign = 'center';
    prob.lines.forEach((ln, i) => ctx.fillText(ln, T.x + T.w / 2, T.y + 30 + prob.lh * (i + 0.5)));
  } else {
    const px = fitFont(ctx, scene.title, T.w - 110, Math.round(T.h * 0.56), '700', UI);
    ctx.font = `700 ${px}px ${UI}`;
    const tw = ctx.measureText(scene.title).width;
    ctx.fillStyle = P().panelText;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const mark = T.h * 0.84;
    const tx = opts.download ? T.x + T.w / 2 - (tw + 14 + mark) / 2 : T.x + T.w / 2 - tw / 2;
    // V51.9.156: a Pro template's title plays its entrance at the start of the reel (and keeps its mark after)
    const first = (opts.reelT ?? t) - t < 1;
    drawTitleText(ctx, LK.titleIn ?? 'none', scene.title, tx, T.y + T.h / 2 + 2, tw, px, first ? t : 1e9, P().frame, P().panelText);
    if (opts.download) drawBrandMark(ctx, tx + tw + 14 + mark / 2, T.y + T.h / 2, mark);
  }

  // Handle (V51.9.99: on the closing cards of a shared reel, "Shared by" with the student's photo instead).
  const showPhoto = !!(opts.photo && opts.download);
  if (closing && opts.download && (showPhoto || profileLines(opts.student).length)) {
    drawSharedBy(ctx, opts, L.dw / 2, L.handleY + (opts.format === 'landscape' ? 5 : 0), opts.format === 'landscape' ? 32 : 52);
  } else {
    ctx.font = `700 22px ${UI}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = P().dark ? P().muted : P().text;
    const handle = opts.handle ?? '@aiguru';
    if (showPhoto && opts.format === 'square') {
      // square reels have no footer: the photo sits beside the link
      const d = 34;
      const w = ctx.measureText(handle).width;
      const x0 = L.dw / 2 - (w + d + 10) / 2;
      drawAvatar(ctx, opts.photo!, x0 + d / 2, L.handleY, d);
      ctx.textAlign = 'left';
      ctx.fillText(handle, x0 + d + 10, L.handleY);
    } else {
      ctx.fillText(handle, L.dw / 2, L.handleY);
    }
  }

  });

  withPart(ctx, L, DP.board, L.board, () => {
  // Board: scene design space fitted into the board rect.
  const B = L.board;
  const { camH, camY, camX, s } = boardCamera(scene, B, t);
  const states = sceneStateAt(scene, t);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, B.y, L.dw, B.h);
  ctx.clip();
  // V51.9.161: this step's camera preset (cinematic or whiteboard flavour); when it is on, it replaces the look's camera
  const shot = presetShot(scene, states, t, opts, { cx: camX, cy: camY, hw: B.w / 2 / s, hh: B.h / 2 / s });
  // V51.9.101: the look's camera (close-ups on what is being worked on, a slow drift, a punch-in per step)
  const fx = { ...boardFx(shot ? 'steady' : opts.camera ?? 'steady', scene, t) }; // a copy: the cinematic drift changes it
  // V51.9.126 cinematic: the board itself drifts in very slowly with the sky (the working never leaves the frame)
  if (LK.board === 'cinema' && scene.durationMs > 0) fx.scale *= 1 + 0.03 * Math.min(1, t / scene.durationMs);
  if (shot) { fx.scale *= shot.zoom; fx.dx += shot.x - camX; fx.dy += shot.y - camY; }
  const rot = shot?.rot ?? 0;
  if (fx.scale !== 1 || fx.dx || fx.dy || rot) {
    const cx = B.x + B.w / 2, cy = B.y + B.h / 2;
    ctx.translate(cx, cy);
    if (rot) ctx.rotate(rot);
    ctx.scale(fx.scale, fx.scale);
    ctx.translate(-cx - fx.dx * s, -cy - fx.dy * s);
  }
  ctx.translate(B.x + B.w / 2 - camX * s, B.y + B.h / 2 - camY * s);
  ctx.scale(s, s);
  // whip pan: a moment of motion blur (browsers with canvas filters, phones with more than 4 GB)
  const blurOn = !!shot && shot.blur > 0.5 && 'filter' in ctx && !lowEndDevice();
  if (blurOn) ctx.filter = `blur(${shot!.blur.toFixed(1)}px)`;
  for (const st of states) drawItem(ctx, st);
  if (blurOn) ctx.filter = 'none';
  // rack focus: the rest of the board fades back behind the new line
  if (shot && shot.dim > 0.01 && shot.focus) {
    const f = shot.focus, pad = 16, hw = B.w / s, hh = B.h / s;
    ctx.save();
    ctx.beginPath();
    ctx.rect(camX - hw * 2, camY - hh * 2, hw * 4, hh * 4);
    ctx.rect(f.l - pad, f.t - pad, f.r - f.l + pad * 2, f.b - f.t + pad * 2);
    ctx.fillStyle = rgba(P().paper, shot.dim);
    ctx.fill('evenodd');
    ctx.restore();
  }
  if (opts.stepNotes) drawStepNotes(ctx, scene, states, t, { camX, s, halfW: B.w / 2 / s }, opts.stepButtons ? { partStart: opts.partStartMs ?? 0, paused: !!opts.stepPaused } : null);
  ctx.restore();
  // Soft fade where the camera crops the board (plain boards only: patterns show their own edges).
  if (camH < scene.height - 1 && !LK.palette.paper2 && (LK.board === 'whiteboard' || LK.board === 'blackboard')) {
    for (const [y0, y1] of [[B.y, B.y + 26], [B.y + B.h, B.y + B.h - 26]]) {
      const g = ctx.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, rgba(P().paper, 1));
      g.addColorStop(1, rgba(P().paper, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, Math.min(y0, y1), L.dw, 26);
    }
  }

  });

  withPart(ctx, L, DP.caption, L.caption, () => {
  // Caption card.
  const cap = captionAt(scene, t);
  if (cap) {
    const C = L.caption;
    const inP = Math.min(1, (t - cap.t0) / 250);
    ctx.save();
    // V51.9.101: how a new caption arrives (fade, slide up, pop)
    if (LK.captionIn === 'slide' && inP < 1) ctx.translate(0, 18 * (1 - inP) * (1 - inP));
    else if (LK.captionIn === 'rise' && inP < 1) {
      // V51.9.156: rises from below and settles (a little overshoot)
      const e = 1 - Math.pow(1 - inP, 3);
      const k = 0.96 + 0.04 * e;
      ctx.translate(C.x + C.w / 2, C.y + C.h / 2 + 46 * (1 - e) - 6 * Math.sin(inP * Math.PI));
      ctx.scale(k, k);
      ctx.translate(-(C.x + C.w / 2), -(C.y + C.h / 2));
    } else if (LK.captionIn === 'blur' && inP < 1 && 'filter' in ctx) ctx.filter = `blur(${(10 * (1 - inP)).toFixed(1)}px)`; // comes into focus (browsers without canvas filters just fade)
    else if (LK.captionIn === 'pop' && inP < 1) {
      const k = 0.94 + 0.06 * (1 - Math.pow(1 - inP, 3)) + 0.02 * Math.sin(inP * Math.PI);
      ctx.translate(C.x + C.w / 2, C.y + C.h / 2);
      ctx.scale(k, k);
      ctx.translate(-(C.x + C.w / 2), -(C.y + C.h / 2));
    }
    drawCard(ctx, LK, C.x, C.y, C.w, C.h, 24, P().line, 3);
    const label = `${scene.pill ?? opts.stepLabel ?? 'STEP'} ${cap.step + (opts.stepOffset ?? 0)}`;
    ctx.font = `700 20px ${UI}`;
    const lw = ctx.measureText(label).width + 36;
    roundRect(ctx, C.x + 32, C.y - 20, lw, 40, 20);
    ctx.fillStyle = P().panel;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = P().frame;
    ctx.stroke();
    ctx.fillStyle = P().frame;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, C.x + 32 + lw / 2, C.y + 1);

    ctx.globalAlpha = LK.captionIn === 'fade' || LK.captionIn === 'blur' ? inP : Math.min(1, inP * 1.6);
    drawCaptionText(ctx, cap, t, C, opts.subtitles !== false);
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  });
  // V51.9.100: the teacher's bubble in the bottom corner, clear of the caption (not on the closing cards: the QR needs the room)
  if (opts.teacher && !closing) {
    const b = teacherSpot(L, opts.format);
    drawTeacherBubble(ctx, opts.teacher, opts.reelT ?? t, b.cx, b.cy, b.d, LK.frame);
  }
  // V51.9.101 duet: the teacher asks from the other corner
  if (opts.duet && scene.group === 'duet-ask') {
    const b = teacherSpot(L, opts.format);
    drawTeacherBubble(ctx, opts.duet, opts.reelT ?? t, L.dw - b.cx, b.cy, b.d, LK.frame);
  }
  // V51.9.101 speed run: a stopwatch at the board's top-right
  const rt = opts.reelT ?? t;
  if (opts.stopwatch && rt >= opts.stopwatch.from && rt <= opts.stopwatch.to + 1500) drawStopwatch(ctx, L.dw - 70, L.board.y + 60, Math.min(rt, opts.stopwatch.to) - opts.stopwatch.from);
  if (opts.footer && opts.format === 'vertical') withPart(ctx, L, DP.footer, partRectOf('footer', L), () => drawFooter(ctx, opts));
  if (opts.footer && opts.format === 'landscape') drawFooterWide(ctx, opts);
  ctx.restore();
}

/**
 * Where the teacher's bubble goes (design units): landscape — in the free space right of the caption;
 * vertical and square — the board's bottom-right corner, just above the caption card (the step pill sits on the left).
 */
export function teacherSpot(L: Pick<Layout, 'dw' | 'dh' | 'caption'>, format: ReelFormat): { cx: number; cy: number; d: number } {
  const C = L.caption;
  if (format === 'landscape') {
    const d = 104;
    return { cx: (C.x + C.w + L.dw) / 2, cy: C.y + C.h / 2 - 8, d };
  }
  const d = format === 'vertical' ? 150 : 112;
  return { cx: L.dw - 22 - d / 2, cy: C.y - 30 - d / 2, d };
}

/** The student's photo in a circle with a white ring and a thin teal edge (cover-fit, so any shape works). */
function drawAvatar(ctx: Ctx, img: CanvasImageSource, cx: number, cy: number, d: number) {
  const r = d / 2;
  const iw = (img as { width?: number }).width || d;
  const ih = (img as { height?: number }).height || d;
  const side = Math.min(iw, ih);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.clip();
  try {
    ctx.drawImage(img, (iw - side) / 2, (ih - side) / 2, side, side, cx - r, cy - r, d, d);
  } catch { /* an image that cannot be drawn leaves the white circle */ }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(2, d * 0.06);
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r + ctx.lineWidth / 2 + 1, 0, Math.PI * 2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = P().teal;
  ctx.stroke();
}

/** "Shared by" chip on the closing cards: photo + "Shared by Anu · Std 8", centred on (cx, cy). */
function drawSharedBy(ctx: Ctx, opts: DrawOptions, cx: number, cy: number, d: number) {
  const photo = opts.photo ?? null;
  const who = profileLines(opts.student)[0] ?? '';
  const ml = /[\u0D00-\u0D7F]/.test(opts.stepLabel ?? '');
  const lead = ml ? 'പങ്കുവെച്ചത്' : 'Shared by';
  ctx.textBaseline = 'middle';
  ctx.font = `600 ${Math.round(d * 0.36)}px ${UI}`;
  const leadW = ctx.measureText(lead).width;
  const namePx = fitFont(ctx, who, 470, Math.round(d * 0.46), '800', UI);
  ctx.font = `800 ${namePx}px ${UI}`;
  const nameW = who ? ctx.measureText(who).width : 0;
  const gap = 10;
  const w = (photo ? d + gap : 0) + leadW + (who ? 8 + nameW : 0) + 36;
  const x0 = cx - w / 2;
  roundRect(ctx, x0, cy - d / 2 - 4, w, d + 8, (d + 8) / 2);
  ctx.fillStyle = P().panel;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = P().teal;
  ctx.stroke();
  let x = x0 + 18;
  if (photo) {
    drawAvatar(ctx, photo, x + d / 2 - 14, cy, d);
    x += d + gap - 14;
  }
  ctx.textAlign = 'left';
  ctx.font = `600 ${Math.round(d * 0.36)}px ${UI}`;
  ctx.fillStyle = P().muted;
  ctx.fillText(lead, x, cy + 1);
  if (who) {
    ctx.font = `800 ${namePx}px ${UI}`;
    ctx.fillStyle = P().panelText;
    ctx.fillText(who, x + leadW + 8, cy + 1);
  }
}

/** Landscape downloads: one slim strip under the caption: logo and name on the left, the student's details on the right. */
function drawFooterWide(ctx: Ctx, opts: DrawOptions) {
  const ink = P().text;
  drawBrandMark(ctx, 52, 703, 30);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = ink;
  ctx.font = `700 20px ${UI}`;
  ctx.fillText('AI Guru', 76, 703);
  const lines = profileLines(opts.student);
  const photo = opts.download ? opts.photo : null;
  let left = 1240;
  if (lines.length) {
    const text = lines.join(' — ');
    const px = fitFont(ctx, text, photo ? 860 : 900, 17, '600', UI);
    ctx.font = `600 ${px}px ${UI}`;
    ctx.textAlign = 'right';
    ctx.fillStyle = P().muted;
    ctx.fillText(text, 1240, 703);
    left = 1240 - ctx.measureText(text).width;
  }
  if (photo) drawAvatar(ctx, photo, left - 24, 703, 32);
  // V51.9.101: one badge after the brand name
  if (opts.download && opts.badges?.length) drawBadges(ctx, opts.badges.slice(0, 1), 168, 703, 'left', 1);
}

function drawStopwatch(ctx: Ctx, cx: number, cy: number, ms: number) {
  const P0 = P();
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, 44, 0, Math.PI * 2);
  ctx.fillStyle = P0.panel; ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = P0.frame; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, 44, -Math.PI / 2, -Math.PI / 2 + ((ms % 10000) / 10000) * Math.PI * 2);
  ctx.lineWidth = 7; ctx.strokeStyle = P0.cap.now; ctx.stroke();
  ctx.fillStyle = P0.panelText;
  ctx.font = `700 26px ${UI}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`${(ms / 1000).toFixed(1)}s`, cx, cy + 1);
  ctx.restore();
}

/** Small rounded chips ("🍬 120 toffees", "🔥 5-day streak", "Class 9A"), in a column (right-aligned) or a row. */
function drawBadges(ctx: Ctx, badges: string[], x: number, y: number, align: 'left' | 'right', rows: number) {
  ctx.save();
  ctx.font = `700 ${rows > 1 ? 16 : 14}px ${UI}`;
  ctx.textBaseline = 'middle';
  const h = rows > 1 ? 26 : 22;
  const gap = 5;
  const top = y - ((h + gap) * badges.length - gap) / 2;
  badges.forEach((b, i) => {
    const w = Math.min(300, ctx.measureText(b).width + 22);
    const bx = align === 'right' ? x - w : x;
    const by = rows > 1 ? top + i * (h + gap) : y - h / 2;
    roundRect(ctx, bx, by, w, h, h / 2);
    ctx.fillStyle = P().teal;
    ctx.fill();
    ctx.fillStyle = onColor(P().teal);
    ctx.textAlign = 'center';
    ctx.fillText(b, bx + w / 2, by + h / 2 + 1, w - 14);
  });
  ctx.restore();
}

/** AI Guru's footer: logo, name and tagline, the student's details, and the follow pill (design units 720 × 1280). */
function drawFooter(ctx: Ctx, opts: DrawOptions) {
  const ink = P().text;
  // brand row
  drawBrandMark(ctx, 62, 1103, 58);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = ink;
  ctx.font = `700 34px ${UI}`;
  ctx.fillText('AI Guru', 104, 1092);
  ctx.font = `400 17px ${UI}`;
  ctx.fillStyle = P().muted;
  ctx.fillText(STORY_REEL ? 'See the story. Understand it.' : 'See the maths. Understand it.', 105, 1121);
  // V51.9.101: the student's badges, right of the brand row (up to two: they never push the brand)
  if (opts.download && opts.badges?.length) drawBadges(ctx, opts.badges.slice(0, 2), 686, 1106, 'right', 2);
  // student details
  const lines = profileLines(opts.student);
  const photo = opts.download ? opts.photo : null;
  // V51.9.125: the student's WhatsApp number, as its own green line (only when the student and a parent agreed)
  const wa = opts.download ? profileWhatsapp(opts.student) : '';
  let pillY = 1222;
  if (lines.length || photo || wa) {
    const n = lines.length + (wa ? 1 : 0);
    const h = n <= 1 ? 44 : n === 2 ? 64 : 88;
    if (1146 + h + 6 > pillY) pillY = 1146 + h + 6;
    // V51.9.99: with a photo, a round picture on the left overlaps the box a little; the text moves right
    const d = 76;
    const bx = photo ? 34 + d / 2 + 6 : 34;
    const bw = 686 - bx;
    roundRect(ctx, bx, 1146, bw, h, 16);
    ctx.fillStyle = P().panel;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = P().line;
    ctx.stroke();
    const tx0 = photo ? 34 + d + 14 : 34;
    const cx = (tx0 + 686) / 2;
    ctx.textAlign = 'center';
    lines.forEach((ln, i) => {
      const px = fitFont(ctx, ln, 686 - tx0 - 30, i === 0 ? 24 : 19, i === 0 ? '700' : '400', UI);
      ctx.font = `${i === 0 ? 700 : 400} ${px}px ${UI}`;
      ctx.fillStyle = i === 0 ? P().panelText : P().muted;
      ctx.fillText(ln, cx, 1146 + (n === 1 ? 22 : 20 + i * 24));
    });
    if (wa) {
      // a small green chat bubble with a handset, then the number
      const y = 1146 + (n === 1 ? 22 : 20 + lines.length * 24);
      const label = `WhatsApp  ${wa}`;
      const px = fitFont(ctx, label, 686 - tx0 - 60, 20, '700', UI);
      ctx.font = `700 ${px}px ${UI}`;
      const w = ctx.measureText(label).width;
      const bx = cx - w / 2 - 16;
      ctx.save();
      ctx.fillStyle = P().dark ? '#3fcf6b' : '#25a244';
      ctx.beginPath(); ctx.arc(bx, y, 11, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(bx - 8, y + 6); ctx.lineTo(bx - 12, y + 12); ctx.lineTo(bx - 3, y + 9); ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(bx, y, 5.5, Math.PI * 0.75, Math.PI * 1.75, true); ctx.stroke();
      ctx.restore();
      ctx.textAlign = 'center';
      ctx.fillStyle = P().dark ? '#7ef0a2' : '#1b8a3a';
      ctx.fillText(label, cx + 8, y);
    }
    if (photo) drawAvatar(ctx, photo, 34 + d / 2, 1146 + h / 2, d);
  }
  // follow pill (a little lower and slimmer when the details box has three lines)
  const pillH = Math.min(46, 1276 - pillY);
  roundRect(ctx, 170, pillY, 380, pillH, pillH / 2);
  ctx.fillStyle = P().teal;
  ctx.fill();
  ctx.fillStyle = onColor(P().teal);
  ctx.textAlign = 'center';
  ctx.font = `700 21px ${UI}`;
  ctx.font = `700 ${pillH < 46 ? 18 : 21}px ${UI}`;
  ctx.fillText(STORY_REEL ? 'Follow for daily story lessons' : 'Follow for daily maths tricks', 360, pillY + pillH / 2 + 1);
}


/** Camera of the board at scene time t: the scale and the design point at the board's centre. */
function boardCamera(scene: MotionScene, B: Rect, t: number): { camH: number; camY: number; camX: number; s: number } {
  const camH = scene.camH.at(t);
  const camY = scene.camY.at(t);
  const base = Math.min(B.w / scene.viewW, B.h / camH, 1.6);
  // Deep zoom (matrix entry close-ups): scale grows with the camera's zoom factor, no cap at 1.6.
  const s = scene.camX ? Math.min(Math.min(B.w / scene.viewW, B.h / scene.height, 1.6) * (scene.height / camH), 4.6) : base;
  const camX = scene.camX ? scene.camX.at(t) : scene.viewX;
  return { camH, camY, camX, s };
}

/**
 * Where the board's design space lands in the frame at reel time t (frame pixels, e.g. 1280×720).
 * Interactive questions use it to turn a tile's design position into a tap target. `ctx` is only
 * used to measure the problem card (the same measurement the frame drawing makes).
 */
export function boardMapping(
  ctx: Ctx,
  reel: MotionReel,
  t: number,
  format: ReelFormat,
  /** V51.9.161: the same options the frame was drawn with, so a tap lands where the camera preset put the tile. */
  draw?: Pick<DrawOptions, 'moves' | 'camera' | 'download'>,
): { scene: MotionScene; toFrame: (x: number, y: number) => [number, number]; scale: number; board: { x: number; y: number; w: number; h: number } } {
  const p = reelPartAt(reel, t);
  const scene = p.scene;
  const prob = scene.problem ? fitProblem(ctx, scene.problem, format) : null;
  const L = layoutFor(format, prob);
  const B = L.board;
  const { camY, camX, s } = boardCamera(scene, B, p.t);
  const k = L.k;
  const shot = presetShot(scene, sceneStateAt(scene, p.t), p.t, { ...draw }, { cx: camX, cy: camY, hw: B.w / 2 / s, hh: B.h / 2 / s });
  const z = shot?.zoom ?? 1, r = shot?.rot ?? 0, lx = shot?.x ?? camX, ly = shot?.y ?? camY;
  const cos = Math.cos(r), sin = Math.sin(r);
  const cx = B.x + B.w / 2, cy = B.y + B.h / 2;
  return {
    scene,
    scale: s * k * z,
    board: { x: B.x * k, y: B.y * k, w: B.w * k, h: B.h * k },
    toFrame: (x, y) => {
      const ux = (x - lx) * s * z, uy = (y - ly) * s * z;
      return [(cx + ux * cos - uy * sin) * k, (cy + ux * sin + uy * cos) * k];
    },
  };
}

/* ---------------- V51.9.110: a short caption beside each step's line ---------------- */

/** When an item first shows (alpha and pen both above zero). */
function shownFrom(tr: Item['alpha']): number {
  if (tr.init > 0.01) return 0;
  for (const g of tr.segs) if (g.to > 0.01) return g.t0;
  return Infinity;
}
/** The box an item covers on the board (design units), or null for figures that are not a line of working. */
function extentOf(st: ItemState): { l: number; r: number; t: number; b: number } | null {
  const z = st.size;
  switch (st.kind) {
    case 'text': { const w = (tokenWidth(st.text, z, st.weight) * st.scale) / 2; return { l: st.x - w, r: st.x + w, t: st.y - z * 0.6, b: st.y + z * 0.6 }; }
    case 'line': case 'arrow': return { l: Math.min(st.x, st.x2), r: Math.max(st.x, st.x2), t: Math.min(st.y, st.y2) - z, b: Math.max(st.y, st.y2) + z };
    case 'rect': return { l: st.x - st.x2 / 2, r: st.x + st.x2 / 2, t: st.y - st.y2 / 2, b: st.y + st.y2 / 2 };
    case 'tick': return { l: st.x - z * 0.5, r: st.x + z * 0.55, t: st.y - z * 0.45, b: st.y + z * 0.4 };
    case 'dot': return { l: st.x - z, r: st.x + z, t: st.y - z, b: st.y + z };
    default: return null;
  }
}
const NOTE_IDS = new WeakMap<MotionScene, string[][]>();
/** For each caption of a scene: the text items that first appear while it is on (the line that step wrote). */
export function stepNoteItems(scene: MotionScene): string[][] {
  const hit = NOTE_IDS.get(scene);
  if (hit) return hit;
  const ap = scene.items.filter((it) => it.kind === 'text').map((it) => ({ id: it.id, t: Math.max(shownFrom(it.alpha), shownFrom(it.draw)) }));
  const out = scene.captions.map((c, i) => {
    const end = scene.captions[i + 1]?.t0 ?? c.t1;
    return ap.filter((a) => a.t >= c.t0 - 40 && a.t < Math.max(end, c.t1)).map((a) => a.id);
  });
  NOTE_IDS.set(scene, out);
  return out;
}

/* ---------------- V51.9.161: camera presets, one per step ---------------- */

/** Parts that keep a still camera: openers, endings, cards and story pictures. */
const STILL_GROUPS = new Set(['opener', 'ending', 'end-card', 'qr-card', 'story', 'duet-ask', 'reveal']);
const BEAT_IDS = new WeakMap<MotionScene, string[][]>();
/** For each caption: every item that first appears while it is on (lines of working, boxes, ticks, arrows). */
function beatItemIds(scene: MotionScene): string[][] {
  const hit = BEAT_IDS.get(scene);
  if (hit) return hit;
  const ap = scene.items
    .filter((it) => ['text', 'line', 'arrow', 'rect', 'tick', 'dot'].includes(it.kind))
    .map((it) => ({ id: it.id, t: Math.max(shownFrom(it.alpha), it.draw ? shownFrom(it.draw) : 0) }));
  const out = scene.captions.map((c, i) => {
    const end = scene.captions[i + 1]?.t0 ?? Math.max(c.t1, scene.durationMs);
    return ap.filter((a) => a.t >= c.t0 - 40 && a.t < end).map((a) => a.id);
  });
  BEAT_IDS.set(scene, out);
  return out;
}
const BEAT_PLAN = new WeakMap<MotionScene, Map<string, CameraPresetId[]>>();
/** The move of every step of this part, for a mode and a board flavour (the same every time it is asked). */
function beatPlan(scene: MotionScene, mode: Exclude<MovesMode, 'off'>, flavour: Flavour): CameraPresetId[] {
  let m = BEAT_PLAN.get(scene);
  if (!m) { m = new Map(); BEAT_PLAN.set(scene, m); }
  const key = `${mode}/${flavour}`;
  const hit = m.get(key);
  if (hit) return hit;
  const n = scene.captions.length;
  const kinds = scene.captions.map((c, i) => beatKindOf(c.text ?? '', i, n));
  const seed = hashText(`${scene.title ?? ''}|${scene.captions.map((c) => c.text ?? '').join('|')}`);
  const plan = pickBeatPresets(kinds, mode, flavour, seed);
  m.set(key, plan);
  return plan;
}
const isEq = (st: ItemState) => st.kind === 'text' && /^\s*=\s*$/.test(st.text ?? '');
/** What a beat writes, as the camera sees it: its box, where the pen is, and its two sides around "=". */
function beatGeometry(scene: MotionScene, i: number, byId: Map<string, ItemState>): Pick<ShotInput, 'focus' | 'pen' | 'sides'> {
  const vis = (beatItemIds(scene)[i] ?? []).map((id) => byId.get(id)).filter((st): st is ItemState => !!st && st.alpha > 0.05 && st.draw > 0.02);
  let focus: Box | null = null;
  let pen: { x: number; y: number } | null = null;
  for (const st of vis) {
    const e = extentOf(st);
    if (!e || e.b - e.t > Math.max(st.size, 10) * 3.2 * 3) continue; // a frame around the whole board is not "this line"
    focus = focus ? { l: Math.min(focus.l, e.l), r: Math.max(focus.r, e.r), t: Math.min(focus.t, e.t), b: Math.max(focus.b, e.b) } : { ...e };
    if (st.draw < 1) pen = { x: e.l + (e.r - e.l) * st.draw, y: (e.t + e.b) / 2 };
  }
  if (!pen && focus) pen = { x: focus.r, y: (focus.t + focus.b) / 2 };
  let sides: [Box, Box] | null = null;
  const eq = vis.find(isEq);
  if (eq && focus) {
    const L = vis.filter((st) => st.kind === 'text' && st !== eq && st.x < eq.x).map(extentOf).filter((e): e is Box => !!e);
    const R = vis.filter((st) => st.kind === 'text' && st !== eq && st.x > eq.x).map(extentOf).filter((e): e is Box => !!e);
    const join = (bs: Box[]): Box => ({ l: Math.min(...bs.map((b) => b.l)), r: Math.max(...bs.map((b) => b.r)), t: Math.min(...bs.map((b) => b.t)), b: Math.max(...bs.map((b) => b.b)) });
    if (L.length && R.length) sides = [join(L), join(R)];
  }
  return { focus, pen, sides };
}
let LOW_END: boolean | null = null;
/** Phones with 4 GB or less skip the blur (the moves still play). */
function lowEndDevice(): boolean {
  if (LOW_END === null) {
    const mem = typeof navigator !== 'undefined' ? (navigator as unknown as { deviceMemory?: number }).deviceMemory : undefined;
    LOW_END = typeof mem === 'number' && mem <= 4;
  }
  return LOW_END;
}
/**
 * This frame's camera preset (null = none): which step is on, its move, and the shot eased in from the step before.
 * Only on a 'steady' camera, on lesson parts with steps; the look decides the flavour (🎬 cinematic or whiteboard).
 */
function presetShot(scene: MotionScene, states: ItemState[], t: number, opts: Pick<DrawOptions, 'moves' | 'camera' | 'download'>, view: ShotInput['view']): (Shot & { focus: Box | null }) | null {
  // Auto leaves a punch / drift / close-ups camera alone; Calm or Lively chosen by hand takes over from it
  const setting = opts.moves ?? readMovesSetting();
  if (opts.camera && opts.camera !== 'steady' && setting === 'auto') return null;
  if (!scene.captions?.length || STILL_GROUPS.has(scene.group ?? '') || scene.layer3d || scene.explainer) return null;
  const mode = movesFor(setting, !!opts.download);
  if (mode === 'off') return null;
  const flavour: Flavour = LK.board === 'cinema' ? 'cinematic' : 'whiteboard';
  const plan = beatPlan(scene, mode, flavour);
  const caps = scene.captions;
  let i = 0;
  for (let j = 0; j < caps.length; j++) if (caps[j].t0 <= t) i = j;
  const startOf = (j: number) => caps[j].t0;
  const endOf = (j: number) => caps[j + 1]?.t0 ?? Math.max(caps[j].t1, scene.durationMs);
  const byId = new Map(states.map((st) => [st.id, st]));
  const input = (j: number, p: number): ShotInput => ({ preset: plan[j], flavour, p, beatMs: endOf(j) - startOf(j), view, ...beatGeometry(scene, j, byId) });
  const p = t < startOf(i) ? 0 : Math.min(1, (t - startOf(i)) / Math.max(1, endOf(i) - startOf(i)));
  const cur = input(i, p);
  const sh = shotAt(cur, i > 0 ? input(i - 1, 1) : null);
  return { ...sh, focus: cur.focus };
}

/**
 * Draws, beside the row each step wrote, that step's caption in small letters (the step now in the accent colour,
 * earlier steps grey). A row reused by a later step keeps only the latest note; no room on the right → no note.
 * Runs inside the board's transform (design units; `s` = design → board scale).
 */
function drawStepNotes(ctx: Ctx, scene: MotionScene, states: ItemState[], t: number, cam: { camX: number; s: number; halfW: number }, buttons: { partStart: number; paused: boolean } | null = null): void {
  const hits: StepButton[] = [];
  if (buttons && ctx.canvas) BUTTONS.set(ctx.canvas, hits);
  const byId = new Map(states.map((st) => [st.id, st]));
  const groups = stepNoteItems(scene);
  const fs = 15 / cam.s; // about 15 px on the 1280-wide frame, whatever the zoom
  const rows: Array<{ y: number; right: number; text: string; now: boolean; h: number; stepMs: number; prevMs: number }> = [];
  scene.captions.forEach((c, i) => {
    if (t < c.t0 || !c.text || c.boardNote) return; // V51.9.136: the board already wrote this step's short note
    const vis = groups[i].map((id) => byId.get(id)).filter((st): st is ItemState => !!st && st.alpha > 0.3 && st.draw > 0.3);
    if (!vis.length) return;
    // the row with the most of this step's items
    const buckets = new Map<number, ItemState[]>();
    for (const st of vis) { const k = Math.round(st.y / Math.max(8, st.size * 0.5)); buckets.set(k, [...(buckets.get(k) ?? []), st]); }
    const row = [...buckets.values()].sort((a, b) => b.length - a.length)[0];
    const y = row.reduce((a, st) => a + st.y, 0) / row.length;
    const h = Math.max(...row.map((st) => st.size));
    // start right of EVERYTHING already on this row (the board's own "−5 both sides", ticks, answer boxes …)
    let right = Math.max(...row.map((st) => st.x + tokenWidth(st.text, st.size, st.weight) / 2));
    for (const st of states) {
      if (st.alpha < 0.3) continue;
      const e = extentOf(st);
      if (!e || e.b - e.t > h * 3.2) continue; // a big frame around several rows does not count
      if (e.b > y - h * 0.5 && e.t < y + h * 0.5) right = Math.max(right, e.r);
    }
    const next = scene.captions[i + 1];
    const now = t < (next?.t0 ?? Infinity);
    for (let k = rows.length - 1; k >= 0; k--) if (Math.abs(rows[k].y - y) < h * 0.6) rows.splice(k, 1); // a later step on the same row wins
    rows.push({ y, right, text: c.note ?? c.text, now, h, stepMs: c.t0, prevMs: scene.captions[i - 1]?.t0 ?? c.t0 });
  });
  if (!rows.length) return;
  const edge = cam.camX + cam.halfW - 10 / cam.s;
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const toCanvas = (x: number, y: number) => { const m = ctx.getTransform(); return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f }; };
  // V51.9.112: the caption on the right of the line, and the step buttons in a row JUST BELOW the caption
  const bs = 20 / cam.s, gap = 4 / cam.s, rowGap = 4 / cam.s;
  const kinds: Array<[StepButton['action'], string]> = [['pause', '#e0523d'], ['go', '#2e9e5b'], ['up', '#3b82f6'], ['restart', '#a04fc7']];
  const buttonsW = kinds.length * bs + (kinds.length - 1) * gap;
  for (const r of rows) {
    const x = r.right + Math.max(18 / cam.s, r.h * 0.45);
    const maxW = Math.min(edge - x, 300 / cam.s);
    if (maxW < 90 / cam.s) continue;
    ctx.font = `${r.now ? 700 : 500} ${fs}px ${UI}`;
    let lines = wrap(ctx, r.text, maxW);
    if (lines.length > 2) { let l2 = lines[1]; while (l2.length > 3 && ctx.measureText(`${l2}…`).width > maxW) l2 = l2.slice(0, -1); lines = [lines[0], `${l2}…`]; }
    const lh = fs * 1.2;
    const withButtons = !!buttons && buttonsW <= maxW;
    const blockH = lines.length * lh + (withButtons ? rowGap + bs : 0);
    const top = r.y - blockH / 2; // caption and buttons together, centred on the line
    ctx.globalAlpha = r.now ? 0.95 : 0.6;
    ctx.fillStyle = r.now ? P().frame : P().muted;
    ctx.fillRect(x - 9 / cam.s, top, 2.5 / cam.s, blockH);
    lines.forEach((ln, i) => ctx.fillText(ln, x, top + lh * (i + 0.5)));
    if (!withButtons || !buttons) continue;
    // # pause · ✓ carry on · ^ step before · ⟲ from the start (drawn as shapes: a font may lack ✓ or ⟲)
    const by = top + lines.length * lh + rowGap;
    ctx.save();
    ctx.globalAlpha = r.now ? 1 : 0.55;
    kinds.forEach(([action, col], k) => {
      const bx = x + k * (bs + gap);
      roundRect(ctx, bx, by, bs, bs, 5 / cam.s);
      const filled = action === 'pause' && r.now && buttons.paused;
      ctx.fillStyle = filled ? col : '#ffffff';
      ctx.fill();
      ctx.lineWidth = 1.4 / cam.s;
      ctx.strokeStyle = col;
      ctx.stroke();
      const ink = filled ? '#ffffff' : col, cx = bx + bs / 2, cy = by + bs / 2, u = bs * 0.22;
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2 / cam.s;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      if (action === 'pause') { // #
        ctx.moveTo(cx - u * 0.45, cy - u * 1.1); ctx.lineTo(cx - u * 0.75, cy + u * 1.1);
        ctx.moveTo(cx + u * 0.75, cy - u * 1.1); ctx.lineTo(cx + u * 0.45, cy + u * 1.1);
        ctx.moveTo(cx - u * 1.1, cy - u * 0.4); ctx.lineTo(cx + u * 1.15, cy - u * 0.4);
        ctx.moveTo(cx - u * 1.15, cy + u * 0.4); ctx.lineTo(cx + u * 1.1, cy + u * 0.4);
      } else if (action === 'go') { // ✓
        ctx.moveTo(cx - u * 1.1, cy); ctx.lineTo(cx - u * 0.3, cy + u * 0.9); ctx.lineTo(cx + u * 1.2, cy - u * 0.9);
      } else if (action === 'up') { // ^
        ctx.moveTo(cx - u * 1.0, cy + u * 0.55); ctx.lineTo(cx, cy - u * 0.65); ctx.lineTo(cx + u * 1.0, cy + u * 0.55);
      } else { // ⟲ a round arrow
        ctx.arc(cx, cy, u * 1.05, Math.PI * 0.9, Math.PI * 2.6);
        ctx.moveTo(cx - u * 1.05 - u * 0.55, cy - u * 0.05); ctx.lineTo(cx - u * 1.05 + u * 0.05, cy + u * 0.55); ctx.lineTo(cx - u * 1.05 + u * 0.5, cy - u * 0.2);
      }
      ctx.stroke();
      const a = toCanvas(bx, by), b = toCanvas(bx + bs, by + bs);
      hits.push({ x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y, action, stepMs: buttons.partStart + r.stepMs, prevMs: buttons.partStart + r.prevMs, current: r.now });
    });
    ctx.restore();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = `${fs}px ${UI}`;
  }
  ctx.restore();
}

/** Draw one frame of a (multi-part) reel. */
export function drawReelFrame(ctx: Ctx, reel: MotionReel, t: number, opts: DrawOptions): void {
  if (opts.boardFont && opts.boardFont !== 'serif') { withBoardFont(opts.boardFont, () => drawReelFrame(ctx, reel, t, { ...opts, boardFont: null })); return; }
  const p = reelPartAt(reel, t);
  STORY_REEL = reel.parts.some((x) => x.group === 'story'); // V51.9.118: the footer speaks of stories, not maths
  const o = { ...opts, stepOffset: (opts.stepOffset ?? 0) + p.stepOffset, reelT: t, partStartMs: t - p.t };
  // V51.9.101: the look's transition into every part after the first (wipe, zoom, slide, chalk dust)
  const look = opts.look;
  if (look && look.transition !== 'cut' && p.scene !== reel.parts[0] && p.t < TRANSITION_MS && !p.scene.layer3d) {
    const W = ctx.canvas?.width ?? FORMAT_SIZE[opts.format].width;
    const H = ctx.canvas?.height ?? FORMAT_SIZE[opts.format].height;
    const k = p.t / TRANSITION_MS;
    beginTransition(ctx, look.transition, k, W, H);
    const m = typeof ctx.getTransform === 'function' ? ctx.getTransform() : null;
    if (m) BASE = [m.a, m.b, m.c, m.d, m.e, m.f];
    try { drawMotionFrame(ctx, p.scene, p.t, o); } finally { BASE = [1, 0, 0, 1, 0, 0]; }
    endTransition(ctx, look.transition, k, W, H, look);
    drawDesignOn(ctx, reel, p.scene, p.t, t, opts);
    return;
  }
  drawMotionFrame(ctx, p.scene, p.t, o);
  drawDesignOn(ctx, reel, p.scene, p.t, t, opts);
}

/** V51.9.119: the designer's added items, over the whole frame (they do not take part in the transitions). */
function drawDesignOn(ctx: Ctx, reel: MotionReel, scene: MotionScene, partT: number, t: number, opts: DrawOptions) {
  const d = opts.design;
  if (!d?.items.length || scene.layer3d) return;
  const L = baseLayout(opts.format);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(L.k, L.k);
  drawDesignItems(ctx, d, L.dw, L.dh, reel.parts.indexOf(scene), partT, t, !!opts.designStill);
  ctx.restore();
}


/* ---------------- V51.9.156: Pro template title entrances ---------------- */

const graphemes = (text: string): string[] => {
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment: (s: string) => Iterable<{ segment: string }> } }).Segmenter;
  return Seg ? Array.from(new Seg(undefined, { granularity: 'grapheme' }).segment(text), (x) => x.segment) : Array.from(text);
};

/**
 * The title text (font, fill and alignment already set by the caller: left, middle). `t` = ms since the reel began
 * (a large number after the entrance). kinetic: the words drop in one by one; type: typed with a caret;
 * highlight: a marker band sweeps behind it and stays; underline: a line draws under it and stays.
 */
export function drawTitleText(ctx: Ctx, kind: string, text: string, x: number, y: number, tw: number, px: number, t: number, accent: string, ink: string): void {
  const ease = (v: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, v)), 3);
  if (kind === 'highlight') {
    const w = tw * ease((t - 150) / 650);
    if (w > 0) { ctx.save(); ctx.fillStyle = rgba(accent, 0.24); ctx.fillRect(x - 8, y - px * 0.1, w + 16, px * 0.55); ctx.restore(); }
    ctx.fillText(text, x, y);
    return;
  }
  if (kind === 'underline') {
    ctx.fillText(text, x, y);
    const w = tw * ease((t - 200) / 700);
    if (w > 0) { ctx.save(); ctx.fillStyle = accent; ctx.fillRect(x + (tw - w) / 2, y + px * 0.55, w, Math.max(3, px * 0.09)); ctx.restore(); }
    return;
  }
  if (kind === 'type' && t < 1400) {
    const g = graphemes(text);
    const n = Math.min(g.length, Math.floor((t / 1100) * g.length));
    const shown = g.slice(0, n).join('');
    ctx.fillText(shown, x, y);
    if (Math.floor(t / 260) % 2 === 0 || n < g.length) {
      const cx = x + ctx.measureText(shown).width + 4;
      ctx.save(); ctx.fillStyle = accent; ctx.fillRect(cx, y - px * 0.42, Math.max(3, px * 0.08), px * 0.84); ctx.restore();
    }
    return;
  }
  if (kind === 'kinetic' && t < 1600) {
    const words = text.split(' ');
    const space = ctx.measureText(' ').width;
    let cx = x;
    words.forEach((w, i) => {
      const ww = ctx.measureText(w).width;
      const p = (t - i * 130) / 420;
      if (p > 0) {
        const e = ease(p);
        const k = 1 + 0.5 * (1 - e) + 0.06 * Math.sin(Math.min(1, p) * Math.PI);
        ctx.save();
        ctx.globalAlpha *= Math.min(1, p * 2);
        ctx.translate(cx + ww / 2, y - 26 * (1 - e));
        ctx.scale(k, k);
        ctx.fillStyle = p < 0.6 ? accent : ink;
        ctx.fillText(w, -ww / 2, 0);
        ctx.restore();
      }
      cx += ww + space;
    });
    return;
  }
  ctx.fillText(text, x, y);
}
