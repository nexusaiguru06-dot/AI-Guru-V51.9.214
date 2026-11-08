import type { MathDomain } from '../universal/types';

export const GEOMETRY_DOMAIN = {
  id: 'geometry' as MathDomain,
  label: 'Geometry',
  description: 'lines, angles, triangles, circles, similarity, congruence and proof',
  keywords: ['angle', 'triangle', 'circle', 'quadrilateral', 'parallel', 'perpendicular', 'congruent', 'similar', 'theorem', 'proof', 'bisector', 'pythagoras', 'construction'],
  visualObjects: ['point', 'line', 'angle', 'shape'],
  defaultVisualMode: 'construction',
  teachingGrammar: ['identify the mathematical objects', 'show the relationship or operation', 'animate the verified reasoning', 'pause before the conclusion', 'verify the final result'],
} as const;
