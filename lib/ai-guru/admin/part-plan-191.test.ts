// @vitest-environment node
/**
 * V51.9.191 — paying by part: Part 1 free; ₹2,000 for each next part, or ₹7,000 for Parts 2–10 at once before any part
 * is paid; the first instalment due when the free trial ends; each paid part opens in every book, in order.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { cleanPartPlan, DEFAULT_PART_PLAN, openedParts, nextPartBill, paidPartsList, trialEndOf } from './part-plan';
import { lockedPartsOf } from '../material-studio/locks';
import type { Invoice } from './fees';

const bill = (part: number, paid = 0, extra: Partial<Invoice> = {}): Invoice => ({ id: `i${part}`, studentId: 's', term: `Part ${part}`, items: [{ name: 'x', amount: 2000 }], discount: 0, payments: paid ? [{ id: `p${part}`, amount: paid, date: '2026-11-10', mode: 'upi', receiptNo: `R${part}` }] : [], createdAt: '', partBill: { part }, ...extra });

describe('rules (pure)', () => {
  it('trial end, paid parts, opened parts in order, next bill, all-at-once only before any part is paid', () => {
    expect(paidPartsList([1])).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(trialEndOf('2026-11-01', { trialDays: 7 })).toBe('2026-11-07'); // V51.9.195: the last free day (day 7), as for free doubts
    const bills = [bill(2, 2000), bill(3, 500), bill(4), bill(5)];
    expect(openedParts('s', bills, [1])).toEqual([2]);
    expect(nextPartBill('s', bills)).toMatchObject({ next: { id: 'i3' }, upfrontOk: false });
    expect(nextPartBill('s', [bill(2), bill(3), bill(4), bill(5)])).toMatchObject({ next: { id: 'i2' }, upfrontOk: true });
    const all: Invoice = { ...bill(0, 7000), id: 'all', partBill: { all: true }, items: [{ name: 'x', amount: 7000 }] };
    expect(openedParts('s', [all], [1])).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
  it('a paid part opens in every book, beside the book’s own free parts', () => {
    expect(lockedPartsOf({}, [1], false, [2])).toEqual({ freeParts: [1, 2], lockedParts: [3, 4, 5, 6, 7, 8, 9, 10] });
    expect(lockedPartsOf({ freeParts: [1, 3] }, [1], false, [2])).toEqual({ freeParts: [1, 2, 3], lockedParts: [4, 5, 6, 7, 8, 9, 10] });
  });
  it('settings are checked', () => {
    expect(cleanPartPlan({ ...DEFAULT_PART_PLAN, enabled: true }, 9)).toEqual({ ...DEFAULT_PART_PLAN, enabled: true });
    expect(cleanPartPlan({ months: ['June'] }, 9)).toMatch(/Link each of the 10 parts/);
    expect(cleanPartPlan({ upfrontPrice: 9000 }, 9)).toMatch(/not be more than 9 × the part price/);
    expect(cleanPartPlan({ trialDays: 91 }, 9)).toMatch(/between 0 and 90/);
    expect(cleanPartPlan({ partPrice: 0 }, 9)).toMatch(/price of a part/);
  });
});

const R: Record<string, any> = {};
let ipN = 1;
const req = (body: unknown, cookie = '') => new Request('http://x/a', { method: 'POST', headers: { cookie, 'x-forwarded-for': `65.0.0.${ipN++}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const get = (cookie = '', q = '') => new Request(`http://x/a${q}`, { headers: { cookie } });
const j = async (r: Response) => r.json();
const sess = (r: Response) => (r.headers.getSetCookie?.() ?? [r.headers.get('set-cookie') ?? '']).map((c) => c.split(';')[0]).filter((c) => /^aig_(student|admin)=/.test(c)).join('; ');

describe('end to end', () => {
  let admin = '';
  const signup = async (name: string) => { const c = sess(await R.signup.POST(req({ name, standard: '8', syllabus: 'kerala', medium: 'malayalam', school: 'GHSS', state: 'Kerala', district: 'Ernakulam', place: 'Aluva', password: 'secret1', confirm: 'secret1', motherTongue: 'Malayalam' }))); return { c, id: (await j(await R.me.GET(get(c)))).student.id as string }; };
  const locked = async (c: string) => (await j(await R.lib.GET(get(c)))).books.find((b: any) => b.id === 'doc:k8').parts.filter((p: any) => p.locked).map((p: any) => p.index);
  const payUpi = async (c: string, pick: (o: any) => boolean, utr: string) => {
    const o = (await j(await R.pay.GET(get(c)))).options.find(pick);
    const cl = await j(await R.pay.POST(req({ kind: o.kind, invoiceId: o.invoiceId, utr, txnId: o.txnId }, c)));
    expect(cl.ok).toBe(true);
    return j(await R.upi.POST(req({ action: 'confirm', id: cl.claim.id }, admin)));
  };

  beforeAll(async () => {
    process.chdir(mkdtempSync(path.join(tmpdir(), 'parts191-')));
    process.env.ADMIN_USERNAME = 'office'; process.env.ADMIN_PASSWORD = 'office-pass-2026';
    for (const [k, p] of Object.entries({ login: 'admin/login', enrol: 'admin/enrolment', upi: 'admin/upi', fees: 'admin/fees', all: 'admin/all-settings', signup: 'student-portal/signup', me: 'student-portal/me', pay: 'student-portal/pay', lib: 'student-portal/library' })) R[k] = await import(`@/app/api/ai-guru/${p}/route`);
    const { sampleBook } = await import('../material-studio/locks.fixtures');
    const store = await import('../material-studio/store');
    const { PDFDocument } = await import('pdf-lib');
    const pdf = await PDFDocument.create(); for (let p = 0; p < 50; p++) pdf.addPage([200, 200]);
    await store.saveDocument({ ...sampleBook(), id: 'doc:k8', syllabus: 'kerala', grade: '8', owner: { kind: 'admin' } }, Buffer.from(await pdf.save()));
    admin = sess(await R.login.POST(req({ username: 'office', password: 'office-pass-2026' })));
    await R.upi.POST(req({ action: 'settings', vpa: 'manojkrish70@okhdfcbank', payee: 'Manoj Muthukrishnan' }, admin));
  });

  it('the office switches the part plan on (the lock comes on with it)', async () => {
    const r = await j(await R.enrol.POST(req({ action: 'settings', access: { enabled: false, freeParts: [1], partPlan: { enabled: true, partPrice: 2000, upfrontPrice: 7000, trialDays: 7 } } }, admin)));
    expect(r.settings).toMatchObject({ enabled: true, partPlan: { enabled: true, partPrice: 2000, upfrontPrice: 7000 } });
    expect((await j(await R.all.GET(get(admin)))).access.partPlan).toMatchObject({ enabled: true, trialDays: 7 });
  });

  it('a new student: Part 1 free; Parts 2–10 are monthly bills with no due date; pays July → Part 2 opens in every book; then Part 3 is next', async () => {
    const a = await signup('Anu Varghese');
    const { readData } = await import('./store');
    const bills = (await readData()).invoices.filter((i) => i.studentId === a.id).sort((x, y) => x.partBill!.part! - y.partBill!.part!);
    const months = ['June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
    expect(bills.map((b) => [b.term, b.items[0].amount, b.dueDate])).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10].map((p) => [`Part ${p} · ${months[p - 1]}`, 2000, undefined]));
    const opts = (await j(await R.pay.GET(get(a.c)))).options;
    expect(opts.map((o: any) => [o.kind, o.label, o.amount])).toEqual([['invoice', 'Part 2 · July of every book', 2000], ['parts-all', 'Parts 2–10 (all at once) — save ₹11,000', 7000]]);
    expect((await j(await R.me.GET(get(a.c)))).access.partPlan).toMatchObject({ opened: [], next: { part: 2, amount: 2000, month: 'July' }, upfront: { amount: 7000, saves: 11000 }, total: 18000 });
    expect(await locked(a.c)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect((await payUpi(a.c, (o) => o.kind === 'invoice', '100000000002')).ok).toBe(true);
    expect(await locked(a.c)).toEqual([3, 4, 5, 6, 7, 8, 9, 10]);
    const me = await j(await R.me.GET(get(a.c)));
    expect(me.access).toMatchObject({ full: false, partPlan: { opened: [2], next: { part: 3 }, upfront: null } });
    expect((await j(await R.pay.GET(get(a.c)))).options.map((o: any) => o.label)).toEqual(['Part 3 · August of every book']);
    for (const n of [3, 4, 5, 6, 7, 8, 9, 10]) { expect((await payUpi(a.c, (o) => o.label === `Part ${n} · ${months[n - 1]} of every book`, `1000000000${String(n).padStart(2, '0')}`)).ok).toBe(true); }
    expect(await locked(a.c)).toEqual([]);
    expect((await j(await R.me.GET(get(a.c)))).access).toMatchObject({ full: true, partPlan: { allPaid: true } });
  });

  it('all at once by UPI: ₹7,000 replaces the part bills and opens Parts 2–10', async () => {
    const b = await signup('Bilal Khan');
    const r = await payUpi(b.c, (o) => o.kind === 'parts-all', '200000000001');
    expect(r.ok).toBe(true);
    const { readData } = await import('./store');
    const mine = (await readData()).invoices.filter((i) => i.studentId === b.id);
    expect(mine.map((i) => [i.term, i.items[0].amount, i.payments.length])).toEqual([['Parts 2–10 (all at once)', 7000, 1]]);
    expect(await locked(b.c)).toEqual([]);
  });

  it('all at once at the counter; never after a part is paid', async () => {
    const c = await signup('Cyril Joseph');
    expect((await j(await R.fees.POST(req({ action: 'partsUpfront', studentId: c.id, date: '2026-11-03', mode: 'cash' }, admin)))).ok).toBe(true);
    expect(await locked(c.c)).toEqual([]);
    const d = await signup('Divya Menon');
    await payUpi(d.c, (o) => o.kind === 'invoice', '300000000002');
    const late = await j(await R.fees.POST(req({ action: 'partsUpfront', studentId: d.id, date: '2026-11-03', mode: 'cash' }, admin)));
    expect(late).toMatchObject({ ok: false, error: expect.stringMatching(/only before the first part is paid/) });
  });
});
