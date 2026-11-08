/** V51.9.94: monthly and yearly plans (pure rules). */
import { describe, expect, it } from 'vitest';
import { addMonths, cleanPlanSettings, invoiceFor, monthlyQuote, monthlyRateFor, nextStart, overlaps, paidThrough, periodEnd, planPriceRows, recordStatus, yearlyQuote, type MonthlyRecord, type YearlyRecord } from './plans';
import { accessOf } from './enrolment';
import { invoiceTotal, type Coupon, type Invoice } from './fees';

const S = { prices: [{ standard: '8', monthly: 1000 }, { standard: 'all', monthly: 800 }], yearlyReductionPct: 10, graceDays: 5 };
const pct10: Coupon = { code: 'ANJA7K2Q', kind: 'percent', value: 10, used: 0, active: true };
const flat250: Coupon = { code: 'FLAT', kind: 'flat', value: 250, used: 0, active: true };

describe('dates', () => {
  it('months run from the start date; short months are handled', () => {
    expect(periodEnd('2026-10-20', 1)).toBe('2026-11-19');
    expect(periodEnd('2026-10-20', 12)).toBe('2027-10-19');
    expect(addMonths('2027-01-31', 1)).toBe('2027-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(periodEnd('2026-01-01', 1)).toBe('2026-01-31');
  });
});

describe('prices', () => {
  it('monthly fee per standard, else the "all" fee', () => {
    expect(monthlyRateFor(S, '8')).toBe(1000);
    expect(monthlyRateFor(S, '9')).toBe(800);
    expect(monthlyRateFor({ prices: [{ standard: '8', monthly: 1000 }] }, '9')).toBeNull();
  });
  it('yearly = 12 months less the yearly reduction, then the code discount', () => {
    expect(yearlyQuote(1000, 10)).toMatchObject({ gross: 12000, reduction: 1200, couponDiscount: 0, total: 10800, saving: 1200 });
    expect(yearlyQuote(1000, 10, pct10)).toMatchObject({ reduction: 1200, couponDiscount: 1080, total: 9720 });
    expect(yearlyQuote(1000, 10, flat250)).toMatchObject({ couponDiscount: 250, total: 10550 });
    expect(yearlyQuote(1000, 10, flat250, true).total).toBe(10800);
    expect(monthlyQuote(1000, pct10)).toEqual({ gross: 1000, couponDiscount: 100, total: 900 });
    expect(planPriceRows(S)).toEqual([{ standard: '8', monthly: 1000, twelveMonths: 12000, yearly: 10800, saving: 1200 }, { standard: 'all', monthly: 800, twelveMonths: 9600, yearly: 8640, saving: 960 }]);
  });
  it('checks the settings form', () => {
    expect(cleanPlanSettings({ prices: [{ standard: '8', monthly: 0 }], yearlyReductionPct: 10, graceDays: 5 })).toMatch(/monthly fee/);
    expect(cleanPlanSettings({ prices: [], yearlyReductionPct: 95, graceDays: 5 })).toMatch(/reduction/);
    expect(cleanPlanSettings({ prices: [], yearlyReductionPct: 10, graceDays: 99 })).toMatch(/Grace/);
    expect(cleanPlanSettings({ prices: [{ standard: 'all', monthly: 800 }, { standard: '10', monthly: 1200 }], yearlyReductionPct: '15', graceDays: '3' })).toEqual({ prices: [{ standard: '10', monthly: 1200 }, { standard: 'all', monthly: 800 }], yearlyReductionPct: 15, graceDays: 3 });
  });
});

const yr = (x: Partial<YearlyRecord> = {}): YearlyRecord => ({ id: 'y1', kind: 'yearly', months: 12, studentId: 's1', invoiceId: 'iy', start: '2026-10-20', end: '2027-10-19', monthlyRate: 1000, gross: 12000, reductionPct: 10, reduction: 1200, couponDiscount: 1080, coupon: 'ANJA7K2Q', total: 9720, createdAt: '', ...x });
const mo = (x: Partial<MonthlyRecord> = {}): MonthlyRecord => ({ id: 'm1', kind: 'monthly', studentId: 's1', invoiceId: 'im', start: '2026-10-20', end: '2026-11-19', monthlyRate: 1000, couponDiscount: 0, total: 1000, createdAt: '', ...x });
const paidAll = (inv: Invoice): Invoice => ({ ...inv, payments: [{ id: 'p', amount: invoiceTotal(inv), date: inv.dueDate!, mode: 'upi', receiptNo: 'R' }] });

describe('bills and status', () => {
  it('the yearly bill shows 12 × monthly with the reduction and code discount', () => {
    const inv = invoiceFor(yr(), 'iy', 'now');
    expect(inv).toMatchObject({ items: [{ name: 'Yearly fee (12 × ₹1,000)', amount: 12000 }], discount: 2280, coupon: 'ANJA7K2Q', dueDate: '2026-10-20' });
    expect(invoiceTotal(inv)).toBe(9720);
    expect(inv.term).toBe('Yearly · 20 Oct 2026 – 19 Oct 2027');
    expect(invoiceTotal(invoiceFor(mo(), 'im', 'now'))).toBe(1000);
  });
  it('status of a record', () => {
    const inv = invoiceFor(mo(), 'im', 'now');
    expect(recordStatus(mo(), inv, '2026-10-01', 5)).toBe('upcoming');
    expect(recordStatus(mo(), inv, '2026-10-24', 5)).toBe('due');
    expect(recordStatus(mo(), inv, '2026-10-26', 5)).toBe('overdue');
    expect(recordStatus(mo(), { ...inv, payments: [{ id: 'p', amount: 300, date: '2026-10-20', mode: 'cash', receiptNo: 'R' }] }, '2026-10-26', 5)).toBe('partial');
    expect(recordStatus(mo(), paidAll(inv), '2026-12-26', 5)).toBe('paid');
  });
  it('paid-through, next start, overlap', () => {
    const m1 = mo(), m2 = mo({ id: 'm2', invoiceId: 'im2', start: '2026-11-20', end: '2026-12-19' });
    const invs = [paidAll(invoiceFor(m1, 'im', '')), invoiceFor(m2, 'im2', '')];
    expect(paidThrough('s1', [m1, m2], invs)).toBe('2026-11-19');
    expect(nextStart('s1', [m1, m2], '2026-11-01')).toBe('2026-12-20');
    expect(nextStart('s1', [m1], '2027-03-01')).toBe('2027-03-01');
    expect(overlaps('s1', [m1, m2], '2026-12-01', '2027-11-30')).toBe(true);
    expect(overlaps('s1', [m1, m2], '2026-12-20', '2027-12-19')).toBe(false);
  });
});

describe('access follows the paid period', () => {
  const m1 = mo();
  const plan = (invs: Invoice[]) => ({ records: [m1], graceDays: 5 });
  it('paid month + grace days open everything; then it lapses; unpaid plan = free part', () => {
    const paid = [paidAll(invoiceFor(m1, 'im', ''))];
    expect(accessOf({ id: 's1' }, paid, [], '2026-11-19', plan(paid))).toMatchObject({ status: 'enrolled', full: true, paidThrough: '2026-11-19', openUntil: '2026-11-24' });
    expect(accessOf({ id: 's1' }, paid, [], '2026-11-24', plan(paid)).full).toBe(true);
    expect(accessOf({ id: 's1' }, paid, [], '2026-11-25', plan(paid))).toEqual({ status: 'lapsed', full: false, paidThrough: '2026-11-19', openUntil: '2026-11-24' });
    expect(accessOf({ id: 's1' }, [invoiceFor(m1, 'im', '')], [], '2026-10-21', plan([]))).toEqual({ status: 'free', full: false });
    // a free seat never lapses; without plan records the old rule (first payment enrols) still holds
    expect(accessOf({ id: 's1', enrolled: { on: '2026-01-01', by: 'admin' } }, paid, [], '2027-05-01', plan(paid)).full).toBe(true);
    expect(accessOf({ id: 's2' }, [{ ...paid[0], studentId: 's2' }], [], '2030-01-01', plan(paid)).status).toBe('enrolled');
  });
});
