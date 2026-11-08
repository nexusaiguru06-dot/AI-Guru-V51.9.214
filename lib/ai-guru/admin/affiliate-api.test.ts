// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

let admin = '';
const R: Record<string, any> = {};
const req = (body: unknown, cookie = '', ip = '1.1.1.1') => new Request('http://x/a', { method: 'POST', headers: { cookie, 'x-forwarded-for': ip, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const get = (cookie = '', q = '') => new Request(`http://x/a${q}`, { headers: { cookie } });
const j = async (r: Response) => r.json();

beforeAll(async () => {
  process.chdir(mkdtempSync(path.join(tmpdir(), 'aff-')));
  process.env.ADMIN_USERNAME = 'boss'; process.env.ADMIN_PASSWORD = 'correct-horse-battery';
  R.login = await import('@/app/api/ai-guru/admin/login/route');
  R.fees = await import('@/app/api/ai-guru/admin/fees/route');
  R.aff = await import('@/app/api/ai-guru/admin/affiliates/route');
  R.coupons = await import('@/app/api/ai-guru/admin/coupons/route');
  R.signup = await import('@/app/api/ai-guru/student-portal/signup/route');
  R.coupon = await import('@/app/api/ai-guru/student-portal/coupon/route');
  R.me = await import('@/app/api/ai-guru/student-portal/me/route');
  admin = (await R.login.POST(req({ username: 'boss', password: 'correct-horse-battery' }))).headers.get('set-cookie')!.split(';')[0];
});

const form = (name: string, extra = {}) => ({ name, standard: '8', school: 'GHSS', state: 'Kerala', district: 'Ernakulam', place: 'Aluva', password: 'secret1', confirm: 'secret1', ...extra });

describe('affiliate marketing', () => {
  it('link → code → referral → discount → commission on every payment → payout on the 4th', async () => {
    // the sender signs up and has a personal code
    const a = await R.signup.POST(req(form('Anjali Menon'), '', '20.0.0.1'));
    const aCookie = a.headers.get('set-cookie')!.split(';')[0];
    const aMe = await j(await R.me.GET(get(aCookie)));
    const code = aMe.affiliate.code as string;
    expect(code).toMatch(/^ANJA[A-Z2-9]{4}$/);
    expect(aMe.affiliate).toMatchObject({ enabled: true, rate: 10, friendDiscountPct: 10, payoutDay: 4 });
    // the link's code is checked on the sign-up page: it names the sender
    const chk = await j(await R.coupon.GET(new Request(`http://x/c?code=${code}`, { headers: { 'x-forwarded-for': '20.0.0.2' } })));
    expect(chk).toMatchObject({ valid: true, referrer: 'Anjali' });
    // the receiver signs up with it, gets a code of his own, and is Anjali's referral
    const b = await R.signup.POST(req(form('Arjun Nair', { coupon: code }), '', '20.0.0.3'));
    expect(b.status).toBe(200);
    const bMe = await j(await R.me.GET(get(b.headers.get('set-cookie')!.split(';')[0])));
    expect(bMe.student).toMatchObject({ coupon: code, referredBy: aMe.student.id });
    expect(bMe.affiliate.code).toMatch(/^ARJU/);
    // fees: Arjun gets 10% off; two payments, one long due and one in the future
    await R.fees.POST(req({ action: 'head', head: { name: 'Tuition', amount: 1000, standard: 'all' } }, admin));
    await R.fees.POST(req({ action: 'generate', standard: '8', term: 'T1' }, admin));
    const invs = (await j(await R.fees.GET(get(admin)))).invoices;
    const bi = invs.find((i: any) => i.studentId === bMe.student.id);
    expect(bi.discount).toBe(100);
    const p1 = await j(await R.fees.POST(req({ action: 'pay', invoiceId: bi.id, amount: 400, date: '2020-01-10', mode: 'upi' }, admin)));
    expect(p1.payment.commission).toEqual({ affiliateId: aMe.student.id, rate: 10, amount: 40, payoutDate: '2020-02-04' });
    await R.fees.POST(req({ action: 'pay', invoiceId: bi.id, amount: 200, date: '2099-01-10', mode: 'cash' }, admin));
    // Anjali sees Arjun, each payment, pending, date and commission
    const rep = (await j(await R.me.GET(get(aCookie)))).affiliate.report;
    expect(rep.totals).toMatchObject({ referrals: 1, billed: 900, paid: 600, due: 300, earned: 60, dueNow: 40, pending: 20, paidOut: 0 });
    expect(rep.referrals[0].payments.map((p: any) => [p.date, p.amount, p.commission, p.status])).toEqual([['2020-01-10', 400, 40, 'due'], ['2099-01-10', 200, 20, 'pending']]);
    expect(JSON.stringify(rep)).not.toMatch(/guardian|pincode|hash/);
    // Arjun cannot see Anjali's report as his own, only his own referrals (none)
    expect((await j(await R.me.GET(get(b.headers.get('set-cookie')!.split(';')[0])))).affiliate.report.totals.referrals).toBe(0);
    // admin: affiliate list, detail, revenue
    const list = await j(await R.aff.GET(get(admin)));
    expect(list.affiliates.find((x: any) => x.id === aMe.student.id)).toMatchObject({ referrals: 1, earned: 60, dueNow: 40 });
    const rev = list.revenue.find((x: any) => x.id === bMe.student.id);
    expect(rev).toMatchObject({ billed: 900, discount: 100, paid: 600, due: 300, commissionGenerated: 60, net: 540, referredByName: 'Anjali Menon', coupon: code });
    expect(rev.payments).toHaveLength(2);
    expect((await R.aff.GET(get(admin, `?id=${aMe.student.id}`))).status).toBe(200);
    // payout: needs a reference; pays only what has fallen due; then nothing is left due
    expect((await R.aff.POST(req({ action: 'payout', affiliateId: aMe.student.id, reference: '' }, admin))).status).toBe(400);
    const po = await j(await R.aff.POST(req({ action: 'payout', affiliateId: aMe.student.id, reference: 'UPI 123456' }, admin)));
    expect(po).toMatchObject({ ok: true, amount: 40, count: 1 });
    expect((await R.aff.POST(req({ action: 'payout', affiliateId: aMe.student.id, reference: 'again' }, admin))).status).toBe(409);
    const after = (await j(await R.me.GET(get(aCookie)))).affiliate.report.totals;
    expect(after).toMatchObject({ dueNow: 0, paidOut: 40, pending: 20 });
    expect((await (await R.aff.GET(get(admin, '?format=csv'))).text())).toMatch(/Anjali Menon,Arjun Nair,2020-01-10,.*,400,10,40,2020-02-04,paid/);
    // personal coupons stay out of the Coupons tab and cannot be edited there
    expect((await j(await R.coupons.GET(get(admin)))).coupons).toHaveLength(0);
    expect((await R.coupons.POST(req({ coupon: { code, kind: 'percent', value: 99 } }, admin))).status).toBe(409);
  });
  it('admin sets the rates: school-wide, per affiliate, friend discount, on/off', async () => {
    const list = await j(await R.aff.GET(get(admin)));
    const anj = list.affiliates.find((x: any) => x.name === 'Anjali Menon');
    expect((await R.aff.POST(req({ action: 'settings', affiliate: { enabled: true, commissionPct: 150, discountPct: 10, payoutDay: 4 } }, admin))).status).toBe(400);
    expect((await R.aff.POST(req({ action: 'settings', affiliate: { enabled: true, commissionPct: 12.5, discountPct: 15, payoutDay: 4 } }, admin))).status).toBe(200);
    const cl = await j(await R.coupon.GET(new Request(`http://x/c?code=${anj.code}`, { headers: { 'x-forwarded-for': '21.0.0.1' } })));
    expect(cl.label).toMatch(/15% off/);
    await R.aff.POST(req({ action: 'override', studentId: anj.id, commissionPct: 20 }, admin));
    expect((await j(await R.aff.GET(get(admin)))).affiliates.find((x: any) => x.id === anj.id).rate).toBe(20);
    // new payment uses the new rate (20%); the old ones keep their frozen rate
    const c = await R.signup.POST(req(form('Devika S', { coupon: anj.code }), '', '21.0.0.2'));
    await R.fees.POST(req({ action: 'generate', standard: '8', term: 'T2' }, admin));
    const dId = (await j(await R.me.GET(get(c.headers.get('set-cookie')!.split(';')[0])))).student.id;
    const di = (await j(await R.fees.GET(get(admin)))).invoices.find((i: any) => i.term === 'T2' && i.studentId === dId);
    expect(di.discount).toBe(150); // 15% of 1000
    const pay = await j(await R.fees.POST(req({ action: 'pay', invoiceId: di.id, amount: 500, date: '2020-03-10', mode: 'cash' }, admin)));
    expect(pay.payment.commission).toMatchObject({ rate: 20, amount: 100 });
    // switching affiliates off: the codes stop working and no commission is added
    await R.aff.POST(req({ action: 'settings', affiliate: { enabled: false, commissionPct: 12.5, discountPct: 15, payoutDay: 4 } }, admin));
    expect((await j(await R.coupon.GET(new Request(`http://x/c?code=${anj.code}`, { headers: { 'x-forwarded-for': '21.0.0.3' } })))).valid).toBe(false);
    const pay2 = await j(await R.fees.POST(req({ action: 'pay', invoiceId: di.id, amount: 100, date: '2020-03-11', mode: 'cash' }, admin)));
    expect(pay2.payment.commission).toBeUndefined();
  });
});
