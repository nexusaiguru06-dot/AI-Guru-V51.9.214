/**
 * V51.9.119 — drawing the designer's added items on a reel frame (design units: 720 × 1280 vertical, 720 × 720
 * square, 1280 × 720 landscape). Used by drawReelFrame, so the preview, the editor's handles and the MP4 agree.
 */
import { LOOK_FONT, type FontKind } from '../motion/look';
import { stickerShapes } from '../motion/recipes/story';
import { entranceAt, type DesignItem, type DesignLayer } from './layer';

type Ctx = CanvasRenderingContext2D;

const fontOf = (it: DesignItem, px: number) => `${it.bold ? 700 : 400} ${Math.max(4, px)}px ${LOOK_FONT[(it.font as FontKind) ?? 'rounded'] ?? LOOK_FONT.rounded}`;
const lines = (it: DesignItem) => (it.text ?? '').split('\n').slice(0, 6);

let mctx: Ctx | null = null;
function measurer(): Ctx | null {
  if (mctx) return mctx;
  try { if (typeof document !== 'undefined') mctx = document.createElement('canvas').getContext('2d'); } catch { /* none */ }
  return mctx;
}

const SHAPE_H: Record<string, number> = { rect: 0.6, round: 0.6, circle: 1, arrow: 0.45, star: 0.95, heart: 0.9 };

/** V51.9.121: moves a new item so all of it is inside the frame (fractions; the frame is `dw` × `dh`). */
export function keepInside(it: DesignItem, dw = 720, dh = 1280): DesignItem {
  const { w, h } = itemSize(it, dw);
  const hx = Math.min(0.5, w / dw / 2 + 0.01), hy = Math.min(0.5, h / dh / 2 + 0.01);
  return { ...it, cx: Math.max(hx, Math.min(1 - hx, it.cx)), cy: Math.max(hy, Math.min(1 - hy, it.cy)) };
}

/** Width and height of an item in design units (dw = the frame's design width). */
export function itemSize(it: DesignItem, dw: number, ctx: Ctx | null = measurer()): { w: number; h: number } {
  const S = it.size * dw;
  switch (it.kind) {
    case 'text': {
      const ls = lines(it);
      let w = S * 0.6 * Math.max(...ls.map((l) => l.length), 1);
      if (ctx) { ctx.font = fontOf(it, S); w = Math.max(...ls.map((l) => ctx.measureText(l).width), S * 0.5); }
      const pad = it.bg ? S * 0.7 : S * 0.2;
      return { w: w + pad, h: ls.length * S * 1.25 + (it.bg ? S * 0.45 : S * 0.1) };
    }
    case 'sticker': return { w: S, h: S };
    case 'shape': return { w: S, h: S * (SHAPE_H[it.shape ?? 'round'] ?? 0.6) };
    case 'character': case 'prop': {
      const { box } = stickerShapes(it.kind === 'character' ? { cast: it.cast ?? 'girl', id: it.cast ?? 'girl' } : { prop: it.prop ?? 'book' });
      const bw = box.x1 - box.x0, bh = box.y1 - box.y0;
      return { w: S, h: S * (bh / Math.max(1, bw)) };
    }
    case 'photo': return { w: S, h: S };
  }
}

const images = new Map<string, HTMLImageElement>();
/** The decoded picture of a photo item (loads in the background the first time; null until ready). */
export function designImage(src: string | undefined): HTMLImageElement | null {
  if (!src || typeof Image === 'undefined') return null;
  let im = images.get(src);
  if (!im) { im = new Image(); im.src = src; images.set(src, im); }
  return im.complete && im.naturalWidth ? im : null;
}
/** Waits until every photo of a design is decoded (before an MP4 is made). */
export async function designImagesReady(d: DesignLayer | null | undefined): Promise<void> {
  await Promise.all((d?.items ?? []).filter((i) => i.kind === 'photo' && i.src).map((i) => { designImage(i.src); const im = images.get(i.src!); return im ? im.decode().catch(() => undefined) : undefined; }));
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y); ctx.arcTo(x + w, y, x + w, y + h, rr); ctx.arcTo(x + w, y + h, x, y + h, rr); ctx.arcTo(x, y + h, x, y, rr); ctx.arcTo(x, y, x + w, y, rr); ctx.closePath();
}

/** Black or white, whichever reads on `hex`. */
export function inkOn(hex: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return '#111827';
  const n = parseInt(m[1], 16);
  const l = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return l > 0.6 ? '#111827' : '#ffffff';
}

