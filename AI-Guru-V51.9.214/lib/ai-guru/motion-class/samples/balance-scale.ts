/**
 * Golden examples for the balance-scale DNA (V51.9.43). Written fresh for AI Guru; bilingual (the
 * Malayalam is a draft for a teacher to check); every sample passes the validator.
 */

import type { BalPlan } from '../dna/types';

/** 2x + 5 = 25: the model from the reel (move 5, merge, divide by 2, check). */
export const BAL_TWO_STEP_SAMPLE: BalPlan = {
  title: { en: 'Solve 2x + 5 = 25 on a balance scale', ml: '2x + 5 = 25 ത്രാസിൽ നിർധാരണം ചെയ്യാം' },
  a: 2,
  b: 5,
  c: 25,
  steps: [
    { op: 'show', say: { en: 'Here is the scale. The two pans weigh the same. We want x on its own.', ml: 'ഇതാ ത്രാസ്. രണ്ട് തട്ടിനും ഒരേ ഭാരം. x മാത്രം ഒരു വശത്ത് കിട്ടണം.' } },
    { op: 'move', say: { en: 'Take the 5 off the left pan. The scale tips! Now take 5 off the right pan too: 25 is 20 and 5. The scale is level again.', ml: 'ഇടത് തട്ടിൽനിന്ന് 5 എടുക്കുക. ത്രാസ് ചരിയുന്നു! ഇനി വലത് തട്ടിൽനിന്നും 5 എടുക്കുക: 25 = 20 + 5. ത്രാസ് വീണ്ടും തുല്യമായി.' } },
    { op: 'simplify', say: { en: '25 minus 5 is 20. So 2 x balances 20.', ml: '25 − 5 = 20. അതിനാൽ 2 x ന് 20 ന്റെ ഭാരം.' } },
    { op: 'divide', say: { en: 'Share 20 equally between the 2 x tiles. Divide both pans by 2.', ml: '20 രണ്ട് x-കൾക്കായി തുല്യമായി പങ്കിടുക. രണ്ട് തട്ടിനെയും 2 കൊണ്ട് ഹരിക്കുക.' } },
    { op: 'answer', say: { en: 'One x balances 10. So x is 10.', ml: 'ഒരു x ന് 10 ന്റെ ഭാരം. അതിനാൽ x = 10.' } },
    { op: 'check', say: { en: 'Check: 2 times 10 plus 5 is 25. It balances.', ml: 'പരിശോധിക്കാം: 2 × 10 + 5 = 25. തുല്യമാണ്.' } },
  ],
};

/** x − 3 = 9: the tile that moves is added, not taken away; one x, so no dividing. */
export const BAL_MINUS_SAMPLE: BalPlan = {
  a: 1,
  b: -3,
  c: 9,
  steps: [
    { op: 'show', say: { en: 'Here is the scale. The left pan has x with 3 taken off; the right pan has 9.', ml: 'ഇതാ ത്രാസ്. ഇടത് തട്ടിൽ 3 കുറച്ച x; വലത് തട്ടിൽ 9.' } },
    { op: 'move', say: { en: 'Put 3 on the left pan: it cancels the minus 3, and the scale tips left. Put the same 3 on the right with the 9, and it is level again.', ml: 'ഇടത് തട്ടിൽ 3 വയ്ക്കുക: അത് −3 നെ റദ്ദാക്കുന്നു, ത്രാസ് ഇടത്തേക്ക് ചരിയുന്നു. വലത് തട്ടിൽ 9 ന്റെ കൂടെ അതേ 3 വയ്ക്കുക; വീണ്ടും തുല്യം.' } },
    { op: 'simplify', say: { en: '9 plus 3 is 12. So x is 12.', ml: '9 + 3 = 12. അതിനാൽ x = 12.' } },
    { op: 'check', say: { en: 'Check: 12 minus 3 is 9. It balances.', ml: 'പരിശോധിക്കാം: 12 − 3 = 9. തുല്യമാണ്.' } },
  ],
};

/** 4x = 28: nothing to move, only dividing. */
export const BAL_ONE_STEP_SAMPLE: BalPlan = {
  a: 4,
  b: 0,
  c: 28,
  steps: [
    { op: 'show', say: { en: 'Four x tiles balance 28.', ml: 'നാല് x-കൾ 28 ന് തുല്യം.' } },
    { op: 'divide', say: { en: 'Share 28 equally between the 4 tiles.', ml: '28 നാല് x-കൾക്കായി പങ്കിടുക.' } },
    { op: 'answer', say: { en: 'One x balances 7.', ml: 'ഒരു x ന് 7 ന്റെ ഭാരം.' } },
    { op: 'check', say: { en: 'Check: 4 times 7 is 28.', ml: 'പരിശോധിക്കാം: 4 × 7 = 28.' } },
  ],
};

