import type { MathDomain } from '../universal/types';

export const VECTORS_DOMAIN = {
  id: 'vectors' as MathDomain,
  label: 'Vectors',
  description: 'vector components, magnitude, direction, dot and cross products',
  keywords: ['vector', 'dot product', 'cross product', 'magnitude', 'direction', 'component'],
  visualObjects: ['vector', 'point', 'line', 'result'],
  defaultVisualMode: 'construction',
  teachingGrammar: ['identify the mathematical objects', 'show the relationship or operation', 'animate the verified reasoning', 'pause before the conclusion', 'verify the final result'],
} as const;
