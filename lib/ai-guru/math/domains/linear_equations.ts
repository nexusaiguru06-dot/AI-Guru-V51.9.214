import type { MathDomain } from '../universal/types';

export const LINEAR_EQUATIONS_DOMAIN = {
  id: 'linear_equations' as MathDomain,
  label: 'Linear Equations',
  description: 'one-variable and simultaneous linear equation solving',
  keywords: ['linear equation', 'solve for', 'unknown', 'equation', 'simultaneous equations', 'elimination', 'substitution'],
  visualObjects: ['equation', 'term', 'result'],
  defaultVisualMode: 'transformation',
  teachingGrammar: ['identify the mathematical objects', 'show the relationship or operation', 'animate the verified reasoning', 'pause before the conclusion', 'verify the final result'],
} as const;
