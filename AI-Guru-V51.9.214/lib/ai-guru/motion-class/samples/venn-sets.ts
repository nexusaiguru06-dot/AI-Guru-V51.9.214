/**
 * Golden examples for the venn-sets DNA (V51.9.26): the operations of the Set Operations reference
 * clip (intersection, union, complement, differences, De Morgan), a numeric example where the app
 * lists and counts, and a three-set picture. Written fresh for AI Guru; bilingual (the Malayalam is
 * a draft for a teacher to check); passes the validator.
 */

import type { VennPlan } from '../dna/types';

export const VENN_OPERATIONS_SAMPLE: VennPlan = {
  title: { en: 'Set operations', ml: 'ഗണക്രിയകൾ' },
  sets: 2,
  steps: [
    { op: 'show', say: { en: 'The rectangle is the universal set. A and B are two sets inside it.', ml: 'ചതുരം സാർവിക ഗണമാണ്. അതിനുള്ളിലെ രണ്ട് ഗണങ്ങളാണ് A-യും B-യും.' } },
    { op: 'shade', expr: 'A∩B', say: { en: 'What lies in both A and B is the intersection.', ml: 'A-യിലും B-യിലും ഉള്ളത് ഛേദം.' } },
    { op: 'shade', expr: 'A∪B', say: { en: 'What lies in A or B or both is the union.', ml: 'A-യിലോ B-യിലോ രണ്ടിലുമോ ഉള്ളത് യോഗം.' } },
    { op: 'shade', expr: "A'", say: { en: 'Everything outside A is the complement of A.', ml: 'A-യ്ക്ക് പുറത്തുള്ളതെല്ലാം A-യുടെ പൂരകം.' } },
    { op: 'shade', expr: 'A−B', say: { en: 'The part of A that is not in B is A minus B.', ml: 'A-യിൽ ഉള്ളതും B-യിൽ ഇല്ലാത്തതുമായ ഭാഗം A − B.' } },
    { op: 'shade', expr: 'B−A', say: { en: 'And the part of B that is not in A is B minus A.', ml: 'B-യിൽ ഉള്ളതും A-യിൽ ഇല്ലാത്തതുമായ ഭാഗം B − A.' } },
    { op: 'shade', expr: "A'∪B", say: { en: 'The complement of A together with B.', ml: 'A-യുടെ പൂരകവും B-യും ചേർന്നത്.' } },
    { op: 'shade', expr: "(A∩B)'", say: { en: 'Now the complement of the intersection: everything except the overlap.', ml: 'ഇനി ഛേദത്തിന്റെ പൂരകം: ഓവർലാപ്പ് ഒഴികെ എല്ലാം.' } },
    { op: 'identity', left: "A'∪B'", right: "(A∩B)'", say: { en: "Shade the complement of A together with the complement of B. It is the same region. This is De Morgan's law.", ml: 'A-യുടെ പൂരകവും B-യുടെ പൂരകവും ചേർന്ന ഭാഗം നിറം നൽകുക. അത് അതേ ഭാഗം തന്നെ. ഇതാണ് ഡി മോർഗൻ നിയമം.' } },
    { op: 'identity', left: "A'∩B'", right: "(A∪B)'", say: { en: 'And the complement of a union is the intersection of the complements.', ml: 'യോഗത്തിന്റെ പൂരകം പൂരകങ്ങളുടെ ഛേദമാണ്.' } },
  ],
};

export const VENN_ELEMENTS_SAMPLE: VennPlan = {
  sets: 2,
  labels: [{ en: 'Even', ml: 'ഇരട്ട' }, { en: 'Small', ml: 'ചെറിയ' }],
  elements: [[2, 4, 6, 8], [1, 2, 3, 4]],
  outside: [5, 7],
  steps: [
    { op: 'show', say: { en: 'A holds the even numbers up to 8. B holds the numbers 1 to 4.', ml: 'A-യിൽ 8 വരെയുള്ള ഇരട്ട സംഖ്യകൾ. B-യിൽ 1 മുതൽ 4 വരെയുള്ള സംഖ്യകൾ.' } },
    { op: 'list', expr: 'A∩B', say: { en: 'Numbers in both sets sit in the overlap.', ml: 'രണ്ട് ഗണങ്ങളിലും ഉള്ള സംഖ്യകൾ ഓവർലാപ്പിൽ.' } },
    { op: 'list', expr: 'A∪B', say: { en: 'The union lists everything in either set, each number once.', ml: 'യോഗത്തിൽ ഏതെങ്കിലും ഗണത്തിലുള്ള എല്ലാ സംഖ്യകളും, ഓരോന്നും ഒരു തവണ.' } },
    { op: 'list', expr: "A'", say: { en: 'The complement of A is everything in the rectangle that is not in A.', ml: 'ചതുരത്തിൽ A-യിൽ ഇല്ലാത്തതെല്ലാം A-യുടെ പൂരകം.' } },
    { op: 'inclusion', say: { en: 'Count the union: 4 plus 4, minus the 2 counted twice.', ml: 'യോഗം എണ്ണാം: 4 + 4, രണ്ടുതവണ എണ്ണിയ 2 കുറയ്ക്കുക.' } },
  ],
};

export const VENN_THREE_SAMPLE: VennPlan = {
  sets: 3,
  steps: [
    { op: 'show', say: { en: 'Three sets A, B and C can overlap in seven different regions.', ml: 'A, B, C എന്നീ മൂന്ന് ഗണങ്ങൾ ഏഴ് വ്യത്യസ്ത ഭാഗങ്ങളിൽ ഓവർലാപ്പ് ചെയ്യാം.' } },
    { op: 'shade', expr: 'A∩B∩C', say: { en: 'The middle is in all three.', ml: 'നടുവിലുള്ളത് മൂന്നിലും ഉണ്ട്.' } },
    { op: 'shade', expr: '(A∩B)−C', say: { en: 'In A and B but not in C.', ml: 'A-യിലും B-യിലും ഉള്ളതും C-യിൽ ഇല്ലാത്തതും.' } },
    { op: 'shade', expr: 'A∪B∪C', say: { en: 'The union is everything in at least one circle.', ml: 'യോഗം ഏതെങ്കിലും ഒരു വൃത്തത്തിലുള്ള എല്ലാം.' } },
    { op: 'identity', left: "A'∩B'∩C'", right: "(A∪B∪C)'", say: { en: "De Morgan again: outside all three circles.", ml: 'വീണ്ടും ഡി മോർഗൻ: മൂന്ന് വൃത്തങ്ങൾക്കും പുറത്ത്.' } },
  ],
};
