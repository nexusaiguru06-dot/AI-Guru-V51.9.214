import type { MathVisualEvent, MathVisualNode, UniversalMathScene } from '../universal/types';
import { sceneDurationMs } from '../animation/runtime';
import type { ManimWebRenderPlan } from './types';
import { tokenizeLatexForAnimation } from './tokenize';

/**
 * Preflight the canonical AI Guru scene before handing it to manim-web.
 * The renderer is deliberately a consumer of Scene IR; it never changes
 * pedagogy, mathematics, RAG evidence or Video-DNA selection.
 */
export function buildManimWebRenderPlan(scene: UniversalMathScene): ManimWebRenderPlan {
  const supported = new Set<MathVisualNode['kind']>([
    'text', 'latex', 'line', 'shape', 'point', 'arrow', 'highlight',
    'transform', 'erase', 'token-move', 'graph', 'plot', 'grid',
    'numberLine', 'vector', 'arc', 'sector', 'matrix', 'barChart', 'sampleSpace',
  ]);
  const unsupportedKinds = [...new Set(scene.nodes.filter(n => !supported.has(n.kind)).map(n => n.kind))];
  const events = [...scene.events].sort((a, b) => a.atMs - b.atMs);
  const count = (kind: MathVisualEvent['kind']) => events.filter(e => e.kind === kind).length;
  const nodeById = new Map(scene.nodes.map(n => [n.id, n]));
  const tokenTransformCount = events.filter(e => e.kind === 'transform' && e.fromObjectId && e.toObjectId).filter(e => {
    const from = nodeById.get(e.fromObjectId!);
    const to = nodeById.get(e.toObjectId!);
    if (!from || !to || !['latex','transform'].includes(from.kind) || !['latex','transform'].includes(to.kind)) return false;
    return (from.tokenParts?.length ?? tokenizeLatexForAnimation(from.latex ?? from.content ?? '').length) > 1 &&
      (to.tokenParts?.length ?? tokenizeLatexForAnimation(to.latex ?? to.content ?? '').length) > 1;
  }).length;
  const tokenMoveCount = (scene.visualActions ?? []).filter(a => a.type === 'token-move').length;
  const warnings: string[] = [];
  if (!scene.verified) warnings.push('Scene is not math-verified; renderer will still display it only because the upstream route allowed it.');
  if (!events.some(e => e.kind === 'transform')) warnings.push('No transform event exists; this lesson may not yet have 3B1B-style mathematical motion.');
  if (events.some(e => e.kind === 'transform') && tokenTransformCount === 0) warnings.push('Equation transform exists but no multipart token decomposition was detected.');
  if (!events.some(e => e.kind === 'highlight' || e.kind === 'recolor')) warnings.push('No emphasis event exists; consider adding highlight/recolor beats.');
  if (unsupportedKinds.length) warnings.push(`Unsupported node kinds will use a text fallback: ${unsupportedKinds.join(', ')}`);
  return {
    scene,
    durationMs: sceneDurationMs(scene),
    visualObjectCount: scene.nodes.length,
    transformCount: count('transform'),
    createCount: count('draw'),
    highlightCount: count('highlight') + count('recolor'),
    tokenTransformCount,
    tokenMoveCount,
    unsupportedKinds,
    warnings,
  };
}
