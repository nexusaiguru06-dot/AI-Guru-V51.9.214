/**
 * Golden examples for the coordinate-board DNAs (V51.9.21): a matrix transformation of the
 * plane (Essence-of-Linear-Algebra style) and two graphs. Written in the planner's JSON
 * format, bilingual, and passed through the same validator as any AI plan. They are the
 * examples the AI sees in its prompt and the fixtures of the tests.
 */

import type { GraphPlan, PlanePlan } from '../dna/types';

export const PLANE_SAMPLE: PlanePlan = {
  title: { en: 'Moving the whole plane', ml: 'തലം മുഴുവൻ നീക്കുമ്പോൾ' },
  xMax: 5,
  yMax: 4,
  steps: [
    { op: 'grid', say: { en: 'This is the plane. A point is two numbers: how far right, how far up.', ml: 'ഇതാണ് തലം. ഒരു ബിന്ദു എന്നാൽ രണ്ട് സംഖ്യകളാണ്: എത്ര വലത്തേക്ക്, എത്ര മുകളിലേക്ക്.' } },
    { op: 'basis', say: { en: 'Two arrows matter most: green î goes one step right, red ĵ goes one step up.', ml: 'രണ്ട് അമ്പുകൾ പ്രധാനമാണ്: പച്ച î ഒരു ചുവട് വലത്തേക്ക്, ചുവപ്പ് ĵ ഒരു ചുവട് മുകളിലേക്ക്.' } },
    { op: 'combine', v: [2, 1], say: { en: 'Any vector is a recipe: 2 of î, then 1 of ĵ.', ml: 'ഏത് വെക്ടറും ഒരു കൂട്ടാണ്: 2 î, പിന്നെ 1 ĵ.' } },
    { op: 'square', say: { en: 'The square built on î and ĵ has area 1.', ml: 'î, ĵ എന്നിവയിൽ വരച്ച സമചതുരത്തിന്റെ വിസ്തീർണം 1 ആണ്.' } },
    { op: 'matrix', say: { en: 'A matrix is two columns: where î lands, then where ĵ lands. Now: î stays, ĵ stays.', ml: 'മാട്രിക്സ് എന്നാൽ രണ്ട് നിരകളാണ്: î എവിടെ എത്തുന്നു, പിന്നെ ĵ എവിടെ. ഇപ്പോൾ രണ്ടും സ്ഥാനം മാറ്റുന്നില്ല.' } },
    { op: 'transform', matrix: [1, 1, 0, 1], name: { en: 'shear', ml: 'ചരിക്കൽ' }, say: { en: 'Now push the whole plane: î stays, ĵ leans to the right. Grid lines stay parallel.', ml: 'ഇനി തലം മുഴുവൻ തള്ളുക: î മാറുന്നില്ല, ĵ വലത്തേക്ക് ചരിയുന്നു. ഗ്രിഡ് വരകൾ സമാന്തരമായി തുടരുന്നു.' } },
    { op: 'det', say: { en: 'The square is slanted but its area is still 1, so the determinant is 1.', ml: 'സമചതുരം ചരിഞ്ഞു, എങ്കിലും വിസ്തീർണം 1 തന്നെ. അതിനാൽ ഡിറ്റർമിനന്റ് 1.' } },
    { op: 'reset', say: { en: 'Put the plane back.', ml: 'തലം പഴയ നിലയിലേക്ക് മടക്കുക.' } },
    { op: 'transform', matrix: [0, -1, 1, 0], name: { en: 'rotate 90°', ml: '90° തിരിക്കൽ' }, say: { en: 'Turn everything a quarter turn: î goes up, ĵ goes left.', ml: 'എല്ലാം കാൽ വട്ടം തിരിക്കുക: î മുകളിലേക്ക്, ĵ ഇടത്തേക്ക്.' } },
    { op: 'reset', say: { en: 'Back again.', ml: 'വീണ്ടും പഴയ നിലയിലേക്ക്.' } },
    { op: 'transform', matrix: [2, 0, 0, 2], name: { en: 'stretch ×2', ml: 'വലുതാക്കൽ ×2' }, say: { en: 'Stretch both arrows to twice the length.', ml: 'രണ്ട് അമ്പുകളും ഇരട്ടി നീളത്തിലാക്കുക.' } },
    { op: 'det', say: { en: 'Each side doubled, so the area becomes 4. The determinant is 4.', ml: 'ഓരോ വശവും ഇരട്ടിയായി, അതിനാൽ വിസ്തീർണം 4 ആയി. ഡിറ്റർമിനന്റ് 4.' } },
  ],
};

