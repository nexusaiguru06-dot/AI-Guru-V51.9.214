import type {
  MathVisualNode,
  SemanticMathObjectKind,
  SemanticMathRelation,
  SemanticVisualGraph,
  SemanticVisualPlan,
} from './types';

function objectKind(node: MathVisualNode): SemanticMathObjectKind {
  switch (node.kind) {
    case 'latex': return 'term';
    case 'point': return 'point';
    case 'line': return 'line';
    case 'shape': return 'shape';
    case 'graph': return 'graph';
    case 'arrow': return 'vector';
    default: return 'label';
  }
}

/**
 * Pass 1: convert the visual scene into a small semantic dependency graph.
 * This graph is planning metadata only; it never replaces the AI Guru renderer.
 */
export function buildSemanticVisualGraph(
  nodes: MathVisualNode[],
  plan: SemanticVisualPlan,
): SemanticVisualGraph {
  const graphNodes = nodes.map(node => {
    const object = plan.objects.find(item => item.visualNodeId === node.id);
    return {
      id: `graph:${node.id}`,
      objectId: object?.id ?? `object:${node.id}`,
      kind: object?.kind ?? objectKind(node),
      value: object?.value ?? node.latex ?? node.content,
      visualNodeId: node.id,
      role: object?.role,
    };
  });

  const nodeByVisualId = new Map(graphNodes.map(node => [node.visualNodeId, node.id]));
  const edges = plan.relations.map(relation => {
    const from = graphNodes.find(node => node.objectId === relation.from);
    const to = graphNodes.find(node => node.objectId === relation.to);
    return {
      id: `edge:${relation.id}`,
      from: from?.id ?? relation.from,
      to: to?.id ?? relation.to,
      relation: relation.relation,
    };
  });

  // Every construction step creates an explicit dependency edge. This is what
  // makes the second pass deterministic instead of relying on array order.
  for (const step of plan.steps) {
    const creates = step.actions
      .filter(action => action.type === 'create')
      .map(action => action.objectId)
      .map(objectId => graphNodes.find(node => node.objectId === objectId)?.id)
      .filter((id): id is string => Boolean(id));

    for (let i = 1; i < creates.length; i++) {
      edges.push({
        id: `construction:${step.id}:${i}`,
        from: creates[i - 1],
        to: creates[i],
        relation: 'derived-from',
      });
    }
  }

  const connected = new Set(edges.flatMap(edge => [edge.to]));
  const roots = graphNodes.filter(node => !connected.has(node.id)).map(node => node.id);
  const constructionOrder = plan.steps.flatMap(step =>
    step.actions
      .filter(action => action.type === 'create')
      .map(action => graphNodes.find(node => node.objectId === action.objectId)?.id)
      .filter((id): id is string => Boolean(id)),
  );

  // Remove accidental duplicate IDs while preserving first occurrence.
  return {
    schemaVersion: '1.0',
    nodes: graphNodes,
    edges: edges.filter((edge, index, list) =>
      list.findIndex(item => item.id === edge.id) === index &&
      nodeByVisualId.has(graphNodes.find(node => node.id === edge.from)?.visualNodeId ?? ''),
    ),
    roots,
    constructionOrder: [...new Set(constructionOrder)],
  };
}
