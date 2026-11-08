import { beforeEach, describe, expect, it } from 'vitest';
import { loadPlan, savePlan } from './plan-store';

function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { m.set(k, String(v)); },
    removeItem: (k: string) => { m.delete(k); },
    clear: () => m.clear(),
  } as Storage;
}

describe('plan store', () => {
  beforeEach(() => { (globalThis as { localStorage?: Storage }).localStorage = fakeStorage(); });
  it('keeps a plan and reads it back', () => {
    expect(loadPlan('k1')).toBeNull();
    savePlan('k1', { plans: new Map([['b1', { a: 1 }]]), subjects: new Map([['b1', { agent: 'x' }]]) });
    const r = loadPlan<{ a: number }, { agent: string }>('k1')!;
    expect(r.plans.get('b1')).toEqual({ a: 1 });
    expect(r.subjects?.get('b1')).toEqual({ agent: 'x' });
  });
  it('keeps only the newest 24', () => {
    for (let i = 0; i < 30; i++) savePlan(`k${i}`, { plans: new Map([['b', i]]) });
    expect(loadPlan('k29')).not.toBeNull();
    expect(loadPlan('k0')).toBeNull();
  });
  it('ignores a broken record', () => {
    localStorage.setItem('aig_plan_v1:bad', '{oops');
    expect(loadPlan('bad')).toBeNull();
  });
});
