export interface MathVerificationResult { valid: boolean; expression?: string; normalized?: string; errors: string[]; }

export interface MathVerifier {
  verify(expression: string, expected?: string): Promise<MathVerificationResult>;
}

/** Runtime-neutral adapter. A Math.js implementation can be injected by the server/material-maker. */
export class InjectableMathVerifier implements MathVerifier {
  constructor(private readonly fn: (expression: string, expected?: string) => Promise<MathVerificationResult> | MathVerificationResult) {}
  verify(expression: string, expected?: string) { return Promise.resolve(this.fn(expression, expected)); }
}

export class UnconfiguredMathVerifier implements MathVerifier {
  async verify(expression: string): Promise<MathVerificationResult> {
    return { valid: false, expression, errors: ['Math verifier is not configured.'] };
  }
}

export type VerifiedMathResult = MathVerificationResult & { steps?: string[] };
