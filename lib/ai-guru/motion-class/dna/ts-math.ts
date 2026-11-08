/**
 * Typeset formula lines (V51.9.45): the rules for the `typeset-chain` DNA. A plan is a list of formulas
 * (written in the typesetter's LaTeX-like text) and how each one arrives: written fresh, turned from the
 * line before (symbols they share glide into place), added underneath, a part lit, or the line boxed.
 * The app lays every formula out (reels/motion/typeset.ts); the planner only writes the text.
 */

import { mathHasStructure, mathProblem } from '../../reels/motion/typeset';
import type { TsPlan } from './types';

export const TS_OPS = ['show', 'become', 'add', 'focus', 'box'];
export const TS_MAX_STEPS = 12;
export const TS_NOTE_MAX = 60;
export const TS_ROLES = ['a', 'b', 'c', 'carry', 'result', 'ink', 'accent'];

/** The reason a plan cannot be drawn, or null. */
export function tsProblem(plan: TsPlan, path: string): string | null {
  if (!plan || !Array.isArray(plan.steps) || !plan.steps.length) return `${path}.steps must list the steps (start with {"op":"show","tex":"…"}).`;
  if (plan.steps.length > TS_MAX_STEPS) return `${path}.steps has ${plan.steps.length} steps; use at most ${TS_MAX_STEPS}.`;
  if (plan.colors !== undefined) {
    if (!plan.colors || typeof plan.colors !== 'object' || Array.isArray(plan.colors)) return `${path}.colors must be an object like {"x":"a"}.`;
    const entries = Object.entries(plan.colors);
    if (entries.length > 6) return `${path}.colors has ${entries.length} entries; use at most 6.`;
    for (const [k, v] of entries) {
      if (!k || k.length > 3) return `${path}.colors key "${k}" must be 1–3 characters (the symbol).`;
      if (!TS_ROLES.includes(v as string)) return `${path}.colors.${k} must be one of ${TS_ROLES.join(', ')}.`;
    }
  }
  let have = false;
  for (let i = 0; i < plan.steps.length; i++) {
    const s = plan.steps[i];
    const at = `${path}.steps[${i}]`;
    if (!s || typeof s !== 'object') return `${at} is not an object.`;
    if (!TS_OPS.includes(s.op)) return `${at}.op "${s.op}" is not one of ${TS_OPS.join(', ')}.`;
    if (s.op === 'show' || s.op === 'become' || s.op === 'add') {
      if (typeof s.tex !== 'string') return `${at}.tex is required (the formula).`;
      const bad = mathProblem(s.tex);
      if (bad) return `${at}.tex: ${bad}.`;
      if (s.op !== 'show' && !have) return `${at}: "${s.op}" needs a formula on the board; start with "show".`;
      if (s.note && (s.note.en?.length ?? 0) > TS_NOTE_MAX) return `${at}.note.en is longer than ${TS_NOTE_MAX} characters.`;
      have = true;
    } else {
      if (!have) return `${at}: "${s.op}" needs a formula on the board; start with "show".`;
      if (s.op === 'focus' && (!Array.isArray(s.parts) || !s.parts.length || s.parts.length > 6 || s.parts.some((p) => typeof p !== 'string' || !p || p.length > 8))) return `${at}.parts must be 1–6 short strings (symbols or numbers already in the line).`;
    }
  }
  if (plan.steps[0].op !== 'show') return `${path}.steps[0] must be {"op":"show"}.`;
  const drawn = plan.steps.filter((s) => s.op === 'show' || s.op === 'become' || s.op === 'add') as Array<{ tex: string }>;
  if (!drawn.some((s) => mathHasStructure(s.tex))) return `${path}: no formula has a fraction, root, power, subscript or matrix; a plain equation is not worth typesetting (use the equation chain).`;
  return null;
}

/* ---------------- finding formulas in a textbook paragraph ---------------- */

const FUNC_WORDS = new Set(['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'log', 'ln', 'exp', 'lim', 'det', 'max', 'min', 'gcd', 'lcm', 'sqrt', 'frac']);
/** Two-letter English words that are not products of variables (ad, bc, ac …). */
const SHORT_WORDS = /^(by|is|of|if|in|on|to|as|at|we|so|or|an|it|be|no|do|us|me|my|up|go|he|am|the)$/i;
/** A formula worth typesetting: a square root, \frac or a matrix environment. (Numeric fractions belong to the fraction DNAs.) */
export const TS_FEATURE = /√|\\frac|\\dfrac|\\sqrt|\\begin\{[bpv]?matrix\}/;

/** Every `…=…` run in the text that has a root, \frac or matrix and parses; at most 4. */
export function findTsFormulas(text: string): string[] {
  const out: string[] = [];
  if (!TS_FEATURE.test(text) || !text.includes('=')) return out;
  const segments = text.split(/(?<=[.?!])\s+(?=[A-Z])|\n+|;\s+/);
  for (const seg of segments) {
    if (!seg.includes('=') || !TS_FEATURE.test(seg)) continue;
    const toks = seg.split(/\s+/).filter(Boolean);
    let run: string[] = [];
    const flush = () => {
      const f = run.join(' ').replace(/[.,:;?!]+$/, '').trim();
      run = [];
      if (f.length >= 3 && f.length <= 160 && f.includes('=') && TS_FEATURE.test(f) && !mathProblem(f)) out.push(f);
    };
    for (const tk of toks) {
      const bare = tk.replace(/[.,:;?!]$/, '');
      const word = /^[A-Za-z]+$/.test(bare) && !FUNC_WORDS.has(bare) && (bare.length >= 3 || SHORT_WORDS.test(bare));
      if (word) flush();
      else run.push(tk);
    }
    flush();
  }
  return [...new Set(out)].slice(0, 4);
}
