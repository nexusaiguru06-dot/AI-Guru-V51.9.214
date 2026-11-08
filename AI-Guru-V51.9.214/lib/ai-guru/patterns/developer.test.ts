import { describe, expect, it } from 'vitest';
import { developSectionVisuals, developStepVisuals, parseSearchReply, type LlmFn } from './developer';

const step = { id: 's1', before: '2x + 5 = 20', operation: 'subtract 5 from both sides', after: '2x = 15', caption: 'Subtract 5 from both sides', problem: 'Solve 2x + 5 = 20' };
/** Scripted model: answers in order, remembers every prompt it was given. */
function scripted(replies: Array<string | Error>) {
  const prompts: string[] = []; let i = 0;
  const llm: LlmFn = async (_s, p) => { prompts.push(p); const r = replies[Math.min(i++, replies.length - 1)]; if (r instanceof Error) throw r; return r; };
  return { llm, prompts, calls: () => i };
}
const plan = (o: unknown) => JSON.stringify(o);

describe('parseSearchReply', () => {
  it('QUERY: term  |  FINISH  |  anything else = FINISH', () => {
    expect(parseSearchReply('QUERY: number line for inequalities')).toEqual({ query: 'number line for inequalities' });
    expect(parseSearchReply('\n query: balance scale\nextra')).toEqual({ query: 'balance scale' });
    expect(parseSearchReply('FINISH')).toEqual({});
    expect(parseSearchReply('I think we are done')).toEqual({});
  });
});

describe('Visual Developer agent', () => {
  it('searches (QUERY then FINISH), picks a pattern, builds and verifies', async () => {
    const m = scripted(['QUERY: balance equation both sides', 'FINISH', plan({ summary: 'balance', uses: [{ pattern: 'balance-scale', params: { left: '2x + 5', right: '20', operation: '\u2212 5 on both sides' } }], actions: [] })]);
    const r = await developStepVisuals(step, { llm: m.llm });
    expect(r.ok).toBe(true);
    expect(r.patternIds).toEqual(['balance-scale']);
    expect(r.actions.length).toBeGreaterThan(8);
    expect(r.actions.every((a) => a.id.startsWith('s1-balance-scale-1-'))).toBe(true);
    expect(r.trace.join(' ')).toMatch(/QUERY|search round 1/);
    expect(m.prompts[m.calls() - 1]).toContain('PATTERN "balance-scale"'); // the pattern text really reached the generator
  });

  it('feeds the exact dry-run problems back and retries (MathVizAI-style)', async () => {
    const bad = plan({ uses: [{ pattern: 'teleporter', params: {} }], actions: [{ type: 'line', startX: 10, startY: 10, endX: 9000, endY: 10 }] });
    const good = plan({ uses: [{ pattern: 'number-line', params: { min: 0, max: 6, ray: { from: 3, direction: 'right' } } }] });
    const m = scripted(['FINISH', bad, good]);
    const r = await developStepVisuals({ ...step, operation: 'represent on number line', after: 'x > 3' }, { llm: m.llm, maxSearchRounds: 1 });
    expect(r.ok).toBe(true);
    expect(r.attempts).toBe(2);
    const retryPrompt = m.prompts[m.prompts.length - 1];
    expect(retryPrompt).toMatch(/failed the dry run/);
    expect(retryPrompt).toMatch(/UNKNOWN_PATTERN/);
    expect(retryPrompt).toMatch(/OUT_OF_BOARD/);
  });

  it('recovers from broken JSON', async () => {
    const m = scripted(['FINISH', 'sorry, here is a picture!', plan({ uses: [{ pattern: 'fraction-bar', params: { n: 4, k: 3 } }] })]);
    const r = await developStepVisuals({ ...step, operation: 'shade 3 of 4 parts', after: '3/4' }, { llm: m.llm, maxSearchRounds: 1 });
    expect(r.ok).toBe(true);
    expect(m.prompts[m.prompts.length - 1]).toMatch(/valid JSON/);
  });

  it('accepts "no picture needed" without inventing one', async () => {
    const m = scripted(['FINISH', plan({ uses: [], actions: [] })]);
    const r = await developStepVisuals(step, { llm: m.llm, maxSearchRounds: 1 });
    expect(r).toMatchObject({ ok: true, actions: [], patternIds: [] });
  });

  it('gives up cleanly after the retries and returns the reasons', async () => {
    const m = scripted(['FINISH', plan({ uses: [{ pattern: 'nope', params: {} }] })]);
    const r = await developStepVisuals(step, { llm: m.llm, maxSearchRounds: 1, maxRetries: 1 });
    expect(r.ok).toBe(false);
    expect(r.actions).toEqual([]);
    expect(r.attempts).toBe(2);
    expect(r.issues.some((i) => i.code === 'UNKNOWN_PATTERN')).toBe(true);
  });

  it('survives an LLM outage in the search phase', async () => {
    const m = scripted([new Error('503'), plan({ uses: [{ pattern: 'balance-scale', params: { left: 'x', right: '4' } }] })]);
    const r = await developStepVisuals(step, { llm: m.llm, maxSearchRounds: 1 });
    expect(r.ok).toBe(true);
    expect(r.trace.join(' ')).toMatch(/failed: 503/);
  });

  it('fits the animation to the narration length (timing contract)', async () => {
    const m = scripted(['FINISH', plan({ uses: [{ pattern: 'fraction-bar', params: { n: 4, k: 3 } }] })]);
    const r = await developStepVisuals({ ...step, narrationMs: 9000 }, { llm: m.llm, maxSearchRounds: 1 });
    const total = r.actions.reduce((s, a) => s + ((a as { durationMs?: number }).durationMs ?? 0), 0);
    expect(total).toBeGreaterThan(6500);
    expect(total).toBeLessThan(11000);
  });
});

