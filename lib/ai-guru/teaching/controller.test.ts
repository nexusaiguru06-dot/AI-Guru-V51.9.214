import { describe, expect, it } from 'vitest';
import { AIGuruClassroomController } from './classroom-controller';
import type { AIGuruLesson, TeachingControllerPort } from '../lesson/types';

const lesson: AIGuruLesson = {
  schemaVersion: '1.0',
  id: 'lesson-1',
  title: 'Quadratic',
  language: { source: 'english', target: 'malayalam' },
  paragraphs: [{
    id: 'p1',
    source: { bookId: 'b', chapterIndex: 1, paragraphIndex: 0, pageNumber: 27, text: 'Read this paragraph', pageImage: '/27.png' },
    english: { text: 'English explanation', visuals: [{ type: 'latex', id: 'eq', latex: 'x^2=4', x: 20, y: 20 }] },
    malayalam: { text: 'മലയാളം വിശദീകരണം', visuals: [{ type: 'write', id: 'ml', content: 'മലയാളം', x: 20, y: 100 }] },
    cues: [],
    verified: true,
  }],
};

describe('AIGuruClassroomController', () => {
  it('executes the canonical two-pass paragraph sequence without a duplicate controller', async () => {
    const calls: string[] = [];
    const port: TeachingControllerPort = {
      showReference: () => calls.push('reference'),
      playActions: async actions => calls.push(actions.map(a => a.type).join(',')),
      pause: () => calls.push('pause'),
      resume: () => calls.push('resume'),
      resetVisuals: () => calls.push('reset'),
    };
    const controller = new AIGuruClassroomController(port);
    await controller.start(lesson);

    expect(calls).toEqual([
      'reset',
      'reference',
      'speech',
      'speech,wb_draw_latex',
      'wb_draw_latex',
      'speech',
      'wb_draw_text',
    ]);
    expect(controller.snapshot().state).toBe('idle');
  });
});
