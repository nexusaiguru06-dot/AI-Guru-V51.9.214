import { describe, expect, it } from 'vitest';
import { detectMathDomain } from '../math/universal/compiler';
import { selectTeachingStrategy } from './strategy';

const pick = (q: string) => selectTeachingStrategy({ question: q, domain: detectMathDomain(q), grade: 12 });

describe('linear-equation template selection', () => {
  it('a worded problem with real solution steps gets the two-step linear-equation template', () => {
    const d = pick([
      'Conceptualizing the Bead Problem',
      'B + W = 100, B = W + 10 substitute B (W + 10) + W = 100',
      '(W + 10) + W = 100 collect like terms 2W + 10 = 100',
      '2W + 10 = 100 subtract 10 from both sides 2W = 90',
      '2W = 90 divide both sides by 2 W = 45',
    ].join('\n'));
    expect(d.domain).toBe('linear_equations');
    // Either approved equation template is a correct match (two-step reference, or the
    // fundamental-algebra symbolic-transformation Mathlet when "collect like terms" appears).
    expect(d.referral).toBeDefined();
    expect(d.referral?.domains).toContain('linear_equations');
    expect(d.strategy).toBe('hybrid');
  });
  it('a single bare equation still does NOT trigger a referral (deliberate rule)', () => {
    expect(pick('Solve 7x - 11 = 24').referral).toBeUndefined();
  });
  it('narrative text and other domains never get the linear-equation template', () => {
    expect(pick('Dear children, this preface introduces GeoGebra and dynamic models.').referral).toBeUndefined();
    expect(pick('Add 1/2 and 1/3').referral?.id).not.toBe('linear-equation-two-step-reference');
    expect(pick('Find the area of a triangle with base 6 and height 4').referral?.id).not.toBe('linear-equation-two-step-reference');
  });
});


describe('General Class visual isolation', () => {
  it('never selects an interactive Mathlet template for General Class', () => {
    const d = selectTeachingStrategy({ question: 'Solve x + (x - 10) = 100', domain: 'linear_equations', grade: 8, hasActualProblem: true, mode: 'general-class' });
    expect(d.referral).toBeUndefined();
    expect(d.visualEngine).toBe('specialized');
    expect(d.reason).toContain('DNA-first');
  });
});
