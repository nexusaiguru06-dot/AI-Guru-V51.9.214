import { describe, expect, it } from 'vitest';
import { MATH_DOMAIN_PROFILES, getMathDomainProfile } from '../domains';
import { detectMathDomain } from './compiler';

describe('V49 universal math domain coverage', () => {
  it('registers every supported school-math branch', () => {
    expect(MATH_DOMAIN_PROFILES.length).toBeGreaterThanOrEqual(25);
    for (const profile of MATH_DOMAIN_PROFILES) {
      expect(profile.label.length).toBeGreaterThan(0);
      expect(profile.visualObjects.length).toBeGreaterThan(0);
      expect(getMathDomainProfile(profile.id).id).toBe(profile.id);
    }
  });

  it('routes newly added branches deterministically', () => {
    expect(detectMathDomain('Plot the solution set of 2x + 3 > 7')).toBe('inequalities');
    expect(detectMathDomain('Show A union B using a Venn diagram')).toBe('sets');
    expect(detectMathDomain('How many arrangements of 5 objects?')).toBe('combinatorics');
    expect(detectMathDomain('Is √2 an irrational number?')).toBe('number_systems');
  });
});
