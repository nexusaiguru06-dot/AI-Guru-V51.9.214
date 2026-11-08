/**
 * Golden examples for the fraction, histogram and probability-tree DNAs (V51.9.22), in the
 * planner's JSON format, bilingual. They pass through the same validator as any AI plan.
 */

import type { FractionPlan, HistogramPlan, TreePlan } from '../dna/types';

export const FRACTION_SAMPLE: FractionPlan = {
  title: { en: 'One half is two quarters', ml: 'ഒരു പകുതി രണ്ട് കാൽ ഭാഗം' },
  steps: [
    { op: 'bar', n: 2, shade: 1, say: { en: 'Cut a bar into 2 equal parts and colour 1. That is 1 out of 2 parts.', ml: 'ഒരു പട്ടികയെ 2 തുല്യ ഭാഗങ്ങളാക്കി 1 ഭാഗത്തിന് നിറം നൽകുക. 2 ഭാഗങ്ങളിൽ 1 ഭാഗം.' } },
    { op: 'split', bar: 0, by: 2, say: { en: 'Now cut every part in two. The colour does not change, only the numbers do: 2 out of 4 parts.', ml: 'ഇനി ഓരോ ഭാഗത്തെയും രണ്ടായി മുറിക്കുക. നിറം മാറുന്നില്ല, സംഖ്യകൾ മാത്രം മാറുന്നു: 4 ഭാഗങ്ങളിൽ 2 ഭാഗം.' } },
    { op: 'bar', n: 4, shade: 1, say: { en: 'Here is another bar with 4 parts and 1 coloured.', ml: 'ഇതാ 4 ഭാഗങ്ങളുള്ള മറ്റൊരു പട്ടിക, 1 ഭാഗത്തിന് നിറം.' } },
    { op: 'bar', n: 4, shade: 2, say: { en: 'And one with 2 parts coloured.', ml: 'ഇതിൽ 2 ഭാഗത്തിന് നിറം.' } },
    { op: 'join', a: 1, b: 2, say: { en: 'Put the coloured parts end to end: 1 quarter and 2 quarters make 3 quarters.', ml: 'നിറമുള്ള ഭാഗങ്ങൾ തുടർച്ചയായി വയ്ക്കുക: 1 കാൽ ഭാഗവും 2 കാൽ ഭാഗവും ചേർന്ന് 3 കാൽ ഭാഗം.' } },
  ],
};

export const FRACTION_GRID_SAMPLE: FractionPlan = {
  steps: [{ op: 'grid', rows: 10, cols: 10, shade: 35, say: { en: 'A hundred small squares; colour 35 of them. That is 35 out of 100, which is 0.35, which is 35 percent.', ml: 'നൂറ് ചെറിയ ചതുരങ്ങൾ; അതിൽ 35 എണ്ണത്തിന് നിറം നൽകുക. 100-ൽ 35, അതായത് 0.35, അതായത് 35 ശതമാനം.' } }],
};

export const HISTOGRAM_SAMPLE: HistogramPlan = {
  title: { en: 'Marks of five children', ml: 'അഞ്ച് കുട്ടികളുടെ മാർക്ക്' },
  categories: ['A', 'B', 'C', 'D', 'E'],
  yMax: 10,
  yLabel: 'marks',
  steps: [
    { op: 'axes', say: { en: 'Each bar will show one child\'s marks.', ml: 'ഓരോ ബാറും ഓരോ കുട്ടിയുടെ മാർക്ക് കാണിക്കും.' } },
    { op: 'bars', values: [4, 8, 6, 6, 6], say: { en: 'Here are the marks of the five children.', ml: 'അഞ്ച് കുട്ടികളുടെ മാർക്കുകൾ ഇതാ.' } },
    { op: 'highlight', index: 1, say: { en: 'Child B scored the most.', ml: 'B എന്ന കുട്ടിക്കാണ് ഏറ്റവും കൂടുതൽ.' } },
    { op: 'mean', say: { en: 'The mean is the height every bar would have if the marks were shared out equally.', ml: 'മാർക്കുകൾ തുല്യമായി പങ്കിട്ടാൽ ഓരോ ബാറിനും കിട്ടുന്ന ഉയരമാണ് ശരാശരി.' } },
    { op: 'median', say: { en: 'The median is the middle mark when they are put in order.', ml: 'മാർക്കുകൾ ക്രമത്തിൽ വച്ചാൽ നടുവിലെ മാർക്കാണ് മധ്യമം.' } },
    { op: 'change', index: 0, to: 10, say: { en: 'If child A had scored 10, watch the mean move while the median stays.', ml: 'A-ക്ക് 10 കിട്ടിയിരുന്നെങ്കിൽ, ശരാശരി മാറുന്നതും മധ്യമം മാറാതെ നിൽക്കുന്നതും നോക്കൂ.' } },
  ],
};

