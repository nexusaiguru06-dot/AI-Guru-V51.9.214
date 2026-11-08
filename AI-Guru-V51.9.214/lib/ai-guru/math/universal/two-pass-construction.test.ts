import { describe, expect, it } from 'vitest';
import { buildSemanticVisualGraph } from './semantic-graph';
import { buildTwoPassConstructionPlan } from './two-pass-construction';

describe('AI Guru two-pass visual construction', () => {
  it('keeps semantic planning separate from rendering', () => {
    const nodes = [
      { id: 'expr', kind: 'latex' as const, latex: 'x+1=2' },
      { id: 'result', kind: 'latex' as const, latex: 'x=1' },
    ];
    const plan = {
      objects: [
        { id: 'object:expr', kind: 'term' as const, value: 'x+1=2', visualNodeId: 'expr', role: 'given' as const },
        { id: 'object:result', kind: 'result' as const, value: 'x=1', visualNodeId: 'result', role: 'result' as const },
      ],
      relations: [
        { id: 'r1', from: 'object:result', to: 'object:expr', relation: 'derived-from' as const },
      ],
      steps: [
        { id: 's1', narrationKey: 'construct-given', actions: [{ type: 'create' as const, objectId: 'object:expr' }] },
        { id: 's2', narrationKey: 'transform-step', actions: [{ type: 'create' as const, objectId: 'object:result' }] },
      ],
    };
    const graph = buildSemanticVisualGraph(nodes, plan);
    const construction = buildTwoPassConstructionPlan(graph, ['s1', 's2']);
    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges.length).toBeGreaterThan(0);
    expect(construction.pass2.executable).toBe(true);
  });
});
