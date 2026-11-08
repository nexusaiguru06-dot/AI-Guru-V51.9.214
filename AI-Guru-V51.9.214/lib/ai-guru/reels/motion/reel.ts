/**
 * A reel = one or more motion scenes played back to back (e.g. chapter intro →
 * worked example). Also: the single entry point that turns a request
 * ("478 + 356", "1260 ÷ 12", a branch example, a planner derivation) into a reel.
 */

import { buildExplainer } from '../explainer/build';
import { pickBi, type XScript } from '../explainer/script';
import { withStepPause, withVoice, type MotionScene, type SfxEvent } from './engine';
import type { Lang } from './captions';
import { buildAddition } from './recipes/addition';
import { buildSubtraction } from './recipes/subtraction';
import { buildMultiplication } from './recipes/multiplication';
import { buildDivision } from './recipes/division';
import { buildDerivation, type DerivationInput } from './recipes/derivation';
import { buildIntro, type IntroInput } from './recipes/intro';
import { BRANCH_CAPTIONS_ML, BRANCH_EXAMPLES, BRANCH_NOTES_ML, withCaptions } from './recipes/branches';
import { verifyDerivation, type Vars } from './verify';
import { buildStory, pick, type StoryBoard } from './recipes/story';

export interface MotionReel {
  title: string;
  parts: MotionScene[];
  durationMs: number;
}

export function makeReel(title: string, parts: MotionScene[]): MotionReel {
  return { title, parts, durationMs: parts.reduce((s, p) => s + p.durationMs, 0) };
}

/** Which part is on screen at reel time t, and the local time inside it. */
export function reelPartAt(reel: MotionReel, t: number): { scene: MotionScene; t: number; stepOffset: number } {
  let start = 0;
  let steps = 0;
  for (let i = 0; i < reel.parts.length; i++) {
    const p = reel.parts[i];
    if (i > 0 && p.group !== reel.parts[i - 1].group) steps = 0;
    if (t < start + p.durationMs || i === reel.parts.length - 1) return { scene: p, t: Math.max(0, t - start), stepOffset: steps };
    start += p.durationMs;
    steps += p.captions.length;
  }
  throw new Error('empty reel');
}

export function reelSfx(reel: MotionReel): SfxEvent[] {
  const out: SfxEvent[] = [];
  let start = 0;
  for (const p of reel.parts) {
    for (const e of p.sfx) out.push({ ...e, t: e.t + start });
    start += p.durationMs;
  }
  return out;
}

/* ---------------- requests ---------------- */

export type ReelRequest =
  | { kind: 'arithmetic'; text: string; lang?: Lang }
  | { kind: 'branch'; id: string; lang?: Lang }
  | { kind: 'derivation'; input: DerivationInput; solutions?: Vars[]; lang?: Lang }
  /** V51.9.118: a story told in pictured shots (history, literature, Malayalam stories). */
  | { kind: 'story'; board: StoryBoard; lang?: Lang }
  /** V51.9.124: a cinematic explainer (sentence by sentence over a moving picture). */
  | { kind: 'explainer'; script: XScript; lang?: Lang }
  /** V51.9.120: scenes built by the caller (a class part taken from the whiteboard), built inside buildReel so the voice times them. */
  | { kind: 'scenes'; title: string; build: () => MotionScene[]; lang?: Lang }
  | {
      kind: 'intro';
      intro: IntroInput;
      lang?: Lang;
      example?: { input: DerivationInput; solutions?: Vars[] } | { branchId: string; lang?: Lang };
    };

export function requestLang(req: ReelRequest): Lang {
  return req.lang ?? 'en';
}

export interface BuildOptions {
  /** Voice-over clip lengths (spoken text → ms). Steps stretch to fit each clip. */
  voiceMs?: (spoken: string) => number | undefined;
  /** Same content in the other language: its captions become the second caption line. */
  subtitleFrom?: ReelRequest;
  /** V51.9.136 — the speed controller: ms a finished step stays before the next one starts (0 = the app's pace). */
  stepPauseMs?: number;
}

/** Everything the voice must say, in order (feed this to TTS, then rebuild with voiceMs). */
export function voiceScript(reel: MotionReel): string[] {
  const out: string[] = [];
  for (const p of reel.parts) for (const c of p.captions) if (c.say && !out.includes(c.say)) out.push(c.say);
  return out;
}

export interface VoiceCue {
  t: number;
  ms: number;
  say: string;
}

/** Absolute voice cue times across all parts. */
export function reelVoiceCues(reel: MotionReel): VoiceCue[] {
  const out: VoiceCue[] = [];
  let start = 0;
  for (const p of reel.parts) {
    for (const c of p.captions) {
      if (c.say && c.voiceT0 !== undefined && c.voiceMs) out.push({ t: start + c.voiceT0, ms: c.voiceMs, say: c.say });
    }
    start += p.durationMs;
  }
  return out;
}

/**
 * V51.9.97 — steps that should speak but have no voice clip (the TTS failed for them),
 * as on-screen times. Empty when the reel has no voice-over at all (music-only reels).
 */
export function unvoicedSteps(reel: MotionReel, clips: { has(say: string): boolean; size: number } | null | undefined): number[] {
  if (!clips?.size) return [];
  const out: number[] = [];
  let start = 0;
  for (const p of reel.parts) {
    for (const c of p.captions) if (c.say && !clips.has(c.say)) out.push(start + c.t0);
    start += p.durationMs;
  }
  return out;
}

