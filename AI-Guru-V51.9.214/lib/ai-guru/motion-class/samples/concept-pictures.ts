/** Sample plans for the picture layouts of the concept board (V51.9.52). */

import type { BoardPlan } from '../dna/types';

const b = (en: string, ml: string) => ({ en, ml });

export const SCALE_SAMPLE: BoardPlan = {
  layout: 'scale',
  heading: b('Demand and supply', 'ആവശ്യവും വിതരണവും'),
  heads: [b('Demand', 'ആവശ്യം'), b('Supply', 'വിതരണം')],
  points: [
    { col: 0, weight: 3, board: b('Many buyers want mangoes', 'ധാരാളം പേർക്ക് മാമ്പഴം വേണം'), say: b('In summer many buyers want mangoes, so the demand pan is heavy.', 'വേനലിൽ ധാരാളം പേർക്ക് മാമ്പഴം വേണം, അതിനാൽ ആവശ്യത്തിന്റെ തട്ട് ഭാരമുള്ളതാണ്.') },
    { col: 1, weight: 1, board: b('Few mangoes in the market', 'ചന്തയിൽ കുറച്ച് മാമ്പഴം'), say: b('But only a few mangoes reach the market, so the supply pan is light.', 'പക്ഷേ ചന്തയിൽ കുറച്ച് മാമ്പഴമേ എത്തുന്നുള്ളൂ, അതിനാൽ വിതരണത്തിന്റെ തട്ട് ഭാരം കുറഞ്ഞതാണ്.') },
    { col: 1, weight: 2, board: b('Trucks bring more mangoes', 'ലോറികൾ കൂടുതൽ മാമ്പഴം കൊണ്ടുവരുന്നു'), say: b('When trucks bring more mangoes, supply grows and the scale comes level, which settles the price.', 'ലോറികൾ കൂടുതൽ മാമ്പഴം കൊണ്ടുവരുമ്പോൾ വിതരണം കൂടി തുലാസ് സമമാകുന്നു, വില ഉറയ്ക്കുന്നു.') },
  ],
};

export const BARS_SAMPLE: BoardPlan = {
  layout: 'bars',
  heading: b('Rainfall in four cities', 'നാല് നഗരങ്ങളിലെ മഴ'),
  unit: b('cm', 'സെ.മീ'),
  points: [
    { value: 300, board: b('Kochi', 'കൊച്ചി'), say: b('Kochi gets about three hundred centimetres of rain.', 'കൊച്ചിയിൽ ഏകദേശം മുന്നൂറ് സെന്റീമീറ്റർ മഴ കിട്ടുന്നു.') },
    { value: 120, board: b('Chennai', 'ചെന്നൈ'), say: b('Chennai gets far less, about one hundred and twenty.', 'ചെന്നൈയിൽ വളരെ കുറവാണ്, ഏകദേശം നൂറ്റിയിരുപത്.') },
    { value: 65, board: b('Delhi', 'ഡൽഹി'), say: b('Delhi is drier still, with about sixty five.', 'ഡൽഹി ഇതിലും വരണ്ടതാണ്, ഏകദേശം അറുപത്തഞ്ച്.') },
    { value: 25, board: b('Jaisalmer', 'ജയ്സാൽമീർ'), say: b('Jaisalmer, in the desert, gets only twenty five.', 'മരുഭൂമിയിലെ ജയ്സാൽമീറിൽ ഇരുപത്തഞ്ച് മാത്രം.') },
  ],
};

export const TREE_SAMPLE: BoardPlan = {
  layout: 'tree',
  heading: b('Triangles', 'ത്രികോണങ്ങൾ'),
  points: [
    { board: b('By sides', 'വശങ്ങൾ അനുസരിച്ച്'), say: b('We can sort triangles by their sides.', 'ത്രികോണങ്ങളെ വശങ്ങൾ അനുസരിച്ച് തരംതിരിക്കാം.') },
    { board: b('By angles', 'കോണുകൾ അനുസരിച്ച്'), say: b('Or we can sort them by their angles.', 'അല്ലെങ്കിൽ കോണുകൾ അനുസരിച്ച്.') },
    { parent: 0, board: b('Equilateral: all sides equal', 'സമഭുജം: എല്ലാ വശവും തുല്യം'), say: b('Equilateral means all three sides are equal.', 'സമഭുജം എന്നാൽ മൂന്ന് വശവും തുല്യം.') },
    { parent: 0, board: b('Isosceles: two sides equal', 'ഏകസമപാർശ്വം: രണ്ട് വശം തുല്യം'), say: b('Isosceles has two equal sides.', 'ഏകസമപാർശ്വത്തിന് രണ്ട് വശം തുല്യം.') },
    { parent: 1, board: b('Acute: all angles below 90°', 'ന്യൂനകോണം: എല്ലാ കോണും 90°ൽ താഴെ'), say: b('Acute triangles have all angles below ninety degrees.', 'ന്യൂനകോണ ത്രികോണത്തിൽ എല്ലാ കോണും 90°ൽ താഴെ.') },
    { parent: 1, board: b('Right: one angle of 90°', 'മട്ടം: ഒരു കോൺ 90°'), say: b('A right triangle has one angle of exactly ninety degrees.', 'മട്ട ത്രികോണത്തിൽ ഒരു കോൺ കൃത്യം 90°.') },
  ],
};

export const ICON_FLOW_SAMPLE: BoardPlan = {
  layout: 'cycle',
  heading: b('The water cycle', 'ജലചക്രം'),
  points: [
    { board: b('The sun heats the sea', 'സൂര്യൻ കടലിനെ ചൂടാക്കുന്നു'), say: b('The sun heats the sea and water turns to vapour.', 'സൂര്യൻ കടലിനെ ചൂടാക്കി വെള്ളം നീരാവിയാകുന്നു.') },
    { board: b('Vapour forms clouds', 'നീരാവി മേഘമാകുന്നു'), say: b('The vapour rises and forms clouds.', 'നീരാവി ഉയർന്ന് മേഘങ്ങളാകുന്നു.') },
    { board: b('Rain falls on land', 'മഴ ഭൂമിയിൽ പെയ്യുന്നു'), say: b('The clouds give rain on the land.', 'മേഘങ്ങൾ ഭൂമിയിൽ മഴ പെയ്യിക്കുന്നു.') },
    { board: b('Rivers return to the sea', 'നദികൾ കടലിലേക്ക്'), say: b('Rivers carry the water back to the sea.', 'നദികൾ വെള്ളത്തെ കടലിലേക്ക് തിരികെ കൊണ്ടുപോകുന്നു.') },
  ],
};
