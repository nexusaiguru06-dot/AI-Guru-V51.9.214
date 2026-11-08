/**
 * V51.9.161 — camera presets: the camera moves of the "2x + 5 = 25" demo reel, on the app's own two boards
 * (🎬 Cinematic and Whiteboard). Higgsfield-style ideas, built from scratch.
 *
 * Every step of a lesson (one caption = one beat) gets one camera move. The move only changes the CAMERA
 * (zoom, where it looks, a small tilt, dimming the rest of the board) — it never moves, re-creates or
 * re-colours a diagram item, so the English and Malayalam passes still share the same drawing.
 *
 * Three ways of moving (`MovesMode`):
 *   off    — no camera presets (the board as before).
 *   calm   — for teaching (Motion Class): push-in, pull-out reveal, pan-follow, tilt-down steps, split focus, breathe.
 *   lively — for reels / MP4: also crash zoom, whip pan, dutch tilt and rack focus.
 * The flavour follows the board: the Cinematic board moves slower and smaller (no crash zoom, no whip pan);
 * the Whiteboard gets the full, punchy set.
 *
 * Pure (no DOM apart from the guarded localStorage helpers at the end): the tests use it.
 */

export type CameraPresetId =
  | 'push-in' | 'pull-out-reveal' | 'crash-zoom' | 'pan-follow' | 'tilt-down-steps' | 'rack-focus'
  | 'whip-pan' | 'dutch-tilt' | 'split-focus' | 'orbit-3d' | 'top-down-drop' | 'breathe';

export type BeatKind = 'question' | 'step' | 'result' | 'recap';
export type MovesMode = 'off' | 'calm' | 'lively';
export type MovesSetting = 'auto' | MovesMode;
export type Flavour = 'cinematic' | 'whiteboard';

export interface CameraPreset {
  id: CameraPresetId;
  name: string;
  nameMl: string;
  /** What it is for, shown in the pickers' tooltips. */
  about: string;
  /** Only for a three.js solid (the 2D board never picks it). */
  only3d?: boolean;
  /** Fast or showy: reels only, never while teaching. */
  lively?: boolean;
}

export const CAMERA_PRESETS: readonly CameraPreset[] = [
  { id: 'push-in', name: 'Push-in', nameMl: 'അടുത്തേക്ക്', about: 'Slow zoom towards the step being written' },
  { id: 'pull-out-reveal', name: 'Pull-out reveal', nameMl: 'പിന്നോട്ട്', about: 'Starts close on the new line, pulls back to show the whole working' },
  { id: 'crash-zoom', name: 'Crash zoom', nameMl: 'പെട്ടെന്ന് സൂം', about: 'A fast punch-in on the answer, with a tiny overshoot', lively: true },
  { id: 'pan-follow', name: 'Pan follow', nameMl: 'പേനയ്ക്കൊപ്പം', about: 'The camera follows the pen as it writes' },
  { id: 'tilt-down-steps', name: 'Tilt-down steps', nameMl: 'പടിപടിയായി താഴേക്ക്', about: 'Moves down the board one line at a time' },
  { id: 'rack-focus', name: 'Rack focus', nameMl: 'ശ്രദ്ധ', about: 'Everything except the new line fades back for a moment', lively: true },
  { id: 'whip-pan', name: 'Whip pan', nameMl: 'വേഗത്തിൽ നീക്കം', about: 'A fast sideways swipe into the step', lively: true },
  { id: 'dutch-tilt', name: 'Dutch tilt', nameMl: 'ചെരിവ്', about: 'A small tilt for the question — "wait, what?"', lively: true },
  { id: 'split-focus', name: 'Split focus', nameMl: 'ഇരുവശം', about: 'Looks left, then right — both sides of the equation' },
  { id: 'orbit-3d', name: 'Orbit (3D)', nameMl: 'ചുറ്റും (3D)', about: 'Circles a 3D solid', only3d: true },
  { id: 'top-down-drop', name: 'Top-down drop (3D)', nameMl: 'മുകളിൽ നിന്ന് (3D)', about: 'From the top view down to a 3/4 view', only3d: true },
  { id: 'breathe', name: 'Breathe', nameMl: 'ശ്വാസം', about: 'An almost invisible drift so a long hold never looks frozen' },
];
export const presetById = (id: string): CameraPreset | undefined => CAMERA_PRESETS.find((p) => p.id === id);

