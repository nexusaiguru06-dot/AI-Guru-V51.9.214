import { describe, expect, it } from 'vitest';
import { createTeachingLessonDraft } from '../../math/teaching/lesson-planner';
import { createTeachingBeat } from '../../math/teaching/beat-planner';
import { compileGuruLesson, compileGuruScene } from '../compiler';

describe('AI Guru renderer-neutral video compiler', () => {
  it('keeps mathematical rendering deterministic and generative rendering separate', () => {
    const scene = compileGuruScene({
      lessonId: 'triangle-area',
      lessonTitle: 'Area of a Triangle',
      grade: 8,
      gradeBand: '6-8',
      domain: 'geometry',
      language: 'english',
      teachingGoal: 'Connect base, height and area.',
      segmentId: 's1',
      segmentTitle: 'Build the triangle',
      beatId: 'b1',
      narration: 'Let us identify the base and height.',
      durationMs: 3000,
      targetObjects: ['triangle', 'base', 'height'],
      mathObjectIds: ['triangle', 'base', 'height'],
      references: [{ id: 'ref-1', uri: '/references/triangle.mp4', type: 'video' }],
      verificationRefs: ['verification:triangle-area:1'],
    });

    expect(scene.rendererPolicy.math).toEqual({ renderer: 'math-engine', deterministic: true });
    expect(scene.rendererPolicy.generative).toEqual({ renderer: 'ltx', enabled: true, deterministic: false });
    expect(scene.rendererPolicy.composition).toEqual({ renderer: 'composition', deterministic: true });
    expect(scene.generative.forbiddenOutputs).toContain('equations');
    expect(scene.verificationRefs).toContain('verification:triangle-area:1');
    expect(scene.layers.map((layer) => layer.source)).toEqual(['ltx', 'math-engine', 'audio']);
  });

  it('compiles the existing teaching lesson model without choosing a renderer', () => {
    const lesson = createTeachingLessonDraft({
      id: 'linear-1',
      title: 'Solve x + 2 = 5',
      grade: 8,
      gradeBand: '6-8',
      domain: 'linear_equations',
      question: 'How do we find x?',
      learningGoal: 'Solve a linear equation step by step.',
      expression: 'x + 2 = 5',
    });

    lesson.segments = [{
      id: 's1',
      title: 'Subtract 2',
      order: 1,
      intuition: { explanation: 'Keep both sides balanced.' },
      mathematics: { explanation: 'Subtract 2 from both sides.', verified: true },
      beats: [createTeachingBeat({
        id: 'b1',
        narration: 'Subtract 2 from both sides.',
        targetObjects: ['eq-1'],
        actions: [{ type: 'transform', fromObjectId: 'eq-1', toObjectId: 'eq-2' }],
      })],
    }];

    const compiled = compileGuruLesson(lesson);
    expect(compiled.scenes).toHaveLength(1);
    expect(compiled.scenes[0].objects[0].source).toBe('math-engine');
    expect(compiled.scenes[0].actions[0]).toEqual({ type: 'transform', fromObjectId: 'eq-1', toObjectId: 'eq-2' });
    expect(compiled.totalDurationMs).toBe(2500);
  });
});
