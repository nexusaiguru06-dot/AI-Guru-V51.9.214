/**
 * Golden examples for the solids DNA (V51.9.33): a cuboid, a triangular prism, a cylinder, a cone and a
 * sphere, each with its volume and surface area. Written fresh for AI Guru; bilingual (the Malayalam is
 * a draft for a teacher to check); every sample passes the validator.
 */

import type { SolidPlan } from '../dna/types';

export const SOLID_CYLINDER_SAMPLE: SolidPlan = {
  title: { en: 'The cylinder: volume and surface area', ml: 'സിലിണ്ടർ: വ്യാപ്തവും പ്രതലപരപ്പളവും' },
  solid: 'cylinder',
  r: 3,
  h: 7,
  steps: [
    { op: 'show', say: { en: 'A cylinder has a circular base of radius r and a height h.', ml: 'സിലിണ്ടറിന് r ആരമുള്ള വൃത്താകൃതിയിലുള്ള പാദവും h ഉയരവും ഉണ്ട്.' } },
    { op: 'base', say: { en: 'The base is a circle, so its area is pi r squared.', ml: 'പാദം ഒരു വൃത്തമാണ്, അതിനാൽ അതിന്റെ പരപ്പളവ് π r² ആണ്.' } },
    { op: 'volume', say: { en: 'The volume is the base area times the height.', ml: 'വ്യാപ്തം പാദപരപ്പളവും ഉയരവും ഗുണിച്ചതാണ്.' } },
    { op: 'net', say: { en: 'Open the surface: two circles and one rectangle. The rectangle is as long as the circle is round.', ml: 'പ്രതലം നിവർത്തുക: രണ്ട് വൃത്തങ്ങളും ഒരു ചതുരവും. ചതുരത്തിന്റെ നീളം വൃത്തത്തിന്റെ ചുറ്റളവിന് തുല്യമാണ്.' } },
    { op: 'surface', say: { en: 'Add the two circles and the curved part.', ml: 'രണ്ട് വൃത്തങ്ങളും വളഞ്ഞ ഭാഗവും കൂട്ടുക.' } },
  ],
};

export const SOLID_CONE_SAMPLE: SolidPlan = {
  solid: 'cone',
  r: 3,
  h: 4,
  steps: [
    { op: 'show', say: { en: 'A cone has a circular base of radius r and a height h.', ml: 'വൃത്തസ്തൂപികയ്ക്ക് r ആരമുള്ള വൃത്താകൃതിയിലുള്ള പാദവും h ഉയരവും ഉണ്ട്.' } },
    { op: 'base', say: { en: 'The base is a circle.', ml: 'പാദം ഒരു വൃത്തമാണ്.' } },
    { op: 'slant', say: { en: 'The slant height l is the hypotenuse of a right triangle with sides r and h.', ml: 'ചരിവുയരം l, r, h വശങ്ങളുള്ള മട്ടത്രികോണത്തിന്റെ കർണമാണ്.' } },
    { op: 'volume', say: { en: 'A cone holds one third of the cylinder with the same base and height.', ml: 'അതേ പാദവും ഉയരവുമുള്ള സിലിണ്ടറിന്റെ മൂന്നിലൊന്ന് വ്യാപ്തമേ വൃത്തസ്തൂപികയ്ക്ക് ഉള്ളൂ.' } },
    { op: 'net', say: { en: 'Open the surface: a circle and a sector of radius l.', ml: 'പ്രതലം നിവർത്തുക: ഒരു വൃത്തവും l ആരമുള്ള ഒരു വൃത്താംശവും.' } },
    { op: 'surface', say: { en: 'Add the circle and the curved part.', ml: 'വൃത്തവും വളഞ്ഞ ഭാഗവും കൂട്ടുക.' } },
  ],
};

export const SOLID_CUBOID_SAMPLE: SolidPlan = {
  solid: 'cuboid',
  a: 8,
  b: 5,
  h: 4,
  steps: [
    { op: 'show', say: { en: 'A cuboid has a length l, a width w and a height h.', ml: 'ചതുരക്കട്ടയ്ക്ക് നീളം l, വീതി w, ഉയരം h ഉണ്ട്.' } },
    { op: 'base', say: { en: 'The base is a rectangle, l times w.', ml: 'പാദം ഒരു ചതുരമാണ്, l × w.' } },
    { op: 'volume', say: { en: 'The volume is the base area times the height.', ml: 'വ്യാപ്തം പാദപരപ്പളവും ഉയരവും ഗുണിച്ചതാണ്.' } },
    { op: 'net', say: { en: 'Open the box flat: six rectangles in three equal pairs.', ml: 'പെട്ടി നിവർത്തുക: മൂന്ന് ജോടി തുല്യ ചതുരങ്ങൾ, ആകെ ആറ്.' } },
    { op: 'surface', say: { en: 'Add the three pairs of faces.', ml: 'മൂന്ന് ജോടി മുഖങ്ങൾ കൂട്ടുക.' } },
  ],
};

export const SOLID_PRISM_SAMPLE: SolidPlan = {
  solid: 'prism',
  a: 3,
  b: 4,
  h: 10,
  steps: [
    { op: 'show', say: { en: 'A prism with a right triangle at each end and a length h.', ml: 'രണ്ടറ്റത്തും മട്ടത്രികോണമുള്ള, h നീളമുള്ള ഒരു പ്രിസം.' } },
    { op: 'base', say: { en: 'The base is the triangle, half of a times b.', ml: 'പാദം ത്രികോണമാണ്, a × b യുടെ പകുതി.' } },
    { op: 'slant', say: { en: 'The third side of the triangle comes from Pythagoras.', ml: 'ത്രികോണത്തിന്റെ മൂന്നാം വശം പൈതഗോറസ് ഉപയോഗിച്ച് കിട്ടും.' } },
    { op: 'volume', say: { en: 'The volume is the base area times the length.', ml: 'വ്യാപ്തം പാദപരപ്പളവും നീളവും ഗുണിച്ചതാണ്.' } },
    { op: 'net', say: { en: 'Open it flat: three rectangles and two triangles.', ml: 'നിവർത്തുക: മൂന്ന് ചതുരങ്ങളും രണ്ട് ത്രികോണങ്ങളും.' } },
    { op: 'surface', say: { en: 'Add the two triangles and the three rectangles.', ml: 'രണ്ട് ത്രികോണങ്ങളും മൂന്ന് ചതുരങ്ങളും കൂട്ടുക.' } },
  ],
};

export const SOLID_SPHERE_SAMPLE: SolidPlan = {
  solid: 'sphere',
  r: 3,
  steps: [
    { op: 'show', say: { en: 'A sphere is perfectly round: every point is the same distance r from the centre.', ml: 'ഗോളം പൂർണമായും വൃത്താകാരമാണ്: ഓരോ ബിന്ദുവും കേന്ദ്രത്തിൽ നിന്ന് r അകലെയാണ്.' } },
    { op: 'volume', say: { en: 'The volume is four thirds pi r cubed.', ml: 'വ്യാപ്തം π r³ യുടെ നാലിൽ മൂന്നിലൊന്ന് ഇരട്ടിയാണ്.' } },
    { op: 'surface', say: { en: 'The surface is as big as four of its great circles.', ml: 'പ്രതലം അതിന്റെ നാല് വലിയ വൃത്തങ്ങളോളം വലുതാണ്.' } },
  ],
};
