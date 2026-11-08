import type { MathDomain } from '../universal/types';

export const THREE_D_GEOMETRY_DOMAIN = {
  id: '3d_geometry' as MathDomain,
  label: '3D Geometry',
  description: 'solids, coordinates, planes, sections and spatial measures',
  keywords: ['3d', 'three dimensional', '3-dimensional', 'solid', 'plane', 'sphere', 'cone', 'cuboid', 'prism', 'surface'],
  visualObjects: ['shape', 'point', 'line', 'result'],
  defaultVisualMode: 'construction',
  teachingGrammar: ['identify the mathematical objects', 'show the relationship or operation', 'animate the verified reasoning', 'pause before the conclusion', 'verify the final result'],
} as const;
