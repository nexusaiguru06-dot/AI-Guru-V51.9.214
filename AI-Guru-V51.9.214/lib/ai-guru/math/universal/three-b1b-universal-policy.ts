/**
 * Universal 3Blue1Brown teaching policy for ALL math branches.
 *
 * Before: 3b1b-classroom archetype + slow pacing + morph motifs were applied
 * mainly when mandatoryBoard=true (worked algebraic solutions).
 *
 * After: every MathDomain receives the same cinematic visual grammar, with
 * domain-specific objects and construction recipes (still geometry-first,
 * morph-not-replace, focus camera, insight pauses).
 */

import type { MathDomain, VisualMathMode } from './types';

export const THREE_B1B_GLOBAL_MOTIFS = [
  'full-board-composition',
  'geometry-first',
  'morph-not-replace',
  'build-transform-highlight-recolor',
  'focus-arc',
  'insight-pause',
  'one-colour-per-step',
  'camera-focus-active',
  'teacher-narration-overlay-only',
] as const;

export const THREE_B1B_QA_RULES = [
  'safe frame',
  'insight pause',
  'visible construction',
  'at least one genuine transform or continuous morph',
  'no prose wall on the board',
  'full-board occupancy',
  'verified result visible',
] as const;

/** Domain → primary visual objects the board should prefer (manim-web primitives). */
export const DOMAIN_3B1B_OBJECTS: Record<MathDomain, readonly string[]> = {
  arithmetic: ['numberLine', 'barChart', 'shape', 'latex', 'token-move'],
  number_systems: ['numberLine', 'point', 'latex', 'grid'],
  fractions: ['sector', 'shape', 'latex', 'token-move', 'barChart'],
  decimals_percentages: ['grid', 'numberLine', 'barChart', 'latex', 'token-move'],
  ratio_proportion: ['barChart', 'shape', 'arrow', 'latex'],
  algebra: ['latex', 'token-move', 'highlight', 'transform'],
  linear_equations: ['latex', 'token-move', 'balance-scale-shape', 'arrow', 'transform'],
  inequalities: ['numberLine', 'latex', 'highlight', 'arrow'],
  polynomials: ['latex', 'graph', 'point', 'transform'],
  sequences_series: ['numberLine', 'latex', 'point', 'arrow'],
  coordinate_geometry: ['grid', 'point', 'line', 'vector', 'latex'],
  functions: ['graph', 'point', 'numberLine', 'latex', 'arrow'],
  trigonometry: ['sector', 'arc', 'line', 'point', 'latex', 'grid'],
  geometry: ['shape', 'line', 'point', 'arc', 'angle', 'latex'],
  mensuration: ['shape', 'sector', 'latex', 'arrow', 'highlight'],
  calculus: ['graph', 'point', 'line', 'sector', 'latex', 'arrow'],
  statistics: ['barChart', 'point', 'numberLine', 'latex', 'highlight'],
  probability: ['sampleSpace', 'shape', 'point', 'latex', 'arrow'],
  matrices: ['matrix', 'grid', 'latex', 'transform', 'highlight'],
  vectors: ['vector', 'grid', 'arrow', 'latex', 'point'],
  complex_numbers: ['grid', 'vector', 'point', 'arc', 'latex'],
  financial_math: ['barChart', 'numberLine', 'latex', 'arrow', 'token-move'],
  '3d_geometry': ['shape', 'line', 'point', 'latex', 'grid'],
  sets: ['shape', 'point', 'latex', 'highlight'],
  combinatorics: ['shape', 'point', 'arrow', 'latex', 'sampleSpace'],
  general: ['latex', 'shape', 'arrow', 'highlight', 'transform'],
};

/**
 * Domain-specific 3B1B construction recipe (geometry/intuition first,
 * formal symbols second). Used by planner + visual language + DNA stamping.
 */
