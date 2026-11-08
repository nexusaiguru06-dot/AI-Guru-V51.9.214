/** V51.9.93: free part (trial), enrolment, entitlement and the price table (pure rules). */
import { describe, expect, it } from 'vitest';
import { accessOf, cleanAccess, cleanParts, DEFAULT_ACCESS, entitlement, istToday, lockedParts, pricePreview, type AccessSettings } from './enrolment';
import { priceRows } from './pricing';
import type { FeeHead, Invoice, Student } from './fees';

const ON: AccessSettings = { enabled: true, freeParts: [1] };
const heads: FeeHead[] = [{ id: 'h', name: 'Tuition', amount: 1000, standard: 'all' }];
const stu = (x: Partial<Student> = {}): Student => ({ id: 's1', name: 'Arjun Nair', standard: '8', admissionNo: '', guardianName: '', guardianPhone: '', address: { line1: '', area: '', district: '', state: '', pincode: '' }, createdAt: '2026-10-01T00:00:00Z', ...x });
const paidInv = (date: string): Invoice => ({ id: 'i', studentId: 's1', term: 'T1', items: [{ name: 'T', amount: 1000 }], discount: 0, payments: [{ id: 'p', amount: 500, date, mode: 'cash', receiptNo: 'R1' }], createdAt: date });
const centre = { id: 'c1', kind: 'centre' as const, pilotUntil: '2026-12-31', active: true };

describe('enrolment', () => {
  it('a payment enrols, so does the office; a centre pilot opens everything; otherwise free part only', () => {
    expect(accessOf(stu(), [paidInv('2026-10-28')], [], '2026-11-30')).toEqual({ status: 'enrolled', full: true, enrolledOn: '2026-10-28', enrolledBy: 'payment' });
    expect(accessOf(stu({ enrolled: { on: '2026-10-29', by: 'admin' } }), [], [], '2026-11-30')).toMatchObject({ status: 'enrolled', enrolledBy: 'admin' });
    expect(accessOf(stu({ classId: 'c1' }), [], [centre], '2026-11-30')).toEqual({ status: 'pilot', full: true, pilotUntil: '2026-12-31' });
    expect(accessOf(stu({ classId: 'c1' }), [], [centre], '2027-01-01')).toEqual({ status: 'free', full: false });
    expect(accessOf(stu({ classId: 'c1' }), [], [{ ...centre, kind: 'class' }], '2026-11-30').status).toBe('free');
    expect(accessOf(stu(), [], [], '2026-11-30')).toEqual({ status: 'free', full: false });
  });
  it('who may open every part', () => {
    const base = { settings: ON, isAdmin: false, invoices: [] as Invoice[], classes: [], today: '2026-10-30' };
    expect(entitlement({ ...base, settings: DEFAULT_ACCESS, student: stu() })).toEqual({ full: true, why: 'off', signedIn: true });
    expect(entitlement({ ...base, isAdmin: true })).toEqual({ full: true, why: 'admin', signedIn: false });
    expect(entitlement(base)).toEqual({ full: false, why: 'visitor', signedIn: false });
    expect(entitlement({ ...base, student: stu() })).toEqual({ full: false, why: 'free', signedIn: true });
    expect(entitlement({ ...base, student: stu(), invoices: [paidInv('2026-10-20')] })).toEqual({ full: true, why: 'enrolled', signedIn: true });
  });
  it('locked parts', () => {
    expect(lockedParts([1], 5, { full: false })).toEqual([2, 3, 4, 5]);
    expect(lockedParts([1, 3], 5, { full: false })).toEqual([2, 4, 5]);
    expect(lockedParts([1], 5, { full: true })).toEqual([]);
  });
  it('settings and dates', () => {
    expect(cleanParts([3, 1, 1])).toEqual([1, 3]);
    expect(cleanParts([11])).toMatch(/1 to 10/);
    expect(cleanParts([])).toEqual([]);
    expect(cleanAccess({ enabled: 1 })).toMatchObject({ enabled: true, freeParts: [1], partPlan: { enabled: false } }); // V51.9.191: the part plan, off by default
    expect(istToday(Date.parse('2026-10-20T19:00:00Z'))).toBe('2026-10-21'); // 00:30 IST
  });
  it('price with a friend’s code (% or ₹) and a class code, and the friend’s commission', () => {
    const aff = { enabled: true, commissionPct: 10, discountPct: 10, payoutDay: 4 };
    expect(priceRows(heads, ['8'], aff, { discountPct: 20 })).toEqual([{ standard: '8', fee: 1000, friendPays: 900, classPays: 800, commission: 90 }]);
    expect(priceRows(heads, ['8'], { ...aff, discountKind: 'flat', discountPct: 250 }, { discountPct: 0 })[0]).toMatchObject({ friendPays: 750, commission: 75 });
    expect(pricePreview(heads, '8').pay).toBe(1000);
  });
});
