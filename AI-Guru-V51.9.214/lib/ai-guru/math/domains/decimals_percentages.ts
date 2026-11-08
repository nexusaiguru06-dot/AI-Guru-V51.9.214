import type { MathDomain } from '../universal/types';

export const DECIMALS_PERCENTAGES_DOMAIN = {
  id: 'decimals_percentages' as MathDomain,
  label: 'Decimals & Percentages',
  description: 'decimal place value, conversion, percentage and applications',
  keywords: ['decimal', 'percentage', 'percent', 'discount', 'tax', 'increase', 'decrease', 'place value'],
  visualObjects: ['number', 'operator', 'result'],
  defaultVisualMode: 'hybrid',
  teachingGrammar: ['identify the mathematical objects', 'show the relationship or operation', 'animate the verified reasoning', 'pause before the conclusion', 'verify the final result'],
} as const;
