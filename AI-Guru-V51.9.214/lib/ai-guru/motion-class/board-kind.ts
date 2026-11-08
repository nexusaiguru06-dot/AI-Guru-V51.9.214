/**
 * V51.9.56 — which board teaches a part of the lesson.
 *
 * Two boards: the LECTURE board (what the topic means, why it matters, the Malayalam retelling — no problem,
 * no formula) and the PROBLEM board (anything worked out step by step: equations, tables, graphs, figures).
 * Problems are the part a student replays, so each problem run can be saved as its own MP4.
 *
 * The split is a rule on the DNA the selector already chose; nothing here draws or computes.
 */

import type { BlockPlan } from './dna/types';
import type { BookBlock } from './segment';

export type BoardKind = 'lecture' | 'problem';

/** DNAs that only talk and show pictures. Everything else is worked out step by step. */
const LECTURE_DNAS = new Set<string>(['bridge', 'section-intro', 'concept-board', 'ai-sketch', 'chapter-intro']);

export function boardKindOf(plan: BlockPlan | undefined): BoardKind {
  if (!plan) return 'lecture';
  return LECTURE_DNAS.has(plan.dna) ? 'lecture' : 'problem';
}

export interface BoardRun {
  kind: BoardKind;
  blocks: BookBlock[];
}

/**
 * Consecutive blocks of the same kind form one run. A bridge sentence ("Let's start with a problem:") is read
 * together with the block after it, so it goes to that block's board.
 */
export function splitRuns(blocks: BookBlock[], plans: Map<string, BlockPlan>): BoardRun[] {
  const kinds: BoardKind[] = blocks.map((b) => boardKindOf(plans.get(b.id)));
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (plans.get(blocks[i].id)?.dna === 'bridge') kinds[i] = i + 1 < blocks.length ? kinds[i + 1] : 'lecture';
  }
  const runs: BoardRun[] = [];
  blocks.forEach((b, i) => {
    const last = runs[runs.length - 1];
    if (last && last.kind === kinds[i]) last.blocks.push(b);
    else runs.push({ kind: kinds[i], blocks: [b] });
  });
  return runs;
}
