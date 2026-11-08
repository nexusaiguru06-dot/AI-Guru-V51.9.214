import type { MathDomain } from '../universal/types';

export const NUMBER_SYSTEMS_DOMAIN = {
  id: 'number_systems' as MathDomain,
  label: 'Number Systems',
  description: 'natural, whole, integer, rational, irrational and real numbers',
  keywords: ['integer', 'rational number', 'irrational number', 'real number', 'natural number', 'whole number', 'number line', 'square root', 'surds'],
  visualObjects: ['number', 'point', 'line'],
  defaultVisualMode: 'construction',
  teachingGrammar: ['identify the mathematical objects', 'show the relationship or operation', 'animate the verified reasoning', 'pause before the conclusion', 'verify the final result'],
} as const;
