import type { VisualAction } from '../lesson/types';

export type Params = Record<string, unknown>;

export interface PatternParamSpec {
  name: string;
  type: 'number' | 'string' | 'boolean' | 'number[]' | 'string[]' | 'string[][]' | 'object' | 'object[]';
  description: string;
  default?: unknown;
}

/**
 * A reusable, TESTED visual recipe in AI Guru's own format (VisualAction[] on the 1000x700 board).
 * The Visual Developer agent picks a pattern and fills its parameters with the real numbers of the step;
 * the build function does the geometry, so the result is always drawable, inside the frame and consistently styled.
 */
export interface VisualPattern {
  id: string;
  name: string;
  summary: string;
  /** When a teacher would reach for this picture. */
  whenToUse: string;
  domains: string[];
  concepts: string[];
  /** Extra search words / synonyms a lesson would use. */
  keywords: string[];
  /**
   * Strong signals: the step's own words must contain one before the Visual Developer spends an LLM call on it.
   * Keeps plain arithmetic like "12 + 15 = 27" from being sent to the model just because it shares a word with a pattern.
   */
  signals: RegExp[];
  params: PatternParamSpec[];
  /** Parameters that produce a good demonstration (used by tests, the gallery and the prompt context). */
  example: Params;
  build(params: Params, opts?: { idPrefix?: string }): VisualAction[];
}

export interface PatternHit {
  pattern: VisualPattern;
  score: number;
  /** Query words that matched, for explaining the choice. */
  matched: string[];
  /** The subset of `matched` that came from the query's own words (not from synonym expansion). */
  direct: string[];
}

export interface VerifyIssue {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  actionId?: string;
}

export interface VerifyResult {
  ok: boolean;
  errors: VerifyIssue[];
  warnings: VerifyIssue[];
  issues: VerifyIssue[];
}
