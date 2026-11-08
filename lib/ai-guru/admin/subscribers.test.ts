import { describe, expect, it, beforeEach } from 'vitest';
import { newSubscribers, shortName, subscribersView } from './subscribers';
import { DEFAULT_AFFILIATE } from './affiliate';
import type { Invoice, Student } from './fees';
import { keptRef, rememberRef, forgetRef } from '../share/ref-keep';

const st = (id: string, name: string, createdAt: string, extra: Partial<Student> = {}): Student => ({ id, name, standard: '8', school: 'GHS', admissionNo: '', guardianName: '', guardianPhone: '', address: { line1: '', area: 'Feroke', district: 'Kozhikode', state: 'Kerala', pincode: '' }, createdAt, ...extra } as Student);

describe('V51.9.155 subscribers', () => {
  const me = st('a', 'Anju Mohan', '2026-01-01T00:00:00Z', { referralCode: 'ANJUK7Q2', subscribersSeenAt: '2026-05-01T00:00:00Z' });
  const f1 = st('b', 'Devi Krishna R', '2026-04-01T00:00:00Z', { referredBy: 'a' });
  const f2 = st('c', 'Arun', '2026-06-01T00:00:00Z', { referredBy: 'a' });
  const other = st('d', 'Someone Else', '2026-06-02T00:00:00Z', { referredBy: 'x' });
  const inv = { id: 'i1', studentId: 'b', term: 'T1', items: [{ head: 'Fee', amount: 1000 }], discount: 0, payments: [{ id: 'p1', date: '2026-04-10', amount: 1000, mode: 'upi', receiptNo: 'R1', commission: { affiliateId: 'a', rate: 10, amount: 100, payoutDate: '2026-05-04' } }] } as unknown as Invoice;

  it('shows friends with short names, trial or enrolled, and who is new', () => {
    expect(shortName('Devi Krishna R')).toBe('Devi K.');
    expect(shortName('Arun')).toBe('Arun');
    const v = subscribersView(me, [me, f1, f2, other], [inv], DEFAULT_AFFILIATE, 10, '2026-06-10');
    expect(v.subscribers.map((s) => [s.name, s.status, s.isNew])).toEqual([['Arun', 'trial', true], ['Devi K.', 'enrolled', false]]);
    expect(v.totals.referrals).toBe(2);
    expect(v.totals.enrolled).toBe(1);
    expect(v.totals.newCount).toBe(1);
    expect(v.totals.dueNow).toBe(100);
    expect(JSON.stringify(v.subscribers)).not.toContain('Feroke');
    expect(newSubscribers(me, [me, f1, f2, other])).toBe(1);
  });
});

describe('V51.9.155 the friend code is kept on the device', () => {
  const mem = new Map<string, string>();
  beforeEach(() => { mem.clear(); (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) }; });
  it('keeps ?ref, reads the old form, expires after 60 days', () => {
    expect(rememberRef('?x=1')).toBe('');
    expect(rememberRef('?ref=anju-k7q2', 1000)).toBe('ANJUK7Q2');
    expect(rememberRef('', 2000)).toBe('ANJUK7Q2');
    expect(keptRef(1000 + 61 * 864e5)).toBe('');
    expect(rememberRef('?ref=DEVIAB12', 3000)).toBe('DEVIAB12');
    mem.set('aig_ref', 'OLDC0DE1');
    expect(keptRef()).toBe('OLDC0DE1');
    expect(rememberRef('?ref=<script>')).toBe('OLDC0DE1');
    forgetRef();
    expect(keptRef()).toBe('');
  });
});
