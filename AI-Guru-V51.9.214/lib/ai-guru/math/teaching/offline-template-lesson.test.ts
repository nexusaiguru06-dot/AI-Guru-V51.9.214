import { describe, expect, it } from 'vitest';
import { buildSolverLesson, displayToTex } from './offline-template-lesson';
import { evaluateTeachingLesson } from './quality';
import { compileAIGuruTeachingLesson } from '../animation/compiler';
import { createRuntimeSnapshot, sceneDurationMs } from '../animation/runtime';

describe('offline solver lesson (no key, no internet)', () => {
  for (const [q, grade] of [['Solve 2x + 3 = 11', 8], ['Solve x + y = 10 and x - y = 2', 9], ['Simplify 3(x+2) - x', 8], ['Solve 3x - 7 = 20', 7]] as Array<[string, number]>) {
    it(`builds a QA-clean coloured lesson for "${q}"`, async () => {
      const lesson = buildSolverLesson({ question: q, grade, domain: 'algebra' });
      expect(lesson).not.toBeNull();
      const quality = await evaluateTeachingLesson(lesson!);
      for (const key of ['safe-frame', 'text-overlap', 'object-id-integrity', 'readable-text', 'geometry-integrity', 'difficulty-adaptation'])
        expect([key, quality.checks[key]]).toEqual([key, true]);
      const compiled = compileAIGuruTeachingLesson(lesson!, { teachingLanguage: 'english' });
      expect(compiled.warnings).toEqual([]);
      const scene = compiled.scene;
      expect(scene.events.some(e => e.kind === 'recolor')).toBe(true);
      // A row starts white and ends in its step colour.
      const firstRecolor = scene.events.find(e => e.kind === 'recolor')!;
      const before = createRuntimeSnapshot(scene, firstRecolor.atMs).nodes.get(firstRecolor.targetId!)?.color;
      const after = createRuntimeSnapshot(scene, sceneDurationMs(scene)).nodes.get(firstRecolor.targetId!)?.color;
      expect(before).toBe('#f8fafc');
      expect(after).toBe(firstRecolor.color);
    });
  }
  it('declines problems the solver does not recognise instead of guessing', () => {
    expect(buildSolverLesson({ question: 'Why is the sky blue?', grade: 8, domain: 'general' })).toBeNull();
  });
  it('converts display symbols to TeX', () => { expect(displayToTex('x² − 4 = 0')).toBe('x^{2} - 4 = 0'); expect(displayToTex('√(16) × 2')).toBe('\\sqrt{16} \\times  2'); });
});
