import { ids, type Lesson, type QAResult, type QAFailure } from '../../contracts';
import { makeAIGuruId } from '../../contracts/ids';

export interface ContentQARules { requirePageNumber: boolean; requireSourceText: boolean; requirePageImage: boolean; }
export const DEFAULT_CONTENT_QA_RULES: ContentQARules = { requirePageNumber: true, requireSourceText: true, requirePageImage: true };

export function runContentQA(lesson: Lesson, rules = DEFAULT_CONTENT_QA_RULES): QAResult {
  const failures: QAFailure[] = [];
  for (const paragraph of lesson.paragraphs) {
    const base = { scope: 'paragraph' as const, lessonId: lesson.id, paragraphId: paragraph.id, recoverable: true };
    if (rules.requirePageNumber && (!Number.isFinite(paragraph.source.pageNumber) || paragraph.source.pageNumber < 1)) failures.push({ id: `${paragraph.id}:page`, code: 'CONTENT_PAGE_INVALID', message: 'Paragraph has no valid source page.', severity: 'error', ...base, recoveryAction: 'repair-source-page' });
    if (rules.requireSourceText && !paragraph.source.text.trim()) failures.push({ id: `${paragraph.id}:text`, code: 'CONTENT_TEXT_MISSING', message: 'Paragraph source text is empty.', severity: 'error', ...base, recoveryAction: 'reextract-source-text' });
    if (rules.requirePageImage && !paragraph.source.pageImage) failures.push({ id: `${paragraph.id}:image`, code: 'CONTENT_PAGE_IMAGE_MISSING', message: 'Paragraph has no reference page image.', severity: 'error', ...base, recoveryAction: 'resolve-reference-image' });
  }
  return { qaRunId: ids.qaRun(`content-${lesson.id}-${Date.now()}`), qa: 'content', status: failures.some(f => f.severity === 'error') ? 'failed' : 'passed', scope: 'lesson', targetId: lesson.id, failures, checkedAt: new Date().toISOString(), rulesVersion: 'content-1.0' };
}
