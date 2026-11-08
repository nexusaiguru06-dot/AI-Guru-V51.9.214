/**
 * Sample free sketch (V51.9.50): why the angles of a triangle add up to 180°. A line through the top corner,
 * parallel to the base, carries the two base angles up to the top, where the three angles make a straight
 * line. Written in the exact format the AI returns for "ai-sketch"; the Malayalam is a draft for a teacher.
 */

import type { SketchPlan } from '../dna/sketch-math';

export const SKETCH_TRIANGLE_180: SketchPlan = {
  title: { en: 'The angles of a triangle add up to 180°', ml: 'ത്രികോണത്തിന്റെ കോണുകളുടെ തുക 180°' },
  height: 420,
  objects: [
    { id: 'tri', kind: 'polygon', points: [[160, 330], [560, 330], [400, 120]], color: 'ink', fill: 'done' },
    { id: 'la', kind: 'text', x: 200, y: 312, text: 'a', size: 30, color: 'a' },
    { id: 'lb', kind: 'text', x: 520, y: 312, text: 'b', size: 30, color: 'b' },
    { id: 'lc', kind: 'text', x: 400, y: 158, text: 'c', size: 30, color: 'c' },
    { id: 'par', kind: 'line', x1: 160, y1: 120, x2: 640, y2: 120, color: 'carry', width: 3 },
    { id: 'ta', kind: 'text', x: 352, y: 104, text: 'a', size: 30, color: 'a' },
    { id: 'tb', kind: 'text', x: 448, y: 104, text: 'b', size: 30, color: 'b' },
    { id: 'eq', kind: 'math', x: 360, y: 384, tex: 'a + b + c = 180^\\circ', size: 34 },
  ],
  steps: [
    {
      say: { en: 'Here is a triangle with angles a, b and c.', ml: 'a, b, c എന്നീ കോണുകളുള്ള ഒരു ത്രികോണം.' },
      do: [{ show: ['tri'] }, { show: ['la', 'lb', 'lc'] }],
    },
    {
      say: { en: 'Draw a line through the top corner, parallel to the base.', ml: 'മുകളിലെ മൂലയിലൂടെ, പാദത്തിന് സമാന്തരമായി ഒരു വര വരയ്ക്കുക.' },
      do: [{ show: ['par'] }, { focus: ['par'] }],
    },
    {
      say: { en: 'Alternate angles are equal, so angle a appears again at the top, and so does angle b.', ml: 'ഏകാന്തര കോണുകൾ തുല്യമാണ്; അതിനാൽ a യും b യും മുകളിൽ വീണ്ടും വരുന്നു.' },
      do: [{ show: ['ta'] }, { show: ['tb'] }, { focus: ['ta', 'tb', 'lc'] }],
    },
    {
      say: { en: 'Together, a, c and b make a straight line: 180 degrees.', ml: 'a, c, b ചേർന്ന് ഒരു നേർരേഖ: 180 ഡിഗ്രി.' },
      do: [{ show: ['eq'] }, { box: [360, 384, 300, 56], color: 'accent' }],
    },
  ],
};
