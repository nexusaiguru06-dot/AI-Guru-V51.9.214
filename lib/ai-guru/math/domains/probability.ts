import type { MathDomain } from '../universal/types';

export const PROBABILITY_DOMAIN = {
  id: 'probability' as MathDomain,
  label: 'Probability',
  description: 'sample spaces, events, conditional probability and counting outcomes',
  keywords: ['probability', 'sample space', 'event', 'odds', 'chance', 'conditional probability', 'outcome'],
  visualObjects: ['point', 'arrow', 'result'],
  defaultVisualMode: 'construction',
  teachingGrammar: ['identify the mathematical objects', 'show the relationship or operation', 'animate the verified reasoning', 'pause before the conclusion', 'verify the final result'],
} as const;
