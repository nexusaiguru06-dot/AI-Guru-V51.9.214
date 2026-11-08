/**
 * Chapter-intro reels: "what is this chapter?" followed by a worked example.
 * Board lines are short; the explanation lives in the step captions.
 * The planner/LLM can produce the same IntroInput shape for any heading.
 */

import type { IntroInput } from './intro';
import type { Lang } from '../captions';

export interface ChapterIntro {
  id: string;
  klass: string;
  intro: Record<Lang, IntroInput>;
  /** Worked example from the branch catalogue that follows the intro. */
  exampleId: string;
}

export const CHAPTER_INTROS: ChapterIntro[] = [
  {
    id: 'pair-of-linear-equations',
    klass: 'Class 10 · Chapter 3',
    exampleId: 'pair-of-equations',
    intro: {
      en: {
        title: 'Pair of Linear Equations',
        heading: 'Pair of Linear Equations',
        points: [
          { board: 'Two *equations*, two *unknowns*', say: 'A pair of linear equations is two equations in the same two unknowns, x and y.' },
          { math: ['x', '+', 'y', '=', '10'], say: 'Each one alone has many answers: 1 and 9, 2 and 8, 3 and 7…' },
          { math: ['x', '−', 'y', '=', '2'], say: 'A second condition narrows it down.' },
          { board: 'Solution: true for *both* at once', say: 'The solution is the one pair (x, y) that makes both equations true together.' },
          { board: 'On a graph: where the two *lines* meet', say: 'Each equation is a straight line. They meet at the solution.' },
          { board: '*Substitution* · *Elimination*', say: 'We solve them by substitution or elimination. Let us try elimination.' },
        ],
      },
      ml: {
        title: 'രണ്ടു ചരങ്ങളിലെ രേഖീയ സമവാക്യജോടി',
        heading: 'രേഖീയ സമവാക്യജോടി',
        points: [
          { board: 'രണ്ട് *സമവാക്യങ്ങൾ*, രണ്ട് *അജ്ഞാതങ്ങൾ*', say: 'ഒരേ രണ്ട് അജ്ഞാതങ്ങൾ x, y ഉള്ള രണ്ട് സമവാക്യങ്ങളാണ് ഒരു സമവാക്യജോടി.' },
          { math: ['x', '+', 'y', '=', '10'], say: 'ഒറ്റയ്ക്കാണെങ്കിൽ ഇതിന് ധാരാളം ഉത്തരങ്ങളുണ്ട്: 1, 9; 2, 8; 3, 7…' },
          { math: ['x', '−', 'y', '=', '2'], say: 'രണ്ടാമത്തെ നിബന്ധന ഉത്തരം ചുരുക്കുന്നു.' },
          { board: 'ഉത്തരം: *രണ്ടിനും* ശരി', say: 'രണ്ട് സമവാക്യങ്ങളെയും ഒരുമിച്ച് ശരിയാക്കുന്ന (x, y) ജോടിയാണ് ഉത്തരം.' },
          { board: 'ഗ്രാഫിൽ: രണ്ട് *രേഖകൾ* കൂടിമുട്ടുന്ന ബിന്ദു', say: 'ഓരോ സമവാക്യവും ഒരു നേർരേഖയാണ്. അവ കൂടിമുട്ടുന്നിടത്താണ് ഉത്തരം.' },
          { board: '*ആദേശരീതി* · *നിരാകരണരീതി*', say: 'ആദേശരീതിയോ നിരാകരണരീതിയോ ഉപയോഗിച്ച് പരിഹരിക്കാം. നമുക്ക് നിരാകരണരീതി നോക്കാം.' },
        ],
      },
    },
  },
  {
    id: 'quadratic-equations',
    klass: 'Class 10 · Chapter 4',
    exampleId: 'quadratic-factorise',
    intro: {
      en: {
        title: 'Quadratic Equations',
        heading: 'Quadratic Equations',
        points: [
          { board: 'Highest power of x is *2*', say: 'A quadratic equation has x squared as its highest power.' },
          { math: ['a', 'x^2', '+', 'b', 'x', '+', 'c', '=', '0'], say: 'Standard form: a x squared plus b x plus c equals 0, with a not 0.' },
          { board: 'Up to *two* answers (roots)', say: 'It can have up to two answers, called roots.' },
          { board: '*Factorise* · *Formula*', say: 'We can find the roots by factorising or by the quadratic formula.' },
        ],
      },
      ml: {
        title: 'ദ്വിമാന സമവാക്യങ്ങൾ',
        heading: 'ദ്വിമാന സമവാക്യങ്ങൾ',
        points: [
          { board: 'x-ന്റെ ഏറ്റവും വലിയ കൃതി *2*', say: 'x-ന്റെ ഏറ്റവും വലിയ കൃതി 2 ആയ സമവാക്യമാണ് ദ്വിമാന സമവാക്യം.' },
          { math: ['a', 'x^2', '+', 'b', 'x', '+', 'c', '=', '0'], say: 'പൊതുരൂപം: a x² + b x + c = 0, ഇവിടെ a പൂജ്യമല്ല.' },
          { board: 'പരമാവധി *രണ്ട്* ഉത്തരങ്ങൾ', say: 'ഇതിന് പരമാവധി രണ്ട് ഉത്തരങ്ങൾ ഉണ്ടാകാം; അവയെ മൂലങ്ങൾ എന്നു പറയുന്നു.' },
          { board: '*ഘടകക്രിയ* · *സൂത്രവാക്യം*', say: 'ഘടകക്രിയ വഴിയോ സൂത്രവാക്യം വഴിയോ മൂലങ്ങൾ കണ്ടെത്താം.' },
        ],
      },
    },
  },
  {
    id: 'triangles-pythagoras',
    klass: 'Class 10 · Triangles',
    exampleId: 'pythagoras',
    intro: {
      en: {
        title: 'Pythagoras Theorem',
        heading: 'Pythagoras Theorem',
        points: [
          { board: 'Only for *right* triangles', say: 'This theorem works for triangles with one right angle.' },
          { board: 'Longest side = *hypotenuse*', say: 'The side opposite the right angle is the longest side, the hypotenuse.' },
          { math: ['a^2', '+', 'b^2', '=', 'c^2'], say: 'The squares of the two shorter sides add up to the square of the hypotenuse.' },
        ],
      },
      ml: {
        title: 'പൈതഗോറസ് സിദ്ധാന്തം',
        heading: 'പൈതഗോറസ് സിദ്ധാന്തം',
        points: [
          { board: '*മട്ടത്രികോണങ്ങൾക്ക്* മാത്രം', say: 'ഒരു മട്ടകോണുള്ള ത്രികോണങ്ങൾക്കാണ് ഈ സിദ്ധാന്തം.' },
          { board: 'ഏറ്റവും നീളമുള്ള വശം = *കർണം*', say: 'മട്ടകോണിന് എതിരെയുള്ള ഏറ്റവും നീളമുള്ള വശമാണ് കർണം.' },
          { math: ['a^2', '+', 'b^2', '=', 'c^2'], say: 'ചെറിയ രണ്ട് വശങ്ങളുടെ വർഗങ്ങളുടെ തുക കർണത്തിന്റെ വർഗത്തിന് തുല്യം.' },
        ],
      },
    },
  },
  {
    id: 'fractions',
    klass: 'Class 6–7 · Fractions',
    exampleId: 'fractions-add',
    intro: {
      en: {
        title: 'Adding Fractions',
        heading: 'Adding Fractions',
        points: [
          { math: ['{numerator/denominator}'], say: 'A fraction is a part of a whole: numerator over denominator.' },
          { board: 'Add only *same-size* parts', say: 'We can add parts only when they are the same size, so the denominators must match.' },
          { board: 'Make denominators equal with the *LCM*', say: 'Use the LCM to make the denominators equal, then add the numerators.' },
        ],
      },
      ml: {
        title: 'ഭിന്നസംഖ്യകളുടെ തുക',
        heading: 'ഭിന്നസംഖ്യകളുടെ തുക',
        points: [
          { math: ['{അംശം/ഛേദം}'], say: 'ഒരു മുഴുവന്റെ ഭാഗമാണ് ഭിന്നസംഖ്യ: അംശം മുകളിൽ, ഛേദം താഴെ.' },
          { board: '*ഒരേ വലിപ്പമുള്ള* ഭാഗങ്ങൾ മാത്രം കൂട്ടാം', say: 'ഭാഗങ്ങൾ ഒരേ വലിപ്പമാണെങ്കിലേ കൂട്ടാനാകൂ; അതിനാൽ ഛേദങ്ങൾ തുല്യമാകണം.' },
          { board: '*ലസാഗു* ഉപയോഗിച്ച് ഛേദങ്ങൾ തുല്യമാക്കുക', say: 'ലസാഗു ഉപയോഗിച്ച് ഛേദങ്ങൾ തുല്യമാക്കി അംശങ്ങൾ കൂട്ടുക.' },
        ],
      },
    },
  },
];
