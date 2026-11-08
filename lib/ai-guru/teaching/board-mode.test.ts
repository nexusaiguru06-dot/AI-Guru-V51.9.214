import { describe, expect, it } from 'vitest';
import { boardModeFor, boardModeLabel } from './board-mode';

describe('boardModeFor (template decides the board)', () => {
  it('symbolic and numeric domains use the derivation column', () => {
    for (const domain of ['linear_equations', 'algebra', 'polynomials', 'arithmetic', 'fractions', 'general']) {
      expect(boardModeFor({ domain })).toBe('derivation');
    }
  });
  it('constructive and graphical domains use authored visuals', () => {
    for (const domain of ['geometry', 'coordinate_geometry', 'functions', 'trigonometry', 'statistics', 'mensuration']) {
      expect(boardModeFor({ domain })).toBe('visual');
    }
  });
  it('defaults to derivation when nothing is selected, and labels both modes', () => {
    expect(boardModeFor(undefined)).toBe('derivation');
    expect(boardModeLabel('derivation')).toMatch(/derivation/i);
    expect(boardModeLabel('visual')).toMatch(/visual/i);
  });
});
