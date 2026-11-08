import type { MathDomain } from '../universal/types';
import { ARITHMETIC_DOMAIN } from './arithmetic';
import { NUMBER_SYSTEMS_DOMAIN } from './number_systems';
import { FRACTIONS_DOMAIN } from './fractions';
import { DECIMALS_PERCENTAGES_DOMAIN } from './decimals_percentages';
import { RATIO_PROPORTION_DOMAIN } from './ratio_proportion';
import { ALGEBRA_DOMAIN } from './algebra';
import { LINEAR_EQUATIONS_DOMAIN } from './linear_equations';
import { INEQUALITIES_DOMAIN } from './inequalities';
import { POLYNOMIALS_DOMAIN } from './polynomials';
import { SEQUENCES_SERIES_DOMAIN } from './sequences_series';
import { COORDINATE_GEOMETRY_DOMAIN } from './coordinate_geometry';
import { FUNCTIONS_DOMAIN } from './functions';
import { TRIGONOMETRY_DOMAIN } from './trigonometry';
import { GEOMETRY_DOMAIN } from './geometry';
import { MENSURATION_DOMAIN } from './mensuration';
import { CALCULUS_DOMAIN } from './calculus';
import { STATISTICS_DOMAIN } from './statistics';
import { PROBABILITY_DOMAIN } from './probability';
import { MATRICES_DOMAIN } from './matrices';
import { VECTORS_DOMAIN } from './vectors';
import { COMPLEX_NUMBERS_DOMAIN } from './complex_numbers';
import { FINANCIAL_MATH_DOMAIN } from './financial_math';
import { THREE_D_GEOMETRY_DOMAIN } from './3d_geometry';
import { SETS_DOMAIN } from './sets';
import { COMBINATORICS_DOMAIN } from './combinatorics';
import { GENERAL_DOMAIN } from './general';
import { ENRICHED_DOMAIN_VISUALS } from './enriched-profiles';

export interface MathDomainProfile {
  id: MathDomain;
  label: string;
  description: string;
  keywords: readonly string[];
  visualObjects: readonly string[];
  defaultVisualMode: 'construction'|'transformation'|'hybrid';
  teachingGrammar: readonly string[];
}

export const MATH_DOMAIN_PROFILES = [
  ARITHMETIC_DOMAIN,
  NUMBER_SYSTEMS_DOMAIN,
  FRACTIONS_DOMAIN,
  DECIMALS_PERCENTAGES_DOMAIN,
  RATIO_PROPORTION_DOMAIN,
  ALGEBRA_DOMAIN,
  LINEAR_EQUATIONS_DOMAIN,
  INEQUALITIES_DOMAIN,
  POLYNOMIALS_DOMAIN,
  SEQUENCES_SERIES_DOMAIN,
  COORDINATE_GEOMETRY_DOMAIN,
  FUNCTIONS_DOMAIN,
  TRIGONOMETRY_DOMAIN,
  GEOMETRY_DOMAIN,
  MENSURATION_DOMAIN,
  CALCULUS_DOMAIN,
  STATISTICS_DOMAIN,
  PROBABILITY_DOMAIN,
  MATRICES_DOMAIN,
  VECTORS_DOMAIN,
  COMPLEX_NUMBERS_DOMAIN,
  FINANCIAL_MATH_DOMAIN,
  THREE_D_GEOMETRY_DOMAIN,
  SETS_DOMAIN,
  COMBINATORICS_DOMAIN,
  GENERAL_DOMAIN,
] as const satisfies readonly MathDomainProfile[];

export const MATH_DOMAIN_COVERAGE = MATH_DOMAIN_PROFILES.map(p => p.id);

export function getMathDomainProfile(domain: MathDomain) {
  const base = MATH_DOMAIN_PROFILES.find(p => p.id === domain) ?? GENERAL_DOMAIN;
  const enriched = ENRICHED_DOMAIN_VISUALS[domain as keyof typeof ENRICHED_DOMAIN_VISUALS];
  if (!enriched) return base;
  return {
    ...base,
    visualObjects: enriched.visualObjects,
    teachingGrammar: enriched.teachingGrammar,
    defaultVisualMode: enriched.defaultVisualMode,
  };
}

export function resolveMathDomainByVocabulary(input: string): MathDomain {
  const text = input.toLowerCase();
  let best: { domain: MathDomain; score: number } = { domain: 'general', score: 0 };
  for (const profile of MATH_DOMAIN_PROFILES) {
    if (profile.id === 'general') continue;
    let score = 0;
    for (const keyword of profile.keywords) {
      if (text.includes(keyword.toLowerCase())) score += keyword.length > 7 ? 2 : 1;
    }
    if (score > best.score) best = { domain: profile.id, score };
  }
  return best.domain;
}