/** Which moves each kind of step may use, per mode and board flavour (the order is a soft preference). */
const MENU: Record<'calm' | `lively-${Flavour}`, Record<BeatKind, CameraPresetId[]>> = {
  calm: {
    question: ['push-in', 'breathe'],
    step: ['push-in', 'tilt-down-steps', 'pan-follow', 'split-focus'],
    result: ['push-in', 'pull-out-reveal'],
    recap: ['pull-out-reveal', 'breathe'],
  },
  'lively-cinematic': {
    question: ['push-in', 'dutch-tilt'],
    step: ['push-in', 'tilt-down-steps', 'pan-follow', 'rack-focus', 'split-focus'],
    result: ['pull-out-reveal', 'rack-focus', 'push-in'],
    recap: ['pull-out-reveal', 'breathe'],
  },
  'lively-whiteboard': {
    question: ['dutch-tilt', 'push-in'],
    step: ['push-in', 'tilt-down-steps', 'pan-follow', 'rack-focus', 'split-focus', 'whip-pan'],
    result: ['crash-zoom', 'pull-out-reveal'],
    recap: ['pull-out-reveal', 'breathe'],
  },
};

/** At most this many of each showy move in one lesson part. */
const LIMIT: Partial<Record<CameraPresetId, number>> = { 'crash-zoom': 2, 'whip-pan': 2, 'dutch-tilt': 1 };

/** What kind of step a caption is (from its place and its words; English and Malayalam). */
export function beatKindOf(text: string, index: number, count: number): BeatKind {
  const s = (text || '').toLowerCase();
  if (/\b(check|verify|recap|so we found)\b|പരിശോധ|ഒത്തുനോക്ക/.test(s)) return 'recap';
  if (/\b(answer|therefore|so,|hence|=\s*-?\d+\s*$)|ഉത്തരം|അതിനാൽ|അതുകൊണ്ട്/.test(s)) return 'result';
  if (index === 0 && count > 1) return 'question';
  if (index === count - 1 && count > 1) return 'result';
  return 'step';
}

