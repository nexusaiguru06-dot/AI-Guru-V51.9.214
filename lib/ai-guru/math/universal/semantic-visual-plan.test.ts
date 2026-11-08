import { describe, expect, it } from 'vitest';
import { buildSemanticVisualPlan } from './semantic-visual-plan';

describe('semantic visual construction', () => {
  it('creates a continuous construction plan instead of only static equations', () => {
    const plan = buildSemanticVisualPlan('linear_equations', '3x + 5 = 20', [
      { id:'given', kind:'latex', latex:'3x+5=20' },
      { id:'next', kind:'latex', latex:'3x=15' },
      { id:'answer', kind:'latex', latex:'x=5' },
    ]);
    expect(plan.objects.length).toBe(3);
    expect(plan.steps.length).toBeGreaterThan(1);
    expect(plan.steps.some(s => s.actions.some(a => a.type === 'transform'))).toBe(true);
    expect(plan.relations.some(r => r.relation === 'derived-from')).toBe(true);
  });
});
