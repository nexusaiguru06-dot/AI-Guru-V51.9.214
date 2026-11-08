import type { Lesson } from '../contracts';
import type { QaFailure } from '../qa/automatic-recovery';
import { exactRepairFor } from '../qa/automatic-recovery';
import { recordAIGuruAudit } from '../runtime/audit-trail';

export type RecoveryScope='visual-step'|'problem'|'paragraph'|'lesson';
export interface ScopedRecoveryRequest { lesson:Lesson; failure:QaFailure & {paragraphId?:string;problemId?:string;visualStepId?:string}; attempt?:number; maxAttempts?:number; }
export interface ScopedRecoveryResult { ok:boolean; status:'RECOVERED'|'ESCALATED'|'NO_ACTION'; scope:RecoveryScope; attempt:number; action?:string; lesson:Lesson; reason?:string; }

function scopeOf(f:ScopedRecoveryRequest['failure']):RecoveryScope { if(f.visualStepId) return 'visual-step'; if(f.problemId) return 'problem'; if(f.paragraphId) return 'paragraph'; return 'lesson'; }
export async function recoverScoped(req:ScopedRecoveryRequest, repair:(lesson:Lesson, scope:RecoveryScope, action:string, failure:ScopedRecoveryRequest['failure'])=>Promise<Lesson>):Promise<ScopedRecoveryResult>{
  const attempt=req.attempt??1, max=req.maxAttempts??3, scope=scopeOf(req.failure), mapped=exactRepairFor(req.failure);
  if(!mapped.ok) return {ok:false,status:'NO_ACTION',scope,attempt,lesson:req.lesson,reason:mapped.reason};
  if(attempt>max) return {ok:false,status:'ESCALATED',scope,attempt,lesson:req.lesson,reason:'Maximum recovery attempts reached'};
  await recordAIGuruAudit({type:'recovery_started',agent:'recovery',lessonId:req.lesson.id,paragraphId:req.failure.paragraphId,problemId:req.failure.problemId,status:'STARTED',data:{scope,action:mapped.action,attempt}});
  const lesson=await repair(req.lesson,scope,mapped.action!,req.failure);
  await recordAIGuruAudit({type:'recovery_completed',agent:'recovery',lessonId:lesson.id,paragraphId:req.failure.paragraphId,problemId:req.failure.problemId,status:'RECHECK_REQUIRED',data:{scope,action:mapped.action,attempt}});
  return {ok:true,status:'RECOVERED',scope,attempt,action:mapped.action,lesson};
}
