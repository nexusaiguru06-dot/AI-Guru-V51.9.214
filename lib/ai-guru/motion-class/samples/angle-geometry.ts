/**
 * Golden examples for the angle DNA (V51.9.32): parallel lines with a transversal (all five angle
 * relations from one given angle), the angle sum and exterior angle of a triangle, and the circle
 * theorems (centre and circumference, same arc, cyclic quadrilateral). Written fresh for AI Guru;
 * bilingual (the Malayalam is a draft for a teacher to check); every sample passes the validator.
 */

import type { AnglePlan } from '../dna/types';

export const ANGLE_PARALLEL_SAMPLE: AnglePlan = {
  title: { en: 'Parallel lines and a transversal', ml: 'സമാന്തര രേഖകളും ഛേദകരേഖയും' },
  figure: 'parallel',
  a: 70,
  at: 'bl',
  steps: [
    { op: 'show', say: { en: 'Two parallel lines are cut by a third line, a transversal.', ml: 'രണ്ട് സമാന്തര രേഖകളെ മൂന്നാമതൊരു രേഖ, ഛേദകരേഖ, മുറിക്കുന്നു.' } },
    { op: 'given', say: { en: 'One of the eight angles is 70 degrees.', ml: 'എട്ട് കോണുകളിൽ ഒന്ന് 70° ആണ്.' } },
    { op: 'vertical', say: { en: 'The angle opposite to it is equal: vertically opposite angles.', ml: 'അതിനെതിരെയുള്ള കോൺ തുല്യമാണ്: ശീർഷാഭിമുഖ കോണുകൾ.' } },
    { op: 'linear', say: { en: 'The angle next to it is on a straight line, so together they make 180 degrees.', ml: 'അടുത്ത കോൺ ഒരു നേർരേഖയിലാണ്, അതിനാൽ ഇവ ചേർന്ന് 180° ആകും.' } },
    { op: 'corresponding', say: { en: 'At the other line, the angle in the same place is equal: corresponding angles.', ml: 'മറ്റേ രേഖയിൽ അതേ സ്ഥാനത്തെ കോൺ തുല്യമാണ്: സംഗത കോണുകൾ.' } },
    { op: 'alternate', say: { en: 'The angle on the opposite side of the transversal, between the lines, is equal: alternate angles.', ml: 'ഛേദകരേഖയുടെ മറുവശത്ത്, രേഖകൾക്കിടയിലെ കോൺ തുല്യമാണ്: ഏകാന്തര കോണുകൾ.' } },
    { op: 'cointerior', say: { en: 'Angles between the lines on the same side add up to 180 degrees: co-interior angles.', ml: 'രേഖകൾക്കിടയിൽ ഒരേ വശത്തെ കോണുകളുടെ തുക 180° ആണ്: അന്തർകോണുകൾ.' } },
  ],
};

export const ANGLE_TRIANGLE_SAMPLE: AnglePlan = {
  figure: 'triangle',
  A: 50,
  B: 60,
  steps: [
    { op: 'show', say: { en: 'Here is a triangle ABC.', ml: 'ഇതാ ABC എന്ന ത്രികോണം.' } },
    { op: 'angles', say: { en: 'The angles at A and B are known. What is the angle at C?', ml: 'A, B എന്നിവിടങ്ങളിലെ കോണുകൾ അറിയാം. C-യിലെ കോൺ എത്രയാണ്?' } },
    { op: 'find', say: { en: 'The three angles add up to 180 degrees, so C is 180 minus 50 minus 60.', ml: 'മൂന്ന് കോണുകളുടെ തുക 180° ആണ്, അതിനാൽ C = 180 − 50 − 60.' } },
    { op: 'sum', say: { en: 'Check: the three angles add up to 180 degrees.', ml: 'പരിശോധന: മൂന്ന് കോണുകളുടെ തുക 180°.' } },
    { op: 'exterior', say: { en: 'Extend BC. The exterior angle at C equals the two opposite interior angles added.', ml: 'BC നീട്ടുക. C-യിലെ ബാഹ്യകോൺ എതിരെയുള്ള രണ്ട് ഉൾക്കോണുകളുടെ തുകയ്ക്ക് തുല്യം.' } },
  ],
};

export const ANGLE_CIRCLE_SAMPLE: AnglePlan = {
  figure: 'circle',
  beta: 40,
  steps: [
    { op: 'show', say: { en: 'A circle with centre O and a chord AB.', ml: 'O കേന്ദ്രമായ ഒരു വൃത്തവും AB എന്ന ഞാണും.' } },
    { op: 'centre', say: { en: 'The arc AB makes this angle at the centre.', ml: 'AB ചാപം കേന്ദ്രത്തിൽ ഉണ്ടാക്കുന്ന കോൺ ഇതാണ്.' } },
    { op: 'circumference', say: { en: 'The same arc makes a smaller angle at a point P on the circle.', ml: 'അതേ ചാപം വൃത്തത്തിലെ P എന്ന ബിന്ദുവിൽ ചെറിയ കോൺ ഉണ്ടാക്കുന്നു.' } },
    { op: 'double', say: { en: 'The angle at the centre is twice the angle at the circle.', ml: 'കേന്ദ്രത്തിലെ കോൺ വൃത്തത്തിലെ കോണിന്റെ ഇരട്ടിയാണ്.' } },
    { op: 'same-arc', say: { en: 'Any other point Q on the same arc sees AB at the same angle.', ml: 'അതേ ചാപത്തിലെ മറ്റേതൊരു ബിന്ദു Q-വും AB-യെ അതേ കോണിൽ കാണുന്നു.' } },
    { op: 'cyclic', say: { en: 'A point R on the other arc gives an angle that adds up to 180 degrees with it: a cyclic quadrilateral.', ml: 'മറുവശത്തെ ചാപത്തിലെ R എന്ന ബിന്ദുവിലെ കോൺ ഇതുമായി ചേർന്ന് 180° ആകും: ചക്രിയ ചതുർഭുജം.' } },
  ],
};

export const ANGLE_SEMICIRCLE_SAMPLE: AnglePlan = {
  figure: 'circle',
  beta: 90,
  steps: [
    { op: 'show', say: { en: 'A chord AB that passes through the centre is a diameter.', ml: 'കേന്ദ്രത്തിലൂടെ പോകുന്ന ഞാൺ AB വ്യാസമാണ്.' } },
    { op: 'centre', say: { en: 'At the centre it makes a straight angle, 180 degrees.', ml: 'കേന്ദ്രത്തിൽ അത് 180° ആയ നേർകോൺ ഉണ്ടാക്കുന്നു.' } },
    { op: 'circumference', say: { en: 'At any point on the circle, the angle is a right angle.', ml: 'വൃത്തത്തിലെ ഏത് ബിന്ദുവിലും കോൺ മട്ടകോണാണ്.' } },
    { op: 'double', say: { en: 'The centre angle is twice it: the angle in a semicircle is 90 degrees.', ml: 'കേന്ദ്രകോൺ അതിന്റെ ഇരട്ടിയാണ്: അർധവൃത്തത്തിലെ കോൺ 90° ആണ്.' } },
  ],
};
