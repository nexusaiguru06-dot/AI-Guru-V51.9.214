import { describe, expect, it } from 'vitest';
import { compileAIGuruTeachingLesson } from './compiler';
import { createRuntimeSnapshot } from './runtime';
import { evaluateTeachingLesson } from '../teaching/quality';
import type { AIGuruTeachingLesson } from '../teaching/types';

const base: AIGuruTeachingLesson = {
  schemaVersion: '2.0', id: 'defect-regression', title: 'Move a point', grade: 7, gradeBand: '6-8', domain: 'geometry',
  openingQuestion: 'Where should the point move?', whyItMatters: 'Movement shows changing position.', learningGoal: 'Track a point.',
  prerequisites: [], runningExample: { id: 'ex', description: 'A point on a grid.', expression: 'x+1', persistentObjectIds: ['p'] },
  segments: [{ id: 's1', title: 'Move', order: 0, intuition: { explanation: 'Position can change.' }, mathematics: { explanation: 'The x coordinate increases.', expressions: ['x+1'] }, beats: [{
    id: 'b1', narration: 'Move the point to the right.', cueWords: ['move'], visualIntent: 'move', targetObjects: ['p'], actions: [
      { type: 'create', objectId: 'p', node: { id: 'p', kind: 'point', x: 100, y: 200 } },
      { type: 'move', objectId: 'p', toX: 300, toY: 220 },
    ],
  }] }],
  finalInsight: 'The point changed position.', visualGrammar: { archetype: 'move', dnaIds: ['dna'], pacing: 'medium', camera: 'static' },
};

describe('3B1B defect regressions', () => {
  it('compiles move into a real move event and runtime interpolates it', () => {
    const compiled = compileAIGuruTeachingLesson(base, { teachingLanguage: 'english' });
    const move = compiled.scene.events.find(e => e.semanticAction === 'move');
    expect(move?.kind).toBe('move');
    const mid = createRuntimeSnapshot(compiled.scene, (move?.atMs ?? 0) + Math.floor((move?.durationMs ?? 1) / 2));
    expect(mid.nodes.get('p')?.x).toBeGreaterThan(100);
    expect(mid.nodes.get('p')?.x).toBeLessThan(300);
  });

  it('does not mark a lesson verified unless QA and math verification pass', async () => {
    const quality = await evaluateTeachingLesson(base);
    expect(quality.checks['math-correctness']).toBe(true);
    const unverified = { ...base, quality: { passed: false, issues: ['forced'], checks: { 'math-correctness': false } } };
    const compiled = compileAIGuruTeachingLesson(unverified, { teachingLanguage: 'english' });
    expect(compiled.scene.verified).toBe(false);
  });
});
