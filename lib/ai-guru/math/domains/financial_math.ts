import type { MathDomain } from '../universal/types';

export const FINANCIAL_MATH_DOMAIN = {
  id: 'financial_math' as MathDomain,
  label: 'Financial Mathematics',
  description: 'profit/loss, interest, growth, tax and instalments',
  keywords: ['profit', 'loss', 'interest', 'simple interest', 'compound interest', 'installment', 'EMI', 'principal', 'rate', 'amount'],
  visualObjects: ['number', 'arrow', 'result'],
  defaultVisualMode: 'hybrid',
  teachingGrammar: ['identify the mathematical objects', 'show the relationship or operation', 'animate the verified reasoning', 'pause before the conclusion', 'verify the final result'],
} as const;
