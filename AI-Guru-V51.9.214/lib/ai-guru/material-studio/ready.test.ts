import { describe, expect, it } from 'vitest';
import { bookTitle, readyBooks } from './ready';

describe('ready-to-teach textbooks (V51.9.116)', () => {
  const docs = [
    { id: 'a', fileName: 'maths_std9.pdf', subject: 'Mathematics', grade: '9', pageCount: 120, indexedAt: '2026-10-01', sources: [1] },
    { id: 'b', fileName: 'physics.pdf', subject: 'Physics', grade: '10', pageCount: 80, indexedAt: '2026-10-05', sources: [1] },
    { id: 'c', fileName: 'no-materials.pdf', pageCount: 10, indexedAt: '2026-10-09', sources: [1] },
    { id: 'd', fileName: 'not-indexed.pdf', pageCount: 10, indexedAt: '2026-10-09', sources: [] },
  ];
  const mats = [
    { documentId: 'a', type: 'mcq-quiz', createdAt: '2026-10-02' },
    { documentId: 'b', type: 'whiteboard-notes', createdAt: '2026-10-06' },
    { documentId: 'b', type: 'flashcards', createdAt: '2026-10-07' },
    { documentId: 'd', type: 'whiteboard-notes', createdAt: '2026-10-10' },
  ];
  it('lists only books with study materials, teachable ones first', () => {
    const r = readyBooks(docs, mats);
    expect(r.map((b) => b.id)).toEqual(['b', 'a']);
    expect(r[0]).toMatchObject({ materials: 2, teachable: true, subject: 'Physics', updatedAt: '2026-10-07' });
    expect(r[1].teachable).toBe(false);
  });
  it('names a book from its file', () => { expect(bookTitle('kerala_maths_std9.pdf')).toBe('kerala maths std9'); });
});
