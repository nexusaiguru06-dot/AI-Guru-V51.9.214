/**
 * Golden examples for the coordinate geometry DNA (V51.9.39). Written fresh for AI Guru;
 * bilingual (the Malayalam is a draft for a teacher to check); every sample passes the validator.
 */

import type { CoordPlan } from '../dna/types';

export const CG_POINTS_SAMPLE: CoordPlan = {
  title: { en: 'Points and quadrants', ml: 'ബിന്ദുക്കളും ചതുരാംശങ്ങളും' },
  kind: 'points',
  points: [[3, 2], [-2, 4], [-3, -1], [2, -3]],
  steps: [
    { op: 'axes', say: { en: 'The x-axis runs across and the y-axis runs up. They cross at the origin.', ml: 'x അക്ഷം കുറുകെയും y അക്ഷം മുകളിലേക്കും പോകുന്നു. അവ ഉത്ഭവത്തിൽ കൂട്ടിമുട്ടുന്നു.' } },
    { op: 'plot', i: 0, say: { en: 'To plot A, go 3 along x, then 2 up.', ml: 'A അടയാളപ്പെടുത്താൻ x ൽ 3 നീങ്ങി, 2 മുകളിലേക്ക് പോകുക.' } },
    { op: 'plot', i: 1, say: { en: 'B is 2 to the left and 4 up.', ml: 'B ഇടത്തേക്ക് 2, മുകളിലേക്ക് 4.' } },
    { op: 'plot', i: 2, say: { en: 'C is 3 left and 1 down.', ml: 'C ഇടത്തേക്ക് 3, താഴേക്ക് 1.' } },
    { op: 'plot', i: 3, say: { en: 'D is 2 right and 3 down.', ml: 'D വലത്തേക്ക് 2, താഴേക്ക് 3.' } },
    { op: 'quadrant', say: { en: 'The axes cut the plane into four quadrants, and each point lies in one of them.', ml: 'അക്ഷങ്ങൾ തലത്തെ നാല് ചതുരാംശങ്ങളായി മുറിക്കുന്നു; ഓരോ ബിന്ദുവും ഒന്നിലാണ്.' } },
  ],
};

export const CG_DIST_SAMPLE: CoordPlan = {
  title: { en: 'Distance between two points', ml: 'രണ്ട് ബിന്ദുക്കൾ തമ്മിലുള്ള ദൂരം' },
  kind: 'distance',
  points: [[1, 2], [5, 5]],
  steps: [
    { op: 'axes', say: { en: 'Here are the axes.', ml: 'ഇതാ അക്ഷങ്ങൾ.' } },
    { op: 'plot', say: { en: 'Plot A and B.', ml: 'A യും B യും അടയാളപ്പെടുത്തുക.' } },
    { op: 'segment', say: { en: 'Join them. The distance is the length of this segment.', ml: 'അവയെ യോജിപ്പിക്കുക. ഈ രേഖാഖണ്ഡത്തിന്റെ നീളമാണ് ദൂരം.' } },
    { op: 'legs', say: { en: 'Draw a horizontal and a vertical leg to make a right triangle.', ml: 'തിരശ്ചീനവും ലംബവുമായ വശങ്ങൾ വരച്ച് മട്ടത്രികോണം ഉണ്ടാക്കുക.' } },
    { op: 'formula', say: { en: 'By Pythagoras, the square of the distance is dx squared plus dy squared.', ml: 'പൈതഗോറസ് പ്രകാരം ദൂരത്തിന്റെ വർഗം dx ന്റെ വർഗവും dy ന്റെ വർഗവും കൂട്ടിയതാണ്.' } },
  ],
};

export const CG_DIST_SURD_SAMPLE: CoordPlan = {
  kind: 'distance',
  points: [[-3, 1], [2, -2]],
  names: ['P', 'Q'],
  steps: [
    { op: 'axes', say: { en: 'Start with the axes.', ml: 'അക്ഷങ്ങളിൽ തുടങ്ങാം.' } },
    { op: 'plot', say: { en: 'Plot P and Q.', ml: 'P യും Q വും അടയാളപ്പെടുത്തുക.' } },
    { op: 'segment', say: { en: 'Join P and Q.', ml: 'P യും Q വും യോജിപ്പിക്കുക.' } },
    { op: 'legs', say: { en: 'Find how far apart they are across and up.', ml: 'കുറുകെയും മുകളിലേക്കും എത്ര അകലമെന്ന് കണ്ടെത്തുക.' } },
    { op: 'formula', say: { en: 'The distance is not a whole number, so we round it.', ml: 'ദൂരം പൂർണസംഖ്യയല്ല, അതിനാൽ ഏകദേശമാക്കുന്നു.' } },
  ],
};

export const CG_MID_SAMPLE: CoordPlan = {
  title: { en: 'The midpoint', ml: 'മധ്യബിന്ദു' },
  kind: 'midpoint',
  points: [[-4, 1], [3, 4]],
  steps: [
    { op: 'axes', say: { en: 'The axes.', ml: 'അക്ഷങ്ങൾ.' } },
    { op: 'plot', say: { en: 'Plot A and B.', ml: 'A യും B യും അടയാളപ്പെടുത്തുക.' } },
    { op: 'segment', say: { en: 'Join them.', ml: 'യോജിപ്പിക്കുക.' } },
    { op: 'midpoint', say: { en: 'The midpoint has the average of the x values and the average of the y values.', ml: 'മധ്യബിന്ദുവിന് x മൂല്യങ്ങളുടെയും y മൂല്യങ്ങളുടെയും ശരാശരിയാണ്.' } },
  ],
};
