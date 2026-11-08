import type { MathVerificationResult, MathVerifier } from './adapter';

export class MathJsMathstepsVerifier implements MathVerifier {
  async verify(expression:string, expected?:string):Promise<MathVerificationResult>{
    try {
      const math:any=await import('mathjs');
      const normalized=String(math.simplify(expression));
      if(expected!==undefined){
        const left=math.simplify(expression); const right=math.simplify(expected);
        if(String(left)!==String(right)) return {valid:false,expression,normalized,errors:['Math.js simplification differs from expected expression.']};
      }
      // V51.9.173 (security): mathsteps was removed. It carries mathjs 3.11, whose expression parser can run code
      // (GHSA arbitrary code execution); its optional step list is not used anywhere that needs it.
      return {valid:true,expression,normalized,errors:[]} as MathVerificationResult;
    } catch(error){return {valid:false,expression,errors:[error instanceof Error?error.message:'Math.js verification failed. Install mathjs/mathsteps.']};}
  }
}
