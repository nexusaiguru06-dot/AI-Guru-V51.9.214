/**
 * Enriched domain profiles: stronger visualObjects + teachingGrammar
 * so every branch drives geometry-first 3B1B construction.
 *
 * Merge these fields into the existing domain files (or import from here
 * in domains/index.ts). IDs and keywords stay the same; only visual
 * guidance is upgraded.
 */

import type { MathDomain } from '../universal/types';
import { DOMAIN_3B1B_OBJECTS, DOMAIN_3B1B_RECIPE } from '../universal/three-b1b-universal-policy';

export interface EnrichedDomainVisuals {
  id: MathDomain;
  visualObjects: readonly string[];
  defaultVisualMode: 'construction' | 'transformation' | 'hybrid';
  teachingGrammar: readonly string[];
}

function enrich(
  id: MathDomain,
  mode: EnrichedDomainVisuals['defaultVisualMode'],
): EnrichedDomainVisuals {
  return {
    id,
    visualObjects: DOMAIN_3B1B_OBJECTS[id],
    defaultVisualMode: mode,
    teachingGrammar: DOMAIN_3B1B_RECIPE[id],
  };
}

/** Ready-to-merge visual upgrades for all branches. */
export const ENRICHED_DOMAIN_VISUALS: Record<MathDomain, EnrichedDomainVisuals> = {
  arithmetic: enrich('arithmetic', 'construction'),
  number_systems: enrich('number_systems', 'hybrid'),
  fractions: enrich('fractions', 'construction'),
  decimals_percentages: enrich('decimals_percentages', 'construction'),
  ratio_proportion: enrich('ratio_proportion', 'hybrid'),
  algebra: enrich('algebra', 'transformation'),
  linear_equations: enrich('linear_equations', 'transformation'),
  inequalities: enrich('inequalities', 'hybrid'),
  polynomials: enrich('polynomials', 'hybrid'),
  sequences_series: enrich('sequences_series', 'construction'),
  coordinate_geometry: enrich('coordinate_geometry', 'construction'),
  functions: enrich('functions', 'hybrid'),
  trigonometry: enrich('trigonometry', 'construction'),
  geometry: enrich('geometry', 'construction'),
  mensuration: enrich('mensuration', 'construction'),
  calculus: enrich('calculus', 'hybrid'),
  statistics: enrich('statistics', 'construction'),
  probability: enrich('probability', 'construction'),
  matrices: enrich('matrices', 'transformation'),
  vectors: enrich('vectors', 'transformation'),
  complex_numbers: enrich('complex_numbers', 'hybrid'),
  financial_math: enrich('financial_math', 'construction'),
  '3d_geometry': enrich('3d_geometry', 'construction'),
  sets: enrich('sets', 'construction'),
  combinatorics: enrich('combinatorics', 'construction'),
  general: enrich('general', 'hybrid'),
};
