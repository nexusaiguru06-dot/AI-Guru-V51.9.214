import { describe, expect, it } from 'vitest';
import { selectTeachingStrategy } from './strategy';

describe('AI Guru teaching strategy selector', () => {
  it('selects hybrid for a quadratic-formula problem when a matching referral exists', () => {
    const d = selectTeachingStrategy({ question: 'Solve x^2 + 5x + 6 = 0 using the quadratic formula', domain: 'polynomials', grade: 10, hasActualProblem: true });
    expect(d.strategy).toBe('hybrid');
    expect(d.referral?.id).toBe('user-video-10-quadratic-formula');
    expect(d.solverRequired).toBe(true);
  });
  it('selects step_by_step when no approved referral is sufficiently matched', () => {
    const d = selectTeachingStrategy({ question: 'Solve 7x - 11 = 24', domain: 'linear_equations', grade: 8, hasActualProblem: true });
    expect(d.strategy).toBe('step_by_step');
    expect(d.solverRequired).toBe(true);
  });
});
