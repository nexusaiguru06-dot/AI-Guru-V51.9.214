/**
 * Class lint (V51.9.50): fast checks that catch, before anyone watches a class,
 *   - broken names: a plan's DNA, a learned template's segments, or a question's step that does not exist;
 *   - missing audio: steps that should speak but have no voice clip;
 *   - stale narration: a class whose timing was built for a different recording, or whose prepared
 *     captions no longer match the plan (an edited plan reusing an old prepared segment);
 *   - language leaks: English left in the Malayalam pass, or a Malayalam caption identical to English.
 * Pure (no DOM, no network): runs in the Motion Class page and from `npm run lint:class`.
 */

import { clipMs, type VoiceClips } from '../reels/motion/audio';
import type { MotionReel } from '../reels/motion/reel';
import { DNA_BY_ID } from './dna/registry';
import { getLearned, type LearnedDna } from './dna/learned';
import type { BlockPlan, CompositePlan } from './dna/types';
import { segmentReel, type ClassSegment } from './class';
import { validatePlan } from './plan/validate';
import { bilingualPairs } from './plan/qa';
import { pickBi, questionsForPlan, type PlacedQuestion } from './interactive/questions';
import { SKETCH_DNA } from './dna/sketch-math';
import { wordingProblems } from './plan/wording';

export type LintLevel = 'error' | 'warn';

export interface LintIssue {
  level: LintLevel;
  code: 'broken-name' | 'invalid-plan' | 'missing-audio' | 'stale-narration' | 'ml-leak' | 'ml-untranslated' | 'question-unplaced' | 'empty-caption' | 'wording';
  where: string;
  message: string;
}

const ML = /[ഀ-ൿ]/;
const LATIN_WORDS = /(?:[A-Za-z]{3,}\s+){2,}[A-Za-z]{3,}/;
const TIMING_TOLERANCE_MS = 120;

/** DNAs a composite (ai-custom / learned) segment may use. */
export const isSegmentDna = (id: string) => (DNA_BY_ID.has(id) && id !== 'bridge') || id === SKETCH_DNA;

const knownDna = (id: string) => DNA_BY_ID.has(id) || id === 'ai-custom' || id === SKETCH_DNA || (id.startsWith('learned:') && !!getLearned(id.slice(8)));

/* ---------------- plans ---------------- */

/** One planned block: names, structure (the app's own validator), language. */
export function lintPlan(blockId: string, plan: BlockPlan, o: { validate?: boolean } = {}): LintIssue[] {
  const out: LintIssue[] = [];
  const where = `${blockId} (${plan.dna})`;
  if (!knownDna(plan.dna)) {
    out.push({
      level: 'error',
      code: 'broken-name',
      where,
      message: plan.dna.startsWith('learned:') ? `Learned template "${plan.dna.slice(8)}" is not in this browser's library (import it, or plan the unit again).` : `Unknown DNA "${plan.dna}".`,
    });
    return out;
  }
  const c = plan.teach as CompositePlan | null;
  if ((plan.dna === 'ai-custom' || plan.dna.startsWith('learned:')) && Array.isArray(c?.segments)) {
    c!.segments.forEach((s, i) => {
      if (!isSegmentDna(s.dna)) out.push({ level: 'error', code: 'broken-name', where: `${where} segment ${i + 1}`, message: `Segment DNA "${s.dna}" does not exist.` });
    });
  }
  if (o.validate !== false && plan.dna !== 'bridge') {
    const needMl = !!plan.read?.ml;
    for (const e of validatePlan(plan.dna, plan.teach, plan.read, needMl).slice(0, 4)) out.push({ level: 'error', code: 'invalid-plan', where, message: e });
  }
  for (const p of bilingualPairs(plan.teach)) {
    const en = p.en.trim();
    const ml = p.ml.trim();
    if (!ml) continue;
    if (!ML.test(ml) && LATIN_WORDS.test(ml)) out.push({ level: 'warn', code: 'ml-leak', where: `${where} ${p.path}`, message: `Malayalam caption is English: "${ml.slice(0, 60)}"` });
    else if (ml === en && /[A-Za-z]{4,}/.test(en)) out.push({ level: 'warn', code: 'ml-untranslated', where: `${where} ${p.path}`, message: `Malayalam caption is the English text unchanged: "${en.slice(0, 60)}"` });
  }
  for (const p of [...bilingualPairs(plan.teach), ...bilingualPairs(plan.arc, 'arc')]) {
    for (const msg of wordingProblems(p.en, p.ml, p.path)) out.push({ level: 'warn', code: 'wording', where, message: msg });
  }
  return out;
}

/** A learned template: its segments exist and its example still validates. */
export function lintLearned(d: LearnedDna): LintIssue[] {
  const out: LintIssue[] = [];
  const where = `learned:${d.id}`;
  for (const s of d.segments) if (!isSegmentDna(s)) out.push({ level: 'error', code: 'broken-name', where, message: `Segment DNA "${s}" does not exist.` });
  if (!out.length) for (const e of validatePlan('ai-custom', d.example, undefined, true).slice(0, 3)) out.push({ level: 'error', code: 'invalid-plan', where, message: `Example no longer valid: ${e}` });
  return out;
}

/* ---------------- a prepared class ---------------- */

export interface TimelineToLint {
  reel: MotionReel;
  clips: VoiceClips;
  steps: Array<{ index: number; t0: number; t1: number; text: string; segment: number }>;
  segments: Array<{ index: number; id: string; blockId: string; label: string; lang: string; phase: string }>;
}

