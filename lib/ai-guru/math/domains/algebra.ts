import type { MathDomain } from '../universal/types';

export const ALGEBRA_DOMAIN = {
  id: 'algebra' as MathDomain,
  label: 'Algebra',
  description: 'expressions, terms, coefficients, simplification and identities',
  keywords: ['algebra', 'term', 'coefficient', 'variable', 'simplify', 'expand', 'identity', 'expression'],
  visualObjects: ['term', 'operator', 'equation', 'result'],
  defaultVisualMode: 'transformation',
  teachingGrammar: ['identify the mathematical objects', 'show the relationship or operation', 'animate the verified reasoning', 'pause before the conclusion', 'verify the final result'],
} as const;
