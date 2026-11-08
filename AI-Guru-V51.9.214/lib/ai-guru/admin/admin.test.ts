import { describe, it, expect } from 'vitest';
import { addressProblems, districtsOf, formatAddress, stateNames } from './address';
import { dashboardStats, cleanStudent, invoiceDue, invoiceStatus, invoiceTotal, itemsFor, paymentProblems, receiptNumber, summarise, csvOf, type Invoice } from './fees';

const inv = (over: Partial<Invoice> = {}): Invoice => ({ id: 'i', studentId: 's', term: 'T1', items: [{ name: 'Tuition', amount: 1500.5 }, { name: 'Exam', amount: 500 }], discount: 100, payments: [], createdAt: '', ...over });

describe('address', () => {
  it('knows states and their districts', () => {
    expect(stateNames()).toContain('Kerala');
    expect(districtsOf('Kerala')).toContain('Ernakulam');
  });
  it('checks the district belongs to the state and the PIN is 6 digits', () => {
    const a = { line1: 'Rose Villa', area: 'Perumbavoor', district: 'Ernakulam', state: 'Kerala', pincode: '683542' };
    expect(addressProblems(a)).toEqual([]);
    expect(addressProblems({ ...a, district: 'Chennai' }).join()).toMatch(/district of Kerala/);
    expect(addressProblems({ ...a, pincode: '0123' }).join()).toMatch(/PIN/);
    expect(addressProblems({ line1: '', area: '', district: '', state: 'Kerala', pincode: '' }, false)).toEqual([]);
    expect(formatAddress(a)).toBe('Rose Villa, Perumbavoor, Ernakulam, Kerala, 683542');
  });
});

describe('fees', () => {
  it('totals, due and status', () => {
    expect(invoiceTotal(inv())).toBe(1900.5);
    expect(invoiceDue(inv())).toBe(1900.5);
    expect(invoiceStatus(inv(), '2026-01-01')).toBe('pending');
    const part = inv({ payments: [{ id: 'p', amount: 900.5, date: '2026-01-01', mode: 'cash', receiptNo: 'r' }] });
    expect(invoiceDue(part)).toBe(1000);
    expect(invoiceStatus(part)).toBe('partial');
    expect(invoiceStatus({ ...part, dueDate: '2025-01-01' })).toBe('overdue');
    expect(invoiceStatus({ ...part, payments: [{ ...part.payments[0], amount: 1900.5 }], dueDate: '2025-01-01' })).toBe('paid');
  });
  it('no float drift and no overpayment', () => {
    const i = inv({ items: [{ name: 'a', amount: 0.1 }, { name: 'b', amount: 0.2 }], discount: 0 });
    expect(invoiceTotal(i)).toBe(0.3);
    expect(paymentProblems(i, 0.5, '2026-01-01').join()).toMatch(/more than/);
    expect(paymentProblems(i, 0.3, '2026-01-01')).toEqual([]);
    expect(paymentProblems(i, 0, '2026-01-01').length).toBe(1);
  });
  it('summary, heads for a standard, receipt number, csv', () => {
    const s = summarise([inv(), inv({ payments: [{ id: 'p', amount: 1900.5, date: 'd', mode: 'upi', receiptNo: 'r' }] })], '2026-01-01');
    expect(s).toMatchObject({ billed: 3801, collected: 1900.5, due: 1900.5, count: 2 });
    expect(itemsFor([{ id: '1', name: 'T', amount: 5, standard: 'all' }, { id: '2', name: 'L', amount: 7, standard: '8' }, { id: '3', name: 'X', amount: 9, standard: '9' }], '8').map((x) => x.name)).toEqual(['T', 'L']);
    expect(receiptNumber(42, 2026)).toBe('RCP-2026-00042');
    expect(csvOf([['a,b', 'c"d']])).toBe('"a,b","c""d"');
  });
  it('cleans a student and reports problems', () => {
    expect(cleanStudent({ name: ' ', standard: '' }).problems.length).toBe(2);
    const r = cleanStudent({ name: 'Anjali  Menon', standard: '8', guardianPhone: '98765 43210' });
    expect(r.problems).toEqual([]);
    expect(r.value.name).toBe('Anjali Menon');
    expect(cleanStudent({ name: 'A', standard: '8', school: '  GHSS   Perumbavoor ' }).value.school).toBe('GHSS Perumbavoor');
    expect(cleanStudent({ name: 'A', standard: '8', guardianPhone: '123' }).problems.join()).toMatch(/Phone/);
  });
});

describe('dashboard stats', () => {
  it('groups by standard, month and district', () => {
    const st = (id: string, standard: string, district: string) => ({ id, name: id, standard, admissionNo: '', guardianName: '', guardianPhone: '', address: { line1: district ? 'x' : '', area: 'a', district, state: 'Kerala', pincode: district ? '683542' : '' }, createdAt: '' });
    const students = [st('a', '8', 'Ernakulam'), st('b', '8', 'Idukki'), st('c', '9', '')];
    const invoices = [inv({ studentId: 'a', discount: 0, payments: [{ id: 'p', amount: 500, date: '2026-10-05', mode: 'cash', receiptNo: 'R2' }] }), inv({ studentId: 'c', discount: 0, payments: [{ id: 'q', amount: 100, date: '2026-09-01', mode: 'cash', receiptNo: 'R1' }] })];
    const d = dashboardStats(students, invoices, 3, new Date('2026-10-18T00:00:00Z'));
    expect(d.byStandard.map((r) => r.standard)).toEqual(['8', '9']);
    expect(d.byStandard[0]).toMatchObject({ collected: 500, due: 1500.5 });
    expect(d.monthly).toEqual([{ month: '2026-08', amount: 0 }, { month: '2026-09', amount: 100 }, { month: '2026-10', amount: 500 }]);
    expect(d.byDistrict[0].count).toBe(1);
    expect(d.recent[0].receiptNo).toBe('R2');
    expect(d.missingAddress).toBe(1);
  });
});
