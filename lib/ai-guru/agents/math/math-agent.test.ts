import { describe, expect, it } from 'vitest';
import { MathAgent } from './math-agent';
import { InjectableMathVerifier } from '../../math/adapter';
import { ids } from '../../contracts';

const lesson = {
  schemaVersion: '2.0' as const, id: ids.lesson('test'), courseId: ids.course('test'), bookId: ids.book('test'), chapterId: ids.chapter('test'),
  title: 'Test', language: { source: 'english' as const, target: 'malayalam' as const }, teachingMode: 'two-pass' as const,
  paragraphs: [{ id: ids.paragraph('test', 0), index: 0, source: { bookId: ids.book('test'), chapterId: ids.chapter('test'), pageNumber: 1, pageImage: 'p1', text: 'Solve 2x = 6.' }, teachingIntent: 'solve', explanation: { english: 'Solve 2x = 6.', malayalam: '2x = 6 പരിഹരിക്കുക.' }, visualSteps: [{ id: ids.visualStep(ids.paragraph('test', 0), 0), paragraphId: ids.paragraph('test', 0), order: 0, purpose: 'equation', action: { type: 'latex', id: 'v1', latex: '2x=6', x: 0, y: 0 } }], audioCues: [], checkpoints: [], problems: [], state: 'idle' as const, qa: { content: 'passed' as const, lesson: 'passed' as const, visual: 'pending' as const, classroom: 'pending' as const }}],
};

describe('MathAgent', () => {
  it('verifies and compiles math per paragraph', async () => {
    const verifier = new InjectableMathVerifier(async (expression) => ({ valid: expression.includes('='), expression, normalized: expression, errors: [] }));
    const result = await new MathAgent(verifier).execute({ agent: 'math', context: { runId: ids.agentRun('test'), lessonId: lesson.id }, input: { lesson } });
    expect(result.ok).toBe(true);
    expect(result.output?.lesson.paragraphs[0].math?.status).toBe('passed');
    expect(result.output?.lesson.paragraphs[0].math?.scenes.length).toBeGreaterThan(0);
  });
});
