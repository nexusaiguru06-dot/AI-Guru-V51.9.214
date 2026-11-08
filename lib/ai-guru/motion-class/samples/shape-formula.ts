/**
 * Golden examples for the shape-formula DNA (V51.9.25): the formula sheet of the reference clip
 * (circle, rectangle, right triangle with Pythagoras, the two special right triangles), plus a
 * numeric example where the app works the numbers. Written fresh for AI Guru; bilingual (the
 * Malayalam is a draft for a teacher to check); passes the validator.
 */

import type { ShapePlan } from '../dna/types';

export const SHAPE_SHEET_SAMPLE: ShapePlan = {
  title: { en: 'Some formulas worth knowing', ml: 'അറിഞ്ഞിരിക്കേണ്ട ചില സൂത്രവാക്യങ്ങൾ' },
  steps: [
    { op: 'shape', kind: 'circle', say: { en: 'Start with a circle.', ml: 'ഒരു വൃത്തത്തിൽ തുടങ്ങാം.' } },
    { op: 'label', say: { en: 'From the centre to the edge is the radius, r.', ml: 'കേന്ദ്രത്തിൽ നിന്ന് അരികിലേക്കുള്ള ദൂരം ആരം, r.' } },
    { op: 'formula', what: 'area', say: { en: 'The area is pi r squared.', ml: 'വിസ്തീർണം പൈ r വർഗം.' } },
    { op: 'formula', what: 'circumference', say: { en: 'The circumference is two pi r.', ml: 'ചുറ്റളവ് രണ്ട് പൈ r.' } },
    { op: 'shape', kind: 'rectangle', say: { en: 'Now a rectangle, with length l and width w.', ml: 'ഇനി ഒരു ദീർഘചതുരം, നീളം l, വീതി w.' } },
    { op: 'label', say: { en: 'Here are l and w.', ml: 'ഇതാ l-ഉം w-ഉം.' } },
    { op: 'formula', what: 'area', say: { en: 'The area is l times w.', ml: 'വിസ്തീർണം l ഗുണം w.' } },
    { op: 'shape', kind: 'right-triangle', say: { en: 'A right triangle has one right angle.', ml: 'മട്ടത്രികോണത്തിന് ഒരു മട്ടകോണുണ്ട്.' } },
    { op: 'label', say: { en: 'The longest side is c. The others are a and b.', ml: 'ഏറ്റവും നീളമുള്ള വശം c. മറ്റുള്ളവ a, b.' } },
    { op: 'formula', what: 'pythagoras', say: { en: 'Pythagoras: a squared plus b squared is c squared.', ml: 'പൈതഗോറസ്: a വർഗം കൂട്ടണം b വർഗം c വർഗത്തിന് തുല്യം.' } },
    { op: 'shape', kind: 'special-30-60-90', say: { en: 'This special right triangle has angles 30, 60 and 90.', ml: 'ഈ പ്രത്യേക മട്ടത്രികോണത്തിന്റെ കോണുകൾ 30, 60, 90.' } },
    { op: 'label', say: { en: 'Its sides are a, a root 3 and 2a.', ml: 'വശങ്ങൾ a, a റൂട്ട് 3, 2a.' } },
    { op: 'angles', say: { en: 'The short side faces the 30 degree angle.', ml: 'ചെറിയ വശം 30 ഡിഗ്രി കോണിന് എതിരെ.' } },
    { op: 'name', say: { en: 'We call it a special right triangle.', ml: 'ഇതിനെ പ്രത്യേക മട്ടത്രികോണം എന്ന് വിളിക്കുന്നു.' } },
    { op: 'shape', kind: 'special-45-45-90', say: { en: 'And this one has angles 45, 45 and 90.', ml: 'ഇതിന്റെ കോണുകൾ 45, 45, 90.' } },
    { op: 'label', say: { en: 'Two sides are a, the long side is a root 2.', ml: 'രണ്ട് വശങ്ങൾ a, നീളമുള്ള വശം a റൂട്ട് 2.' } },
    { op: 'angles', say: { en: 'Both acute angles are 45 degrees.', ml: 'രണ്ട് ന്യൂനകോണുകളും 45 ഡിഗ്രി.' } },
    { op: 'name', say: { en: 'Another special right triangle.', ml: 'മറ്റൊരു പ്രത്യേക മട്ടത്രികോണം.' } },
  ],
};

/** Numbers given: the app labels the sides with them and works the formula (3, 4 → c = 5; 1, 2 → c = √5). */
export const SHAPE_NUMBERS_SAMPLE: ShapePlan = {
  steps: [
    { op: 'shape', kind: 'right-triangle', a: 3, b: 4, say: { en: 'A right triangle with legs 3 and 4.', ml: '3, 4 വശങ്ങളുള്ള ഒരു മട്ടത്രികോണം.' } },
    { op: 'label', say: { en: 'The legs are 3 and 4. What is the long side?', ml: 'വശങ്ങൾ 3-ഉം 4-ഉം. നീളമുള്ള വശം എത്ര?' } },
    { op: 'formula', what: 'pythagoras', say: { en: 'Square the legs and add: 9 plus 16 is 25, so c is 5.', ml: 'വശങ്ങളുടെ വർഗം കൂട്ടുക: 9 + 16 = 25, അതിനാൽ c = 5.' } },
    { op: 'formula', what: 'area', say: { en: 'The area is half of 3 times 4.', ml: 'വിസ്തീർണം 3 ഗുണം 4-ന്റെ പകുതി.' } },
    { op: 'shape', kind: 'circle', a: 5, say: { en: 'A circle of radius 5.', ml: '5 ആരമുള്ള വൃത്തം.' } },
    { op: 'label', say: { en: 'The radius is 5.', ml: 'ആരം 5.' } },
    { op: 'formula', what: 'area', say: { en: 'Area is pi times 5 squared, 25 pi.', ml: 'വിസ്തീർണം പൈ ഗുണം 5 വർഗം, 25 പൈ.' } },
    { op: 'shape', kind: 'special-30-60-90', a: 5, say: { en: 'A 30-60-90 triangle whose short side is 5.', ml: 'ചെറിയ വശം 5 ആയ 30-60-90 ത്രികോണം.' } },
    { op: 'label', say: { en: 'The sides are 5, 5 root 3 and 10.', ml: 'വശങ്ങൾ 5, 5 റൂട്ട് 3, 10.' } },
    { op: 'formula', what: 'ratio', say: { en: 'The ratio holds: 5 to 5 root 3 to 10.', ml: 'അനുപാതം: 5 : 5 റൂട്ട് 3 : 10.' } },
  ],
};
