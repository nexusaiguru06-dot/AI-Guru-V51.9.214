/**
 * Quality gate for a plan that already passed validation (V51.9.41). The validator proves the
 * structure and the maths; this checks what the viewer would actually meet:
 *   - layout: no written text overlaps another or leaves the board at any step (for the DNAs whose
 *     layouts are tested for it),
 *   - pace: a spoken caption is a few seconds, not a paragraph, and the unit is not endless,
 *   - language: the Malayalam caption is not English with a few Malayalam words around it,
 *   - variety: the same caption is not repeated on step after step.
 * Every problem is a sentence the AI can act on; the planner sends them back and asks again.
 */

import { evalItem } from '../../reels/motion';
import { tokenWidth } from '../../reels/motion/metrics';
import { buildDnaScenes } from '../dna/builders';
import type { Bi } from '../dna/types';
import { timelineProblems } from './timeline-qa';
import { wordingProblems } from './wording';

/** DNAs whose builders are tested to keep text apart at every step, so overlap is a real defect. */
export const LAYOUT_QA_DNAS = new Set<string>([
  'angle-geometry', 'area-figure', 'arithmetic-sequence', 'coordinate-geometry', 'fraction-line', 'linear-system',
  'matrix-ops', 'pie-chart', 'polynomial', 'quadratic-equation', 'ratio-percent', 'solid-figure', 'square-identity', 'balance-scale', 'balance-pair', 'typeset-chain', 'quadratic-derivation', 'hcf-lcm', 'concept-board',
]);

export const CAPTION_MAX_WORDS_EN = 40;
export const CAPTION_MAX_WORDS_ML = 60;
export const UNIT_MAX_MS = 4 * 60 * 1000;
const ML_SCRIPT = /[ഀ-ൿ]/;
const MAX_PROBLEMS = 6;

interface Pair { path: string; en: string; ml: string }

/** Every {en, ml} pair in a plan, with where it was found. */
export function bilingualPairs(x: unknown, path = 'teach', out: Pair[] = []): Pair[] {
  if (!x || typeof x !== 'object') return out;
  if (Array.isArray(x)) { x.forEach((v, i) => bilingualPairs(v, `${path}[${i}]`, out)); return out; }
  const o = x as Record<string, unknown>;
  if (typeof o.en === 'string' && typeof o.ml === 'string') { out.push({ path, en: o.en, ml: o.ml }); return out; }
  for (const [k, v] of Object.entries(o)) bilingualPairs(v, `${path}.${k}`, out);
  return out;
}

const words = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length;

/** Pace and language problems. `read` is the textbook text and is allowed to be long. */
export function qaCaptions(teach: unknown): string[] {
  const problems: string[] = [];
  const pairs = bilingualPairs(teach);
  for (const p of pairs) {
    const wen = words(p.en);
    const wml = words(p.ml);
    if (wen > CAPTION_MAX_WORDS_EN) problems.push(`${p.path}.en is ${wen} words; a spoken caption is one idea of 6–22 words (never more than ${CAPTION_MAX_WORDS_EN}). Split it over more steps or shorten it.`);
    else if (wml > CAPTION_MAX_WORDS_ML) problems.push(`${p.path}.ml is ${wml} words; shorten the Malayalam caption (at most ${CAPTION_MAX_WORDS_ML} words).`);
    if (ML_SCRIPT.test(p.ml) && /(?:[A-Za-z]{3,}\s+){3,}[A-Za-z]{3,}/.test(p.ml)) problems.push(`${p.path}.ml mixes a whole English phrase into the Malayalam; translate it ("${p.ml.slice(0, 60)}…").`);
    // V51.9.51: no "obviously / clearly / it follows", and spoken sentences short enough to follow by ear.
    problems.push(...wordingProblems(p.en, p.ml, p.path));
  }
  const seen = new Map<string, number>();
  for (const p of pairs) { const k = p.en.trim().toLowerCase(); if (k.length > 12) seen.set(k, (seen.get(k) ?? 0) + 1); }
  for (const [k, n] of seen) if (n >= 3) problems.push(`The caption "${k.slice(0, 50)}" is repeated ${n} times; each step needs its own sentence.`);
  return problems;
}

/** Overlap and out-of-board problems at the end of every caption step. */
export function qaLayout(dna: string, teach: unknown): string[] {
  if (!LAYOUT_QA_DNAS.has(dna)) return [];
  const problems: string[] = [];
  let scenes;
  try { scenes = buildDnaScenes(dna as never, teach as never, 'en', 'qa'); } catch { return []; }
  const add = (msg: string) => { if (!problems.includes(msg) && problems.length < MAX_PROBLEMS) problems.push(msg); };
  for (const sc of scenes) {
    if (sc.durationMs > UNIT_MAX_MS) add(`The unit runs ${Math.round(sc.durationMs / 1000)} seconds; keep a unit under ${UNIT_MAX_MS / 1000} seconds by using fewer steps.`);
    for (let k = 0; k < sc.captions.length; k++) {
      const time = sc.captions[k].t1 - 40;
      const st = sc.items.filter((it) => it.kind === 'text').map((it) => evalItem(it, time)).filter((s) => s.alpha > 0.5).map((q) => {
        const w = tokenWidth(q.text, q.size);
        return { q, l: q.x - w / 2, r: q.x + w / 2 };
      });
      for (const b of st) if (b.l < 2 || b.r > 718) add(`At step ${k + 1} the text "${b.q.text}" runs off the board; use smaller or fewer values so the picture fits.`);
      for (let i = 0; i < st.length; i++) for (let j = i + 1; j < st.length; j++) {
        if (Math.abs(st[i].q.y - st[j].q.y) > 14) continue;
        const gap = Math.max(st[i].l, st[j].l) - Math.min(st[i].r, st[j].r);
        if (gap < -1.5) add(`At step ${k + 1} the texts "${st[i].q.text}" and "${st[j].q.text}" overlap; choose values or fewer items so the picture stays clear.`);
      }
    }
  }
  for (const p of timelineProblems(scenes)) add(p);
  return problems;
}

/** All quality problems for a plan that passed validation; empty when it is good to show. */
export function qaPlan(dna: string, teach: unknown, read?: Bi): string[] {
  const problems = [...qaCaptions(teach), ...qaLayout(dna, teach)];
  if (read?.ml && !ML_SCRIPT.test(read.ml) && /[A-Za-z]{4,}/.test(read.en ?? '')) problems.push('read.ml is not in Malayalam script.');
  return problems.slice(0, MAX_PROBLEMS);
}
