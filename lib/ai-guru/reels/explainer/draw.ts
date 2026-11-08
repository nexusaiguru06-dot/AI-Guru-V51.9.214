/**
 * V51.9.124 — one frame of an explainer shot, the cinematic way: a dark picture that zooms slowly (stars, a glowing
 * planet, light rain, a beam, an arrow, a lit grid, an atom, a title word or the student's photo), the sentence on top
 * written word by word as the voice says it (key words bold italic, one phrase in a highlight box), a small all-caps
 * label, a number that counts up, a gentle fade in. All drawn in code. Design units (720 × 1280 for a 9:16 reel).
 */
import type { MotionScene } from '../motion/engine';
import { LOOK_FONT } from '../motion/look';
import { stickerShapes } from '../motion/recipes/story';
import { parseMarkup, pickBi, type XShot } from './script';

type Ctx = CanvasRenderingContext2D;
const SERIF = LOOK_FONT.elegant;
const SANS = LOOK_FONT.modern;
const ACCENT = '#8b7cf6';

/** A repeatable random number 0..1 for (seed, i). */
const rnd = (seed: number, i: number) => { const x = Math.sin(seed * 9301.17 + i * 49297.3) * 233280.5; return x - Math.floor(x); };
const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.pow(1 - x, 3));
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

const photos = new Map<string, HTMLImageElement>();
function photoOf(src?: string): HTMLImageElement | null {
  if (!src || typeof Image === 'undefined') return null;
  let im = photos.get(src);
  if (!im) { im = new Image(); im.src = src; photos.set(src, im); }
  return im.complete && im.naturalWidth ? im : null;
}
/** Decodes every photo of a script before an MP4 is made. */
export async function explainerPhotosReady(shots: XShot[]) {
  await Promise.all(shots.filter((s) => s.photo).map((s) => { photoOf(s.photo); return photos.get(s.photo!)?.decode().catch(() => undefined); }));
}

/* ---------------- backgrounds and pictures ---------------- */