/** Draws one item centred at the origin (the caller has moved and rotated the context). */
function drawBody(ctx: Ctx, it: DesignItem, dw: number) {
  const { w, h } = itemSize(it, dw, ctx);
  const S = it.size * dw;
  switch (it.kind) {
    case 'text': {
      if (it.bg) { roundRect(ctx, -w / 2, -h / 2, w, h, Math.min(h / 2, S * 0.6)); ctx.fillStyle = it.bg; ctx.fill(); }
      ctx.font = fontOf(it, S);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = it.color;
      const ls = lines(it);
      ls.forEach((l, i) => ctx.fillText(l, 0, (i - (ls.length - 1) / 2) * S * 1.25 + S * 0.04));
      return;
    }
    case 'sticker':
      ctx.font = `${S * 0.86}px "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(it.emoji ?? '⭐', 0, S * 0.04);
      return;
    case 'shape': {
      ctx.fillStyle = it.color;
      ctx.strokeStyle = it.color;
      const k = it.shape ?? 'round';
      if (k === 'rect') { ctx.fillRect(-w / 2, -h / 2, w, h); return; }
      if (k === 'round') { roundRect(ctx, -w / 2, -h / 2, w, h, h * 0.3); ctx.fill(); return; }
      if (k === 'circle') { ctx.beginPath(); ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.fill(); return; }
      if (k === 'arrow') {
        ctx.beginPath();
        ctx.moveTo(-w / 2, -h * 0.18); ctx.lineTo(w * 0.12, -h * 0.18); ctx.lineTo(w * 0.12, -h / 2); ctx.lineTo(w / 2, 0);
        ctx.lineTo(w * 0.12, h / 2); ctx.lineTo(w * 0.12, h * 0.18); ctx.lineTo(-w / 2, h * 0.18); ctx.closePath(); ctx.fill(); return;
      }
      if (k === 'star') {
        ctx.beginPath();
        for (let i = 0; i < 10; i++) { const r = (i % 2 ? 0.42 : 1) * w / 2, a = -Math.PI / 2 + (i * Math.PI) / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r * (h / w) + h * 0.04); }
        ctx.closePath(); ctx.fill(); return;
      }
      // heart
      ctx.beginPath();
      ctx.moveTo(0, h * 0.42);
      ctx.bezierCurveTo(-w * 0.62, -h * 0.05, -w * 0.32, -h * 0.62, 0, -h * 0.22);
      ctx.bezierCurveTo(w * 0.32, -h * 0.62, w * 0.62, -h * 0.05, 0, h * 0.42);
      ctx.fill();
      return;
    }
    case 'character': case 'prop': {
      const { ops, box } = stickerShapes(it.kind === 'character' ? { cast: it.cast ?? 'girl', id: it.cast ?? 'girl' } : { prop: it.prop ?? 'book' });
      const k = w / Math.max(1, box.x1 - box.x0);
      ctx.scale(k, k);
      ctx.translate(-(box.x0 + box.x1) / 2, -(box.y0 + box.y1) / 2);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      for (const o of ops) {
        ctx.beginPath();
        o.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        if (o.closed) { ctx.closePath(); ctx.fillStyle = o.fill; ctx.fill(); }
        ctx.lineWidth = o.width;
        ctx.strokeStyle = o.stroke;
        ctx.stroke();
      }
      return;
    }
    case 'photo': {
      const im = designImage(it.src);
      ctx.save();
      if (it.round) { ctx.beginPath(); ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2); } else roundRect(ctx, -w / 2, -h / 2, w, h, w * 0.06);
      ctx.clip();
      if (im) {
        const s = Math.max(w / im.naturalWidth, h / im.naturalHeight);
        ctx.drawImage(im, -im.naturalWidth * s / 2, -im.naturalHeight * s / 2, im.naturalWidth * s, im.naturalHeight * s);
      } else { ctx.fillStyle = '#cbd5e1'; ctx.fillRect(-w / 2, -h / 2, w, h); }
      ctx.restore();
      ctx.lineWidth = Math.max(2, w * 0.025);
      ctx.strokeStyle = it.color;
      if (it.round) { ctx.beginPath(); ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2); } else roundRect(ctx, -w / 2, -h / 2, w, h, w * 0.06);
      ctx.stroke();
    }
  }
}

/**
 * Draws the items on screen in part `partIndex`, `partMs` after the part began (`reelMs` after the reel began, for
 * whole-reel items). The context is in design units.
 */
export function drawDesignItems(ctx: Ctx, d: DesignLayer, dw: number, dh: number, partIndex: number, partMs: number, reelMs: number, still = false) {
  for (const it of d.items) {
    if (it.part !== null && it.part !== partIndex) continue;
    // while the reel is paused for editing, items show in full (their entrance plays when the reel plays)
    const e = still ? entranceAt('none', 0) : entranceAt(it.entrance, it.part === null ? reelMs : partMs);
    if (e.a <= 0) continue;
    ctx.save();
    ctx.globalAlpha = it.opacity * e.a;
    ctx.translate((it.cx + e.dx) * dw, it.cy * dh + e.dy * dw);
    ctx.rotate((it.rot * Math.PI) / 180);
    if (e.s !== 1) ctx.scale(e.s, e.s);
    try { drawBody(ctx, it, dw); } catch { /* a broken item never stops the reel */ }
    ctx.restore();
  }
}
