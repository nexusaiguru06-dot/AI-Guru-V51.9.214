/**
 * Golden examples for the square-identity DNA (V51.9.40). Written fresh for AI Guru; bilingual (the
 * Malayalam is a draft for a teacher to check); every sample passes the validator.
 */

import type { SqPlan } from '../dna/types';

export const SQ_SUM_SAMPLE: SqPlan = {
  title: { en: '(a + b)² = a² + 2ab + b², a visual proof', ml: '(a + b)² = a² + 2ab + b² — ഒരു ചിത്രീകരണ തെളിവ്' },
  kind: 'sum',
  a: 3,
  b: 2,
  steps: [
    { op: 'square', say: { en: 'Draw a square whose side is a plus b. Its area is a plus b, squared.', ml: 'a + b വശമുള്ള ഒരു സമചതുരം വരയ്ക്കുക. അതിന്റെ പരപ്പളവ് (a + b)² ആണ്.' } },
    { op: 'tileA', say: { en: 'In one corner put a square with side a. Its area is a squared.', ml: 'ഒരു മൂലയിൽ a വശമുള്ള സമചതുരം വയ്ക്കുക. അതിന്റെ പരപ്പളവ് a² ആണ്.' } },
    { op: 'strips', say: { en: 'Along it fit two rectangles, a by b. Each has area ab.', ml: 'അതിനോട് ചേർന്ന് a × b അളവുള്ള രണ്ട് ചതുരങ്ങൾ വയ്ക്കുക. ഓരോന്നിന്റെയും പരപ്പളവ് ab ആണ്.' } },
    { op: 'tileB', say: { en: 'What is left is a square with side b. Its area is b squared.', ml: 'ബാക്കിയുള്ളത് b വശമുള്ള സമചതുരം. അതിന്റെ പരപ്പളവ് b² ആണ്.' } },
    { op: 'name', say: { en: 'The four pieces: a squared, ab, ab and b squared.', ml: 'നാല് കഷണങ്ങൾ: a², ab, ab, b².' } },
    { op: 'build', say: { en: 'The big square is made of the four pieces, so (a + b) squared is a squared plus 2ab plus b squared.', ml: 'വലിയ സമചതുരം നാല് കഷണങ്ങൾ ചേർന്നതാണ്; അതിനാൽ (a + b)² = a² + 2ab + b².' } },
    { op: 'check', say: { en: 'Try a = 3 and b = 2: both ways give 25.', ml: 'a = 3, b = 2 എടുത്താൽ രണ്ട് വഴിയും 25 കിട്ടും.' } },
  ],
};

/** The shorter side first: tiles in a different order, no check. */
export const SQ_SUM_SWAP_SAMPLE: SqPlan = {
  kind: 'sum',
  a: 2,
  b: 5,
  steps: [
    { op: 'square', say: { en: 'A square of side a plus b.', ml: 'a + b വശമുള്ള സമചതുരം.' } },
    { op: 'tileB', say: { en: 'Put the b by b square in the corner.', ml: 'b × b സമചതുരം ഒരു മൂലയിൽ വയ്ക്കുക.' } },
    { op: 'strips', say: { en: 'Two rectangles a by b.', ml: 'a × b അളവുള്ള രണ്ട് ചതുരങ്ങൾ.' } },
    { op: 'tileA', say: { en: 'And the a by a square.', ml: 'പിന്നെ a × a സമചതുരം.' } },
    { op: 'name', say: { en: 'Name the four pieces.', ml: 'നാല് കഷണങ്ങൾക്കും പേര് നൽകുക.' } },
    { op: 'build', say: { en: 'Add them up.', ml: 'അവയെ കൂട്ടുക.' } },
  ],
};

