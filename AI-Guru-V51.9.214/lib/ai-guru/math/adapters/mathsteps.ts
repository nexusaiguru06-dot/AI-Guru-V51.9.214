import type { UniversalMathStep } from '../universal/types';

export interface MathStepEngineResult {
  steps: UniversalMathStep[];
  finalAnswer?: string;
  engine: 'mathsteps';
  available: boolean;
  error?: string;
}

/**
 * V51.9.174 (security): the mathsteps package was removed in V51.9.173. It bundles mathjs 3.11, whose expression parser
 * can run code (GHSA arbitrary code execution). The maths agent already works without it (available: false → it uses
 * its own solver / the AI's steps), so this adapter now always reports "not available".
 */
export async function generateMathSteps(_expression: string, _paragraphId = 'problem'): Promise<MathStepEngineResult> {
  return { engine: 'mathsteps', available: false, steps: [], error: 'MathSteps is not installed (removed for security in V51.9.173).' };
}
