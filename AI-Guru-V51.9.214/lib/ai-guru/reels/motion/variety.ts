/**
 * V51.9.101 — every shared reel different.
 *
 * One SEED per reel (made when the student starts a new reel, or taps 🎲 Shuffle) picks, independently:
 *   look (board, colours, shapes, fonts, avatar frame, transitions) · camera · opener · ending · music · sound pack ·
 *   mascot pose · pace. The same seed always gives the same reel, so the preview and the MP4 match.
 * The phone remembers the last 5 looks the student used and never picks them again. The season (Onam, Vishu …)
 * switches itself on by date and suggests its look. Anything can be fixed by hand instead of "Auto".
 *
 * Content kinds (what the reel teaches, not only how it looks): normal · spot the mistake · speed run · two ways ·
 * Malayalam ↔ English challenge · teacher–student duet · weekly class challenge.
 *
 * Pure (no DOM apart from the guarded localStorage helpers): the tests use it.
 */

import { MISTAKES } from '../../features';
import { CAMERAS, type CameraKind } from './camera';
import type { Lang } from './captions';
import { withVoice, type MotionScene, type Track } from './engine';
import { accentById, ALL_LOOKS, BOARD_FONTS, CARD_FONTS, LOOK_FONTS, LOOKS, lookById, type AccentId, type FontKind, type ReelLook } from './look';
import { POSES, type Pose } from './mascot';
import { buildEnding, buildOpener, ENDINGS, OPENERS, usableEnding, type EndingKind, type HookContext, type OpenerKind } from './recipes/hooks';
import { buildIntro } from './recipes/intro';
import { makeReel, parseArithmetic, type MotionReel } from './reel';
import { seasonById, seasonFor, type SeasonId } from './season';
import { MUSICS, SFX_PACKS, type MusicKind, type SfxPack } from './sfx';

export type Pace = 'brisk' | 'normal' | 'relaxed';
export const PACE_GAP: Record<Pace, number> = { brisk: 140, normal: 300, relaxed: 560 };

export type ReelKind = 'normal' | 'spot-mistake' | 'speed-run' | 'two-ways' | 'bilingual' | 'duet' | 'weekly';
// V51.9.123: "Spot the mistake" is left out while MISTAKES is off
export const REEL_KINDS: readonly ReelKind[] = (['normal', 'spot-mistake', 'speed-run', 'two-ways', 'bilingual', 'duet', 'weekly'] as ReelKind[]).filter((k) => MISTAKES || k !== 'spot-mistake');
export const KIND_NAME: Record<ReelKind, string> = {
  normal: 'Normal',
  'spot-mistake': 'Spot the mistake',
  'speed-run': 'Speed run',
  'two-ways': 'Same answer, two ways',
  bilingual: 'Malayalam ↔ English challenge',
  duet: 'Teacher asks, I answer',
  weekly: 'Weekly class challenge',
};

export interface ReelStyle {
  seed: number;
  look: ReelLook;
  camera: CameraKind;
  opener: OpenerKind | 'none';
  ending: EndingKind | 'none';
  music: MusicKind;
  pack: SfxPack;
  pose: Pose;
  pace: Pace;
  season: SeasonId | null;
  /** V51.9.106: the font of the titles, captions and cards, and of the maths on the board. */
  font: FontKind;
  boardFont: FontKind;
}

/** What the student fixed by hand ('auto' / undefined = let the seed choose). */
export interface StyleChoices {
  look?: string | 'auto';
  camera?: CameraKind | 'auto';
  opener?: OpenerKind | 'none' | 'auto';
  ending?: EndingKind | 'none' | 'auto';
  music?: MusicKind | 'auto';
  pack?: SfxPack | 'auto';
  pose?: Pose | 'auto';
  pace?: Pace | 'auto';
  font?: FontKind | 'auto';
  boardFont?: FontKind | 'auto';
  /** false = no seasonal theme even when it is the season. */
  season?: boolean;
}

/** Small fast seeded random numbers (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function newSeed(): number {
  try { return crypto.getRandomValues(new Uint32Array(1))[0]; } catch { return Math.floor(Math.random() * 2 ** 32); }
}

const pick = <T,>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length) % xs.length];

/** One random draw with a weight per option (one call of r, whatever the weights: the draw order never shifts). */
function pickWeighted<T>(r: () => number, xs: readonly T[], weight: (x: T) => number): T {
  const weights = xs.map(weight);
  let u = r() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < xs.length; i++) { u -= weights[i]; if (u < 0) return xs[i]; }
  return xs[xs.length - 1];
}

