import type { MathVerificationResult } from '../adapter';

/** Optional server-side SymPy bridge. Configure SYMPY_VERIFIER_URL to a trusted service. */
export class SympyHttpVerifier {
  constructor(private readonly endpoint = process.env.SYMPY_VERIFIER_URL) {}
  get configured() { return Boolean(this.endpoint); }
  async verify(expression: string, expected?: string): Promise<MathVerificationResult> {
    if (!this.endpoint) return { valid: false, expression, errors: ['SymPy verifier is not configured.'] };
    try {
      const response = await fetch(this.endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ expression, expected }), cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return { valid: false, expression, errors: [String(data?.error || `SymPy service returned ${response.status}`)] };
      return { valid: Boolean(data?.valid), expression, normalized: data?.normalized, errors: Array.isArray(data?.errors) ? data.errors.map(String) : [], ...(Array.isArray(data?.steps) ? { steps: data.steps.map(String) } : {}) } as MathVerificationResult & { steps?: string[] };
    } catch (error) {
      return { valid: false, expression, errors: [error instanceof Error ? error.message : String(error)] };
    }
  }
}
