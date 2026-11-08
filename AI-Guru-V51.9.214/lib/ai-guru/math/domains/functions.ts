import type { MathDomain } from '../universal/types';

export const FUNCTIONS_DOMAIN = {
  id: 'functions' as MathDomain,
  label: 'Functions',
  description: 'mapping, domain, range, transformations and graphs',
  keywords: ['function', 'domain', 'range', 'mapping', 'f(x)', 'g(x)', 'composite function', 'inverse function'],
  visualObjects: ['point', 'graph', 'equation', 'result'],
  defaultVisualMode: 'hybrid',
  teachingGrammar: ['identify the mathematical objects', 'show the relationship or operation', 'animate the verified reasoning', 'pause before the conclusion', 'verify the final result'],
} as const;