export const SQ_DIFF_SAMPLE: SqPlan = {
  title: { en: '(a − b)² = a² − 2ab + b²', ml: '(a − b)² = a² − 2ab + b²' },
  kind: 'difference',
  a: 5,
  b: 2,
  steps: [
    { op: 'square', say: { en: 'Start with a square of side a. Its area is a squared. We want the square of side a minus b inside it.', ml: 'a വശമുള്ള സമചതുരത്തിൽ തുടങ്ങാം. പരപ്പളവ് a². അതിനകത്തെ (a − b) വശമുള്ള സമചതുരമാണ് വേണ്ടത്.' } },
    { op: 'strips', say: { en: 'Take away two strips of width b, one on the right and one at the bottom. Each has area ab.', ml: 'b വീതിയുള്ള രണ്ട് പട്ടകൾ മാറ്റുക, ഒന്ന് വലത്തും ഒന്ന് താഴെയും. ഓരോന്നിന്റെയും പരപ്പളവ് ab.' } },
    { op: 'corner', say: { en: 'The corner b by b was taken away twice, so put it back once.', ml: 'മൂലയിലെ b × b രണ്ടുതവണ മാറ്റപ്പെട്ടു; ഒരു തവണ തിരികെ ചേർക്കുക.' } },
    { op: 'name', say: { en: 'What is left is the square of side a minus b.', ml: 'ബാക്കിയാകുന്നത് (a − b) വശമുള്ള സമചതുരം.' } },
    { op: 'build', say: { en: 'So (a − b) squared is a squared, minus ab, minus ab, plus b squared.', ml: 'അതിനാൽ (a − b)² = a² − ab − ab + b².' } },
    { op: 'check', say: { en: 'With a = 5 and b = 2: 9 both ways.', ml: 'a = 5, b = 2 എടുത്താൽ രണ്ട് വഴിയും 9.' } },
  ],
};

export const SQ_DIFF_BIG_SAMPLE: SqPlan = {
  kind: 'difference',
  a: 9,
  b: 3,
  steps: [
    { op: 'square', say: { en: 'A square of side a.', ml: 'a വശമുള്ള സമചതുരം.' } },
    { op: 'strips', say: { en: 'Two strips of width b.', ml: 'b വീതിയുള്ള രണ്ട് പട്ടകൾ.' } },
    { op: 'corner', say: { en: 'The shared corner is put back.', ml: 'പൊതുവായ മൂല തിരികെ ചേർക്കുക.' } },
    { op: 'name', say: { en: 'Name the pieces.', ml: 'കഷണങ്ങൾക്ക് പേര് നൽകുക.' } },
    { op: 'build', say: { en: 'Write the identity.', ml: 'സർവസമവാക്യം എഴുതുക.' } },
  ],
};

export const SQ_PROD_SAMPLE: SqPlan = {
  title: { en: 'a² − b² = (a + b)(a − b)', ml: 'a² − b² = (a + b)(a − b)' },
  kind: 'product',
  a: 6,
  b: 2,
  steps: [
    { op: 'square', say: { en: 'Take a square of side a. Its area is a squared.', ml: 'a വശമുള്ള ഒരു സമചതുരം. പരപ്പളവ് a².' } },
    { op: 'remove', say: { en: 'Cut a small square of side b from a corner. The area left is a squared minus b squared.', ml: 'ഒരു മൂലയിൽനിന്ന് b വശമുള്ള ചെറിയ സമചതുരം മുറിക്കുക. ബാക്കി പരപ്പളവ് a² − b².' } },
    { op: 'cut', say: { en: 'Cut the L-shape into two rectangles.', ml: 'L ആകൃതിയെ രണ്ട് ചതുരങ്ങളായി മുറിക്കുക.' } },
    { op: 'move', say: { en: 'Turn the lower piece and slide it beside the upper one: one rectangle.', ml: 'താഴത്തെ കഷണം തിരിച്ച് മുകളിലത്തേതിനടുത്ത് വയ്ക്കുക: ഒരു ചതുരം.' } },
    { op: 'name', say: { en: 'Its length is a plus b and its width is a minus b.', ml: 'നീളം a + b, വീതി a − b.' } },
    { op: 'build', say: { en: 'So a squared minus b squared is a plus b times a minus b.', ml: 'അതിനാൽ a² − b² = (a + b)(a − b).' } },
    { op: 'check', say: { en: 'With a = 6 and b = 2: 32 both ways.', ml: 'a = 6, b = 2 എടുത്താൽ രണ്ട് വഴിയും 32.' } },
  ],
};
