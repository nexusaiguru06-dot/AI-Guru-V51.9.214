// @vitest-environment node
/**
 * V51.9.195 — the fixes from the Elephant–Goldfish review of V51.9.186–194 (docs/reviews/2026-11-03-today/).
 *  Blockers: a school teacher's sign-in no longer passes the class-teacher gates; students who paid the old way are not
 *  locked when paying by part is switched on; the receipt says exactly which part opened and what is still to pay; a
 *  free doubt that never started is not counted.
 *  Major: a mismatched amount needs the office's clear yes; a failed ₹7,000 confirmation changes nothing; one claim per
 *  UPI reference; the bank parser refuses mandates / requests / reversals and bare numbers; one trial; exam time and
 *  answers kept by the server; a school-wide cap on free doubts.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseBankCredit } from './payments/bank-alert';
import { paidOldWay, trialEndOf } from './admin/part-plan';
import { doubtWindow } from './doubt/school-key';
import { answersShown, examSecondsLeft } from './schools/rules';
import { receiptRows } from './messages/receipt-card';

describe('pure rules', () => {
  it('the bank parser: no mandates, requests, reversals, refunds, failures; no bare 12-digit guess', () => {
    const ok = 'Dear Customer, Rs.900.00 has been credited to your account **4321 by VPA a.p@okaxis on 03-11-26. Your UPI transaction reference number is 431209876543.';
    expect(parseBankCredit(ok)).toMatchObject({ amount: 900, utr: '431209876543' });
    expect(parseBankCredit('UPI mandate of Rs.900 will be credited to your account. UPI ref no 431209876543')).toBeNull();
    expect(parseBankCredit('Collect request: Rs.900 requested from your account. UPI ref no 431209876543')).toBeNull();
    expect(parseBankCredit('Reversal: Rs.900 credited to your account. UPI ref no 431209876543')).toBeNull();
    expect(parseBankCredit('Refund of Rs.900 credited to your account. UPI ref no 431209876543')).toBeNull();
    expect(parseBankCredit('Rs.900 credited to your account on 03-11-26. 431209876543')).toBeNull(); // bare number
    expect(parseBankCredit('You received a payment request of Rs.900. UPI ref no 431209876543')).toBeNull();
    expect(parseBankCredit('Rs.900 received in your A/c XX4321. UPI Ref No 431209876543')).toMatchObject({ amount: 900 });
  });

  it('one trial: Part 2 is due on the last free day, the same day the free doubts end; paying does not end them', () => {
    expect(trialEndOf('2026-11-01', { trialDays: 7 })).toBe('2026-11-07');
    expect(doubtWindow('2026-11-01T06:00:00Z', 7, '2026-11-01').until).toBe('2026-11-07');
    expect(doubtWindow('2026-11-01T06:00:00Z', 7, '2026-11-03', true)).toMatchObject({ open: true });
  });

  it('old-way payers: a paid bill that is not a part bill', () => {
    const base = { id: 'i1', studentId: 's1', term: 'Term 1', items: [{ name: 'Fee', amount: 900 }], discount: 0, createdAt: '' };
    const paid = [{ id: 'p', amount: 900, date: '2026-10-01', mode: 'cash', receiptNo: 'R1' }];
    expect(paidOldWay('s1', [{ ...base, payments: paid } as any])).toBe(true);
    expect(paidOldWay('s1', [{ ...base, payments: [] } as any])).toBe(false);
    expect(paidOldWay('s1', [{ ...base, partBill: { part: 2 }, payments: paid } as any])).toBe(false);
  });

  it('exams: the clock from the server start; answers only once closed', () => {
    const start = '2026-11-03T10:00:00Z';
    expect(examSecondsLeft(start, 20, Date.parse('2026-11-03T10:05:00Z'))).toBe(900);
    expect(examSecondsLeft(start, 20, Date.parse('2026-11-03T11:00:00Z'))).toBe(0);
    expect(answersShown({ closes: '2026-11-05' }, '2026-11-05')).toBe(false);
    expect(answersShown({ closes: '2026-11-05' }, '2026-11-06')).toBe(true);
    expect(answersShown({ closes: '2026-11-05', closed: true }, '2026-11-04')).toBe(true);
  });

  it('the receipt after one part: what opened and what is still to pay, never "all parts"', () => {
    const rows = receiptRows({ receiptNo: 'R-1', date: '2026-11-03', student: 'Anu', forWhat: 'Part 2', mode: 'UPI', total: 1800, balance: 0, amount: 1800, school: 'AI Guru', opened: 'Part 2', stillToPay: { parts: 'Parts 3, 4, 5', amount: 5400 } } as any);
    const text = rows.map((r) => r.join(': ')).join('\n');
    expect(text).toMatch(/Now open: Part 2 of every book/);
    expect(text).toMatch(/Still to pay: Parts 3, 4, 5: ₹5,400\.00/);
    expect(text).toMatch(/Nil — this bill is paid/);
    expect(text).not.toMatch(/fully paid|All five/);
  });
});

const R: Record<string, any> = {};
let ipN = 1;
const req = (body: unknown, cookie = '', h: Record<string, string> = {}) => new Request('http://x/a', { method: 'POST', headers: { cookie, 'x-forwarded-for': `65.0.0.${ipN++}`, 'content-type': 'application/json', ...h }, body: JSON.stringify(body) });
const get = (cookie = '', q = '') => new Request(`http://x/a${q}`, { headers: { cookie } });
const j = async (r: Response) => r.json();
const sess = (r: Response) => (r.headers.getSetCookie?.() ?? [r.headers.get('set-cookie') ?? '']).map((c) => c.split(';')[0]).filter((c) => /^aig_(student|admin)=/.test(c)).join('; ');
const SECRET = 's'.repeat(40);
const KEY = 'AIza' + 'k'.repeat(35);
const person = (name: string) => ({ name, standard: '8', syllabus: 'kerala', medium: 'malayalam', school: 'GHSS Aluva', state: 'Kerala', district: 'Ernakulam', place: 'Aluva', password: 'secret1', confirm: 'secret1', motherTongue: 'Malayalam' });

describe('end to end', () => {
  let admin = '';
  const signup = async (name: string) => { const c = sess(await R.signup.POST(req(person(name)))); return { c, id: (await j(await R.me.GET(get(c)))).student.id as string }; };
  const store = () => import('./admin/store');

  beforeAll(async () => {
    process.chdir(mkdtempSync(path.join(tmpdir(), 'fix195-')));
    process.env.ADMIN_USERNAME = 'office'; process.env.ADMIN_PASSWORD = 'office-pass-2026';
    process.env.AI_GURU_BANK_ALERT_SECRET = SECRET;
    for (const [k, p] of Object.entries({ login: 'admin/login', upi: 'admin/upi', enrol: 'admin/enrolment', alib: 'admin/library', signup: 'student-portal/signup', me: 'student-portal/me', pay: 'student-portal/pay', alert: 'payments/bank-alert', dk: 'student-portal/doubt-key', progress: 'progress', qsets: 'question-sets' })) R[k] = await import(`@/app/api/ai-guru/${p}/route`);
    R.key = await import('./doubt/school-key');
    R.auth = await import('./admin/auth');
    admin = sess(await R.login.POST(req({ username: 'office', password: 'office-pass-2026' })));
    expect((await j(await R.upi.POST(req({ action: 'settings', vpa: 'manojkrish70@okhdfcbank', payee: 'Manoj Muthukrishnan' }, admin)))).ok).toBe(true);
  });

  it('a school teacher\'s sign-in is not a class teacher\'s: the progress and question-set doors stay shut', async () => {
    const tch = await R.auth.makeTeacherSession('sch:tst_1');
    const cookie = `${R.auth.TEACHER_COOKIE}=${tch.value}`;
    expect(await R.auth.teacherFromRequest(get(cookie))).toBeNull();
    expect(await R.auth.teacherSessionValue(get(cookie))).toBe('sch:tst_1');
    const cls = await R.auth.makeTeacherSession('cls_1');
    expect(await R.auth.teacherFromRequest(get(`${R.auth.TEACHER_COOKIE}=${cls.value}`))).toBe('cls_1');
    for (const route of [R.progress, R.qsets]) {
      if (typeof route.GET !== 'function') continue;
      const r = await route.GET(get(cookie));
      expect([401, 403, 404]).toContain(r.status);
    }
  });

  it('a mismatched amount: the office must say yes twice; the alert is then settled', async () => {
    const kid = await signup('Arjun Nair');
    const { update } = await store();
    await update((d) => { d.invoices.push({ id: 'inv_mm', studentId: kid.id, term: 'Term 1', items: [{ name: 'Fee', amount: 900 }], discount: 0, dueDate: '2026-12-01', payments: [], createdAt: new Date().toISOString() }); });
    const o = (await j(await R.pay.GET(get(kid.c)))).options.find((x: any) => x.invoiceId === 'inv_mm');
    const claim = await j(await R.pay.POST(req({ kind: 'invoice', invoiceId: 'inv_mm', utr: '111122223333', txnId: o.txnId }, kid.c)));
    expect(claim.ok).toBe(true);
    await R.alert.POST(req({ text: 'Rs.800.00 has been credited to your account **4321 by VPA a@okaxis on 03-11-26. UPI ref no 111122223333' }, '', { 'x-alert-secret': SECRET }));
    const id = (await j(await R.upi.GET(get(admin)))).claims.find((c: any) => c.utr === '111122223333').id;
    const first = await j(await R.upi.POST(req({ action: 'confirm', id }, admin)));
    expect(first).toMatchObject({ ok: false, error: expect.stringMatching(/^MISMATCH: the bank shows ₹800/) });
    const second = await j(await R.upi.POST(req({ action: 'confirm', id, acceptMismatch: true }, admin)));
    expect(second).toMatchObject({ ok: true, claim: { status: 'confirmed' } });
    const alerts = (await j(await R.upi.GET(get(admin)))).alerts;
    expect(alerts.find((a: any) => a.utr === '111122223333')).toMatchObject({ status: 'matched', note: expect.stringMatching(/accepted a different amount/) });
  });

  it('one claim per UPI reference, even when two are sent at the same moment', async () => {
    const kid = await signup('Bina Thomas');
    const { update } = await store();
    await update((d) => { for (const id of ['inv_a', 'inv_b']) d.invoices.push({ id, studentId: kid.id, term: id, items: [{ name: 'Fee', amount: 500 }], discount: 0, dueDate: '2026-12-01', payments: [], createdAt: new Date().toISOString() }); });
    const opts = (await j(await R.pay.GET(get(kid.c)))).options;
    const send = (inv: string) => R.pay.POST(req({ kind: 'invoice', invoiceId: inv, utr: '222233334444', txnId: opts.find((x: any) => x.invoiceId === inv).txnId }, kid.c)).then(j);
    const both = await Promise.all([send('inv_a'), send('inv_b')]);
    expect(both.filter((x: any) => x.ok)).toHaveLength(1);
    // rejected → the reference is free again
    const id = (await j(await R.upi.GET(get(admin)))).claims.find((c: any) => c.utr === '222233334444').id;
    expect((await j(await R.upi.POST(req({ action: 'reject', id, reason: 'not found' }, admin)))).ok).toBe(true);
    const again = both.find((x: any) => x.ok).claim?.invoiceId === 'inv_a' ? 'inv_b' : 'inv_a';
    expect((await send(again)).ok).toBe(true);
  });

  it('paying all at once: if the price changed, confirming fails and the part bills stay as they were', async () => {
    expect((await j(await R.enrol.POST(req({ action: 'settings', access: { enabled: true, freeParts: [1], partPlan: { enabled: true, partPrice: 2000, upfrontPrice: 7000, trialDays: 7 } } }, admin)))).ok).toBe(true);
    const kid = await signup('Chinnu Mathew');
    const o = (await j(await R.pay.GET(get(kid.c)))).options.find((x: any) => x.kind === 'parts-all');
    expect(o.amount).toBe(7000);
    expect((await j(await R.pay.POST(req({ kind: 'parts-all', utr: '333344445555', txnId: o.txnId }, kid.c)))).ok).toBe(true);
    await R.enrol.POST(req({ action: 'settings', access: { enabled: true, freeParts: [1], partPlan: { enabled: true, partPrice: 2000, upfrontPrice: 6500, trialDays: 7 } } }, admin));
    const id = (await j(await R.upi.GET(get(admin)))).claims.find((c: any) => c.utr === '333344445555').id;
    const r = await j(await R.upi.POST(req({ action: 'confirm', id }, admin)));
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/all-at-once price is now ₹6500/) });
    const bills = (await (await store()).readData()).invoices.filter((i) => i.studentId === kid.id);
    expect(bills.map((b) => b.term).sort()).toEqual(['Part 10 · March', 'Part 2 · July', 'Part 3 · August', 'Part 4 · September', 'Part 5 · October', 'Part 6 · November', 'Part 7 · December', 'Part 8 · January', 'Part 9 · February']);
    expect(bills.some((b) => b.partBill?.all)).toBe(false);
  });

  it('switching the part plan on does not lock a student who paid the old way', async () => {
    const kid = await signup('Deepa Raj');
    const { update } = await store();
    await update((d) => { d.invoices.push({ id: 'inv_old', studentId: kid.id, term: 'Term 1', items: [{ name: 'Fee', amount: 900 }], discount: 0, payments: [{ id: 'pay_old', amount: 900, date: '2026-10-01', mode: 'cash', receiptNo: 'R-OLD' } as any], createdAt: new Date().toISOString() }); const s = d.students.find((x) => x.id === kid.id)!; s.enrolled = { on: '2026-10-01', by: 'payment' }; });
    const me = await j(await R.me.GET(get(kid.c)));
    expect(me.access.full).toBe(true);
    expect(me.access.partPlan).toBeUndefined();
    await R.enrol.POST(req({ action: 'settings', access: { enabled: true, freeParts: [1], partPlan: { enabled: false, partPrice: 2000, upfrontPrice: 7000, trialDays: 7 } } }, admin));
  });

  it('a free doubt that could not start is not counted; the school-wide cap', async () => {
    const kid = await signup('Esha Pillai');
    expect((await j(await R.alib.POST(req({ action: 'settings', library: { cloudKey: KEY, dailyLimit: 5, trialDoubts: { days: 7, perDay: 2, minutes: 8, afterPerDay: 0, afterMinutes: 5, schoolPerDay: 0 } } }, admin)))).ok).toBe(true);
    R.key.setMint(async () => { throw new Error('Google is down'); });
    expect((await R.dk.POST(req({}, kid.c))).status).toBe(502);
    expect((await j(await R.dk.GET(get(kid.c)))).used).toBe(0);
    R.key.setMint(async () => 'auth_tokens/x');
    expect((await j(await R.dk.POST(req({}, kid.c)))).ok).toBe(true);
    // the whole school's free sessions for today are used up
    await R.alib.POST(req({ action: 'settings', library: { cloudKey: KEY, dailyLimit: 5, trialDoubts: { days: 7, perDay: 2, minutes: 8, afterPerDay: 0, afterMinutes: 5, schoolPerDay: 1 } } }, admin));
    const capped = await R.dk.POST(req({}, kid.c));
    expect(capped.status).toBe(429);
    expect((await j(capped)).error).toMatch(/free doubt sessions on AI Guru's key are all used up/);
    expect((await j(await R.dk.GET(get(kid.c)))).used).toBe(1); // the student's own count was given back
    R.key.setMint(null);
  });
});
