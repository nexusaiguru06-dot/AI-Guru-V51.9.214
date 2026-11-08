import { describe, it, expect } from 'vitest';
import { affiliateReport, commissionFor, commissionOf, DEFAULT_AFFILIATE, payoutDateFor, referralCodeFor, revenueRows, statusOf } from './affiliate';
import type { Invoice, Student } from './fees';

const st = (id: string, name: string, over: Partial<Student> = {}): Student => ({ id, name, standard: '8', school: 'GHSS', admissionNo: '', guardianName: '', guardianPhone: '', address: { line1: '', area: 'Perumbavoor', district: 'Ernakulam', state: 'Kerala', pincode: '' }, createdAt: '2026-10-01T00:00:00Z', ...over });
const inv = (studentId: string, payments: Invoice['payments'], total = 1000, discount = 0): Invoice => ({ id: 'i' + studentId, studentId, term: 'T1', items: [{ name: 'Tuition', amount: total }], discount, payments, createdAt: '' });

describe('affiliate rules', () => {
  it('makes unique readable codes', () => {
    const taken = new Set<string>();
    const a = referralCodeFor('Anjali Menon', taken, () => 0);
    expect(a).toBe('ANJAAAAA');
    taken.add(a);
    expect(referralCodeFor('Anjali Menon', taken, (() => { let n = 0; return () => (n++ < 4 ? 0 : 0.5); })())).not.toBe(a);
    expect(referralCodeFor('മനോജ്', new Set(), () => 0)).toMatch(/^XXX/);
  });
  it('pays on the 4th of the next month', () => {
    expect(payoutDateFor('2026-10-18')).toBe('2026-11-04');
    expect(payoutDateFor('2026-10-02')).toBe('2026-11-04');
    expect(payoutDateFor('2026-12-31')).toBe('2027-01-04');
    expect(payoutDateFor('2026-01-10', 15)).toBe('2026-02-15');
  });
  it('commission on a payment uses the rate in force, the affiliate override first', () => {
    const a = st('a', 'Anjali'), b = st('b', 'Arjun', { referredBy: 'a' });
    expect(commissionOf(1999, 10)).toBe(199.9);
    expect(commissionFor(b, [a, b], 1000, '2026-10-18', DEFAULT_AFFILIATE)).toEqual({ affiliateId: 'a', rate: 10, amount: 100, payoutDate: '2026-11-04' });
    expect(commissionFor(b, [{ ...a, commissionPct: 15 }, b], 1000, '2026-10-18', DEFAULT_AFFILIATE)?.amount).toBe(150);
    expect(commissionFor(b, [a, b], 1000, '2026-10-18', { ...DEFAULT_AFFILIATE, enabled: false })).toBeUndefined();
    expect(commissionFor(a, [a, b], 1000, '2026-10-18', DEFAULT_AFFILIATE)).toBeUndefined(); // not referred
    expect(commissionFor(b, [a, b], 1000, '2026-10-18', { ...DEFAULT_AFFILIATE, commissionPct: 0 })).toBeUndefined();
  });
  it('status: pending → due → paid', () => {
    const c = { affiliateId: 'a', rate: 10, amount: 100, payoutDate: '2026-11-04' };
    expect(statusOf(c, '2026-11-03')).toBe('pending');
    expect(statusOf(c, '2026-11-04')).toBe('due');
    expect(statusOf({ ...c, paid: { on: '2026-11-05', payoutId: 'p' } }, '2026-11-30')).toBe('paid');
  });
  it('report: referred students, every payment, month lines and totals', () => {
    const a = st('a', 'Anjali'), b = st('b', 'Arjun', { referredBy: 'a', createdAt: '2026-10-05T00:00:00Z' }), c = st('c', 'Devika', { referredBy: 'a', createdAt: '2026-09-01T00:00:00Z' }), d = st('d', 'Other');
    const com = (amount: number, date: string, paid = false) => ({ affiliateId: 'a', rate: 10, amount, payoutDate: payoutDateFor(date), ...(paid ? { paid: { on: '2026-10-05', payoutId: 'p1' } } : {}) });
    const invoices = [
      inv('b', [{ id: 'p1', amount: 400, date: '2026-10-10', mode: 'upi', receiptNo: 'R1', commission: com(40, '2026-10-10') }, { id: 'p2', amount: 100, date: '2026-10-20', mode: 'cash', receiptNo: 'R2', commission: com(10, '2026-10-20') }]),
      inv('c', [{ id: 'p3', amount: 1000, date: '2026-09-12', mode: 'cash', receiptNo: 'R0', commission: com(100, '2026-09-12', true) }]),
      inv('d', [{ id: 'p4', amount: 500, date: '2026-10-11', mode: 'cash', receiptNo: 'R3' }]),
    ];
    const r = affiliateReport('a', [a, b, c, d], invoices, '2026-10-18');
    expect(r.referrals.map((x) => x.student.name)).toEqual(['Arjun', 'Devika']);
    expect(r.referrals[0]).toMatchObject({ billed: 1000, paid: 500, due: 500, commission: 50 });
    expect(r.totals).toEqual({ referrals: 2, billed: 2000, paid: 1500, due: 500, earned: 150, pending: 50, dueNow: 0, paidOut: 100 });
    expect(r.months.map((m) => [m.payoutDate, m.amount, m.status])).toEqual([['2026-11-04', 50, 'pending'], ['2026-10-04', 100, 'paid']]);
    expect(r.nextPayout).toEqual({ payoutDate: '2026-11-04', amount: 50 });
    expect(affiliateReport('a', [a, b, c, d], invoices, '2026-11-05').totals).toMatchObject({ dueNow: 50, pending: 0 });
  });
  it('revenue rows: billed, discount, paid, due, commission generated, net', () => {
    const a = st('a', 'Anjali'), b = st('b', 'Arjun', { referredBy: 'a', coupon: 'ANJAAAAA' });
    const rows = revenueRows([a, b], [inv('b', [{ id: 'p', amount: 450, date: '2026-10-10', mode: 'upi', receiptNo: 'R1', commission: { affiliateId: 'a', rate: 10, amount: 45, payoutDate: '2026-11-04' } }], 1000, 100)]);
    expect(rows[0]).toMatchObject({ name: 'Arjun', billed: 900, discount: 100, paid: 450, due: 450, commissionGenerated: 45, net: 405, referredByName: 'Anjali' });
    expect(rows[1]).toMatchObject({ name: 'Anjali', paid: 0 });
  });
});
