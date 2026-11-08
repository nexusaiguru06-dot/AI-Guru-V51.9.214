/**
 * V51.9.157 — Way 4: a stock video (from Pexels or Pixabay, downloaded by the student and uploaded here) plays behind
 * the reel. The clip is the student's own file, so the phone may read its frames and build the MP4 by itself.
 *
 * The board, captions and title are drawn over it exactly as on a plain board; a shade (dark for dark looks, light
 * for light looks) keeps the numbers and captions readable. The clip loops from the chosen start when the reel is
 * longer. Pure helpers (no DOM): the preview, the MP4 export and the tests share them.
 */

export interface BgVideoDraw {
  /** The video (or a frame of it) to draw; null = not ready (the look's own board is drawn instead). */
  frame: CanvasImageSource | null;
  /** The clip's own size in pixels. */
  width: number;
  height: number;
  /** 0–0.85: how much the clip is shaded so the lesson stays readable. */
  shade: number;
}

export const SHADE_DEFAULT = 0.45;
export const SHADE_MAX = 0.85;
export const MAX_CLIP_MB = 150;

/** Where in the clip the reel is at `reelMs` (seconds): from `start`, looping over the rest of the clip. */
export function bgTime(reelMs: number, start: number, duration: number): number {
  const d = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const s = Math.max(0, Math.min(start, Math.max(0, d - 0.5)));
  const span = Math.max(0.5, d - s);
  // a hair before the end: seeking exactly to the end shows no frame on some phones
  return Math.min(Math.max(0, d - 0.04), s + ((Math.max(0, reelMs) / 1000) % span));
}

/** The clip fitted to cover the frame (centred; the sides or top/bottom are cropped). */
export function coverRect(w: number, h: number, dw: number, dh: number): { x: number; y: number; w: number; h: number } {
  if (!(w > 0 && h > 0)) return { x: 0, y: 0, w: dw, h: dh };
  const k = Math.max(dw / w, dh / h);
  return { x: (dw - w * k) / 2, y: (dh - h * k) / 2, w: w * k, h: h * k };
}

export const clampShade = (v: number) => Math.max(0, Math.min(SHADE_MAX, Number.isFinite(v) ? v : SHADE_DEFAULT));

/** Draws the clip and its readability shade over the whole frame (design units dw × dh). */
export function drawBgVideo(ctx: CanvasRenderingContext2D, bg: BgVideoDraw, dw: number, dh: number, dark: boolean): void {
  const r = coverRect(bg.width, bg.height, dw, dh);
  ctx.save();
  ctx.fillStyle = dark ? '#000000' : '#ffffff';
  ctx.fillRect(0, 0, dw, dh);
  if (bg.frame) ctx.drawImage(bg.frame, r.x, r.y, r.w, r.h);
  ctx.globalAlpha = clampShade(bg.shade);
  ctx.fillRect(0, 0, dw, dh);
  ctx.restore();
}
