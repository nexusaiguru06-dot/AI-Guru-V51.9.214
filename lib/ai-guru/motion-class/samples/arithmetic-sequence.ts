/**
 * Golden examples for the arithmetic-sequence DNA (V51.9.29): a full lesson (terms, common
 * difference, formula, a far term, "is 99 a term?", the sum, the graph) and a shorter one with a
 * negative difference, Gauss pairing, a number that is NOT a term, and an odd-n sum. Written fresh for
 * AI Guru; bilingual (the Malayalam is a draft for a teacher to check); passes the validator.
 */

import type { SeqPlan } from '../dna/types';

export const SEQ_FULL_SAMPLE: SeqPlan = {
  title: { en: 'Arithmetic sequences', ml: 'സമാന്തര ശ്രേണികൾ' },
  a: 3,
  d: 4,
  terms: 6,
  steps: [
    { op: 'show', say: { en: 'Here are some numbers, one after another.', ml: 'ഇതാ ഒന്നിനു പിറകേ ഒന്നായി കുറേ സംഖ്യകൾ.' } },
    { op: 'diff', say: { en: 'Each term is the one before it plus the same number. That number is the common difference.', ml: 'ഓരോ പദവും തൊട്ടു മുമ്പത്തേതിനോട് ഒരേ സംഖ്യ കൂട്ടിയതാണ്. ആ സംഖ്യയാണ് പൊതുവ്യത്യാസം.' } },
    { op: 'formula', say: { en: 'So the n-th term is the first term plus n minus 1 times the common difference.', ml: 'അതിനാൽ n-ാം പദം ആദ്യപദത്തോട് n − 1 തവണ പൊതുവ്യത്യാസം കൂട്ടിയതാണ്.' } },
    { op: 'term', n: 20, say: { en: 'The twentieth term, without writing the other nineteen.', ml: 'ബാക്കി പത്തൊമ്പതെണ്ണം എഴുതാതെ ഇരുപതാം പദം.' } },
    { op: 'test', value: 99, say: { en: 'Is 99 a term? Solve for n. It is a whole number, so yes.', ml: '99 ഒരു പദമാണോ? n കണ്ടെത്തുക. അതൊരു അഖണ്ഡസംഖ്യയാണ്, അതിനാൽ അതെ.' } },
    { op: 'sum', n: 20, say: { en: 'The sum of the first twenty terms.', ml: 'ആദ്യത്തെ ഇരുപത് പദങ്ങളുടെ തുക.' } },
    { op: 'graph', say: { en: 'Plot each term against its number. The points lie on a straight line.', ml: 'ഓരോ പദവും അതിന്റെ സ്ഥാനസംഖ്യയ്ക്കെതിരെ അടയാളപ്പെടുത്തുക. ബിന്ദുക്കൾ ഒരു നേർരേഖയിൽ.' } },
  ],
};

export const SEQ_PAIRS_SAMPLE: SeqPlan = {
  a: 5,
  d: -3,
  terms: 4,
  steps: [
    { op: 'show', say: { en: 'This sequence goes down.', ml: 'ഈ ശ്രേണി താഴേക്ക് പോകുന്നു.' } },
    { op: 'diff', say: { en: 'The common difference is negative.', ml: 'പൊതുവ്യത്യാസം ഋണസംഖ്യയാണ്.' } },
    { op: 'pairs', say: { en: 'Pair the first with the last, the second with the second last: every pair has the same sum.', ml: 'ആദ്യത്തേതിനെ അവസാനത്തേതുമായും രണ്ടാമത്തേതിനെ അവസാനത്തിന് തൊട്ടുമുമ്പുള്ളതുമായും ചേർക്കുക: എല്ലാ ജോടികൾക്കും ഒരേ തുക.' } },
    { op: 'formula', say: { en: 'The n-th term formula.', ml: 'n-ാം പദത്തിന്റെ സൂത്രവാക്യം.' } },
    { op: 'test', value: 7, say: { en: 'Is 7 a term? Solving for n does not give a whole number, so no.', ml: '7 ഒരു പദമാണോ? n കണ്ടെത്തിയാൽ അഖണ്ഡസംഖ്യ കിട്ടില്ല, അതിനാൽ അല്ല.' } },
    { op: 'sum', n: 15, say: { en: 'The sum of fifteen terms.', ml: 'പതിനഞ്ച് പദങ്ങളുടെ തുക.' } },
    { op: 'graph', say: { en: 'The points fall along a straight line going down.', ml: 'ബിന്ദുക്കൾ താഴേക്കുള്ള ഒരു നേർരേഖയിൽ.' } },
  ],
};
