import type { MathDomain } from '../universal/types';

export const INEQUALITIES_DOMAIN = {
  id: 'inequalities' as MathDomain,
  label: 'Inequalities',
  description: 'linear inequalities, intervals and number-line solutions',
  keywords: ['inequality', 'inequalities', 'less than', 'greater than', 'at most', 'at least', 'interval', 'solution set'],
  visualObjects: ['number', 'line', 'equation', 'result'],
  defaultVisualMode: 'transformation',
  teachingGrammar: ['identify the mathematical objects', 'show the relationship or operation', 'animate the verified reasoning', 'pause before the conclusion', 'verify the final result'],
} as const;
