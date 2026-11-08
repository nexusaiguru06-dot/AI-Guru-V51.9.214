// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { cleanRecord, chilliesOf, rollup } from './records';
import { addReward, readRewards, seedRewards } from './rewards';
import { summarise, chilliesFor, type McqAnswer } from './mcq';

const mem = new Map<string, string>();
beforeEach(() => {
  mem.clear();
  (globalThis as any).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
});
const item = (correct: boolean) => ({ id: 'q', kind: 'twist', stem: 's', concept: 'c', chosen: 'A', answer: 'A', correct, toffees: correct ? 1 : 0, seconds: 2 });

describe('toffee and chilli rewards', () => {
  it('a wrong answer earns one chilli, a right one none', () => {
    expect([chilliesFor(true), chilliesFor(false)]).toEqual([0, 1]);
    const a = (c: boolean): McqAnswer => ({ id: 'x', chosen: 'A', correct: c, toffees: c ? 1 : 0, chillies: chilliesFor(c), ms: 1 });
    expect(summarise([a(true), a(false), a(false), a(true)]).chillies).toBe(2);
  });
  it('the server counts chillies itself and ignores what the client claims', () => {
    const r = cleanRecord({ id: 'a', studentId: 'student:abc-123456', items: [item(true), item(false), item(false)], chillies: 0, toffees: 1 })!;
    expect(r.chillies).toBe(2);
    expect(r.items.map((i) => i.chillies)).toEqual([0, 1, 1]);
  });
  it('old records without chillies still count their wrong answers; the roll-up adds them', () => {
    const old = { items: [item(true), item(false)] } as any;
    expect(chilliesOf(old)).toBe(1);
    const a = cleanRecord({ id: 'a', studentId: 'student:abc-123456', at: '2026-10-01T00:00:00Z', items: [item(false), item(false)] })!;
    const b = cleanRecord({ id: 'b', studentId: 'student:abc-123456', at: '2026-10-02T00:00:00Z', items: [item(true), item(false)], toffees: 1 })!;
    expect(rollup([a, b])).toMatchObject({ toffees: 1, chillies: 3 });
  });
  it('counters add up per student, never go down, and are raised to the server total', () => {
    expect(readRewards('s1')).toEqual({ toffees: 0, chillies: 0, redeemed: 0 });
    addReward('s1', { toffees: 2 }); addReward('s1', { chillies: 1 }); addReward('s1', { toffees: 1 });
    expect(readRewards('s1')).toEqual({ toffees: 3, chillies: 1, redeemed: 0 });
    expect(readRewards('s2')).toEqual({ toffees: 0, chillies: 0, redeemed: 0 });
    expect(seedRewards('s1', { toffees: 1, chillies: 5 })).toEqual({ toffees: 3, chillies: 5, redeemed: 0 }); // lower server value never lowers the counter
    expect(seedRewards('s1', { toffees: 9, chillies: 0 })).toEqual({ toffees: 9, chillies: 5, redeemed: 0 });
  });
  it('bad stored data reads as zero', () => {
    mem.set('ai-guru:rewards:v1:s9', '{oops');
    expect(readRewards('s9')).toEqual({ toffees: 0, chillies: 0, redeemed: 0 });
  });
});
