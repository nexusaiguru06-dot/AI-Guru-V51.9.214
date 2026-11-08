/**
 * Golden examples for the linear-system DNA (V51.9.28): a pair of equations solved three ways
 * (graph, elimination with multiplying, substitution) and checked, ending in matrix form; and a
 * shorter lesson that eliminates both unknowns. Written fresh for AI Guru; bilingual (the Malayalam
 * is a draft for a teacher to check); passes the validator.
 */

import type { LinPlan } from '../dna/types';

export const LIN_FULL_SAMPLE: LinPlan = {
  title: { en: 'A pair of linear equations', ml: 'ഒരു ജോടി ഏകഘാത സമവാക്യങ്ങൾ' },
  e1: { a: 3, b: 2, c: 12 },
  e2: { a: 2, b: -1, c: 1 },
  steps: [
    { op: 'show', say: { en: 'Two equations, the same two unknowns: x and y.', ml: 'രണ്ട് സമവാക്യങ്ങൾ, ഒരേ രണ്ട് അജ്ഞാതങ്ങൾ: x, y.' } },
    { op: 'graph', say: { en: 'Each equation is a straight line. A solution must lie on both lines.', ml: 'ഓരോ സമവാക്യവും ഒരു നേർരേഖയാണ്. ഉത്തരം രണ്ട് രേഖയിലും ആയിരിക്കണം.' } },
    { op: 'meet', say: { en: 'They meet at exactly one point. Its coordinates are the solution.', ml: 'അവ ഒരേയൊരു ബിന്ദുവിൽ കൂടിമുട്ടുന്നു. അതിന്റെ നിർദേശാങ്കങ്ങളാണ് ഉത്തരം.' } },
    { op: 'eliminate', var: 'y', say: { en: 'Now algebra. Multiply the second equation so the y terms match, then add to remove y.', ml: 'ഇനി ബീജഗണിതം. y പദങ്ങൾ തുല്യമാകാൻ രണ്ടാമത്തെ സമവാക്യത്തെ ഗുണിക്കുക, എന്നിട്ട് കൂട്ടി y ഒഴിവാക്കുക.' } },
    { op: 'substitute', into: 2, say: { en: 'Put x into the second equation to find y.', ml: 'x-ന്റെ വില രണ്ടാമത്തെ സമവാക്യത്തിൽ ആദേശം ചെയ്ത് y കണ്ടെത്തുക.' } },
    { op: 'check', say: { en: 'Check in both equations. Both are true.', ml: 'രണ്ട് സമവാക്യങ്ങളിലും പരിശോധിക്കുക. രണ്ടും ശരിയാണ്.' } },
    { op: 'matrix', say: { en: 'The same system in matrix form: A times x equals b.', ml: 'ഇതേ സമവാക്യങ്ങൾ മാട്രിക്സ് രൂപത്തിൽ: A ഗുണം x തുല്യം b.' } },
  ],
};

export const LIN_BOTH_SAMPLE: LinPlan = {
  e1: { a: 2, b: 3, c: 7 },
  e2: { a: 4, b: -3, c: 5 },
  steps: [
    { op: 'show', say: { en: 'Here is another pair.', ml: 'ഇതാ മറ്റൊരു ജോടി.' } },
    { op: 'eliminate', var: 'y', say: { en: 'The y coefficients are 3 and −3, so adding removes y.', ml: 'y ഗുണകങ്ങൾ 3, −3 ആയതിനാൽ കൂട്ടിയാൽ y പോകും.' } },
    { op: 'eliminate', var: 'x', say: { en: 'To remove x, double the first equation and subtract.', ml: 'x ഒഴിവാക്കാൻ ആദ്യ സമവാക്യത്തെ ഇരട്ടിയാക്കി കുറയ്ക്കുക.' } },
    { op: 'check', say: { en: 'Both values satisfy both equations.', ml: 'രണ്ട് വിലകളും രണ്ട് സമവാക്യങ്ങളെയും തൃപ്തിപ്പെടുത്തുന്നു.' } },
    { op: 'graph', say: { en: 'And the two lines cross at that point.', ml: 'ആ ബിന്ദുവിൽ രണ്ട് രേഖകളും മുറിച്ചുകടക്കുന്നു.' } },
    { op: 'meet', say: { en: 'There it is.', ml: 'ഇതാ.' } },
  ],
};
