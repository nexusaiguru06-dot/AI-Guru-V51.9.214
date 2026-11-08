/**
 * Golden examples for the matrix multiplication and transpose DNA (V51.9.37). Written fresh for
 * AI Guru; bilingual (the Malayalam is a draft for a teacher to check); every sample passes the
 * validator.
 */

import type { MatrixOpsPlan } from '../dna/types';

export const MO_MULTIPLY_SAMPLE: MatrixOpsPlan = {
  title: { en: 'Multiplying two matrices', ml: 'രണ്ട് മാട്രിക്സുകളുടെ ഗുണനം' },
  kind: 'multiply',
  a: [[1, 2, 3], [4, 5, 6]],
  b: [[1, 0], [0, 1], [2, 1]],
  steps: [
    { op: 'show', say: { en: 'A has 2 rows and 3 columns. B has 3 rows and 2 columns.', ml: 'A-ക്ക് 2 വരിയും 3 നിരയുമുണ്ട്. B-ക്ക് 3 വരിയും 2 നിരയുമുണ്ട്.' } },
    { op: 'check', say: { en: 'The columns of A and the rows of B are both 3, so we can multiply. The product has 2 rows and 2 columns.', ml: 'A-യുടെ നിരകളും B-യുടെ വരികളും 3 ആണ്, അതിനാൽ ഗുണിക്കാം. ഗുണനഫലത്തിന് 2 വരിയും 2 നിരയും.' } },
    { op: 'entry', i: 0, j: 0, say: { en: 'The first entry: row 1 of A times column 1 of B, multiplied in pairs and added.', ml: 'ആദ്യത്തെ എൻട്രി: A-യുടെ ഒന്നാം വരിയും B-യുടെ ഒന്നാം നിരയും ജോടികളായി ഗുണിച്ച് കൂട്ടുക.' } },
    { op: 'entry', i: 1, j: 1, say: { en: 'Row 2 of A times column 2 of B gives the last entry.', ml: 'A-യുടെ രണ്ടാം വരിയും B-യുടെ രണ്ടാം നിരയും അവസാനത്തെ എൻട്രി തരുന്നു.' } },
    { op: 'all', say: { en: 'The other two entries come the same way.', ml: 'ബാക്കി രണ്ട് എൻട്രികളും ഇതേ രീതിയിൽ.' } },
  ],
};

export const MO_SQUARE_SAMPLE: MatrixOpsPlan = {
  kind: 'multiply',
  a: [[2, -1], [0, 3]],
  b: [[1, 4], [-2, 5]],
  steps: [
    { op: 'show', say: { en: 'Two 2 by 2 matrices.', ml: 'രണ്ട് 2 × 2 മാട്രിക്സുകൾ.' } },
    { op: 'check', say: { en: 'Both are 2 by 2, so the product is 2 by 2.', ml: 'രണ്ടും 2 × 2 ആണ്, അതിനാൽ ഗുണനഫലവും 2 × 2.' } },
    { op: 'entry', i: 0, j: 0, say: { en: 'Row 1 times column 1. Negative numbers go in brackets.', ml: 'ഒന്നാം വരി × ഒന്നാം നിര. ഋണസംഖ്യകൾ ബ്രാക്കറ്റിൽ.' } },
    { op: 'all', say: { en: 'Fill in the rest the same way.', ml: 'ബാക്കിയും ഇതേ രീതിയിൽ പൂരിപ്പിക്കുക.' } },
  ],
};

export const MO_TRANSPOSE_SAMPLE: MatrixOpsPlan = {
  title: { en: 'The transpose of a matrix', ml: 'മാട്രിക്സിന്റെ ട്രാൻസ്പോസ്' },
  kind: 'transpose',
  a: [[1, 2, 3], [4, 5, 6]],
  steps: [
    { op: 'show', say: { en: 'This matrix A has 2 rows and 3 columns.', ml: 'ഈ മാട്രിക്സ് A-ക്ക് 2 വരിയും 3 നിരയുമുണ്ട്.' } },
    { op: 'rows', say: { en: 'Each row of A becomes a column of the transpose.', ml: 'A-യുടെ ഓരോ വരിയും ട്രാൻസ്പോസിലെ ഒരു നിരയാകുന്നു.' } },
    { op: 'entry', i: 0, j: 2, say: { en: 'The entry in row 1, column 3 moves to row 3, column 1.', ml: 'ഒന്നാം വരി, മൂന്നാം നിരയിലെ എൻട്രി മൂന്നാം വരി, ഒന്നാം നിരയിലേക്ക് മാറുന്നു.' } },
    { op: 'size', say: { en: 'A 2 by 3 matrix has a 3 by 2 transpose.', ml: '2 × 3 മാട്രിക്സിന്റെ ട്രാൻസ്പോസ് 3 × 2 ആണ്.' } },
  ],
};

export const MO_BIG_TRANSPOSE_SAMPLE: MatrixOpsPlan = {
  kind: 'transpose',
  a: [[1, -2, 3, 0], [4, 5, -6, 7], [8, 9, 1, -3]],
  steps: [
    { op: 'show', say: { en: 'A 3 by 4 matrix.', ml: 'ഒരു 3 × 4 മാട്രിക്സ്.' } },
    { op: 'rows', say: { en: 'Rows turn into columns.', ml: 'വരികൾ നിരകളാകുന്നു.' } },
  ],
};
