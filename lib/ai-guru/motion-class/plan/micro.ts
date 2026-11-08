/**
 * V51.9.59 — the micro class: a short class the AI makes from a student's doubt ("what is cross multiplication?"),
 * on the same engine as every other class. Nothing here draws or computes; the AI fills a plan and the app validates
 * and animates it as usual. The AI is NOT held to one template: it may use any built-in DNA, compose several, or draw
 * a free sketch when nothing fits. Micro classes are never saved as learned templates or sketch candidates.
 */

import type { BookBlock } from '../segment';
import type { DnaSelection } from '../dna/types';
import { aiPlanBlock, SKETCH_GUIDE, type AiPlanResult, type Llm, type PlanContext } from './ai';

export interface MicroRequest {
  /** The student's doubt in their own words. */
  doubt: string;
  /** What the teacher had just said or what was on the board when the doubt came. */
  nowOnBoard?: string;
  /** Text of the problem or section being taught. */
  lessonText?: string;
  chapterTitle: string;
  sectionTitle: string;
  grade?: string;
}

const clip = (s: string, n: number) => s.replace(/\s+/g, ' ').trim().slice(0, n);

export function microBlock(doubt: string, id = `micro${Date.now().toString(36)}`): BookBlock {
  const text = clip(doubt, 400);
  return { id, kind: 'prose', page: 0, chapterId: 'micro', sectionId: 'micro', lines: [{ text, math: false }], text };
}

/** The AI may use anything: the selection says "no template is forced". */
export const MICRO_SELECTION: DnaSelection = { dna: 'ai-sketch', score: 0, mandatory: true, needsAi: true, ranked: [], reason: "a student's doubt: no template is forced" };

export function microTask(r: MicroRequest): string {
  return `THIS IS NOT TEXTBOOK TEXT: it is a STUDENT'S DOUBT, asked while the class was running. Make a SHORT micro class (3–6 steps, under about a minute) that clears exactly this doubt.
${r.nowOnBoard ? `WHAT WAS ON THE BOARD / BEING SAID WHEN THE DOUBT CAME: ${clip(r.nowOnBoard, 700)}\n` : ''}${r.lessonText ? `THE LESSON THE STUDENT IS IN (use its numbers when you show an example, so the doubt links back to it): ${clip(r.lessonText, 1200)}\n` : ''}You are FREE in how you teach it — no template is forced:
 1. Use ANY built-in DNA from the catalogue if one shows the idea well: {"dna":"<id>","teach":{plan for that DNA}}.
 2. Or compose several built-in DNAs in teaching order: {"dna":"ai-custom","newDna":{"name":"...","description":"...","keywords":[]},"teach":{"segments":[{"dna":"<id>","plan":{...}}]}}.
 3. Or, when the picture you need is not in the catalogue (or the doubt is a word/idea better shown with a small drawing), draw a free sketch: {"dna":"ai-sketch","newDna":{"name":"...","description":"...","keywords":[]},"teach":{sketch plan}}.
${SKETCH_GUIDE}
Teach the IDEA in simple words first (what the word or step means), then ONE small worked example with real numbers, then link back to the problem the class was solving. Keep every number true and checkable.
"read" is a short restatement of the doubt as a question: read.en (≤ 14 words) and read.ml (Malayalam). Return {"dna":...,"read":{"en","ml"},"teach":{...}}.`;
}

/** Plan a micro class. The result's plan is only worth playing when plan.source === 'ai'. */
export async function microClassPlan(r: MicroRequest, llm: Llm, o: { maxAttempts?: number } = {}): Promise<AiPlanResult & { block: BookBlock }> {
  const block = microBlock(r.doubt);
  const ctx: PlanContext = { grade: r.grade, chapterTitle: r.chapterTitle, sectionTitle: r.sectionTitle };
  const res = await aiPlanBlock(block, ctx, llm, { maxAttempts: o.maxAttempts ?? 3, selection: MICRO_SELECTION, task: microTask(r), ephemeral: true });
  return { ...res, block };
}
