import type { MathDomain } from '../universal/types';

export const GENERAL_DOMAIN = {
  id: 'general' as MathDomain,
  label: 'General Mathematics',
  description: 'fallback for topics without a specialized domain',
  keywords: ['math', 'mathematics', 'explain', 'calculate', 'problem'],
  visualObjects: ['term', 'equation', 'result'],
  defaultVisualMode: 'hybrid',
  teachingGrammar: ['identify the mathematical objects', 'show the relationship or operation', 'animate the verified reasoning', 'pause before the conclusion', 'verify the final result'],
} as const;
