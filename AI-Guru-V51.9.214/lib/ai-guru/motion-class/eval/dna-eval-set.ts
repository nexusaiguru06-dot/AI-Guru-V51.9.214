/**
 * Labelled paragraphs for comparing DNA selectors: 24 English, 24 Malayalam, three per DNA.
 * `hard` marks paragraphs that avoid the usual keywords on purpose (the rules are expected to
 * miss some of them). None of them repeats a sentence of the DNA cards.
 *
 * The Malayalam was drafted by the assistant, not by a teacher: have it read before quoting
 * accuracy numbers anywhere.
 */

import type { DnaId } from '../dna/types';

export interface EvalItem {
  lang: 'en' | 'ml';
  text: string;
  expect: DnaId;
  hard?: boolean;
}

const en = (expect: DnaId, text: string, hard = false): EvalItem => ({ lang: 'en', text, expect, hard });
const ml = (expect: DnaId, text: string, hard = false): EvalItem => ({ lang: 'ml', text, expect, hard });

export const EVAL_SET: EvalItem[] = [
  en('plane-transform', 'Multiply the vector (2, 1) by the matrix and see where the arrow ends up.'),
  en('plane-transform', 'The mirror image of the flag is formed by flipping each point across the dotted line.', true),
  en('plane-transform', 'Turn the whole figure about the origin through 90 degrees; what are the new coordinates of its corners?'),
  en('function-graph', 'Plot the points (1, 3) and (2, 5) on the axes and draw the line through them.'),
  en('function-graph', 'How steep is the line? Compare how far it rises with how far it runs.', true),
  en('function-graph', 'Draw the curve of y = x^2 for values of x from −3 to 3.'),
  en('fraction-bars', 'Divide the bar into 8 equal parts and shade 3/8 of it.'),
  en('fraction-bars', 'Rani ate one of the four equal pieces of a cake and Raju ate two pieces. How much did they eat together?', true),
  en('fraction-bars', 'Write 0.75 as a fraction and as a percentage.', true),
  en('histogram', 'The bar graph shows the number of books read by five students. Find the mean of the data.'),
  en('histogram', 'Five friends scored 12, 15, 9, 14 and 10 in a quiz. What is the middle score when they are arranged in order?', true),
  en('histogram', 'The tally of votes for four sports is given. Which sport is liked most?'),
  en('probability-tree', 'A coin is tossed twice. What is the probability of getting two heads?'),
  en('probability-tree', 'There are 3 red and 2 green marbles in a box. Two marbles are taken one after another without putting back. Find the chance that both are red.'),
  en('probability-tree', 'What are the odds that it rains on both Saturday and Sunday if each day has a 30 percent chance?'),
  en('geometry-construction', 'Construct an isosceles triangle with base 5 cm and equal sides 7 cm.'),
  en('geometry-construction', 'Draw the perpendicular bisector of the segment AB.'),
  en('geometry-construction', 'Two lines cut each other, and the vertically opposite angles are equal; show this in a figure.'),
  en('number-line', 'Show −3 and 2 on a number line and find the distance between them.'),
  en('number-line', 'The temperature fell from 4 degrees to 3 below zero. Show the change.'),
  en('number-line', 'Start at 0, jump 3 steps right, then 5 steps left. Where do you stop?', true),
  en('concept-board', 'Mathematics is the study of patterns, and patterns are found in nature and in music.'),
  en('concept-board', 'Ancient Indian mathematicians such as Aryabhata and Brahmagupta made important discoveries.'),
  en('concept-board', 'Always check your answer by putting it back into the original question.'),

  ml('plane-transform', 'മാട്രിക്സ് കൊണ്ട് വെക്ടറിനെ ഗുണിക്കുമ്പോൾ അമ്പ് പുതിയ സ്ഥാനത്തേക്ക് നീങ്ങുന്നു.'),
  ml('plane-transform', 'രൂപത്തിലെ ഓരോ ബിന്ദുവിനെയും കണ്ണാടിയിലെന്നപോലെ മറുവശത്തേക്ക് മാറ്റുക.', true),
  ml('plane-transform', 'ചിത്രത്തെ ഉത്ഭവബിന്ദുവിനു ചുറ്റും 90 ഡിഗ്രി തിരിച്ചാൽ മൂലകളുടെ പുതിയ സ്ഥാനം എന്താകും?', true),
  ml('function-graph', 'ബിന്ദുക്കൾ (1, 3), (2, 5) എന്നിവ അക്ഷങ്ങളിൽ അടയാളപ്പെടുത്തി അവയിലൂടെ ഒരു രേഖ വരയ്ക്കുക.', true),
  ml('function-graph', 'y = x² ന്റെ ഗ്രാഫ് x = −3 മുതൽ 3 വരെ വരയ്ക്കുക.', true),
  ml('function-graph', 'രേഖ എത്ര കുത്തനെയാണ് എന്നറിയാൻ അത് എത്ര ഉയരുന്നു എന്നും എത്ര മുന്നോട്ട് പോകുന്നു എന്നും നോക്കുക.', true),
  ml('fraction-bars', 'ഒരു പട്ടികയെ 8 തുല്യ ഭാഗങ്ങളാക്കി അതിൽ 3 ഭാഗത്തിന് നിറം നൽകുക.', true),
  ml('fraction-bars', 'ഒരു കേക്കിന്റെ നാല് തുല്യ കഷണങ്ങളിൽ ഒന്ന് റാണിയും രണ്ടെണ്ണം രാജുവും കഴിച്ചു. രണ്ടു പേരും കൂടി എത്ര കഴിച്ചു?', true),
  ml('fraction-bars', '0.75 നെ ഭിന്നസംഖ്യയായും ശതമാനമായും എഴുതുക.', true),
  ml('histogram', 'ബാർ ഗ്രാഫ് അഞ്ച് കുട്ടികൾ വായിച്ച പുസ്തകങ്ങളുടെ എണ്ണം കാണിക്കുന്നു. ശരാശരി കണ്ടെത്തുക.', true),
  ml('histogram', 'അഞ്ച് കൂട്ടുകാർക്ക് ക്വിസിൽ 12, 15, 9, 14, 10 എന്നിങ്ങനെ മാർക്ക് കിട്ടി. ക്രമത്തിൽ എഴുതിയാൽ നടുവിലെ മാർക്ക് ഏത്?', true),
  ml('histogram', 'നാല് കളികൾക്ക് കിട്ടിയ വോട്ടുകളുടെ കണക്ക് തന്നിരിക്കുന്നു. ഏത് കളിക്കാണ് ഏറ്റവും കൂടുതൽ ഇഷ്ടം?', true),
  ml('probability-tree', 'ഒരു നാണയം രണ്ട് തവണ ടോസ് ചെയ്താൽ രണ്ടും തല കിട്ടാനുള്ള സാധ്യത എന്താണ്?', true),
  ml('probability-tree', 'ഒരു പെട്ടിയിൽ 3 ചുവപ്പും 2 പച്ചയും ഗോലികളുണ്ട്. തിരികെ ഇടാതെ തുടർച്ചയായി രണ്ടെണ്ണം എടുത്താൽ രണ്ടും ചുവപ്പാകാനുള്ള സാധ്യത കണ്ടെത്തുക.', true),
  ml('probability-tree', 'ശനിയാഴ്ചയും ഞായറാഴ്ചയും മഴ പെയ്യാനുള്ള സാധ്യത ഓരോ ദിവസവും 30 ശതമാനമാണെങ്കിൽ രണ്ടു ദിവസവും മഴ പെയ്യാനുള്ള സാധ്യത എത്ര?', true),
  ml('geometry-construction', '5 സെ.മീ. പാദവും 7 സെ.മീ. വീതം തുല്യ വശങ്ങളുമുള്ള സമപാർശ്വ ത്രികോണം വരയ്ക്കുക.', true),
  ml('geometry-construction', 'AB എന്ന രേഖാഖണ്ഡത്തിന്റെ ലംബസമഭാജി വരയ്ക്കുക.', true),
  ml('geometry-construction', 'രണ്ട് രേഖകൾ മുറിച്ചുകടക്കുമ്പോൾ ലംബകോണുകൾ തുല്യമാണെന്ന് ചിത്രത്തിൽ കാണിക്കുക.', true),
  ml('number-line', '−3 ഉം 2 ഉം സംഖ്യാരേഖയിൽ അടയാളപ്പെടുത്തി അവ തമ്മിലുള്ള അകലം കണ്ടെത്തുക.', true),
  ml('number-line', 'താപനില 4 ഡിഗ്രിയിൽ നിന്ന് പൂജ്യത്തിന് താഴെ 3 ഡിഗ്രിയിലേക്ക് കുറഞ്ഞു. മാറ്റം കാണിക്കുക.', true),
  ml('number-line', '0-ൽ തുടങ്ങി 3 ചുവട് വലത്തേക്കും പിന്നെ 5 ചുവട് ഇടത്തേക്കും പോയാൽ എവിടെ നിൽക്കും?', true),
  ml('concept-board', 'ഗണിതം എന്നത് മാതൃകകളെക്കുറിച്ചുള്ള പഠനമാണ്; പ്രകൃതിയിലും സംഗീതത്തിലും മാതൃകകൾ കാണാം.', true),
  ml('concept-board', 'ആര്യഭടൻ, ബ്രഹ്മഗുപ്തൻ തുടങ്ങിയ പ്രാചീന ഭാരതീയ ഗണിതശാസ്ത്രജ്ഞർ പ്രധാന കണ്ടെത്തലുകൾ നടത്തി.', true),
  ml('concept-board', 'ഉത്തരം കിട്ടിയാൽ അത് ആദ്യത്തെ ചോദ്യത്തിൽ വച്ച് ശരിയാണോ എന്ന് പരിശോധിക്കണം.', true),
];
