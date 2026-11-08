/**
 * V51.9.101 — seasonal themes, switched on by the date: decorations behind the board (never over the maths), a
 * matching look, and a greeting the opener can use. Students can switch the season off for a reel.
 *
 * Date windows are approximate on purpose (festival dates move with the Malayalam calendar): each one covers the
 * days around the festival in most years. Change SEASONS to adjust them.
 */

import { hash01 } from './look-draw';

export type SeasonId = 'onam' | 'vishu' | 'christmas' | 'childrens-day' | 'exam' | 'monsoon';

export interface Season {
  id: SeasonId;
  name: string;
  nameMl: string;
  /** [month 1–12, day] inclusive, in India time. */
  from: [number, number];
  to: [number, number];
  /** The look that suits it (used when the reel's look was picked automatically). */
  look: string;
  greeting: { en: string; ml: string };
}

export const SEASONS: readonly Season[] = [
  { id: 'exam', name: 'Exam season', nameMl: 'പരീക്ഷാക്കാലം', from: [2, 15], to: [3, 31], look: 'notebook', greeting: { en: 'Exam special: quick revision!', ml: 'പരീക്ഷാ സ്പെഷ്യൽ: വേഗത്തിൽ റിവിഷൻ!' } },
  { id: 'vishu', name: 'Vishu', nameMl: 'വിഷു', from: [4, 10], to: [4, 16], look: 'kasavu', greeting: { en: 'Happy Vishu!', ml: 'വിഷു ആശംസകൾ!' } },
  { id: 'monsoon', name: 'Monsoon', nameMl: 'മഴക്കാലം', from: [6, 1], to: [7, 31], look: 'ocean', greeting: { en: 'Rainy day maths!', ml: 'മഴക്കാല ഗണിതം!' } },
  { id: 'onam', name: 'Onam', nameMl: 'ഓണം', from: [8, 15], to: [9, 15], look: 'kasavu', greeting: { en: 'Happy Onam!', ml: 'ഓണാശംസകൾ!' } },
  { id: 'childrens-day', name: "Children's Day", nameMl: 'ശിശുദിനം', from: [11, 10], to: [11, 16], look: 'sunrise', greeting: { en: "Happy Children's Day!", ml: 'ശിശുദിനാശംസകൾ!' } },
  { id: 'christmas', name: 'Christmas', nameMl: 'ക്രിസ്മസ്', from: [12, 15], to: [12, 31], look: 'night', greeting: { en: 'Merry Christmas!', ml: 'ക്രിസ്മസ് ആശംസകൾ!' } },
];

export const seasonById = (id: SeasonId | null | undefined) => SEASONS.find((s) => s.id === id) ?? null;

/** The season on this date (India time), or null. */
export function seasonFor(date: Date): SeasonId | null {
  const ist = new Date(date.getTime() + 5.5 * 3600_000);
  const md = (ist.getUTCMonth() + 1) * 100 + ist.getUTCDate();
  for (const s of SEASONS) if (md >= s.from[0] * 100 + s.from[1] && md <= s.to[0] * 100 + s.to[1]) return s.id;
  return null;
}

type Ctx = CanvasRenderingContext2D;
interface Frame { dw: number; dh: number; board: { x: number; y: number; w: number; h: number } }

function flower(ctx: Ctx, x: number, y: number, r: number, petals: number, color: string, centre: string) {
  ctx.fillStyle = color;
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.42, r * 0.22, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = centre;
  ctx.beginPath(); ctx.arc(x, y, r * 0.25, 0, Math.PI * 2); ctx.fill();
}

