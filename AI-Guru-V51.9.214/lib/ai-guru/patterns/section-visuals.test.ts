import { describe, expect, it } from 'vitest';
import { dryRunSectionVisuals } from './section-visuals';
import type { LlmFn } from './developer';

const good = { type: 'line', id: 'g', startX: 100, startY: 100, endX: 300, endY: 300 };
const bad = { type: 'line', id: 'b', startX: 100, startY: 100, endX: 9000, endY: 300 };
const section = () => ({ heading: 'H', visuals: [good, bad], mathSteps: [{ id: 's1', visualIds: ['g', 'b'] }, { id: 's2', visualIds: ['b'] }], teachingPass: { visuals: [good, bad] } });

describe('dryRunSectionVisuals', () => {
  it('leaves clean sections untouched (same object)', async () => {
    const s = { visuals: [good] };
    const r = await dryRunSectionVisuals(s);
    expect(r.section).toBe(s);
    expect(r.report).toMatchObject({ checked: 1, removed: 0 });
  });
  it('without a model, drops the undrawable action and unlinks the steps that used it', async () => {
    const r = await dryRunSectionVisuals(section());
    expect(r.section.visuals!.map((v) => v.id)).toEqual(['g']);
    expect(r.section.mathSteps![0].visualIds).toEqual(['g']);
    expect(r.section.mathSteps![1].visualIds).toEqual([]);
    expect(r.section.teachingPass!.visuals).toHaveLength(1); // both language passes share one visual state
    expect(r.report.removed).toBe(1);
  });
  it('with a model, sends the exact problem and keeps the repaired visual', async () => {
    let seen = '';
    const llm: LlmFn = async (_s, p) => { seen = p; return JSON.stringify({ actions: [good, { ...bad, endX: 800 }] }); };
    const r = await dryRunSectionVisuals(section(), { llm });
    expect(seen).toMatch(/OUT_OF_BOARD \(b\)/);
    expect(r.section.visuals).toHaveLength(2);
    expect(r.report).toMatchObject({ repaired: true, removed: 0 });
    expect(r.section.mathSteps![1].visualIds).toEqual(['b']);
  });
  it('a model that cannot fix it still ends with a clean section', async () => {
    const llm: LlmFn = async () => 'not json';
    const r = await dryRunSectionVisuals(section(), { llm, maxRetries: 2 });
    expect(r.section.visuals!.map((v) => v.id)).toEqual(['g']);
    expect(r.report.repaired).toBe(false);
  });
});
