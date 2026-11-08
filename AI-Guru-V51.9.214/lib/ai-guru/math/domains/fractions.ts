import type { MathDomain } from '../universal/types';

export const FRACTIONS_DOMAIN = {
  id: 'fractions' as MathDomain,
  label: 'Fractions',
  description: 'fraction meaning, equivalent fractions, operations and comparison',
  keywords: ['fraction', 'numerator', 'denominator', 'mixed number', 'proper fraction', 'improper fraction', 'equivalent fraction'],
  visualObjects: ['fraction', 'number', 'result'],
  defaultVisualMode: 'construction',
  teachingGrammar: ['identify the mathematical objects', 'show the relationship or operation', 'animate the verified reasoning', 'pause before the conclusion', 'verify the final result'],
} as const;
