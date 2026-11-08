/**
 * V51.9.101 — drawing the reel's look: the board (whiteboard, chalkboard, graph paper, notebook, kasavu …), card shapes,
 * transitions between parts, seasonal decorations and the camera's extra moves. Everything here is decoration behind
 * or around the maths: the board items are drawn by draw.ts exactly as before, so a look can never change the maths.
 * Deterministic (no Math.random): preview and MP4 match frame for frame.
 */

import type { ReelLook, ShapeKind, TransitionKind } from './look';
import { rgba } from './look';

type Ctx = CanvasRenderingContext2D;

/** Small deterministic noise for chalk dust, snow, rain. */
export function hash01(n: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * The whole frame's background for this look (design units, dw × dh). `at` = time (ms) and progress (0–1) of the
 * part, for looks that move (the cinematic sky twinkles and slowly zooms in).
 */
export function drawBoard(ctx: Ctx, look: ReelLook, dw: number, dh: number, at: { t: number; p: number } = { t: 0, p: 0 }): void {
  const P = look.palette;
  if (look.board === 'cinema') { drawCinemaSky(ctx, P.paper, P.paper2 ?? P.paper, dw, dh, at.t, at.p); return; }
  if (P.paper2) {
    const g = ctx.createLinearGradient(0, 0, 0, dh);
    g.addColorStop(0, P.paper);
    g.addColorStop(1, P.paper2);
    ctx.fillStyle = g;
  } else ctx.fillStyle = P.paper;
  ctx.fillRect(0, 0, dw, dh);
  ctx.save();
  switch (look.board) {
    case 'graph': {
      ctx.strokeStyle = P.pattern ?? '#cfe2f5';
      for (let i = 0, x = 0; x <= dw; x += 24, i++) {
        ctx.lineWidth = i % 5 === 0 ? 1.2 : 0.5;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, dh); ctx.stroke();
      }
      for (let i = 0, y = 0; y <= dh; y += 24, i++) {
        ctx.lineWidth = i % 5 === 0 ? 1.2 : 0.5;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(dw, y); ctx.stroke();
      }
      break;
    }
    case 'notebook': {
      ctx.strokeStyle = P.pattern ?? '#bcd3f0';
      ctx.lineWidth = 1;
      for (let y = 40; y <= dh; y += 34) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(dw, y); ctx.stroke(); }
      ctx.strokeStyle = '#e88a8a';
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(56, 0); ctx.lineTo(56, dh); ctx.stroke();
      // punched holes on the left edge
      ctx.fillStyle = rgba('#000000', 0.08);
      for (let y = 120; y < dh; y += 260) { ctx.beginPath(); ctx.arc(22, y, 9, 0, Math.PI * 2); ctx.fill(); }
      break;
    }
    case 'chalkboard': {
      // a soft wooden frame and old chalk smudges
      for (let i = 0; i < 26; i++) {
        const x = hash01(i * 3 + 1) * dw, y = hash01(i * 3 + 2) * dh, r = 40 + hash01(i * 3 + 3) * 120;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, rgba('#ffffff', 0.035));
        g.addColorStop(1, rgba('#ffffff', 0));
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      ctx.strokeStyle = '#8a5a2b';
      ctx.lineWidth = 10;
      ctx.strokeRect(5, 5, dw - 10, dh - 10);
      break;
    }
    case 'kasavu': {
      // gold kasavu stripes along the top and bottom edges, like the border of a Kerala mundu
      const gold = P.pattern ?? '#c9a227';
      for (const y0 of [0, dh - 26]) {
        ctx.fillStyle = gold;
        ctx.fillRect(0, y0 + 6, dw, 12);
        ctx.fillStyle = rgba(gold, 0.55);
        ctx.fillRect(0, y0 + (y0 ? 0 : 20), dw, 3);
        ctx.fillRect(0, y0 + (y0 ? 22 : 2), dw, 2);
      }
      break;
    }
    case 'neon': {
      // V51.9.105: a glowing perspective grid at the bottom and soft colour glows, like a synthwave night
      const hz = dh * 0.78, col = P.pattern ?? '#3a1f7a';
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.2;
      for (let i = 0; i <= 8; i++) { const y = hz + ((dh - hz) * (i / 8) ** 1.8); ctx.globalAlpha = 0.35 + 0.5 * (i / 8); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(dw, y); ctx.stroke(); }
      for (let i = -10; i <= 10; i++) { ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.moveTo(dw / 2 + i * dw * 0.04, hz); ctx.lineTo(dw / 2 + i * dw * 0.22, dh); ctx.stroke(); }
      ctx.globalAlpha = 1;
      for (const [x, y, c] of [[0.15, 0.12, '#ff4fd8'], [0.88, 0.3, '#7df9ff'], [0.5, 0.78, '#7c4ddb']] as const) {
        const g = ctx.createRadialGradient(x * dw, y * dh, 0, x * dw, y * dh, dw * 0.45);
        g.addColorStop(0, rgba(c, 0.16));
        g.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, dw, dh);
      }
      break;
    }
    case 'ink': {
      // V51.9.105: cream paper with fibres, a faint ruled margin and two ink blots in the corners
      ctx.strokeStyle = rgba(P.pattern ?? '#d9c9a6', 0.55);
      ctx.lineWidth = 0.8;
      for (let i = 0; i < 140; i++) {
        const x = hash01(i * 5 + 1) * dw, y = hash01(i * 5 + 2) * dh, l = 6 + hash01(i * 5 + 3) * 18, a = hash01(i * 5 + 4) * Math.PI;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
      }
      ctx.fillStyle = rgba('#1d2a44', 0.09);
      for (const [cx, cy, r] of [[dw * 0.94, dh * 0.06, 34], [dw * 0.05, dh * 0.95, 26]]) {
        ctx.beginPath();
        for (let k = 0; k <= 24; k++) { const a = (k / 24) * Math.PI * 2, rr = r * (0.75 + 0.45 * hash01(k + cx)); ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
        ctx.fill();
      }
      ctx.strokeStyle = rgba('#9c2318', 0.25);
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(dw * 0.06, 0); ctx.lineTo(dw * 0.06, dh); ctx.stroke();
      break;
    }
    case 'comic': {
      // V51.9.105: yellow halftone dots in two corners and faint action lines, behind the maths
      ctx.fillStyle = rgba(P.pattern ?? '#ffd84d', 0.85);
      for (const [cx, cy] of [[0, 0], [dw, dh]]) {
        for (let y = 0; y < dh * 0.3; y += 14) for (let x = 0; x < dw * 0.45; x += 14) {
          const d = Math.hypot(x, y) / Math.hypot(dw * 0.45, dh * 0.3);
          const r = Math.max(0, 5 * (1 - d));
          if (r < 0.6) continue;
          ctx.beginPath(); ctx.arc(cx ? cx - x : x, cy ? cy - y : y, r, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.strokeStyle = rgba('#111111', 0.05);
      ctx.lineWidth = 2;
      for (let i = 0; i < 36; i++) { const a = (i / 36) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(dw / 2 + Math.cos(a) * dw * 0.35, dh / 2 + Math.sin(a) * dw * 0.35); ctx.lineTo(dw / 2 + Math.cos(a) * dw, dh / 2 + Math.sin(a) * dw); ctx.stroke(); }
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, dw - 6, dh - 6);
      break;
    }
    case 'blackboard':
    case 'whiteboard':
      break;
    /* V51.9.156 Pro templates (HyperFrames-style). Decoration stays near the edges; the maths area stays calm. */
    case 'poster': drawPoster(ctx, look, dw, dh, at.t); break;
    case 'cobalt': drawCobalt(ctx, look, dw, dh, at.t); break;
    case 'aurora': drawAurora(ctx, look, dw, dh, at.t); break;
    case 'capsule': drawCapsules(ctx, look, dw, dh, at.t); break;
    case 'blueprint': drawBlueprint(ctx, look, dw, dh); break;
    case 'stage': drawStage(ctx, look, dw, dh, at.t); break;
  }
  ctx.restore();
}

/* ---------------- V51.9.156 Pro template boards ---------------- */

/** A bold poster: a thick diagonal band in the corner, halftone dots, a heavy frame. */
function drawPoster(ctx: Ctx, look: ReelLook, dw: number, dh: number, t: number): void {
  const P = look.palette, ink = P.pattern ?? '#111111';
  const slide = Math.sin(t / 1800) * 10;
  ctx.fillStyle = ink;
  ctx.beginPath(); ctx.moveTo(dw * 0.55 + slide, 0); ctx.lineTo(dw, 0); ctx.lineTo(dw, dh * 0.16); ctx.closePath(); ctx.fill();
  ctx.fillStyle = P.frame;
  ctx.beginPath(); ctx.moveTo(dw * 0.7 + slide, 0); ctx.lineTo(dw, 0); ctx.lineTo(dw, dh * 0.09); ctx.closePath(); ctx.fill();
  ctx.fillStyle = rgba(ink, 0.9);
  ctx.beginPath(); ctx.moveTo(0, dh); ctx.lineTo(dw * 0.42 - slide, dh); ctx.lineTo(0, dh * 0.86); ctx.closePath(); ctx.fill();
  ctx.fillStyle = rgba(P.frame, 0.85);
  for (let y = 0; y < dh * 0.22; y += 16) for (let x = 0; x < dw * 0.3; x += 16) {
    const d = Math.hypot(x, y) / Math.hypot(dw * 0.3, dh * 0.22), r = 5.5 * (1 - d);
    if (r > 0.6) { ctx.beginPath(); ctx.arc(x + 8, y + 8, r, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.strokeStyle = ink; ctx.lineWidth = 8; ctx.strokeRect(4, 4, dw - 8, dh - 8);
}

/** A cobalt grid with corner brackets and a slow scanning glow. */
function drawCobalt(ctx: Ctx, look: ReelLook, dw: number, dh: number, t: number): void {
  const P = look.palette, line = P.pattern ?? '#2c5cc9';
  ctx.strokeStyle = rgba(line, 0.35); ctx.lineWidth = 1;
  for (let x = 0; x <= dw; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, dh); ctx.stroke(); }
  for (let y = 0; y <= dh; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(dw, y); ctx.stroke(); }
  const y = ((t / 9) % (dh + 300)) - 150;
  const g = ctx.createLinearGradient(0, y - 150, 0, y + 150);
  g.addColorStop(0, rgba(P.frame, 0)); g.addColorStop(0.5, rgba(P.frame, 0.08)); g.addColorStop(1, rgba(P.frame, 0));
  ctx.fillStyle = g; ctx.fillRect(0, y - 150, dw, 300);
  ctx.strokeStyle = P.frame; ctx.lineWidth = 4;
  const m = 22, k = 56;
  for (const [x0, y0, sx, sy] of [[m, m, 1, 1], [dw - m, m, -1, 1], [m, dh - m, 1, -1], [dw - m, dh - m, -1, -1]] as const) {
    ctx.beginPath(); ctx.moveTo(x0, y0 + sy * k); ctx.lineTo(x0, y0); ctx.lineTo(x0 + sx * k, y0); ctx.stroke();
  }
}

/** Soft colour clouds that drift and pulse slowly (dark: aurora; light: a warm sunset). */
function drawAurora(ctx: Ctx, look: ReelLook, dw: number, dh: number, t: number): void {
  const dark = look.palette.dark;
  const cols = dark ? ['#7c4dff', '#16d9c0', '#ff4fa3'] : ['#ff8a6b', '#ffc48a', '#ff7aa8'];
  const pulse = 0.8 + 0.2 * Math.sin(t / 760);
  cols.forEach((c, i) => {
    const a = t / (5200 + i * 1700) + i * 2.1;
    const x = dw * (0.5 + 0.38 * Math.cos(a)), y = dh * (0.3 + 0.42 * i / 2 + 0.08 * Math.sin(a * 1.3));
    const r = dw * (0.62 + 0.1 * Math.sin(a + i));
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(c, (dark ? 0.24 : 0.3) * pulse));
    g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, dw, dh);
  });
  if (dark) for (let i = 0; i < 60; i++) {
    ctx.fillStyle = rgba('#ffffff', 0.15 + 0.25 * hash01(i + 40) * (0.6 + 0.4 * Math.sin(t / 900 + i)));
    ctx.beginPath(); ctx.arc(hash01(i * 2 + 1) * dw, hash01(i * 2 + 2) * dh, 0.6 + hash01(i + 9) * 1.2, 0, Math.PI * 2); ctx.fill();
  }
}

/** Big rounded capsules floating at the edges. */
function drawCapsules(ctx: Ctx, look: ReelLook, dw: number, dh: number, t: number): void {
  const c = look.palette.pattern ?? '#ffb8a3';
  const caps: Array<[number, number, number, number, number]> = [[-0.08, 0.06, 0.5, 0.07, -0.35], [0.72, 0.12, 0.45, 0.06, 0.4], [-0.1, 0.9, 0.55, 0.08, 0.3], [0.68, 0.84, 0.5, 0.07, -0.3], [0.86, 0.48, 0.26, 0.05, 1.2]];
  caps.forEach(([x, y, w, h, rot], i) => {
    const bob = Math.sin(t / (1600 + i * 300) + i) * 8;
    ctx.save();
    ctx.translate(x * dw + (w * dw) / 2, y * dh + bob);
    ctx.rotate(rot);
    const W = w * dw, H = h * dh, r = H / 2;
    ctx.beginPath();
    ctx.moveTo(-W / 2 + r, -H / 2); ctx.lineTo(W / 2 - r, -H / 2); ctx.arc(W / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(-W / 2 + r, H / 2); ctx.arc(-W / 2 + r, 0, r, Math.PI / 2, -Math.PI / 2); ctx.closePath();
    ctx.fillStyle = rgba(c, i % 2 ? 0.55 : 0.8);
    ctx.fill();
    ctx.restore();
  });
}

/** A blueprint: fine and major grid lines, a compass sketch and measurement marks. */
function drawBlueprint(ctx: Ctx, look: ReelLook, dw: number, dh: number): void {
  const c = look.palette.pattern ?? '#7fb0ea';
  for (let x = 0, i = 0; x <= dw; x += 20, i++) { ctx.strokeStyle = rgba(c, i % 5 ? 0.14 : 0.32); ctx.lineWidth = i % 5 ? 0.6 : 1.2; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, dh); ctx.stroke(); }
  for (let y = 0, i = 0; y <= dh; y += 20, i++) { ctx.strokeStyle = rgba(c, i % 5 ? 0.14 : 0.32); ctx.lineWidth = i % 5 ? 0.6 : 1.2; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(dw, y); ctx.stroke(); }
  ctx.strokeStyle = rgba('#ffffff', 0.3); ctx.lineWidth = 1.4; ctx.setLineDash([8, 6]);
  ctx.beginPath(); ctx.arc(dw * 0.88, dh * 0.07, 70, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(dw * 0.1, dh * 0.94, 54, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = rgba('#ffffff', 0.45); ctx.lineWidth = 1.4;
  for (let i = 0; i <= 10; i++) { const x = dw * 0.25 + i * dw * 0.05, h = i % 5 ? 8 : 16; ctx.beginPath(); ctx.moveTo(x, dh - 18); ctx.lineTo(x, dh - 18 - h); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(dw * 0.25, dh - 18); ctx.lineTo(dw * 0.75, dh - 18); ctx.stroke();
}

/** A stage: a soft spotlight from above, a glowing floor, thin gold rules and drifting dust. */
function drawStage(ctx: Ctx, look: ReelLook, dw: number, dh: number, t: number): void {
  const P = look.palette;
  const sway = Math.sin(t / 2600) * dw * 0.04;
  const g = ctx.createRadialGradient(dw / 2 + sway, -dh * 0.05, 0, dw / 2 + sway, dh * 0.35, dh * 0.7);
  g.addColorStop(0, rgba('#fff3d1', 0.22)); g.addColorStop(1, rgba('#fff3d1', 0));
  ctx.fillStyle = g; ctx.fillRect(0, 0, dw, dh);
  const f = ctx.createRadialGradient(dw / 2, dh * 1.02, 0, dw / 2, dh * 1.02, dw * 0.7);
  f.addColorStop(0, rgba(P.frame, 0.22)); f.addColorStop(1, rgba(P.frame, 0));
  ctx.fillStyle = f; ctx.fillRect(0, dh * 0.6, dw, dh * 0.4);
  ctx.fillStyle = P.frame;
  for (const y of [14, dh - 20]) { ctx.fillRect(0, y, dw, 3); ctx.globalAlpha = 0.5; ctx.fillRect(0, y + 7, dw, 1.5); ctx.globalAlpha = 1; }
  for (let i = 0; i < 36; i++) {
    const x = hash01(i + 500) * dw + Math.sin(t / 3000 + i) * 10;
    const y = (((hash01(i + 600) * dh - t * (0.008 + 0.01 * hash01(i + 700))) % dh) + dh) % dh;
    ctx.fillStyle = rgba('#ffe6a8', 0.1 + 0.15 * hash01(i + 800));
    ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill();
  }
  const v = ctx.createRadialGradient(dw / 2, dh * 0.45, dh * 0.3, dw / 2, dh * 0.45, dh * 0.8);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, dw, dh);
}

/** V51.9.126: the cinematic night sky: stars that twinkle, the Milky Way, two soft glows, a slow zoom and a vignette. */
function drawCinemaSky(ctx: Ctx, top: string, bottom: string, dw: number, dh: number, t: number, p: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, dh);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, dw, dh);
  ctx.save();
  const z = 1 + 0.08 * Math.min(1, Math.max(0, p)); // slow push-in over the part
  ctx.translate(dw / 2, dh * 0.45);
  ctx.scale(z, z);
  ctx.rotate(0.02 * p);
  ctx.translate(-dw / 2, -dh * 0.45);
  // the Milky Way: a soft diagonal band of light
  for (let i = 0; i < 22; i++) {
    const u = i / 21;
    const x = dw * (-0.1 + 1.2 * u), y = dh * (0.12 + 0.5 * u) + Math.sin(u * 7) * 30;
    const r = 120 + 90 * hash01(i + 300);
    const gl = ctx.createRadialGradient(x, y, 0, x, y, r);
    gl.addColorStop(0, rgba('#b9c4ff', 0.05 + 0.03 * hash01(i + 400)));
    gl.addColorStop(1, rgba('#b9c4ff', 0));
    ctx.fillStyle = gl;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // two coloured glows
  for (const [x, y, c, r] of [[0.18, 0.2, '#6d4dff', 0.55], [0.85, 0.62, '#1f7aff', 0.5]] as const) {
    const gl = ctx.createRadialGradient(x * dw, y * dh, 0, x * dw, y * dh, dw * r);
    gl.addColorStop(0, rgba(c, 0.13));
    gl.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = gl;
    ctx.fillRect(0, 0, dw, dh);
  }
  // stars (a few big ones with a little cross of light)
  for (let i = 0; i < 260; i++) {
    const x = hash01(i * 3 + 11) * dw, y = hash01(i * 3 + 12) * dh;
    const big = hash01(i * 3 + 13) > 0.94;
    const tw = 0.55 + 0.45 * Math.sin(t / (700 + 900 * hash01(i + 50)) + i);
    const a = (big ? 0.85 : 0.25 + 0.45 * hash01(i + 77)) * tw;
    ctx.fillStyle = rgba('#e8ecff', a);
    const r = big ? 1.8 : 0.6 + hash01(i + 90) * 0.8;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    if (big) {
      ctx.strokeStyle = rgba('#e8ecff', a * 0.5);
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.lineTo(x + 7, y); ctx.moveTo(x, y - 7); ctx.lineTo(x, y + 7); ctx.stroke();
    }
  }
  // dust drifting slowly upwards
  for (let i = 0; i < 40; i++) {
    const x = hash01(i + 600) * dw + Math.sin(t / 4000 + i) * 12;
    const y = (((hash01(i + 700) * dh - t * (0.006 + 0.01 * hash01(i + 800))) % dh) + dh) % dh;
    ctx.fillStyle = rgba('#ffe6a8', 0.12 + 0.12 * hash01(i + 900));
    ctx.beginPath(); ctx.arc(x, y, 1.4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // vignette
  const v = ctx.createRadialGradient(dw / 2, dh * 0.45, dh * 0.25, dw / 2, dh * 0.45, dh * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, dw, dh);
}

/** Path of a card in this look's shape (title pill, caption card, step pill). */
export function shapePath(ctx: Ctx, shape: ShapeKind, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  if (shape === 'ribbon') {
    const n = Math.min(h * 0.35, 18);
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w - n, y + h / 2);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x + n, y + h / 2);
    ctx.closePath();
    return;
  }
  if (shape === 'sticky') {
    const f = Math.min(22, h * 0.3);
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h - f);
    ctx.lineTo(x + w - f, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    return;
  }
  if (shape === 'speech') {
    // V51.9.105 comic: a rounded box with a little tail at the bottom right (clear of the logo on the left)
    const rr2 = Math.min(r + 4, w / 2, h / 2), tx = x + w - Math.min(w * 0.18, 60), t = Math.min(16, h * 0.35);
    ctx.moveTo(x + rr2, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr2);
    ctx.arcTo(x + w, y + h, x, y + h, rr2);
    ctx.lineTo(tx, y + h);
    ctx.lineTo(tx + t * 0.4, y + h + t);
    ctx.lineTo(tx - t, y + h);
    ctx.arcTo(x, y + h, x, y, rr2);
    ctx.arcTo(x, y, x + w, y, rr2);
    ctx.closePath();
    return;
  }
  const rr = shape === 'bubble' ? Math.min(h / 2, w / 2) : Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Fills and outlines a card in the look's shape (sticky notes get a soft shadow and a folded corner). */
export function drawCard(ctx: Ctx, look: ReelLook, x: number, y: number, w: number, h: number, r: number, stroke: string, lineWidth0: number): void {
  const P = look.palette;
  const lineWidth = lineWidth0 * (P.outline ?? 1);
  if (look.shape === 'sticky') {
    ctx.save();
    ctx.shadowColor = rgba('#000000', 0.18);
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    shapePath(ctx, 'sticky', x, y, w, h, r);
    ctx.fillStyle = P.panel;
    ctx.fill();
    ctx.restore();
    shapePath(ctx, 'sticky', x, y, w, h, r);
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = stroke;
    ctx.stroke();
    const f = Math.min(22, h * 0.3);
    ctx.beginPath();
    ctx.moveTo(x + w, y + h - f);
    ctx.lineTo(x + w - f, y + h - f);
    ctx.lineTo(x + w - f, y + h);
    ctx.closePath();
    ctx.fillStyle = rgba('#000000', 0.08);
    ctx.fill();
    ctx.stroke();
    return;
  }
  if (look.board === 'cinema') {
    // V51.9.126: frosted glass with a faint glowing edge (the sky shows through)
    ctx.save();
    shapePath(ctx, look.shape, x, y, w, h, r);
    ctx.fillStyle = rgba(P.panel, 0.55);
    ctx.fill();
    ctx.shadowColor = rgba(P.line, 0.5);
    ctx.shadowBlur = 14;
    ctx.lineWidth = Math.max(1.2, lineWidth * 0.45);
    ctx.strokeStyle = rgba(P.line, 0.35);
    ctx.stroke();
    ctx.restore();
    return;
  }
  shapePath(ctx, look.shape, x, y, w, h, r);
  ctx.fillStyle = P.panel;
  ctx.fill();
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = stroke;
  ctx.stroke();
}

export const TRANSITION_MS = 480;
const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);

/**
 * Begins a transition into a new part (call before drawing the part; call `endTransition` after).
 * Moves/scales the frame for zoom and slide; wipe and chalk are drawn on top by `endTransition`.
 */
export function beginTransition(ctx: Ctx, kind: TransitionKind, p: number, W: number, H: number): void {
  ctx.save();
  if (p >= 1) return;
  const e = easeOut(p);
  if (kind === 'zoom' || kind === 'flash') {
    const s = 1.07 - 0.07 * e;
    ctx.translate(W / 2, H / 2);
    ctx.scale(s, s);
    ctx.translate(-W / 2, -H / 2);
  } else if (kind === 'slide') {
    ctx.translate(W * 0.12 * (1 - e), 0);
  }
}

export function endTransition(ctx: Ctx, kind: TransitionKind, p: number, W: number, H: number, look: ReelLook): void {
  ctx.restore();
  if (p >= 1 || kind === 'cut') return;
  const e = easeOut(p);
  const P = look.palette;
  ctx.save();
  if (kind === 'wipe') {
    const x = W * e;
    ctx.fillStyle = P.paper;
    ctx.fillRect(x, 0, W - x, H);
    ctx.fillStyle = P.frame;
    ctx.fillRect(x - W * 0.012, 0, W * 0.012, H);
  } else if (kind === 'chalk') {
    ctx.fillStyle = rgba(P.paper, 0.85 * (1 - e));
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = rgba('#ffffff', 0.5 * (1 - e));
    for (let i = 0; i < 90; i++) {
      const x = hash01(i * 7 + 1) * W;
      const y = H * 0.25 + hash01(i * 7 + 2) * H * 0.5 - e * 40 * hash01(i * 7 + 3);
      const r = 1 + hash01(i * 7 + 4) * W * 0.004;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
  } else if (kind === 'iris') {
    // V51.9.156: the new part opens in a growing circle
    const r = Math.hypot(W, H) * 0.55 * e;
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.arc(W / 2, H / 2, Math.max(1, r), 0, Math.PI * 2, true);
    ctx.fillStyle = P.paper;
    ctx.fill('evenodd');
    ctx.strokeStyle = P.frame;
    ctx.lineWidth = W * 0.008;
    ctx.beginPath(); ctx.arc(W / 2, H / 2, Math.max(1, r), 0, Math.PI * 2); ctx.stroke();
  } else if (kind === 'curtain') {
    // two panels slide apart from the middle
    const half = (W / 2) * (1 - e);
    ctx.fillStyle = P.frame;
    ctx.fillRect(0, 0, half, H);
    ctx.fillRect(W - half, 0, half, H);
    ctx.fillStyle = rgba('#000000', 0.18);
    ctx.fillRect(half - W * 0.01, 0, W * 0.01, H);
    ctx.fillRect(W - half, 0, W * 0.01, H);
  } else if (kind === 'blinds') {
    // eight bands open one after another
    const n = 8, bh = H / n;
    ctx.fillStyle = P.frame;
    for (let i = 0; i < n; i++) {
      const k = Math.min(1, Math.max(0, p * 1.6 - i * 0.075));
      const cover = bh * (1 - easeOut(k));
      if (cover > 0.5) ctx.fillRect(0, i * bh, W, cover);
    }
  } else if (kind === 'flash') {
    // a quick flash of light, then the part
    ctx.fillStyle = rgba(P.dark ? '#ffffff' : P.frame, 0.85 * (1 - e) * (1 - e));
    ctx.fillRect(0, 0, W, H);
  } else {
    // zoom / slide fade in from the paper
    ctx.fillStyle = rgba(P.paper, 0.9 * (1 - e));
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}
