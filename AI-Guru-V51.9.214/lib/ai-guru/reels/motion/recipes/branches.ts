/**
 * Branch catalogue: one reference reel per branch of school maths, all built with
 * the same derivation recipe (and therefore the same motion grammar). Each example
 * carries the solution values so the test-suite proves every line on screen is true.
 *
 * These double as templates for the planner/LLM: same token format, same link
 * conventions, same caption length.
 */

import type { DerivationInput } from './derivation';
import type { Vars } from '../verify';

export interface BranchExample {
  id: string;
  branch: string;
  input: DerivationInput;
  solutions: Vars[];
}

export const BRANCH_EXAMPLES: BranchExample[] = [
  {
    id: 'linear-equation',
    branch: 'Algebra · linear equations',
    solutions: [{ x: 10 }],
    input: {
      title: 'Solve 2x + 5 = 25',
      lines: [
        // V51.9.125: the caption says the principle; the small note beside each line says what it did
        { tokens: ['2', 'x', '+', '5', '=', '25'], caption: 'An equation is a balance: both sides weigh the same. We want x alone.', note: 'the problem' },
        { tokens: ['2', 'x', '=', '25', '−', '5'], caption: 'To keep the balance, take away 5 from both sides. So +5 crosses over as −5.', note: '−5 both sides', links: [[2, 4], [3, 5]] },
        { tokens: ['2', 'x', '=', '20'], caption: 'Work out the numbers on the right. The balance does not change.', note: '25 − 5 = 20', links: [[3, 3], [4, 3], [5, 3]] },
        { tokens: ['x', '=', '{20/2}'], caption: '2 is multiplying x. Do the opposite: divide both sides by 2.', note: '÷2 both sides', links: [[0, 2], [3, 2]] },
        { tokens: ['x', '=', '10'], caption: '20 shared equally by 2 x’s gives 10 each. So x = 10.', note: '20 ÷ 2 = 10', links: [[2, 2]] },
      ],
    },
  },
  {
    id: 'pair-of-equations',
    branch: 'Algebra · pair of linear equations',
    solutions: [{ x: 6, y: 4 }],
    input: {
      title: 'x + y = 10, x − y = 2',
      lines: [
        { tokens: ['x', '+', 'y', '=', '10'], caption: 'Two equations, two unknowns. First equation.' },
        { tokens: ['x', '−', 'y', '=', '2'], caption: 'Second equation.', fresh: true },
        {
          tokens: ['2', 'x', '=', '12'],
          caption: 'Add the two equations: +y and −y cancel.',
          cancel: [[0, 2], [1, 2]],
          links: [[0, 0, 1], [1, 0, 1], [0, 3, 2], [0, 4, 3], [1, 4, 3]],
        },
        { tokens: ['x', '=', '{12/2}'], caption: 'Divide both sides by 2.', links: [[0, 2], [3, 2]] },
        { tokens: ['x', '=', '6'], caption: '12 ÷ 2 = 6', links: [[2, 2]] },
        {
          tokens: ['6', '+', 'y', '=', '10'],
          caption: 'Put x = 6 in the first equation.',
          links: [[4, 2, 0], [0, 1, 1], [0, 2, 2], [0, 3, 3], [0, 4, 4]],
        },
        { tokens: ['y', '=', '10', '−', '6'], caption: 'Move 6 across: it becomes −6.', links: [[2, 0], [3, 1], [4, 2], [1, 3], [0, 4]] },
        { tokens: ['y', '=', '4'], caption: '10 − 6 = 4. So x = 6 and y = 4.', links: [[2, 2], [3, 2], [4, 2]] },
      ],
    },
  },
  {
    id: 'fractions-add',
    branch: 'Fractions',
    solutions: [{}],
    input: {
      title: '1/2 + 1/3 = ?',
      lines: [
        { tokens: ['{1/2}', '+', '{1/3}'], caption: 'Different denominators. Make them the same first.' },
        { tokens: ['{3/6}', '+', '{2/6}'], caption: 'The LCM of 2 and 3 is 6: 1/2 = 3/6 and 1/3 = 2/6.', links: [[0, 0], [2, 2]] },
        { tokens: ['{3+2/6}'], caption: 'Same denominator: add the numerators.', links: [[0, 0], [1, 0], [2, 0]] },
        { tokens: ['{5/6}'], caption: '3 + 2 = 5, so the answer is 5/6.', links: [[0, 0]] },
      ],
    },
  },
  {
    id: 'percentage',
    branch: 'Percentage',
    solutions: [{}],
    input: {
      title: '20% of 150 = ?',
      lines: [
        { tokens: ['20%', 'of', '150'], caption: '"Of" means multiply, and % means out of 100.' },
        { tokens: ['{20/100}', '×', '150'], caption: 'Write 20% as 20/100.', links: [[0, 0], [1, 1], [2, 2]] },
        { tokens: ['{1/5}', '×', '150'], caption: 'Simplify: 20/100 = 1/5.', links: [[0, 0]] },
        { tokens: ['{150/5}'], caption: 'One fifth of 150 is 150 ÷ 5.', links: [[0, 0], [2, 0]] },
        { tokens: ['30'], caption: '150 ÷ 5 = 30', links: [[0, 0]] },
      ],
    },
  },
  {
    id: 'exponent-law',
    branch: 'Exponents & powers',
    solutions: [{}],
    input: {
      title: '2³ × 2⁴ = ?',
      lines: [
        { tokens: ['2^3', '×', '2^4'], caption: 'Same base 2. When we multiply, add the powers.' },
        { tokens: ['2^{3+4}'], caption: 'aᵐ × aⁿ = aᵐ⁺ⁿ', links: [[0, 0], [1, 0], [2, 0]] },
        { tokens: ['2^7'], caption: '3 + 4 = 7', links: [[0, 0]] },
        { tokens: ['128'], caption: '2 multiplied by itself 7 times is 128.', links: [[0, 0]] },
      ],
    },
  },
  {
    id: 'quadratic-factorise',
    branch: 'Quadratic equations',
    solutions: [{ x: -2 }, { x: -3 }],
    input: {
      title: 'Solve x² + 5x + 6 = 0',
      lines: [
        { tokens: ['x^2', '+', '5', 'x', '+', '6', '=', '0'], caption: 'Find two numbers: product 6, sum 5.' },
        {
          tokens: ['x^2', '+', '2', 'x', '+', '3', 'x', '+', '6', '=', '0'],
          caption: '2 × 3 = 6 and 2 + 3 = 5, so split 5x into 2x + 3x.',
          links: [[0, 0], [1, 1], [2, 2], [2, 5], [3, 3], [3, 6], [4, 7], [5, 8], [6, 9], [7, 10]],
        },
        {
          tokens: ['(', 'x', '+', '2', ')', '(', 'x', '+', '3', ')', '=', '0'],
          caption: 'Group and take out the common factor: (x + 2)(x + 3).',
          links: [[0, 1], [0, 6], [2, 3], [5, 8], [9, 10], [10, 11]],
        },
        { tokens: ['x', '=', '−2', 'or', 'x', '=', '−3'], caption: 'A product is 0 only if a bracket is 0.', links: [[1, 0], [3, 2], [6, 4], [8, 6]] },
      ],
    },
  },
  {
    id: 'power-rule',
    branch: 'Calculus · differentiation',
    solutions: [{ x: 1.7 }],
    input: {
      title: 'Differentiate x³',
      lines: [
        { tokens: ['{d/dx}', '(', 'x^3', ')'], caption: 'Power rule: bring the power down, then reduce it by 1.', check: false },
        { tokens: ['3', 'x^{3−1}'], caption: 'The 3 comes down in front.', links: [[2, 0], [2, 1]] },
        { tokens: ['3', 'x^2'], caption: '3 − 1 = 2. So the derivative of x³ is 3x².', links: [[0, 0], [1, 1]] },
      ],
    },
  },
  {
    id: 'pythagoras',
    branch: 'Geometry · Pythagoras theorem',
    solutions: [{ a: 3, b: 4, c: 5 }],
    input: {
      title: 'a = 3, b = 4, find c',
      lines: [
        { tokens: ['a^2', '+', 'b^2', '=', 'c^2'], caption: 'In a right triangle, a² + b² = c².' },
        { tokens: ['3^2', '+', '4^2', '=', 'c^2'], caption: 'Put a = 3 and b = 4.', links: [[0, 0], [2, 2]] },
        { tokens: ['9', '+', '16', '=', 'c^2'], caption: '3² = 9 and 4² = 16', links: [[0, 0], [2, 2]] },
        { tokens: ['25', '=', 'c^2'], caption: '9 + 16 = 25', links: [[0, 0], [1, 0], [2, 0]] },
        { tokens: ['c', '=', '√25'], caption: 'Take the square root of both sides.', links: [[2, 0], [0, 2], [1, 1]] },
        { tokens: ['c', '=', '5'], caption: '√25 = 5. The hypotenuse is 5.', links: [[2, 2]] },
      ],
    },
  },
  {
    id: 'circle-area',
    branch: 'Mensuration · area of a circle',
    solutions: [{ A: 154, r: 7 }],
    input: {
      title: 'Area of a circle, r = 7 cm',
      lines: [
        { tokens: ['A', '=', 'π', 'r^2'], caption: 'Area of a circle = π r².' },
        { tokens: ['A', '=', '{22/7}', '×', '7', '×', '7'], caption: 'Take π = 22/7 and r² = 7 × 7.', links: [[2, 2], [3, 4], [3, 6]] },
        { tokens: ['A', '=', '22', '×', '7'], caption: 'The 7 below cancels one 7.', links: [[2, 2], [4, 2], [5, 3], [6, 4]], cancel: [[1, 4]] },
        { tokens: ['A', '=', '154'], caption: '22 × 7 = 154. Area = 154 cm².', links: [[2, 2], [3, 2], [4, 2]] },
      ],
    },
  },
  {
    id: 'mean',
    branch: 'Statistics · mean',
    solutions: [{}],
    input: {
      title: 'Mean of 4, 8, 6, 10',
      lines: [
        { tokens: ['{4+8+6+10/4}'], caption: 'Mean = sum of the values ÷ number of values.' },
        { tokens: ['{28/4}'], caption: '4 + 8 + 6 + 10 = 28, and there are 4 values.', links: [[0, 0]] },
        { tokens: ['7'], caption: '28 ÷ 4 = 7. The mean is 7.', links: [[0, 0]] },
      ],
    },
  },
  {
    id: 'probability',
    branch: 'Probability',
    solutions: [{ P: 0.5 }],
    input: {
      title: 'P(even number on a die)',
      lines: [
        { tokens: ['P', '=', '{favourable/total}'], caption: 'Probability = favourable outcomes ÷ total outcomes.', check: false },
        { tokens: ['P', '=', '{3/6}'], caption: 'Even numbers: 2, 4, 6 → 3 out of 6.', links: [[2, 2]] },
        { tokens: ['P', '=', '{1/2}'], caption: 'Simplify 3/6 = 1/2.', links: [[2, 2]] },
      ],
    },
  },
  {
    id: 'trigonometry',
    branch: 'Trigonometry',
    solutions: [{}],
    input: {
      title: 'sin 30° + cos 60° = ?',
      lines: [
        { tokens: ['sin 30°', '+', 'cos 60°'], caption: 'Use the standard values from the trig table.' },
        { tokens: ['{1/2}', '+', '{1/2}'], caption: 'sin 30° = 1/2 and cos 60° = 1/2.', links: [[0, 0], [2, 2]] },
        { tokens: ['1'], caption: '1/2 + 1/2 = 1', links: [[0, 0], [1, 0], [2, 0]] },
      ],
    },
  },
];

