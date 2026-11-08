import { describe, expect, it } from 'vitest';
import { selectVisualStyle } from './style-selector';
import { buildVisualLanguageNodes } from './visual-language';

const cases = [
  { n: 1, domain: 'geometry' as const, expression: 'Derive the area of a parallelogram by splitting it into triangles', expected: 'geometry-area-derivation', required: ['para-diagonal','para-height','area-result'] },
  { n: 2, domain: 'trigonometry' as const, expression: 'Explain sin(A+B) using the unit circle', expected: 'trigonometry-unit-circle-reference', required: ['unit-circle','radius','projection','identity-link'] },
  { n: 3, domain: 'calculus' as const, expression: 'Explain a definite integral as a Riemann sum with rectangles', expected: 'calculus-riemann-sum-area-reference', required: ['curve','riemann-rect-4-0','riemann-rect-8-0','sum-step','integral-result'] },
  { n: 4, domain: 'geometry' as const, expression: 'Prove the Pythagoras theorem using a triangle construction', expected: 'geometry-proof-construction', required: ['triangle'] },
  { n: 5, domain: 'calculus' as const, expression: 'Explain derivative using a moving tangent and slope', expected: 'calculus-slope-explorer-reference', required: ['function-graph'] },
] as const;

describe('AI Guru reference-style end-to-end QA', () => {
  for (const c of cases) {
    it(`test ${c.n}: selects ${c.expected} and exposes required visual primitives`, () => {
      const selection = selectVisualStyle({ domain: c.domain, expression: c.expression, mode: 'construction', bilingual: true });
      expect(selection.style.id).toBe(c.expected);
      const nodes = buildVisualLanguageNodes(c.domain, c.expression, 'construction');
      for (const id of c.required) expect(nodes.some(n => n.id === id)).toBe(true);
    });
  }
});

// Pacing regression: reference-style lessons must not collapse into the old
// sub-second reveal cadence. The generated event durations are intentionally
// slower, with the actual renderer receiving those durations through actions.
describe('reference-style pacing regression', () => {
  it('uses deliberate pacing for geometry area and Riemann styles', async () => {
    const { compileUniversalMath } = await import('./compiler');
    const area = await compileUniversalMath('Derive the area of a parallelogram by splitting it into triangles', { domain:'geometry', grade:8, verify:false });
    const riemann = await compileUniversalMath('Explain a definite integral as a Riemann sum with rectangles', { domain:'calculus', grade:12, verify:false });
    expect(area.visualStyle?.id).toBe('geometry-area-derivation');
    expect(riemann.visualStyle?.id).toBe('calculus-riemann-sum-area-reference');
    expect(Math.min(...area.events.map(e=>e.durationMs))).toBeGreaterThanOrEqual(700);
    expect(Math.min(...riemann.events.map(e=>e.durationMs))).toBeGreaterThanOrEqual(700);
    expect(area.events.length).toBeGreaterThan(6);
    expect(riemann.events.some(e=>e.targetId?.startsWith('riemann-rect-4-'))).toBe(true);
    expect(riemann.events.some(e=>e.targetId?.startsWith('riemann-rect-8-'))).toBe(true);
  });
});


describe('uploaded reference video additions', () => {
  it('selects first-principles reference for limit-definition derivative lessons', async () => {
    const { selectVisualStyle } = await import('./style-selector');
    const { getReferenceQAProfile } = await import('../../qa/visual/reference-qa-profiles');
    const selection = selectVisualStyle({ domain:'calculus', expression:'Explain the derivative from first principles using the limit definition and secant approaching tangent', mode:'construction', bilingual:false });
    expect(selection.style.id).toBe('calculus-first-principles-reference');
    expect(selection.style.referenceIds).toContain('user-video-8-calculus-first-principles');
    expect(selection.style.referenceUrls).toContain('/reference-styles/calculus-first-principles-reference.mp4');
    expect(getReferenceQAProfile(selection.style.qaProfileId).minPauseMs).toBeGreaterThanOrEqual(800);
  });

  it('selects slope-to-derivative reference for graph-first derivative lessons', async () => {
    const { selectVisualStyle } = await import('./style-selector');
    const selection = selectVisualStyle({ domain:'calculus', expression:'Show slope to derivative using rise over run, secant and tangent', mode:'construction', bilingual:false });
    expect(selection.style.id).toBe('calculus-slope-to-derivative-reference');
    expect(selection.style.referenceIds).toContain('user-video-9-slope-to-derivative');
  });

  it('selects quadratic formula reference for quadratic/discriminant lessons', async () => {
    const { selectVisualStyle } = await import('./style-selector');
    const selection = selectVisualStyle({ domain:'algebra', expression:'Derive the quadratic formula and explain the discriminant b^2 - 4ac', mode:'transformation', bilingual:false });
    expect(selection.style.id).toBe('quadratic-formula-derivation-reference');
    expect(selection.style.referenceIds).toContain('user-video-10-quadratic-formula');
  });
});

