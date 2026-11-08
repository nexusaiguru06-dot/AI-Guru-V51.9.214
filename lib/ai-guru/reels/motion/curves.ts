/**
 * Easing curves by teaching action (V51.9.50). The shapes follow the measured curves of "motionmaxxing" by
 * Tejas Makwana (https://github.com/Tejashmakwana/motionmaxxing, Apache-2.0; see NOTICE-motion-core.md),
 * rewritten here as small pure functions. Rule: things that LAND on the board decelerate, things that LEAVE
 * accelerate, colour and opacity blends are symmetric. Every curve maps 0 → 0 and 1 → 1, so end states do
 * not change, only how they are reached.
 */

export type Curve = (p: number) => number;

const powerOut = (k: number): Curve => (t) => 1 - Math.pow(1 - t, k);
const powerIn = (k: number): Curve => (t) => Math.pow(t, k);
const expoOut = (k: number): Curve => {
  const d = 1 - Math.exp(-k);
  return (t) => (1 - Math.exp(-k * t)) / d;
};
const smoothP = (k: number): Curve => (t) => {
  const a = Math.pow(t, k);
  const b = Math.pow(1 - t, k);
  return a / (a + b);
};
const guard = (f: Curve): Curve => (t) => (t <= 0 ? 0 : t >= 1 ? 1 : f(t));

export const curves = {
  /** Workhorse for things that land on the board: most of the travel happens at once, then it settles. */
  softLand: guard(expoOut(3.41)),
  /** Gentle landing for medium moves. */
  glide: guard(powerOut(1.7)),
  /** Symmetric S for opacity and colour blends. */
  softInOut: guard(smoothP(1.42)),
  /** Things leaving accelerate. */
  accelExit: guard(powerIn(2.6)),
  /** Mild acceleration. */
  gentleIn: guard(powerIn(2.07)),
};

export type Action = 'create' | 'move' | 'recolor' | 'erase' | 'highlight' | 'tween' | 'transform';
export const CURVE_FOR_ACTION: Record<Action, keyof typeof curves> = {
  create: 'softLand',
  move: 'glide',
  recolor: 'softInOut',
  erase: 'accelExit',
  highlight: 'softInOut',
  tween: 'glide',
  transform: 'softLand',
};
export const curveFor = (a: Action): Curve => curves[CURVE_FOR_ACTION[a]];

/**
 * Start offsets (ms) for n siblings with uneven gaps: the first gaps are wider, later ones tighter, and the
 * last gap repeats. Used instead of one uniform stagger so a row of terms arrives with a rhythm.
 */
export function staggerOffsets(n: number, gaps: readonly number[] = STAGGER_TEXT): number[] {
  const out: number[] = [];
  let at = 0;
  for (let i = 0; i < n; i++) {
    out.push(at);
    at += gaps[Math.min(i, gaps.length - 1)];
  }
  return out;
}
/** Gaps for a row of written symbols / tiles (ms): 3, 2, 2, 2 frames at 30 fps, then 2 frames each. */
export const STAGGER_TEXT: readonly number[] = [100, 66, 66, 66, 66];
