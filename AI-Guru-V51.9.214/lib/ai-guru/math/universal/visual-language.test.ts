import { describe, expect, it } from 'vitest';
import { buildVisualLanguageNodes, getVisualStyleProfile } from './visual-language';
import type { MathDomain } from './types';

const domains:MathDomain[]=[
  'arithmetic','fractions','decimals_percentages','ratio_proportion','algebra',
  'linear_equations','polynomials','sequences_series','coordinate_geometry',
  'functions','trigonometry','geometry','mensuration','calculus','statistics',
  'probability','matrices','vectors','complex_numbers','financial_math','3d_geometry','general'
];

describe('AI Guru visual mathematical construction + symbolic transformation',()=>{
  it('covers every Universal Math domain without importing a reference mathematical method',()=>{
    for(const domain of domains){
      const profile=getVisualStyleProfile(domain,'hybrid');
      expect(profile.principle).toBe('animate-the-mathematics');
      expect(profile.referenceVideoUse).toBe('style-only');
      expect(profile.forbiddenTechniqueTransfer.join(' ')).toMatch(/Japanese-stick/i);
      expect(buildVisualLanguageNodes(domain,'x + 2 = 5','hybrid').length).toBeGreaterThan(0);
    }
  });
  it('preserves semantic construction objects instead of relying on static text-only steps',()=>{
    const nodes=buildVisualLanguageNodes('fractions','3/4','construction');
    expect(nodes.some(n=>n.kind==='shape')).toBe(true);
  });
  it('supports symbolic transformation mode',()=>{
    const nodes=buildVisualLanguageNodes('linear_equations','2x + 5 = 13','transformation');
    expect(nodes.some(n=>n.id==='original')).toBe(true);
    expect(nodes.some(n=>n.id==='transform-left-right')).toBe(true);
  });
});