export const GRAPH_LINE_SAMPLE: GraphPlan = {
  title: { en: 'The graph of y = 2x + 1', ml: 'y = 2x + 1 ന്റെ ഗ്രാഫ്' },
  xMin: -3,
  xMax: 3,
  yMin: -6,
  yMax: 8,
  steps: [
    { op: 'axes', say: { en: 'Here are the axes: x goes across, y goes up.', ml: 'ഇതാ അക്ഷങ്ങൾ: x കുറുകെ, y മുകളിലേക്ക്.' } },
    { op: 'point', at: [0, 1], label: '(0, 1)', drop: true, say: { en: 'When x is 0, y = 2 × 0 + 1 = 1. Mark that point.', ml: 'x = 0 ആകുമ്പോൾ y = 2 × 0 + 1 = 1. ആ ബിന്ദു അടയാളപ്പെടുത്തുക.' } },
    { op: 'point', at: [1, 3], label: '(1, 3)', drop: true, say: { en: 'When x is 1, y = 2 × 1 + 1 = 3. Mark this one too.', ml: 'x = 1 ആകുമ്പോൾ y = 2 × 1 + 1 = 3. ഇതും അടയാളപ്പെടുത്തുക.' } },
    { op: 'curve', fn: '2x+1', from: -2, to: 2, label: 'y = 2x + 1', color: 'b', say: { en: 'Join them: a straight line. Every point on it solves the equation.', ml: 'അവയെ യോജിപ്പിക്കുക: ഒരു നേർരേഖ. അതിലെ ഓരോ ബിന്ദുവും സമവാക്യത്തിന്റെ ഒരു നിർധാരണമാണ്.' } },
    { op: 'tracker', stops: [-1, 0, 1, 2], say: { en: 'Slide along the line and read each point: x, then y.', ml: 'രേഖയിലൂടെ നീങ്ങി ഓരോ ബിന്ദുവും വായിക്കുക: x, പിന്നെ y.' } },
    { op: 'segment', from: [0, 1], to: [1, 1], color: 'c', dashed: true, label: '1', say: { en: 'Go 1 step right…', ml: 'ഒരു ചുവട് വലത്തേക്ക്…' } },
    { op: 'segment', from: [1, 1], to: [1, 3], color: 'a', dashed: true, label: '2', say: { en: '…and the line rises 2. That rise per step is the slope.', ml: '…രേഖ 2 മുകളിലേക്ക് ഉയരുന്നു. ഓരോ ചുവടിലെയും ഈ ഉയർച്ചയാണ് ചരിവ്.' } },
    { op: 'morph', fn: '3x+1', label: 'y = 3x + 1', say: { en: 'Change 2 to 3 and the line gets steeper.', ml: '2 മാറ്റി 3 ആക്കിയാൽ രേഖ കൂടുതൽ കുത്തനെയാകുന്നു.' } },
  ],
};

export const GRAPH_PARABOLA_SAMPLE: GraphPlan = {
  xMin: -4,
  xMax: 4,
  yMin: -4,
  yMax: 9,
  steps: [
    { op: 'axes', say: { en: 'Here are the axes: x goes across, y goes up.', ml: 'ഇതാ അക്ഷങ്ങൾ: x കുറുകെ, y മുകളിലേക്ക്.' } },
    { op: 'curve', fn: 'x^2', from: -3, to: 3, label: 'y = x^2', say: { en: 'For every x, y is x times x. That makes a curve called a parabola.', ml: 'ഓരോ x-നും y = x ഗുണം x. അങ്ങനെ പരാബോള എന്ന വക്രം കിട്ടുന്നു.' } },
    { op: 'tracker', stops: [-2, 0, 2], say: { en: 'Look: x = 2 and x = −2 give the same height.', ml: 'നോക്കൂ: x = 2, x = −2 എന്നിവയ്ക്ക് ഒരേ ഉയരം.' } },
    { op: 'morph', fn: 'x^2-3', label: 'y = x^2 − 3', say: { en: 'Subtract 3 and the whole curve slides down by 3.', ml: '3 കുറച്ചാൽ വക്രം മുഴുവൻ 3 താഴേക്ക് നീങ്ങുന്നു.' } },
  ],
};