export const DOMAIN_3B1B_RECIPE: Record<MathDomain, readonly string[]> = {
  arithmetic: [
    'show quantities as countable objects or place-value blocks',
    'group / regroup visibly',
    'fly digits into the written algorithm (token-move)',
    'assemble and verify the result',
  ],
  number_systems: [
    'place numbers on a continuous number line',
    'compare positions (integer / rational / irrational)',
    'construct geometric lengths when roots appear',
    'connect numeric and geometric forms',
  ],
  fractions: [
    'partition a whole (circle / bar) into equal parts',
    'highlight numerator pieces in one colour',
    'morph partitions when rewriting equivalents',
    'compose the result and match to the fraction symbol',
  ],
  decimals_percentages: [
    'show base-10 grid or place-value columns',
    'move the decimal point only with justified place-value motion',
    'connect percent to a shaded whole',
    'verify with the same colour grammar',
  ],
  ratio_proportion: [
    'build paired quantity bars side by side',
    'scale both quantities together (morph bars)',
    'align corresponding parts',
    'show equivalent ratios as matching visual scale',
  ],
  algebra: [
    'tokenize terms and coefficients',
    'group like terms with colour',
    'morph expression → simplified form (TransformMatchingTex)',
    'keep previous verified steps on the board',
  ],
  linear_equations: [
    'represent both sides as visual balance',
    'apply the same inverse operation to both sides as motion',
    'isolate the unknown with continuous transform',
    'substitute back and check on the same board',
  ],
  inequalities: [
    'show both sides, then the inequality relation',
    'apply operations while preserving direction rules',
    'flip the inequality sign with a visible turn when required',
    'paint the solution set on a number line',
  ],
  polynomials: [
    'show terms separately, then group powers',
    'animate factor formation',
    'connect factors to roots on a graph when helpful',
    'morph expanded ↔ factored forms',
  ],
  sequences_series: [
    'place terms along an ordered track',
    'reveal common difference / ratio as a repeating motion',
    'extend the pattern live',
    'connect the pattern to the closed formula',
  ],
  coordinate_geometry: [
    'establish axes / NumberPlane first',
    'plot points with Create, not pop-in',
    'draw geometric relationships (distance, midpoint, slope)',
    'derive the formula from the picture',
  ],
  functions: [
    'map one input → output as motion of a point',
    'sweep a ValueTracker through the domain',
    'connect table, equation, and graph',
    'highlight domain / range visually',
  ],
  trigonometry: [
    'construct the reference triangle or unit circle first',
    'highlight the angle, then the relevant sides / coordinates',
    'connect geometry to the identity or ratio',
    'morph between triangle and unit-circle views when useful',
  ],
  geometry: [
    'construct points / lines / shapes progressively',
    'highlight relevant angles and sides',
    'animate auxiliary constructions',
    'transform the construction into the formal proof step',
  ],
  mensuration: [
    'show the solid or plane figure first',
    'decompose into known shapes (morph / cut)',
    'highlight dimensions that enter the formula',
    'assemble the measure with units',
  ],
  calculus: [
    'draw the curve first',
    'show secant → tangent (or Riemann rectangles → integral) as continuous morph',
    'drive a parameter with a tracker so dependents update live',
    'only then write the formal derivative / integral expression',
  ],
  statistics: [
    'place raw observations',
    'sort / group into bins or a chart',
    'highlight mean / median / mode / spread with colour',
    'connect the visual summary to the formula',
  ],
  probability: [
    'construct the sample space as distinct regions or outcomes',
    'branch or shade favourable outcomes',
    'assemble the probability ratio from counted parts',
    'keep the sample space visible while the number appears',
  ],
  matrices: [
    'construct matrix cells',
    'highlight row / column operations cell-by-cell',
    'morph source matrix → result under the operation',
    'pair every cell change with its algebraic label',
  ],
  vectors: [
    'establish origin and axes / NumberPlane',
    'draw vectors as arrows from the origin',
    'show addition / decomposition as tip-to-tail or component morph',
    'connect magnitude and direction to the algebraic form',
  ],
  complex_numbers: [
    'construct the Argand plane',
    'plot the complex number as a vector',
    'show modulus and argument geometrically',
    'morph under multiplication / conjugation on the plane',
  ],
  financial_math: [
    'construct principal as a bar or stack',
    'grow period-by-period (morph height)',
    'highlight the interest component in a second colour',
    'assemble the final amount',
  ],
  '3d_geometry': [
    'construct the 3D object with readable projections',
    'highlight dimensions and cutting planes',
    'animate section / decomposition',
    'assemble the measure from the visible parts',
  ],
  sets: [
    'draw sets as regions (Venn or listing)',
    'place elements into the correct region',
    'morph union / intersection / complement by shading',
    'connect the diagram to set notation',
  ],
  combinatorics: [
    'construct the successive choices as a tree or grid',
    'branch arrangements or selections',
    'highlight valid outcomes',
    'assemble the verified count',
  ],
  general: [
    'identify the mathematical objects on the board',
    'construct the relevant relationship',
    'highlight the operation as motion',
    'assemble and verify the conclusion',
  ],
};

