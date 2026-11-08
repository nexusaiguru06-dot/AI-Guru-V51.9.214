import { describe, expect, it } from 'vitest';
import { buildManimWebRenderPlan } from './plan';
import type { UniversalMathScene } from '../universal/types';

const scene: UniversalMathScene = {
  schemaVersion: '1.0', id: 'test', domain: 'linear_equations', gradeBand: '6-8',
  title: 'Equation', expression: 'x+1=2', verified: true,
  nodes: [
    { id: 'eq1', kind: 'latex', x: 100, y: 250, width: 400, height: 80, latex: 'x+1=2' },
    { id: 'eq2', kind: 'latex', x: 100, y: 350, width: 400, height: 80, latex: 'x=1' },
  ],
  events: [
    { id: 'e1', atMs: 0, durationMs: 900, kind: 'draw', targetId: 'eq1' },
    { id: 'e2', atMs: 1000, durationMs: 900, kind: 'transform', targetId: 'eq2', fromObjectId: 'eq1', toObjectId: 'eq2' },
    { id: 'e3', atMs: 2050, durationMs: 600, kind: 'highlight', targetId: 'eq2' },
  ],
  narrationCues: [], teachingLanguage: 'english',
};

describe('manim-web render plan', () => {
  it('preserves the canonical Scene IR and counts the 3B1B motion contract', () => {
    const plan = buildManimWebRenderPlan(scene);
    expect(plan.scene).toBe(scene);
    expect(plan.createCount).toBe(1);
    expect(plan.transformCount).toBe(1);
    expect(plan.highlightCount).toBe(1);
    expect(plan.tokenTransformCount).toBe(1);
    expect(plan.tokenMoveCount).toBe(0);
    expect(plan.durationMs).toBe(2650);
    expect(plan.unsupportedKinds).toEqual([]);
  });
});
