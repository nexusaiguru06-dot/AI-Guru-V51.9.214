/**
 * Sample plans for SCERT Kerala Mathematics IX Part 1, Chapter 1 "Pairs of
 * Equations", section "Mental math and algebra" (book pages 7–8).
 *
 * Written by hand in exactly the JSON format the AI planner returns, and
 * checked by the same validator (structure, both languages, maths). They serve
 * as golden examples for the planner prompt and as an offline demo class.
 * Keys: the first words of the teaching unit's text.
 */

import type { BlockPlan } from '../dna/types';

type Fixture = Omit<BlockPlan, 'blockId' | 'source'>;

export const SCERT9_CH1_S1: Array<{ startsWith: string; plan: Fixture }> = [
  {
    startsWith: 'Mental math and algebra',
    plan: {
      dna: 'section-intro',
      read: { en: 'Mental math and algebra', ml: 'മനക്കണക്കും ബീജഗണിതവും' },
      teach: {
        heading: { en: 'Mental math and algebra', ml: 'മനക്കണക്കും ബീജഗണിതവും' },
        points: [
          {
            board: { en: 'Work it out *in your head*', ml: '*മനസ്സിൽ* കണക്കുകൂട്ടി നോക്കാം' },
            say: { en: 'Many problems can be worked out in your head, just by reasoning.', ml: 'പല പ്രശ്നങ്ങളും യുക്തി ഉപയോഗിച്ച് മനസ്സിൽ തന്നെ കണ്ടെത്താം.' },
          },
          {
            board: { en: 'Or let *algebra* do the work', ml: 'അല്ലെങ്കിൽ *ബീജഗണിതം* ഉപയോഗിക്കാം' },
            say: { en: 'Or we can call the unknown number x, write an equation and solve it.', ml: 'അല്ലെങ്കിൽ അറിയാത്ത സംഖ്യയെ x എന്നു വിളിച്ച് സമവാക്യം എഴുതി പരിഹരിക്കാം.' },
          },
          {
            board: { en: 'Two unknowns → *a pair of equations*', ml: 'രണ്ട് അജ്ഞാതങ്ങൾ → *സമവാക്യജോടി*' },
            say: { en: 'With two unknown numbers, we write two equations: a pair of equations.', ml: 'രണ്ട് അജ്ഞാതസംഖ്യകളുള്ളപ്പോൾ രണ്ടു സമവാക്യങ്ങൾ എഴുതുന്നു: ഒരു സമവാക്യജോടി.' },
          },
        ],
      },
    },
  },
  {
    startsWith: "Let's start with a problem",
    plan: { dna: 'bridge', read: { en: "Let's start with a problem:", ml: 'ഒരു പ്രശ്നത്തിൽ നിന്നു തുടങ്ങാം:' }, teach: null },
  },
  {
    startsWith: 'There are 100 beads',
    plan: {
      dna: 'word-problem',
      read: {
        en: 'There are 100 beads, black and white, in a box; 10 more black than white. How many black and how many white?',
        ml: 'ഒരു പെട്ടിയിൽ കറുപ്പും വെളുപ്പുമായി 100 മുത്തുകളുണ്ട്; വെളുത്തതിനേക്കാൾ 10 എണ്ണം കൂടുതലാണ് കറുത്തവ. കറുത്തത് എത്ര, വെളുത്തത് എത്ര?',
      },
      teach: {
        statement: {
          en: 'There are 100 beads, black and white, in a box; 10 more black than white. How many black and how many white?',
          ml: 'ഒരു പെട്ടിയിൽ കറുപ്പും വെളുപ്പുമായി 100 മുത്തുകളുണ്ട്; വെളുത്തതിനേക്കാൾ 10 എണ്ണം കൂടുതലാണ് കറുത്തവ. കറുത്തത് എത്ര, വെളുത്തത് എത്ര?',
        },
        highlights: ['100 beads', '10 more black than white'],
        highlightsMl: ['100 മുത്തുകളുണ്ട്', '10 എണ്ണം കൂടുതലാണ് കറുത്തവ'],
        unknowns: [
          { symbol: 'x', meaning: { en: 'number of black beads', ml: 'കറുത്ത മുത്തുകളുടെ എണ്ണം' } },
          { symbol: 'y', meaning: { en: 'number of white beads', ml: 'വെളുത്ത മുത്തുകളുടെ എണ്ണം' } },
        ],
        equations: [
          { phrase: { en: 'Black and white together make 100.', ml: 'കറുപ്പും വെളുപ്പും ചേർന്ന് 100.' }, tokens: ['x', '+', 'y', '=', '100'] },
          { phrase: { en: 'Black is 10 more than white.', ml: 'കറുപ്പ്, വെളുപ്പിനേക്കാൾ 10 കൂടുതൽ.' }, tokens: ['x', '−', 'y', '=', '10'] },
        ],
        solution: {},
        solvedLater: true,
        solutions: [{ x: 55, y: 45 }],
      },
    },
  },
  {
    startsWith: 'This can be thought out',
    plan: { dna: 'bridge', read: { en: 'This can be thought out in different ways.', ml: 'ഇത് പല രീതിയിൽ ആലോചിക്കാം.' }, teach: null },
  },
  {
    startsWith: 'If we keep the extra 10',
    plan: {
      dna: 'mental-math',
      read: {
        en: 'If we keep the extra 10 black beads apart for the time being, there are 90 in the box, with black and white equal; which means 45 each. Now putting back the 10 black removed, there are 55 black and 45 white.',
        ml: 'അധികമുള്ള 10 കറുത്ത മുത്തുകൾ തൽക്കാലം മാറ്റിവച്ചാൽ പെട്ടിയിൽ 90 എണ്ണം ബാക്കി; അവയിൽ കറുപ്പും വെളുപ്പും തുല്യം, അതായത് 45 വീതം. മാറ്റിവച്ച 10 കറുത്തവ തിരികെ ഇട്ടാൽ 55 കറുപ്പും 45 വെളുപ്പും.',
      },
      teach: {
        lines: [
          {
            tokens: ['100', '−', '10', '=', '90'],
            caption: { en: 'Keep the 10 extra black beads aside: 90 are left.', ml: 'അധികമുള്ള 10 കറുത്ത മുത്തുകൾ മാറ്റിവയ്ക്കുക: 90 ബാക്കി.' },
          },
          {
            tokens: ['90', '÷', '2', '=', '45'],
            links: [[4, 0]],
            caption: { en: 'Now black and white are equal: 45 each.', ml: 'ഇപ്പോൾ കറുപ്പും വെളുപ്പും തുല്യം: 45 വീതം.' },
          },
          {
            tokens: ['45', '+', '10', '=', '55'],
            links: [[4, 0], [0, 2, 2]],
            caption: { en: 'Put the 10 black beads back: 55 black.', ml: 'മാറ്റിവച്ച 10 എണ്ണം തിരികെ ഇടുക: 55 കറുപ്പ്.' },
          },
          {
            tokens: ['55', '+', '45', '=', '100'],
            links: [[4, 0], [1, 4, 2], [0, 0, 4]],
            caption: { en: 'Check: 55 black and 45 white make 100.', ml: 'പരിശോധിക്കാം: 55 കറുപ്പും 45 വെളുപ്പും ചേർന്നാൽ 100.' },
          },
        ],
        solutions: [{}],
      },
    },
  },
  {
    startsWith: 'We can use a little bit of algebra',
    plan: {
      dna: 'concept-board',
      read: {
        en: 'We can use a little bit of algebra (Remember the lesson, Equations in Class 8?)',
        ml: 'അൽപം ബീജഗണിതവും ഉപയോഗിക്കാം (എട്ടാം ക്ലാസിലെ സമവാക്യങ്ങൾ എന്ന പാഠം ഓർമ്മയുണ്ടോ?)',
      },
      teach: {
        heading: { en: 'Using algebra', ml: 'ബീജഗണിതം ഉപയോഗിച്ച്' },
        points: [
          {
            board: { en: 'Unknown number → a *letter*', ml: 'അറിയാത്ത സംഖ്യ → ഒരു *അക്ഷരം*' },
            say: { en: 'In algebra we give the unknown number a name, like x.', ml: 'ബീജഗണിതത്തിൽ അറിയാത്ത സംഖ്യയ്ക്ക് x പോലൊരു പേര് നൽകുന്നു.' },
          },
          {
            board: { en: 'What we know → an *equation*', ml: 'അറിയാവുന്നത് → ഒരു *സമവാക്യം*' },
            say: { en: 'Then we write what we know as an equation, and solve it.', ml: 'പിന്നെ അറിയാവുന്ന വിവരങ്ങൾ സമവാക്യമായി എഴുതി പരിഹരിക്കുന്നു.' },
          },
        ],
      },
    },
  },
  {
    startsWith: 'Taking the number of black beads as x',
    plan: {
      dna: 'equation-chain',
      read: {
        en: 'Taking the number of black beads as x, the number of white is x − 10. Since there are 100 altogether,\nx + (x − 10) = 100\nWe can extract x from this:\n2x − 10 = 100\n2x = 110\nx = 55\nThus we get the number of black beads as 55; and subtracting 10 from this, we can get the number of white as 45.',
        ml: 'കറുത്ത മുത്തുകളുടെ എണ്ണം x എന്നെടുത്താൽ, വെളുത്തവയുടെ എണ്ണം x − 10. ആകെ 100 എണ്ണമുള്ളതിനാൽ,\nx + (x − 10) = 100\nഇതിൽ നിന്ന് x കണ്ടെത്താം:\n2x − 10 = 100\n2x = 110\nx = 55\nഅങ്ങനെ കറുത്ത മുത്തുകളുടെ എണ്ണം 55; ഇതിൽ നിന്ന് 10 കുറച്ചാൽ വെളുത്തവയുടെ എണ്ണം 45.',
      },
      teach: {
        lines: [
          {
            tokens: ['x', '+', '(', 'x', '−', '10', ')', '=', '100'],
            caption: { en: 'Black beads x, white beads x − 10; together they make 100.', ml: 'കറുത്തവ x, വെളുത്തവ x − 10; ആകെ 100.' },
          },
          {
            tokens: ['2', 'x', '−', '10', '=', '100'],
            links: [[0, 1], [3, 1]],
            caption: { en: 'x and x together make 2x.', ml: 'x ഉം x ഉം ചേർന്നാൽ 2x.' },
          },
          {
            tokens: ['2', 'x', '=', '110'],
            links: [[3, 3], [5, 3]],
            note: { en: '+10 both sides', ml: 'ഇരുവശത്തും +10' },
            caption: { en: 'Add 10 to both sides: 2x = 110.', ml: 'ഇരുവശത്തും 10 കൂട്ടുക: 2x = 110.' },
          },
          {
            tokens: ['x', '=', '{110/2}'],
            links: [[0, 2], [3, 2]],
            note: { en: '÷2 both sides', ml: 'ഇരുവശവും ÷2' },
            caption: { en: 'Divide both sides by 2.', ml: 'ഇരുവശത്തെയും 2 കൊണ്ട് ഹരിക്കുക.' },
          },
          {
            tokens: ['x', '=', '55'],
            links: [[2, 2]],
            caption: { en: 'So there are 55 black beads.', ml: 'അതിനാൽ കറുത്ത മുത്തുകൾ 55.' },
          },
          {
            tokens: ['55', '−', '10', '=', '45'],
            links: [[2, 0], [0, 5, 2]],
            caption: { en: 'And the white beads: 55 − 10 = 45.', ml: 'വെളുത്ത മുത്തുകൾ: 55 − 10 = 45.' },
          },
        ],
        solutions: [{ x: 55 }],
      },
    },
  },
  {
    startsWith: "Let's look at another one",
    plan: { dna: 'bridge', read: { en: "Let's look at another one:", ml: 'മറ്റൊന്നു നോക്കാം:' }, teach: null },
  },
  {
    startsWith: 'The price of a table and chair',
    plan: {
      dna: 'word-problem',
      read: {
        en: "The price of a table and chair is 11000 rupees. The price of the table and four chairs is 14000 rupees. What's the price of each?",
        ml: 'ഒരു മേശയുടെയും കസേരയുടെയും വില 11000 രൂപ. മേശയുടെയും നാലു കസേരകളുടെയും വില 14000 രൂപ. ഓരോന്നിന്റെയും വില എത്ര?',
      },
      teach: {
        statement: {
          en: "The price of a table and chair is 11000 rupees. The price of the table and four chairs is 14000 rupees. What's the price of each?",
          ml: 'ഒരു മേശയുടെയും കസേരയുടെയും വില 11000 രൂപ. മേശയുടെയും നാലു കസേരകളുടെയും വില 14000 രൂപ. ഓരോന്നിന്റെയും വില എത്ര?',
        },
        highlights: ['table and chair is 11000 rupees', 'table and four chairs is 14000 rupees'],
        highlightsMl: ['മേശയുടെയും കസേരയുടെയും വില 11000 രൂപ', 'മേശയുടെയും നാലു കസേരകളുടെയും വില 14000 രൂപ'],
        unknowns: [
          { symbol: 'x', meaning: { en: 'price of a chair', ml: 'ഒരു കസേരയുടെ വില' } },
          { symbol: 'y', meaning: { en: 'price of the table', ml: 'മേശയുടെ വില' } },
        ],
        equations: [
          { phrase: { en: 'A chair and the table cost 11000.', ml: 'ഒരു കസേരയും മേശയും: 11000.' }, tokens: ['x', '+', 'y', '=', '11000'] },
          { phrase: { en: 'Four chairs and the table cost 14000.', ml: 'നാലു കസേരയും മേശയും: 14000.' }, tokens: ['4', 'x', '+', 'y', '=', '14000'] },
        ],
        solution: {},
        solvedLater: true,
        solutions: [{ x: 1000, y: 10000 }],
      },
    },
  },
  {
    startsWith: 'First see if you can work this out',
    plan: {
      dna: 'mental-math',
      read: {
        en: 'First see if you can work this out in your head. The price of a table and four chairs is 3000 rupees more, because of three extra chairs, right? So, this extra 3000 is the price of 3 chairs; which means the price of a chair is 1000 rupees. And this gives the price of the table as 10000 rupees.',
        ml: 'ആദ്യം ഇത് മനസ്സിൽ കണ്ടെത്താൻ ശ്രമിക്കൂ. മേശയുടെയും നാലു കസേരകളുടെയും വില 3000 രൂപ കൂടുതലാണ്; മൂന്നു കസേരകൾ കൂടുതലുള്ളതുകൊണ്ടല്ലേ? അപ്പോൾ ഈ അധികമുള്ള 3000 രൂപ 3 കസേരകളുടെ വിലയാണ്; അതായത് ഒരു കസേരയുടെ വില 1000 രൂപ. അങ്ങനെ മേശയുടെ വില 10000 രൂപ.',
      },
      teach: {
        lines: [
          {
            tokens: ['14000', '−', '11000', '=', '3000'],
            caption: { en: 'Three more chairs, and the price goes up by 3000.', ml: 'മൂന്നു കസേര കൂടുതൽ; വില 3000 കൂടി.' },
          },
          {
            tokens: ['3000', '÷', '3', '=', '1000'],
            links: [[4, 0]],
            caption: { en: 'That 3000 pays for 3 chairs, so one chair costs 1000.', ml: 'ആ 3000 മൂന്നു കസേരകളുടെ വില; ഒരു കസേരയ്ക്ക് 1000.' },
          },
          {
            tokens: ['11000', '−', '1000', '=', '10000'],
            links: [[4, 2], [0, 2, 0]],
            caption: { en: 'So the table costs 11000 − 1000 = 10000 rupees.', ml: 'അതിനാൽ മേശയുടെ വില 11000 − 1000 = 10000 രൂപ.' },
          },
        ],
        solutions: [{}],
      },
    },
  },
];

const key = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

/** Sample plan for a teaching unit of this section, if there is one. */
export function samplePlanFor(blockId: string, text: string): BlockPlan | undefined {
  const k = key(text);
  const hit = SCERT9_CH1_S1.find((f) => k.startsWith(key(f.startsWith)));
  return hit ? { ...hit.plan, blockId, source: 'fixture' } : undefined;
}