export const COIN_TREE_SAMPLE: TreePlan = {
  start: 'Start',
  branches: [
    { label: 'H', p: '1/2', children: [{ label: 'H', p: '1/2' }, { label: 'T', p: '1/2' }] },
    { label: 'T', p: '1/2', children: [{ label: 'H', p: '1/2' }, { label: 'T', p: '1/2' }] },
  ],
  steps: [
    { op: 'grow', levels: 1, say: { en: 'Toss a coin: heads or tails, each with chance one half.', ml: 'ഒരു നാണയം ടോസ് ചെയ്യുക: തല അല്ലെങ്കിൽ വാൽ, ഓരോന്നിനും സാധ്യത പകുതി.' } },
    { op: 'grow', levels: 2, say: { en: 'Toss it again. Each branch splits the same way.', ml: 'വീണ്ടും ടോസ് ചെയ്യുക. ഓരോ ശാഖയും അതേപോലെ പിരിയുന്നു.' } },
    { op: 'path', path: [0, 0], say: { en: 'Two heads in a row: multiply along the path.', ml: 'തുടർച്ചയായി രണ്ട് തല: ശാഖയിലൂടെ ഗുണിക്കുക.' } },
    { op: 'event', paths: [[0, 0], [0, 1], [1, 0]], say: { en: 'At least one head: three paths, so add their chances.', ml: 'ഒരു തലയെങ്കിലും: മൂന്ന് വഴികൾ, അതിനാൽ അവയുടെ സാധ്യതകൾ കൂട്ടുക.' } },
    { op: 'total', say: { en: 'All the ends together add up to 1.', ml: 'എല്ലാ അറ്റങ്ങളും കൂടി ചേർന്നാൽ 1 കിട്ടും.' } },
  ],
};

export const BAG_TREE_SAMPLE: TreePlan = {
  start: 'Bag',
  branches: [
    { label: 'R', p: '2/5', children: [{ label: 'R', p: '1/4' }, { label: 'B', p: '3/4' }] },
    { label: 'B', p: '3/5', children: [{ label: 'R', p: '2/4' }, { label: 'B', p: '2/4' }] },
  ],
  steps: [
    { op: 'grow', levels: 1, say: { en: 'A bag has 2 red and 3 blue balls. The first draw: red 2 out of 5, blue 3 out of 5.', ml: 'ഒരു സഞ്ചിയിൽ 2 ചുവപ്പും 3 നീലയും പന്തുകൾ. ആദ്യ തവണ: ചുവപ്പ് 5-ൽ 2, നീല 5-ൽ 3.' } },
    { op: 'grow', levels: 2, say: { en: 'The ball is not put back, so only 4 are left and the chances change.', ml: 'പന്ത് തിരികെ ഇടുന്നില്ല, അതിനാൽ 4 എണ്ണം മാത്രം ബാക്കി; സാധ്യതകൾ മാറുന്നു.' } },
    { op: 'path', path: [0, 0], say: { en: 'Two reds: multiply the two chances.', ml: 'രണ്ടും ചുവപ്പ്: രണ്ട് സാധ്യതകളും ഗുണിക്കുക.' } },
    { op: 'total', say: { en: 'All four ends add up to 1.', ml: 'നാല് അറ്റങ്ങളും കൂടി 1 ആകുന്നു.' } },
  ],
};
