/**
 * V51.9.61 — AI Guru's logo (a ship's wheel) as drawn into the reel and the MP4 export, in place of the old flame.
 * The picture is loaded once (`loadBrandLogo`, called with the fonts, so it is ready before the first frame of an export);
 * until it is (and in tests, where there is no `Image`) a small vector wheel is drawn, so the mark is never missing.
 */

import { AI_GURU_LOGO_DATA_URL } from '../../brand/logo';

type Ctx = CanvasRenderingContext2D;

let logo: HTMLImageElement | null = null;
let loading: Promise<void> | null = null;

export function loadBrandLogo(): Promise<void> {
  if (typeof Image === 'undefined') return Promise.resolve();
  loading ??= new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => {
      logo = img;
      resolve();
    };
    img.onerror = () => resolve();
    img.src = AI_GURU_LOGO_DATA_URL;
  });
  return loading;
}

/** Vector fallback: the same wheel, simplified (wooden rim, eight spokes with handles, brass hub). */
function vectorWheel(ctx: Ctx, cx: number, cy: number, s: number) {
  const r = s / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#7a3a1c';
  ctx.lineWidth = r * 0.16;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.2, Math.sin(a) * r * 0.2);
    ctx.lineTo(Math.cos(a) * r * 0.97, Math.sin(a) * r * 0.97);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.66, 0, Math.PI * 2);
  ctx.lineWidth = r * 0.2;
  ctx.strokeStyle = '#a4502a';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
  ctx.fillStyle = '#d9a93a';
  ctx.fill();
  ctx.restore();
}

/** Draw the logo centred on (cx, cy), `s` px wide and tall. */
export function drawBrandMark(ctx: Ctx, cx: number, cy: number, s: number) {
  if (logo && typeof ctx.drawImage === 'function') ctx.drawImage(logo, cx - s / 2, cy - s / 2, s, s);
  else vectorWheel(ctx, cx, cy, s);
}
