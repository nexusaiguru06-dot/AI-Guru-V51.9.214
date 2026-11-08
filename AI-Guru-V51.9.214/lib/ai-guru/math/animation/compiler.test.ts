import { describe, expect, it } from 'vitest';
import { createTeachingBeat } from '../teaching/beat-planner';
import type { AIGuruTeachingLesson } from '../teaching/types';
import { compileAIGuruTeachingLesson } from './compiler';

const lesson: AIGuruTeachingLesson = {
  schemaVersion: '2.0',
  id: 'e2e-triangle-area',
  title: 'Area of a Triangle',
  grade: 7,
  gradeBand: '6-8',
  domain: 'geometry',
  openingQuestion: 'Why is the area of a triangle half the area of a matching rectangle?',
  whyItMatters: 'It gives a reusable area formula.',
  learningGoal: 'Understand and derive A = 1/2 bh visually.',
  prerequisites: [],
  runningExample: {
    id: 'triangle-example',
    description: 'A triangle with base 8 and height 5.',
    expression: 'A = 1/2 × b × h',
    persistentObjectIds: ['triangle', 'base', 'height'],
  },
  segments: [{
    id: 'segment-1',
    title: 'Build the idea',
    order: 1,
    intuition: { explanation: 'Two congruent triangles make a rectangle.' },
    mathematics: { explanation: 'Therefore the triangle is half the rectangle.', expressions: ['A = 1/2 bh'], verified: true },
    beats: [
      createTeachingBeat({
        id: 'beat-1',
        narration: 'Start with the triangle.',
        targetObjects: ['triangle'],
        actions: [{
          type: 'create', objectId: 'triangle', node: {
            id: 'triangle', kind: 'shape', shape: 'triangle', x: 250, y: 150, width: 300, height: 240,
          },
        }],
      }),
      createTeachingBeat({
        id: 'beat-2',
        narration: 'Now transform a copy to complete the rectangle.',
        targetObjects: ['triangle', 'rectangle'],
        visualIntent: 'transform',
        actions: [{ type: 'transform', fromObjectId: 'triangle', toObjectId: 'rectangle' }],
      }),
      createTeachingBeat({
        id: 'beat-3',
        narration: 'So the triangle is half of the rectangle.',
        targetObjects: ['triangle'],
        visualIntent: 'highlight',
        cueWords: ['half'],
        actions: [{ type: 'highlight', objectId: 'triangle' }, { type: 'pause', durationMs: 500 }],
      }),
    ],
  }],
  finalInsight: 'A = 1/2 bh',
  visualGrammar: {
    archetype: 'geometry-transformation',
    dnaIds: ['dna-demo-geometry'],
    constructionPattern: 'build-transform-build',
    camera: 'focus',
  },
  expression: 'A = 1/2 bh',
  quality: { passed: true, issues: [], checks: { 'math-correctness': true } },
};

describe('3B1B teaching lesson → AI Guru animation compiler', () => {
  it('compiles one complete lesson into the existing UniversalMathScene contract', () => {
    const result = compileAIGuruTeachingLesson(lesson, { id: 'test-scene' });

    expect(result.scene.schemaVersion).toBe('1.0');
    expect(result.scene.id).toBe('test-scene');
    expect(result.scene.domain).toBe('geometry');
    expect(result.scene.nodes.some(node => node.id === 'triangle')).toBe(true);
    expect(result.scene.events.some(event => event.semanticAction === 'transform')).toBe(true);
    expect(result.scene.narrationCues.length).toBeGreaterThan(3);
    expect(result.sceneGraph.persistentIds.has('triangle')).toBe(true);
    expect(result.warnings).toEqual([]);
  });
});
