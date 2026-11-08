/**
 * AI Guru Motion Engine.
 *
 * A scene is a set of items (digits, symbols, lines, boxes). Every visual property
 * of every item is a TRACK: a list of timed segments. The whole video is a pure
 * function of time — `evalItem(item, t)` — so preview, scrubbing and frame-by-frame
 * MP4 export are always identical.
 *
 * Recipes (addition, division, derivations…) only talk to the engine through the
 * grammar verbs (appear, focus, move, swap, merge, hop, strike, dim, box, tick),
 * which is what keeps every branch of maths at the same visual quality.
 */

import { DUR, ROLE, roleColor, type Role } from './grammar';
import { tokenWidth } from './metrics';
import { speakable } from './speech';
import type { Lang } from './captions';
import { curves, staggerOffsets } from './curves';

/* ---------------- easing ---------------- */

export type Ease = (p: number) => number;
export const ease = {
  linear: (p: number) => p,
  inOut: (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
  out: (p: number) => 1 - Math.pow(1 - p, 3),
  back: (p: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
  },
  /** By teaching action (V51.9.50): land, glide, leave, soft blend. See curves.ts. */
  land: curves.softLand,
  glide: curves.glide,
  exit: curves.accelExit,
  soft: curves.softInOut,
};

/**
 * A counter's values: one per frame, big steps first and smaller ones as it nears the end, never going
 * back, and landing exactly on `to` (V51.9.52, the frame-stepped counter idea from motion-core-lite).
 * Whole numbers stay whole; with a span at least as long as the frame count every frame shows a new value.
 */
export function countSteps(from: number, to: number, frames: number): number[] {
  const N = Math.max(1, Math.round(frames));
  const span = to - from;
  const sg = Math.sign(span) || 1;
  const w: number[] = [];
  let tot = 0;
  for (let i = 0; i < N; i++) {
    const x = Math.pow(1 - i / N, 1.6) + 0.12;
    w.push(x);
    tot += x;
  }
  const vals = [from];
  let acc = 0;
  for (let i = 0; i < N; i++) {
    acc += w[i];
    let v = Math.round(from + (span * acc) / tot);
    if (Math.abs(span) >= N) {
      const lo = vals[i] + sg;
      const hi = to - sg * (N - 1 - i);
      v = sg > 0 ? Math.min(Math.max(v, lo), hi) : Math.max(Math.min(v, lo), hi);
    } else v = sg > 0 ? Math.max(v, vals[i]) : Math.min(v, vals[i]);
    vals.push(v);
  }
  vals[N] = to;
  return vals;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/* ---------------- tracks ---------------- */

interface Seg<T> {
  t0: number;
  t1: number;
  from: T;
  to: T;
  ease: Ease;
}

export class Track<T> {
  segs: Seg<T>[] = [];
  constructor(
    public init: T,
    private lerp: (a: T, b: T, p: number) => T,
  ) {}

  at(t: number): T {
    let v = this.init;
    for (const s of this.segs) {
      if (t < s.t0) break;
      if (t >= s.t1) {
        v = s.to;
        continue;
      }
      const span = s.t1 - s.t0;
      const p = span <= 0 ? 1 : s.ease(clamp01((t - s.t0) / span));
      return this.lerp(s.from, s.to, p);
    }
    return v;
  }

  /** Animate to `to` from whatever the value is at t0. */
  to(t0: number, dur: number, to: T, e: Ease = ease.inOut): void {
    const from = this.at(t0);
    // Later segments that would start inside this one are dropped (newest wins).
    this.segs = this.segs.filter((s) => s.t0 < t0);
    for (const s of this.segs) {
      if (s.t1 > t0) {
        s.t1 = t0;
        s.to = from;
      }
    }
    this.segs.push({ t0, t1: t0 + Math.max(0, dur), from, to, ease: e });
  }

  set(t: number, v: T): void {
    this.to(t, 0, v, ease.linear);
  }

  lastChange(): number {
    return this.segs.length ? this.segs[this.segs.length - 1].t1 : 0;
  }
}

const lerpNum = (a: number, b: number, p: number) => a + (b - a) * p;

function hexToRgb(h: string): [number, number, number] {
  const s = h.replace('#', '');
  const v = s.length === 3 ? s.split('').map((c) => c + c).join('') : s;
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}
export function mixColor(a: string, b: string, p: number): string {
  if (p <= 0) return a;
  if (p >= 1) return b;
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  const c = x.map((v, i) => Math.round(v + (y[i] - v) * p));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

const numTrack = (v: number) => new Track<number>(v, lerpNum);
const colorTrack = (v: string) => new Track<string>(v, mixColor);

/* ---------------- items ---------------- */

export type ItemKind = 'text' | 'line' | 'rect' | 'tick' | 'arrow' | 'poly' | 'dot' | 'vec' | 'region';

/**
 * Venn regions (V51.9.26). `circles` are the sets, `rect` the universe. A region is named by its
 * membership code: bit i set = inside circle i, so code 0 = outside every circle (inside the
 * universe), and for two sets 3 = A ∩ B, 1 = only A, 2 = only B. `codes` lists the regions filled.
 */
export interface RegionSpec {
  rect: [number, number, number, number];
  circles: Array<[number, number, number]>;
  codes: number[];
}

/** A timed change of a polygon's vertices (same vertex count): grids shear, shapes reflect, curves bend. */
export interface PointMorph {
  t0: number;
  t1: number;
  from: Array<[number, number]>;
  to: Array<[number, number]>;
  ease: Ease;
}

export interface TextSwap {
  t: number;
  dur: number;
  from: string;
  to: string;
}

export interface Lift {
  t0: number;
  t1: number;
  h: number;
}

export interface Item {
  id: string;
  kind: ItemKind;
  /** Font size (px in the 720-wide design space) for text, stroke width for lines. */
  size: number;
  weight: string;
  z: number;
  /** Text at build start; later values come from `swaps`. */
  text: string;
  swaps: TextSwap[];
  lifts: Lift[];
  x: Track<number>;
  y: Track<number>;
  /** Line end / rect size. */
  x2: Track<number>;
  y2: Track<number>;
  alpha: Track<number>;
  scale: Track<number>;
  /** Pen progress 0..1 (write / strike / rule / box / tick). */
  draw: Track<number>;
  halo: Track<number>;
  dim: Track<number>;
  /** Rotation of a text item about its centre, radians (V51.9.27: labels along slanted segments). */
  rot: Track<number>;
  color: Track<string>;
  /** Polygon / polyline vertices (absolute design coordinates). */
  points?: Array<[number, number]>;
  /** Timed vertex changes (see `Motion.morph`). */
  morphs?: PointMorph[];
  closed?: boolean;
  dashed?: boolean;
  /** Clip rectangle [x, y, w, h] in design px (the plane keeps grid lines inside its box). */
  clip?: [number, number, number, number];
  region?: RegionSpec;
  /** Background items (grids) do not count when the horizontal view is fitted to the content. */
  noExtent?: boolean;
  /** Fill colour and opacity (polygons, dots). */
  fill: Track<string>;
  fillAlpha: Track<number>;
}

export interface ItemState {
  id: string;
  kind: ItemKind;
  size: number;
  weight: string;
  x: number;
  y: number;
  x2: number;
  y2: number;
  alpha: number;
  scale: number;
  draw: number;
  halo: number;
  rot: number;
  color: string;
  text: string;
  /** During a swap: the outgoing text and progress. */
  swap?: { from: string; to: string; p: number };
  points?: Array<[number, number]>;
  closed?: boolean;
  dashed?: boolean;
  fill: string;
  fillAlpha: number;
  clip?: [number, number, number, number];
  region?: RegionSpec;
}

export function textAt(item: Item, t: number): { text: string; swap?: ItemState['swap'] } {
  let text = item.text;
  for (const s of item.swaps) {
    if (t < s.t) break;
    if (t < s.t + s.dur) return { text: s.to, swap: { from: s.from, to: s.to, p: (t - s.t) / s.dur } };
    text = s.to;
  }
  return { text };
}

/** Vertices of a polygon at time t, following its morphs. */
export function pointsAt(item: Item, t: number): Array<[number, number]> | undefined {
  let pts = item.points;
  if (!item.morphs?.length || !pts) return pts;
  for (const m of item.morphs) {
    if (t < m.t0) break;
    if (t >= m.t1) {
      pts = m.to;
      continue;
    }
    const span = m.t1 - m.t0;
    const p = span <= 0 ? 1 : m.ease(clamp01((t - m.t0) / span));
    return m.from.map((a, i) => [a[0] + (m.to[i][0] - a[0]) * p, a[1] + (m.to[i][1] - a[1]) * p] as [number, number]);
  }
  return pts;
}

export function evalItem(item: Item, t: number): ItemState {
  let lift = 0;
  for (const l of item.lifts) {
    if (t > l.t0 && t < l.t1) lift += l.h * Math.sin(Math.PI * ((t - l.t0) / (l.t1 - l.t0)));
  }
  const dim = item.dim.at(t);
  const { text, swap } = textAt(item, t);
  return {
    id: item.id,
    kind: item.kind,
    size: item.size,
    weight: item.weight,
    x: item.x.at(t),
    y: item.y.at(t) - lift,
    x2: item.x2.at(t),
    y2: item.y2.at(t),
    alpha: clamp01(item.alpha.at(t)),
    scale: item.scale.at(t),
    draw: clamp01(item.draw.at(t)),
    halo: clamp01(item.halo.at(t)),
    rot: item.rot.at(t),
    color: mixColor(item.color.at(t), ROLE.done, dim),
    text,
    swap,
    points: pointsAt(item, t),
    clip: item.clip,
    region: item.region,
    closed: item.closed,
    dashed: item.dashed,
    fill: mixColor(item.fill.at(t), ROLE.done, dim * 0.6),
    fillAlpha: clamp01(item.fillAlpha.at(t)),
  };
}

/* ---------------- captions & sound ---------------- */

export interface Caption {
  t0: number;
  t1: number;
  step: number;
  /** On-screen caption. */
  text: string;
  /** What the voice says for this step (maths read as words). */
  say?: string;
  /** Voice clip start and length, when the reel has a voice-over. */
  voiceT0?: number;
  voiceMs?: number;
  /** Optional second caption line (the other language). */
  sub?: string;
  /**
   * V51.9.136 — the SHORT side caption: just what to do in this step ("÷ 2 both sides", "(1) × 3"). The main caption
   * (`text`, spoken) says why and how. The problem board's step notes show this instead of the whole main caption.
   */
  note?: string;
  /** V51.9.136: the board itself already writes `note` beside the line, so the step notes leave this step out. */
  boardNote?: boolean;
}

/**
 * Voice-over plan for a build. Steps wait for their voice clip to finish, so the
 * explanation is never cut off and the motion of the next step starts after it.
 */
export interface VoicePlan {
  lang: Lang;
  /** Spoken text → clip length in ms (undefined = no clip for this step). */
  clipMs: (spoken: string) => number | undefined;
  /** Caption appears this long before the voice starts. */
  leadMs?: number;
  /** Silence after a clip before the next step begins. */
  gapMs?: number;
}

let activeVoice: VoicePlan | null = null;

/**
 * V51.9.136 — the speed controller: extra time (ms) given to a finished step before the next step starts, so the
 * student can read the board and think. 0 = the app's own pace. It is baked into the timeline (the MP4 has it too).
 */
export const STEP_PAUSE_MAX = 10000;
let activePause = 0;
const clampPause = (ms: number) => (Number.isFinite(ms) ? Math.max(0, Math.min(STEP_PAUSE_MAX, Math.round(ms))) : 0);
export function withStepPause<T>(ms: number, fn: () => T): T {
  const prev = activePause;
  activePause = clampPause(ms);
  try {
    return fn();
  } finally {
    activePause = prev;
  }
}
export const currentStepPause = () => activePause;

/** Build scenes with a voice plan (used by buildReel; synchronous and re-entrant). */
export function withVoice<T>(plan: VoicePlan | null, fn: () => T): T {
  const prev = activeVoice;
  activeVoice = plan;
  try {
    return fn();
  } finally {
    activeVoice = prev;
  }
}

/**
 * V51.9.120: words of the captions changed by the student in the Reel Studio (original caption → new words). Applied
 * while a scene is built, before its voice is timed, so the new words get their own voice length. The maths written
 * on the board never changes.
 */
let activeWords: ReadonlyMap<string, string> | null = null;
export function withWords<T>(words: ReadonlyMap<string, string> | null, fn: () => T): T {
  const prev = activeWords;
  activeWords = words && words.size ? words : null;
  try { return fn(); } finally { activeWords = prev; }
}

export type SfxKind = 'pop' | 'scribble' | 'swoosh' | 'whoosh' | 'hop' | 'tick' | 'ding';
export interface SfxEvent {
  t: number;
  kind: SfxKind;
  dur?: number;
  pitch?: number;
}

/** Optional full-frame 3D layer (see layer3d.ts); the 2D items below are its fallback. */
export interface MotionScene {
  layer3d?: import('./layer3d').Layer3d;
  /** V51.9.124: an explainer shot — the whole frame is drawn by explainer/draw.ts. */
  explainer?: import('../explainer/build').XSceneRef;
  title: string;
  /** Design space is 720 wide; height is chosen by the recipe. */
  width: number;
  height: number;
  items: Item[];
  captions: Caption[];
  sfx: SfxEvent[];
  durationMs: number;
  /** Camera: centre y and visible height of the design space (pans / zooms the board). */
  camY: Track<number>;
  camH: Track<number>;
  /**
   * Deep zoom (set when `look` was given an x): the camera also centres on design x and the board
   * scales by height/camH without the 1.6 cap, so one entry of a matrix can fill the screen.
   */
  camX?: Track<number>;
  /** Parts with the same group share one step count (multi-part reels); a new group restarts at 1. */
  group?: string;
  /** Word shown in the step pill instead of the default ("READ", "വായന"…). */
  pill?: string;
  /** The problem being solved: drawn in a card at the top of every frame in place of the one-line title. */
  problem?: string;
  /** The small label on that card ("PROBLEM", "പ്രശ്നം"). */
  problemLabel?: string;
  /** Horizontal extent actually used by the content (lets tall formats zoom in). */
  viewX: number;
  viewW: number;
}

/* ---------------- builder (the grammar verbs) ---------------- */

export interface TextOpts {
  size?: number;
  color?: Role | string;
  weight?: string;
  z?: number;
}

type Ids = string | string[];
/** A uniform stagger (ms) or a list of gaps (ms) that gets tighter as the row goes on. */
export type Stagger = number | readonly number[];
const onsets = (n: number, stagger: Stagger): number[] => (typeof stagger === 'number' ? Array.from({ length: n }, (_, i) => i * stagger) : staggerOffsets(n, stagger));
const list = (ids: Ids) => (Array.isArray(ids) ? ids : [ids]);

/** The longest the finished picture rests after its last movement (ms). */
export const END_HOLD_MAX = 1200;

/** Every stretch of time in which something on the board moves: [startMs, endMs] of each track segment, swap, lift, morph and camera move. */
export function motionIntervals(items: Iterable<Item>, cams: Array<Track<number> | null | undefined> = []): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const tracks = (it: Item) => [it.x, it.y, it.x2, it.y2, it.alpha, it.scale, it.draw, it.halo, it.dim, it.rot, it.color, it.fill, it.fillAlpha] as Array<Track<unknown>>;
  for (const it of items) {
    for (const tr of tracks(it)) for (const g of tr.segs) if (g.t1 > g.t0) out.push([g.t0, g.t1]);
    for (const w of it.swaps) out.push([w.t, w.t + w.dur]);
    for (const l of it.lifts) out.push([l.t0, l.t1]);
    for (const mo of it.morphs ?? []) out.push([mo.t0, mo.t1]);
  }
  for (const tr of cams) if (tr) for (const g of tr.segs) if (g.t1 > g.t0) out.push([g.t0, g.t1]);
  return out;
}

/** When the last thing on the board stops moving (ms). */
export function motionEnd(m: { items: Map<string, Item>; camY: Track<number>; camH: Track<number>; camX: Track<number> | null }): number {
  return motionIntervals(m.items.values(), [m.camY, m.camH, m.camX]).reduce((e, [, t1]) => Math.max(e, t1), 0);
}

export class Motion {
  readonly items = new Map<string, Item>();
  readonly captions: Caption[] = [];
  readonly sfx: SfxEvent[] = [];
  private end = 0;
  private stepNo = 0;
  private seq = 0;
  readonly camY: Track<number>;
  readonly camH: Track<number>;
  camX: Track<number> | null = null;
  readonly voice: VoicePlan | null = activeVoice;
  /** V51.9.136: the speed controller's wait before every step after the first. */
  readonly pauseMs: number = activePause;
  private voiceFree = 0;
  /** End of the last step's own time (its caption minimum or its voice clip), before any hold. */
  private stepEnd = 0;
  private view: { x: number; w: number } | null = null;

  constructor(
    public title: string,
    public width = 720,
    public height = 560,
  ) {
    this.camY = numTrack(height / 2);
    this.camH = numTrack(height);
  }

  /** Camera: glide so design y `y` is centred and `h` design px are visible. */
  look(t: number, y: number, h: number = this.camH.at(t), dur = 700, x?: number): number {
    if (x !== undefined) {
      if (!this.camX) this.camX = numTrack(this.view ? this.view.x : this.width / 2);
      this.camX.to(t, dur, x, ease.inOut);
    } else if (this.camX) {
      this.camX.to(t, dur, this.view ? this.view.x : this.width / 2, ease.inOut);
    }
    const half = Math.min(h, this.height) / 2;
    const cy = Math.max(half, Math.min(this.height - half, y));
    this.camY.to(t, dur, cy, ease.inOut);
    this.camH.to(t, dur, h, ease.inOut);
    this.touch(t + dur);
    return t + dur;
  }

  /* ----- bookkeeping ----- */

  private touch(t: number) {
    if (t > this.end) this.end = t;
  }
  get time(): number {
    return this.end;
  }
  /** V51.9.113: the ring drawn around a focused token (faded by unfocus). */
  private ringOf = new Map<string, string>();
  /** Turn rings off (a recipe that wants only the soft glow). */
  rings = true;

  /**
   * Draws a hand-drawn ring around each group of the given text items (neighbours on one row share a ring, e.g. "+ 5"
   * or "25 − 5"). Returns the items that got a ring. Rings do not count for fitting the view, and fade by themselves
   * after a while if no unfocus comes.
   */
  private ringsAround(ids: string[], t: number): Set<string> {
    const done = new Set<string>();
    if (!this.rings) return done;
    const boxes = ids
      .filter((id) => this.has(id) && this.get(id).kind === 'text' && this.get(id).alpha.at(t) > 0.2)
      .map((id) => {
        const it = this.get(id);
        const { x, y } = this.pos(id, t);
        const w = tokenWidth(textAt(it, t).text, it.size, it.weight) * it.scale.at(t);
        const txt = textAt(it, t).text;
        return { id, x0: x - w / 2, x1: x + w / 2, y, size: it.size, color: it.color.at(t), sign: !/[0-9a-zA-Zα-ωπθ\u0D00-\u0D7F]/.test(txt) };
      })
      .sort((a, b) => a.y - b.y || a.x0 - b.x0);
    const groups: Array<typeof boxes> = [];
    for (const b of boxes) {
      const g = groups.find((gr) => Math.abs(gr[0].y - b.y) < b.size * 0.5 && gr.some((o) => b.x0 - o.x1 < b.size * 0.9 && o.x0 - b.x1 < b.size * 0.9));
      if (g) g.push(b); else groups.push([b]);
    }
    for (const g of groups) {
      const x0 = Math.min(...g.map((b) => b.x0)), x1 = Math.max(...g.map((b) => b.x1));
      const y = g.reduce((a, b) => a + b.y, 0) / g.length, size = Math.max(...g.map((b) => b.size));
      const rx = (x1 - x0) / 2 + size * 0.3, ry = size * 0.62;
      const cx = (x0 + x1) / 2;
      // a slightly wobbly pen stroke that overlaps where it started, like a ring drawn by hand
      let seed = 0;
      for (const ch of g.map((b) => b.id).join('|')) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
      const wob = (k: number) => { const v = Math.sin(seed * 0.001 + k * 2.3) * 0.5 + Math.sin(seed * 0.0007 + k * 5.1) * 0.5; return 1 + v * 0.035; };
      const pts: Array<[number, number]> = [];
      const a0 = Math.PI * 1.15, sweep = Math.PI * 2 + 0.45, n = 44;
      for (let k = 0; k <= n; k++) {
        const a = a0 + (sweep * k) / n, grow = 1 + (k / n) * 0.06;
        pts.push([cx + Math.cos(a) * rx * wob(k) * grow, y + Math.sin(a) * ry * wob(k + 7) * grow]);
      }
      const ring = this.uid('ring');
      // the ring takes the colour of the group's first number or letter ("+ 5" is ringed in 5's colour)
      this.poly(ring, pts, t, { color: (g.find((b) => !b.sign) ?? g[0]).color, width: Math.max(2.5, size * 0.055), closed: false, dur: Math.round(DUR.focus * 0.85), silent: true, background: true, z: 5 });
      this.get(ring).alpha.to(t + 3200, 400, 0, ease.out); // fades by itself if no unfocus comes
      for (const b of g) { this.ringOf.set(b.id, ring); done.add(b.id); }
    }
    return done;
  }

  uid(prefix = 'i'): string {
    return `${prefix}${++this.seq}`;
  }
  has(id: string): boolean {
    return this.items.has(id);
  }
  get(id: string): Item {
    const it = this.items.get(id);
    if (!it) throw new Error(`motion: unknown item "${id}"`);
    return it;
  }
  sound(t: number, kind: SfxKind, o: { dur?: number; pitch?: number } = {}): void {
    this.sfx.push({ t, kind, ...o });
  }
  /** Keep the scene alive until t (pauses, holds). */
  until(t: number): void {
    this.touch(t);
  }

  private make(id: string, kind: ItemKind, text: string, x: number, y: number, o: TextOpts): Item {
    if (this.items.has(id)) throw new Error(`motion: duplicate id "${id}"`);
    const it: Item = {
      id,
      kind,
      size: o.size ?? 56,
      weight: o.weight ?? '400',
      z: o.z ?? 1,
      text,
      swaps: [],
      lifts: [],
      x: numTrack(x),
      y: numTrack(y),
      x2: numTrack(x),
      y2: numTrack(y),
      alpha: numTrack(0),
      scale: numTrack(1),
      draw: numTrack(1),
      halo: numTrack(0),
      dim: numTrack(0),
      rot: numTrack(0),
      color: colorTrack(roleColor(o.color ?? 'ink')),
      fill: colorTrack('#ffffff'),
      fillAlpha: numTrack(0),
    };
    this.items.set(id, it);
    return it;
  }

  /** Rotate a text item about its centre to `rad` (radians): at once (dur 0) or turning over `dur` ms. */
  turn(id: string, rad: number, t = 0, dur = 0): number {
    const it = this.get(id);
    if (dur <= 0) it.rot.set(t, rad);
    else it.rot.to(t, dur, rad, ease.inOut);
    this.touch(t + dur);
    return t + dur;
  }

  /** Create a text item (hidden until a verb shows it). */
  text(id: string, text: string, x: number, y: number, o: TextOpts = {}): string {
    this.make(id, 'text', text, x, y, o);
    return id;
  }

  /* ----- captions ----- */

  /**
   * Start a numbered step with a caption; returns the step's start time.
   * With a voice-over, a step never starts before the previous clip has finished,
   * and it lasts at least as long as its own clip.
   */
  step(text: string, t: number, minMs: number = DUR.captionMin, say?: string, o: { note?: string; boardNote?: boolean } = {}): number {
    const edited = activeWords?.get(text);
    if (edited !== undefined && edited.trim()) { text = edited; say = undefined; }
    // V51.9.136: with the speed controller on, the finished step (its picture, its caption, its voice) stays for the chosen time
    const start = Math.max(t, this.voiceFree) + (this.stepNo > 0 ? this.pauseMs : 0);
    const last = this.captions[this.captions.length - 1];
    if (last) last.t1 = Math.max(last.t0 + 400, start);
    const c: Caption = { t0: start, t1: start + minMs, step: ++this.stepNo, text };
    if (o.note?.trim()) c.note = o.note.trim();
    if (o.boardNote) c.boardNote = true;
    const plan = this.voice;
    if (plan) {
      c.say = say ?? speakable(text, plan.lang);
      const ms = c.say ? plan.clipMs(c.say) : undefined;
      if (ms && ms > 0) {
        c.voiceT0 = start + (plan.leadMs ?? 200);
        c.voiceMs = ms;
        this.voiceFree = c.voiceT0 + ms + (plan.gapMs ?? 300);
        c.t1 = Math.max(c.t1, this.voiceFree);
      }
    }
    this.captions.push(c);
    this.stepEnd = c.t1;
    this.touch(c.t1);
    return start;
  }
  /** Extend the current caption so it covers motion up to t. */
  hold(t: number): void {
    const last = this.captions[this.captions.length - 1];
    if (last && last.t1 < t) last.t1 = t;
    this.touch(t);
  }

  /* ----- verbs ----- */

  appear(ids: Ids, t: number, stagger: Stagger = 0, sound = true): number {
    let end = t;
    const offs = onsets(list(ids).length, stagger);
    list(ids).forEach((id, i) => {
      const it = this.get(id);
      const at = t + offs[i];
      it.alpha.to(at, DUR.appear * 0.5, 1, ease.soft);
      it.scale.set(at, 0.4);
      it.scale.to(at, DUR.appear, 1, ease.back);
      if (sound) this.sound(at, 'pop', { pitch: 1 + (i % 4) * 0.12 });
      end = at + DUR.appear;
    });
    this.touch(end);
    return end;
  }

  /** Pen-reveal text left → right (or draw a line / box). */
  write(ids: Ids, t: number, stagger: Stagger = 0, dur: number = DUR.write): number {
    let end = t;
    const offs = onsets(list(ids).length, stagger);
    list(ids).forEach((id, i) => {
      const it = this.get(id);
      const at = t + offs[i];
      it.alpha.set(at, 1);
      it.draw.set(at, 0);
      it.draw.to(at, dur, 1, ease.land);
      end = at + dur;
    });
    if (list(ids).length) this.sound(t, 'scribble', { dur: end - t });
    this.touch(end);
    return end;
  }

  fadeOut(ids: Ids, t: number, dur = 300): number {
    for (const id of list(ids)) this.get(id).alpha.to(t, dur, 0, ease.exit);
    this.touch(t + dur);
    return t + dur;
  }

  focus(ids: Ids, t: number, pulse = true): number {
    // V51.9.113: like a teacher circling with chalk — a hand-drawn ring around each group of focused tokens, in their
    // colour; the ring stays while the change happens and fades on unfocus. (Shapes keep the soft glow.)
    const ringed = this.ringsAround(list(ids), t);
    for (const id of list(ids)) {
      const it = this.get(id);
      if (!ringed.has(id)) it.halo.to(t, DUR.focus * 0.6, 1, ease.out);
      it.dim.to(t, DUR.focus * 0.6, 0, ease.out);
      if (pulse) {
        const base = it.scale.at(t);
        it.scale.to(t, DUR.focus / 2, base * 1.15, ease.out);
        it.scale.to(t + DUR.focus / 2, DUR.focus / 2, base, ease.inOut);
      }
    }
    this.sound(t, 'tick', { pitch: 1.2 });
    this.touch(t + DUR.focus);
    return t + DUR.focus;
  }

  unfocus(ids: Ids, t: number): number {
    for (const id of list(ids)) {
      this.get(id).halo.to(t, 300, 0, ease.out);
      const ring = this.ringOf.get(id);
      if (ring && this.has(ring)) this.get(ring).alpha.to(t, 300, 0, ease.out);
    }
    this.touch(t + 300);
    return t + 300;
  }

  recolor(ids: Ids, color: Role | string, t: number, dur: number = DUR.recolor): number {
    for (const id of list(ids)) {
      const it = this.get(id);
      it.color.to(t, dur, roleColor(color), ease.soft);
      it.dim.to(t, dur, 0, ease.soft);
    }
    this.touch(t + dur);
    return t + dur;
  }

  dim(ids: Ids, t: number, dur: number = DUR.dim): number {
    for (const id of list(ids)) {
      const it = this.get(id);
      it.dim.to(t, dur, 1, ease.soft);
      it.halo.to(t, dur, 0);
    }
    this.touch(t + dur);
    return t + dur;
  }

  undim(ids: Ids, t: number, dur: number = DUR.dim): number {
    for (const id of list(ids)) this.get(id).dim.to(t, dur, 0, ease.soft);
    this.touch(t + dur);
    return t + dur;
  }

  /** Glide to (x, y); `arc` lifts the path (px) like a thrown chalk digit. */
  move(ids: Ids, x: number, y: number, t: number, o: { dur?: number; arc?: number; sound?: boolean } = {}): number {
    const dur = o.dur ?? DUR.move;
    for (const id of list(ids)) {
      const it = this.get(id);
      it.x.to(t, dur, x, ease.glide);
      it.y.to(t, dur, y, ease.glide);
      if (o.arc) it.lifts.push({ t0: t, t1: t + dur, h: o.arc });
    }
    if (o.sound !== false) this.sound(t, 'swoosh', { dur });
    this.touch(t + dur);
    return t + dur;
  }

  /** Grow / shrink (e.g. a carry shrinks as it hops into the carry row). */
  resize(ids: Ids, scale: number, t: number, dur: number = DUR.hop): number {
    for (const id of list(ids)) this.get(id).scale.to(t, dur, scale, ease.glide);
    this.touch(t + dur);
    return t + dur;
  }

  /** Small digit jump (carry / borrow). */
  hop(id: string, x: number, y: number, t: number, height = 60): number {
    const end = this.move(id, x, y, t, { dur: DUR.hop, arc: height, sound: false });
    this.sound(t, 'hop');
    return end;
  }

  /** Digit transformation: the value rolls into a new value in place. */
  swap(id: string, to: string, t: number, color?: Role | string): number {
    const it = this.get(id);
    const from = textAt(it, t).text;
    it.swaps.push({ t, dur: DUR.swap, from, to });
    it.swaps.sort((a, b) => a.t - b.t);
    if (color) this.recolor(id, color, t);
    this.sound(t, 'whoosh', { dur: DUR.swap, pitch: 1.4 });
    this.touch(t + DUR.swap);
    return t + DUR.swap;
  }

  /**
   * V51.9.52 — a number ticks from `from` to `to`, one value per frame (big steps first, then smaller),
   * never eased between values and landing exactly on `to`. The item shows `from` until t (so a number that
   * is being written appears as `from` and counts up). The final text is exactly `fmt(to)`.
   */
  count(id: string, from: number, to: number, t: number, o: { dur?: number; fps?: number; fmt?: (n: number) => string } = {}): number {
    const it = this.get(id);
    const dur = Math.max(1, o.dur ?? 700);
    const fps = o.fps ?? 30;
    const fmt = o.fmt ?? ((n: number) => String(n));
    const frames = Math.max(1, Math.min(Math.abs(to - from) || 1, Math.round((dur / 1000) * fps)));
    const vals = countSteps(from, to, frames);
    // The count owns the item's text up to the moment it lands; later swaps are kept.
    // Shown as `from` from the start of the scene until the count begins.
    it.swaps = it.swaps.filter((s) => s.t > t + dur);
    it.swaps.push({ t: 0, dur: 0, from: it.text, to: fmt(from) });
    for (let k = 1; k < vals.length; k++) {
      it.swaps.push({ t: t + (k * dur) / frames, dur: 0, from: fmt(vals[k - 1]), to: fmt(vals[k]) });
    }
    it.swaps.sort((a, b) => a.t - b.t);
    this.sound(t, 'tick', { dur });
    this.touch(t + dur);
    return t + dur;
  }

  /** Copy an item as it looks at time t (a "chalk copy" that can fly elsewhere). */
  clone(srcId: string, newId: string, t: number, o: { color?: Role | string } = {}): string {
    const src = this.get(srcId);
    const st = evalItem(src, t);
    const it = this.make(newId, src.kind, st.text, st.x, st.y, {
      size: src.size,
      weight: src.weight,
      z: src.z + 1,
      color: o.color ?? st.color,
    });
    it.alpha.set(t, 1);
    return newId;
  }

  /**
   * Several pieces fly to (x, y) and vanish; `into` (already created, hidden) pops out.
   * This is how "7 + 5" visibly BECOMES "12".
   */
  merge(ids: Ids, into: Ids, x: number, y: number, t: number, dur: number = DUR.merge): number {
    for (const id of list(ids)) {
      const it = this.get(id);
      it.x.to(t, dur, x, ease.inOut);
      it.y.to(t, dur, y, ease.inOut);
      it.scale.to(t + dur * 0.6, dur * 0.4, it.scale.at(t) * 0.5, ease.inOut);
      it.alpha.to(t + dur * 0.6, dur * 0.4, 0, ease.linear);
    }
    this.sound(t, 'swoosh', { dur });
    const end = this.appear(into, t + dur * 0.75, 0, false);
    this.sound(t + dur * 0.75, 'pop', { pitch: 1.6 });
    this.touch(end);
    return end;
  }

  /** Pen line through an item (value about to change). */
  strike(targetId: string, t: number, color: Role | string = 'accent'): string {
    const tg = this.get(targetId);
    const st = evalItem(tg, t);
    const w = tokenWidth(st.text, tg.size) / 2 + 4;
    const h = tg.size * 0.32;
    const id = this.uid('strike');
    const it = this.make(id, 'line', '', st.x - w, st.y + h, { size: 3, color, z: tg.z + 1 });
    it.x2.set(0, st.x + w);
    it.y2.set(0, st.y - h);
    it.alpha.set(t, 1);
    it.draw.set(t, 0);
    it.draw.to(t, DUR.strike, 1, ease.out);
    this.sound(t, 'scribble', { dur: DUR.strike });
    this.touch(t + DUR.strike);
    return id;
  }

  /** Horizontal / any straight rule drawn by pen. */
  rule(id: string, x0: number, y0: number, x1: number, y1: number, t: number, o: { color?: Role | string; width?: number } = {}): number {
    const it = this.make(id, 'line', '', x0, y0, { size: o.width ?? 3, color: o.color ?? 'ink' });
    it.x2.set(0, x1);
    it.y2.set(0, y1);
    it.alpha.set(t, 1);
    it.draw.set(t, 0);
    it.draw.to(t, DUR.write, 1, ease.out);
    this.sound(t, 'scribble', { dur: DUR.write });
    this.touch(t + DUR.write);
    return t + DUR.write;
  }

  /** Pen-drawn rounded box; cx, cy = centre. */
  box(id: string, cx: number, cy: number, w: number, h: number, t: number, color: Role | string = 'accent'): number {
    const it = this.make(id, 'rect', '', cx, cy, { size: 3.5, color });
    it.x2.set(0, w);
    it.y2.set(0, h);
    it.alpha.set(t, 1);
    it.draw.set(t, 0);
    it.draw.to(t, DUR.box, 1, ease.inOut);
    this.sound(t, 'scribble', { dur: DUR.box });
    this.touch(t + DUR.box);
    return t + DUR.box;
  }

  tick(id: string, x: number, y: number, t: number, size = 34): number {
    const it = this.make(id, 'tick', '', x, y, { size, color: 'tick' });
    it.alpha.set(t, 1);
    it.draw.set(t, 0);
    it.draw.to(t, DUR.tick, 1, ease.out);
    this.sound(t + DUR.tick * 0.6, 'ding');
    this.touch(t + DUR.tick);
    return t + DUR.tick;
  }

  /**
   * Polygon or polyline drawn by pen (outline first, then the fill fades in).
   * Used by geometry figures, area models and number lines.
   */
  poly(
    id: string,
    points: Array<[number, number]>,
    t: number,
    o: { color?: Role | string; fill?: Role | string; fillAlpha?: number; width?: number; closed?: boolean; dashed?: boolean; dur?: number; z?: number; silent?: boolean; background?: boolean; clip?: [number, number, number, number] } = {},
  ): number {
    const cx = points.reduce((a, p) => a + p[0], 0) / points.length;
    const cy = points.reduce((a, p) => a + p[1], 0) / points.length;
    const it = this.make(id, 'poly', '', cx, cy, { size: o.width ?? 3, color: o.color ?? 'ink', z: o.z ?? 0 });
    it.points = points;
    it.closed = o.closed ?? true;
    it.dashed = o.dashed;
    if (o.background) it.noExtent = true;
    if (o.clip) it.clip = o.clip;
    const dur = o.dur ?? DUR.write;
    it.alpha.set(t, 1);
    it.draw.set(t, 0);
    it.draw.to(t, dur, 1, ease.inOut);
    if (o.fill) {
      it.fill.set(0, roleColor(o.fill));
      it.fillAlpha.to(t + dur * 0.7, 350, o.fillAlpha ?? 0.35, ease.out);
    }
    if (!o.silent) this.sound(t, 'scribble', { dur });
    this.touch(t + dur + 350);
    return t + dur;
  }

  /**
   * Fills Venn regions (see RegionSpec) with a colour that fades in. The region sits behind the
   * circle outlines (z 0) and does not count for fitting the view.
   */
  region(
    id: string,
    spec: RegionSpec,
    t: number,
    o: { color?: Role | string; alpha?: number; dur?: number; z?: number } = {},
  ): number {
    const it = this.make(id, 'region', '', spec.rect[0], spec.rect[1], { size: 1, color: o.color ?? 'ink', z: o.z ?? 0 });
    it.region = spec;
    it.noExtent = true;
    it.fill.set(0, roleColor(o.color ?? 'c'));
    it.alpha.set(t, 1);
    const dur = o.dur ?? 700;
    it.fillAlpha.set(0, 0);
    it.fillAlpha.to(t, dur, o.alpha ?? 0.6, ease.out);
    this.touch(t + dur);
    return t + dur;
  }

  /** Change a shape's fill (colour change of a region). */
  fillTo(ids: Ids, color: Role | string, t: number, alpha = 0.45, dur: number = DUR.recolor): number {
    for (const id of list(ids)) {
      const it = this.get(id);
      it.fill.to(t, dur, roleColor(color));
      it.fillAlpha.to(t, dur, alpha);
    }
    this.touch(t + dur);
    return t + dur;
  }

  /** A filled point. */
  dot(id: string, x: number, y: number, t: number, o: { color?: Role | string; r?: number } = {}): number {
    const it = this.make(id, 'dot', '', x, y, { size: o.r ?? 6, color: o.color ?? 'ink', z: 3 });
    it.fill.set(0, roleColor(o.color ?? 'ink'));
    it.fillAlpha.set(0, 1);
    return this.appear(id, t, 0, false);
  }

  /** Curved arrow from (x0,y0) to (x1,y1) — used for "bring down" and links. */
  arrow(id: string, x0: number, y0: number, x1: number, y1: number, t: number, color: Role | string = 'carry'): number {
    const it = this.make(id, 'arrow', '', x0, y0, { size: 2.5, color });
    it.x2.set(0, x1);
    it.y2.set(0, y1);
    it.alpha.set(t, 1);
    it.draw.set(t, 0);
    it.draw.to(t, DUR.write, 1, ease.out);
    this.touch(t + DUR.write);
    return t + DUR.write;
  }

  /**
   * Morph a polygon's vertices to `to` (same vertex count). Used to shear a grid, reflect a shape
   * or bend a curve; every vertex travels in a straight line, exactly like a matrix interpolation.
   */
  morph(id: string, to: Array<[number, number]>, t: number, o: { dur?: number; e?: Ease } = {}): number {
    const it = this.get(id);
    if (!it.points) throw new Error(`motion: "${id}" is not a polygon`);
    const dur = o.dur ?? 1400;
    const from = pointsAt(it, t) ?? it.points;
    if (from.length !== to.length) throw new Error(`motion: morph of "${id}" needs ${from.length} vertices, got ${to.length}`);
    it.morphs = (it.morphs ?? []).filter((m) => m.t0 < t);
    for (const m of it.morphs) if (m.t1 > t) { m.t1 = t; m.to = from; }
    it.morphs.push({ t0: t, t1: t + dur, from, to, ease: o.e ?? ease.glide });
    this.touch(t + dur);
    return t + dur;
  }

  /** Straight arrow (vector) from (x0,y0) to (x1,y1) with a head, drawn by pen. */
  vector(id: string, x0: number, y0: number, x1: number, y1: number, t: number, o: { color?: Role | string; width?: number; dur?: number; z?: number } = {}): number {
    const it = this.make(id, 'vec', '', x0, y0, { size: o.width ?? 4, color: o.color ?? 'ink', z: o.z ?? 2 });
    it.x2.set(0, x1);
    it.y2.set(0, y1);
    it.alpha.set(t, 1);
    it.draw.set(t, 0);
    const dur = o.dur ?? 700;
    it.draw.to(t, dur, 1, ease.out);
    this.sound(t, 'scribble', { dur });
    this.touch(t + dur);
    return t + dur;
  }

  /** Move both ends of a vector (its tail goes to (x0,y0), its tip to (x1,y1)). */
  moveVector(id: string, x0: number, y0: number, x1: number, y1: number, t: number, dur = 1400): number {
    const it = this.get(id);
    it.x.to(t, dur, x0, ease.inOut);
    it.y.to(t, dur, y0, ease.inOut);
    it.x2.to(t, dur, x1, ease.inOut);
    it.y2.to(t, dur, y1, ease.inOut);
    this.touch(t + dur);
    return t + dur;
  }

  /** Mark an item as background (ignored when the view is fitted to the content). */
  background(ids: Ids): void {
    for (const id of list(ids)) this.get(id).noExtent = true;
  }

  /** Fix the horizontal view (centre x, width) instead of fitting it to the content. */
  fixView(x: number, w: number): void {
    this.view = { x, w };
  }

  /** Current (x, y) of an item at time t. */
  pos(id: string, t: number): { x: number; y: number } {
    const s = evalItem(this.get(id), t);
    return { x: s.x, y: s.y };
  }

  build(tailMs = 1600): MotionScene {
    // The picture may rest after its last movement, but not for long (V51.9.50): never past END_HOLD_MAX
    // after the last motion, and never cutting the last caption's own time or its voice clip.
    const full = Math.max(this.end, this.voiceFree) + tailMs;
    const durationMs = Math.ceil(Math.max(this.voiceFree, this.stepEnd, Math.min(full, motionEnd(this) + END_HOLD_MAX)));
    const last = this.captions[this.captions.length - 1];
    if (last) last.t1 = durationMs;
    const items = [...this.items.values()].sort((a, b) => a.z - b.z);
    let x0 = Infinity;
    let x1 = -Infinity;
    for (const it of items) {
      if (it.noExtent) continue;
      const xs = [it.x.init, ...it.x.segs.map((g) => g.to)];
      let half = 0;
      if (it.points) for (const p of it.points) xs.push(p[0]);
      if (it.morphs) for (const m of it.morphs) for (const p of m.to) xs.push(p[0]);
      if (it.kind === 'text') {
        half = Math.max(...[it.text, ...it.swaps.map((w) => w.to)].map((tx) => tokenWidth(tx, it.size, it.weight))) / 2;
      } else if (it.kind === 'rect') half = it.x2.at(1e9) / 2;
      else if (it.kind === 'line' || it.kind === 'arrow' || it.kind === 'vec') xs.push(it.x2.at(1e9));
      else half = it.size / 2;
      for (const x of xs) {
        x0 = Math.min(x0, x - half);
        x1 = Math.max(x1, x + half);
      }
    }
    if (!Number.isFinite(x0)) {
      x0 = 0;
      x1 = this.width;
    }
    const viewX = this.view ? this.view.x : (x0 + x1) / 2;
    const viewW = this.view ? this.view.w : Math.min(this.width, Math.max(this.width * 0.5, x1 - x0 + 90));
    return {
      title: this.title,
      width: this.width,
      height: this.height,
      items,
      captions: this.captions,
      sfx: [...this.sfx].sort((a, b) => a.t - b.t),
      durationMs,
      camY: this.camY,
      camH: this.camH,
      camX: this.camX ?? undefined,
      viewX,
      viewW,
    };
  }
}

export function sceneStateAt(scene: MotionScene, t: number): ItemState[] {
  return scene.items.map((it) => evalItem(it, t)).filter((s) => s.alpha > 0.001);
}

export function captionAt(scene: MotionScene, t: number): Caption | undefined {
  return scene.captions.find((c) => t >= c.t0 && t < c.t1);
}
