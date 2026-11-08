import type { Problem } from './lesson-json';
import type { ProblemId } from './ids';

export type ProblemRecoveryScope = { kind: 'problem'; problemId: ProblemId };

export interface ProblemContext {
  problem: Problem;
  sourcePage?: number;
  paragraphId?: string;
}

export function isProblem(value: unknown): value is Problem {
  if (!value || typeof value !== 'object') return false;
  const p = value as Partial<Problem>;
  return typeof p.id === 'string' && typeof p.sourceText === 'string' && Array.isArray(p.visualSteps) && Array.isArray(p.audioCues);
}
