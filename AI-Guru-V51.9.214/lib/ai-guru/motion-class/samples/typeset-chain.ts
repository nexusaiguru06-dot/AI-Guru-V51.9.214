/**
 * Sample typeset-chain plans (V51.9.45): the quadratic formula built line by line, a square-root equation
 * solved by squaring, a matrix-vector product and a determinant. Used by the tests and the DNA Studio.
 */

import type { TsPlan } from '../dna/types';

export const SAMPLE_QUADRATIC_FORMULA: TsPlan = {
  colors: { a: 'a', b: 'b', c: 'c' },
  steps: [
    { op: 'show', tex: 'a x^{2} + b x + c = 0', say: { en: 'A quadratic equation has an x squared term.', ml: 'ദ്വിമാന സമവാക്യത്തിൽ x² ഉണ്ട്.' } },
    { op: 'focus', parts: ['a', 'b', 'c'], say: { en: 'Its three numbers are a, b and c.', ml: 'അതിന്റെ മൂന്ന് സംഖ്യകൾ a, b, c ആണ്.' } },
    { op: 'add', tex: 'x = \\frac{-b \\pm \\sqrt{b^{2} - 4ac}}{2a}', note: { en: 'the quadratic formula', ml: 'ദ്വിമാന സൂത്രവാക്യം' }, say: { en: 'The two roots come from this formula.', ml: 'രണ്ട് മൂലങ്ങളും ഈ സൂത്രവാക്യത്തിൽ നിന്ന് കിട്ടും.' } },
    { op: 'box', say: { en: 'Remember this formula.', ml: 'ഈ സൂത്രവാക്യം ഓർമ്മിക്കുക.' } },
  ],
};

export const SAMPLE_SQRT_EQUATION: TsPlan = {
  colors: { x: 'a' },
  steps: [
    { op: 'show', tex: '\\sqrt{x + 3} = 5', say: { en: 'The unknown x is under a square root.', ml: 'അജ്ഞാത സംഖ്യ x വർഗമൂലത്തിനുള്ളിലാണ്.' } },
    { op: 'become', tex: 'x + 3 = 25', note: { en: 'square both sides', ml: 'ഇരുവശവും വർഗിക്കുക' }, say: { en: 'Square both sides to remove the root.', ml: 'മൂലം ഒഴിവാക്കാൻ ഇരുവശവും വർഗിക്കുക.' } },
    { op: 'become', tex: 'x = 22', note: { en: 'take 3 from both sides', ml: 'ഇരുവശത്തുനിന്നും 3 കുറയ്ക്കുക' }, say: { en: 'Take 3 from both sides.', ml: 'ഇരുവശത്തുനിന്നും 3 കുറയ്ക്കുക.' } },
    { op: 'box', say: { en: 'So x is 22.', ml: 'അതിനാൽ x = 22.' } },
  ],
};

export const SAMPLE_MATRIX_PRODUCT: TsPlan = {
  steps: [
    { op: 'show', tex: '\\begin{bmatrix} 1 & 0 \\\\ 1 & -1 \\end{bmatrix}\\begin{bmatrix} 1 \\\\ 2 \\end{bmatrix}', say: { en: 'A matrix acts on a vector.', ml: 'ഒരു മാട്രിക്സ് ഒരു വെക്ടറിൽ പ്രവർത്തിക്കുന്നു.' } },
    { op: 'become', tex: '\\begin{bmatrix} 1 \\cdot 1 + 0 \\cdot 2 \\\\ 1 \\cdot 1 + (-1) \\cdot 2 \\end{bmatrix}', say: { en: 'Each row is multiplied with the column and added.', ml: 'ഓരോ വരിയും നിരയുമായി ഗുണിച്ച് കൂട്ടുക.' } },
    { op: 'become', tex: '\\begin{bmatrix} 1 \\\\ -1 \\end{bmatrix}', say: { en: 'The vector lands here.', ml: 'വെക്ടർ ഇവിടെ എത്തുന്നു.' } },
  ],
};

export const SAMPLE_DETERMINANT: TsPlan = {
  steps: [
    { op: 'show', tex: '\\det\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}', say: { en: 'The determinant of a two by two matrix.', ml: 'രണ്ട് ഗുണിതം രണ്ട് മാട്രിക്സിന്റെ ഡിറ്റർമിനന്റ്.' } },
    { op: 'become', tex: '\\det\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix} = ad - bc', say: { en: 'It is a d minus b c.', ml: 'ഇത് ad − bc ആണ്.' } },
    { op: 'box', say: { en: 'It tells how much areas change.', ml: 'വിസ്തീർണം എത്ര മാറുന്നു എന്ന് ഇത് പറയുന്നു.' } },
  ],
};

export const TYPESET_SAMPLES: Record<string, TsPlan> = {
  quadratic: SAMPLE_QUADRATIC_FORMULA,
  sqrt: SAMPLE_SQRT_EQUATION,
  matrix: SAMPLE_MATRIX_PRODUCT,
  determinant: SAMPLE_DETERMINANT,
};
