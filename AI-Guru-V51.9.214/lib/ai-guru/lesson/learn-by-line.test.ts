import { describe, expect, it } from 'vitest';
import { ncertClass10QuadraticLesson } from '@/lib/ai-guru/e2e/ncert-class10';

describe('learn-by-line cumulative derivation contract', () => {
  it('keeps all five mathematical lines cumulative and gives every line a stable id', () => {
    const actions = ncertClass10QuadraticLesson.paragraphs[0].english.visuals;
    const lines = actions.filter(a => a.type === 'latex');
    expect(lines.map(a => a.id)).toEqual(['eq-start', 'eq-complete', 'eq-factor', 'eq-roots', 'eq-answer']);
    expect(lines).toHaveLength(5);
  });

  it('preserves the same visual line sequence for Malayalam', () => {
    const p = ncertClass10QuadraticLesson.paragraphs[0];
    expect(p.malayalam.visuals.map(a => a.id)).toEqual(p.english.visuals.map(a => a.id));
  });
});
