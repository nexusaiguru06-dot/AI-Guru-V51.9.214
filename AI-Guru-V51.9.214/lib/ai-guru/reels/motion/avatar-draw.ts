/**
 * V51.9.100 — the teacher's face in a small corner bubble, lips moving with the voice.
 *
 * Built-in lip-sync (any computer, no GPU): the teacher's photo with the mouth marked. Each frame
 *   1. the head sways a little and nods with the voice,
 *   2. the mouth opens: a dark mouth (teeth showing when wide open) is drawn at the lips, and the part of the face
 *      below the lips (lower lip, chin) is drawn again lower by the jaw drop, through a soft-edged mask so no seam shows
 *      (the "paste back with feathered edges" idea from LatentSync's affine_transform.restore_img),
 *   3. the eyes blink now and then,
 *   4. a teal ring glows with the voice; the teacher's name sits under the bubble.
 * AI lip-sync: a frame of the LatentSync video is drawn in the same bubble instead (no warping).
 * 'still' style: the photo and the glowing ring only.
 */

import type { AvatarStyle, FaceMarks } from '../../teacher/avatar';
import { FONT } from './grammar';
import type { FrameKind } from './look';
import { blinkAt, mouthAt, type MouthTrack } from './lipsync';

type Ctx = CanvasRenderingContext2D;

export interface PreparedAvatar {
  img: CanvasImageSource;
  /** Side of the (square) picture in its own pixels. */
  size: number;
  marks: FaceMarks;
  name: string;
  style: AvatarStyle;
  /** Colour of the skin near the eyes (for the eyelids). */
  skin: string;
  /** Picks the blink pattern (different teachers blink at different moments). */
  seed: number;
}

export interface TeacherOnReel {
  avatar: PreparedAvatar;
  /** Mouth shapes per frame, from the reel's voice (null = mouth closed). */
  track: MouthTrack | null;
  /** AI lip-sync: the current frame of the teacher's lip-synced face video (drawn instead of the photo). */
  frame?: CanvasImageSource | null;
}

const hash = (s: string) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h) % 1000; };

