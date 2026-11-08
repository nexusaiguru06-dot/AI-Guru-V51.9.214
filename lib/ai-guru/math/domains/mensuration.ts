import type { MathDomain } from '../universal/types';

export const MENSURATION_DOMAIN = {
  id: 'mensuration' as MathDomain,
  label: 'Mensuration',
  description: 'perimeter, area, surface area and volume',
  keywords: ['area', 'perimeter', 'surface area', 'volume', 'cylinder', 'sphere', 'cone', 'cuboid', 'prism'],
  visualObjects: ['shape', 'line', 'number', 'result'],
  defaultVisualMode: 'construction',
  teachingGrammar: ['identify the mathematical objects', 'show the relationship or operation', 'animate the verified reasoning', 'pause before the conclusion', 'verify the final result'],
} as const;
