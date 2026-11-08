/**
 * Golden examples for the number-line fractions DNA (V51.9.36). Written fresh for AI Guru;
 * bilingual (the Malayalam is a draft for a teacher to check); every sample passes the validator.
 */

import type { FracLinePlan } from '../dna/types';

export const FL_MARK_SAMPLE: FracLinePlan = {
  title: { en: 'Fractions on the number line', ml: 'സംഖ്യാരേഖയിൽ ഭിന്നസംഖ്യകൾ' },
  kind: 'mark',
  fracs: [[1, 2], [3, 4], [5, 4]],
  steps: [
    { op: 'show', say: { en: 'Here is a number line with the whole numbers 0, 1 and 2.', ml: 'ഇതാ 0, 1, 2 എന്നീ പൂർണ്ണസംഖ്യകളുള്ള സംഖ്യാരേഖ.' } },
    { op: 'divide', say: { en: 'Cut each whole into four equal parts. One part is one quarter.', ml: 'ഓരോ പൂർണ്ണസംഖ്യയെയും നാല് തുല്യ ഭാഗങ്ങളാക്കുക. ഒരു ഭാഗം നാലിലൊന്നാണ്.' } },
    { op: 'mark', say: { en: 'Count the quarters from zero and put a dot for each fraction.', ml: 'പൂജ്യത്തിൽ നിന്ന് നാലിലൊന്നുകൾ എണ്ണി ഓരോ ഭിന്നസംഖ്യയ്ക്കും ബിന്ദു ഇടുക.' } },
    { op: 'mixed', say: { en: 'Five quarters is more than one: one whole and one quarter.', ml: 'നാലിൽ അഞ്ച് ഒന്നിൽ കൂടുതലാണ്: ഒരു പൂർണ്ണസംഖ്യയും നാലിലൊന്നും.' } },
  ],
};

export const FL_EQUIV_SAMPLE: FracLinePlan = {
  kind: 'equivalent',
  frac: [2, 3],
  k: 2,
  steps: [
    { op: 'show', say: { en: 'Two thirds on the number line.', ml: 'സംഖ്യാരേഖയിൽ മൂന്നിൽ രണ്ട്.' } },
    { op: 'scale', say: { en: 'Cut every third into two parts. The dot does not move.', ml: 'ഓരോ മൂന്നിലൊന്നിനെയും രണ്ട് ഭാഗമാക്കുക. ബിന്ദു നീങ്ങുന്നില്ല.' } },
    { op: 'result', say: { en: 'Two thirds and four sixths are the same point.', ml: 'മൂന്നിൽ രണ്ടും ആറിൽ നാലും ഒരേ ബിന്ദുവാണ്.' } },
  ],
};

export const FL_COMPARE_SAMPLE: FracLinePlan = {
  kind: 'compare',
  fracs: [[2, 3], [3, 4]],
  steps: [
    { op: 'show', say: { en: 'Mark two thirds and three quarters.', ml: 'മൂന്നിൽ രണ്ടും നാലിൽ മൂന്നും അടയാളപ്പെടുത്തുക.' } },
    { op: 'common', say: { en: 'Cut the line in twelfths and write both fractions in twelfths.', ml: 'രേഖ പന്ത്രണ്ടിലൊന്നുകളാക്കി രണ്ടും പന്ത്രണ്ടിലൊന്നുകളിൽ എഴുതുക.' } },
    { op: 'result', say: { en: 'Nine twelfths is farther from zero, so three quarters is greater.', ml: 'പന്ത്രണ്ടിൽ ഒമ്പത് പൂജ്യത്തിൽ നിന്ന് കൂടുതൽ അകലെയാണ്, അതിനാൽ നാലിൽ മൂന്ന് വലുതാണ്.' } },
  ],
};

export const FL_ADD_SAMPLE: FracLinePlan = {
  kind: 'add',
  fracs: [[1, 2], [1, 3]],
  steps: [
    { op: 'show', say: { en: 'Start at one half on the number line.', ml: 'സംഖ്യാരേഖയിൽ രണ്ടിലൊന്നിൽ തുടങ്ങാം.' } },
    { op: 'jump', say: { en: 'Jump one third to the right.', ml: 'മൂന്നിലൊന്ന് വലത്തേക്ക് ചാടുക.' } },
    { op: 'common', say: { en: 'The line is cut in sixths, so write both fractions in sixths.', ml: 'രേഖ ആറിലൊന്നുകളായി മുറിച്ചിരിക്കുന്നു, അതിനാൽ രണ്ടും ആറിലൊന്നുകളിൽ എഴുതുക.' } },
    { op: 'result', say: { en: 'We land on five sixths.', ml: 'നമ്മൾ ആറിൽ അഞ്ചിൽ എത്തുന്നു.' } },
  ],
};

export const FL_SUB_SAMPLE: FracLinePlan = {
  kind: 'add',
  op: 'sub',
  fracs: [[5, 4], [1, 2]],
  steps: [
    { op: 'show', say: { en: 'Start at five quarters.', ml: 'നാലിൽ അഞ്ചിൽ തുടങ്ങാം.' } },
    { op: 'jump', say: { en: 'Subtract one half: jump to the left.', ml: 'രണ്ടിലൊന്ന് കുറയ്ക്കുക: ഇടത്തേക്ക് ചാടുക.' } },
    { op: 'common', say: { en: 'Write both in quarters.', ml: 'രണ്ടും നാലിലൊന്നുകളിൽ എഴുതുക.' } },
    { op: 'result', say: { en: 'We land on three quarters.', ml: 'നാലിൽ മൂന്നിൽ എത്തുന്നു.' } },
  ],
};

export const FL_MIXED_ADD_SAMPLE: FracLinePlan = {
  kind: 'add',
  fracs: [[3, 4], [2, 3]],
  steps: [
    { op: 'show', say: { en: 'Start at three quarters.', ml: 'നാലിൽ മൂന്നിൽ തുടങ്ങാം.' } },
    { op: 'jump', say: { en: 'Jump two thirds to the right, past 1.', ml: 'മൂന്നിൽ രണ്ട് വലത്തേക്ക് ചാടുക, 1 കടന്ന്.' } },
    { op: 'result', say: { en: 'The answer is more than one, so it is also a mixed number.', ml: 'ഉത്തരം ഒന്നിൽ കൂടുതലാണ്, അതിനാൽ മിശ്രസംഖ്യയായും എഴുതാം.' } },
  ],
};