describe('developSectionVisuals', () => {
  const section = () => ({
    heading: 'Solve the equation', sourceText: 'Solve 2x + 5 = 20 by keeping both sides balanced.', visuals: [] as any[],
    mathSteps: [
      { id: 'a', before: '2x + 5 = 20', operation: 'subtract 5 from both sides', after: '2x = 15', captionEnglish: 'Subtract 5 from both sides', visualIds: [] as string[] },
      { id: 'b', before: '12 + 15', operation: 'add the numbers', after: '27', captionEnglish: 'Add', visualIds: [] as string[] },
    ],
  });
  it('draws only the steps a pattern fits and maps visualIds', async () => {
    const m = scripted(['FINISH', plan({ uses: [{ pattern: 'balance-scale', params: { left: '2x + 5', right: '20', operation: '\u2212 5 both sides' } }] })]);
    const out = await developSectionVisuals(section(), { llm: m.llm, maxSearchRounds: 1, minScore: 1 });
    expect(out.visuals!.length).toBeGreaterThan(5);
    expect(out.mathSteps![0].visualIds!.length).toBe(out.visuals!.length);
    expect(out.mathSteps![1].visualIds).toEqual([]);
  });
  it('leaves a section that already has visuals alone, and never calls the model for plain arithmetic', async () => {
    const m = scripted(['FINISH']);
    const s = section(); s.visuals = [{ id: 'x' }];
    expect(await developSectionVisuals(s, { llm: m.llm })).toBe(s);
    const arithmetic = { heading: 'Add', sourceText: 'Work out 12 + 15.', visuals: [], mathSteps: [{ id: 'q', before: '12 + 15', operation: 'add', after: '27', visualIds: [] }] };
    await developSectionVisuals(arithmetic, { llm: m.llm });
    expect(m.calls()).toBe(0);
  });
  it('never throws when the model fails', async () => {
    const m = scripted([new Error('boom')]);
    await expect(developSectionVisuals(section(), { llm: m.llm, maxSearchRounds: 1, maxRetries: 0, minScore: 1 })).resolves.toBeTruthy();
  });
});
