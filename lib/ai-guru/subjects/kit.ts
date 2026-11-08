/**
 * Shared drawing kit for the subject agents: small helpers over the Motion engine (arrows, labels, rows,
 * rings). Nothing here knows any subject; agents compose it. Not used by the maths engine.
 */

import { Motion } from '../reels/motion/engine';
import type { Role } from '../reels/motion/grammar';
import type { Lang } from '../reels/motion/captions';
import type { Bi } from '../motion-class/dna/types';
export type { Bi };

export type Pt = [number, number];
export const W = 720;

export const pick = (b: Bi | undefined, lang: Lang): string => (b ? (lang === 'ml' ? b.ml || b.en : b.en) : '');

/** A scene 720 wide and `h` tall, viewed whole. */
export function newScene(title: string, h: number): Motion {
  const m = new Motion(title, W, h);
  m.camH.set(0, h);
  m.camY.set(0, h / 2);
  m.fixView(W / 2, W);
  return m;
}

let seq = 0;
export const uid = (p = 'k') => `${p}${seq++}`;

export function label(m: Motion, text: string, x: number, y: number, t: number, o: { size?: number; color?: Role | string; weight?: string; z?: number } = {}): string {
  const id = uid('tx');
  m.text(id, text, x, y, { size: o.size ?? 28, color: o.color ?? 'ink', z: o.z ?? 5, weight: o.weight });
  m.appear([id], t, 0, false);
  return id;
}

/** A straight arrow (shaft + head) from a to b, drawn by pen. Returns the two ids. */
export function vec(m: Motion, a: Pt, b: Pt, t: number, color: Role | string, width = 5): string[] {
  const id = uid('vc');
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const L = Math.hypot(dx, dy) || 1;
  const ux = dx / L;
  const uy = dy / L;
  const hl = Math.min(24, L * 0.45);
  const hw = hl * 0.55;
  const bx = b[0] - ux * hl;
  const by = b[1] - uy * hl;
  m.poly(`${id}s`, [a, [bx, by]], t, { color, closed: false, width, dur: 450, z: 3, silent: true });
  m.poly(`${id}h`, [b, [bx - uy * hw, by + ux * hw], [bx + uy * hw, by - ux * hw]], t + 300, { color, fill: color, fillAlpha: 1, closed: true, width: 2, dur: 250, z: 3, silent: true });
  return [`${id}s`, `${id}h`];
}

export function rect(m: Motion, x: number, y: number, w: number, h: number, t: number, color: Role | string, o: { fill?: Role | string; alpha?: number; width?: number; dashed?: boolean; z?: number } = {}): string {
  const id = uid('rc');
  m.poly(id, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], t, { color, fill: o.fill ?? color, fillAlpha: o.alpha ?? 0.22, closed: true, width: o.width ?? 3, dur: 450, z: o.z ?? 2, dashed: o.dashed, silent: true });
  return id;
}

export function ellipse(cx: number, cy: number, rx: number, ry: number, n = 28): Pt[] {
  return Array.from({ length: n }, (_, i) => [cx + rx * Math.cos((i / n) * Math.PI * 2), cy + ry * Math.sin((i / n) * Math.PI * 2)] as Pt);
}

/** A thin ring round a point or a piece of text; returns its id (fade it out when done). */
export function ring(m: Motion, cx: number, cy: number, rx: number, ry: number, t: number, color: Role | string = 'accent'): string {
  const id = uid('rg');
  m.poly(id, ellipse(cx, cy, rx, ry), t, { color, closed: true, width: 3.4, dur: 450, z: 7, silent: true });
  return id;
}

export const ground = (m: Motion, y: number, t: number, x0 = 40, x1 = 680) => m.rule(uid('gr'), x0, y, x1, y, t, { color: 'ink', width: 4 });

/** Spark of dots round a point: a finished answer. */
export function sparkle(m: Motion, cx: number, cy: number, at: number) {
  const cols: Role[] = ['a', 'b', 'c', 'carry', 'tick'];
  for (let i = 0; i < 10; i++) {
    const id = uid('sp');
    const ang = (i / 10) * Math.PI * 2;
    m.dot(id, cx, cy, at, { color: cols[i % cols.length], r: 6 });
    m.move(id, cx + Math.cos(ang) * 70, cy + Math.sin(ang) * 55, at + 100, { dur: 700, sound: false });
    m.fadeOut(id, at + 600, 400);
  }
}

/** A number as written: whole numbers plain, others to at most 2 decimals. */
export const num = (v: number): string => (Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100));

/** Parse a model reply that should hold one JSON object (fenced or not). */
export function parseJson(text: string): unknown {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (m ? m[1] : text).trim();
  const a = body.indexOf('{');
  const b = body.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('no JSON object in the reply');
  return JSON.parse(body.slice(a, b + 1));
}

export const isBi = (x: unknown): x is Bi => !!x && typeof x === 'object' && typeof (x as Bi).en === 'string' && (x as Bi).en.trim().length > 0;