describe('reference-specific QA profiles', () => {
  it('uses the newly added area-formula reference and its dedicated QA profile', async () => {
    const { selectVisualStyle } = await import('./style-selector');
    const { getReferenceQAProfile } = await import('../../qa/visual/reference-qa-profiles');
    const selection = selectVisualStyle({ domain:'mensuration', expression:'Derive the area formula of a parallelogram by decomposition', mode:'construction', bilingual:false });
    expect(selection.style.id).toBe('area-formula-visual-derivation-reference');
    expect(selection.style.commonTeachingStyleId).toBe('visual-derivation-explanation-v1');
    expect(selection.style.qaProfileId).toBe('geometry-area-derivation-v2');
    expect(getReferenceQAProfile(selection.style.qaProfileId).orderedBeats).toContain('derive equation');
  });
});


describe('reference segment selection', () => {
  it('selects the parallelogram segment from the multi-shape area reference', () => {
    const selection = selectVisualStyle({ domain:'geometry', expression:'Find the area of a parallelogram with base 12 cm and height 7 cm', mode:'construction', bilingual:false });
    expect(selection.style.id).toBe('area-formula-visual-derivation-reference');
    expect(selection.referenceSegment?.id).toBe('area-formula-parallelogram');
    expect(selection.referenceSegment?.qaProfileId).toBe(selection.style.qaProfileId);
    expect(selection.referenceSegment?.shape).toBe('parallelogram');
  });

  it('selects different segments for different shapes while retaining the same parent reference', () => {
    const triangle = selectVisualStyle({ domain:'geometry', expression:'Derive the area of a triangle from base and perpendicular height', mode:'construction', bilingual:false });
    const trapezium = selectVisualStyle({ domain:'geometry', expression:'Derive the area of a trapezium from its parallel sides and height', mode:'construction', bilingual:false });
    expect(triangle.referenceSegment?.id).toBe('area-formula-triangle');
    expect(trapezium.referenceSegment?.id).toBe('area-formula-trapezium');
    expect(triangle.referenceSegment?.parentReferenceId).toBe(trapezium.referenceSegment?.parentReferenceId);
  });
});


describe('reference segment registry integrity', () => {
  it('contains six shape segments covering the full multi-shape reference after the intro', async () => {
    const { AREA_FORMULA_REFERENCE_SEGMENTS } = await import('./reference-segments');
    const shapeSegments = AREA_FORMULA_REFERENCE_SEGMENTS.filter(s => s.shape);
    expect(shapeSegments.map(s => s.shape)).toEqual(['rectangle','square','triangle','parallelogram','rhombus','trapezium']);
    expect(shapeSegments[0].sourceStartMs).toBe(6000);
    expect(shapeSegments.at(-1)?.sourceEndMs).toBe(112000);
    for (let i=1;i<shapeSegments.length;i++) expect(shapeSegments[i].sourceStartMs).toBe(shapeSegments[i-1].sourceEndMs);
    for (const segment of shapeSegments) expect(segment.qaProfileId).toBe('geometry-area-derivation-v2');
  });
});


describe('segmented reference safety', () => {
  it('does not select a multi-shape area reference when no shape segment matches', () => {
    const selection = selectVisualStyle({ domain:'geometry', expression:'Explain a new geometric area concept without naming a shape', mode:'construction', bilingual:false });
    expect(selection.style.id).not.toBe('area-formula-visual-derivation-reference');
    expect(selection.referenceSegment).toBeUndefined();
  });
});
