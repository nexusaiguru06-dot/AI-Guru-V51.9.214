/** Test data for the five-part lock tests (a 100-page book, ten 10-page chapters). */
import type { IndexedDocument, StudyMaterial } from './types';

/** A 100-page book with 10 chapters of 10 pages (V51.9.211: ten parts, one chapter each), one paragraph per page. */
export function sampleBook(freeParts?: number[]): IndexedDocument {
  const chapters = Array.from({ length: 10 }, (_, i) => ({ id: `ch${i + 1}`, title: `Chapter ${i + 1}`, startPage: i * 10 + 1, endPage: i * 10 + 10, sourceIds: Array.from({ length: 10 }, (_, k) => `s${i * 10 + k + 1}`), summary: `About chapter ${i + 1}` }));
  const sources = Array.from({ length: 100 }, (_, k) => ({ id: `s${k + 1}`, page: k + 1, paragraph: 1, text: `Text of page ${k + 1}`, chapterId: `ch${Math.floor(k / 10) + 1}` }));
  return { id: 'doc:test', fileName: 'Maths 8.pdf', mimeType: 'application/pdf', pageCount: 100, indexedAt: '2026-10-01T00:00:00Z', parser: 't', subject: 'Maths', grade: '8', syllabus: 'SCERT', sourceLanguage: 'en', teachingLanguage: 'malayalam', chapters, sources, ...(freeParts ? { freeParts } : {}) };
}
export const mat = (id: string, chapterIds: string[], pages: number[], type: StudyMaterial['type'] = 'mcq'): StudyMaterial => ({ id, documentId: 'doc:test', type, title: `${type} ${id}`, overview: 'secret overview', teachingLanguage: 'malayalam', materialLanguages: ['English'], chapterIds, sections: [{ id: 'x', heading: 'Q1', content: 'secret question', sourceIds: [], visuals: [] }], sources: pages.map((p) => ({ id: `s${p}`, page: p, paragraph: 1, text: `Text of page ${p}` })), qa: { status: 'passed', score: 90, issues: [], checkedAt: '' }, model: 'm', createdAt: '', updatedAt: '' });

