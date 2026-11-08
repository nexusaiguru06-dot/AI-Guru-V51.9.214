import type { MathDomain } from '../universal/types';

export const MATRICES_DOMAIN = {
  id: 'matrices' as MathDomain,
  label: 'Matrices',
  description: 'matrix operations, determinants and systems',
  keywords: ['matrix', 'matrices', 'determinant', 'inverse matrix', 'row operation', 'column operation'],
  visualObjects: ['matrix-cell', 'operator', 'result'],
  defaultVisualMode: 'transformation',
  teachingGrammar: ['identify the mathematical objects', 'show the relationship or operation', 'animate the verified reasoning', 'pause before the conclusion', 'verify the final result'],
} as const;