/** Extra motifs stamped per domain (on top of THREE_B1B_GLOBAL_MOTIFS). */
export const DOMAIN_3B1B_EXTRA_MOTIFS: Record<MathDomain, readonly string[]> = {
  arithmetic: ['count-to-answer', 'token-motion', 'place-value-blocks'],
  number_systems: ['number-line-primary', 'position-compare'],
  fractions: ['partition-whole', 'shade-numerator', 'equivalent-morph'],
  decimals_percentages: ['place-value-grid', 'percent-shade'],
  ratio_proportion: ['paired-bars', 'scale-together'],
  algebra: ['transform-matching-equation', 'token-motion'],
  linear_equations: ['transform-matching-equation', 'token-motion', 'balance-both-sides'],
  inequalities: ['number-line-solution', 'sign-flip-visible'],
  polynomials: ['transform-matching-equation', 'root-graph-link'],
  sequences_series: ['pattern-extend', 'common-difference-reveal'],
  coordinate_geometry: ['plane-first', 'point-plot-create'],
  functions: ['input-output-motion', 'value-tracker-sweep'],
  trigonometry: ['unit-circle-or-triangle-first', 'ratio-from-geometry'],
  geometry: ['construct-then-prove', 'auxiliary-lines'],
  mensuration: ['decompose-figure', 'dimension-callout'],
  calculus: ['secant-to-tangent', 'riemann-to-integral', 'value-tracker'],
  statistics: ['data-to-chart', 'center-spread-colour'],
  probability: ['sample-space-first', 'favourable-shade'],
  matrices: ['cell-by-cell-op', 'matrix-morph'],
  vectors: ['basis-and-plane', 'tip-to-tail'],
  complex_numbers: ['argand-plane', 'modulus-argument'],
  financial_math: ['growth-period-morph', 'interest-highlight'],
  '3d_geometry': ['projection-readable', 'section-animate'],
  sets: ['region-shade', 'element-placement'],
  combinatorics: ['choice-tree', 'valid-outcome-highlight'],
  general: ['progressive-build', 'operation-as-motion'],
};

export interface Universal3B1BGrammar {
  archetype: '3b1b-classroom';
  constructionPattern: 'build-transform-highlight-recolor';
  pacing: 'slow';
  camera: 'focus';
  motifs: string[];
  qaRules: string[];
  principle: 'animate-the-mathematics';
  visualMode: VisualMathMode;
  preferredObjects: readonly string[];
  recipe: readonly string[];
}

/**
 * Single entry point: given any math domain, return the full 3B1B visual grammar.
 * Use this from template-selector, lesson-planner, and compiler so every branch
 * shares the same cinematic teaching style.
 */
export function getUniversal3B1BGrammar(
  domain: MathDomain,
  mode: VisualMathMode = 'hybrid',
): Universal3B1BGrammar {
  const extra = DOMAIN_3B1B_EXTRA_MOTIFS[domain] ?? DOMAIN_3B1B_EXTRA_MOTIFS.general;
  const motifs = [...new Set([...THREE_B1B_GLOBAL_MOTIFS, ...extra])].slice(0, 16);
  return {
    archetype: '3b1b-classroom',
    constructionPattern: 'build-transform-highlight-recolor',
    pacing: 'slow',
    camera: 'focus',
    motifs,
    qaRules: [...THREE_B1B_QA_RULES],
    principle: 'animate-the-mathematics',
    visualMode: mode,
    preferredObjects: DOMAIN_3B1B_OBJECTS[domain] ?? DOMAIN_3B1B_OBJECTS.general,
    recipe: DOMAIN_3B1B_RECIPE[domain] ?? DOMAIN_3B1B_RECIPE.general,
  };
}

/** True when a lesson should force the full-board manim-web path. */
export function shouldForce3B1BBoard(_domain: MathDomain): boolean {
  // All branches: yes. Algebra is no longer a special case.
  return true;
}
