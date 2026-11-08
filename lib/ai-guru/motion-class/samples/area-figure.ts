/**
 * Golden examples for the parallelogram and trapezium area DNA (V51.9.38). Written fresh for AI
 * Guru; bilingual (the Malayalam is a draft for a teacher to check); every sample passes the
 * validator.
 */

import type { AreaFigPlan } from '../dna/types';

export const AF_PAR_SAMPLE: AreaFigPlan = {
  title: { en: 'Area of a parallelogram', ml: 'സമാന്തരീകത്തിന്റെ പരപ്പളവ്' },
  kind: 'parallelogram',
  b: 8,
  h: 5,
  unit: 'cm',
  steps: [
    { op: 'show', say: { en: 'A parallelogram with base 8 centimetres and height 5 centimetres.', ml: 'അടിവശം 8 സെന്റീമീറ്ററും ഉയരം 5 സെന്റീമീറ്ററുമുള്ള ഒരു സമാന്തരീകം.' } },
    { op: 'height', say: { en: 'The height is the perpendicular distance between the parallel sides.', ml: 'സമാന്തര വശങ്ങൾ തമ്മിലുള്ള ലംബ ദൂരമാണ് ഉയരം.' } },
    { op: 'cut', say: { en: 'Cut a right triangle off one end.', ml: 'ഒരറ്റത്തുനിന്ന് ഒരു മട്ടത്രികോണം മുറിച്ചെടുക്കുക.' } },
    { op: 'move', say: { en: 'Slide it to the other end. Now it is a rectangle with the same base and height.', ml: 'അതിനെ മറ്റേ അറ്റത്തേക്ക് നീക്കുക. ഇപ്പോൾ അതേ അടിവശവും ഉയരവുമുള്ള ചതുരം.' } },
    { op: 'formula', say: { en: 'So the area is base times height.', ml: 'അതിനാൽ പരപ്പളവ് അടിവശം × ഉയരം.' } },
  ],
};

export const AF_PAR_LEFT_SAMPLE: AreaFigPlan = {
  kind: 'parallelogram',
  b: 12,
  h: 7,
  lean: 'left',
  steps: [
    { op: 'show', say: { en: 'This parallelogram leans the other way.', ml: 'ഈ സമാന്തരീകം മറുവശത്തേക്ക് ചരിഞ്ഞിരിക്കുന്നു.' } },
    { op: 'height', say: { en: 'Draw the height straight down.', ml: 'ഉയരം നേരെ താഴേക്ക് വരയ്ക്കുക.' } },
    { op: 'cut', say: { en: 'Cut off the triangle.', ml: 'ത്രികോണം മുറിച്ചെടുക്കുക.' } },
    { op: 'move', say: { en: 'Move it across to make a rectangle.', ml: 'അതിനെ മറുവശത്തേക്ക് നീക്കി ചതുരമാക്കുക.' } },
    { op: 'formula', say: { en: 'The area is base times height.', ml: 'പരപ്പളവ് അടിവശം × ഉയരം.' } },
  ],
};

export const AF_TRAP_COPY_SAMPLE: AreaFigPlan = {
  title: { en: 'Area of a trapezium', ml: 'ട്രപ്പീസിയത്തിന്റെ പരപ്പളവ്' },
  kind: 'trapezium',
  b: 10,
  a: 4,
  h: 6,
  unit: 'cm',
  steps: [
    { op: 'show', say: { en: 'A trapezium has one pair of parallel sides, 4 and 10 centimetres.', ml: 'ട്രപ്പീസിയത്തിന് ഒരു ജോടി സമാന്തര വശങ്ങളുണ്ട്, 4-ഉം 10-ഉം സെന്റീമീറ്റർ.' } },
    { op: 'height', say: { en: 'The height between them is 6 centimetres.', ml: 'അവ തമ്മിലുള്ള ഉയരം 6 സെന്റീമീറ്റർ.' } },
    { op: 'copy', say: { en: 'Turn a copy upside down and join it. Together they make a parallelogram with base 4 plus 10.', ml: 'ഒരു പകർപ്പ് തലകീഴായി ചേർക്കുക. രണ്ടും ചേർന്ന് 4 + 10 അടിവശമുള്ള സമാന്തരീകമാകുന്നു.' } },
    { op: 'formula', say: { en: 'One trapezium is half of it.', ml: 'ഒരു ട്രപ്പീസിയം അതിന്റെ പകുതിയാണ്.' } },
  ],
};

export const AF_TRAP_TRI_SAMPLE: AreaFigPlan = {
  kind: 'trapezium',
  b: 9,
  a: 5,
  h: 4,
  lean: 'right',
  steps: [
    { op: 'show', say: { en: 'A trapezium with parallel sides 5 and 9, height 4.', ml: '5, 9 സമാന്തര വശങ്ങളും 4 ഉയരവുമുള്ള ട്രപ്പീസിയം.' } },
    { op: 'height', say: { en: 'Mark the height.', ml: 'ഉയരം അടയാളപ്പെടുത്തുക.' } },
    { op: 'triangles', say: { en: 'A diagonal cuts it into two triangles, one on each parallel side.', ml: 'ഒരു വികർണം അതിനെ രണ്ട് ത്രികോണങ്ങളാക്കുന്നു, ഓരോ സമാന്തര വശത്തും ഒന്ന്.' } },
    { op: 'formula', say: { en: 'The two areas add up to the area of the trapezium.', ml: 'രണ്ട് പരപ്പളവുകളും കൂട്ടിയാൽ ട്രപ്പീസിയത്തിന്റെ പരപ്പളവ് കിട്ടും.' } },
  ],
};

export const AF_TRAP_RIGHT_SAMPLE: AreaFigPlan = {
  kind: 'trapezium',
  b: 9,
  a: 3,
  h: 4,
  lean: 'left',
  unit: 'm',
  steps: [
    { op: 'show', say: { en: 'A trapezium with a right angle at the left.', ml: 'ഇടതുവശത്ത് മട്ടകോണുള്ള ട്രപ്പീസിയം.' } },
    { op: 'height', say: { en: 'Here the height is the left side itself.', ml: 'ഇവിടെ ഉയരം ഇടതുവശം തന്നെയാണ്.' } },
    { op: 'copy', say: { en: 'A turned copy makes a rectangle of base 3 plus 9.', ml: 'തിരിച്ചുവച്ച പകർപ്പ് 3 + 9 അടിവശമുള്ള ചതുരമാക്കുന്നു.' } },
    { op: 'triangles', say: { en: 'Or split it into two triangles.', ml: 'അല്ലെങ്കിൽ രണ്ട് ത്രികോണങ്ങളായി വിഭജിക്കാം.' } },
    { op: 'formula', say: { en: 'Both ways give the same area.', ml: 'രണ്ട് രീതിയിലും ഒരേ പരപ്പളവ്.' } },
  ],
};
