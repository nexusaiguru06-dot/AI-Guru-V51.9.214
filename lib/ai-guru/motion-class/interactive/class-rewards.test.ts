// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { classAnswerRecord, rewardClassAnswer } from './class-rewards';
import { cleanRecord, rollup } from '@/lib/ai-guru/quiz/records';
import { redeemable } from '@/lib/ai-guru/share/redeem';
import { readRewards } from '@/lib/ai-guru/quiz/rewards';
import type { PlacedQuestion } from './questions';

const q: PlacedQuestion = {
  id: 'block-3:dna-linear:slot-1', blockId: 'block-3', dna: 'linear', after: { en: 'x', ml: 'x' },
  prompt: { en: 'What is subtracted from both sides?', ml: 'രണ്ടു വശത്തുനിന്നും എന്താണ് കുറയ്ക്കുന്നത്?' }, kind: 'choice',
  options: [{ id: 'o1', text: { en: '5', ml: '5' }, correct: true }, { id: 'o2', text: { en: '2', ml: '2' }, correct: false }, { id: 'o3', text: { en: '25', ml: '25' }, correct: false }, { id: 'o4', text: { en: '10', ml: '10' }, correct: false }],
  explain: { en: 'We take 5 away from both sides.', ml: 'രണ്ടു വശത്തുനിന്നും 5 കുറയ്ക്കുന്നു.' }, conceptId: 'linear-eq', segment: 0, step: 2, atMs: 4000, lang: 'en',
} as PlacedQuestion;
const who = { studentId: 'student:abc', studentName: 'Meera', grade: 9, chapter: 'Equations', section: 'Linear equations' };

describe('V51.9.111 in-class questions earn toffees and chillies', () => {
  beforeEach(() => {
    const m = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k), clear: () => m.clear() }); vi.stubGlobal('fetch', vi.fn(async () => new Response('{"ok":true}', { status: 200 }))); });

  it('a right answer: one toffee; a wrong one: one chilli; a skip: nothing', () => {
    rewardClassAnswer(q, { correct: true, skipped: false, picked: 'o1' }, who);
    expect(readRewards(who.studentId)).toMatchObject({ toffees: 1, chillies: 0 });
    rewardClassAnswer(q, { correct: false, skipped: false, picked: 'o3' }, who);
    expect(readRewards(who.studentId)).toMatchObject({ toffees: 1, chillies: 1 });
    rewardClassAnswer(q, { correct: false, skipped: true, picked: null }, who);
    expect(readRewards(who.studentId)).toMatchObject({ toffees: 1, chillies: 1 });
    expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.filter((c) => String(c[0]).includes('/api/ai-guru/progress')).length).toBe(2); // sent for the teacher and parent
  });

  it('the record passes the server check, counts in the totals, and a missed question can be redone', () => {
    const wrong = cleanRecord(classAnswerRecord(q, { correct: false, skipped: false, picked: 'o3' }, who))!;
    expect(wrong).toMatchObject({ total: 1, correct: 0, chillies: 1, toffees: 0, section: 'In-class question · Linear equations', grade: '9' });
    expect(wrong.items[0]).toMatchObject({ chosen: 'c', answer: 'a', correct: false, options: [{ id: 'a', text: '5' }, { id: 'b', text: '2' }, { id: 'c', text: '25' }, { id: 'd', text: '10' }] });
    const right = cleanRecord(classAnswerRecord(q, { correct: true, skipped: false, picked: 'o1' }, who, ))!;
    expect(right).toMatchObject({ correct: 1, toffees: 1, chillies: 0 });
    const redo = redeemable([wrong, right]);
    expect(redo.length).toBe(1);
    expect(redo[0].item.stem).toBe('What is subtracted from both sides?');
    expect(rollup([wrong, right])).toBeTruthy();
    // a Malayalam class question is saved in Malayalam
    expect(classAnswerRecord({ ...q, lang: 'ml' } as PlacedQuestion, { correct: true, skipped: false, picked: 'o1' }, who).items[0].stem).toBe('രണ്ടു വശത്തുനിന്നും എന്താണ് കുറയ്ക്കുന്നത്?');
  });
});
