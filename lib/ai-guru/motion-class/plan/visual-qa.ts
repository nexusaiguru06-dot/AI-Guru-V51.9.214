/**
 * Visual QA for a built board: is there a real picture, or only text?
 *
 * "Graphics" = anything the viewer SEES as a drawing (curves, lines, grids, vectors, shapes,
 * dots). A board that is only words and numbers (a heading with an underline, key terms on a
 * card) is "text-only". Text-only boards are allowed for headings and bridges, but every other
 * unit gets a warning so the teacher (and the planner) can see where the 3Blue1Brown look is
 * still missing.
 */

import { sceneStateAt, type MotionScene } from '../../reels/motion/engine';
import type { BlockPlan, DnaId } from '../dna/types';
import { buildDnaScenes } from '../dna/builders';

export interface VisualStats {
  /** Number of drawn (non-text) items. */
  graphics: number;
  /** Number of text items. */
  texts: number;
  /** Share (0..1) of the running time during which at least one drawing is visible. */
  graphicShare: number;
  textOnly: boolean;
}

const DRAWN = new Set(['poly', 'line', 'vec', 'dot', 'arrow', 'region']);

export function visualStats(scenes: MotionScene[]): VisualStats {
  let graphics = 0;
  let texts = 0;
  let total = 0;
  let withGraphic = 0;
  for (const sc of scenes) {
    for (const it of sc.items) {
      if (DRAWN.has(it.kind)) graphics++;
      else if (it.kind === 'text') texts++;
    }
    const N = 24;
    for (let i = 0; i < N; i++) {
      const t = ((i + 0.5) / N) * sc.durationMs;
      total++;
      if (sceneStateAt(sc, t).some((s) => DRAWN.has(s.kind) && s.alpha > 0.5 && (s.draw ?? 1) > 0.5)) withGraphic++;
    }
  }
  const graphicShare = total ? withGraphic / total : 0;
  // One underline or a couple of rules is not a picture.
  return { graphics, texts, graphicShare, textOnly: graphics < 3 || graphicShare < 0.45 };
}

/** DNAs that are allowed to be text boards (nothing to draw, or read-only). */
const TEXT_OK: DnaId[] = ['bridge', 'section-intro'];

/** DNAs whose picture is typeset maths: the grid of entries inside brackets, or the fraction bars and root signs (the plan check requires some structure), is the drawing. */
const GRID_PICTURE: DnaId[] = ['matrix-grid', 'typeset-chain'];
/**
 * V51.9.136 — DNAs with a picture page AND a long typeset working page (the pair of linear equations: the graph, then
 * every small step of the algebra on its own page). Most of their time is the working, so only the picture itself is
 * required, not a share of the time.
 */
const WORKED_PICTURE: DnaId[] = ['linear-system'];

/** A readable warning when a unit's teaching board has no real picture; undefined when fine. */
export function textOnlyWarning(plan: Pick<BlockPlan, 'dna' | 'teach'>): string | undefined {
  if (TEXT_OK.includes(plan.dna) || GRID_PICTURE.includes(plan.dna) || !plan.teach) return undefined;
  // Idea cards are a tidy way to show words, not a picture of the idea: still flagged. A pyramid or two columns carry structure.
  if (plan.dna === 'concept-board' && ((plan.teach as { layout?: string }).layout ?? 'cards') === 'cards') {
    return 'Text-only board (idea cards): no graphic DNA fits this unit yet — choose or create one, or use a pyramid / two-column layout if the ideas have that shape.';
  }
  try {
    const stats = visualStats(buildDnaScenes(plan.dna, plan.teach, 'en', 'qa'));
    if (!stats.textOnly || (WORKED_PICTURE.includes(plan.dna) && stats.graphics >= 3)) return undefined;
    return `Text-only board (${stats.graphics} drawings, picture on screen ${Math.round(stats.graphicShare * 100)}% of the time): no graphic DNA fits this unit yet — choose or create one.`;
  } catch {
    return undefined;
  }
}
