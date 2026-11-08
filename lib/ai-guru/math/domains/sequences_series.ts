import type { MathDomain } from '../universal/types';

export const SEQUENCES_SERIES_DOMAIN = {
  id: 'sequences_series' as MathDomain,
  label: 'Sequences & Series',
  description: 'patterns, AP, GP, nth term and sums',
  keywords: ['sequence', 'series', 'arithmetic progression', 'geometric progression', 'AP', 'GP', 'nth term', 'common difference', 'common ratio'],
  visualObjects: ['number', 'term', 'result'],
  defaultVisualMode: 'construction',
  teachingGrammar: ['identify the mathematical objects', 'show the relationship or operation', 'animate the verified reasoning', 'pause before the conclusion', 'verify the final result'],
} as const;
