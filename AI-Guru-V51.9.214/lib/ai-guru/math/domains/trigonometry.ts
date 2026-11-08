import type { MathDomain } from '../universal/types';

export const TRIGONOMETRY_DOMAIN = {
  id: 'trigonometry' as MathDomain,
  label: 'Trigonometry',
  description: 'ratios, identities, unit circle and equations',
  keywords: ['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'trigonometry', 'radian', 'unit circle', 'trigonometric identity'],
  visualObjects: ['angle', 'line', 'point', 'equation'],
  defaultVisualMode: 'construction',
  teachingGrammar: ['identify the mathematical objects', 'show the relationship or operation', 'animate the verified reasoning', 'pause before the conclusion', 'verify the final result'],
} as const;
