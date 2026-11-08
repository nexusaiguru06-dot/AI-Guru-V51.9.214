/**
 * Golden examples for the polynomial DNA (V51.9.31): a cubic taken apart with the remainder and factor
 * theorems and its graph; adding, subtracting and multiplying two polynomials with long division;
 * and a square identity with its area picture. Written fresh for AI Guru; bilingual (the Malayalam is a
 * draft for a teacher to check); every sample passes the validator.
 */

import type { PolyPlan } from '../dna/types';

/** x³ − 4x² + x + 6 = (x − 2)(x − 3)(x + 1): the remainder theorem, the factor theorem, the graph. */
export const POLY_FACTOR_SAMPLE: PolyPlan = {
  title: { en: 'Polynomials', ml: 'ബഹുപദങ്ങൾ' },
  p: [1, -4, 1, 6],
  r: 2,
  steps: [
    { op: 'show', say: { en: 'Here is a polynomial. Its degree is the highest power of x.', ml: 'ഇതാ ഒരു ബഹുപദം. x-ന്റെ ഏറ്റവും വലിയ കൃതിയാണ് അതിന്റെ കൃതി.' } },
    { op: 'graph', say: { en: 'Here is the curve. We want to know where it crosses the x-axis.', ml: 'ഇതാ വക്രം. അത് x-അക്ഷത്തെ എവിടെ മുറിക്കുന്നു എന്നാണ് അറിയേണ്ടത്.' } },
    { op: 'divide', say: { en: 'Divide by x minus 2, term by term. Take the first term, multiply back, subtract, repeat.', ml: 'x − 2 കൊണ്ട് പദം പദമായി ഹരിക്കുക. ആദ്യപദം എടുത്ത് ഗുണിച്ച് കുറച്ച് ആവർത്തിക്കുക.' } },
    { op: 'remainder', say: { en: 'Put x equal to 2. The value is the remainder.', ml: 'x = 2 ചേർക്കുക. കിട്ടുന്ന വില ശിഷ്ടമാണ്.' } },
    { op: 'factor', at: 2, say: { en: 'The value is zero, so x minus 2 is a factor. Divide it out and factorise the rest.', ml: 'വില പൂജ്യമാണ്, അതിനാൽ x − 2 ഒരു ഘടകമാണ്. അത് ഹരിച്ച് ബാക്കി ഘടകങ്ങളാക്കുക.' } },
    { op: 'roots', say: { en: 'It crosses the x-axis exactly at the three roots.', ml: 'മൂന്ന് മൂലങ്ങളിൽത്തന്നെയാണ് അത് x-അക്ഷത്തെ മുറിക്കുന്നത്.' } },
  ],
};

/** (3x² + 2x − 5) with (x² − 4x + 1): add, subtract, multiply by x + 2. */
export const POLY_ARITH_SAMPLE: PolyPlan = {
  p: [3, 2, -5],
  q: [1, -4, 1],
  steps: [
    { op: 'show', say: { en: 'Two polynomials. We will add, subtract and multiply them.', ml: 'രണ്ട് ബഹുപദങ്ങൾ. നമുക്ക് അവ കൂട്ടുകയും കുറയ്ക്കുകയും ഗുണിക്കുകയും ചെയ്യാം.' } },
    { op: 'add', say: { en: 'To add, line up the same powers and add each column.', ml: 'കൂട്ടാൻ ഒരേ കൃതികൾ ഒരേ നിരയിൽ എഴുതി ഓരോ നിരയും കൂട്ടുക.' } },
    { op: 'subtract', say: { en: 'To subtract, add the opposite of every term of the second.', ml: 'കുറയ്ക്കാൻ രണ്ടാമത്തേതിന്റെ ഓരോ പദത്തിന്റെയും വിപരീതം കൂട്ടുക.' } },
    { op: 'multiply', say: { en: 'To multiply, make a table of every term times every term. Terms with the same power share a colour.', ml: 'ഗുണിക്കാൻ ഓരോ പദവും ഓരോ പദത്തോടും ഗുണിച്ച് പട്ടികയുണ്ടാക്കുക. ഒരേ കൃതിയുള്ള പദങ്ങൾക്ക് ഒരേ നിറം.' } },
  ],
};

/** x² + 6x + 9 = (x + 3)²: the identity with its area picture. */
export const POLY_IDENTITY_SAMPLE: PolyPlan = {
  p: [1, 6, 9],
  steps: [
    { op: 'show', say: { en: 'Is this polynomial a perfect square?', ml: 'ഈ ബഹുപദം ഒരു പൂർണ വർഗമാണോ?' } },
    { op: 'identity', say: { en: 'A square of side x plus 3 is made of x squared, two strips and a small square 3 by 3.', ml: 'x + 3 വശമുള്ള സമചതുരം x² ഉം രണ്ട് സ്ട്രിപ്പുകളും 3 × 3 ചെറിയ സമചതുരവും ചേർന്നതാണ്.' } },
    { op: 'graph', say: { en: 'The curve touches the x-axis at x = −3 and does not cross it.', ml: 'വക്രം x = −3-ൽ x-അക്ഷത്തെ തൊടുന്നു, മുറിച്ച് കടക്കുന്നില്ല.' } },
    { op: 'roots', say: { en: 'The root is −3, counted twice.', ml: 'മൂലം −3 ആണ്, രണ്ട് തവണ.' } },
  ],
};
