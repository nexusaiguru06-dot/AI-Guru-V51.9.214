/**
 * Golden examples for the quadratic-equation DNA (V51.9.30): x² − 5x + 6 = 0 by the graph, the
 * discriminant, factorising, the roots and the check; 2x² − 3x − 2 = 0 by the formula with a
 * fractional root; and x² + 2x + 5 = 0 with no real roots. Written fresh for AI Guru; bilingual (the
 * Malayalam is a draft for a teacher to check); passes the validator.
 */

import type { QuadPlan } from '../dna/types';

export const QUAD_FACTOR_SAMPLE: QuadPlan = {
  title: { en: 'Quadratic equations', ml: 'ദ്വിമാന സമവാക്യങ്ങൾ' },
  a: 1,
  b: -5,
  c: 6,
  steps: [
    { op: 'show', say: { en: 'Here is a quadratic equation.', ml: 'ഇതാ ഒരു ദ്വിമാന സമവാക്യം.' } },
    { op: 'graph', say: { en: 'Its graph is a parabola. The solutions are where it meets the x-axis.', ml: 'ഇതിന്റെ ഗ്രാഫ് ഒരു പരാബോളയാണ്. x-അക്ഷത്തെ തൊടുന്നിടങ്ങളാണ് ഉത്തരങ്ങൾ.' } },
    { op: 'discriminant', say: { en: 'The discriminant is positive, so the curve meets the axis twice.', ml: 'വിവേചകം ധനമായതിനാൽ വക്രം അക്ഷത്തെ രണ്ടിടത്ത് തൊടുന്നു.' } },
    { op: 'factorise', say: { en: 'Split the middle term and group. The equation becomes a product equal to zero, so one factor is zero.', ml: 'മധ്യപദത്തെ വിഭജിച്ച് ഗ്രൂപ്പ് ചെയ്യുക. ഗുണനഫലം പൂജ്യമാകുന്ന സമവാക്യം കിട്ടും, അതിനാൽ ഒരു ഘടകം പൂജ്യമാണ്.' } },
    { op: 'roots', say: { en: 'These are exactly the points on the x-axis.', ml: 'ഇവ തന്നെയാണ് x-അക്ഷത്തിലെ ബിന്ദുക്കൾ.' } },
    { op: 'check', say: { en: 'Check: each root makes the equation true.', ml: 'പരിശോധന: ഓരോ മൂലവും സമവാക്യത്തെ ശരിയാക്കുന്നു.' } },
  ],
};

export const QUAD_FORMULA_SAMPLE: QuadPlan = {
  a: 2,
  b: -3,
  c: -2,
  steps: [
    { op: 'show', say: { en: 'A quadratic with a leading coefficient of 2.', ml: 'ആദ്യ ഗുണകം 2 ആയ ഒരു ദ്വിമാന സമവാക്യം.' } },
    { op: 'discriminant', say: { en: 'First the discriminant.', ml: 'ആദ്യം വിവേചകം.' } },
    { op: 'formula', say: { en: 'Put the numbers into the quadratic formula. One root is a fraction.', ml: 'സംഖ്യകൾ ദ്വിമാന സൂത്രവാക്യത്തിൽ ചേർക്കുക. ഒരു മൂലം ഭിന്നസംഖ്യയാണ്.' } },
    { op: 'graph', say: { en: 'The parabola opens upward.', ml: 'പരാബോള മുകളിലേക്ക് തുറക്കുന്നു.' } },
    { op: 'roots', say: { en: 'It meets the axis at both roots.', ml: 'രണ്ട് മൂലങ്ങളിലും അത് അക്ഷത്തെ തൊടുന്നു.' } },
  ],
};

export const QUAD_NOROOT_SAMPLE: QuadPlan = {
  a: 1,
  b: 2,
  c: 5,
  steps: [
    { op: 'show', say: { en: 'Does this equation have a solution?', ml: 'ഈ സമവാക്യത്തിന് ഉത്തരമുണ്ടോ?' } },
    { op: 'graph', say: { en: 'The parabola stays above the x-axis.', ml: 'പരാബോള x-അക്ഷത്തിന് മുകളിൽ തന്നെ നിൽക്കുന്നു.' } },
    { op: 'discriminant', say: { en: 'The discriminant is negative.', ml: 'വിവേചകം ഋണമാണ്.' } },
    { op: 'formula', say: { en: 'The formula would need the square root of a negative number, so there is no real root.', ml: 'സൂത്രവാക്യത്തിന് ഋണസംഖ്യയുടെ വർഗമൂലം വേണം, അതിനാൽ യഥാർഥ മൂലമില്ല.' } },
  ],
};
