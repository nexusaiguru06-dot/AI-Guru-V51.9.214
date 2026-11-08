import { describe, expect, it } from 'vitest';
import { searchPatterns } from './search';

const top = (q: string, domain?: string) => searchPatterns(q, { k: 3, domain }).map((h) => h.pattern.id);

describe('pattern search (Visual Pattern RAG)', () => {
  const cases: Array<[string, string]> = [
    ['Solve 2x + 5 = 20: subtract 5 from both sides to keep the equation balanced', 'balance-scale'],
    ['Find the hypotenuse of a right triangle with legs 3 and 4 using Pythagoras theorem', 'right-triangle'],
    ['Draw the graph of y = 2x + 1 and find the slope and y-intercept', 'coordinate-plane'],
    ['Represent the inequality x > 3 on the number line', 'number-line'],
    ['Expand (x + 3)(x + 2) using the distributive property', 'area-model'],
    ['Use the angle sum property of a triangle to find the missing angle x', 'triangle-angles'],
    ['Corresponding angles when parallel lines are cut by a transversal', 'parallel-transversal'],
    ['Find the union and intersection of two sets A and B', 'venn-two-sets'],
    ['Show that 3/4 and 6/8 are equivalent fractions', 'fraction-bar'],
    ['Add integers: -3 + 5 by moving on the number line', 'number-line-jumps'],
    ['Radius, diameter and circumference of a circle', 'circle-parts'],
    ['Construct a perpendicular from A to BC as an auxiliary line', 'auxiliary-line'],
    ['Draw a bar graph of the survey data frequency table', 'bar-chart'],
  ];
  for (const [q, want] of cases) it(`"${q.slice(0, 48)}..." -> ${want}`, () => expect(top(q)[0]).toBe(want));

  it('an exact phrase beats a single shared word ("both sides" is a balance, not a jump)', () => {
    expect(top('subtract 5 from both sides')[0]).toBe('balance-scale');
    expect(top('divide both sides by 2')[0]).toBe('balance-scale');
  });
  it('returns nothing for text that has no picture (no forced match)', () => {
    expect(searchPatterns('Translate this sentence into Malayalam politely')).toEqual([]);
  });
  it('explains itself and respects k', () => {
    const hits = searchPatterns('Pythagoras hypotenuse', { k: 2 });
    expect(hits).toHaveLength(2);
    expect(hits[0].matched).toContain('pythagoras');
    expect(hits[0].direct).toContain('pythagoras');
    expect(hits[0].score).toBeGreaterThan(hits[1].score);
  });
  it('a domain hint nudges ties toward that domain', () => {
    const plain = searchPatterns('angle', { k: 5 }), boosted = searchPatterns('angle', { k: 5, domain: 'geometry' });
    expect(boosted[0].score).toBeGreaterThanOrEqual(plain[0].score);
  });
});
