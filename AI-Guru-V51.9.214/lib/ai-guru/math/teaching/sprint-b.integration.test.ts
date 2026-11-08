import { describe, expect, it } from 'vitest';
import { compileAIGuruTeachingLesson } from '../animation';
import type { AIGuruTeachingLesson } from './types';

const lesson: AIGuruTeachingLesson = {
  schemaVersion: '2.0',
  id: 'triangle-area-sprint-b',
  title: 'Why the area of a triangle is half base times height',
  grade: 7,
  gradeBand: '6-8',
  domain: 'geometry',
  openingQuestion: 'Why is a triangle half of a matching rectangle?',
  whyItMatters: 'It turns a visual relationship into a reusable area formula.',
  learningGoal: 'Understand A = 1/2 bh from a visual transformation.',
  prerequisites: [],
  runningExample: {
    id: 'triangle-example',
    description: 'A triangle with base 6 and height 4.',
    expression: 'A = 1/2 × 6 × 4',
    persistentObjectIds: ['triangle', 'base', 'height'],
  },
  visualGrammar: {
    archetype: 'geometric-transformation',
    dnaIds: ['triangle-to-rectangle'],
    constructionPattern: 'build-transform-build',
    motifs: ['split-and-recombine', 'highlight-height'],
    pacing: 'medium',
    camera: 'focus',
  },
  segments: [{
    id: 'segment-1', title: 'Build the triangle', order: 0,
    intuition: { explanation: 'Start with the triangle and expose its base and height.' },
    mathematics: { explanation: 'The matching rectangle has twice the triangle area.', expressions: ['A = 1/2 bh'], verified: true },
    beats: [
      {
        id: 'beat-1', narration: 'First, look at the base and height of our triangle.', cueWords: ['base', 'height'], durationMs: 1200,
        visualIntent: 'create', targetObjects: ['triangle', 'base', 'height'],
        actions: [
          { type: 'create', objectId: 'triangle', node: { id: 'triangle', kind: 'shape', x: 180, y: 180, width: 300, height: 220, shape: 'triangle', style: { strokeWidth: 4 } } as any },
          { type: 'create', objectId: 'base', node: { id: 'base', kind: 'line', startX: 180, startY: 400, endX: 480, endY: 400 } as any },
          { type: 'create', objectId: 'height', node: { id: 'height', kind: 'line', startX: 180, startY: 400, endX: 180, endY: 180 } as any },
          { type: 'highlight', objectId: 'base' },
          { type: 'highlight', objectId: 'height' },
        ],
        dna: { dnaId: 'triangle-to-rectangle', archetype: 'geometric-transformation', constructionStep: 'construct base and height', motif: 'highlight-geometry' },
      },
      {
        id: 'beat-2', narration: 'Now transform the triangle into a matching rectangle relationship.', cueWords: ['transform', 'rectangle'], durationMs: 1500,
        visualIntent: 'transform', targetObjects: ['triangle', 'rectangle'],
        actions: [
          { type: 'create', objectId: 'rectangle', node: { id: 'rectangle', kind: 'shape', x: 180, y: 180, width: 300, height: 220, shape: 'rectangle', style: { strokeWidth: 4 } } as any },
          { type: 'transform', fromObjectId: 'triangle', toObjectId: 'rectangle' },
        ],
        dna: { dnaId: 'triangle-to-rectangle', archetype: 'geometric-transformation', constructionStep: 'transform into matching rectangle', motif: 'build-transform-build' },
      },
      {
        id: 'beat-3', narration: 'That is why the triangle area is one half base times height.', cueWords: ['one half', 'base', 'height'], durationMs: 1300,
        visualIntent: 'derive', targetObjects: ['rectangle', 'formula'],
        actions: [
          { type: 'highlight', objectId: 'rectangle' },
          { type: 'pause', durationMs: 500 },
        ],
        dna: { dnaId: 'triangle-to-rectangle', archetype: 'geometric-transformation', constructionStep: 'reveal formula', motif: 'insight-pause' },
      },
    ],
  }],
  finalInsight: 'A triangle is half the area of the matching rectangle.',
};

describe('Sprint B 3B1B lesson integration', () => {
  it('compiles a teaching lesson into the existing UniversalMathScene', () => {
    const compiled = compileAIGuruTeachingLesson(lesson, { teachingLanguage: 'english', id: 'test:triangle-area' });
    expect(compiled.beats).toHaveLength(3);
    expect(compiled.scene.nodes.map(n => n.id)).toEqual(expect.arrayContaining(['triangle', 'rectangle']));
    expect(compiled.scene.events.some(e => e.semanticAction === 'transform')).toBe(true);
    expect(compiled.scene.narrationCues.length).toBeGreaterThan(3);
    expect([...compiled.sceneGraph.persistentIds]).toEqual(expect.arrayContaining(['triangle', 'base', 'height']));
  });
});
