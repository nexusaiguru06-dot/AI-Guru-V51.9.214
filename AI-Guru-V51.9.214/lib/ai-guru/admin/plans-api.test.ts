// @vitest-environment node
/** V51.9.94: yearly and monthly registers through the admin API, payments through Fees, access through the book routes. */
import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { sampleBook } from '../material-studio/locks.fixtures';

let admin = '';
const R: Record<string, any> = {};
const req = (body: unknown, cookie = '', ip = '1.1.1.1') => new Request('http://x/a', { method: 'POST', headers: { cookie, 'x-forwarded-for': ip, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const get = (cookie = '', q = '') => new Request(`http://x/a${q}`, { headers: { cookie } });
const j = async (r: Response) => r.json();
const cookieOf = (r: Response) => r.headers.get('set-cookie')!.split(';')[0];
const form = (name: string, extra = {}) => ({ name, standard: '8', school: 'GHSS', state: 'Kerala', district: 'Ernakulam', place: 'Aluva', password: 'secret1', confirm: 'secret1', ...extra });
const id = () => ({ params: Promise.resolve({ id: 'doc:test' }) });
let ip = 10;
const today = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

beforeAll(async () => {
  process.chdir(mkdtempSync(path.join(tmpdir(), 'plans-')));
  process.env.ADMIN_USERNAME = 'boss'; process.env.ADMIN_PASSWORD = 'correct-horse-battery';
  for (const [k, p] of Object.entries({ login: 'admin/login', fees: 'admin/fees', enrol: 'admin/enrolment', plans: 'admin/plans', students: 'admin/students', signup: 'student-portal/signup', me: 'student-portal/me', sources: 'material-studio/sources/[id]' })) R[k] = await import(`@/app/api/ai-guru/${p}/route`);
  R.store = await import('@/lib/ai-guru/admin/store');
  const store = await import('@/lib/ai-guru/material-studio/store');
  const pdf = await PDFDocument.create(); for (let p = 0; p < 50; p++) pdf.addPage([200, 200]);
  await store.saveDocument(sampleBook(), Buffer.from(await pdf.save()));
  admin = cookieOf(await R.login.POST(req({ username: 'boss', password: 'correct-horse-battery' })));
  await R.enrol.POST(req({ action: 'settings', access: { enabled: true, freeParts: [1] } }, admin));
});

describe('monthly and yearly registers', () => {
  it('admin sets the monthly fee and the yearly reduction', async () => {
    expect((await R.plans.POST(req({ action: 'settings', plans: { prices: [{ standard: '8', monthly: 1000 }], yearlyReductionPct: 95, graceDays: 5 } }, admin))).status).toBe(400);
    const r = await j(await R.plans.POST(req({ action: 'settings', plans: { prices: [{ standard: '8', monthly: 1000 }, { standard: 'all', monthly: 800 }], yearlyReductionPct: 15, graceDays: 5 } }, admin)));
    expect(r.prices[0]).toEqual({ standard: '8', monthly: 1000, twelveMonths: 12000, yearly: 10200, saving: 1800 });
    expect((await R.plans.POST(req({ action: 'settings', plans: { prices: [] } }))).status).toBe(404); // admin only
  });

  it('yearly: friend’s student pays 12 months less 15% less 10% → every part opens; friend earns commission', async () => {
    const a = await R.signup.POST(req(form('Anjali Menon'), '', `30.0.0.${ip++}`));
    const code = (await j(await R.me.GET(get(cookieOf(a))))).affiliate.code;
    const b = await R.signup.POST(req(form('Arjun Nair', { coupon: code, fromLink: true }), '', `30.0.0.${ip++}`));
    const c = cookieOf(b);
    const me = await j(await R.me.GET(get(c)));
    expect(me.access).toMatchObject({ status: 'free', offer: { monthly: 900, yearly: 9180, yearlyReductionPct: 15 } });
    expect((await j(await R.sources.GET(get(c), id()))).document.access).toMatchObject({ full: false, monthly: 900, yearly: 9180 });

    const made = await j(await R.plans.POST(req({ action: 'yearly', studentId: me.student.id }, admin)));
    expect(made.record).toMatchObject({ kind: 'yearly', start: today(), gross: 12000, reductionPct: 15, reduction: 1800, couponDiscount: 1020, total: 9180 });
    // a second plan over the same days is refused
    expect((await R.plans.POST(req({ action: 'monthly', studentId: me.student.id, start: today() }, admin))).status).toBe(400);
    // the bill is an ordinary fee bill; paying it in full opens every part
    const g = await j(await R.plans.GET(get(admin)));
    const row = g.yearly[0];
    expect(row).toMatchObject({ status: 'due', invoice: { total: 9180, due: 9180 } });
    const pay = await j(await R.fees.POST(req({ action: 'pay', invoiceId: row.invoiceId, amount: 9180, date: today(), mode: 'upi' }, admin)));
    expect(pay.payment.commission).toMatchObject({ amount: 918 });
    expect((await j(await R.sources.GET(get(c), id()))).document.access.full).toBe(true);
    const after = await j(await R.plans.GET(get(admin)));
    expect(after.yearly[0].status).toBe('paid');
    expect(after.totals.yearly).toMatchObject({ activeStudents: 1, collected: 9180, reductionGiven: 1800 });
    expect((await j(await R.me.GET(get(c)))).access).toMatchObject({ status: 'enrolled', paidThrough: after.yearly[0].end });
    // a paid record cannot be removed; its bill cannot be removed in Fees either
    expect((await R.plans.POST(req({ action: 'remove', register: 'yearly', id: row.id }, admin))).status).toBe(409);
    expect((await R.fees.POST(req({ action: 'removeInvoice', id: row.invoiceId }, admin))).status).toBe(409);
    expect(await (await R.plans.GET(get(admin, '?format=csv&register=yearly'))).text()).toContain('Arjun Nair');
  });

  it('monthly: a paid month opens, lapses after the grace days, next month’s bill re-opens', async () => {
    const s = await R.signup.POST(req(form('Diya Das', { standard: '9' }), '', `30.0.0.${ip++}`));
    const c = cookieOf(s);
    const sid = (await j(await R.me.GET(get(c)))).student.id;
    // started 40 days ago: its month ended ~10 days ago, past the 5 grace days
    const start = new Date(Date.now() + 5.5 * 3600_000 - 40 * 86_400_000).toISOString().slice(0, 10);
    const m = await j(await R.plans.POST(req({ action: 'monthly', studentId: sid, start }, admin)));
    expect(m.record).toMatchObject({ kind: 'monthly', monthlyRate: 800, total: 800 });
    expect((await j(await R.plans.GET(get(admin)))).monthly.find((r: any) => r.id === m.record.id).status).toBe('overdue');
    await R.fees.POST(req({ action: 'pay', invoiceId: m.record.invoiceId, amount: 800, date: start, mode: 'cash' }, admin));
    expect((await j(await R.me.GET(get(c)))).access).toMatchObject({ status: 'lapsed', paidThrough: m.record.end });
    expect((await j(await R.sources.GET(get(c), id()))).document.access).toMatchObject({ full: false, why: 'lapsed' });
    expect((await j(await R.enrol.GET(get(admin)))).totals.lapsed).toBe(1);
    // next month's bill starts the day after the last one; paying it re-opens... only once it covers today
    const nm = await j(await R.plans.POST(req({ action: 'nextMonth' }, admin)));
    expect(nm.made).toBe(1);
    const rows = (await j(await R.plans.GET(get(admin)))).monthly.filter((r: any) => r.studentId === sid).sort((a: any, b: any) => a.start.localeCompare(b.start));
    expect(rows[1].start > rows[0].end).toBe(true);
    await R.fees.POST(req({ action: 'pay', invoiceId: rows[1].invoiceId, amount: 800, date: today(), mode: 'upi' }, admin));
    expect((await j(await R.sources.GET(get(c), id()))).document.access.full).toBe(true);
    // an unpaid month can be removed (and its bill with it)
    const extra = await j(await R.plans.POST(req({ action: 'monthly', studentId: sid }, admin)));
    expect((await R.plans.POST(req({ action: 'remove', register: 'monthly', id: extra.record.id }, admin))).status).toBe(200);
    expect((await j(await R.fees.GET(get(admin)))).invoices.some((i: any) => i.id === extra.record.invoiceId)).toBe(false);
  });

  it('a standard without a monthly fee cannot get a plan', async () => {
    await R.plans.POST(req({ action: 'settings', plans: { prices: [{ standard: '8', monthly: 1000 }], yearlyReductionPct: 15, graceDays: 5 } }, admin));
    const s = await R.signup.POST(req(form('Meera P', { standard: '10' }), '', `30.0.0.${ip++}`));
    const sid = (await j(await R.me.GET(get(cookieOf(s))))).student.id;
    const r = await R.plans.POST(req({ action: 'yearly', studentId: sid }, admin));
    expect(r.status).toBe(400);
    expect((await j(r)).error).toMatch(/monthly fee for Std 10/);
  });
});
