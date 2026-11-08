import type { StudyMaterial } from '../material-studio/types';
import { toIndexedSource } from './paragraph-flow';

export interface TeacherRunParagraph {
  id: string;
  heading?: string;
  source: { text: string; pageNumber?: number; bookId?: string; paragraphIndex?: number };
}

export interface TeacherRunOptions {
  lessonId: string;
  lessonTitle: string;
  paragraphs: TeacherRunParagraph[];
  /** Lesson paragraph the teacher starts on (the textbook cursor). */
  startIndex: number;
  /** Physical page shown in the reference pane for the first section (kept even when that page has no extracted text). */
  startPage: number;
  /** Last page to teach (the end of the current chapter). Omit to teach to the end of the book. */
  endPage?: number;
  language: 'english' | 'malayalam';
  title?: string;
  /** Safety valve so one Play press can never queue an unbounded number of AI plans. */
  maxSections?: number;
}

/**
 * Teacher-Reading run material: ONE section per textbook paragraph, from the cursor to the end of the chapter.
 *
 * The run loop advances `index -> index + 1` while `index + 1 < sections.length`. A material with a single section
 * therefore taught one paragraph and then reported "completed normally" - the class stopped by itself. Each section's
 * source id IS the lesson-paragraph id, so the existing id -> paragraph mapping keeps the textbook pane in step.
 */
export function buildTeacherReadingMaterial(o: TeacherRunOptions): StudyMaterial {
  const list = o.paragraphs;
  const start = Math.max(0, Math.min(list.length - 1, Math.floor(o.startIndex)));
  const first = list[start];
  const cap = Math.max(1, o.maxSections ?? 80);
  const picked: TeacherRunParagraph[] = [];
  for (let i = start; i < list.length && picked.length < cap; i++) {
    const p = list[i];
    const page = Number(p.source.pageNumber || 1);
    if (i > start && o.endPage !== undefined && page > o.endPage) break;
    if (i > start && !String(p.source.text || '').trim()) continue;
    picked.push(p);
  }
  const now = new Date().toISOString();
  const title = o.title || first?.heading || o.lessonTitle;
  return {
    id: `teacher-reading:${o.lessonId}:${first?.id ?? 'start'}`,
    documentId: first?.source.bookId || o.lessonId,
    type: 'whiteboard-notes',
    title,
    overview: first?.source.text ?? '',
    teachingLanguage: o.language,
    materialLanguages: ['english', 'malayalam'],
    sections: picked.map(p => ({
      id: `section:${p.id}`,
      heading: p.heading || title,
      content: p.source.text,
      sourceText: p.source.text,
      sourceIds: [p.id],
      visuals: [],
    })),
    sources: picked.map((p, i) => {
      const s = toIndexedSource(p as never, list as never);
      return { id: s.id, page: i === 0 ? o.startPage : s.page, paragraph: s.paragraph, text: s.text };
    }),
    qa: { status: 'needs_review', score: 0, issues: [], checkedAt: now },
    model: 'textbook-reading',
    createdAt: now,
    updatedAt: now,
  } as StudyMaterial;
}