/** 3n + 4 = 22, a different letter and the widest picture: three tiles, a 4 tile, a 2-digit right tile. */
export const BAL_LETTER_SAMPLE: BalPlan = {
  a: 3,
  b: 4,
  c: 22,
  letter: 'n',
  steps: [
    { op: 'show', say: { en: 'The scale holds three n tiles and 4 on the left, 22 on the right.', ml: 'ഇടത് തട്ടിൽ മൂന്ന് n-ഉം 4-ഉം, വലത് തട്ടിൽ 22.' } },
    { op: 'move', say: { en: 'Take 4 off the left pan, then 4 off the right pan.', ml: 'ഇടത് തട്ടിൽനിന്ന് 4 എടുക്കുക, പിന്നെ വലത് തട്ടിൽനിന്നും 4.' } },
    { op: 'simplify', say: { en: '22 minus 4 is 18.', ml: 'ബാക്കി 22 − 4 = 18.' } },
    { op: 'divide', say: { en: 'Share 18 between the 3 tiles.', ml: '18 മൂന്ന് n-കൾക്കായി പങ്കിടുക.' } },
    { op: 'answer', say: { en: 'One n balances 6.', ml: 'ഒരു n ന് 6 ന്റെ ഭാരം.' } },
    { op: 'check', say: { en: 'Check: 3 times 6 plus 4 is 22.', ml: 'പരിശോധിക്കാം: 3 × 6 + 4 = 22.' } },
  ],
};

/**
 * The table-and-chair problem on the scale (prices in rupees, scale ×1000). x = price of a chair, y = price of the table;
 * x + y = 11000 and 4x + y = 14000. Subtracting the first from the second leaves 3x = 3000 (one-unknown, no b); then the
 * chair's price goes back into x + y = 11000, which is y + 1000 = 11000 (a = 1, b = 1).
 */
export const BAL_CHAIR_SAMPLE: BalPlan = {
  title: { en: 'Take the first equation away from the second: 3 chairs weigh 3000', ml: 'രണ്ടാമത്തെ സമവാക്യത്തിൽനിന്ന് ആദ്യത്തേത് കുറയ്ക്കാം: 3 കസേരയ്ക്ക് 3000' },
  a: 3,
  b: 0,
  c: 3,
  scale: 1000,
  steps: [
    { op: 'show', say: { en: '4x + y = 14000 minus x + y = 11000: the table cancels. Three chairs cost 3000 rupees.', ml: '4x + y = 14000 ൽനിന്ന് x + y = 11000 കുറച്ചാൽ മേശ റദ്ദാകും. മൂന്ന് കസേരയ്ക്ക് 3000 രൂപ.' } },
    { op: 'divide', say: { en: 'Share 3000 equally between the 3 chairs.', ml: '3000 മൂന്ന് കസേരകൾക്കായി തുല്യമായി പങ്കിടുക.' } },
    { op: 'answer', say: { en: 'One chair costs 1000 rupees.', ml: 'ഒരു കസേരയ്ക്ക് 1000 രൂപ.' } },
    { op: 'check', say: { en: 'Check: 3 chairs at 1000 is 3000. It balances.', ml: 'പരിശോധിക്കാം: 3 കസേര × 1000 = 3000. തുല്യമാണ്.' } },
  ],
};

/** y + 1000 = 11000: the chair's price goes back into x + y = 11000; what is left is the table. */
export const BAL_TABLE_SAMPLE: BalPlan = {
  title: { en: 'A chair is 1000. Now find the table from x + y = 11000', ml: 'കസേര 1000. ഇനി x + y = 11000 ൽനിന്ന് മേശയുടെ വില കണ്ടെത്താം' },
  a: 1,
  b: 1,
  c: 11,
  scale: 1000,
  letter: 'y',
  steps: [
    { op: 'show', say: { en: 'Put the chair, 1000, into x + y = 11000. The table y and a 1000 chair balance 11000.', ml: 'x + y = 11000 ൽ കസേരയുടെ വില 1000 ഇടുക. മേശ y യും 1000 കസേരയും 11000 ന് തുല്യം.' } },
    { op: 'move', say: { en: 'Take the 1000 chair off the left pan, and 1000 off the right pan too.', ml: 'ഇടത് തട്ടിൽനിന്ന് 1000 എടുക്കുക; വലത് തട്ടിൽനിന്നും 1000.' } },
    { op: 'simplify', say: { en: '11000 minus 1000 is 10000. The table costs 10000 rupees.', ml: '11000 − 1000 = 10000. മേശയ്ക്ക് 10000 രൂപ.' } },
    { op: 'check', say: { en: 'Check: 10000 plus 1000 is 11000. It balances.', ml: 'പരിശോധിക്കാം: 10000 + 1000 = 11000. തുല്യമാണ്.' } },
  ],
};