/** Malayalam captions for every branch example (same order as the lines). */
export const BRANCH_CAPTIONS_ML: Record<string, string[]> = {
  'linear-equation': [
    'സമവാക്യം ഒരു ത്രാസ് പോലെയാണ്: ഇരുവശത്തിനും ഒരേ ഭാരം. x തനിച്ച് കിട്ടണം.',
    'ത്രാസ് തുല്യമായി നിർത്താൻ ഇരുവശത്തുനിന്നും 5 കുറയ്ക്കുക. അങ്ങനെ +5 മറുവശത്ത് −5 ആകുന്നു.',
    'വലതുവശത്തെ സംഖ്യകൾ കണക്കാക്കുക. തുല്യത മാറുന്നില്ല.',
    '2, x-നെ ഗുണിക്കുന്നു. വിപരീത ക്രിയ ചെയ്യുക: ഇരുവശത്തെയും 2 കൊണ്ട് ഹരിക്കുക.',
    '20-നെ 2 x-കൾക്ക് തുല്യമായി പങ്കിട്ടാൽ ഓരോന്നിനും 10. അതിനാൽ x = 10.',
  ],
  'pair-of-equations': [
    'രണ്ട് സമവാക്യങ്ങൾ, രണ്ട് അജ്ഞാതങ്ങൾ. ആദ്യ സമവാക്യം.',
    'രണ്ടാമത്തെ സമവാക്യം.',
    'രണ്ട് സമവാക്യങ്ങളും കൂട്ടുക: +y യും −y യും പരസ്പരം റദ്ദാകും.',
    'ഇരുവശവും 2 കൊണ്ട് ഹരിക്കുക.',
    '12 ÷ 2 = 6',
    'x = 6 ആദ്യ സമവാക്യത്തിൽ ചേർക്കുക.',
    '6 മറുവശത്തേക്ക് മാറ്റുക: അത് −6 ആകും.',
    '10 − 6 = 4. അതിനാൽ x = 6, y = 4.',
  ],
  'quadratic-factorise': [
    'ഗുണനഫലം 6, തുക 5 ആകുന്ന രണ്ട് സംഖ്യകൾ കണ്ടെത്തുക.',
    '2 × 3 = 6, 2 + 3 = 5; അതിനാൽ 5x-നെ 2x + 3x ആയി പിരിക്കുക.',
    'ഗ്രൂപ്പ് ചെയ്ത് പൊതുഘടകം പുറത്തെടുക്കുക: (x + 2)(x + 3).',
    'ഗുണനഫലം 0 ആകണമെങ്കിൽ ഒരു ബ്രാക്കറ്റ് 0 ആകണം.',
  ],
  pythagoras: [
    'മട്ടത്രികോണത്തിൽ a² + b² = c².',
    'a = 3, b = 4 എന്ന് ആദേശം ചെയ്യുക.',
    '3² = 9, 4² = 16',
    '9 + 16 = 25',
    'ഇരുവശത്തിന്റെയും വർഗമൂലം എടുക്കുക.',
    '√25 = 5. കർണം 5 ആണ്.',
  ],
  percentage: [
    '"ഓഫ്" എന്നാൽ ഗുണനം; % എന്നാൽ 100-ൽ എത്ര.',
    '20%-നെ 20/100 എന്ന് എഴുതുക.',
    'ലഘൂകരിക്കുക: 20/100 = 1/5.',
    '150-ന്റെ അഞ്ചിലൊന്ന് = 150 ÷ 5.',
    '150 ÷ 5 = 30',
  ],
  'exponent-law': [
    'ആധാരം ഒന്നുതന്നെ, 2. ഗുണിക്കുമ്പോൾ കൃതികൾ കൂട്ടുക.',
    'aᵐ × aⁿ = aᵐ⁺ⁿ',
    '3 + 4 = 7',
    '2-നെ 7 തവണ ഗുണിച്ചാൽ 128.',
  ],
  'power-rule': [
    'കൃതി നിയമം: കൃതി മുന്നിലേക്ക് ഇറക്കി, കൃതിയിൽ നിന്ന് 1 കുറയ്ക്കുക.',
    '3 മുന്നിലേക്ക് ഇറങ്ങി വരുന്നു.',
    '3 − 1 = 2. അതിനാൽ x³-ന്റെ അവകലജം 3x².',
  ],
  'circle-area': [
    'വൃത്തത്തിന്റെ പരപ്പളവ് = π r².',
    'π = 22/7, r² = 7 × 7 എന്ന് എടുക്കുക.',
    'താഴെയുള്ള 7 ഒരു 7-നെ റദ്ദാക്കുന്നു.',
    '22 × 7 = 154. പരപ്പളവ് = 154 cm².',
  ],
  mean: [
    'മാധ്യം = വിലകളുടെ തുക ÷ വിലകളുടെ എണ്ണം.',
    '4 + 8 + 6 + 10 = 28; ആകെ 4 വിലകൾ.',
    '28 ÷ 4 = 7. മാധ്യം 7 ആണ്.',
  ],
  probability: [
    'സാധ്യത = അനുകൂല ഫലങ്ങൾ ÷ ആകെ ഫലങ്ങൾ.',
    'ഇരട്ടസംഖ്യകൾ: 2, 4, 6. അതായത് 6-ൽ 3.',
    '3/6 = 1/2 എന്ന് ലഘൂകരിക്കുക.',
  ],
  trigonometry: [
    'ത്രികോണമിതി പട്ടികയിലെ വിലകൾ ഉപയോഗിക്കുക.',
    'sin 30° = 1/2, cos 60° = 1/2.',
    '1/2 + 1/2 = 1',
  ],
  'fractions-add': [
    'ഛേദങ്ങൾ വ്യത്യസ്തം. ആദ്യം അവ തുല്യമാക്കുക.',
    '2-ന്റെയും 3-ന്റെയും ലസാഗു 6: 1/2 = 3/6, 1/3 = 2/6.',
    'ഛേദം തുല്യം: അംശങ്ങൾ കൂട്ടുക.',
    '3 + 2 = 5, അതിനാൽ ഉത്തരം 5/6.',
  ],
};

/** Malayalam side notes (line index → note). */
export const BRANCH_NOTES_ML: Record<string, Record<number, string>> = {
  'linear-equation': { 0: 'ചോദ്യം', 1: '−5 ഇരുവശത്തും', 3: '÷2 ഇരുവശത്തും' },
};

export function withCaptions(input: DerivationInput, captions?: string[], notes?: Record<number, string>): DerivationInput {
  if (!captions && !notes) return input;
  return {
    ...input,
    lines: input.lines.map((ln, i) => ({ ...ln, caption: captions?.[i] ?? ln.caption, note: ln.note && notes?.[i] ? notes[i] : ln.note })),
  };
}
