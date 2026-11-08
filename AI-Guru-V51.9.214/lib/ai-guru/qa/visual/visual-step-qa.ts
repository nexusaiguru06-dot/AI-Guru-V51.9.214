import { ids, type Lesson, type Paragraph, type Problem, type QAResult, type QAFailure, type VisualStep } from '../../contracts';
import type { VisualCheckId } from '../../math/universal/style-library';
import { getReferenceQAProfile } from './reference-qa-profiles';
import { getReferenceSegments } from '../../math/universal/reference-segments';

export const VISUAL_STEP_QA_RULES_VERSION = 'visual-step-2.0-reference-profiles';

const VISUAL_CHECKS: VisualCheckId[] = ['latex-token-decomposition','token-equation-transformation','term-movement','symbol-morphing','operation-animation','fraction-transformation','arrow-annotation','highlight-circle-underline','write-erase','graph-progressive-drawing','geometry-progressive-construction','camera-zoom-pan','pause-emphasis','voice-cue-sync','transformation-qa'];

export interface VisualStepQAScope { paragraphId?: string; problemId?: string; visualStepId?: string; }

export function runVisualStepQA(lesson: Lesson, scope: VisualStepQAScope = {}): QAResult {
  const paragraph = scope.paragraphId ? lesson.paragraphs.find(p => p.id === scope.paragraphId) : undefined;
  const failures: QAFailure[] = [];
  if (scope.paragraphId && !paragraph) {
    failures.push({ id: `${scope.paragraphId}:missing`, code: 'VISUAL_PARAGRAPH_NOT_FOUND', message: 'Visual QA target paragraph was not found.', severity: 'error', scope: 'paragraph', lessonId: lesson.id, paragraphId: scope.paragraphId, recoverable: false });
  } else if (paragraph) {
    if (scope.problemId) {
      const problem = paragraph.problems.find(p => p.id === scope.problemId);
      if (!problem) failures.push(failure(lesson, paragraph, 'VISUAL_PROBLEM_NOT_FOUND', 'Problem was not found in the target paragraph.', 'problem', problemId(scope.problemId), true));
      else checkProblem(lesson, paragraph, problem, failures, scope.visualStepId);
    } else if (scope.visualStepId) {
      const step = paragraph.visualSteps.find(s => s.id === scope.visualStepId);
      if (!step) failures.push(failure(lesson, paragraph, 'VISUAL_STEP_NOT_FOUND', 'Visual step was not found.', 'visual-step', undefined, true, scope.visualStepId));
      else checkStep(lesson, paragraph, step, failures);
    } else checkParagraph(lesson, paragraph, failures);
  } else {
    for (const p of lesson.paragraphs) checkParagraph(lesson, p, failures);
  }
  const scopeType = scope.visualStepId ? 'visual-step' : scope.problemId ? 'problem' : scope.paragraphId ? 'paragraph' : 'lesson';
  const targetId = scope.visualStepId ?? scope.problemId ?? scope.paragraphId ?? lesson.id;
  return { qaRunId: ids.qaRun(`visual-${targetId}-${Date.now()}`), qa: 'visual-step', status: failures.some(f => f.severity === 'error') ? 'failed' : 'passed', scope: scopeType, targetId, failures, checkedAt: new Date().toISOString(), rulesVersion: VISUAL_STEP_QA_RULES_VERSION };
}

function checkParagraph(lesson: Lesson, p: Paragraph, failures: QAFailure[]) {
  const steps = [...p.visualSteps].sort((a,b) => a.order - b.order);
  if (steps.length === 0 && p.explanation.english.trim()) failures.push(failure(lesson, p, 'VISUAL_STEPS_MISSING', 'Paragraph has teaching content but no visual steps.', 'paragraph', undefined, true));
  const seen = new Set<string>();
  steps.forEach((step, i) => {
    if (seen.has(step.id)) failures.push(failure(lesson, p, 'VISUAL_STEP_DUPLICATE_ID', `Duplicate visual step ID: ${step.id}`, 'visual-step', undefined, true, step.id));
    seen.add(step.id);
    if (step.paragraphId !== p.id) failures.push(failure(lesson, p, 'VISUAL_STEP_WRONG_PARAGRAPH', 'Visual step belongs to another paragraph.', 'visual-step', undefined, true, step.id));
    if (step.order !== i) failures.push(failure(lesson, p, 'VISUAL_STEP_ORDER_GAP', 'Visual steps must have contiguous order within the paragraph.', 'visual-step', undefined, true, step.id));
    if (!step.purpose?.trim()) failures.push(failure(lesson, p, 'VISUAL_STEP_PURPOSE_MISSING', 'Visual step has no teaching purpose.', 'visual-step', undefined, true, step.id));
    if (!step.action || typeof step.action !== 'object') failures.push(failure(lesson, p, 'VISUAL_STEP_ACTION_MISSING', 'Visual step has no executable action.', 'visual-step', undefined, true, step.id));
    else checkAction(lesson, p, step, failures);
    if (step.dependsOn?.some(id => !seen.has(id))) failures.push(failure(lesson, p, 'VISUAL_STEP_DEPENDENCY_ORDER', 'Visual step depends on a step that has not occurred yet.', 'visual-step', undefined, true, step.id));
  });
  const stepIds = new Set(steps.map(s => s.id));
  for (const cue of p.audioCues) if (cue.visualStepId && !stepIds.has(cue.visualStepId)) failures.push(failure(lesson, p, 'VISUAL_CUE_ORPHAN', `Audio cue ${cue.id} points to a missing visual step.`, 'paragraph', undefined, true));
  const idsByOrder = steps.map(s => s.id);
  if (p.audioCues.some(c => c.startMs < 0 || (c.endMs != null && c.endMs < c.startMs))) failures.push(failure(lesson, p, 'VISUAL_CUE_TIMING_INVALID', 'Audio cue timing is invalid for the paragraph visual sequence.', 'paragraph', undefined, true));
  if (idsByOrder.length && new Set(idsByOrder).size !== idsByOrder.length) return;
  checkReferenceProfile(lesson, p, steps, failures);
}

