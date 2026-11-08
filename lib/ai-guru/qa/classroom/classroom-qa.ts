import type { Lesson, Paragraph } from '../../contracts';
import type { QAResult, QAFailure } from '../../contracts/qa-contracts';
import { ids } from '../../contracts';

export function runClassroomQA(lesson: Lesson): QAResult {
  const failures: QAFailure[] = [];
  for (const p of lesson.paragraphs) checkParagraph(p, lesson.id, failures);
  return { qaRunId: ids.qaRun(`classroom-${lesson.id}-${Date.now()}`), qa: 'classroom', status: failures.some(f => f.severity === 'error') ? 'failed' : 'passed', scope: 'classroom', targetId: lesson.id, failures, checkedAt: new Date().toISOString(), rulesVersion: 'sprint5.1' };
}

function checkParagraph(p: Paragraph, lessonId: string, failures: QAFailure[]) {
  const stepIds = new Set(p.visualSteps.map(v => v.id));
  const cueIds = new Set(p.audioCues.map(c => c.id));
  for (const step of p.visualSteps) {
    if (step.paragraphId !== p.id) failures.push(fail('VISUAL_WRONG_PARAGRAPH', 'Visual step belongs to another paragraph', lessonId, p.id, step.id, 'visual-step'));
    for (const cueId of step.cueIds ?? []) if (!cueIds.has(cueId)) failures.push(fail('MISSING_AUDIO_CUE', `Visual step references missing cue ${cueId}`, lessonId, p.id, step.id, 'visual-step'));
  }
  for (const cue of p.audioCues) {
    if (cue.paragraphId !== p.id) failures.push(fail('CUE_WRONG_PARAGRAPH', 'Audio cue belongs to another paragraph', lessonId, p.id, undefined, 'paragraph'));
    if (cue.visualStepId && !stepIds.has(cue.visualStepId)) failures.push(fail('ORPHAN_CUE_TARGET', `Cue references missing visual step ${cue.visualStepId}`, lessonId, p.id, undefined, 'paragraph'));
    if (cue.startMs < 0 || (cue.endMs !== undefined && cue.endMs < cue.startMs)) failures.push(fail('INVALID_CUE_TIMING', 'Audio cue timing is invalid', lessonId, p.id, undefined, 'paragraph'));
  }
  for (const lang of ['english','malayalam'] as const) {
    const voice = p.voice?.[lang];
    const needsWordSync = p.audioCues.some(c => c.language === lang && c.trigger !== 'time' && !!c.triggerText);
    if (needsWordSync && voice?.alignment === 'pending') failures.push(fail('WORD_ALIGNMENT_PENDING', `${lang} word/phrase alignment is pending`, lessonId, p.id, undefined, 'paragraph', true));
  }
}
function fail(code: string, message: string, lessonId: string, paragraphId: string, visualStepId: string|undefined, scope: 'paragraph'|'visual-step', warning=false): QAFailure { return { id: `${code}:${paragraphId}:${visualStepId ?? 'p'}`, code, message, severity: warning ? 'warning' : 'error', scope, lessonId, paragraphId, visualStepId, recoverable: warning, recoveryAction: warning ? 'supply real word boundaries and re-run synchronization' : undefined }; }
