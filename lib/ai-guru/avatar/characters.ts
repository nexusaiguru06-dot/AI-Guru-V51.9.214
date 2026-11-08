/**
 * V51.9.103 — ready-made AI Guru characters for the avatar bubble: illustrated people who are NOBODY real, so anyone
 * can use one without a photo, consent questions, copyright or personality-rights worries.
 *
 * Each character is drawn in code (no image files, nothing downloaded) with the mouth and eyes always in the same
 * place, so the lip-sync and blinking marks are exact. Each suggests a voice: a free classroom (Edge) voice for
 * teachers' reels, and a Gemini voice for students (spoken with the student's own key).
 *
 * Pure description + a drawing function that works with any 2D canvas (browser or @napi-rs/canvas in tests).
 */

import type { FaceMarks } from '../teacher/avatar';

export interface Character {
  id: string;
  name: string;
  nameMl: string;
  /** Who it suits (both may use any). */
  for: 'teacher' | 'student';
  skin: string;
  hair: 'long' | 'short' | 'bun' | 'curly' | 'plaits' | 'side';
  hairColor: string;
  shirt: string;
  bg: string;
  glasses?: boolean;
  bindi?: boolean;
  moustache?: boolean;
  /** Free classroom voices (Edge) for a teacher's reels. */
  edge: { en: string; ml: string };
  /** Gemini voice for a student's reels (the student's own key). */
  gemini: string;
}

export const CHARACTERS: readonly Character[] = [
  { id: 'asha', name: 'Asha Teacher', nameMl: 'ആശ ടീച്ചർ', for: 'teacher', skin: '#c98f6a', hair: 'bun', hairColor: '#231a16', shirt: '#7b2d5b', bg: '#cfe8df', bindi: true, glasses: true, edge: { en: 'en-IN-NeerjaNeural', ml: 'ml-IN-SobhanaNeural' }, gemini: 'Kore' },
  { id: 'ravi', name: 'Ravi Sir', nameMl: 'രവി സർ', for: 'teacher', skin: '#b07a55', hair: 'side', hairColor: '#1d1714', shirt: '#2f5d8a', bg: '#f3e2bf', moustache: true, edge: { en: 'en-IN-PrabhatNeural', ml: 'ml-IN-MidhunNeural' }, gemini: 'Charon' },
  { id: 'fathima', name: 'Fathima Teacher', nameMl: 'ഫാത്തിമ ടീച്ചർ', for: 'teacher', skin: '#d6a07c', hair: 'long', hairColor: '#2a1d18', shirt: '#1f7a6a', bg: '#f6d6d2', glasses: false, edge: { en: 'en-IN-NeerjaNeural', ml: 'ml-IN-SobhanaNeural' }, gemini: 'Aoede' },
  { id: 'meenu', name: 'Meenu', nameMl: 'മീനു', for: 'student', skin: '#c4875f', hair: 'plaits', hairColor: '#1f1714', shirt: '#e8a020', bg: '#d8e7fb', edge: { en: 'en-IN-NeerjaNeural', ml: 'ml-IN-SobhanaNeural' }, gemini: 'Leda' },
  { id: 'arjun', name: 'Arjun', nameMl: 'അർജുൻ', for: 'student', skin: '#a8714c', hair: 'short', hairColor: '#17120f', shirt: '#d84a3a', bg: '#e6f4cf', edge: { en: 'en-IN-PrabhatNeural', ml: 'ml-IN-MidhunNeural' }, gemini: 'Puck' },
  { id: 'joel', name: 'Joel', nameMl: 'ജോയൽ', for: 'student', skin: '#d9a982', hair: 'curly', hairColor: '#3a2618', shirt: '#4a4fbf', bg: '#fbe7c6', glasses: true, edge: { en: 'en-IN-PrabhatNeural', ml: 'ml-IN-MidhunNeural' }, gemini: 'Fenrir' },
];

export const characterById = (id: string | null | undefined) => CHARACTERS.find((c) => c.id === id) ?? null;

/** Where the mouth and eyes are on every character (the drawing below puts them exactly here). */
export const CHARACTER_MARKS: FaceMarks = { mouth: { x: 0.5, y: 0.7, w: 0.15 }, eyes: [{ x: 0.4, y: 0.47 }, { x: 0.6, y: 0.47 }] };

type Ctx = CanvasRenderingContext2D;

const shade = (hex: string, k: number) => {
  const h = hex.replace('#', '');
  const c = [0, 2, 4].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(h.slice(i, i + 2), 16) * k))));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};

