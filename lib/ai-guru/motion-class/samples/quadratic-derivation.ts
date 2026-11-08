/**
 * Sample quadratic-derivation plans (V51.9.48): x² + 6x + 5 = 0 (roots −1 and −5), x² + 8x + 12 = 0 (roots −2
 * and −6) and x² + 2x − 8 = 0 (roots 2 and −4, a negative constant). Used by the tests and the DNA Studio.
 * The Malayalam lines are drafts for a teacher to review.
 */

import type { QdPlan, QdStep } from '../dna/types';
import { offlineQuadraticDerivation } from '../plan/offline';

const base = offlineQuadraticDerivation('');

const withNumbers = (b: number, c: number): QdPlan => ({ b, c, steps: base.steps as QdStep[] });

export const QD_SAMPLE_6_5: QdPlan = {
  title: { en: 'Where does the quadratic formula come from?', ml: 'ദ്വിമാന സൂത്രവാക്യം എവിടെനിന്ന്?' },
  ...withNumbers(6, 5),
};
export const QD_SAMPLE_8_12: QdPlan = withNumbers(8, 12);
export const QD_SAMPLE_2_M8: QdPlan = withNumbers(2, -8);

export const QD_SAMPLES: Record<string, QdPlan> = {
  'x² + 6x + 5': QD_SAMPLE_6_5,
  'x² + 8x + 12': QD_SAMPLE_8_12,
  'x² + 2x − 8': QD_SAMPLE_2_M8,
};
