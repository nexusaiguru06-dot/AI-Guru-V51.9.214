import { describe, expect, it } from 'vitest';
import { ids, LESSON_SCHEMA_VERSION, isLesson, type Lesson } from './index';

const lesson = {
  schemaVersion: LESSON_SCHEMA_VERSION,
  id: ids.lesson('quadratic-equations'),
  courseId: ids.course('kerala-class-10-maths'),
  bookId: ids.book('kerala-maths-10'),
  chapterId: ids.chapter('quadratic-equations'),
  title: 'Quadratic Equations',
  language: { source: 'english' as const, target: 'malayalam' as const },
  teachingMode: 'two-pass' as const,
  paragraphs: [],
} satisfies Lesson;

describe('AI Guru Sprint 1 contracts', () => {
  it('creates stable canonical IDs', () => {
    expect(ids.lesson('Quadratic Equations')).toBe('lesson_quadratic-equations');
    expect(ids.paragraph('lesson_quadratic-equations', 3)).toBe('paragraph_lesson_quadratic-equations_3');
    expect(ids.visualStep('paragraph_lesson_quadratic-equations_3', 2)).toBe('visualStep_paragraph_lesson_quadratic-equations_3_2');
  });

  it('recognizes the canonical lesson contract', () => {
    expect(isLesson(lesson)).toBe(true);
  });

  it('keeps recovery scope explicit', async () => {
    const { selectRecoveryScope } = await import('./recovery-policy');
    expect(selectRecoveryScope({ scope: 'visual-step' })).toBe('visual-step');
    expect(selectRecoveryScope({ scope: 'paragraph' })).toBe('paragraph');
    expect(selectRecoveryScope({ scope: 'problem' })).toBe('problem');
  });
});
