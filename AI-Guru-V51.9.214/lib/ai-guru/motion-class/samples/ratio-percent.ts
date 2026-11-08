/**
 * Golden examples for the ratio and percent DNA (V51.9.34): sharing in a ratio, a percentage of a
 * quantity, and a percentage increase and decrease, all as bar models. Written fresh for AI Guru;
 * bilingual (the Malayalam is a draft for a teacher to check); every sample passes the validator.
 */

import type { RatioPlan } from '../dna/types';

export const RATIO_SHARE_SAMPLE: RatioPlan = {
  title: { en: 'Sharing in a ratio', ml: 'അംശബന്ധത്തിൽ പങ്കിടുന്നു' },
  kind: 'share',
  parts: [3, 5],
  total: 240,
  unit: 'Rs',
  steps: [
    { op: 'show', say: { en: 'Rs 240 is shared between A and B in the ratio 3 to 5. The bar has 3 blocks for A and 5 for B.', ml: '240 രൂപ A-ക്കും B-ക്കും ഇടയിൽ 3 : 5 എന്ന അംശബന്ധത്തിൽ പങ്കിടുന്നു. A-ക്ക് 3 കട്ടയും B-ക്ക് 5 കട്ടയും.' } },
    { op: 'unit', say: { en: 'All 8 blocks together are worth 240, so one block is 240 divided by 8.', ml: '8 കട്ടകൾക്കും കൂടി 240 ആണ്, അതിനാൽ ഒരു കട്ട 240 ÷ 8 ആണ്.' } },
    { op: 'parts', say: { en: 'A has 3 blocks and B has 5 blocks.', ml: 'A-ക്ക് 3 കട്ടയും B-ക്ക് 5 കട്ടയും ഉണ്ട്.' } },
    { op: 'check', say: { en: 'The two shares add up to 240 again.', ml: 'രണ്ട് പങ്കും കൂട്ടിയാൽ വീണ്ടും 240 കിട്ടും.' } },
  ],
};

export const RATIO_SHARE3_SAMPLE: RatioPlan = {
  kind: 'share',
  parts: [2, 3, 4],
  total: 180,
  steps: [
    { op: 'show', say: { en: 'Three people share 180 in the ratio 2 to 3 to 4.', ml: 'മൂന്ന് പേർ 180 എന്നത് 2 : 3 : 4 എന്ന അംശബന്ധത്തിൽ പങ്കിടുന്നു.' } },
    { op: 'unit', say: { en: 'There are 9 blocks, so one block is 180 divided by 9.', ml: '9 കട്ടകളുണ്ട്, അതിനാൽ ഒരു കട്ട 180 ÷ 9 ആണ്.' } },
    { op: 'parts', say: { en: 'Each share is its blocks times 20.', ml: 'ഓരോ പങ്കും അതിന്റെ കട്ടകൾ × 20 ആണ്.' } },
    { op: 'check', say: { en: 'They add up to 180.', ml: 'അവ കൂട്ടിയാൽ 180 കിട്ടും.' } },
  ],
};

export const PERCENT_SAMPLE: RatioPlan = {
  kind: 'percent',
  whole: 250,
  pct: 12,
  steps: [
    { op: 'show', say: { en: 'The whole, 250, is 100 percent. We want 12 percent of it.', ml: 'മുഴുവൻ, 250, 100 ശതമാനമാണ്. അതിന്റെ 12% ആണ് വേണ്ടത്.' } },
    { op: 'tenth', say: { en: 'Ten equal blocks: each is 10 percent, worth 25.', ml: 'പത്ത് തുല്യ കട്ടകൾ: ഓരോന്നും 10% ആണ്, വില 25.' } },
    { op: 'part', say: { en: 'Shade 12 percent of the bar. It is 12 over 100 times 250.', ml: 'ബാറിന്റെ 12% അടയാളപ്പെടുത്തുക. അത് {12/100} × 250 ആണ്.' } },
    { op: 'result', say: { en: 'So 12 percent of 250 is 30.', ml: 'അതിനാൽ 250-ന്റെ 12% എന്നത് 30 ആണ്.' } },
  ],
};

export const PERCENT_UP_SAMPLE: RatioPlan = {
  kind: 'change',
  whole: 250,
  pct: 20,
  dir: 'up',
  unit: 'Rs',
  steps: [
    { op: 'show', say: { en: 'A price of Rs 250 goes up by 20 percent.', ml: '250 രൂപ വിലയുള്ള സാധനത്തിന് 20% വില കൂടുന്നു.' } },
    { op: 'change', say: { en: 'The extra piece is 20 percent of 250.', ml: 'അധിക ഭാഗം 250-ന്റെ 20% ആണ്.' } },
    { op: 'result', say: { en: 'The new price is the old price plus the extra piece.', ml: 'പുതിയ വില പഴയ വിലയോട് അധിക ഭാഗം കൂട്ടിയതാണ്.' } },
  ],
};

export const PERCENT_DOWN_SAMPLE: RatioPlan = {
  kind: 'change',
  whole: 400,
  pct: 15,
  dir: 'down',
  unit: 'Rs',
  steps: [
    { op: 'show', say: { en: 'A shirt costs Rs 400 and there is a 15 percent discount.', ml: '400 രൂപ വിലയുള്ള ഷർട്ടിന് 15% ഡിസ്കൗണ്ട് ഉണ്ട്.' } },
    { op: 'change', say: { en: 'The discount is 15 percent of 400.', ml: 'ഡിസ്കൗണ്ട് 400-ന്റെ 15% ആണ്.' } },
    { op: 'result', say: { en: 'Take the discount off the price to get what you pay.', ml: 'വിലയിൽ നിന്ന് ഡിസ്കൗണ്ട് കുറച്ചാൽ കൊടുക്കേണ്ട തുക കിട്ടും.' } },
  ],
};
