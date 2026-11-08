import { describe, expect, it } from 'vitest';
import { synchronizeLessonWords } from './word-cue-sync';
import type { Lesson } from '../contracts';

const lesson: Lesson = {
  schemaVersion: '2.0', id: 'lesson:test', courseId: 'course:test', bookId: 'book:test', chapterId: 'chapter:test', title: 'Test',
  language: { source: 'english', target: 'malayalam' }, teachingMode: 'two-pass', paragraphs: [{
    id: 'paragraph:test', index: 0, source: { bookId: 'book:test', chapterId: 'chapter:test', pageNumber: 1, pageImage: 'page:1', text: 'x = 2' },
    teachingIntent: 'Explain', explanation: { english: 'Subtract 2', malayalam: '2 കുറയ്ക്കുക' }, visualSteps: [],
    audioCues: [{ id: 'cue:test', paragraphId: 'paragraph:test', language: 'english', trigger: 'word', triggerText: 'Subtract', startMs: 0, visualStepId: undefined }],
    checkpoints: [], problems: [], state: 'idle', qa: { content: 'passed', lesson: 'passed', visual: 'passed', classroom: 'pending' }
  }]
};

describe('word cue sync', () => {
  it('aligns a cue using supplied real word boundaries', () => {
    const result = synchronizeLessonWords(lesson, { 'paragraph:test': [{ language: 'english', word: 'Subtract', startMs: 820, endMs: 1110 }] });
    expect(result.failures).toHaveLength(0);
    expect(result.lesson.paragraphs[0].audioCues[0].startMs).toBe(820);
    expect(result.alignedCount).toBe(1);
  });
  it('does not invent timings when boundaries are absent', () => {
    const result = synchronizeLessonWords(lesson, {});
    expect(result.failures).toHaveLength(1);
    expect(result.lesson.paragraphs[0].audioCues[0].startMs).toBe(0);
  });
});
