/**
 * Golden examples for the unit-circle DNA (V51.9.27): the six ratios as segments of the unit circle
 * (the order of the reference clip), with a sweep to a second angle, the exact values and the
 * identity; and a special-angles lesson. Written fresh for AI Guru; bilingual (the Malayalam is a
 * draft for a teacher to check); passes the validator.
 */

import type { TrigPlan } from '../dna/types';

export const TRIG_RATIOS_SAMPLE: TrigPlan = {
  title: { en: 'Trigonometric ratios', ml: 'ത്രികോണമിതി അനുപാതങ്ങൾ' },
  angle: 35,
  steps: [
    { op: 'show', say: { en: 'Here is a circle of radius 1 with its two axes.', ml: 'ആരം 1 ആയ ഒരു വൃത്തവും അതിന്റെ രണ്ട് അക്ഷങ്ങളും.' } },
    { op: 'point', say: { en: 'Take a point on the circle at angle theta. Call its coordinates x and y.', ml: 'വൃത്തത്തിൽ θ കോണിൽ ഒരു ബിന്ദു എടുക്കുക. അതിന്റെ നിർദേശാങ്കങ്ങൾ x, y എന്ന് വിളിക്കാം.' } },
    { op: 'legs', say: { en: 'Drop a line down to the x-axis. We get a right triangle whose hypotenuse is 1.', ml: 'x-അക്ഷത്തിലേക്ക് ഒരു വര താഴ്ത്തുക. കർണം 1 ആയ ഒരു മട്ടത്രികോണം കിട്ടും.' } },
    { op: 'ratio', which: 'cos', say: { en: 'Cosine of theta is the horizontal side, x.', ml: 'θ-യുടെ കോസ് തിരശ്ചീന വശമായ x ആണ്.' } },
    { op: 'ratio', which: 'sin', say: { en: 'Sine of theta is the vertical side, y.', ml: 'θ-യുടെ സൈൻ ലംബ വശമായ y ആണ്.' } },
    { op: 'ratio', which: 'tan', say: { en: 'Draw the tangent line at the point. The piece down to the x-axis has length tangent of theta: sine over cosine.', ml: 'ബിന്ദുവിലെ സ്പർശരേഖ വരയ്ക്കുക. x-അക്ഷം വരെയുള്ള ഭാഗത്തിന്റെ നീളം θ-യുടെ ടാൻ ആണ്: സൈൻ ഹരണം കോസ്.' } },
    { op: 'ratio', which: 'cot', say: { en: 'The piece up to the y-axis is cotangent: cosine over sine.', ml: 'y-അക്ഷം വരെയുള്ള ഭാഗം കോട്ടാൻ ആണ്: കോസ് ഹരണം സൈൻ.' } },
    { op: 'ratio', which: 'sec', say: { en: 'Where the tangent meets the x-axis, the distance from the centre is secant: one over cosine.', ml: 'സ്പർശരേഖ x-അക്ഷത്തെ കണ്ടുമുട്ടുന്നിടത്തേക്ക് കേന്ദ്രത്തിൽ നിന്നുള്ള ദൂരം സെക്കന്റ് ആണ്: ഒന്ന് ഹരണം കോസ്.' } },
    { op: 'ratio', which: 'csc', say: { en: 'Where it meets the y-axis, the distance is cosecant: one over sine.', ml: 'y-അക്ഷത്തെ കണ്ടുമുട്ടുന്നിടത്തേക്കുള്ള ദൂരം കോസെക്കന്റ് ആണ്: ഒന്ന് ഹരണം സൈൻ.' } },
    { op: 'box', say: { en: 'Six ratios, one picture.', ml: 'ആറ് അനുപാതങ്ങൾ, ഒരു ചിത്രം.' } },
    { op: 'sweep', to: 55, say: { en: 'Slide the point along the circle and watch every length change.', ml: 'ബിന്ദുവിനെ വൃത്തത്തിലൂടെ നീക്കി ഓരോ നീളവും മാറുന്നത് നോക്കൂ.' } },
    { op: 'identity', which: 'pythagorean', say: { en: 'Pythagoras in the triangle gives sine squared plus cosine squared equals one, at every angle.', ml: 'ത്രികോണത്തിലെ പൈതഗോറസ് സിദ്ധാന്തം: സൈൻ സ്ക്വയർ കൂട്ടണം കോസ് സ്ക്വയർ തുല്യം ഒന്ന്, എല്ലാ കോണിലും.' } },
  ],
};

export const TRIG_SPECIAL_SAMPLE: TrigPlan = {
  angle: 30,
  steps: [
    { op: 'show', say: { en: 'The unit circle again.', ml: 'വീണ്ടും ആരം 1 ആയ വൃത്തം.' } },
    { op: 'point', say: { en: 'A point at 30 degrees.', ml: '30 ഡിഗ്രിയിൽ ഒരു ബിന്ദു.' } },
    { op: 'legs', say: { en: 'Its right triangle is half of an equilateral triangle.', ml: 'ഇതിലെ മട്ടത്രികോണം സമഭുജത്രികോണത്തിന്റെ പകുതിയാണ്.' } },
    { op: 'ratio', which: 'cos', say: { en: 'Cosine.', ml: 'കോസ്.' } },
    { op: 'ratio', which: 'sin', say: { en: 'Sine.', ml: 'സൈൻ.' } },
    { op: 'ratio', which: 'tan', say: { en: 'Tangent.', ml: 'ടാൻ.' } },
    { op: 'values', say: { en: 'At 30 degrees: cosine root 3 over 2, sine one half, tangent one over root 3.', ml: '30 ഡിഗ്രിയിൽ: കോസ് റൂട്ട് 3 / 2, സൈൻ പകുതി, ടാൻ 1 / റൂട്ട് 3.' } },
    { op: 'sweep', to: 45, say: { en: 'Now 45 degrees.', ml: 'ഇനി 45 ഡിഗ്രി.' } },
    { op: 'values', say: { en: 'Here sine and cosine are equal.', ml: 'ഇവിടെ സൈനും കോസും തുല്യമാണ്.' } },
    { op: 'sweep', to: 60, say: { en: 'And 60 degrees.', ml: 'പിന്നെ 60 ഡിഗ്രി.' } },
    { op: 'values', say: { en: 'The values from 30 degrees swap places.', ml: '30 ഡിഗ്രിയിലെ വിലകൾ പരസ്പരം മാറുന്നു.' } },
  ],
};
