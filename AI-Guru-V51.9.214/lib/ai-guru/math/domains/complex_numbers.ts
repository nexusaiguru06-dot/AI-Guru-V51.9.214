import type { MathDomain } from '../universal/types';

export const COMPLEX_NUMBERS_DOMAIN = {
  id: 'complex_numbers' as MathDomain,
  label: 'Complex Numbers',
  description: 'complex plane, modulus, argument and operations',
  keywords: ['complex', 'imaginary', 'real part', 'imaginary part', 'argand', 'modulus of z', 'argument', 'complex plane'],
  visualObjects: ['point', 'vector', 'number', 'result'],
  defaultVisualMode: 'construction',
  teachingGrammar: ['identify the mathematical objects', 'show the relationship or operation', 'animate the verified reasoning', 'pause before the conclusion', 'verify the final result'],
} as const;
