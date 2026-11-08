import { describe, expect, it } from 'vitest';
import { tokenizeLatexForAnimation } from './tokenize';

describe('AI Guru LaTeX token decomposition', () => {
  it('splits repeated variables, numbers and operators into independently transformable parts', () => {
    expect(tokenizeLatexForAnimation('x + (x - 10) = 100').map(t => t.latex)).toEqual([
      'x', '+', '(', 'x', '-', '10', ')', '=', '100',
    ]);
    expect(tokenizeLatexForAnimation('2x - 10 = 100').map(t => t.latex)).toEqual([
      '2', 'x', '-', '10', '=', '100',
    ]);
  });

  it('keeps compound fractions together so their internal layout is not destroyed', () => {
    expect(tokenizeLatexForAnimation('\\frac{a}{b} + x').map(t => t.latex)).toEqual([
      '\\frac{a}{b}', '+', 'x',
    ]);
  });
});
