import { ids, type Lesson, type QAResult, type QAFailure } from '../../contracts';

export function runLessonQA(lesson: Lesson): QAResult {
  const failures: QAFailure[] = [];
  const seen = new Set<string>();
  for (const paragraph of lesson.paragraphs) {
    if (seen.has(paragraph.id)) failures.push({ id: `${paragraph.id}:duplicate`, code: 'LESSON_DUPLICATE_PARAGRAPH', message: 'Duplicate paragraph ID.', severity: 'error', scope: 'paragraph', lessonId: lesson.id, paragraphId: paragraph.id, recoverable: true, recoveryAction: 'rebuild-paragraph-ids' });
    seen.add(paragraph.id);
    if (!paragraph.teachingIntent.trim()) failures.push({ id: `${paragraph.id}:intent`, code: 'LESSON_TEACHING_INTENT_MISSING', message: 'Teaching intent is missing.', severity: 'error', scope: 'paragraph', lessonId: lesson.id, paragraphId: paragraph.id, recoverable: true, recoveryAction: 'regenerate-paragraph-plan' });
    if (!paragraph.explanation.english.trim()) failures.push({ id: `${paragraph.id}:explanation`, code: 'LESSON_EXPLANATION_MISSING', message: 'English explanation is missing.', severity: 'error', scope: 'paragraph', lessonId: lesson.id, paragraphId: paragraph.id, recoverable: true, recoveryAction: 'regenerate-explanation' });
  }
  if (!lesson.paragraphs.length) failures.push({ id: `${lesson.id}:empty`, code: 'LESSON_EMPTY', message: 'Lesson contains no paragraphs.', severity: 'error', scope: 'lesson', lessonId: lesson.id, recoverable: true, recoveryAction: 'rebuild-lesson' });
  return { qaRunId: ids.qaRun(`lesson-${lesson.id}-${Date.now()}`), qa: 'lesson', status: failures.some(f => f.severity === 'error') ? 'failed' : 'passed', scope: 'lesson', targetId: lesson.id, failures, checkedAt: new Date().toISOString(), rulesVersion: 'lesson-1.0' };
}
