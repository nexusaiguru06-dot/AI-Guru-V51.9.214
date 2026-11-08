/**
 * Golden examples for the balance-pair DNA (V51.9.55): a pair of equations as two scales, added or
 * subtracted so one unknown cancels. Bilingual (the Malayalam is a draft for a teacher to check);
 * every sample passes the validator.
 */

import type { PairPlan } from '../dna/types';

/** x + y = 100 and x − y = 10 (the beads of the chapter: 55 black, 45 white). Adding cancels y. */
export const PAIR_BEADS_SAMPLE: PairPlan = {
  title: { en: 'Two scales: x + y = 100 and x − y = 10', ml: 'രണ്ട് ത്രാസുകൾ: x + y = 100, x − y = 10' },
  e1: { a: 1, b: 1, c: 100 },
  e2: { a: 1, b: -1, c: 10 },
  steps: [
    { op: 'show', say: { en: 'Each equation is a scale that balances. The first has x and y against 100. The second has x, and y taken away, against 10.', ml: 'ഓരോ സമവാക്യവും തുല്യമായി നിൽക്കുന്ന ഓരോ ത്രാസ്. ആദ്യത്തേതിൽ x, y എന്നിവ 100-നൊപ്പം. രണ്ടാമത്തേതിൽ x-ഉം y കുറച്ചതും 10-നൊപ്പം.' } },
    { op: 'combine', say: { en: 'Put the two scales together. The y and the minus y cancel. What is left is two x against 110.', ml: 'രണ്ട് ത്രാസുകളും ചേർക്കുക. y-ഉം −y-ഉം ഇല്ലാതാകും. ബാക്കി രണ്ട് x, 110-നൊപ്പം.' } },
    { op: 'solve', say: { en: 'Share 110 between the two x tiles. One x is 55.', ml: '110 രണ്ട് x-കൾക്കായി പങ്കിടുക. ഒരു x = 55.' } },
    { op: 'back', say: { en: 'Put 55 in the first scale. Take 55 off both pans. Then y is 45.', ml: 'ആദ്യ ത്രാസിൽ 55 വയ്ക്കുക. രണ്ട് തട്ടിൽനിന്നും 55 എടുക്കുക. അപ്പോൾ y = 45.' } },
    { op: 'check', say: { en: 'Check both scales with 55 and 45. Both balance.', ml: '55, 45 എന്നിവ ഉപയോഗിച്ച് രണ്ട് ത്രാസും പരിശോധിക്കാം. രണ്ടും തുല്യം.' } },
  ],
};

/** x + y = 11000 and 4x + y = 14000 (a table and a chair: 1000 and 10000). Subtracting cancels y. */
export const PAIR_PRICE_SAMPLE: PairPlan = {
  e1: { a: 1, b: 1, c: 11000 },
  e2: { a: 4, b: 1, c: 14000 },
  letters: ['x', 'y'],
  steps: [
    { op: 'show', say: { en: 'A table and a chair weigh 11000 rupees. A table and four chairs weigh 14000. Two scales.', ml: 'ഒരു മേശയും കസേരയും 11000 രൂപ. ഒരു മേശയും നാല് കസേരയും 14000. രണ്ട് ത്രാസുകൾ.' } },
    { op: 'combine', say: { en: 'Take the first scale off the second. The y tiles cancel. Three x are left against 3000.', ml: 'രണ്ടാമത്തെ ത്രാസിൽനിന്ന് ആദ്യത്തേത് മാറ്റുക. y-കൾ ഇല്ലാതാകും. മൂന്ന് x, 3000-നൊപ്പം ബാക്കി.' } },
    { op: 'solve', say: { en: 'Share 3000 between three tiles. One x is 1000.', ml: '3000 മൂന്ന് ടൈലുകൾക്കായി പങ്കിടുക. ഒരു x = 1000.' } },
    { op: 'back', say: { en: 'Put 1000 in the first scale and take it off both pans. y is 10000.', ml: 'ആദ്യ ത്രാസിൽ 1000 വച്ച് രണ്ട് തട്ടിൽനിന്നും എടുക്കുക. y = 10000.' } },
    { op: 'check', say: { en: 'Both scales balance with 1000 and 10000.', ml: '1000, 10000 എന്നിവ ഉപയോഗിച്ച് രണ്ട് ത്രാസും തുല്യം.' } },
  ],
};

