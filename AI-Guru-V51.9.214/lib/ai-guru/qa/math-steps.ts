import { ids, type Lesson, type QAResult, type QAFailure } from '../contracts';

export const MATH_STEPS_QA_VERSION = 'math-steps-1.0';

export function runMathStepsQA(lesson: Lesson, paragraphId?: string): QAResult {
  const failures: QAFailure[] = [];
  const paragraphs = paragraphId ? lesson.paragraphs.filter(p => p.id === paragraphId) : lesson.paragraphs;
  for (const p of paragraphs) {
    const steps = p.math?.steps ?? [];
    const seen = new Set<string>();
    for (const step of steps) {
      if (seen.has(step.id)) failures.push(fail(lesson,p,'MATH_STEP_DUPLICATE_ID',`Duplicate math step ID: ${step.id}`));
      seen.add(step.id);
      if (!step.before.trim() || !step.after.trim()) failures.push(fail(lesson,p,'MATH_STEP_STATE_MISSING','Math step must contain both before and after states.'));
      if (!step.operation.trim()) failures.push(fail(lesson,p,'MATH_STEP_OPERATION_MISSING','Math step has no operation/change type.'));
      if (!step.verified) failures.push(fail(lesson,p,'MATH_STEP_UNVERIFIED','Math step is not verified.'));
      if (!step.source) failures.push(fail(lesson,p,'MATH_STEP_SOURCE_MISSING','Math step has no solver source.'));
    }
  }
  return { qaRunId: ids.qaRun(`math-steps-${lesson.id}-${Date.now()}`), qa: 'math-verification', status: failures.some(f => f.severity === 'error') ? 'failed' : 'passed', scope: paragraphId ? 'paragraph' : 'lesson', targetId: paragraphId ?? lesson.id, failures, checkedAt: new Date().toISOString(), rulesVersion: MATH_STEPS_QA_VERSION };
}
function fail(lesson: Lesson,p:any,code:string,message:string):QAFailure{return {id:`${lesson.id}:${code}:${p.id}`,code,message,severity:'error',scope:'paragraph',lessonId:lesson.id,paragraphId:p.id,recoverable:true,recoveryAction:'regenerate-and-verify-math-steps'}}