/** One random draw, where the options in `fit` are `w` times as likely as the rest (fit = a good match for the lesson). */
function pickFit<T>(r: () => number, xs: readonly T[], fit: readonly unknown[] | undefined, key: (x: T) => unknown = (x) => x, w = 3): T {
  const weights = xs.map((x) => (fit?.some((f) => f === key(x)) ? w : 1));
  let u = r() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < xs.length; i++) { u -= weights[i]; if (u < 0) return xs[i]; }
  return xs[xs.length - 1];
}

/* ---------------- V51.9.102: the style fits the lesson ---------------- */

/** What kind of maths a reel is about (from the sum, the topic example's branch, or the chapter intro). */
export type Topic = 'arithmetic' | 'algebra' | 'geometry' | 'data' | 'calculus' | 'intro';

export function topicOf(o: { kind: 'arithmetic' | 'branch' | 'intro' | 'derivation'; branch?: string }): Topic {
  if (o.kind === 'arithmetic') return 'arithmetic';
  if (o.kind === 'intro') return 'intro';
  const b = (o.branch ?? '').toLowerCase();
  if (/geometr|pythag|triang|mensur|circle|trigon|area|angle|solid/.test(b)) return 'geometry';
  if (/statist|probab|percent|mean|data|chart|fraction|ratio/.test(b)) return 'data';
  if (/calcul|differen|integr|limit/.test(b)) return 'calculus';
  return 'algebra';
}

/**
 * Good matches per kind of lesson: they are 3 × as likely, never forced, so reels of one topic still differ.
 * Random choice stays for colours, framing and transitions; the maths and the facts never depend on it.
 */
export const TOPIC_FIT: Record<Topic, { looks: string[]; cameras: CameraKind[]; openers: OpenerKind[] }> = {
  arithmetic: { looks: ['notebook', 'chalk', 'classic', 'mint', 'kasavu', 'comic'], cameras: ['punch', 'focus'], openers: ['challenge', 'countdown', 'mistake'] },
  algebra: { looks: ['classic', 'notebook', 'night', 'sunrise', 'neon', 'comic'], cameras: ['punch', 'focus'], openers: ['mistake', 'challenge', 'fact'] },
  geometry: { looks: ['graph', 'night', 'ocean', 'classic', 'ink'], cameras: ['drift', 'focus'], openers: ['fact', 'challenge'] },
  data: { looks: ['graph', 'mint', 'sunrise', 'kasavu', 'comic'], cameras: ['drift', 'punch'], openers: ['fact', 'challenge'] },
  calculus: { looks: ['night', 'ocean', 'graph', 'neon', 'ink'], cameras: ['drift', 'focus'], openers: ['fact', 'countdown'] },
  intro: { looks: ['night', 'kasavu', 'sunrise', 'chalk', 'ink'], cameras: ['drift', 'steady'], openers: ['fact', 'countdown'] },
};

/* ---------------- V51.9.105: the style fits the class level ---------------- */

/** Lower classes (up to Std 4), middle (5–8), senior (9–12), from the student's profile ("7", "Std 9", "Class 10", "LKG"). */
export type Level = 'young' | 'middle' | 'senior';
export function levelOf(standard: string | null | undefined): Level | null {
  const s = (standard ?? '').trim().toLowerCase();
  if (!s) return null;
  if (/^(l|u)kg$|nursery|pre-?k/.test(s)) return 'young';
  const roman: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12 };
  const m = s.match(/\d+/);
  const n = m ? Number(m[0]) : roman[s.replace(/^(std|class|standard)\.?\s*/, '')] ?? NaN;
  if (!(n >= 1 && n <= 12)) return null;
  return n <= 4 ? 'young' : n <= 8 ? 'middle' : 'senior';
}

/**
 * Suits the class: bright, playful and lively for the little ones; calmer and more cinematic for Std 9–12.
 * Twice as likely (and stacks with the topic), never forced.
 */