function makeCanvas(w: number, h: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** Average colour of a small patch of the picture (fractions of its side), as #rrggbb; null when it cannot be read. */
function sample(img: CanvasImageSource, size: number, fx: number, fy: number, fr: number): string | null {
  const c = makeCanvas(48, 48);
  const ctx = c?.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  try {
    ctx.drawImage(img, 0, 0, size, size, 0, 0, 48, 48);
    const x0 = Math.max(0, Math.round((fx - fr) * 48)), y0 = Math.max(0, Math.round((fy - fr) * 48));
    const w = Math.max(1, Math.min(48 - x0, Math.round(fr * 2 * 48))), h = Math.max(1, Math.min(48 - y0, Math.round(fr * 2 * 48)));
    const d = ctx.getImageData(x0, y0, w, h).data;
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
    const n = d.length / 4 || 1;
    const hex = (v: number) => Math.round(v / n).toString(16).padStart(2, '0');
    return `#${hex(r)}${hex(g)}${hex(b)}`;
  } catch {
    return null;
  }
}

/** Gets the photo ready once per reel: its size, and the skin colour for the eyelids. */
export function prepareAvatar(img: CanvasImageSource, o: { marks: FaceMarks; name: string; style: AvatarStyle; id?: string }): PreparedAvatar {
  const w = (img as { naturalWidth?: number }).naturalWidth || (img as { width?: number }).width || 512;
  const h = (img as { naturalHeight?: number }).naturalHeight || (img as { height?: number }).height || 512;
  const size = Math.min(Number(w), Number(h));
  const eyes = o.marks.eyes;
  // just above each eye, between the brows and the lid
  const skin = (eyes && sample(img, size, (eyes[0].x + eyes[1].x) / 2, Math.max(0.05, (eyes[0].y + eyes[1].y) / 2 - 0.02), 0.03)) || sample(img, size, o.marks.mouth.x, o.marks.mouth.y - 0.12, 0.03) || '#c48b6a';
  return { img, size, marks: o.marks, name: o.name, style: o.style, skin, seed: hash(o.id ?? o.name) };
}

/* the lower-jaw layer is drawn through this canvas (reused between frames; re-made when the bubble size changes) */
let jawCanvas: HTMLCanvasElement | null = null;

/** Draws the teacher's bubble centred on (cx, cy), d across, at reel time tMs. Coordinates are the caller's (design units). */
/** The bubble's outline: a circle, a rounded square, or a square photo (polaroid). V51.9.101. */
function framePath(ctx: Ctx, frame: FrameKind, cx: number, cy: number, r: number, grow = 0) {
  ctx.beginPath();
  if (frame === 'circle') { ctx.arc(cx, cy, r + grow, 0, Math.PI * 2); ctx.closePath(); return; }
  const h = r + grow;
  const rr = frame === 'rounded' ? h * 0.32 : h * 0.04;
  ctx.moveTo(cx - h + rr, cy - h);
  ctx.arcTo(cx + h, cy - h, cx + h, cy + h, rr);
  ctx.arcTo(cx + h, cy + h, cx - h, cy + h, rr);
  ctx.arcTo(cx - h, cy + h, cx - h, cy - h, rr);
  ctx.arcTo(cx - h, cy - h, cx + h, cy - h, rr);
  ctx.closePath();
}

export function drawTeacherBubble(ctx: Ctx, on: TeacherOnReel, tMs: number, cx: number, cy: number, d: number, frame: FrameKind = 'circle'): void {
  const A = on.avatar;
  const polaroid = frame === 'polaroid';
  if (polaroid) { d *= 0.86; cy -= d * 0.1; }
  const r = d / 2;
  const still = A.style === 'still';
  const m = still ? { level: mouthAt(on.track, tMs).level, open: 0, wide: 0, round: 0 } : mouthAt(on.track, tMs);
  if (polaroid) {
    // a white photo card, a little tilted, with the name written on its bottom strip
    ctx.save();
    ctx.translate(cx, cy + r * 0.2);
    ctx.rotate(-0.05);
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = d * 0.08;
    ctx.shadowOffsetY = d * 0.03;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-r * 1.14, -r * 1.34, r * 2.28, r * 2.86);
    ctx.restore();
  }
  ctx.save();
  if (polaroid) { ctx.translate(cx, cy + r * 0.2); ctx.rotate(-0.05); ctx.translate(-cx, -(cy + r * 0.2)); }
  // soft shadow so the bubble lifts off the board
  if (!polaroid) {
    framePath(ctx, frame, cx, cy + d * 0.025, r, 2);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fill();
  }
  framePath(ctx, frame, cx, cy, r);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.clip();

  if (on.frame) {
    // AI lip-sync frame (cover-fit square)
    const fw = Number((on.frame as { videoWidth?: number }).videoWidth || (on.frame as { width?: number }).width || d);
    const fh = Number((on.frame as { videoHeight?: number }).videoHeight || (on.frame as { height?: number }).height || d);
    const side = Math.min(fw, fh);
    try { ctx.drawImage(on.frame, (fw - side) / 2, (fh - side) / 2, side, side, cx - r, cy - r, d, d); } catch { drawPhoto(ctx, A, tMs, m, cx, cy, d, true); }
  } else {
    drawPhoto(ctx, A, tMs, m, cx, cy, d, still);
  }
  ctx.restore();

  if (polaroid) {
    // the name in "handwriting" on the card, and a thin glow line under the photo while speaking
    ctx.save();
    ctx.translate(cx, cy + r * 0.2); ctx.rotate(-0.05); ctx.translate(-cx, -(cy + r * 0.2));
    ctx.fillStyle = `rgba(18,164,179,${0.25 + 0.75 * m.level})`;
    ctx.fillRect(cx - r, cy + r + 2, d, Math.max(2, d * 0.025));
    if (A.name) {
      ctx.font = `700 ${Math.max(10, Math.round(d * 0.15))}px AIGuruHand, AIGuruHandMl, ${FONT.ui}`;
      ctx.fillStyle = '#2a2a2a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(A.name, cx, cy + r + d * 0.2, d * 1.05);
    }
    ctx.restore();
    return;
  }
  // rings: white, then teal that glows with the voice
  ctx.save();
  framePath(ctx, frame, cx, cy, r);
  ctx.lineWidth = Math.max(2, d * 0.045);
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  framePath(ctx, frame, cx, cy, r, ctx.lineWidth / 2 + 1.5);
  ctx.shadowColor = 'rgba(18,164,179,0.9)';
  ctx.shadowBlur = m.level * d * 0.14;
  ctx.lineWidth = 2.5 + m.level * d * 0.035;
  ctx.strokeStyle = '#12a4b3';
  ctx.stroke();
  ctx.restore();

  // name tag
  if (A.name) {
    const px = Math.max(10, Math.round(d * 0.12));
    ctx.save();
    ctx.font = `700 ${px}px ${FONT.ui}`;
    let name = A.name;
    while (name.length > 3 && ctx.measureText(name).width > d * 1.25) name = name.slice(0, -1);
    if (name !== A.name) name = `${name.trimEnd()}…`;
    const w = ctx.measureText(name).width + px * 1.2;
    const h = px * 1.55;
    const y = cy + r - h * 0.35;
    const rr = h / 2;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2 + rr, y);
    ctx.arcTo(cx + w / 2, y, cx + w / 2, y + h, rr);
    ctx.arcTo(cx + w / 2, y + h, cx - w / 2, y + h, rr);
    ctx.arcTo(cx - w / 2, y + h, cx - w / 2, y, rr);
    ctx.arcTo(cx - w / 2, y, cx + w / 2, y, rr);
    ctx.closePath();
    ctx.fillStyle = '#12a4b3';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, cx, y + h / 2 + 0.5);
    ctx.restore();
  }
}