/**
 * Reference-specific QA: the selected reference determines the presentation
 * contract. The mathematical correctness layer remains independent.
 */
function checkReferenceProfile(lesson: Lesson, p: Paragraph, steps: VisualStep[], failures: QAFailure[]) {
  if (!steps.length) return;
  const styleId = String((steps[0].action as Record<string, unknown> | undefined)?.visualStyleId ?? 'ai-guru-standard');
  const profileId = String((steps[0].action as Record<string, unknown> | undefined)?.qaProfileId ?? 'common-visual-v1');
  const profile = getReferenceQAProfile(profileId);
  const actions = steps.map(s => s.action as Record<string, unknown>);
  const segmentIds = new Set(actions.map(a => typeof a.referenceSegmentId === 'string' ? a.referenceSegmentId : undefined).filter(Boolean));
  const segmentAssets = new Set(actions.map(a => typeof a.referenceSegmentAsset === 'string' ? a.referenceSegmentAsset : undefined).filter(Boolean));
  if (segmentIds.size > 1) failures.push(failure(lesson, p, 'VISUAL_REFERENCE_SEGMENT_MIXED', 'A paragraph visual sequence must use one reference segment.', 'paragraph', undefined, true));
  if (segmentAssets.size > 1) failures.push(failure(lesson, p, 'VISUAL_REFERENCE_ASSET_MIXED', 'A paragraph visual sequence must use one reference asset segment.', 'paragraph', undefined, true));
  if (profile.styleId === 'area-formula-visual-derivation-reference' && !segmentIds.size) failures.push(failure(lesson, p, 'VISUAL_REFERENCE_SEGMENT_MISSING', 'This multi-concept reference requires a concept-specific segment.', 'paragraph', undefined, true));
  if (segmentIds.size) {
    const segmentId = [...segmentIds][0] as string;
    const segmentProfileId = getReferenceQAProfile(profileId).id;
    const knownSegment = getReferenceSegments(styleId).find(segment => segment.id === segmentId);
    if (!knownSegment) failures.push(failure(lesson, p, 'VISUAL_REFERENCE_SEGMENT_UNKNOWN', `Unknown reference segment: ${segmentId}.`, 'paragraph', undefined, true));
    else {
      if (knownSegment.styleId !== styleId) failures.push(failure(lesson, p, 'VISUAL_REFERENCE_SEGMENT_STYLE_MISMATCH', `Reference segment ${segmentId} belongs to ${knownSegment.styleId}, not ${styleId}.`, 'paragraph', undefined, true));
      if (knownSegment.qaProfileId !== segmentProfileId) failures.push(failure(lesson, p, 'VISUAL_REFERENCE_SEGMENT_QA_MISMATCH', `Reference segment ${segmentId} requires ${knownSegment.qaProfileId}.`, 'paragraph', undefined, true));
      const asset = [...segmentAssets][0] as string | undefined;
      if (asset && asset !== knownSegment.asset) failures.push(failure(lesson, p, 'VISUAL_REFERENCE_SEGMENT_ASSET_MISMATCH', `Reference segment ${segmentId} must use ${knownSegment.asset}.`, 'paragraph', undefined, true));
    }
  }
  const actionTypes = new Set(actions.map(a => String(a.type)));
  const hasEvidence = (check: VisualCheckId) => steps.some(step => {
    const a = step.action as Record<string, unknown>;
    const required = Array.isArray(a.requiredVisualChecks) ? a.requiredVisualChecks : [];
    return required.includes(check) || evidenceForCheck(check, a, step);
  });

  for (const check of profile.requiredChecks) {
    if (!hasEvidence(check)) failures.push(referenceFailure(lesson, p, profile.id, styleId, `REFERENCE_REQUIRED_CHECK_MISSING_${check.toUpperCase().replaceAll('-','_')}`, `Selected reference QA profile ${profile.id} requires ${check}, but no visual step provides evidence.`, true));
  }

  if (profile.minPauseMs != null) {
    const pauses = actions.filter(a => a.type === 'pause').map(a => Number(a.durationMs)).filter(Number.isFinite);
    if (!pauses.some(ms => ms >= profile.minPauseMs!)) failures.push(referenceFailure(lesson, p, profile.id, styleId, 'REFERENCE_PAUSE_BEAT_MISSING', `Reference QA profile requires at least one pause beat of ${profile.minPauseMs}ms or longer.`, true));
  }

  if (profile.finalFormulaAfterReasoning) {
    const formulaIndices = steps.map((step, i) => {
      const a = step.action as Record<string, unknown>;
      const text = `${String(a.latex ?? '')} ${String(a.content ?? '')}`;
      return /(?:=|\\frac|\\int|\\sum|area|answer|result)/i.test(text) ? i : -1;
    }).filter(i => i >= 0);
    if (formulaIndices.length && Math.min(...formulaIndices) === 0 && steps.length > 1) failures.push(referenceFailure(lesson, p, profile.id, styleId, 'REFERENCE_FORMULA_PREMATURE', 'The selected reference requires visual reasoning before the final formula/result is revealed.', true));
  }

  if (profile.orderedBeats?.length) {
    // Ordered beat checks are advisory at this layer until planners emit explicit
    // teachingBeat metadata. Do not fail a lesson merely because a free-form
    // visual step lacks a textual beat label.
    void actionTypes;
  }
}

