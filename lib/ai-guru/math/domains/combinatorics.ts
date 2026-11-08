import type { MathDomain } from '../universal/types';

export const COMBINATORICS_DOMAIN = {
  id: 'combinatorics' as MathDomain,
  label: 'Combinatorics',
  description: 'counting principles, permutations and combinations',
  keywords: ['permutation', 'combination', 'factorial', 'counting principle', 'arrangement', 'selection', 'n choose r', 'npr', 'ncr'],
  visualObjects: ['number', 'tree', 'result'],
  defaultVisualMode: 'construction',
  teachingGrammar: ['identify the mathematical objects', 'show the relationship or operation', 'animate the verified reasoning', 'pause before the conclusion', 'verify the final result'],
} as const;
