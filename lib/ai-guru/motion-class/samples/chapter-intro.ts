/**
 * Golden example for the chapter-intro DNA (V51.9.58): the opening of the chapter "Pairs of Equations".
 * The Malayalam is a draft for a teacher to check; the plan passes the validator.
 */

import type { ChapterIntroPlan } from '../dna/types';

export const PAIRS_INTRO_SAMPLE: ChapterIntroPlan = {
  title: { en: 'Pairs of Equations', ml: 'സമവാക്യ ജോഡികൾ' },
  formulas: ['x + y = 100', '2x − 10 = 100', 'x − y = 10', '3x + 5 = 20', '2x + y = 13', 'x + y = 8'],
  topics: [
    {
      name: { en: 'Mental math and algebra', ml: 'മനക്കണക്കും ബീജഗണിതവും' },
      say: { en: 'Mental math and algebra. A number puzzle: two times a number, less 10, is 100. We find the number is 55.', ml: 'മനക്കണക്കും ബീജഗണിതവും. ഒരു സംഖ്യയുടെ ഇരട്ടിയിൽനിന്ന് 10 കുറച്ചാൽ 100. സംഖ്യ 55 എന്ന് കണ്ടെത്താം.' },
      example: { kind: 'solve', a: 2, b: -10, c: 100 },
    },
    {
      name: { en: 'Two unknowns, two equations', ml: 'രണ്ട് അജ്ഞാതങ്ങൾ, രണ്ട് സമവാക്യങ്ങൾ' },
      say: { en: 'Sometimes there are two unknowns, so we need two equations. Together they give x and y.', ml: 'ചിലപ്പോൾ രണ്ട് അജ്ഞാതങ്ങൾ ഉണ്ടാകും; അപ്പോൾ രണ്ട് സമവാക്യങ്ങൾ വേണം. അവ ഒരുമിച്ച് x ഉം y ഉം തരുന്നു.' },
      example: { kind: 'pair', e1: { a: 1, b: 1, c: 100 }, e2: { a: 1, b: -1, c: 10 } },
    },
    {
      name: { en: 'The balance method', ml: 'ത്രാസ് രീതി' },
      say: { en: 'The balance method: whatever we do to one pan, we do to the other.', ml: 'ത്രാസ് രീതി: ഒരു തട്ടിൽ ചെയ്യുന്നത് മറ്റേ തട്ടിലും ചെയ്യണം.' },
      example: { kind: 'solve', a: 3, b: 5, c: 20 },
    },
    {
      name: { en: 'Solving by elimination', ml: 'ഒഴിവാക്കൽ രീതി' },
      say: { en: 'Elimination: subtract one equation from the other, and one unknown disappears.', ml: 'ഒഴിവാക്കൽ രീതി: ഒരു സമവാക്യം മറ്റേതിൽനിന്ന് കുറച്ചാൽ ഒരു അജ്ഞാതം ഇല്ലാതാകും.' },
      example: { kind: 'pair', e1: { a: 2, b: 1, c: 13 }, e2: { a: 1, b: 1, c: 8 } },
    },
    {
      name: { en: 'Word problems', ml: 'പ്രശ്നങ്ങൾ' },
      say: { en: 'Word problems: we turn the story into equations, and then solve them.', ml: 'പ്രശ്നങ്ങൾ: കഥയെ സമവാക്യങ്ങളാക്കി മാറ്റി നിർധാരണം ചെയ്യുന്നു.' },
    },
  ],
  welcome: { en: 'Welcome to the chapter Pairs of Equations. Let us see what we are going to learn.', ml: 'സമവാക്യ ജോഡികൾ എന്ന അധ്യായത്തിലേക്ക് സ്വാഗതം. ഈ അധ്യായത്തിൽ നമ്മൾ എന്തൊക്കെ പഠിക്കും എന്ന് നോക്കാം.' },
  closing: { en: 'That is our plan: mental math and algebra, two unknowns, the balance method, elimination and word problems. Let us begin.', ml: 'ഇതാണ് നമ്മുടെ പദ്ധതി: മനക്കണക്കും ബീജഗണിതവും, രണ്ട് അജ്ഞാതങ്ങൾ, ത്രാസ് രീതി, ഒഴിവാക്കൽ, പ്രശ്നങ്ങൾ. നമുക്ക് തുടങ്ങാം.' },
};
