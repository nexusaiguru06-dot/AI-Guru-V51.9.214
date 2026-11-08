import { ids, type Lesson, type QAResult, type QAFailure, type Paragraph } from '../contracts';
import { findBestReferral, selectTeachingStrategy, type TeachingStrategy } from '../teaching/strategy';
import { detectMathDomain } from '../math/universal';

export const TEACHING_STRATEGY_QA_VERSION = 'strategy-1.0';

export function runTeachingStrategyQA(lesson: Lesson, paragraphId?: string): QAResult {
  const failures: QAFailure[] = [];
  const paragraphs = paragraphId ? lesson.paragraphs.filter(p => p.id === paragraphId) : lesson.paragraphs;
  if (paragraphId && !paragraphs.length) failures.push(failure(lesson, undefined, 'STRATEGY_PARAGRAPH_NOT_FOUND', 'Teaching strategy target paragraph was not found.', 'lesson', paragraphId, false));
  for (const paragraph of paragraphs) checkParagraph(lesson, paragraph, failures);
  return { qaRunId: ids.qaRun(`strategy-${lesson.id}-${Date.now()}`), qa: 'teaching-strategy', status: failures.some(f => f.severity === 'error') ? 'failed' : 'passed', scope: paragraphId ? 'paragraph' : 'lesson', targetId: paragraphId ?? lesson.id, failures, checkedAt: new Date().toISOString(), rulesVersion: TEACHING_STRATEGY_QA_VERSION };
}

function checkParagraph(lesson: Lesson, p: Paragraph, failures: QAFailure[]) {
  const decision = selectTeachingStrategy({ question: p.source.text, domain: detectMathDomain(p.source.text), grade: inferGrade(p) });
  const selected = p.teachingStrategy ?? p.math?.strategy;
  if (selected && !['referral_video','step_by_step','specialized_visual','hybrid'].includes(selected)) failures.push(failure(lesson,p,'STRATEGY_UNKNOWN','Unknown teaching strategy.','paragraph',p.id,true));
  if (selected && selected !== decision.strategy) {
    // A material may explicitly override the heuristic, but only when it can explain the override.
    if (selected === 'referral_video' && !findBestReferral(p.source.text, decision.domain, inferGrade(p))) failures.push(failure(lesson,p,'STRATEGY_REFERRAL_UNAVAILABLE','Referral-video strategy selected but no sufficiently matched approved referral was found.','paragraph',p.id,true));
    else if (selected !== 'hybrid' && decision.strategy === 'hybrid' && decision.solverRequired) failures.push(failure(lesson,p,'STRATEGY_SOLVER_REQUIRED','This problem requires a verified solver; referral-only teaching is insufficient.','paragraph',p.id,true));
  }
  if ((selected === 'referral_video' || selected === 'hybrid') && !findBestReferral(p.source.text, decision.domain, inferGrade(p))) failures.push(failure(lesson,p,'STRATEGY_VIDEO_MATCH_MISSING','Selected strategy requires an approved concept-matched referral video.','paragraph',p.id,true));
  if ((selected === 'step_by_step' || selected === 'hybrid') && p.problems.length === 0 && !(p.math?.steps?.length || p.math?.verifiedExpressions?.length)) failures.push(failure(lesson,p,'STRATEGY_MATH_STEPS_MISSING','Solver strategy selected but no verified mathematical steps are attached.','paragraph',p.id,true));
  if (p.math?.steps?.some(step => !step.verified)) failures.push(failure(lesson,p,'STRATEGY_UNVERIFIED_STEP','A mathematical teaching step is not verified.','paragraph',p.id,true));
}

function inferGrade(p: Paragraph) {
  const m = String(p.source.sourceLocator ?? '').match(/(?:class|grade)[-_ ]?(\d{1,2})/i);
  return m ? Math.min(12, Math.max(1, Number(m[1]))) : 12;
}

function failure(lesson: Lesson, p: Paragraph | undefined, code: string, message: string, scope: 'lesson'|'paragraph', targetId: string, recoverable: boolean): QAFailure {
  return { id: `${lesson.id}:${code}:${targetId}`, code, message, severity: 'error', scope, lessonId: lesson.id, paragraphId: p?.id, recoverable, recoveryAction: recoverable ? 'reselect-strategy-or-generate-required-solver/referral-artifact' : undefined };
}

export type { TeachingStrategy };