export const LEVEL_FIT: Record<Level, { looks: string[]; cameras: CameraKind[]; paces: Pace[]; music: MusicKind[]; packs: SfxPack[] }> = {
  young: { looks: ['sunrise', 'mint', 'comic', 'notebook', 'chalk'], cameras: ['punch', 'steady'], paces: ['relaxed', 'normal'], music: ['upbeat', 'kerala'], packs: ['arcade', 'classic'] },
  middle: { looks: ['comic', 'chalk', 'graph', 'neon', 'notebook', 'kasavu'], cameras: ['punch', 'focus'], paces: ['normal', 'brisk'], music: ['upbeat', 'kerala', 'lofi'], packs: ['classic', 'arcade'] },
  senior: { looks: ['night', 'ocean', 'graph', 'ink', 'neon'], cameras: ['drift', 'focus'], paces: ['normal', 'relaxed'], music: ['calm', 'lofi'], packs: ['soft', 'classic'] },
};

/* ---------------- V51.9.105: classmates spread across the looks ---------------- */

/** How much less likely a look is for each classmate who already downloaded a reel in it today. */
export const CLASS_PENALTY = 1.5;
export const classWeight = (count: number | undefined) => 1 / (1 + CLASS_PENALTY * Math.max(0, count ?? 0));

/** The reel's style from its seed. `recent` = looks used lately (never picked again while others are left). */
export function planStyle(seed: number, o: { recent?: string[]; date?: Date; hasFace?: boolean; choices?: StyleChoices; topic?: Topic; level?: Level | null; classLooks?: Record<string, number> } = {}): ReelStyle {
  const fit = o.topic ? TOPIC_FIT[o.topic] : undefined;
  const lv = o.level ? LEVEL_FIT[o.level] : undefined;
  const cl = o.classLooks ?? {};
  const w = <T,>(list: readonly T[] | undefined, x: T, k: number) => (list?.includes(x) ? k : 1);
  const r = rng(seed);
  const ch = o.choices ?? {};
  const season = ch.season === false ? null : seasonFor(o.date ?? new Date());
  const recent = new Set(o.recent ?? []);
  // the look's two random draws happen even when the look is fixed by hand, so the other choices never shift
  const fresh = LOOKS.filter((l) => !recent.has(l.id));
  const pool = fresh.length ? fresh : LOOKS;
  const seasonal = season ? pool.find((l) => l.id === seasonById(season)?.look) : undefined;
  // the season's look is less likely once classmates have used it today, so a class does not all post kasavu at Onam
  const useSeasonal = r() < 0.7 * classWeight(seasonal ? cl[seasonal.id] : 0);
  const autoLook = seasonal && useSeasonal ? seasonal : pickWeighted(r, pool, (l) => w(fit?.looks, l.id, 3) * w(lv?.looks, l.id, 2) * classWeight(cl[l.id]));
  const look: ReelLook = ch.look && ch.look !== 'auto' ? lookById(ch.look) : autoLook;
  const openers = OPENERS.filter((k) => k !== 'avatar' || o.hasFace);
  // draw every random choice in a fixed order, so fixing one by hand does not change the others
  const autoCamera = pickWeighted(r, CAMERAS, (c) => w(fit?.cameras, c, 3) * w(lv?.cameras, c, 2));
  const autoOpener = pickFit(r, openers, fit?.openers);
  const autoEnding = pick(r, ENDINGS);
  const autoMusic = pickWeighted(r, MUSICS, (m) => w(lv?.music, m, 2));
  const autoPack = pickWeighted(r, SFX_PACKS, (k) => w(lv?.packs, k, 2));
  const autoPose = pick(r, POSES);
  const autoPace = pickWeighted(r, ['brisk', 'normal', 'normal', 'relaxed'] as const, (k) => w(lv?.paces, k, 2));
  // V51.9.106 fonts (drawn last, so every choice above is the same as before): the look's own card font is most
  // likely, then fonts that suit the look; the board keeps the classic serif about half the time
  const suits = LOOK_FONTS[look.id] ?? { card: [], board: [] };
  const young = o.level === 'young';
  const autoFont = pickWeighted(r, CARD_FONTS, (f) => (f === look.font ? 4 : suits.card.includes(f) ? 2 : 0.4) * (young && (f === 'bubbly' || f === 'rounded' || f === 'comic') ? 2 : 1));
  const autoBoard = pickWeighted(r, BOARD_FONTS, (f) => (f === 'serif' ? 6 : suits.board.includes(f) ? 2.5 : 0.4) * (young && (f === 'bubbly' || f === 'rounded') ? 2 : 1));
  // V51.9.126: the cinematic look always speaks in its elegant serif, writes the maths in the clear serif, and keeps
  // the camera steady (the sky and the board already drift in slowly) unless the student chose otherwise
  const cine = look.id === 'cinematic';
  return {
    seed,
    look,
    camera: ch.camera && ch.camera !== 'auto' ? ch.camera : cine ? 'steady' : autoCamera,
    opener: ch.opener && ch.opener !== 'auto' ? ch.opener : autoOpener,
    ending: ch.ending && ch.ending !== 'auto' ? ch.ending : autoEnding,
    music: ch.music && ch.music !== 'auto' ? ch.music : autoMusic,
    pack: ch.pack && ch.pack !== 'auto' ? ch.pack : autoPack,
    pose: ch.pose && ch.pose !== 'auto' ? ch.pose : autoPose,
    pace: ch.pace && ch.pace !== 'auto' ? ch.pace : autoPace,
    season,
    font: ch.font && ch.font !== 'auto' && CARD_FONTS.includes(ch.font) ? ch.font : cine ? 'elegant' : autoFont,
    boardFont: ch.boardFont && ch.boardFont !== 'auto' && BOARD_FONTS.includes(ch.boardFont) ? ch.boardFont : cine ? 'serif' : autoBoard,
  };
}