function evidenceForCheck(check: VisualCheckId, action: Record<string, unknown>, step: VisualStep): boolean {
  const type = String(action.type ?? '');
  switch (check) {
    case 'latex-token-decomposition': return ['latex','transform','highlight'].includes(type) || typeof action.latex === 'string';
    case 'token-equation-transformation': return ['transform','latex','move'].includes(type);
    case 'term-movement': return ['move','transform'].includes(type);
    case 'symbol-morphing': return type === 'transform';
    case 'operation-animation': return ['move','transform','write','latex'].includes(type);
    case 'fraction-transformation': return ['transform','shape','move','latex'].includes(type);
    case 'arrow-annotation': return ['line','shape','write','latex','highlight'].includes(type) || action.annotation != null;
    case 'highlight-circle-underline': return ['highlight','shape','line'].includes(type);
    case 'write-erase': return ['write','erase','latex'].includes(type);
    case 'graph-progressive-drawing': return ['chart','line','point','shape'].includes(type);
    case 'geometry-progressive-construction': return ['shape','line','point'].includes(type);
    case 'camera-zoom-pan': return action.camera != null || action.viewport != null || action.zoom != null || action.pan != null;
    case 'pause-emphasis': return type === 'pause' || action.emphasis === true;
    case 'voice-cue-sync': return Boolean(step.cueIds?.length) || action.cueId != null || action.voiceCue != null;
    case 'transformation-qa': return typeof action.visualStyleId === 'string';
  }
}

function referenceFailure(lesson: Lesson, p: Paragraph, profileId: string, styleId: string, code: string, message: string, recoverable: boolean): QAFailure {
  return { id:`${p.id}:${profileId}:${code}`, code, message, severity:'error', scope:'paragraph', lessonId:lesson.id, paragraphId:p.id, recoverable, recoveryAction:recoverable ? 'visual-step-recovery' : undefined };
}

function checkStep(lesson: Lesson, p: Paragraph, step: VisualStep, failures: QAFailure[]) {
  if (step.paragraphId !== p.id) failures.push(failure(lesson, p, 'VISUAL_STEP_WRONG_PARAGRAPH', 'Visual step belongs to another paragraph.', 'visual-step', undefined, true, step.id));
  if (!step.action || typeof step.action !== 'object') failures.push(failure(lesson, p, 'VISUAL_STEP_ACTION_MISSING', 'Visual step has no executable action.', 'visual-step', undefined, true, step.id));
  else { checkAction(lesson, p, step, failures); checkStyleChecks(lesson, p, step, failures); }
}

