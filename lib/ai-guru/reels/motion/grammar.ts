/**
 * AI Guru Motion Grammar — the ONE visual vocabulary every maths video uses.
 *
 * Every branch (arithmetic, algebra, fractions, geometry, calculus, statistics…)
 * is animated with the same roles, colours, timings and verbs, so a reel about
 * long division looks and feels exactly like a reel about the Pythagoras theorem.
 *
 *  ROLE COLOURS (what a colour MEANS, never decoration)
 *   a        first operand / the thing we start from ........ red
 *   b        second operand / the thing acting on it ........ purple
 *   c        third operand / constants moved across ......... green
 *   carry    carries, borrows, small helper digits .......... orange
 *   result   new value produced by this step ................ deep indigo
 *   done     finished work (kept on screen, pushed back) .... muted lavender
 *   ink      neutral symbols (=, +, brackets, rules) ........ indigo
 *   accent   boxes / ticks around the final answer .......... red
 *
 *  VERBS (each one is a fixed, timed motion)
 *   appear   pop in (scale 0.4 → 1.0 with a little overshoot) ........ 350 ms
 *   write    reveal left → right, like a pen ......................... 450 ms
 *   focus    soft yellow halo + 1.0 → 1.15 → 1.0 pulse ............... 500 ms
 *   recolor  smooth colour change into a role colour ................. 350 ms
 *   move     glide along an arc to a new place ....................... 650 ms
 *   swap     digit transformation: old value rolls up and out,
 *            new value rolls up and in (e.g. 4 → 3 when borrowing) .... 420 ms
 *   merge    several pieces fly together, the result pops out ........ 700 ms
 *   hop      a small digit jumps in a high arc (carry / borrow) ...... 550 ms
 *   strike   pen line through a value that changes .................. 300 ms
 *   dim      finished work fades to the "done" colour ................ 400 ms
 *   box      pen-drawn rounded box around the answer ................. 600 ms
 *   tick     green check mark + ding ................................. 450 ms
 *
 *  RULES OF FOCUS
 *   1. Only what is being worked on is coloured. Everything finished is "done".
 *   2. Before something changes it is focused first (the eye goes there).
 *   3. Values never jump: they move, merge or swap — the viewer sees WHERE a
 *      number came from and WHAT it turned into.
 *   4. One caption per step, step number in the pill, synced to the motion.
 */

export const ROLE = {
  a: '#d22d2d',
  b: '#9d3bc8',
  c: '#13a018',
  carry: '#f08a00',
  result: '#150b55',
  done: '#b4b1d1',
  ink: '#150b55',
  accent: '#c0262d',
  halo: '#ffe76a',
  tick: '#17a34a',
  paper: '#ffffff',
} as const;

export type Role = keyof typeof ROLE;

export const DUR = {
  appear: 350,
  write: 450,
  focus: 500,
  recolor: 350,
  move: 650,
  swap: 420,
  merge: 700,
  hop: 550,
  strike: 300,
  dim: 400,
  box: 600,
  tick: 450,
  /** Gap between two beats inside one step. */
  beat: 250,
  /** Minimum time a caption stays on screen. */
  captionMin: 1800,
} as const;

/** The board's default maths font (V51.9.106: a reel may use another for a while: see `withBoardFont`). */
export const MATH_FONT_DEFAULT = 'AIGuruSerif, "Noto Serif", AIGuruMalayalam, "Noto Sans Malayalam", "DejaVu Serif", Georgia, serif';

export const FONT: { math: string; readonly ui: string } = {
  /** Serif for numbers & maths, like a teacher's neat board. */
  math: MATH_FONT_DEFAULT,
  /** Captions; Malayalam glyphs fall through to the Malayalam face. */
  ui: 'AIGuruSerif, "Noto Serif", AIGuruMalayalam, "Noto Sans Malayalam", "DejaVu Serif", serif',
};

/** Map a role name or literal colour to a colour string. */
export function roleColor(c: Role | string): string {
  return (ROLE as Record<string, string>)[c] ?? c;
}
