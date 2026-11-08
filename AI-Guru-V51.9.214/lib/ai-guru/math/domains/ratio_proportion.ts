import type { MathDomain } from '../universal/types';

export const RATIO_PROPORTION_DOMAIN = {
  id: 'ratio_proportion' as MathDomain,
  label: 'Ratio & Proportion',
  description: 'ratios, rates, proportion and scaling',
  keywords: ['ratio', 'proportion', 'rate', 'direct proportion', 'inverse proportion', 'scale factor'],
  visualObjects: ['number', 'operator', 'result'],
  defaultVisualMode: 'construction',
  teachingGrammar: ['identify the mathematical objects', 'show the relationship or operation', 'animate the verified reasoning', 'pause before the conclusion', 'verify the final result'],
} as const;
