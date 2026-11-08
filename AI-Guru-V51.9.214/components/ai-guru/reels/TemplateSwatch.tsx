'use client';

/**
 * V51.9.156 — a live preview of a Pro template on its card: the template's own background, title card and caption,
 * drawn by the same engine as the reel. It plays the title entrance (and the background's motion) on hover or tap.
 */
import { useEffect, useRef } from 'react';
import { LOOK_FONT, lookById } from '@/lib/ai-guru/reels/motion/look';
import { drawBoard, drawCard } from '@/lib/ai-guru/reels/motion/look-draw';
import { drawTitleText } from '@/lib/ai-guru/reels/motion/draw';

const DW = 640, DH = 360;

function paint(ctx: CanvasRenderingContext2D, lookId: string, t: number, title: string) {
  const look = lookById(lookId), P = look.palette, ui = LOOK_FONT[look.font];
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.scale(ctx.canvas.width / DW, ctx.canvas.height / DH);
  drawBoard(ctx, look, DW, DH, { t, p: (t % 4000) / 4000 });
  // title card
  const T = { x: 90, y: 54, w: 460, h: 74 };
  drawCard(ctx, look, T.x, T.y, T.w, T.h, 16, P.frame, 4);
  const px = 34;
  ctx.font = `700 ${px}px ${ui}`;
  const tw = ctx.measureText(title).width;
  ctx.fillStyle = P.panelText; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  drawTitleText(ctx, look.titleIn ?? 'none', title, T.x + T.w / 2 - tw / 2, T.y + T.h / 2 + 2, tw, px, t, P.frame, P.panelText);
  // a caption with one word spoken "now"
  const C = { x: 120, y: 236, w: 400, h: 70 };
  drawCard(ctx, look, C.x, C.y, C.w, C.h, 18, P.line, 3);
  ctx.font = `600 24px ${ui}`;
  const words: Array<[string, string]> = [['Step', P.cap.spoken], ['by', P.cap.spoken], ['step', P.cap.now], ['…', P.cap.idle]];
  let x = C.x + C.w / 2 - words.reduce((a, [w]) => a + ctx.measureText(`${w} `).width, 0) / 2;
  for (const [w, c] of words) { ctx.fillStyle = c; ctx.fillText(w, x, C.y + C.h / 2); x += ctx.measureText(`${w} `).width; }
}

export function TemplateSwatch({ lookId, title = 'Photosynthesis' }: { lookId: string; title?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const raf = useRef(0);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (ctx) paint(ctx, lookId, 1e6, title); // the settled frame
    return () => cancelAnimationFrame(raf.current);
  }, [lookId, title]);
  const play = () => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    cancelAnimationFrame(raf.current);
    const t0 = performance.now();
    const step = (now: number) => {
      const t = now - t0;
      paint(ctx, lookId, t < 2600 ? t : 1e6, title);
      if (t < 2600) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  };
  return <canvas ref={ref} width={480} height={270} onMouseEnter={play} onClick={play} className="aspect-video w-full cursor-pointer bg-black/30" aria-label="Preview of this template (tap to play)" data-template-swatch={lookId} />;
}
