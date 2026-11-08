import type { SemanticVisualGraph, VisualConstructionPlan } from './types';

/**
 * Pass 2: turn the semantic graph/plan into an executable construction contract.
 * The existing AI Guru Visual Compiler remains the renderer source of truth.
 */
export function buildTwoPassConstructionPlan(
  graph: SemanticVisualGraph,
  stepIds: string[],
): VisualConstructionPlan {
  const warnings: string[] = [];
  const graphIds = new Set(graph.nodes.map(node => node.id));
  const seen = new Set<string>();

  for (const id of graph.constructionOrder) {
    if (!graphIds.has(id)) warnings.push(`Construction references missing graph node: ${id}`);
    if (seen.has(id)) warnings.push(`Construction node repeated: ${id}`);
    seen.add(id);
  }

  if (!graph.nodes.length) warnings.push('Semantic graph contains no nodes.');
  if (!graph.roots.length && graph.nodes.length) warnings.push('Semantic graph has no root node.');
  if (!stepIds.length && graph.nodes.length) warnings.push('Semantic graph has nodes but no construction steps.');

  return {
    schemaVersion: '1.0',
    pass1: { graphNodeCount: graph.nodes.length, graphEdgeCount: graph.edges.length },
    pass2: {
      stepIds: [...new Set(stepIds)],
      executable: warnings.length === 0,
      warnings,
    },
  };
}
