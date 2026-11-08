import { describe, expect, it } from 'vitest';
import { ncertClass10QuadraticLesson } from '../e2e/ncert-class10';
import { validateLesson } from './validate';

describe('AI Guru two-pass teaching contract', () => {
  it('replays the identical math animation in Malayalam', () => {
    const p = ncertClass10QuadraticLesson.paragraphs[0];
    expect(ncertClass10QuadraticLesson.teachingMode).toBe('two-pass');
    expect(p.malayalam.visuals.map(v => v.id)).toEqual(p.english.visuals.map(v => v.id));
    expect(Object.keys(p.english.captions ?? {})).toEqual(p.english.visuals.map(v => v.id));
    expect(Object.keys(p.malayalam.captions ?? {})).toEqual(p.english.visuals.map(v => v.id));
    expect(validateLesson(ncertClass10QuadraticLesson)).toEqual([]);
  });
});
