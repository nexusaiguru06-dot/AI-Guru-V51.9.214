/** Shared pieces of the concept board's layouts (V51.9.52). */

import { Motion } from '../../reels/motion/engine';
import { DUR, type Role } from '../../reels/motion/grammar';
import { tokenWidth } from '../../reels/motion/metrics';
import type { Lang } from '../../reels/motion/captions';
import type { Bi } from './types';
import { ICONS, type IconName, type Stroke } from './concept-icons';

export const pick = (b: Bi | undefined, lang: Lang): string => (b ? (lang === 'ml' ? b.ml || b.en : b.en) : '');
export const ROLES: Role[] = ['a', 'b', 'c'];
export type Pt = [number, number];

export function circle(cx: number, cy: number, r: number, n = 20): Pt[] {
  return Array.from({ length: n }, (_, i) => [cx + r * Math.cos((i / n) * Math.PI * 2), cy + r * Math.sin((i / n) * Math.PI * 2)] as Pt);
}

export function frame(title: string, H: number): Motion {
  const m = new Motion(title, 720, H);
  m.camH.set(0, H);
  m.camY.set(0, H / 2);
  return m;
}

export function heading(m: Motion, text: string, t: number): number {
  const size = tokenWidth(text, 34) > 640 ? 26 : 34;
  m.text('hd', text, 360, 38, { size, color: 'ink' });
  const w = Math.min(640, tokenWidth(text, size) + 40);
  const e = m.write(['hd'], t, 0, 500);
  m.rule('hdr', 360 - w / 2, 66, 360 + w / 2, 66, t + 300, { color: 'accent', width: 3 });
  return Math.max(e, t + 300 + DUR.write) + 150;
}

/** Draws an icon (a few pen strokes) centred at (cx, cy), `size` px wide. Returns the ids and when it is finished. */
export function drawIcon(m: Motion, id: string, name: IconName, cx: number, cy: number, size: number, role: Role, t: number): { ids: string[]; end: number } {
  const k = size / 100;
  const ids: string[] = [];
  let end = t;
  (ICONS[name] as Stroke[]).forEach((st, i) => {
    const pid = `${id}_i${i}`;
    const pts = st.pts.map(([x, y]) => [cx + (x - 50) * k, cy + (y - 50) * k] as Pt);
    end = Math.max(end, m.poly(pid, pts, t + i * 120, { color: role, fill: st.fill ? role : undefined, fillAlpha: 0.28, closed: st.closed, width: 3, dur: 450, z: 2, silent: true }));
    ids.push(pid);
  });
  return { ids, end };
}
