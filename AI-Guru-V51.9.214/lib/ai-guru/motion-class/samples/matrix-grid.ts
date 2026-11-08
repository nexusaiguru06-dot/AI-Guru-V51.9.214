/**
 * Golden example for the matrix-grid DNA (V51.9.24): the anatomy of a matrix, in the order of the
 * reference clip the user shared (rows, columns, diagonal, one entry, size, square, then the
 * general n × n and m × n forms). Written fresh for AI Guru; bilingual; passes the validator.
 */

import type { MatrixPlan } from '../dna/types';

export const MATRIX_GRID_SAMPLE: MatrixPlan = {
  title: { en: 'What is a matrix?', ml: 'എന്താണ് മാട്രിക്സ്?' },
  name: 'A',
  rows: 3,
  cols: 3,
  steps: [
    { op: 'show', say: { en: 'A matrix is a grid of numbers inside brackets. Here we call it A. Each entry has two small numbers, its address.', ml: 'ബ്രാക്കറ്റിനുള്ളിൽ സംഖ്യകൾ ഗ്രിഡായി എഴുതിയതാണ് മാട്രിക്സ്. ഇതിനെ നമ്മൾ A എന്ന് വിളിക്കുന്നു. ഓരോ എൻട്രിക്കും രണ്ട് ചെറിയ സംഖ്യകളുണ്ട്, അതാണ് അതിന്റെ വിലാസം.' } },
    { op: 'row', index: 0, say: { en: 'A row runs across. This is the first row.', ml: 'വരി കുറുകെ പോകുന്നു. ഇത് ഒന്നാം വരിയാണ്.' } },
    { op: 'column', index: 0, say: { en: 'A column runs down. This is the first column.', ml: 'നിര താഴേക്ക് പോകുന്നു. ഇത് ഒന്നാം നിരയാണ്.' } },
    { op: 'diagonal', say: { en: 'The diagonal runs from the top left corner to the bottom right corner.', ml: 'വികർണം മുകളിൽ ഇടത്തെ മൂലയിൽ നിന്ന് താഴെ വലത്തെ മൂലയിലേക്ക് പോകുന്നു.' } },
    { op: 'entry', i: 2, j: 2, say: { en: 'Look closely at the last entry.', ml: 'അവസാനത്തെ എൻട്രി ശ്രദ്ധിച്ച് നോക്കൂ.' } },
    { op: 'indices', say: { en: 'The first small number tells its row. The second tells its column. So this entry sits in row 3, column 3.', ml: 'ആദ്യത്തെ ചെറിയ സംഖ്യ അതിന്റെ വരിയെ കാണിക്കുന്നു. രണ്ടാമത്തേത് നിരയെയും. അതിനാൽ ഈ എൻട്രി മൂന്നാം വരിയിലും മൂന്നാം നിരയിലുമാണ്.' } },
    { op: 'zoomOut', say: { en: 'Now step back and look at the whole matrix.', ml: 'ഇനി പിന്നോട്ട് മാറി മുഴുവൻ മാട്രിക്സും നോക്കൂ.' } },
    { op: 'size', say: { en: 'It has 3 rows and 3 columns, so we say it is a 3 by 3 matrix.', ml: 'ഇതിന് 3 വരികളും 3 നിരകളുമുണ്ട്, അതിനാൽ ഇത് 3 ഗുണം 3 മാട്രിക്സ് ആണ്.' } },
    { op: 'kind', say: { en: 'Rows and columns are equal, so it is a square matrix.', ml: 'വരികളും നിരകളും തുല്യമാണ്, അതിനാൽ ഇത് സമചതുര മാട്രിക്സ് ആണ്.' } },
    { op: 'general', rows: 'n', cols: 'n', say: { en: 'For any whole number n, an n by n matrix looks like this. The dots mean the pattern goes on.', ml: 'ഏത് അഖണ്ഡസംഖ്യ n-നും, n ഗുണം n മാട്രിക്സ് ഇങ്ങനെയാണ്. ബിന്ദുക്കൾ മാതൃക തുടരുന്നു എന്ന് കാണിക്കുന്നു.' } },
    { op: 'size', say: { en: 'Its size is n by n.', ml: 'ഇതിന്റെ വലിപ്പം n ഗുണം n ആണ്.' } },
    { op: 'general', rows: 'm', cols: 'n', say: { en: 'The rows and columns need not match. We use m for the rows and n for the columns.', ml: 'വരികളും നിരകളും തുല്യമാകണമെന്നില്ല. വരികൾക്ക് m-ഉം നിരകൾക്ക് n-ഉം ഉപയോഗിക്കുന്നു.' } },
    { op: 'size', say: { en: 'This one is an m by n matrix.', ml: 'ഇത് m ഗുണം n മാട്രിക്സ് ആണ്.' } },
    { op: 'kind', say: { en: 'Now the rows and columns can differ, so it is a rectangular matrix.', ml: 'ഇപ്പോൾ വരികളും നിരകളും വ്യത്യസ്തമാകാം, അതിനാൽ ഇത് ദീർഘചതുര മാട്രിക്സ് ആണ്.' } },
  ],
};

export const MATRIX_NUMBERS_SAMPLE: MatrixPlan = {
  name: 'B',
  rows: 2,
  cols: 3,
  entries: [[1, 2, 3], [4, 5, 6]],
  steps: [
    { op: 'show', say: { en: 'This matrix has numbers as its entries.', ml: 'ഈ മാട്രിക്സിന്റെ എൻട്രികൾ സംഖ്യകളാണ്.' } },
    { op: 'row', index: 1, say: { en: 'The second row is 4, 5, 6.', ml: 'രണ്ടാം വരി 4, 5, 6 ആണ്.' } },
    { op: 'column', index: 2, say: { en: 'The third column is 3 over 6.', ml: 'മൂന്നാം നിര 3, 6 ആണ്.' } },
    { op: 'size', say: { en: 'Two rows and three columns: a 2 by 3 matrix.', ml: 'രണ്ട് വരികളും മൂന്ന് നിരകളും: 2 ഗുണം 3 മാട്രിക്സ്.' } },
    { op: 'kind', say: { en: 'The rows and columns differ, so it is rectangular.', ml: 'വരികളും നിരകളും വ്യത്യസ്തമാണ്, അതിനാൽ ഇത് ദീർഘചതുരമാണ്.' } },
  ],
};
