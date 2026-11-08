import type { MathDomain } from '../universal/types';

export const POLYNOMIALS_DOMAIN = {
  id: 'polynomials' as MathDomain,
  label: 'Polynomials',
  description: 'polynomial operations, factorisation, roots and identities',
  keywords: ['polynomial', 'factor', 'factorise', 'factorize', 'quadratic', 'cubic', 'root', 'degree', 'discriminant'],
  visualObjects: ['term', 'equation', 'result'],
  defaultVisualMode: 'transformation',
  teachingGrammar: ['identify the mathematical objects', 'show the relationship or operation', 'animate the verified reasoning', 'pause before the conclusion', 'verify the final result'],
} as const;