/** Small fast seeded random numbers (mulberry32). */
function rand(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashText(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/**
 * One move per beat. Same inputs → same moves (so the live preview and the MP4 match).
 * Rules: never the same move on two steps in a row; crash zoom and whip pan at most twice, dutch tilt once;
 * a whip pan never opens a part.
 */
export function pickBeatPresets(kinds: BeatKind[], mode: Exclude<MovesMode, 'off'>, flavour: Flavour, seed: number): CameraPresetId[] {
  const menu = mode === 'calm' ? MENU.calm : MENU[`lively-${flavour}`];
  const r = rand(seed);
  const used = new Map<CameraPresetId, number>();
  const out: CameraPresetId[] = [];
  kinds.forEach((k, i) => {
    const prev = out[i - 1];
    let pool = menu[k].filter((id) => id !== prev && (used.get(id) ?? 0) < (LIMIT[id] ?? Infinity) && !(i === 0 && id === 'whip-pan'));
    if (!pool.length) pool = (['push-in', 'breathe'] as CameraPresetId[]).filter((id) => id !== prev);
    // the first choice of the menu is a little more likely (weights n, n-1, … 1)
    const w = pool.map((_, j) => pool.length - j);
    let x = r() * w.reduce((a, b) => a + b, 0);
    let pick = pool[pool.length - 1];
    for (let j = 0; j < pool.length; j++) { x -= w[j]; if (x <= 0) { pick = pool[j]; break; } }
    out.push(pick);
    used.set(pick, (used.get(pick) ?? 0) + 1);
  });
  return out;
}

/* ---------------- the move itself ---------------- */

export interface Box { l: number; r: number; t: number; b: number }

export interface ShotInput {
  preset: CameraPresetId;
  flavour: Flavour;
  /** 0..1 through the beat, and the beat's length (ms). */
  p: number;
  beatMs: number;
  /** The lines this step writes (design units), or null when it writes nothing yet. */
  focus: Box | null;
  /** Where the pen is now (design units), for pan-follow. */
  pen: { x: number; y: number } | null;
  /** The two sides of the working (left and right of "="), for split focus. */
  sides: [Box, Box] | null;
  /** The board's own view: its centre and half-size (design units). */
  view: { cx: number; cy: number; hw: number; hh: number };
}

/** A camera on top of the board's own: zoom, look-at point (design units), tilt (radians), dim the rest (0..1), blur (px). */
export interface Shot { zoom: number; x: number; y: number; rot: number; dim: number; blur: number; sweep: number }

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const eSine = (p: number) => -(Math.cos(Math.PI * clamp(p)) - 1) / 2;
const eCubic = (p: number) => { p = clamp(p); return p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2; };
const eExpo = (p: number) => (p >= 1 ? 1 : 1 - 2 ** (-10 * clamp(p)));
const eBack = (p: number, s = 2.2) => { p = clamp(p) - 1; return 1 + (s + 1) * p ** 3 + s * p ** 2; };

const NEUTRAL = (v: ShotInput['view']): Shot => ({ zoom: 1, x: v.cx, y: v.cy, rot: 0, dim: 0, blur: 0, sweep: 0 });
const centre = (b: Box) => ({ x: (b.l + b.r) / 2, y: (b.t + b.b) / 2 });

/** The largest zoom (≥ 1) at which `b` still fits inside the board's view with a margin. */
export function fitZoom(b: Box | null, v: ShotInput['view'], cap: number): number {
  if (!b) return 1;
  const w = Math.max(1, b.r - b.l), h = Math.max(1, b.b - b.t);
  return Math.max(1, Math.min(cap, (v.hw * 2 * 0.86) / w, (v.hh * 2 * 0.78) / h));
}

/** The shot of one beat at progress p (before the safety clamp). */
export function rawShot(i: ShotInput): Shot {
  const v = i.view;
  const s = NEUTRAL(v);
  const cine = i.flavour === 'cinematic';
  const f = i.focus ? centre(i.focus) : { x: v.cx, y: v.cy };
  const ms = Math.max(1, i.beatMs);
  const at = (msFrom: number, msTo: number) => clamp((i.p * ms - msFrom) / Math.max(1, msTo - msFrom));
  switch (i.preset) {
    case 'push-in': {
      const z = fitZoom(i.focus, v, cine ? 1.14 : 1.22);
      const k = eSine(i.p);
      return { ...s, zoom: lerp(1, z, k), x: lerp(v.cx, f.x, k), y: lerp(v.cy, f.y, k) };
    }
    case 'pull-out-reveal': {
      const z = fitZoom(i.focus, v, cine ? 1.45 : 1.7);
      const k = eExpo(at(ms * 0.55, ms * 0.55 + (cine ? 2200 : 1600)));
      return { ...s, zoom: lerp(z, 1, k), x: lerp(f.x, v.cx, k), y: lerp(f.y, v.cy, k) };
    }
    case 'crash-zoom': {
      // waits until most of the line is written, then punches in fast
      const z = fitZoom(i.focus, v, 1.5);
      const start = ms * 0.55;
      const k = eBack(at(start, start + 330));
      const into = eCubic(at(start - 250, start));
      return { ...s, zoom: lerp(1, z, k), x: lerp(v.cx, f.x, Math.max(into, clamp(k))), y: lerp(v.cy, f.y, Math.max(into, clamp(k))) };
    }
    case 'pan-follow': {
      const z = fitZoom(i.focus ? { ...i.focus, l: f.x - (v.hw * 0.6), r: f.x + v.hw * 0.6 } : null, v, cine ? 1.2 : 1.3);
      const pen = i.pen ?? f;
      const k = eCubic(at(0, 500));
      return { ...s, zoom: lerp(1, z, k), x: lerp(v.cx, pen.x, k), y: lerp(v.cy, f.y, k) };
    }
    case 'tilt-down-steps': {
      const z = fitZoom(i.focus, v, cine ? 1.15 : 1.22);
      const k = eCubic(at(0, cine ? 900 : 600));
      return { ...s, zoom: z, x: v.cx, y: lerp(v.cy, f.y, k) };
    }
    case 'rack-focus': {
      const z = fitZoom(i.focus, v, 1.1);
      const k = eSine(at(0, 500));
      const out = 1 - eSine(at(ms - 450, ms));
      return { ...s, zoom: lerp(1, z, k), x: lerp(v.cx, f.x, k * 0.6), y: lerp(v.cy, f.y, k * 0.6), dim: (cine ? 0.55 : 0.5) * Math.min(k, out) };
    }
    case 'whip-pan': {
      const k = at(0, 320);
      const e = eCubic(k);
      const z = fitZoom(i.focus, v, 1.15);
      const settle = eSine(at(320, 900));
      return { ...s, zoom: lerp(1, z, settle), x: lerp(v.cx, f.x, settle) - (1 - e) * v.hw * 2.2, y: lerp(v.cy, f.y, settle), sweep: k < 1 ? Math.sin(Math.PI * k) : 0, blur: k < 1 ? 14 * Math.sin(Math.PI * k) : 0 };
    }
    case 'dutch-tilt': {
      const z = fitZoom(i.focus, v, cine ? 1.12 : 1.2);
      const k = eCubic(at(0, 600));
      const deg = (cine ? 2 : 4) * Math.sin(Math.PI * at(400, 400 + (cine ? 1400 : 900)));
      return { ...s, zoom: lerp(1, z, k), x: lerp(v.cx, f.x, k), y: lerp(v.cy, f.y, k), rot: (deg * Math.PI) / 180 };
    }
    case 'split-focus': {
      if (!i.sides) return rawShot({ ...i, preset: 'push-in' });
      const [a, b] = i.sides;
      const both: Box = { l: Math.min(a.l, b.l), r: Math.max(a.r, b.r), t: Math.min(a.t, b.t), b: Math.max(a.b, b.b) };
      const z = Math.min(fitZoom(a, v, 1.4), fitZoom(b, v, 1.4));
      const each = cine ? 1400 : 1000;
      // left … right … both
      const ka = eCubic(at(0, 450));
      const kb = eCubic(at(each, each + 450));
      const kc = eCubic(at(each * 2, each * 2 + 600));
      const ca = centre(a), cb = centre(b), cc = centre(both);
      const x = lerp(lerp(lerp(v.cx, ca.x, ka), cb.x, kb), cc.x, kc);
      const y = lerp(lerp(lerp(v.cy, ca.y, ka), cb.y, kb), cc.y, kc);
      return { ...s, zoom: lerp(lerp(1, z, ka), fitZoom(both, v, 1.4), kc), x, y };
    }
    case 'breathe':
      return { ...s, zoom: 1 + (cine ? 0.025 : 0.03) * Math.sin((Math.PI * 2 * i.p * ms) / 8000) ** 2 };
    default: // 3D moves are not drawn on the flat board
      return s;
  }
}

/**
 * Keeps the camera inside the board's own view: never shows an edge the board did not show before
 * (a zoom of z can only move by (1 − 1/z) of the half-view), and never zooms out below the board's own framing.
 * A whip pan's sweep is the one move allowed to leave the view, for a third of a second.
 */
export function safeShot(sh: Shot, v: ShotInput['view']): Shot {
  const zoom = Math.max(1, sh.zoom);
  const mx = v.hw * (1 - 1 / zoom), my = v.hh * (1 - 1 / zoom);
  const x = sh.sweep > 0 ? sh.x : clamp(sh.x, v.cx - mx, v.cx + mx);
  return { ...sh, zoom, x, y: clamp(sh.y, v.cy - my, v.cy + my) };
}

/** The shot at progress p, eased in from where the previous beat ended (so steps flow into each other). */
export function shotAt(cur: ShotInput, prev: ShotInput | null): Shot {
  const now = safeShot(rawShot(cur), cur.view);
  if (!prev || cur.preset === 'whip-pan' || cur.preset === 'crash-zoom') return now;
  const from = safeShot(rawShot({ ...prev, p: 1 }), prev.view);
  const k = eCubic(clamp((cur.p * cur.beatMs) / (cur.flavour === 'cinematic' ? 700 : 450)));
  if (k >= 1) return now;
  return { zoom: lerp(from.zoom, now.zoom, k), x: lerp(from.x, now.x, k), y: lerp(from.y, now.y, k), rot: lerp(from.rot, now.rot, k), dim: now.dim * k, blur: now.blur, sweep: now.sweep };
}

/* ---------------- the student's setting (this device) ---------------- */

const KEY = 'aiguru.cameraMoves';
export const MOVES_SETTINGS: readonly MovesSetting[] = ['auto', 'calm', 'lively', 'off'];
export const MOVES_NAME: Record<MovesSetting, string> = {
  auto: 'Auto (calm in class, lively in videos)',
  calm: 'Calm',
  lively: 'Lively',
  off: 'Off',
};
let CACHE: MovesSetting | null = null;
/** The setting on this device (read once, then kept: every frame asks for it). */
export function readMovesSetting(): MovesSetting {
  if (CACHE) return CACHE;
  try {
    const v = typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY);
    CACHE = (MOVES_SETTINGS as readonly string[]).includes(v ?? '') ? (v as MovesSetting) : 'auto';
  } catch { CACHE = 'auto'; }
  return CACHE;
}
export function saveMovesSetting(v: MovesSetting): void {
  CACHE = v;
  try { localStorage.setItem(KEY, v); } catch { /* private mode */ }
}
/** The mode for a frame: an explicit choice wins; Auto = calm while teaching, lively in a downloaded video. */
export function movesFor(setting: MovesSetting | undefined, download: boolean): MovesMode {
  const s = setting ?? readMovesSetting();
  if (s === 'auto') return download ? 'lively' : 'calm';
  return s;
}
