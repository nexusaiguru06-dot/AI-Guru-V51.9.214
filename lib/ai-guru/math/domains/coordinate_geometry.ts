import type { MathDomain } from '../universal/types';

export const COORDINATE_GEOMETRY_DOMAIN = {
  id: 'coordinate_geometry' as MathDomain,
  label: 'Coordinate Geometry',
  description: 'coordinates, slope, distance, midpoint and lines',
  keywords: ['coordinate', 'slope', 'gradient', 'x-intercept', 'y-intercept', 'midpoint', 'distance between', 'line equation'],
  visualObjects: ['point', 'line', 'graph', 'result'],
  defaultVisualMode: 'construction',
  teachingGrammar: ['identify the mathematical objects', 'show the relationship or operation', 'animate the verified reasoning', 'pause before the conclusion', 'verify the final result'],
} as const;
