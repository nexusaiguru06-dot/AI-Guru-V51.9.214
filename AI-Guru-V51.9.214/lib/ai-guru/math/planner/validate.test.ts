import { describe, expect, it } from 'vitest';
import { validateVisualPlan } from './validate';

describe('AI visual plan validation', () => {
  it('accepts a bounded declarative plan', () => {
    const p = validateVisualPlan({
      schemaVersion: '1.0',
      title: 'Solve',
      domain: 'linear_equations',
      grade: 8,
      teachingGoal: 'balance both sides',
      steps: [{ id: 's1', narration: 'Show the equation', visualIds: ['n1'] }],
      nodes: [{ id: 'n1', kind: 'latex', x: 100, y: 100, latex: '2x+3=9' }],
    });
    expect(p.nodes).toHaveLength(1);
    expect(p.steps[0].visualIds).toEqual(['n1']);
  });

  it('accepts token-move as a node kind (schema parity with MathVisualKind)', () => {
    const p = validateVisualPlan({
      schemaVersion: '1.0',
      title: 'Move digit',
      domain: 'arithmetic',
      grade: 6,
      teachingGoal: 'move 7',
      steps: [{ id: 's1', narration: 'Move the 7', visualIds: ['n1'] }],
      nodes: [{ id: 'n1', kind: 'token-move', x: 100, y: 100, content: '7' }],
    });
    expect(p.nodes[0].kind).toBe('token-move');
  });

  it('repairs incomplete token-move actions instead of throwing', () => {
    const p = validateVisualPlan({
      schemaVersion: '1.0',
      title: 'Partial moves',
      domain: 'algebra',
      grade: 8,
      teachingGoal: 'transform',
      steps: [{ id: 's1', narration: 'step', visualIds: ['n1'] }],
      nodes: [{ id: 'n1', kind: 'latex', latex: 'x=3' }],
      visualActions: [
        // missing token + id — should be dropped, not throw
        { type: 'token-move', fromX: 10, fromY: 10, toX: 20, toY: 20 },
        // valid
        { type: 'token-move', id: 'tm1', token: '3', fromX: 100, fromY: 100, toX: 200, toY: 150 },
        // empty token with content fallback
        { type: 'token-move', id: 'tm2', content: 'x', fromX: 50, fromY: 50, toX: 80, toY: 80 },
        // wrong type — dropped
        { type: 'highlight', id: 'h1' },
      ],
    });
    expect(p.visualActions).toBeDefined();
    expect(p.visualActions!.length).toBe(2);
    expect(p.visualActions![0].token).toBe('3');
    expect(p.visualActions![1].token).toBe('x');
  });

  it('drops missing node references from steps instead of throwing', () => {
    const p = validateVisualPlan({
      schemaVersion: '1.0',
      title: 'Missing ref',
      domain: 'algebra',
      grade: 8,
      teachingGoal: 'x',
      steps: [{ id: 's1', narration: 'x', visualIds: ['missing', 'n1'] }],
      nodes: [{ id: 'n1', kind: 'text', content: 'hello' }],
    });
    expect(p.steps[0].visualIds).toEqual(['n1']);
  });

  it('normalises unknown domain and out-of-range grade', () => {
    const p = validateVisualPlan({
      schemaVersion: '1.0',
      title: 'Fallback domain',
      domain: 'not-a-real-domain',
      grade: 99,
      teachingGoal: 'teach',
      steps: [],
      nodes: [{ id: 'n1', kind: 'text', content: 'a' }],
    });
    expect(p.domain).toBe('general');
    expect(p.grade).toBe(8);
    expect(p.steps.length).toBe(1); // auto-synthesised step
  });

  it('aliases common Gemini kind spellings', () => {
    const p = validateVisualPlan({
      schemaVersion: '1.0',
      title: 'Aliases',
      domain: 'algebra',
      grade: 9,
      teachingGoal: 't',
      steps: [{ id: 's1', narration: 'n', visualIds: ['a', 'b'] }],
      nodes: [
        { id: 'a', kind: 'equation', latex: 'x^2' },
        { id: 'b', kind: 'token_move', content: '2' },
      ],
    });
    expect(p.nodes[0].kind).toBe('latex');
    expect(p.nodes[1].kind).toBe('token-move');
  });
});
