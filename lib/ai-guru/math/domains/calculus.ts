import type { MathDomain } from '../universal/types';

export const CALCULUS_DOMAIN = {
  id: 'calculus' as MathDomain,
  label: 'Calculus',
  description: 'limits, derivatives, integrals and rates of change',
  keywords: ['limit', 'derivative', 'differentiate', 'integral', 'integrate', 'continuity', 'd/dx', '∫', 'lim', 'rate of change', 'tangent', 'secant'],
  visualObjects: ['graph', 'point', 'line', 'equation'],
  defaultVisualMode: 'hybrid',
  teachingGrammar: ['identify the mathematical objects', 'show the relationship or operation', 'animate the verified reasoning', 'pause before the conclusion', 'verify the final result'],
} as const;