function stars(ctx: Ctx, W: number, H: number, n: number, t: number, seed: number, bright = 1) {
  for (let i = 0; i < n; i++) {
    const x = rnd(seed, i) * W, y = rnd(seed + 1, i) * H;
    const r = 0.5 + rnd(seed + 2, i) * 1.6;
    const tw = 0.55 + 0.45 * Math.sin(t / (600 + rnd(seed + 3, i) * 900) + i);
    ctx.globalAlpha = Math.min(1, (0.25 + rnd(seed + 4, i) * 0.75) * tw * bright);
    ctx.fillStyle = i % 9 === 0 ? '#ffd9a8' : i % 7 === 0 ? '#bcd4ff' : '#ffffff';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function glow(ctx: Ctx, x: number, y: number, r: number, color: string, a: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1;
}

function nightSky(ctx: Ctx, W: number, H: number, t: number) {
  // the Milky Way: soft clouds along a diagonal
  for (let i = 0; i < 14; i++) {
    const p = i / 13;
    glow(ctx, W * (0.05 + p * 0.95), H * (0.85 - p * 0.75), W * (0.22 + rnd(5, i) * 0.12), i % 2 ? 'rgba(150,120,220,1)' : 'rgba(120,160,230,1)', 0.09);
  }
  stars(ctx, W, H, 320, t, 11);
  // the ground and a person looking up
  const gy = H * 0.86;
  ctx.fillStyle = '#020306'; ctx.fillRect(0, gy, W, H - gy);
  const fig = stickerShapes({ cast: 'man', id: 'explainer' });
  const k = (H * 0.2) / (fig.box.y1 - fig.box.y0);
  ctx.save();
  ctx.translate(W / 2, gy + 4); ctx.scale(k, k); ctx.translate(-(fig.box.x0 + fig.box.x1) / 2, -fig.box.y1);
  for (const o of fig.ops) {
    ctx.beginPath(); o.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    if (o.closed) { ctx.closePath(); ctx.fillStyle = '#020306'; ctx.fill(); }
    ctx.lineWidth = o.width + 1; ctx.strokeStyle = '#020306'; ctx.stroke();
  }
  ctx.restore();
}

function planet(ctx: Ctx, W: number, H: number, t: number, kind: string) {
  const cx = W / 2, cy = H * 0.56, R = Math.min(W, H) * 0.25;
  stars(ctx, W, H, 160, t, 21, 0.8);
  if (kind === 'sun') {
    glow(ctx, cx, cy, R * 2.6, 'rgba(255,140,40,1)', 0.35);
    glow(ctx, cx, cy, R * 1.6, 'rgba(255,190,80,1)', 0.5);
  } else glow(ctx, cx, cy, R * 1.35, kind === 'mars' ? 'rgba(255,120,80,1)' : 'rgba(90,170,255,1)', 0.35);
  const g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.35, R * 0.1, cx, cy, R);
  const pal: Record<string, [string, string, string]> = { sun: ['#fff4b0', '#ffb02e', '#e3540f'], earth: ['#5aa2ff', '#1e4fb8', '#0b1f55'], moon: ['#f1f1f1', '#b5b5b5', '#5e5e5e'], mars: ['#ffb08a', '#d2582a', '#5c1d0c'] };
  const [a, b, c] = pal[kind] ?? pal.earth;
  g.addColorStop(0, a); g.addColorStop(0.55, b); g.addColorStop(1, c);
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill(); ctx.clip();
  const spin = (t / 9000) % 1;
  if (kind === 'earth') {
    // land and clouds drifting round
    for (let i = 0; i < 9; i++) {
      const x = cx - R + ((rnd(31, i) + spin) % 1) * R * 2.6 - R * 0.3, y = cy - R * 0.7 + rnd(32, i) * R * 1.4;
      ctx.fillStyle = i % 3 ? 'rgba(70,150,70,0.85)' : 'rgba(180,150,90,0.8)';
      ctx.beginPath(); ctx.ellipse(x, y, R * (0.18 + rnd(33, i) * 0.22), R * (0.1 + rnd(34, i) * 0.16), rnd(35, i) * 3, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = 0; i < 7; i++) {
      const x = cx - R + ((rnd(41, i) + spin * 1.4) % 1) * R * 2.6 - R * 0.3, y = cy - R * 0.8 + rnd(42, i) * R * 1.6;
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.ellipse(x, y, R * 0.3, R * 0.05, 0.2, 0, Math.PI * 2); ctx.fill();
    }
  } else if (kind === 'sun') {
    for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(255,${200 + Math.floor(rnd(51, i) * 55)},120,${0.15 + 0.15 * Math.sin(t / 300 + i)})`; ctx.beginPath(); ctx.arc(cx - R + rnd(52, i) * R * 2, cy - R + rnd(53, i) * R * 2, R * 0.08, 0, Math.PI * 2); ctx.fill(); }
  } else {
    for (let i = 0; i < 12; i++) { ctx.fillStyle = kind === 'mars' ? 'rgba(90,25,10,0.45)' : 'rgba(80,80,80,0.45)'; const x = cx - R + ((rnd(61, i) + spin) % 1) * R * 2.4 - R * 0.2, y = cy - R * 0.8 + rnd(62, i) * R * 1.6; ctx.beginPath(); ctx.arc(x, y, R * (0.04 + rnd(63, i) * 0.1), 0, Math.PI * 2); ctx.fill(); }
  }
  // night side
  const sh = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
  sh.addColorStop(0.45, 'rgba(0,0,0,0)'); sh.addColorStop(1, kind === 'sun' ? 'rgba(120,20,0,0.35)' : 'rgba(0,0,10,0.75)');
  ctx.fillStyle = sh; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
  ctx.restore();
  if (kind !== 'sun') { ctx.strokeStyle = kind === 'mars' ? 'rgba(255,170,130,0.5)' : 'rgba(140,200,255,0.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, R + 1.5, 0, Math.PI * 2); ctx.stroke(); }
}

function rain(ctx: Ctx, W: number, H: number, t: number, a = 1) {
  ctx.strokeStyle = 'rgba(120,170,230,0.12)'; ctx.lineWidth = 1;
  for (let i = 0; i < 12; i++) { const x = W * (i + 0.5) / 12; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let i = 0; i < 80; i++) {
    const x = rnd(71, i) * W, len = 60 + rnd(72, i) * 160, sp = 0.35 + rnd(73, i) * 0.9;
    const y = ((rnd(74, i) * (H + len) + t * sp) % (H + len)) - len;
    const g = ctx.createLinearGradient(x, y, x, y + len);
    g.addColorStop(0, 'rgba(160,210,255,0)'); g.addColorStop(1, `rgba(190,225,255,${0.55 * a})`);
    ctx.strokeStyle = g; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + len); ctx.stroke();
  }
}

function beam(ctx: Ctx, W: number, H: number, t: number, D: number) {
  rain(ctx, W, H, t, 0.35);
  const p = ease(clamp01((t - D * 0.12) / (D * 0.35)));
  const x0 = W * 0.22, y0 = H * 0.92, x1 = W * 0.78, y1 = H * 0.36;
  const x = x0 + (x1 - x0) * p, y = y0 + (y1 - y0) * p;
  ctx.save();
  ctx.shadowColor = '#7dd3fc'; ctx.shadowBlur = 36; ctx.strokeStyle = '#d6f2ff'; ctx.lineWidth = 8; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x, y); ctx.stroke();
  ctx.restore();
  glow(ctx, x, y, 90, 'rgba(160,220,255,1)', 0.6 * (p > 0 ? 1 : 0));
  if (p >= 1) glow(ctx, x1, y1, 220, 'rgba(120,200,255,1)', 0.35 * (0.6 + 0.4 * Math.sin(t / 180)));
}

function arrow(ctx: Ctx, W: number, H: number, t: number, D: number) {
  stars(ctx, W, H, 140, t, 81, 0.7);
  const p = ease(clamp01((t - D * 0.1) / (D * 0.45)));
  const x0 = W * 0.3, y0 = H * 0.9, x1 = W * 0.7, y1 = H * 0.34;
  const x = x0 + (x1 - x0) * p, y = y0 + (y1 - y0) * p;
  const ang = Math.atan2(y1 - y0, x1 - x0);
  ctx.save();
  ctx.shadowColor = '#c4b5fd'; ctx.shadowBlur = 24; ctx.strokeStyle = '#ece8ff'; ctx.fillStyle = '#ece8ff'; ctx.lineWidth = 7; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x, y); ctx.stroke();
  if (p > 0.05) { ctx.beginPath(); ctx.moveTo(x + Math.cos(ang) * 30, y + Math.sin(ang) * 30); ctx.lineTo(x + Math.cos(ang + 2.5) * 30, y + Math.sin(ang + 2.5) * 30); ctx.lineTo(x + Math.cos(ang - 2.5) * 30, y + Math.sin(ang - 2.5) * 30); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  if (p >= 1) glow(ctx, x1 + Math.cos(ang) * 60, y1 + Math.sin(ang) * 60, 70, 'rgba(255,255,255,1)', 0.55);
}

function grid(ctx: Ctx, W: number, H: number, t: number, D: number) {
  const cols = 11, rows = 20, x0 = W * 0.12, x1 = W * 0.88, y0 = H * 0.32, y1 = H * 0.86;
  const sweep = clamp01((t - D * 0.1) / (D * 0.6));
  const hue = (q: number) => `hsl(${Math.round(0 + q * 270)}, 90%, 62%)`;
  for (let c = 0; c < cols; c++) {
    const x = x0 + ((x1 - x0) * c) / (cols - 1);
    ctx.strokeStyle = 'rgba(140,170,220,0.12)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y0 - 20); ctx.lineTo(x, y1 + 10); ctx.stroke();
    for (let r = 0; r < rows; r++) {
      const y = y0 + ((y1 - y0) * r) / (rows - 1);
      const along = (c / (cols - 1)) * 0.6 + (1 - r / (rows - 1)) * 0.4;
      const near = Math.abs((c - (cols - 1) * 0.35) - (rows - 1 - r) * 0.3) < 2.4;
      const lit = near && along <= sweep;
      ctx.fillStyle = lit ? hue(along) : 'rgba(170,190,230,0.25)';
      if (lit) { ctx.save(); ctx.shadowColor = hue(along); ctx.shadowBlur = 14; }
      ctx.beginPath(); ctx.arc(x, y, lit ? 4.2 : 2, 0, Math.PI * 2); ctx.fill();
      if (lit) ctx.restore();
    }
  }
  const lg = ctx.createLinearGradient(x0, 0, x1, 0);
  for (let i = 0; i <= 6; i++) lg.addColorStop(i / 6, hue(i / 6));
  ctx.fillStyle = lg; ctx.fillRect(x0, y1 + 40, x1 - x0, 5);
}

function atom(ctx: Ctx, W: number, H: number, t: number) {
  stars(ctx, W, H, 120, t, 91, 0.6);
  const cx = W / 2, cy = H * 0.56, R = Math.min(W, H) * 0.3;
  glow(ctx, cx, cy, R * 0.5, 'rgba(255,255,255,1)', 0.5);
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.fill();
  for (let k = 0; k < 3; k++) {
    const rot = (k * Math.PI) / 3;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
    ctx.strokeStyle = 'rgba(210,225,255,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, R, R * 0.34, 0, 0, Math.PI * 2); ctx.stroke();
    const a = t / (700 + k * 160) + k * 2;
    ctx.fillStyle = '#e8f0ff'; ctx.shadowColor = '#9cc4ff'; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(Math.cos(a) * R, Math.sin(a) * R * 0.34, 6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

function titleWord(ctx: Ctx, W: number, H: number, t: number, D: number, word: string) {
  ctx.strokeStyle = 'rgba(150,180,230,0.10)'; ctx.lineWidth = 1;
  for (let i = 0; i < 40; i++) { const x = rnd(101, i) * W; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let i = 0; i < 260; i++) { ctx.fillStyle = `rgba(200,220,255,${0.2 + rnd(102, i) * 0.4})`; ctx.fillRect(rnd(103, i) * W, rnd(104, i) * H, 1.5, 1.5); }
  const p = ease(clamp01(t / (D * 0.3)));
  let size = Math.min(W, H) * 0.17;
  ctx.font = `700 ${size}px ${SERIF}`;
  while (ctx.measureText(word).width > W * 0.86 && size > 30) { size -= 4; ctx.font = `700 ${size}px ${SERIF}`; }
  ctx.save();
  ctx.globalAlpha = p; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(200,220,255,0.7)'; ctx.shadowBlur = 30; ctx.fillStyle = '#f2f5ff';
  ctx.translate(W / 2, H * 0.55); ctx.scale(0.94 + 0.06 * p + 0.03 * (t / D), 0.94 + 0.06 * p + 0.03 * (t / D));
  ctx.fillText(word, 0, 0);
  ctx.restore();
}

function photo(ctx: Ctx, W: number, H: number, t: number, D: number, src?: string) {
  const im = photoOf(src);
  if (!im) { nightSky(ctx, W, H, t); return; }
  const z = 1.04 + 0.1 * (t / D);
  const s = Math.max(W / im.naturalWidth, H / im.naturalHeight) * z;
  const dx = (t / D) * W * 0.03;
  ctx.drawImage(im, W / 2 - (im.naturalWidth * s) / 2 - dx, H / 2 - (im.naturalHeight * s) / 2, im.naturalWidth * s, im.naturalHeight * s);
  ctx.fillStyle = 'rgba(0,0,0,0.42)'; ctx.fillRect(0, 0, W, H);
}

/**
 * V51.9.141 — a picture from the textbook: shown WHOLE (never cropped) on a paper card under the sentence, lit softly,
 * coming in gently, over a quiet starry board.
 */
function figure(ctx: Ctx, W: number, H: number, t: number, D: number, src?: string) {
  stars(ctx, W, H, 120, t, 2, 0.6);
  const im = photoOf(src);
  if (!im || !im.naturalWidth) return;
  const vertical = H > W;
  const top = H * (vertical ? 0.34 : 0.33), bottom = H * (vertical ? 0.9 : 0.93);
  const maxW = W * (vertical ? 0.9 : 0.8), maxH = bottom - top;
  const s = Math.min(maxW / im.naturalWidth, maxH / im.naturalHeight);
  const w = im.naturalWidth * s, h = im.naturalHeight * s;
  const a = ease(clamp01(t / 700));
  const z = 0.96 + 0.04 * a + 0.025 * clamp01(t / D);
  const cx = W / 2, cy = (top + bottom) / 2 + (1 - a) * 24;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(cx, cy); ctx.scale(z, z);
  // the card, with a soft glow around it
  ctx.shadowColor = 'rgba(150,180,255,0.55)'; ctx.shadowBlur = 38;
  ctx.fillStyle = '#fbfaf5';
  ctx.beginPath(); ctx.roundRect(-w / 2 - 14, -h / 2 - 14, w + 28, h + 28, 14); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.drawImage(im, -w / 2, -h / 2, w, h);
  // a slow sweep of light across it
  const sweep = ((t % 6000) / 6000) * (w + 400) - 200;
  const g = ctx.createLinearGradient(-w / 2 + sweep - 120, 0, -w / 2 + sweep + 120, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.16)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.restore();
}

/* ---------------- words ---------------- */

interface Placed { text: string; em: boolean; hl: boolean; x: number; w: number; line: number; at: number }

function layoutWords(ctx: Ctx, sentence: string, size: number, maxW: number): { words: Placed[]; lines: number } {
  const ws = parseMarkup(sentence);
  const font = (em: boolean) => `${em ? 'italic 700' : '600'} ${size}px ${SERIF}`;
  ctx.font = font(false);
  const space = ctx.measureText(' ').width;
  const placed: Placed[] = [];
  let line = 0, x = 0;
  const widths = ws.map((w) => { ctx.font = font(w.em); return ctx.measureText(w.text).width; });
  ws.forEach((w, i) => {
    if (x > 0 && x + widths[i] > maxW) { line++; x = 0; }
    placed.push({ ...w, x, w: widths[i], line, at: 0 });
    x += widths[i] + space;
  });
  // when each word is said: in proportion to the letters before it
  const total = ws.reduce((n, w) => n + w.text.length + 1, 0) || 1;
  let before = 0;
  placed.forEach((p) => { p.at = before / total; before += p.text.length + 1; });
  return { words: placed, lines: line + 1 };
}

function sentence(ctx: Ctx, W: number, H: number, scene: MotionScene, t: number, shot: XShot, lang: 'en' | 'ml', sub: string | undefined) {
  const cap = scene.captions[0];
  const start = cap?.voiceT0 ?? (cap ? cap.t0 + 150 : 200);
  const dur = cap?.voiceMs ?? Math.max(1200, ((cap ? cap.t1 - cap.t0 : 3000) * 0.6));
  const said = clamp01((t - start) / dur);
  const vertical = H > W;
  let size = vertical ? 50 : 44;
  const maxW = W * (vertical ? 0.84 : 0.7);
  let lay = layoutWords(ctx, pickBi(shot.text, lang), size, maxW);
  while (lay.lines > (vertical ? 4 : 3) && size > 30) { size -= 3; lay = layoutWords(ctx, pickBi(shot.text, lang), size, maxW); }
  const lh = size * 1.28;
  const top = vertical ? H * 0.1 : H * 0.08;
  const lineW: number[] = [];
  for (const p of lay.words) lineW[p.line] = Math.max(lineW[p.line] ?? 0, p.x + p.w);
  const xOf = (p: Placed) => (W - lineW[p.line]) / 2 + p.x;
  const appear = clamp01(t / 350);
  // the highlight box grows over its words as they are said
  const hl = lay.words.filter((p) => p.hl);
  for (const ln of [...new Set(hl.map((p) => p.line))]) {
    const ws = hl.filter((p) => p.line === ln);
    const x0 = xOf(ws[0]) - 8, x1 = xOf(ws[ws.length - 1]) + ws[ws.length - 1].w + 8;
    const grow = clamp01((said - ws[0].at) / Math.max(0.05, (ws[ws.length - 1].at - ws[0].at) + 0.08));
    if (grow <= 0) continue;
    const y = top + ln * lh - size * 0.02;
    ctx.fillStyle = ACCENT; ctx.globalAlpha = 0.9 * appear;
    ctx.beginPath(); ctx.roundRect(x0, y, (x1 - x0) * grow, size * 1.12, 6); ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  for (const p of lay.words) {
    const on = clamp01((said - p.at) * 8 + (said >= 1 ? 1 : 0));
    ctx.font = `${p.em ? 'italic 700' : '600'} ${size}px ${SERIF}`;
    ctx.globalAlpha = (0.28 + 0.72 * on) * appear;
    ctx.fillStyle = '#f5f3ff';
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 10;
    ctx.fillText(p.text, xOf(p), top + p.line * lh + (1 - on) * 4);
  }
  ctx.shadowBlur = 0; ctx.globalAlpha = 1;
  if (sub) {
    ctx.font = `italic 400 ${Math.round(size * 0.52)}px ${SERIF}`;
    ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(230,230,255,0.75)';
    ctx.fillText(sub, W / 2, top + lay.lines * lh + 10, W * 0.86);
  }
}

function spaced(ctx: Ctx, text: string, x: number, y: number, gap: number) {
  // Malayalam (and any non-Latin script) joins its letters: spacing them out would break the words
  if (/[^\u0000-\u024F]/.test(text)) { ctx.textAlign = 'center'; ctx.fillText(text, x, y); ctx.textAlign = 'left'; return; }
  const ws = [...text].map((c) => ctx.measureText(c).width);
  const total = ws.reduce((a, b) => a + b, 0) + gap * (ws.length - 1);
  let cx = x - total / 2;
  [...text].forEach((c, i) => { ctx.fillText(c, cx, y); cx += ws[i] + gap; });
}

/* ---------------- the frame ---------------- */

export function drawExplainerFrame(ctx: Ctx, scene: MotionScene, t: number, o: { dw: number; dh: number; handle?: string; subtitles?: boolean }) {
  const ref = scene.explainer!;
  const { shot, lang } = ref;
  const W = o.dw, H = o.dh, D = Math.max(1, scene.durationMs);
  // base: deep blue-black
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#04060d'); bg.addColorStop(1, '#0b1324');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  // the picture, slowly zooming in
  ctx.save();
  const z = 1 + 0.07 * clamp01(t / D);
  ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2);
  const dim = shot.number ? 0.45 : 1;
  ctx.globalAlpha = dim;
  switch (shot.visual) {
    case 'night-sky': nightSky(ctx, W, H, t); break;
    case 'planet': planet(ctx, W, H, t, shot.planet ?? 'earth'); break;
    case 'rain': rain(ctx, W, H, t); break;
    case 'beam': beam(ctx, W, H, t, D); break;
    case 'arrow': arrow(ctx, W, H, t, D); break;
    case 'grid': grid(ctx, W, H, t, D); break;
    case 'atom': atom(ctx, W, H, t); break;
    case 'title': titleWord(ctx, W, H, t, D, pickBi(shot.big, lang) || ''); break;
    case 'photo': photo(ctx, W, H, t, D, shot.photo); break;
    case 'figure': figure(ctx, W, H, t, D, shot.photo); break;
    default: stars(ctx, W, H, 180, t, 3, 0.8); glow(ctx, W * (0.4 + 0.2 * Math.sin(t / 3000)), H * 0.6, W * 0.6, 'rgba(70,90,180,1)', 0.25);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  // a dark edge, so the words always read
  const v = ctx.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.3, W / 2, H * 0.55, Math.max(W, H) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  const topShade = ctx.createLinearGradient(0, 0, 0, H * 0.4);
  topShade.addColorStop(0, 'rgba(0,0,0,0.55)'); topShade.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = topShade; ctx.fillRect(0, 0, W, H * 0.4);

  // a number counting up
  if (shot.number) {
    const p = ease(clamp01((t - D * 0.12) / (D * 0.5)));
    const val = shot.number.value * p;
    const txt = (shot.number.decimals ? val.toFixed(shot.number.decimals) : Math.round(val).toLocaleString('en-IN'));
    const suf = pickBi(shot.number.suffix, lang);
    const size = Math.min(W, H) * 0.2;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `700 ${size}px ${SERIF}`;
    ctx.fillStyle = '#ffffff'; ctx.shadowColor = 'rgba(160,190,255,0.7)'; ctx.shadowBlur = 26;
    ctx.fillText(txt, W / 2, H * 0.52);
    ctx.shadowBlur = 0;
    if (suf) { ctx.font = `italic 600 ${size * 0.32}px ${SERIF}`; ctx.fillStyle = '#d9d4ff'; ctx.fillText(suf.trim(), W / 2, H * 0.52 + size * 0.72); }
  }
  // the small label
  const label = pickBi(shot.label, lang);
  if (label) {
    const a = ease(clamp01((t - D * 0.25) / 500));
    ctx.globalAlpha = a; ctx.fillStyle = '#e9ecff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = `700 ${H > W ? 22 : 18}px ${SANS}`;
    spaced(ctx, label, W / 2, H * (shot.number ? 0.7 : 0.82), 4);
    ctx.globalAlpha = 1;
  }
  // the sentence, word by word
  sentence(ctx, W, H, scene, t, shot, lang, o.subtitles !== false ? scene.captions[0]?.sub : undefined);
  // who made it
  ctx.globalAlpha = 0.55; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffffff';
  ctx.font = `600 ${H > W ? 18 : 15}px ${SANS}`;
  ctx.fillText(`AI Guru${o.handle ? ` · ${o.handle}` : ''}`, W / 2, H - 34);
  ctx.globalAlpha = 1;
  // fade in from black at the start of every shot
  const fade = 1 - clamp01(t / 280);
  if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${fade})`; ctx.fillRect(0, 0, W, H); }
}