const NUM = String.raw`\d{1,7}`;

/** "478 + 356", "503-278", "347 x 26", "1260 / 12", "12 + 7 + 5" → operation. */
export function parseArithmetic(text: string):
  | { op: 'add'; nums: number[] }
  | { op: 'sub' | 'mul' | 'div'; a: number; b: number }
  | null {
  const s = text.replace(/[,\s]/g, '').replace(/=\??$/, '').replace(/[−–]/g, '-').replace(/[x*✕]/gi, '×').replace(/[/:]/g, '÷');
  if (new RegExp(`^${NUM}(\\+${NUM})+$`).test(s)) return { op: 'add', nums: s.split('+').map(Number) };
  const m = new RegExp(`^(${NUM})([-×÷])(${NUM})$`).exec(s);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[3]);
  return { op: m[2] === '-' ? 'sub' : m[2] === '×' ? 'mul' : 'div', a, b };
}

/** Limits that keep a reel under ~60 s and readable on a phone. */
export function arithmeticLimitError(text: string): string | null {
  const p = parseArithmetic(text);
  if (!p) return 'Type a sum like 478 + 356, 503 − 278, 347 × 26 or 1260 ÷ 12.';
  if (p.op === 'add' && (p.nums.length > 4 || p.nums.some((n) => n > 999999))) return 'Up to 4 numbers, 6 digits each.';
  if (p.op === 'sub' && Math.max(p.a, p.b) > 9999999) return 'Up to 7 digits.';
  if (p.op === 'mul' && (String(p.a).length > 4 || String(p.b).length > 3)) return 'Up to 4 digits × 3 digits.';
  if (p.op === 'div' && (p.b === 0 || String(p.a).length > 6 || String(p.b).length > 2)) return 'Up to 6 digits ÷ 2 digits (not 0).';
  return null;
}

function branchInput(id: string, lang: Lang = 'en') {
  const ex = BRANCH_EXAMPLES.find((e) => e.id === id);
  if (!ex) throw new Error(`Unknown example "${id}"`);
  return {
    input: withCaptions(ex.input, lang === 'ml' ? BRANCH_CAPTIONS_ML[id] : undefined, lang === 'ml' ? BRANCH_NOTES_ML[id] : undefined),
    solutions: ex.solutions,
  };
}

/** Refuse to publish a video whose maths is wrong. */
function checked(input: DerivationInput, solutions?: Vars[]): DerivationInput {
  if (solutions) {
    const bad = verifyDerivation(input, solutions).filter((r) => !r.ok);
    if (bad.length) throw new Error(`Maths check failed on line ${bad.map((b) => b.line + 1).join(', ')}`);
  }
  return input;
}

export function buildReel(req: ReelRequest, opts: BuildOptions = {}): MotionReel {
  if (opts.stepPauseMs && opts.stepPauseMs > 0) return withStepPause(opts.stepPauseMs, () => buildReel(req, { ...opts, stepPauseMs: 0 }));
  const reel = withVoice({ lang: requestLang(req), clipMs: opts.voiceMs ?? (() => undefined) }, () => buildParts(req));
  if (opts.subtitleFrom) {
    const other = buildParts(opts.subtitleFrom);
    reel.parts.forEach((p, i) => {
      const q = other.parts[i];
      if (!q || q.captions.length !== p.captions.length) return;
      p.captions.forEach((c, k) => {
        if (q.captions[k].text !== c.text) c.sub = q.captions[k].text;
      });
    });
  }
  return reel;
}

function buildParts(req: ReelRequest): MotionReel {
  switch (req.kind) {
    case 'arithmetic': {
      const err = arithmeticLimitError(req.text);
      if (err) throw new Error(err);
      const p = parseArithmetic(req.text)!;
      const lang = req.lang ?? 'en';
      const scene =
        p.op === 'add'
          ? buildAddition(p.nums, lang)
          : p.op === 'sub'
            ? buildSubtraction(p.a, p.b, lang)
            : p.op === 'mul'
              ? buildMultiplication(p.a, p.b, lang)
              : buildDivision(p.a, p.b, lang);
      return makeReel(scene.title, [scene]);
    }
    case 'branch': {
      const { input, solutions } = branchInput(req.id, req.lang);
      const scene = buildDerivation(checked(input, solutions));
      return makeReel(scene.title, [scene]);
    }
    case 'derivation': {
      const scene = buildDerivation(checked(req.input, req.solutions));
      return makeReel(scene.title, [scene]);
    }
    case 'intro': {
      const parts = [buildIntro(req.intro)];
      if (req.example) {
        const ex = 'branchId' in req.example ? branchInput(req.example.branchId, req.example.lang ?? req.lang) : req.example;
        parts.push(buildDerivation(checked(ex.input, ex.solutions)));
      }
      return makeReel(req.intro.title, parts);
    }
    case 'scenes':
      return makeReel(req.title, req.build());
    case 'explainer':
      return makeReel(pickBi(req.script.title, req.lang ?? 'en') || 'Explainer', buildExplainer(req.script, req.lang ?? 'en'));
    case 'story':
      return makeReel(pick(req.board.title, req.lang ?? 'en') || 'Story', buildStory(req.board, req.lang ?? 'en'));
  }
}
