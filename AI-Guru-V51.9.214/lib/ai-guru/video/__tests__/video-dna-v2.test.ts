import { describe, expect, it } from 'vitest';
import { selectVideoDNA } from '../video-dna-v2';

describe('Video-DNA v2 selector', () => {
  it('selects a geometry teaching grammar for a geometry lesson', async () => {
    const selection = await selectVideoDNA({
      lesson: {
        id: 'geometry-test',
        title: 'Pythagoras theorem',
        grade: 8,
        gradeBand: '6-8',
        domain: 'geometry',
        learningGoal: 'Use a right triangle to explain the relationship between the sides.',
        visualGrammar: { pacing: 'medium', camera: 'focus' },
        runningExample: { id: 'r1', description: 'right triangle', persistentObjectIds: ['triangle'] },
      },
      problemText: 'Find the hypotenuse of a right triangle.',
      requiredVisuals: ['triangle', 'geometry', 'highlight', 'cinematic reference'],
    });

    expect(selection.schemaVersion).toBe('2.0');
    expect(selection.primary.id).toBeTruthy();
    expect(selection.primary.branch).toBeTruthy();
    expect(selection.renderPolicy.exactMath.renderer).toBe('math-engine');
    expect(selection.renderPolicy.exactMath.deterministic).toBe(true);
    expect(selection.guardrails.length).toBeGreaterThan(0);
  });

  it('has a deterministic safe fallback when no corpus match exists', async () => {
    const selection = await selectVideoDNA({
      lesson: {
        id: 'fallback-test',
        title: 'A custom mathematics lesson',
        grade: 4,
        gradeBand: '1-5',
        domain: 'general',
        learningGoal: 'Explain a mathematical idea clearly.',
        visualGrammar: {},
        runningExample: { id: 'r1', description: 'example', persistentObjectIds: [] },
      },
    });

    expect(selection.primary.id).toBeTruthy();
    expect(selection.style.typography).toBe('math-engine');
    expect(selection.renderPolicy.exactMath.deterministic).toBe(true);
  });
});
