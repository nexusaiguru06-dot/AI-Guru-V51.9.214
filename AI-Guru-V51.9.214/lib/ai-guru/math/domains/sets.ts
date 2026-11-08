import type { MathDomain } from '../universal/types';

export const SETS_DOMAIN = {
  id: 'sets' as MathDomain,
  label: 'Sets & Logic',
  description: 'sets, subsets, union, intersection, complements and basic logic',
  keywords: ['set', 'sets', 'subset', 'union', 'intersection', 'complement', 'venn diagram', 'logic', 'proposition'],
  visualObjects: ['shape', 'label', 'result'],
  defaultVisualMode: 'construction',
  teachingGrammar: ['identify the mathematical objects', 'show the relationship or operation', 'animate the verified reasoning', 'pause before the conclusion', 'verify the final result'],
} as const;
