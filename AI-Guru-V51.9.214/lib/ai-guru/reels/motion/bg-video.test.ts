// @vitest-environment node
/** V51.9.157 — Way 4: the stock clip's timing, fit and drawing behind the reel. */
import { describe, expect, it } from 'vitest';
import { createCanvas, type Canvas } from '@napi-rs/canvas';
import { bgTime, clampShade, coverRect, drawBgVideo, SHADE_MAX } from './bg-video';
import { buildReel, drawReelFrame } from './index';

describe('V51.9.157 stock video background', () => {
  it('starts where chosen and loops over the rest of the clip', () => {
    expect(bgTime(0, 2, 12)).toBeCloseTo(2);
    expect(bgTime(3000, 2, 12)).toBeCloseTo(5);
    expect(bgTime(11000, 2, 12)).toBeCloseTo(3); // 10 s span: loops back
    expect(bgTime(5000, 50, 12)).toBeLessThan(12); // a start past the end is pulled in
    expect(bgTime(999999, 0, 4)).toBeLessThan(4);
  });
  it('covers the frame (portrait reel, wide clip: the sides are cropped)', () => {
    const r = coverRect(1920, 1080, 1080, 1920);
    expect(r.h).toBeCloseTo(1920);
    expect(r.w).toBeGreaterThan(1080);
    expect(r.x).toBeLessThan(0);
    expect(clampShade(2)).toBe(SHADE_MAX);
    expect(clampShade(-1)).toBe(0);
  });
  it('draws the clip behind the lesson, shaded; without a ready frame the board is drawn', () => {
    const src = createCanvas(320, 180);
    const sctx = src.getContext('2d');
    sctx.fillStyle = '#00ff00'; sctx.fillRect(0, 0, 320, 180);
    const c = createCanvas(108, 192);
    const ctx = c.getContext('2d') as unknown as CanvasRenderingContext2D;
    drawBgVideo(ctx, { frame: src as unknown as CanvasImageSource, width: 320, height: 180, shade: 0 }, 108, 192, true);
    expect(Array.from(c.getContext('2d').getImageData(54, 96, 1, 1).data.slice(0, 3))).toEqual([0, 255, 0]);
    drawBgVideo(ctx, { frame: src as unknown as CanvasImageSource, width: 320, height: 180, shade: 0.5 }, 108, 192, true);
    const g = c.getContext('2d').getImageData(54, 96, 1, 1).data[1];
    expect(g).toBeGreaterThan(100); expect(g).toBeLessThan(150); // dark shade over green

    const reel = buildReel({ kind: 'arithmetic', text: '47 + 35', lang: 'en' });
    const pic = (bg: boolean) => {
      const k = createCanvas(1080, 1920);
      drawReelFrame(k.getContext('2d') as unknown as CanvasRenderingContext2D, reel, 1500, { format: 'vertical', bgVideo: bg ? { frame: src as unknown as CanvasImageSource, width: 320, height: 180, shade: 0.3 } : null });
      return k;
    };
    const withClip = pic(true), plain = pic(false);
    const corner = (k: Canvas) => Array.from(k.getContext('2d').getImageData(20, 1000, 1, 1).data.slice(0, 3));
    expect(corner(withClip)[1]).toBeGreaterThan(corner(withClip)[0] + 80); // greenish: the clip shows
    expect(corner(plain)).not.toEqual(corner(withClip));
  });
});
