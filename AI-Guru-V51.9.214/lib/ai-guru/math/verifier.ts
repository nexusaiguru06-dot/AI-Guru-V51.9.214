import type { MathVerificationResult, MathVerifier } from './adapter';

// Safe baseline verifier for common school algebra. The adapter remains injectable so
// Math.js/Mathsteps can be used when installed in the host application.
function normalize(s:string){return s.replace(/\\left|\\right/g,'').replace(/\\cdot/g,'*').replace(/\s+/g,'').replace(/\^/g,'**');}
function stripVar(s:string){return normalize(s).replace(/[a-zA-Z]+/g,'v');}

export class HybridMathVerifier implements MathVerifier {
  constructor(private readonly advanced?: MathVerifier) {}
  async verify(expression:string, expected?:string):Promise<MathVerificationResult>{
    if (this.advanced) {
      try { const result=await this.advanced.verify(expression,expected); if(result.valid) return result; } catch {}
    }
    const errors:string[]=[];
    const e=normalize(expression);
    if(!e || /[^0-9a-zA-Z+\-*/().=_%\s*]/.test(e)) errors.push('Unsupported mathematical syntax.');
    if((e.match(/=/g)||[]).length>1) errors.push('Expression contains multiple equality signs.');
    if(expected!==undefined && stripVar(expression)!==stripVar(expected)) errors.push('Expected expression does not match normalized form.');
    return {valid:errors.length===0,expression,normalized:e,errors};
  }
}
