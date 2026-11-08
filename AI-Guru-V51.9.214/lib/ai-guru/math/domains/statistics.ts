import type { MathDomain } from '../universal/types';

export const STATISTICS_DOMAIN = {
  id: 'statistics' as MathDomain,
  label: 'Statistics',
  description: 'data, averages, spread, distributions and charts',
  keywords: ['mean', 'median', 'mode', 'variance', 'standard deviation', 'histogram', 'frequency', 'quartile', 'data', 'box plot'],
  visualObjects: ['number', 'graph', 'shape', 'result'],
  defaultVisualMode: 'construction',
  teachingGrammar: ['identify the mathematical objects', 'show the relationship or operation', 'animate the verified reasoning', 'pause before the conclusion', 'verify the final result'],
} as const;
