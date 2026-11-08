import { describe, expect, it } from 'vitest';
import { selectVisualStyle } from './style-selector';

describe('Visual Style Selector', () => {
  it('selects equation transformation for algebraic manipulation', () => {
    const r = selectVisualStyle({ domain:'linear_equations', expression:'2x + 3 = 11', mode:'transformation', bilingual:true });
    expect(r.style.id).toBe('easy-equation-transformation');
  });
  it('selects geometry construction for triangle proof', () => {
    const r = selectVisualStyle({ domain:'geometry', expression:'Construct a perpendicular to a triangle side', mode:'construction', bilingual:true });
    expect(r.style.id).toBe('geometry-construction');
  });
  it('selects geometry proof reference for theorem situations', () => {
    const r = selectVisualStyle({ domain:'geometry', expression:'Prove the Pythagoras theorem using a triangle construction', mode:'construction', bilingual:true });
    expect(r.style.id).toBe('geometry-proof-construction');
  });


  it('selects the geometry area derivation reference for formula derivation', () => {
    const r = selectVisualStyle({ domain:'geometry', expression:'Derive the area of a parallelogram by splitting it into triangles and show base × height', mode:'construction', bilingual:true });
    expect(r.style.id).toBe('geometry-area-derivation');
  });

  it('selects the unit-circle reference for trigonometric identities', () => {
    const r = selectVisualStyle({ domain:'trigonometry', expression:'Explain sin(A+B) using the unit circle', mode:'construction', bilingual:true });
    expect(r.style.id).toBe('trigonometry-unit-circle-reference');
  });
  it('selects the Riemann-sum reference for integral area intuition', () => {
    const r = selectVisualStyle({ domain:'calculus', expression:'Explain definite integral as a Riemann sum with rectangles', mode:'construction', bilingual:true });
    expect(r.style.id).toBe('calculus-riemann-sum-area-reference');
  });

  it('honours an explicit preferred style', () => {
    const r = selectVisualStyle({ domain:'algebra', expression:'x+1=2', mode:'hybrid', preferredStyle:'concept-explain' });
    expect(r.style.id).toBe('concept-explain');
    expect(r.score).toBe(100);
  });
});