function checkAction(lesson: Lesson, p: Paragraph, step: VisualStep, failures: QAFailure[]) {
  const action = step.action as Record<string, unknown>;
  const type = action.type;
  const allowed = new Set(['write','latex','shape','line','chart','highlight','move','transform','erase','pause']);
  if (typeof type !== 'string' || !allowed.has(type)) failures.push(failure(lesson, p, 'VISUAL_ACTION_UNSUPPORTED', `Unsupported visual action type: ${String(type)}`, 'visual-step', undefined, true, step.id));
  if (['highlight','move','erase'].includes(String(type)) && typeof action.targetId !== 'string' && typeof action.objectId !== 'string') failures.push(failure(lesson, p, 'VISUAL_TARGET_MISSING', 'Visual action requires a target.', 'visual-step', undefined, true, step.id));
  if (type === 'transform' && (typeof action.fromId !== 'string' || typeof action.toId !== 'string') && (typeof action.fromObjectId !== 'string' || typeof action.toObjectId !== 'string')) failures.push(failure(lesson, p, 'VISUAL_TRANSFORM_TARGET_MISSING', 'Transform action requires both source and destination objects.', 'visual-step', undefined, true, step.id));
  if (type === 'pause' && (!Number.isFinite(Number(action.durationMs)) || Number(action.durationMs) < 0)) failures.push(failure(lesson, p, 'VISUAL_PAUSE_INVALID', 'Pause duration must be a non-negative number.', 'visual-step', undefined, true, step.id));
}


function checkStyleChecks(lesson: Lesson, p: Paragraph, step: VisualStep, failures: QAFailure[]) {
  const action = step.action as Record<string, unknown>;
  const required = Array.isArray(action.requiredVisualChecks) ? action.requiredVisualChecks.filter((v): v is VisualCheckId => VISUAL_CHECKS.includes(v as VisualCheckId)) : [];
  if (!required.length) return;
  const has = (types: string[]) => types.includes(String(action.type));
  for (const check of required) {
    let ok = false;
    switch (check) {
      case 'latex-token-decomposition': ok = has(['latex','transform','highlight']) || typeof action.latex === 'string'; break;
      case 'token-equation-transformation': ok = has(['transform','latex','move']); break;
      case 'term-movement': ok = has(['move','transform']); break;
      case 'symbol-morphing': ok = has(['transform']); break;
      case 'operation-animation': ok = has(['move','transform','write','latex']); break;
      case 'fraction-transformation': ok = has(['transform','shape','move','latex']); break;
      case 'arrow-annotation': ok = has(['line','shape','write','latex']) || action.annotation != null; break;
      case 'highlight-circle-underline': ok = has(['highlight','shape','line']); break;
      case 'write-erase': ok = has(['write','erase','latex']); break;
      case 'graph-progressive-drawing': ok = has(['chart','line','point','shape']); break;
      case 'geometry-progressive-construction': ok = has(['shape','line','point']); break;
      case 'camera-zoom-pan': ok = action.camera != null || action.viewport != null || action.zoom != null || action.pan != null; break;
      case 'pause-emphasis': ok = has(['pause']) || action.emphasis === true; break;
      case 'voice-cue-sync': ok = Boolean(step.cueIds?.length) || action.cueId != null || action.voiceCue != null; break;
      case 'transformation-qa': ok = typeof action.visualStyleId === 'string'; break;
    }
    if (!ok) failures.push(failure(lesson, p, `VISUAL_CHECK_${check.toUpperCase().replaceAll('-','_')}_MISSING`, `Required visual check ${check} has no evidence in this visual step.`, 'visual-step', undefined, true, step.id));
  }
}

function checkProblem(lesson: Lesson, p: Paragraph, problem: Problem, failures: QAFailure[], visualStepId?: string) {
  if (!problem.verified) failures.push(failure(lesson, p, 'VISUAL_PROBLEM_UNVERIFIED', 'Problem visual sequence cannot be accepted before problem verification.', 'problem', problem.id, true));
  if (!problem.visualSteps.length) failures.push(failure(lesson, p, 'VISUAL_PROBLEM_STEPS_MISSING', 'Problem has no visual solution steps.', 'problem', problem.id, true));
  if (visualStepId) {
    const step = problem.visualSteps.find(s => s.id === visualStepId);
    if (!step) failures.push(failure(lesson, p, 'VISUAL_STEP_NOT_FOUND', 'Problem visual step was not found.', 'visual-step', problem.id, true, visualStepId));
    else checkStep(lesson, p, step, failures);
  }
}

function failure(lesson: Lesson, p: Paragraph, code: string, message: string, scope: 'paragraph'|'problem'|'visual-step', problemId?: string, recoverable = true, visualStepId?: string): QAFailure {
  return { id: `${p.id}:${code}:${visualStepId ?? problemId ?? 'target'}`, code, message, severity: 'error', scope, lessonId: lesson.id, paragraphId: p.id, problemId, visualStepId, recoverable, recoveryAction: recoverable ? 'visual-step-recovery' : undefined };
}
function problemId(id: string): string { return id; }