/** Draws a character into a size × size square. */
export function drawCharacter(ctx: Ctx, ch: Character, size = 512): void {
  const s = size / 512;
  ctx.save();
  ctx.scale(s, s);
  ctx.fillStyle = ch.bg;
  ctx.fillRect(0, 0, 512, 512);
  // soft circle behind the head
  ctx.fillStyle = shade(ch.bg, 0.93);
  ctx.beginPath(); ctx.arc(256, 250, 210, 0, Math.PI * 2); ctx.fill();
  const hairC = ch.hairColor;
  // hair behind the head (long, plaits)
  ctx.fillStyle = hairC;
  if (ch.hair === 'long') { ctx.beginPath(); ctx.roundRect(140, 120, 232, 330, 110); ctx.fill(); }
  if (ch.hair === 'plaits') {
    for (const x of [150, 362]) { ctx.beginPath(); ctx.ellipse(x, 360, 26, 90, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#e84a6a'; ctx.beginPath(); ctx.arc(x, 445, 12, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = hairC; }
  }
  if (ch.hair === 'bun') { ctx.beginPath(); ctx.arc(256, 92, 48, 0, Math.PI * 2); ctx.fill(); }
  // shirt and neck
  ctx.fillStyle = ch.shirt;
  ctx.beginPath(); ctx.moveTo(70, 512); ctx.quadraticCurveTo(90, 420, 200, 405); ctx.lineTo(312, 405); ctx.quadraticCurveTo(422, 420, 442, 512); ctx.closePath(); ctx.fill();
  ctx.fillStyle = shade(ch.skin, 0.88);
  ctx.beginPath(); ctx.roundRect(214, 330, 84, 92, 30); ctx.fill();
  ctx.fillStyle = shade(ch.shirt, 0.8);
  ctx.beginPath(); ctx.moveTo(214, 408); ctx.lineTo(256, 450); ctx.lineTo(298, 408); ctx.lineTo(286, 404); ctx.lineTo(256, 434); ctx.lineTo(226, 404); ctx.closePath(); ctx.fill();
  // ears and face
  ctx.fillStyle = shade(ch.skin, 0.95);
  for (const x of [156, 356]) { ctx.beginPath(); ctx.ellipse(x, 250, 18, 30, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = ch.skin;
  ctx.beginPath(); ctx.ellipse(256, 250, 102, 128, 0, 0, Math.PI * 2); ctx.fill();
  // hair on top
  ctx.fillStyle = hairC;
  ctx.beginPath();
  if (ch.hair === 'short' || ch.hair === 'side') {
    ctx.moveTo(152, 236); ctx.quadraticCurveTo(150, 116, 256, 108); ctx.quadraticCurveTo(366, 112, 360, 236);
    ctx.quadraticCurveTo(350, 168, ch.hair === 'side' ? 300 : 256, 160); ctx.quadraticCurveTo(200, 166, 152, 236);
  } else if (ch.hair === 'curly') {
    for (let i = 0; i < 11; i++) { const a = Math.PI + (i / 10) * Math.PI; ctx.moveTo(256 + Math.cos(a) * 104 + 26, 214 + Math.sin(a) * 96); ctx.arc(256 + Math.cos(a) * 104, 214 + Math.sin(a) * 96, 26, 0, Math.PI * 2); }
  } else {
    ctx.moveTo(150, 250); ctx.quadraticCurveTo(140, 118, 256, 112); ctx.quadraticCurveTo(372, 118, 362, 250);
    ctx.quadraticCurveTo(340, 160, 256, 168); ctx.quadraticCurveTo(172, 160, 150, 250);
  }
  ctx.fill();
  // brows
  ctx.strokeStyle = shade(hairC, 1.2); ctx.lineWidth = 7; ctx.lineCap = 'round';
  for (const [x0, x1] of [[178, 228], [284, 334]]) { ctx.beginPath(); ctx.moveTo(x0, 214); ctx.quadraticCurveTo((x0 + x1) / 2, 204, x1, 214); ctx.stroke(); }
  // eyes (centres at 0.40 / 0.60 × 512, y 0.47 × 512)
  for (const x of [204.8, 307.2]) {
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(x, 240.6, 22, 14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a2416'; ctx.beginPath(); ctx.arc(x, 241, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x + 3.5, 237.5, 3.2, 0, Math.PI * 2); ctx.fill();
  }
  if (ch.glasses) {
    ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = 5;
    for (const x of [204.8, 307.2]) { ctx.beginPath(); ctx.roundRect(x - 34, 220, 68, 44, 14); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(239, 236); ctx.lineTo(273, 236); ctx.stroke();
  }
  if (ch.bindi) { ctx.fillStyle = '#b8142e'; ctx.beginPath(); ctx.arc(256, 206, 6, 0, Math.PI * 2); ctx.fill(); }
  // nose
  ctx.strokeStyle = shade(ch.skin, 0.75); ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(256, 250); ctx.quadraticCurveTo(250, 290, 244, 300); ctx.quadraticCurveTo(256, 308, 268, 300); ctx.stroke();
  // cheeks
  ctx.fillStyle = 'rgba(230,110,110,0.22)';
  for (const x of [190, 322]) { ctx.beginPath(); ctx.ellipse(x, 300, 24, 14, 0, 0, Math.PI * 2); ctx.fill(); }
  if (ch.moustache) { ctx.fillStyle = hairC; ctx.beginPath(); ctx.ellipse(256, 334, 34, 9, 0, 0, Math.PI * 2); ctx.fill(); }
  // closed smiling lips at the mouth mark (0.5, 0.70) × 512, width 0.15 × 512
  ctx.fillStyle = shade(ch.skin, 0.62);
  ctx.beginPath(); ctx.ellipse(256, 358.4, 38, 11, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = shade(ch.skin, 0.45); ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(220, 357); ctx.quadraticCurveTo(256, 366, 292, 357); ctx.stroke();
  ctx.restore();
}

/** The character as a 512 × 512 PNG data URL (browser only). Cached. */
const cache = new Map<string, string>();
export function characterPhoto(id: string): string | null {
  const ch = characterById(id);
  if (!ch || typeof document === 'undefined') return null;
  const hit = cache.get(id);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  drawCharacter(ctx, ch);
  const url = c.toDataURL('image/png');
  cache.set(id, url);
  return url;
}
