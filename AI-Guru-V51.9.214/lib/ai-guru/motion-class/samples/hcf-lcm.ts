/**
 * Sample HCF/LCM plans (V51.9.49): 12 and 18 (HCF 6, LCM 36), 36 and 48 (HCF 12, LCM 144), 8 and 15
 * (co-prime: HCF 1, LCM 120) and 6 and 12 (one divides the other). The Malayalam lines are drafts for
 * a teacher to review.
 */

import type { HlPlan } from '../dna/types';
import { offlineHclm } from '../plan/offline';

const make = (a: number, b: number): HlPlan => offlineHclm(`${a} and ${b}`);

export const HL_SAMPLE_12_18: HlPlan = { title: { en: 'HCF and LCM of 12 and 18', ml: '12, 18 എന്നിവയുടെ ഉസാഘ, ലസാഗു' }, ...make(12, 18) };
export const HL_SAMPLE_36_48: HlPlan = make(36, 48);
export const HL_SAMPLE_COPRIME: HlPlan = make(8, 15);
export const HL_SAMPLE_DIVIDES: HlPlan = make(6, 12);

export const HL_SAMPLES: Record<string, HlPlan> = {
  '12 and 18': HL_SAMPLE_12_18,
  '36 and 48': HL_SAMPLE_36_48,
  '8 and 15 (co-prime)': HL_SAMPLE_COPRIME,
  '6 and 12': HL_SAMPLE_DIVIDES,
};
