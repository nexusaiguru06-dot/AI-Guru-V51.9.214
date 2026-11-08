import { describe, expect, it } from 'vitest';
import { chilliesFor, cleanMcq, generateMcqs, placeGolden, spreadAnswers, summarise, tierFor, toffeesFor, type McqAnswer } from './mcq';
import { cleanRecord, rollup, studentCode } from './records';

const q = (i: number, answer = 'B') => ({ kind: 'twist', stem: `Q${i}?`, options: ['a' + i, 'b' + i, 'c' + i, 'd' + i], answer, why: 'because', concept: 'pairs' });

describe('cleanMcq', () => {
  it('accepts a good question', () => expect(cleanMcq(q(1), 0)?.answer).toBe('B'));
  it('rejects 3 options, repeated options, a bad key or no reason', () => {
    expect(cleanMcq({ ...q(1), options: ['a', 'b', 'c'] }, 0)).toBeNull();
    expect(cleanMcq({ ...q(1), options: ['a', 'A', 'c', 'd'] }, 0)).toBeNull();
    expect(cleanMcq({ ...q(1), answer: 'E' }, 0)).toBeNull();
    expect(cleanMcq({ ...q(1), why: '' }, 0)).toBeNull();
  });
});

describe('spread and golden', () => {
  const items = [1, 2, 3, 4, 5].map((i) => cleanMcq(q(i), i - 1)!);
  it('keeps the right option text when moving the key', () => {
    for (const s of spreadAnswers(items, 7)) {
      const orig = items.find((x) => x.id === s.id)!;
      expect(s.options.find((o) => o.id === s.answer)!.text).toBe(orig.options.find((o) => o.id === orig.answer)!.text);
      expect(new Set(s.options.map((o) => o.text)).size).toBe(4);
    }
  });
  it('marks exactly one golden question, never the first', () => {
    for (let seed = 0; seed < 12; seed++) {
      const g = placeGolden(items, seed);
      expect(g.filter((x) => x.golden)).toHaveLength(1);
      expect(g[0].golden).toBeFalsy();
    }
  });
});

describe('toffees', () => {
  const plain = cleanMcq(q(1), 0)!;
  const gold = { ...plain, golden: true };
  it('wrong = 0, right = 1, golden = 2', () => {
    expect(toffeesFor(plain, false, 5)).toBe(0);
    expect(toffeesFor(plain, true, 0)).toBe(1);
    expect(toffeesFor(gold, true, 0)).toBe(2);
  });
  it('third right answer in a row adds one', () => {
    expect(toffeesFor(plain, true, 2)).toBe(2);
    expect(toffeesFor(plain, true, 3)).toBe(1);
    expect(toffeesFor(plain, true, 5)).toBe(2);
  });
  it('summary: perfect box, tiers and best streak', () => {
    const a = (correct: boolean, toffees: number): McqAnswer => ({ id: 'x', chosen: 'A', correct, toffees, chillies: correct ? 0 : 1, ms: 1 });
    const s = summarise([a(true, 1), a(true, 1), a(true, 2), a(true, 1), a(true, 1)]);
    expect(s).toMatchObject({ pct: 100, fullBox: 2, bestStreak: 5, toffees: 8, tier: 'high' });
    const m = summarise([a(true, 1), a(false, 0), a(true, 1), a(false, 0)]);
    expect(m).toMatchObject({ pct: 50, fullBox: 0, bestStreak: 1, toffees: 2, chillies: 2, tier: 'low' });
    expect(s.chillies).toBe(0);
    expect([chilliesFor(true), chilliesFor(false)]).toEqual([0, 1]);
    expect([tierFor(90), tierFor(89), tierFor(70), tierFor(69)]).toEqual(['high', 'mid', 'mid', 'low']);
  });
  it('a quit quiz is not a full box', () => {
    const a: McqAnswer = { id: 'x', chosen: 'A', correct: true, toffees: 1, chillies: 0, ms: 1 };
    expect(summarise([a, a, a], 5).fullBox).toBe(0);
  });
});

describe('generateMcqs', () => {
  const opts = { chapter: 'c', section: 's', text: 't', count: 5, language: 'english' as const, grade: 10, seed: 3 };
  it('retries once after bad JSON, then returns marked questions', async () => {
    let calls = 0;
    const out = await generateMcqs(async () => (++calls === 1 ? 'oops' : JSON.stringify({ questions: [1, 2, 3, 4, 5].map((i) => q(i)) })), opts);
    expect(calls).toBe(2);
    expect(out).toHaveLength(5);
    expect(out.filter((x) => x.golden)).toHaveLength(1);
  });
  it('throws when the model never gives enough usable questions', async () => {
    await expect(generateMcqs(async () => JSON.stringify({ questions: [q(1)] }), opts)).rejects.toThrow(/Could not make the quiz/);
  });
});

describe('records', () => {
  const item = (correct: boolean, concept = 'pairs') => ({ id: 'q', kind: 'twist', stem: 's', concept, chosen: 'A', answer: 'A', correct, toffees: correct ? 1 : 0, seconds: 4 });
  it('recomputes totals from items and does not trust the client', () => {
    const r = cleanRecord({ id: 'a', studentId: 'student:abc-123456', items: [item(true), item(false)], correct: 99, pct: 100, total: 9, toffees: 500 })!;
    expect(r).toMatchObject({ total: 2, correct: 1, pct: 50, tier: 'low', code: '123456' });
    expect(r.toffees).toBe(200); // capped
  });
  it('rejects a record with no student or items', () => {
    expect(cleanRecord({ items: [] })).toBeNull();
    expect(cleanRecord({ studentId: 'x' })).toBeNull();
  });
  it('rollup finds weak concepts', () => {
    const mk = (at: string, items: ReturnType<typeof item>[]) => cleanRecord({ id: at, studentId: 's1', at, items })!;
    const r = rollup([mk('2026-01-01', [item(false, 'cross multiply'), item(true, 'pairs')]), mk('2026-01-02', [item(false, 'cross multiply'), item(true, 'pairs')])]);
    expect(r.weak).toEqual([{ concept: 'cross multiply', pct: 0, asked: 2 }]);
    expect(r.recent[0].at).toBe('2026-01-02');
    expect(studentCode('a')).toBe('A');
  });
});
