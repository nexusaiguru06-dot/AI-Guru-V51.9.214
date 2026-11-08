import { describe, expect, it } from 'vitest';
import { COMPLETE_STEPS_RULES, HIGH_SCHOOL_TEACHER_PERSONA, TEACHER_STEP_CONTRACT } from './teacher-persona';
import { readFileSync } from 'node:fs';

describe('teacher persona', () => {
  it('uses the agreed wording and forbids skipped steps', () => {
    expect(HIGH_SCHOOL_TEACHER_PERSONA).toContain('You are an expert teacher, teaching students of high school class.');
    expect(HIGH_SCHOOL_TEACHER_PERSONA).toContain('ALL steps, step by step, to avoid rising doubt in the mind of kids');
    expect(COMPLETE_STEPS_RULES).toMatch(/NEVER skip or merge steps/);
    expect(COMPLETE_STEPS_RULES).toMatch(/Captions are mandatory/);
    expect(TEACHER_STEP_CONTRACT.startsWith(HIGH_SCHOOL_TEACHER_PERSONA)).toBe(true);
  });
  it('is wired into every prompt that writes worked solutions', () => {
    for (const f of ['lib/ai-guru/material-studio/pipeline.ts', 'lib/ai-guru/math/planner/gemini.ts', 'lib/ai-guru/generation/gemini.ts']) {
      expect(readFileSync(f, 'utf8')).toMatch(/TEACHER_STEP_CONTRACT|HIGH_SCHOOL_TEACHER_PERSONA/);
    }
  });
});