/** 3x + 2 = x + 10: x on both sides. The same x tiles come off both pans first, then it is a two-step equation. */
export const BAL_BOTH_SAMPLE: BalPlan = {
  title: { en: 'x on both sides: 3x + 2 = x + 10', ml: 'ഇരുവശത്തും x: 3x + 2 = x + 10' },
  a: 3,
  b: 2,
  c: 10,
  d: 1,
  steps: [
    { op: 'show', say: { en: 'The left pan has three x tiles and 2. The right pan has one x tile and 10. The scale is level.', ml: 'ഇടത് തട്ടിൽ മൂന്ന് x-ഉം 2-ഉം. വലത് തട്ടിൽ ഒരു x-ഉം 10-ഉം. ത്രാസ് തുല്യമാണ്.' } },
    { op: 'cancel', say: { en: 'Take one x off each pan. The same is taken from both sides, so the scale stays level.', ml: 'ഓരോ തട്ടിൽനിന്നും ഒരു x എടുക്കുക. ഇരുവശത്തുനിന്നും ഒരേപോലെ എടുക്കുന്നതിനാൽ ത്രാസ് തുല്യമായി നിൽക്കും.' } },
    { op: 'move', say: { en: 'Now take 2 off both pans.', ml: 'ഇനി രണ്ട് തട്ടിൽനിന്നും 2 എടുക്കുക.' } },
    { op: 'simplify', say: { en: '10 minus 2 is 8. So 2 x balances 8.', ml: '10 − 2 = 8. അതിനാൽ 2 x ന് 8 ന്റെ ഭാരം.' } },
    { op: 'divide', say: { en: 'Share 8 between the 2 x tiles.', ml: '8 രണ്ട് x-കൾക്കായി പങ്കിടുക.' } },
    { op: 'answer', say: { en: 'One x balances 4. So x is 4.', ml: 'ഒരു x ന് 4 ന്റെ ഭാരം. അതിനാൽ x = 4.' } },
    { op: 'check', say: { en: 'Check: 3 times 4 plus 2 is 14, and 4 plus 10 is 14. It balances.', ml: 'പരിശോധിക്കാം: 3 × 4 + 2 = 14, 4 + 10 = 14. തുല്യമാണ്.' } },
  ],
};

/** The beads problem from the Pairs of Equations chapter: x + (x − 10) = 100, so 2x − 10 = 100 and x = 55. */
export const BAL_BEADS_SAMPLE: BalPlan = {
  title: { en: '100 beads: 10 more black than white', ml: '100 മുത്തുകൾ: വെളുപ്പിനെക്കാൾ 10 കൂടുതൽ കറുപ്പ്' },
  a: 2,
  b: -10,
  c: 100,
  steps: [
    { op: 'show', say: { en: 'Black beads are x, white beads are x minus 10. Together they are 100. So 2 x minus 10 balances 100.', ml: 'കറുത്ത മുത്തുകൾ x, വെളുത്തവ x − 10. ആകെ 100. അതിനാൽ 2x − 10 ന് 100 ന്റെ ഭാരം.' } },
    { op: 'move', say: { en: 'Put 10 on both pans, so the scale stays level.', ml: 'രണ്ട് തട്ടിലും 10 വയ്ക്കുക.' } },
    { op: 'simplify', say: { en: '100 plus 10 is 110. So 2 x balances 110.', ml: '100 + 10 = 110. അതിനാൽ 2 x ന് 110.' } },
    { op: 'divide', say: { en: 'Share 110 between the 2 x tiles.', ml: '110 രണ്ട് x-കൾക്കായി പങ്കിടുക.' } },
    { op: 'answer', say: { en: 'One x balances 55. So there are 55 black beads, and 45 white.', ml: 'ഒരു x ന് 55. അതിനാൽ 55 കറുത്ത മുത്തുകൾ, 45 വെളുത്തവ.' } },
    { op: 'check', say: { en: 'Check: 2 times 55 minus 10 is 100.', ml: 'പരിശോധിക്കാം: 2 × 55 − 10 = 100.' } },
  ],
};

export const BAL_SAMPLES: BalPlan[] = [BAL_TWO_STEP_SAMPLE, BAL_BOTH_SAMPLE, BAL_BEADS_SAMPLE, BAL_MINUS_SAMPLE, BAL_ONE_STEP_SAMPLE, BAL_LETTER_SAMPLE, BAL_CHAIR_SAMPLE, BAL_TABLE_SAMPLE];
