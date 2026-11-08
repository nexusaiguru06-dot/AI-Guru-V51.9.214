import { describe, expect, it } from 'vitest';
import { validateLesson } from './validate';
import type { AIGuruLesson } from './types';

describe('AI Guru lesson contract', () => {
  it('validates the paragraph contract', () => {
    const lesson: AIGuruLesson = {
      schemaVersion: '1.0', id: 'l1', title: 'Test', language: { source: 'english', target: 'malayalam' }, paragraphs: [{
        id: 'p1', source: { bookId: 'b', chapterIndex: 0, paragraphIndex: 0, pageNumber: 1, text: 'x', pageImage: '/1.png' },
        english: { text: 'Explain x', visuals: [] }, malayalam: { text: 'x വിശദീകരണം', visuals: [] }, cues: [], verified: true,
      }],
    };
    expect(validateLesson(lesson)).toEqual([]);
  });
});