/** 2x + 3y = 22 and 2x − y = 6 (x = 5, y = 4): the x tiles cancel; the first value is y, shared between 4 tiles, and then x is shared between 2. */
export const PAIR_SHARE_SAMPLE: PairPlan = {
  e1: { a: 2, b: 3, c: 22 },
  e2: { a: 2, b: -1, c: 6 },
  steps: [
    { op: 'show', say: { en: 'Two scales: two x and three y against 22, and two x with one y taken away against 6.', ml: 'രണ്ട് ത്രാസുകൾ: രണ്ട് x-ഉം മൂന്ന് y-ഉം 22-നൊപ്പം; രണ്ട് x-ഉം ഒരു y കുറച്ചതും 6-നൊപ്പം.' } },
    { op: 'combine', say: { en: 'Take the second scale off the first. The x tiles cancel. Four y are left against 16.', ml: 'ആദ്യ ത്രാസിൽനിന്ന് രണ്ടാമത്തേത് മാറ്റുക. x-കൾ ഇല്ലാതാകും. നാല് y, 16-നൊപ്പം ബാക്കി.' } },
    { op: 'solve', say: { en: 'Share 16 between four tiles. One y is 4.', ml: '16 നാല് ടൈലുകൾക്കായി പങ്കിടുക. ഒരു y = 4.' } },
    { op: 'back', say: { en: 'Put 4 for y in the first scale, take 12 off both pans, and share 10 between two x tiles. x is 5.', ml: 'ആദ്യ ത്രാസിൽ y-ക്ക് പകരം 4 വയ്ക്കുക, രണ്ട് തട്ടിൽനിന്നും 12 എടുക്കുക, 10 രണ്ട് x-കൾക്കായി പങ്കിടുക. x = 5.' } },
    { op: 'check', say: { en: 'Both scales balance with 5 and 4.', ml: '5, 4 എന്നിവ ഉപയോഗിച്ച് രണ്ട് ത്രാസും തുല്യം.' } },
  ],
};

/** 3x + 3y = 18 and 2x − 3y = 2 (x = 4, y = 2): the y tiles are opposite, so adding cancels them. */
export const PAIR_ADD_SAMPLE: PairPlan = {
  e1: { a: 3, b: 3, c: 18 },
  e2: { a: 2, b: -3, c: 2 },
  steps: [
    { op: 'show', say: { en: 'Two scales: three x and three y against 18, and two x with three y taken away against 2.', ml: 'രണ്ട് ത്രാസുകൾ: മൂന്ന് x-ഉം മൂന്ന് y-ഉം 18-നൊപ്പം; രണ്ട് x-ഉം മൂന്ന് y കുറച്ചതും 2-നൊപ്പം.' } },
    { op: 'combine', say: { en: 'Put the scales together. The three y and the three minus y cancel. Five x are left against 20.', ml: 'ത്രാസുകൾ ചേർക്കുക. മൂന്ന് y-ഉം മൂന്ന് −y-ഉം ഇല്ലാതാകും. അഞ്ച് x, 20-നൊപ്പം ബാക്കി.' } },
    { op: 'solve', say: { en: 'Share 20 between five tiles. One x is 4.', ml: '20 അഞ്ച് ടൈലുകൾക്കായി പങ്കിടുക. ഒരു x = 4.' } },
    { op: 'back', say: { en: 'Put 4 for x in the first scale, take 12 off both pans, and share 6 between three y tiles. y is 2.', ml: 'ആദ്യ ത്രാസിൽ x-ന് പകരം 4 വച്ച്, രണ്ട് തട്ടിൽനിന്നും 12 എടുത്ത്, 6 മൂന്ന് y-കൾക്കായി പങ്കിടുക. y = 2.' } },
    { op: 'check', say: { en: 'Both scales balance with 4 and 2.', ml: '4, 2 എന്നിവ ഉപയോഗിച്ച് രണ്ട് ത്രാസും തുല്യം.' } },
  ],
};

export const PAIR_SAMPLES: PairPlan[] = [PAIR_BEADS_SAMPLE, PAIR_PRICE_SAMPLE, PAIR_SHARE_SAMPLE, PAIR_ADD_SAMPLE];