/** Decorations behind the board for a season, in design units. Kept to the board's left / top corners and its background. */
export function drawSeasonDecor(ctx: Ctx, id: SeasonId, F: Frame, t: number, dark: boolean): void {
  const B = F.board;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, B.y, F.dw, B.h);
  ctx.clip();
  const x0 = B.x + 64, y1 = B.y + B.h - 64;
  switch (id) {
    case 'onam': {
      // a pookalam (flower carpet): rings of petals, bottom-left
      ctx.globalAlpha = 0.85;
      const rings = ['#f7b500', '#ff7a00', '#d62828', '#ffffff', '#8e44ad', '#f7e04b'];
      rings.forEach((c, i) => {
        const r = 62 - i * 10;
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.arc(x0, y1, r, 0, Math.PI * 2); ctx.fill();
      });
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + t / 6000;
        ctx.fillStyle = i % 2 ? '#d62828' : '#ff7a00';
        ctx.beginPath(); ctx.arc(x0 + Math.cos(a) * 46, y1 + Math.sin(a) * 46, 5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 0.5;
      flower(ctx, B.x + 26, B.y + 26, 18, 8, '#ff7a00', '#f7e04b');
      break;
    }
    case 'vishu': {
      // konna (golden shower) clusters hanging from the top-left corner
      for (let k = 0; k < 4; k++) {
        const sx = B.x + 18 + k * 26;
        const len = 70 + hash01(k + 3) * 60;
        for (let j = 0; j < 9; j++) {
          const yy = B.y + 8 + (j / 9) * len;
          const sway = Math.sin(t / 900 + k) * 3 * (j / 9);
          ctx.fillStyle = j % 3 ? '#f6c600' : '#ffdd33';
          ctx.globalAlpha = 0.9;
          ctx.beginPath(); ctx.arc(sx + sway + (hash01(k * 9 + j) - 0.5) * 8, yy, 5 + (1 - j / 9) * 3, 0, Math.PI * 2); ctx.fill();
        }
      }
      break;
    }
    case 'christmas': {
      // a star top-left and gentle snow across the board background
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#ffd34d';
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 9 : 22;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        ctx.lineTo(B.x + 36 + Math.cos(a) * r, B.y + 36 + Math.sin(a) * r);
      }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = dark ? '#ffffff' : '#9fc5e8';
      for (let i = 0; i < 40; i++) {
        const x = (hash01(i * 2 + 1) * F.dw + Math.sin(t / 1500 + i) * 10) % F.dw;
        const y = B.y + ((hash01(i * 2 + 2) * B.h + t * (0.02 + hash01(i) * 0.03)) % B.h);
        ctx.globalAlpha = 0.35;
        ctx.beginPath(); ctx.arc(x, y, 2 + hash01(i + 9) * 2.5, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case 'childrens-day': {
      // three balloons rising slowly at the bottom-left
      const cols = ['#ff5d73', '#4cc9f0', '#ffd166'];
      cols.forEach((c, i) => {
        const bx = x0 - 30 + i * 32;
        const by = y1 - 10 - i * 18 + Math.sin(t / 700 + i) * 6;
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = dark ? '#cccccc' : '#777777';
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(bx, by + 22); ctx.quadraticCurveTo(bx + 6, by + 50, bx - 2, by + 80); ctx.stroke();
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.ellipse(bx, by, 16, 21, 0, 0, Math.PI * 2); ctx.fill();
      });
      break;
    }
    case 'exam': {
      // a corner ribbon top-left: "EXAM SPECIAL"
      ctx.globalAlpha = 0.95;
      ctx.translate(B.x, B.y);
      ctx.rotate(-Math.PI / 4);
      ctx.fillStyle = '#d0453c';
      ctx.fillRect(-90, 34, 180, 26);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 13px AIGuruSerif, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('EXAM SPECIAL', 0, 48);
      break;
    }
    case 'monsoon': {
      // rain across the board background and an umbrella bottom-left
      ctx.strokeStyle = dark ? '#a9c7f5' : '#7fa7d9';
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 46; i++) {
        const x = hash01(i * 3 + 1) * F.dw;
        const y = B.y + ((hash01(i * 3 + 2) * B.h + t * 0.35) % B.h);
        ctx.globalAlpha = 0.28;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 16); ctx.stroke();
      }
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#e63946';
      ctx.beginPath(); ctx.arc(x0, y1, 42, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = dark ? '#f2f2f6' : '#333333';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x0, y1); ctx.lineTo(x0, y1 + 40); ctx.arc(x0 - 8, y1 + 40, 8, 0, Math.PI); ctx.stroke();
      break;
    }
  }
  ctx.restore();
}
