// @vitest-environment node
/**
 * V51.9.190 — UPI payments confirmed automatically from the school's bank (alert e-mail / SMS, or the statement), only
 * when the UPI reference AND amount match; AI Guru's transaction ID; and "🎉 Congratulations" with the receipt in Messages.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseBankCredit, parseStatement } from './bank-alert';
import { txnIdFor } from './upi';

const HDFC_MAIL = 'Dear Customer, Rs.900.00 has been credited to your account **4321 by VPA arjun.parent@okaxis ARJUN NAIR on 03-11-26. Your UPI transaction reference number is 431209876543. Thank you for banking with us.';
const HDFC_SMS = 'Money Received - INR 1,250.50 Credited in HDFC Bank A/c XX4321 on 03-11-26 from VPA parent.x@ybl (UPI 512398765432)';

describe('reading the bank', () => {
  it('HDFC e-mail and SMS credits; a debit or an unclear reference is not read', () => {
    expect(parseBankCredit(HDFC_MAIL)).toEqual({ amount: 900, utr: '431209876543', vpa: 'arjun.parent@okaxis', at: '2026-11-03' });
    expect(parseBankCredit(HDFC_SMS)).toMatchObject({ amount: 1250.5, utr: '512398765432', vpa: 'parent.x@ybl' });
    expect(parseBankCredit('Rs.500.00 has been debited from account **4321 to VPA shop@okaxis. UPI ref 431209876543')).toBeNull();
    expect(parseBankCredit('Rs.500 credited. Numbers 111122223333 and 444455556666')).toBeNull();
    expect(parseBankCredit('Your statement is ready')).toBeNull();
  });
  it('an HDFC statement (CSV): UPI credits with their reference; withdrawals and non-UPI rows skipped', () => {
    const csv = [
      'Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance',
      '03/11/26,UPI-ARJUN NAIR-arjun.parent@okaxis-UTIB0000123-431209876543-AI Guru AGT,0000431209876543,03/11/26,,900.00,10900.00',
      '03/11/26,UPI-SHOP-shop@ybl-HDFC0000001-999988887777-pay,0000999988887777,03/11/26,200.00,,10700.00',
      '04/11/26,NEFT CR-SOMEONE,N123456789012345,04/11/26,,5000.00,15700.00',
    ].join('\n');
    expect(parseStatement(csv)).toEqual([expect.objectContaining({ amount: 900, utr: '431209876543', vpa: 'arjun.parent@okaxis', at: '2026-11-03' })]);
  });
  it('transaction IDs: AGT-yymmdd-XXXXX, the same all day for one choice', () => {
    const a = txnIdFor('stu_1', 'invoice', 'inv_1', '2026-11-03');
    expect(a).toMatch(/^AGT-261103-[2-9A-HJ-NP-Z]{5}$/);
    expect(txnIdFor('stu_1', 'invoice', 'inv_1', '2026-11-03')).toBe(a);
    expect(txnIdFor('stu_1', 'invoice', 'inv_2', '2026-11-03')).not.toBe(a);
  });
});

const R: Record<string, any> = {};
let ipN = 1;
const req = (body: unknown, cookie = '', h: Record<string, string> = {}) => new Request('http://x/a', { method: 'POST', headers: { cookie, 'x-forwarded-for': `64.0.0.${ipN++}`, 'content-type': 'application/json', ...h }, body: JSON.stringify(body) });
const get = (cookie = '', q = '') => new Request(`http://x/a${q}`, { headers: { cookie } });
const j = async (r: Response) => r.json();
const sess = (r: Response) => (r.headers.getSetCookie?.() ?? [r.headers.get('set-cookie') ?? '']).map((c) => c.split(';')[0]).filter((c) => /^aig_(student|admin)=/.test(c)).join('; ');
const SECRET = 's'.repeat(40);
const alertReq = (body: unknown, secret = SECRET) => req(body, '', { 'x-alert-secret': secret });

describe('end to end', () => {
  let admin = '', kid = '', kidId = '';
  const msgs = async () => {
    const { readThread } = await import('@/lib/ai-guru/messages/store');
    const { threadIdFor } = await import('@/lib/ai-guru/messages/core');
    return (await readThread(threadIdFor('student-admin', kidId)))?.messages ?? [];
  };
  const bill = async (id: string, amount: number) => { const { update } = await import('@/lib/ai-guru/admin/store'); await update((d) => { d.invoices.push({ id, studentId: kidId, term: `Term ${id}`, items: [{ name: 'Fee', amount }], discount: 0, dueDate: '2026-12-01', payments: [], createdAt: new Date().toISOString() }); }); };
  const pay = async (invoiceId: string, utr: string) => {
    const g = await j(await R.pay.GET(get(kid)));
    const o = g.options.find((x: any) => x.invoiceId === invoiceId);
    return j(await R.pay.POST(req({ kind: 'invoice', invoiceId, utr, txnId: o.txnId }, kid)));
  };

  beforeAll(async () => {
    process.chdir(mkdtempSync(path.join(tmpdir(), 'upi190-')));
    process.env.ADMIN_USERNAME = 'office'; process.env.ADMIN_PASSWORD = 'office-pass-2026';
    for (const [k, p] of Object.entries({ login: 'admin/login', upi: 'admin/upi', fees: 'admin/fees', reg: 'admin/registers', signup: 'student-portal/signup', me: 'student-portal/me', pay: 'student-portal/pay', alert: 'payments/bank-alert' })) R[k] = await import(`@/app/api/ai-guru/${p}/route`);
    admin = sess(await R.login.POST(req({ username: 'office', password: 'office-pass-2026' })));
    expect((await j(await R.upi.POST(req({ action: 'settings', vpa: 'manojkrish70@okhdfcbank', payee: 'Manoj Muthukrishnan' }, admin)))).ok).toBe(true);
    kid = sess(await R.signup.POST(req({ name: 'Arjun Nair', standard: '7', syllabus: 'kerala', medium: 'malayalam', school: 'GHSS Aluva', state: 'Kerala', district: 'Ernakulam', place: 'Aluva', password: 'secret1', confirm: 'secret1', motherTongue: 'Malayalam' })));
    kidId = (await j(await R.me.GET(get(kid)))).student.id;
  });

  it('the bank-alert door: missing without the secret setting; refuses a wrong secret', async () => {
    delete process.env.AI_GURU_BANK_ALERT_SECRET;
    expect((await R.alert.POST(alertReq({ text: HDFC_MAIL }))).status).toBe(404);
    process.env.AI_GURU_BANK_ALERT_SECRET = SECRET;
    expect((await R.alert.POST(alertReq({ text: HDFC_MAIL }, 'x'.repeat(40)))).status).toBe(401);
  });

  it('the QR carries AI Guru’s transaction ID; claim first, bank alert after → confirmed, with 🎉 Congratulations and the receipt', async () => {
    await bill('inv_a', 900);
    const g = await j(await R.pay.GET(get(kid)));
    const o = g.options.find((x: any) => x.invoiceId === 'inv_a');
    expect(o.txnId).toMatch(/^AGT-/);
    expect(decodeURIComponent(o.link)).toContain(`pa=manojkrish70@okhdfcbank`);
    expect(decodeURIComponent(o.link.replace(/\+/g, ' '))).toContain(`AI Guru ${o.txnId}`);
    const c = await pay('inv_a', '431209876543');
    expect(c.claim).toMatchObject({ status: 'waiting', txnId: o.txnId });
    const r = await j(await R.alert.POST(alertReq({ subject: 'You have received money', text: HDFC_MAIL })));
    expect(r.results[0]).toMatchObject({ utr: '431209876543', amount: 900, status: 'matched', confirmed: expect.stringMatching(/./) });
    const m = (await msgs()).find((x: any) => x.receipt);
    expect(m.text).toMatch(/^🎉 Congratulations, Arjun! Your payment of ₹900 for “Term inv_a” is successful\. All ten parts/);
    expect(m.text).not.toMatch(/thank/i);
    expect(m.receipt).toMatchObject({ amount: 900, txnId: o.txnId, utr: '431209876543', mode: 'UPI', student: 'Arjun Nair', forWhat: 'Term inv_a', balance: 0, confirmedBy: 'bank-alert', allOpen: true, paidTo: 'Manoj Muthukrishnan · manojkrish70@okhdfcbank' });
    // the same alert again changes nothing
    expect((await j(await R.alert.POST(alertReq({ text: HDFC_MAIL })))).results[0]).toMatchObject({ fresh: false });
    expect((await msgs()).filter((x: any) => x.receipt)).toHaveLength(1);
    // the Fees register shows it
    const fees = await j(await R.reg.GET(get(admin, '?sheet=fees')));
    expect(fees.rows[0]).toMatchObject({ amount: 900, mode: 'upi', txnId: o.txnId, utr: '431209876543', confirmedBy: 'bank-alert' });
  });

  it('bank alert first, claim after → confirmed at once', async () => {
    await bill('inv_b', 1250.5);
    expect((await j(await R.alert.POST(alertReq({ text: HDFC_SMS, source: 'sms' })))).results[0]).toMatchObject({ status: 'unmatched' });
    const c = await pay('inv_b', '512398765432');
    expect(c.claim).toMatchObject({ status: 'confirmed', confirmedBy: 'bank-alert' });
  });

  it('a different amount is never confirmed — the office sees why', async () => {
    await bill('inv_c', 700);
    await pay('inv_c', '600011112222');
    const r = await j(await R.alert.POST(alertReq({ text: 'Rs.70.00 has been credited to your account **4321 by VPA a@ybl on 03-11-26. Your UPI transaction reference number is 600011112222.' })));
    expect(r.results[0]).toMatchObject({ status: 'mismatch' });
    const u = await j(await R.upi.GET(get(admin)));
    expect(u.claims.find((x: any) => x.utr === '600011112222')).toMatchObject({ status: 'waiting', reason: expect.stringMatching(/bank shows ₹70/) });
  });

  it('a statement upload confirms; with automatic confirmation off it only marks the match', async () => {
    await bill('inv_d', 300);
    await pay('inv_d', '700022223333');
    const csv = 'Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance\n04/11/26,UPI-PARENT-p@okicici-ICIC0001-700022223333-fee,0000700022223333,04/11/26,,300.00,9000.00';
    expect(await j(await R.upi.POST(req({ action: 'statement', text: csv }, admin)))).toMatchObject({ ok: true, credits: 1, confirmed: 1 });
    expect((await j(await R.reg.GET(get(admin, '?sheet=fees')))).rows.find((x: any) => x.utr === '700022223333')).toMatchObject({ confirmedBy: 'statement' });
    // automatic off
    await R.upi.POST(req({ action: 'settings', vpa: 'manojkrish70@okhdfcbank', payee: 'Manoj Muthukrishnan', auto: false }, admin));
    await bill('inv_e', 450);
    await pay('inv_e', '800033334444');
    await R.alert.POST(alertReq({ text: 'Rs.450.00 has been credited to your account **4321 by VPA b@ybl on 04-11-26. Your UPI transaction reference number is 800033334444.' }));
    const u = await j(await R.upi.GET(get(admin)));
    expect(u.auto).toMatchObject({ on: false, alertsSetUp: true });
    expect(u.claims.find((x: any) => x.utr === '800033334444')).toMatchObject({ status: 'waiting' });
    expect(u.alerts.find((x: any) => x.utr === '800033334444')).toMatchObject({ status: 'matched', note: expect.stringMatching(/automatic confirmation is off/) });
    // the office confirms → the receipt goes too
    const id = u.claims.find((x: any) => x.utr === '800033334444').id;
    expect((await j(await R.upi.POST(req({ action: 'confirm', id }, admin)))).ok).toBe(true);
    expect((await msgs()).filter((x: any) => x.receipt?.utr === '800033334444')[0].receipt).toMatchObject({ confirmedBy: 'office' });
  });

  it('a payment at the counter also brings the receipt', async () => {
    await bill('inv_f', 200);
    expect((await j(await R.fees.POST(req({ action: 'pay', invoiceId: 'inv_f', amount: 200, date: '2026-11-03', mode: 'cash' }, admin)))).ok).toBe(true);
    const m = (await msgs()).filter((x: any) => x.receipt?.forWhat === 'Term inv_f');
    expect(m).toHaveLength(1);
    expect(m[0].receipt).toMatchObject({ mode: 'CASH', amount: 200 });
    expect(m[0].receipt.txnId).toBeUndefined();
  });
});