function drawPhoto(ctx: Ctx, A: PreparedAvatar, tMs: number, m: { level: number; open: number; wide: number; round: number }, cx: number, cy: number, d: number, still: boolean) {
  // a little life: slow sway + a nod on loud syllables. Drawn 6 % larger so the moving picture never shows an edge.
  const sway = Math.sin(tMs / 1900 + A.seed) * 0.018 + Math.sin(tMs / 830 + A.seed * 0.3) * 0.006;
  const nod = m.level * d * 0.012;
  const S = d * 1.06;
  const x0 = cx - S / 2;
  const y0 = cy - S / 2 + d * 0.01;
  ctx.save();
  ctx.translate(cx, cy + d * 0.45);
  ctx.rotate(sway);
  ctx.translate(-cx, -(cy + d * 0.45) + nod);
  const src = A.size;
  const iw = Number((A.img as { naturalWidth?: number }).naturalWidth || (A.img as { width?: number }).width || src);
  const ih = Number((A.img as { naturalHeight?: number }).naturalHeight || (A.img as { height?: number }).height || src);
  const sx = (iw - src) / 2, sy = (ih - src) / 2;
  try { ctx.drawImage(A.img, sx, sy, src, src, x0, y0, S, S); } catch { /* the white circle stays */ }

  if (!still) {
    const M = A.marks.mouth;
    const mx = x0 + M.x * S, my = y0 + M.y * S, mw = M.w * S;
    const o = m.open;
    if (o > 0.02) {
      const jaw = o * mw * 0.34;
      const wf = 1 + m.wide * 0.12 - m.round * 0.25;
      const rx = mw * 0.42 * wf;
      const ry = jaw / 2 + mw * 0.03;
      const my2 = my + jaw / 2;
      // the inside of the mouth
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(mx, my2, rx, ry, 0, 0, Math.PI * 2);
      const g = ctx.createRadialGradient(mx, my2, 0, mx, my2, rx);
      g.addColorStop(0, '#2a0b0e');
      g.addColorStop(1, '#5b1f25');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.clip();
      if (o > 0.22) {
        ctx.globalAlpha = Math.min(0.85, (o - 0.22) * 2.6);
        ctx.fillStyle = '#ece6dd';
        ctx.fillRect(mx - rx, my2 - ry, rx * 2, ry * 0.55); // upper teeth
      }
      ctx.restore();
      // the lower jaw, moved down by `jaw`, through a soft mask
      const jw = mw * 2.3, jh = mw * 1.3;
      const jx = mx - jw / 2, jy = my - mw * 0.02;
      const scale = (typeof ctx.getTransform === 'function' ? Math.hypot(ctx.getTransform().a, ctx.getTransform().b) : 1) || 1;
      const pw = Math.ceil(jw * scale), ph = Math.ceil(jh * scale);
      if (!jawCanvas || jawCanvas.width !== pw || jawCanvas.height !== ph) jawCanvas = makeCanvas(pw, ph);
      const jc = jawCanvas?.getContext('2d');
      if (jawCanvas && jc) {
        jc.setTransform(1, 0, 0, 1, 0, 0);
        jc.globalCompositeOperation = 'source-over';
        jc.clearRect(0, 0, pw, ph);
        const k = src / S; // picture pixels per design unit
        try { jc.drawImage(A.img, sx + (jx - x0) * k, sy + (jy - y0) * k, jw * k, jh * k, 0, 0, pw, ph); } catch { /* skip */ }
        jc.globalCompositeOperation = 'destination-in';
        jc.save();
        jc.translate(pw / 2, 0);
        jc.scale(pw / 2, ph);
        // opaque under the lips, fading out towards the cheeks and the chin (the corners of the mouth stay the photo's own)
        const mg = jc.createRadialGradient(0, 0, 0, 0, 0, 1);
        mg.addColorStop(0, 'rgba(0,0,0,1)');
        mg.addColorStop(0.36, 'rgba(0,0,0,1)');
        mg.addColorStop(1, 'rgba(0,0,0,0)');
        jc.fillStyle = mg;
        jc.fillRect(-1, 0, 2, 1);
        jc.restore();
        ctx.drawImage(jawCanvas, 0, 0, pw, ph, jx, jy + jaw, jw, jh);
      }
      // a soft shadow under the upper lip so the opening reads at small sizes
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(mx, my, rx * 1.02, Math.max(0.6, mw * 0.025), 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(40,10,12,0.35)';
      ctx.fill();
      ctx.restore();
    }
    // blinking
    const eyes = A.marks.eyes;
    const b = eyes ? blinkAt(tMs, A.seed) : 0;
    if (eyes && b > 0.05) {
      const ew = mw * 0.62;
      for (const e of eyes) {
        const ex = x0 + e.x * S, ey = y0 + e.y * S;
        const eh = ew * 0.3;
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(ex, ey, ew / 2, eh, 0, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = A.skin;
        ctx.fillRect(ex - ew / 2, ey - eh, ew, 2 * eh * b);
        ctx.fillStyle = 'rgba(60,30,25,0.55)';
        ctx.fillRect(ex - ew / 2, ey - eh + 2 * eh * b - Math.max(0.6, eh * 0.12), ew, Math.max(0.6, eh * 0.12));
        ctx.restore();
      }
    }
  }
  ctx.restore();
}
