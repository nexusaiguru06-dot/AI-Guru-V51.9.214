import type { MathDomain } from '../universal/types';

export const ARITHMETIC_DOMAIN = {
  id: 'arithmetic' as MathDomain,
  label: 'Arithmetic',
  description: 'basic operations, place value, estimation, order of operations',
  keywords: ['add', 'subtract', 'multiply', 'divide', 'sum', 'difference', 'product', 'quotient', 'place value', 'order of operations'],
  visualObjects: ['number', 'operator', 'result'],
  defaultVisualMode: 'construction',
  teachingGrammar: ['identify the mathematical objects', 'show the relationship or operation', 'animate the verified reasoning', 'pause before the conclusion', 'verify the final result'],
} as const;
