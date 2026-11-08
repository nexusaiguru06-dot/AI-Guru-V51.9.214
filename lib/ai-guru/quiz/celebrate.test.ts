// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { celebrationOf } from './celebrate';
import { rewardEvents } from './reward-feed';
import type { SessionRecord } from './records';

describe('reward celebration (V51.9.117)', () => {
  it('a wrong answer: the chilli line', () => {
    const c = celebrationOf({ toffees: 0, chillies: 1, redeemed: 0, meta: { reported: true } })!;
    expect(c).toMatchObject({ kind: 'chilli', count: 1, reported: true, say: 'The answer is wrong. You got a chilli.' });
  });
  it('a right answer: congratulations and a toffee', () => {
    expect(celebrationOf({ toffees: 1, chillies: 0, redeemed: 0, meta: {} })!.say).toBe('Congratulations! You got a toffee.');
    expect(celebrationOf({ toffees: 3, chillies: 0, redeemed: 0, meta: {} })!.say).toBe('Congratulations! You got 3 toffees.');
    expect(celebrationOf({ toffees: 1, chillies: 0, redeemed: 0, meta: { lang: 'ml' } })!.sayMl).toContain('ടോഫി');
  });
  it('a redo turns a chilli into a toffee; nothing earned is no celebration', () => {
    expect(celebrationOf({ toffees: 1, chillies: 0, redeemed: 1, meta: {} })!.kind).toBe('redeem');
    expect(celebrationOf({ toffees: 0, chillies: 0, redeemed: 0, meta: {} })).toBeNull();
  });
});

describe('addReward announces the gain', () => {
  const g = globalThis as unknown as { window?: unknown; localStorage?: unknown; CustomEvent?: unknown };
  afterEach(() => { delete g.window; delete g.localStorage; vi.resetModules(); });
  it('fires reward-gained with the change, not for quiet or seeding', async () => {
    const mem = new Map<string, string>();
    g.localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    const seen: unknown[] = [];
    g.window = { dispatchEvent: (e: { type: string; detail: unknown }) => { if (e.type === 'ai-guru:reward-gained') seen.push(e.detail); return true; } };
    const { addReward, seedRewards } = await import('./rewards');
    addReward('s1', { chillies: 1 }, { reported: true });
    addReward('s1', { toffees: 2 }, { quiet: true });
    seedRewards('s1', { toffees: 10 });
    expect(seen).toEqual([{ studentId: 's1', toffees: 0, chillies: 1, redeemed: 0, meta: { reported: true } }]);
  });
});

describe('the portals’ toffee / chilli feed', () => {
  const rec = (o: Partial<SessionRecord>): SessionRecord => ({ id: 'r', studentId: 's', code: 'ABC', studentName: 'Arjun', at: '2026-10-22T09:00:00Z', grade: '9', chapter: 'Equations', section: 'In-class question · Equations', total: 1, correct: 0, pct: 0, toffees: 0, chillies: 1, tier: 'low', bestStreak: 0, seconds: 0, items: [], ...o });
  it('one line per reward, newest first, with the chosen and right answers', () => {
    const wrong = rec({ id: 'a', items: [{ id: 'q', kind: 'standard', stem: 'What is x?', concept: 'c', chosen: 'b', answer: 'c', correct: false, toffees: 0, chillies: 1, seconds: 0, options: [{ id: 'a', text: '56' }, { id: 'b', text: '110' }, { id: 'c', text: '55' }, { id: 'd', text: '100' }] }] });
    const right = rec({ id: 'b', at: '2026-10-22T09:05:00Z', section: 'Daily challenge', correct: 1, toffees: 2, items: [{ id: 'q2', kind: 'standard', stem: '2+2?', concept: 'c', chosen: 'a', answer: 'a', correct: true, toffees: 2, chillies: 0, seconds: 0 }] });
    const ev = rewardEvents([wrong, right]);
    expect(ev.map((e) => [e.kind, e.where, e.count])).toEqual([['toffee', 'quiz', 2], ['chilli', 'class', 1]]);
    expect(ev[1]).toMatchObject({ question: 'What is x?', chosen: '110', right: '55', studentName: 'Arjun' });
  });
});
