/**
 * Golden examples for the pie chart DNA (V51.9.35). Written fresh for AI Guru; bilingual (the
 * Malayalam is a draft for a teacher to check); every sample passes the validator.
 */

import type { PiePlan } from '../dna/types';

export const PIE_SUBJECT_SAMPLE: PiePlan = {
  title: { en: 'Drawing a pie chart', ml: 'പൈ ചാർട്ട് വരയ്ക്കാം' },
  labels: ['Maths', 'Art', 'Music'],
  values: [30, 50, 40],
  steps: [
    { op: 'show', say: { en: 'A class of students chose their favourite subject. Here is the data.', ml: 'ഒരു ക്ലാസിലെ കുട്ടികൾ ഇഷ്ടപ്പെട്ട വിഷയം തിരഞ്ഞെടുത്തു. ഇതാ വിവരങ്ങൾ.' } },
    { op: 'total', say: { en: 'Add the values to get the total number of students.', ml: 'മൂല്യങ്ങൾ കൂട്ടി ആകെ കുട്ടികളുടെ എണ്ണം കണ്ടെത്തുക.' } },
    { op: 'angle', say: { en: 'The whole circle is 360 degrees. Each sector is its share of it.', ml: 'മുഴുവൻ വൃത്തം 360° ആണ്. ഓരോ സെക്ടറും അതിന്റെ പങ്കാണ്.' } },
    { op: 'percent', say: { en: 'The same shares as percentages.', ml: 'അതേ പങ്കുകൾ ശതമാനമായി.' } },
    { op: 'check', say: { en: 'The three angles add up to 360 degrees.', ml: 'മൂന്ന് കോണുകൾ കൂട്ടിയാൽ 360° കിട്ടും.' } },
  ],
};

export const PIE_SIX_SAMPLE: PiePlan = {
  labels: ['Rice', 'Wheat', 'Maize', 'Ragi', 'Pulses', 'Oats'],
  values: [12, 9, 6, 3, 4, 2],
  steps: [
    { op: 'show', say: { en: 'The area under six crops on a farm.', ml: 'ഒരു കൃഷിയിടത്തിലെ ആറ് വിളകൾക്കുള്ള സ്ഥലം.' } },
    { op: 'total', say: { en: 'The total is 36.', ml: 'ആകെ 36 ആണ്.' } },
    { op: 'angle', say: { en: 'Each angle is its value over 36 times 360 degrees.', ml: 'ഓരോ കോണും അതിന്റെ വില ÷ 36 × 360° ആണ്.' } },
  ],
};

export const PIE_TWO_SAMPLE: PiePlan = {
  values: [45, 75],
  steps: [
    { op: 'show', say: { en: 'Two groups, A and B.', ml: 'A, B എന്നീ രണ്ട് വിഭാഗങ്ങൾ.' } },
    { op: 'angle', say: { en: 'Each sector is its share of 360 degrees.', ml: 'ഓരോ സെക്ടറും 360° യുടെ പങ്കാണ്.' } },
    { op: 'check', say: { en: 'The angles make a full circle.', ml: 'കോണുകൾ ചേർന്ന് ഒരു പൂർണ വൃത്തമാകുന്നു.' } },
  ],
};