export interface TimelineLintOptions {
  /** Voice was requested (steps without a clip are then "missing audio"). */
  voice?: boolean;
  /** The class segments as compiled from the current plans (finds stale prepared segments). */
  segments?: ClassSegment[];
  /** Current plans and placed questions (finds questions that could not be attached to a step). */
  plans?: Map<string, BlockPlan>;
  questions?: PlacedQuestion[];
}

export function lintTimeline(tl: TimelineToLint, o: TimelineLintOptions = {}): LintIssue[] {
  const out: LintIssue[] = [];
  // Captions part by part, with their segment.
  const stepSeg = tl.steps.map((s) => s.segment);
  let k = 0;
  const silent = new Map<number, number>();
  const stale = new Map<number, number>();
  for (const part of tl.reel.parts) {
    for (const c of part.captions) {
      const seg = stepSeg[k++] ?? 0;
      if (!c.text.trim()) out.push({ level: 'warn', code: 'empty-caption', where: tl.segments[seg]?.label ?? `segment ${seg}`, message: `Step ${k} has no caption.` });
      if (!c.say) continue;
      const clip = tl.clips.get(c.say);
      if (o.voice && !clip) silent.set(seg, (silent.get(seg) ?? 0) + 1);
      if (c.voiceMs && clip && Math.abs(clipMs(clip) - c.voiceMs) > TIMING_TOLERANCE_MS) stale.set(seg, (stale.get(seg) ?? 0) + 1);
      if (c.voiceMs && !clip) stale.set(seg, (stale.get(seg) ?? 0) + 1);
    }
  }
  for (const [seg, n] of silent) out.push({ level: 'warn', code: 'missing-audio', where: tl.segments[seg]?.label ?? `segment ${seg}`, message: `${n} step(s) have no voice clip and will be silent.` });
  for (const [seg, n] of stale) out.push({ level: 'error', code: 'stale-narration', where: tl.segments[seg]?.label ?? `segment ${seg}`, message: `${n} step(s) are timed for a different recording; prepare the class again.` });

  // Prepared captions vs the plan as it is now.
  if (o.segments) {
    const byId = new Map(o.segments.map((s) => [s.id, s]));
    for (const seg of tl.segments) {
      const cur = byId.get(seg.id);
      if (!cur) {
        out.push({ level: 'error', code: 'stale-narration', where: seg.label, message: `This part (${seg.id}) is no longer in the plan.` });
        continue;
      }
      let fresh: string[];
      try {
        fresh = segmentReel(cur).parts.flatMap((p) => p.captions.map((c) => c.text));
      } catch {
        continue;
      }
      const shown = tl.steps.filter((s) => s.segment === seg.index).map((s) => s.text);
      if (fresh.length !== shown.length || fresh.some((t, i) => t !== shown[i])) {
        const i = fresh.findIndex((t, j) => t !== shown[j]);
        out.push({ level: 'error', code: 'stale-narration', where: seg.label, message: `Captions differ from the current plan (first at step ${i + 1}: "${(shown[i] ?? '—').slice(0, 40)}" vs "${(fresh[i] ?? '—').slice(0, 40)}"); prepare the class again.` });
      }
    }
  }

  // Malayalam pass: English left in, or the English text unchanged.
  const enByBlock = new Map<string, string[]>();
  for (const seg of tl.segments) if (seg.lang === 'en') enByBlock.set(`${seg.blockId}|${seg.phase}`, tl.steps.filter((s) => s.segment === seg.index).map((s) => s.text));
  for (const seg of tl.segments) {
    if (seg.lang !== 'ml') continue;
    const en = enByBlock.get(`${seg.blockId}|${seg.phase}`) ?? [];
    const steps = tl.steps.filter((s) => s.segment === seg.index);
    let leak = 0;
    let same = 0;
    steps.forEach((s, i) => {
      if (!ML.test(s.text) && LATIN_WORDS.test(s.text)) {
        if (en[i] === s.text) same++;
        else leak++;
      }
    });
    if (leak) out.push({ level: 'warn', code: 'ml-leak', where: seg.label, message: `${leak} step(s) of the Malayalam pass are in English.` });
    if (same) out.push({ level: 'warn', code: 'ml-untranslated', where: seg.label, message: `${same} step(s) of the Malayalam pass repeat the English caption unchanged.` });
  }

  // Questions whose step could not be found (their caption changed): they would silently not be asked.
  if (o.plans) {
    const placed = new Set((o.questions ?? []).map((q) => q.id.replace(/:(en|ml)$/, '')));
    const firstTeach = new Map<string, (typeof tl.segments)[number]>();
    for (const seg of tl.segments) if (seg.phase === 'teach' && !firstTeach.has(seg.blockId)) firstTeach.set(seg.blockId, seg);
    for (const [blockId, seg] of firstTeach) {
      for (const q of questionsForPlan(blockId, o.plans.get(blockId))) {
        if (placed.has(q.id)) continue;
        const lang = seg.lang === 'ml' ? 'ml' : 'en';
        out.push({ level: 'warn', code: 'question-unplaced', where: seg.label, message: `Question "${pickBi(q.prompt, lang).slice(0, 50)}" has no step with the caption "${pickBi(q.after, lang).slice(0, 40)}".` });
      }
    }
  }
  return out;
}

export function lintSummary(issues: LintIssue[]): string {
  if (!issues.length) return 'Class check: no problems found.';
  const e = issues.filter((i) => i.level === 'error').length;
  const w = issues.length - e;
  return `Class check: ${e ? `${e} error(s)` : ''}${e && w ? ', ' : ''}${w ? `${w} warning(s)` : ''}.`;
}
