import { describe, expect, it } from 'vitest';
import { cleanSet, draftProblem, draftToItem, emptyDraft, itemToDraft } from './sets';
import { cleanRecord } from './records';

const q = (i: number) => ({ stem: `Q${i}?`, options: ['a', 'b', 'c', 'd'].map((x) => x + i), answer: 'C', why: 'because', concept: 'pairs' });

describe('question sets', () => {
  it('keeps good questions, drops bad ones, keeps golden', () => {
    const s = cleanSet({ name: ' Test  1 ', items: [q(1), { ...q(2), options: ['a', 'a', 'b', 'c'] }, { ...q(3), golden: true }] })!;
    expect(s.name).toBe('Test 1');
    expect(s.items.map((x) => x.stem)).toEqual(['Q1?', 'Q3?']);
    expect(s.items.map((x) => !!x.golden)).toEqual([false, true]);
    expect(s.active).toBe(true);
    expect(s.items[0].answer).toBe('C');
  });
  it('needs a name and at least one question', () => {
    expect(cleanSet({ name: '', items: [q(1)] })).toBeNull();
    expect(cleanSet({ name: 'x', items: [] })).toBeNull();
    expect(cleanSet({ name: 'x', items: [{ stem: '' }] })).toBeNull();
  });
  it('the form says what is missing, and round-trips a question', () => {
    const d = emptyDraft();
    expect(draftProblem(d)).toMatch(/question/i);
    d.stem = 'What is 2+2?'; d.options = ['3', '4', '5', '4']; d.why = 'adding';
    expect(draftProblem(d)).toMatch(/same/);
    d.options = ['3', '4', '5', '6']; d.answer = 1; d.golden = true;
    expect(draftProblem(d)).toBeNull();
    const item = draftToItem(d, 0)!;
    expect(item).toMatchObject({ answer: 'B', golden: true });
    expect(itemToDraft(item)).toMatchObject({ answer: 1, golden: true, options: ['3', '4', '5', '6'] });
  });
  it('a quiz record carries the set it came from', () => {
    const items = [{ id: 'q1', kind: 'standard', stem: 's', concept: 'c', chosen: 'A', answer: 'A', correct: true, toffees: 1, seconds: 1 }];
    expect(cleanRecord({ studentId: 's', items, setId: 'set-1', setName: 'Test 1' })).toMatchObject({ setId: 'set-1', setName: 'Test 1' });
    expect(cleanRecord({ studentId: 's', items })).not.toHaveProperty('setId');
  });
});