/* ---------------- the phone's memory of recent looks ---------------- */

export const RECENT_LOOKS_KEY = 'aiguru_reel_recent_looks_v1';
export const RECENT_MAX = 5;

export function loadRecentLooks(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_LOOKS_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

/** Remembers a look the student actually downloaded (newest first, last 5). */
export function rememberLook(id: string, list: string[] = loadRecentLooks()): string[] {
  const next = [id, ...list.filter((x) => x !== id)].slice(0, RECENT_MAX);
  try { localStorage.setItem(RECENT_LOOKS_KEY, JSON.stringify(next)); } catch { /* private mode */ }
  return next;
}

/* ---------------- sums: variants, a tempting wrong answer, a second way ---------------- */

const digits = (n: number) => String(Math.abs(n)).length;
const withDigits = (r: () => number, d: number) => {
  const lo = 10 ** (d - 1), hi = 10 ** d - 1;
  return lo + Math.floor(r() * (hi - lo + 1));
};
const OPS = { add: '+', sub: '−', mul: '×', div: '÷' } as const;

/** A new sum of the same kind and size (for "comment your answer"). */
export function similarSum(text: string, seed: number): string | undefined {
  const p = parseArithmetic(text);
  if (!p) return undefined;
  const r = rng(seed ^ 0x51ed);
  if (p.op === 'add') return p.nums.map((n) => withDigits(r, digits(n))).join(' + ');
  if (p.op === 'sub') {
    const a = withDigits(r, digits(p.a));
    const b = Math.min(a - 1, withDigits(r, digits(p.b)));
    return `${a} ${OPS.sub} ${Math.max(1, b)}`;
  }
  if (p.op === 'mul') return `${withDigits(r, digits(p.a))} ${OPS.mul} ${withDigits(r, digits(p.b))}`;
  const b = Math.max(2, withDigits(r, digits(p.b)));
  const q = withDigits(r, Math.max(1, digits(p.a) - digits(p.b)));
  return `${b * q} ${OPS.div} ${b}`;
}

/** Three quick one-digit questions of the same operation, with answers (for the quick-fire ending). */
export function quickQuestions(text: string, seed: number): Array<[string, string]> {
  const p = parseArithmetic(text);
  const op = p?.op ?? 'add';
  const r = rng(seed ^ 0x9a1);
  return [0, 1, 2].map(() => {
    const a = 2 + Math.floor(r() * 8), b = 2 + Math.floor(r() * 8);
    if (op === 'add') return [`${a} + ${b}`, String(a + b)];
    if (op === 'sub') return [`${a + b} − ${b}`, String(a)];
    if (op === 'mul') return [`${a} × ${b}`, String(a * b)];
    return [`${a * b} ÷ ${b}`, String(a)];
  });
}

/** A wrong answer students really give, and why it is wrong. */
export function commonMistake(text: string): { wrong: string; why: { en: string; ml: string } } | undefined {
  const p = parseArithmetic(text);
  if (!p) return undefined;
  if (p.op === 'add' && p.nums.length === 2) {
    const [a, b] = p.nums;
    const len = Math.max(digits(a), digits(b));
    let w = '';
    for (let i = 0; i < len; i++) w = String((Math.floor(a / 10 ** i) % 10 + Math.floor(b / 10 ** i) % 10) % 10) + w;
    if (Number(w) === a + b) return undefined; // no carry in this sum: nothing to forget
    return { wrong: String(Number(w)), why: { en: 'The mistake: the carry was forgotten.', ml: 'തെറ്റ്: കാരി ചേർക്കാൻ മറന്നു.' } };
  }
  if (p.op === 'sub') {
    const len = digits(p.a);
    let w = '';
    for (let i = 0; i < len; i++) w = String(Math.abs((Math.floor(p.a / 10 ** i) % 10) - (Math.floor(p.b / 10 ** i) % 10))) + w;
    if (Number(w) === p.a - p.b || p.a < p.b) return undefined;
    return { wrong: String(Number(w)), why: { en: 'The mistake: the smaller digit was taken from the bigger one instead of borrowing.', ml: 'തെറ്റ്: കടം വാങ്ങുന്നതിനു പകരം വലിയ അക്കത്തിൽ നിന്ന് ചെറുത് കുറച്ചു.' } };
  }
  if (p.op === 'mul' && p.b >= 10) {
    const ones = p.b % 10, rest = Math.floor(p.b / 10);
    const wrong = p.a * ones + p.a * rest; // second row not moved one place left
    if (wrong === p.a * p.b) return undefined;
    return { wrong: String(wrong), why: { en: 'The mistake: the second row was not moved one place to the left.', ml: 'തെറ്റ്: രണ്ടാമത്തെ വരി ഒരു സ്ഥാനം ഇടത്തേക്ക് മാറ്റിയില്ല.' } };
  }
  if (p.op === 'div' && p.a % p.b === 0) {
    const q = String(p.a / p.b);
    if (!q.includes('0') || q.replace(/0/g, '') === '') return undefined;
    return { wrong: q.replace(/0/g, ''), why: { en: 'The mistake: the 0 in the answer was left out.', ml: 'തെറ്റ്: ഉത്തരത്തിലെ 0 വിട്ടുപോയി.' } };
  }
  return undefined;
}

/** A second way to the same answer, line by line (every line is computed, so it is always right). */
export function secondWay(text: string): { name: { en: string; ml: string }; lines: string[][] } | undefined {
  const p = parseArithmetic(text);
  if (!p) return undefined;
  if (p.op === 'add' && p.nums.length === 2) {
    const [a, b] = p.nums;
    const k = (10 - (a % 10)) % 10;
    if (!k || k >= b) return undefined;
    return { name: { en: 'Make a round number', ml: 'ഒരു റൗണ്ട് സംഖ്യയാക്കാം' }, lines: [[String(a), '+', String(b)], [`(${a}+${k})`, '+', `(${b}−${k})`], [String(a + k), '+', String(b - k)], [String(a + b)]] };
  }
  if (p.op === 'sub') {
    const k = (10 - (p.b % 10)) % 10;
    if (!k || p.a < p.b) return undefined;
    return { name: { en: 'Add the same to both', ml: 'രണ്ടിനോടും ഒരേ സംഖ്യ കൂട്ടാം' }, lines: [[String(p.a), '−', String(p.b)], [`(${p.a}+${k})`, '−', `(${p.b}+${k})`], [String(p.a + k), '−', String(p.b + k)], [String(p.a - p.b)]] };
  }
  if (p.op === 'mul' && p.b >= 10 && p.b < 100) {
    const tens = p.b - (p.b % 10), ones = p.b % 10;
    if (!ones) return undefined;
    return { name: { en: 'Split the number', ml: 'സംഖ്യ പിരിച്ചെഴുതാം' }, lines: [[String(p.a), '×', String(p.b)], [`${p.a}×${tens}`, '+', `${p.a}×${ones}`], [String(p.a * tens), '+', String(p.a * ones)], [String(p.a * p.b)]] };
  }
  if (p.op === 'div' && p.a % p.b === 0) {
    const big = Math.floor(p.a / (p.b * 10 ** (digits(p.a / p.b) - 1))) * p.b * 10 ** (digits(p.a / p.b) - 1);
    const rest = p.a - big;
    if (!big || !rest || rest % p.b) return undefined;
    return { name: { en: 'Split into easy parts', ml: 'എളുപ്പമുള്ള ഭാഗങ്ങളാക്കാം' }, lines: [[String(p.a), '÷', String(p.b)], [`${big}÷${p.b}`, '+', `${rest}÷${p.b}`], [String(big / p.b), '+', String(rest / p.b)], [String(p.a / p.b)]] };
  }
  return undefined;
}

/** The weekly class problem: the same for everyone in a class in a given week (from the class code and the week number). */
export function weeklySum(classCode: string, date: Date = new Date()): string {
  // weeks run Monday to Sunday, India time (5 Jan 1970 was a Monday)
  const ist = date.getTime() + 5.5 * 3600_000;
  const week = Math.floor((ist - Date.UTC(1970, 0, 5)) / (7 * 86400_000));
  let h = 2166136261;
  for (const ch of `${classCode}|${week}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const r = rng(h >>> 0);
  const kind = week % 4;
  if (kind === 0) return `${withDigits(r, 3)} + ${withDigits(r, 3)}`;
  if (kind === 1) { const a = withDigits(r, 4); return `${a} − ${withDigits(r, 3)}`; }
  if (kind === 2) return `${withDigits(r, 3)} × ${withDigits(r, 2)}`;
  const b = withDigits(r, 1) + 1;
  return `${b * withDigits(r, 3)} ÷ ${b}`;
}

/* ---------------- speed run: the same reel, faster ---------------- */

function scaleTrack(tr: Track<number> | Track<string> | undefined, k: number) {
  if (!tr) return;
  for (const s of tr.segs) { s.t0 *= k; s.t1 *= k; }
}

/** A copy of a scene with every time multiplied by k (k < 1 = faster). Used for speed runs (no voice-over). */
export function retimeScene(scene: MotionScene, k: number): MotionScene {
  const s: MotionScene = structuredCloneScene(scene);
  for (const it of s.items) {
    for (const tr of [it.x, it.y, it.x2, it.y2, it.alpha, it.scale, it.draw, it.halo, it.dim, it.rot, it.color, it.fill, it.fillAlpha]) scaleTrack(tr, k);
    for (const w of it.swaps) { w.t *= k; w.dur *= k; }
    for (const l of it.lifts) { l.t0 *= k; l.t1 *= k; }
    for (const m of it.morphs ?? []) { m.t0 *= k; m.t1 *= k; }
  }
  for (const c of s.captions) { c.t0 *= k; c.t1 *= k; delete c.voiceT0; delete c.voiceMs; }
  for (const e of s.sfx) { e.t *= k; if (e.dur) e.dur *= k; }
  scaleTrack(s.camY, k); scaleTrack(s.camH, k); scaleTrack(s.camX, k);
  s.durationMs = Math.ceil(s.durationMs * k);
  return s;
}

/** Deep copy of a scene, keeping Track objects working (their methods live on the prototype). */
function structuredCloneScene(scene: MotionScene): MotionScene {
  const tr = <T,>(t: Track<T>): Track<T> => Object.assign(Object.create(Object.getPrototypeOf(t)), t, { segs: t.segs.map((g) => ({ ...g })) });
  return {
    ...scene,
    items: scene.items.map((it) => ({
      ...it,
      x: tr(it.x), y: tr(it.y), x2: tr(it.x2), y2: tr(it.y2), alpha: tr(it.alpha), scale: tr(it.scale), draw: tr(it.draw), halo: tr(it.halo), dim: tr(it.dim), rot: tr(it.rot), color: tr(it.color), fill: tr(it.fill), fillAlpha: tr(it.fillAlpha),
      swaps: it.swaps.map((w) => ({ ...w })), lifts: it.lifts.map((l) => ({ ...l })), morphs: it.morphs?.map((m) => ({ ...m })),
    })),
    captions: scene.captions.map((c) => ({ ...c })),
    sfx: scene.sfx.map((e) => ({ ...e })),
    camY: tr(scene.camY), camH: tr(scene.camH), camX: scene.camX ? tr(scene.camX) : undefined,
  };
}

/* ---------------- putting a reel together ---------------- */

export interface DecorateInput {
  style: ReelStyle;
  kind: ReelKind;
  lang: Lang;
  /** The sum, when the reel is a sum. */
  sum?: string;
  name?: string;
  toffees?: number;
  streak?: number;
  /** "Class 9A" for the weekly challenge. */
  className?: string;
  /** A face in the corner (the avatar opener can be used). */
  /* (for 'duet' the student's face is in the corner and the teacher's face asks in the opener) */
  hasFace?: boolean;
  /** Voice clip lengths, so openers and endings are timed to their voice. */
  voiceMs?: (spoken: string) => number | undefined;
}

export function hookContext(reel: MotionReel, d: DecorateInput): HookContext {
  const mistake = d.sum ? commonMistake(d.sum) : undefined;
  return {
    lang: d.lang,
    title: reel.title,
    sum: d.sum,
    wrong: mistake?.wrong,
    next: d.sum ? similarSum(d.sum, d.style.seed) : undefined,
    quick: d.sum ? quickQuestions(d.sum, d.style.seed) : undefined,
    name: d.name,
    toffees: d.toffees,
    streak: d.streak,
    pose: d.style.pose,
    greeting: d.style.season ? seasonById(d.style.season)?.greeting[d.lang] : undefined,
    seed: d.style.seed,
  };
}

/**
 * Adds the opener and the ending (and, for the content kinds, their own scenes) around a built reel.
 * Built inside the voice plan, so every added line is spoken and timed like the lesson.
 */
export function decorateReel(reel: MotionReel, d: DecorateInput): MotionReel {
  const c = hookContext(reel, d);
  const ml = d.lang === 'ml';
  const plan = { lang: d.lang, clipMs: d.voiceMs ?? (() => undefined), gapMs: PACE_GAP[d.style.pace] };
  return withVoice(plan, () => {
    let parts = [...reel.parts];
    let opener: MotionScene | null = null;
    let ending: MotionScene | null = null;
    const extra: MotionScene[] = [];
    switch (d.kind) {
      case 'spot-mistake': {
        if (!MISTAKES) break; // V51.9.123: a saved choice falls back to a normal reel
        const m = d.sum ? commonMistake(d.sum) : undefined;
        opener = buildOpener('mistake', { ...c, wrong: m?.wrong });
        if (m) extra.push(tagScene(buildIntro({ title: reel.title, heading: ml ? 'തെറ്റ് കണ്ടോ?' : 'Did you spot it?', points: [{ board: ml ? m.why.ml : m.why.en, say: ml ? m.why.ml : m.why.en }] }), 'reveal'));
        break;
      }
      case 'speed-run':
        parts = parts.map((p) => retimeScene(p, 0.55));
        opener = buildOpener('challenge', c);
        break;
      case 'two-ways': {
        const w = d.sum ? secondWay(d.sum) : undefined;
        if (w) {
          extra.push(tagScene(buildIntro({
            title: reel.title,
            heading: `${ml ? 'രണ്ടാമത്തെ വഴി' : 'Way 2'}: ${ml ? w.name.ml : w.name.en}`,
            points: w.lines.map((ln, i) => ({ math: ln, say: i === 0 ? (ml ? 'ഇതേ ഉത്തരം മറ്റൊരു വഴിയിൽ.' : 'The same answer, another way.') : i === w.lines.length - 1 ? (ml ? `ഉത്തരം ${ln[0]}. ഒരേ ഉത്തരം!` : `The answer is ${ln[0]}. Same answer!`) : ln.join(' ') })),
          }), 'way-2'));
        }
        break;
      }
      case 'bilingual':
        opener = tagScene(buildIntro({
          title: reel.title,
          heading: ml ? 'ഇംഗ്ലീഷിലും പറയാമോ?' : 'Can you say it in Malayalam?',
          points: [{ board: ml ? 'താഴെ രണ്ട് ഭാഷയിലും വായിക്കൂ' : 'Read both lines below', say: ml ? 'ഓരോ ഘട്ടവും ഇംഗ്ലീഷിലും വായിക്കൂ, ഉത്തരം കമന്റ് ചെയ്യൂ.' : 'Read every step in Malayalam too, and comment your answer.' }],
        }), 'opener');
        break;
      case 'duet': {
        // the teacher's face asks (drawn by the reel for scenes in the 'duet-ask' group), the student's face answers
        const who = d.name?.split(' ')[0] ?? '';
        const q = d.sum ?? reel.title;
        opener = tagScene(buildIntro({
          title: reel.title,
          heading: ml ? 'ടീച്ചർ ചോദിക്കുന്നു' : 'Teacher asks',
          points: [{ board: `*${q}*`, say: ml ? `${who}, ${q} ചെയ്യാമോ?` : `${who ? `${who}, c` : 'C'}an you solve ${q}?` }],
        }), 'duet-ask');
        break;
      }
      case 'weekly':
        opener = tagScene(buildIntro({
          title: reel.title,
          heading: ml ? `${d.className ?? 'ക്ലാസ്'} — ഈ ആഴ്ചയിലെ ചലഞ്ച്` : `${d.className ?? 'Class'} weekly challenge`,
          points: [{ math: (d.sum ?? reel.title).split(' '), say: ml ? 'ഈ ആഴ്ച ക്ലാസിലെ എല്ലാവർക്കും ഒരേ ചോദ്യം. ഇതാ എന്റെ ഉത്തരം!' : 'Same question for the whole class this week. Here is my answer!' }],
        }), 'opener');
        ending = buildEnding('tag', c);
        break;
      default:
        break;
    }
    if (!opener && d.style.opener !== 'none') opener = buildOpener(d.style.opener === 'avatar' && !d.hasFace ? 'challenge' : d.style.opener, c);
    if (!ending && d.style.ending !== 'none') ending = buildEnding(usableEnding(d.style.ending, c), c);
    return makeReel(reel.title, [...(opener ? [opener] : []), ...parts, ...extra, ...(ending ? [ending] : [])]);
  });
}

function tagScene(s: MotionScene, group: string): MotionScene {
  s.group = group;
  return s;
}

/* ---------------- V51.9.102: "My style" — favourites that stay ---------------- */

/** The choices a student pinned: they stay on every new reel (on this phone); everything else keeps changing. */
export type Pins = Pick<StyleChoices, 'look' | 'music' | 'pack' | 'pose' | 'camera' | 'opener' | 'ending' | 'font' | 'boardFont'>;
export const PIN_KEYS = ['look', 'music', 'pack', 'pose', 'camera', 'opener', 'ending', 'font', 'boardFont'] as const;
export const MY_STYLE_KEY = 'aiguru_reel_my_style_v1';

export function cleanPins(raw: unknown): Pins {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const ok: Record<(typeof PIN_KEYS)[number], readonly string[]> = {
    look: ALL_LOOKS.map((l) => l.id), music: MUSICS, pack: SFX_PACKS, pose: POSES, camera: CAMERAS,
    opener: [...OPENERS, 'none'], ending: [...ENDINGS, 'none'],
    font: CARD_FONTS, boardFont: BOARD_FONTS,
  };
  const out: Record<string, string> = {};
  for (const k of PIN_KEYS) if (typeof o[k] === 'string' && ok[k].includes(o[k] as string)) out[k] = o[k] as string;
  return out as Pins;
}

export function loadPins(): Pins {
  try { return cleanPins(JSON.parse(localStorage.getItem(MY_STYLE_KEY) ?? '{}')); } catch { return {}; }
}

export function savePins(p: Pins): Pins {
  const clean = cleanPins(p);
  try { localStorage.setItem(MY_STYLE_KEY, JSON.stringify(clean)); } catch { /* private mode */ }
  return clean;
}

/* ---------------- V51.9.105: my colour ---------------- */

export const MY_ACCENT_KEY = 'aiguru_reel_accent_v1';

export function loadAccent(): AccentId | null {
  try { const v = localStorage.getItem(MY_ACCENT_KEY); return accentById(v)?.id ?? null; } catch { return null; }
}

export function saveAccent(id: string | null): AccentId | null {
  const a = accentById(id)?.id ?? null;
  try { if (a) localStorage.setItem(MY_ACCENT_KEY, a); else localStorage.removeItem(MY_ACCENT_KEY); } catch { /* private mode */ }
  return a;
}
