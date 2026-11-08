import { describe, expect, it } from 'vitest';
import { selectChapterVideoDna, selectLessonVideoDna } from './video-dna-selector';

describe('hierarchical Video-DNA selector', () => {
  it('builds a chapter strategy with distinct archetypes', async () => {
    const chapter = await selectChapterVideoDna({
      chapterTitle: 'Area of triangles and quadrilaterals',
      chapterSummary: 'Understand area by decomposition, rearrangement and formula derivation.',
      chapterTopics: ['triangle area', 'trapezium', 'parallelogram', 'decomposition'],
      domain: 'geometry',
      grade: 9,
    }, 5);
    expect(chapter.selections.length).toBeGreaterThan(0);
    expect(new Set(chapter.archetypes).size).toBe(chapter.archetypes.length);
    expect(chapter.dnaIds.length).toBe(chapter.selections.length);
  });

  it('lets a problem override chapter grammar when the visual concept differs', async () => {
    const chapter = await selectChapterVideoDna({ chapterTitle: 'Algebraic expressions', domain: 'algebra', grade: 8 }, 4);
    const lesson = await selectLessonVideoDna({
      chapterTitle: 'Algebraic expressions',
      question: 'Plot y = x squared and explain how the curve changes as x moves.',
      learningGoal: 'visualize a quadratic graph',
      domain: 'graphing',
      grade: 8,
      visualOperations: ['graph', 'move', 'highlight'],
    }, chapter);
    expect(lesson.beatOptions.length).toBeGreaterThan(0);
    expect(lesson.selections.length).toBeGreaterThan(0);
    expect(lesson.selections[0].fit.visual).toBeGreaterThanOrEqual(0.5);
  });
});
