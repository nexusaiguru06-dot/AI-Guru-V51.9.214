/** The computer-science agent: sorting algorithms on a short list of numbers. */
import type { SubjectAgent } from '../../types';
import { score } from '../../claim';
import { sortTemplate, type SortKind, type SortPlan } from './array-sort';

const WORDS: Array<[RegExp, number]> = [
  [/\b(sorting|sort|bubble|selection sort|insertion sort)\b/i, 0.4],
  [/\b(algorithm|array|list of numbers|searching|binary search)\b/i, 0.25],
  [/\b(program\w*|code|variable|loop|function|data ?type|compiler|python|scratch|flowchart|pseudocode)\b/i, 0.3],
  [/\b(computer|binary|bit|byte|network|internet|database|software|hardware)\b/i, 0.2],
];
const s = (en: string, ml: string) => ({ en, ml });

export const computerScienceAgent: SubjectAgent = {
  id: 'computer-science',
  name: 'Computer science agent',
  templates: [sortTemplate],
  claim: (b, ctx) => score(b, ctx, WORDS, 'computer'),
  fromText(b) {
    if (!/\bsort/i.test(b.text)) return null;
    const list = b.text.match(/\[?\s*(\d{1,2}(?:\s*,\s*\d{1,2}){2,6})\s*\]?/);
    if (!list) return null;
    const values = list[1].split(',').map((x) => Number(x.trim()));
    const kind: SortKind = /selection/i.test(b.text) ? 'selection' : /insertion/i.test(b.text) ? 'insertion' : 'bubble';
    const plan: SortPlan = {
      kind,
      values,
      steps: [
        { op: 'show', say: s('We want to sort these numbers from smallest to largest.', 'ഈ സംഖ്യകളെ ചെറുതിൽ നിന്ന് വലുതിലേക്ക് ക്രമീകരിക്കണം.') },
        { op: 'run', say: s(`Watch the ${kind} sort compare and swap.`, `${kind} സോർട്ട് താരതമ്യം ചെയ്യുന്നതും മാറ്റുന്നതും ശ്രദ്ധിക്കൂ.`) },
        { op: 'answer', say: s('The list is sorted. See how many comparisons and swaps it took.', 'പട്ടിക ക്രമത്തിലായി. എത്ര താരതമ്യവും കൈമാറ്റവും വേണ്ടിവന്നെന്ന് നോക്കൂ.') },
      ],
    };
    return { template: 'array-sort', teach: plan };
  },
  system: `You are the COMPUTER-SCIENCE planning agent of a school classroom. You turn ONE textbook block into a plan for the fixed template "array-sort": the app itself RUNS the sorting algorithm on your list and animates every compare and swap, counting them.
Reply with ONE JSON object: {"template":"array-sort","teach":{"kind":"bubble"|"selection"|"insertion","values":[5,2,8,1,4],"steps":[{"op":"show","say":{en,ml}},{"op":"run","say":{en,ml}},{"op":"answer","say":{en,ml}}]},"read":{"en":"<the block text>","ml":"<faithful Malayalam translation>"}}.
values: 3 to 7 whole numbers 0–99 (use the text's list if it gives one). Steps in this order, each once. Captions: one idea, 6–22 words, natural Malayalam; do not state counts.
If the block is not about sorting, reply {"template":null}.`,
};
