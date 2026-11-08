// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

type R = typeof import('@/app/api/ai-guru/admin/students/route');
let admin: string, students: R, fees: typeof import('@/app/api/ai-guru/admin/fees/route');
let sLogin: typeof import('@/app/api/ai-guru/student-portal/login/route'), sMe: typeof import('@/app/api/ai-guru/student-portal/me/route');
const req = (body: unknown, cookie = '', ip = '1.1.1.1') => new Request('http://x/a', { method: 'POST', headers: { cookie, 'x-forwarded-for': ip, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const get = (cookie = '', q = '') => new Request(`http://x/a${q}`, { headers: { cookie } });

beforeAll(async () => {
  process.chdir(mkdtempSync(path.join(tmpdir(), 'adm3-')));
  process.env.ADMIN_USERNAME = 'boss'; process.env.ADMIN_PASSWORD = 'correct-horse-battery';
  const login = await import('@/app/api/ai-guru/admin/login/route');
  students = await import('@/app/api/ai-guru/admin/students/route');
  fees = await import('@/app/api/ai-guru/admin/fees/route');
  sLogin = await import('@/app/api/ai-guru/student-portal/login/route');
  sMe = await import('@/app/api/ai-guru/student-portal/me/route');
  admin = (await login.POST(req({ username: 'boss', password: 'correct-horse-battery' }))).headers.get('set-cookie')!.split(';')[0];
});

describe('student login wired to fees and details', () => {
  it('admin makes a PIN; the student signs in and sees only their own fees; the hash never leaves the server', async () => {
    const mk = async (name: string, adm: string) => (await (await students.POST(req({ student: { name, standard: '8', admissionNo: adm, school: 'GHSS', address: { line1: 'x', area: 'Perumbavoor', state: 'Kerala', district: 'Ernakulam', pincode: '683542' } } }, admin))).json()).student;
    const a = await mk('Anjali', '2026/014'), b = await mk('Arjun', '2026/015');
    expect((await students.POST(req({ student: { name: 'Dup', standard: '8', admissionNo: '2026/014' } }, admin))).status).toBe(409);
    // no login yet
    expect((await sLogin.POST(req({ admissionNo: '2026/014', pin: '123456' }, '', '2.2.2.2'))).status).toBe(401);
    const pin = (await (await students.POST(req({ action: 'setPin', id: a.id }, admin))).json()).pin as string;
    expect(pin).toMatch(/^\d{6}$/);
    const list = JSON.stringify(await (await students.GET(get(admin))).json());
    expect(list).not.toMatch(/"hash"|"salt"/);
    expect(list).toMatch(/"hasLogin":true/);
    expect((await sLogin.POST(req({ admissionNo: '2026/014', pin: '000000' }, '', '3.3.3.3'))).status).toBe(401);
    const ok = await sLogin.POST(req({ admissionNo: '2026/014', pin }, '', '4.4.4.4'));
    expect(ok.status).toBe(200);
    const cookie = ok.headers.get('set-cookie')!.split(';')[0];
    // fees for both, a payment for Anjali only
    await fees.POST(req({ action: 'head', head: { name: 'Tuition', amount: 1000, standard: 'all' } }, admin));
    await fees.POST(req({ action: 'generate', standard: '8', term: 'T1' }, admin));
    const inv = (await (await fees.GET(get(admin))).json()).invoices.find((i: { studentId: string }) => i.studentId === a.id);
    await fees.POST(req({ action: 'pay', invoiceId: inv.id, amount: 400, date: '2026-10-18', mode: 'cash' }, admin));
    const me = await (await sMe.GET(get(cookie))).json();
    expect(me.student.name).toBe('Anjali');
    expect(me.student.hasLogin).toBe(true);
    expect(JSON.stringify(me)).not.toMatch(/"hash"|Arjun/);
    expect(me.fees.invoices).toHaveLength(1);
    expect(me.fees.summary).toMatchObject({ billed: 1000, collected: 400, due: 600 });
    expect(me.quizId).toBe(`student:${a.id}`);
    // not signed in / forged / other student's id
    expect((await sMe.GET(get())).status).toBe(401);
    expect((await sMe.GET(get('aig_student=YWJj.9999999999999.deadbeef'))).status).toBe(401);
    expect((await sMe.GET(get(cookie, `?as=${b.id}`))).json).toBeTruthy();
    const asOther = await (await sMe.GET(get(cookie, `?as=${b.id}`))).json();
    expect(asOther.student.name).toBe('Anjali'); // ?as= is ignored without the admin cookie
    const asAdmin = await (await sMe.GET(get(admin, `?as=${b.id}`))).json();
    expect(asAdmin.student.name).toBe('Arjun');
    // block
    await students.POST(req({ action: 'clearPin', id: a.id }, admin));
    expect((await sLogin.POST(req({ admissionNo: '2026/014', pin }, '', '5.5.5.5'))).status).toBe(401);
  });
  it('every student gets a Student ID, so a password needs no admission number', async () => {
    const s = (await (await students.POST(req({ student: { name: 'NoAdm', standard: '9' } }, admin))).json()).student;
    expect(s.studentCode).toMatch(/^ST-\d+-\d{2}$/);
    const r = await students.POST(req({ action: 'setPin', id: s.id }, admin));
    expect(r.status).toBe(200);
    const pin = (await r.json()).pin;
    expect((await sLogin.POST(req({ admissionNo: s.studentCode.toLowerCase(), pin }, '', '6.6.6.6'))).status).toBe(200);
  });
  it('forgot PIN: a matching phone reaches the admin; the answer never reveals whether it matched', async () => {
    const forgot = await import('@/app/api/ai-guru/student-portal/forgot/route');
    const st = (await (await students.POST(req({ student: { name: 'Meera', standard: '7', admissionNo: 'F-1', guardianPhone: '9876501234', address: { line1: 'x', area: 'y', state: 'Kerala', district: 'Idukki', pincode: '685584' } } }, admin))).json()).student;
    const wrong = await (await forgot.POST(req({ admissionNo: 'F-1', guardianPhone: '9999999999' }, '', '7.7.7.7'))).json();
    const right = await (await forgot.POST(req({ admissionNo: 'F-1', guardianPhone: '+91 98765 01234' }, '', '8.8.8.8'))).json();
    expect(wrong).toEqual(right);
    const j = await (await students.GET(get(admin))).json();
    expect(j.pinRequests.map((r: { studentId: string }) => r.studentId)).toEqual([st.id]);
    await forgot.POST(req({ admissionNo: 'F-1', guardianPhone: '9876501234' }, '', '9.9.9.9'));
    expect((await (await students.GET(get(admin))).json()).pinRequests).toHaveLength(1); // not duplicated
    await students.POST(req({ action: 'setPin', id: st.id }, admin));
    expect((await (await students.GET(get(admin))).json()).pinRequests).toHaveLength(0); // answered
  });

  it('student sign-up with a coupon: validation, Student ID, auto sign-in, discount on fees, limits', async () => {
    const signup = await import('@/app/api/ai-guru/student-portal/signup/route');
    const couponApi = await import('@/app/api/ai-guru/student-portal/coupon/route');
    const coupons = await import('@/app/api/ai-guru/admin/coupons/route');
    const settings = await import('@/app/api/ai-guru/admin/settings/route');
    const me = (await import('@/app/api/ai-guru/student-portal/me/route'));
    const form = { name: 'Devika Nair', standard: '9', school: 'GVHSS Thodupuzha', state: 'Kerala', district: 'Idukki', place: 'Thodupuzha', password: 'secret1', confirm: 'secret1' };
    // admin makes coupons
    expect((await coupons.POST(req({ coupon: { code: 'ab', kind: 'percent', value: 10 } }, admin))).status).toBe(400);
    expect((await coupons.POST(req({ coupon: { code: 'open-day', kind: 'percent', value: 10, maxUses: 2 } }, admin))).status).toBe(200);
    expect((await coupons.POST(req({ coupon: { code: 'FLAT500', kind: 'flat', value: 500 } }, admin))).status).toBe(200);
    // checking a coupon
    const chk = (code: string, ip: string) => couponApi.GET(new Request(`http://x/c?code=${code}`, { headers: { 'x-forwarded-for': ip } })).then((r) => r.json());
    expect(await chk('OPENDAY', '10.0.0.1')).toMatchObject({ valid: true, label: '10% off fees' });
    expect(await chk('NOPE1234', '10.0.0.2')).toMatchObject({ valid: false });
    // validation
    const bad = await signup.POST(req({ ...form, confirm: 'different', school: '' }, '', '11.0.0.1'));
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toMatch(/School is needed.*not the same/s);
    expect((await signup.POST(req({ ...form, district: 'Chennai' }, '', '11.0.0.2'))).status).toBe(400);
    expect((await signup.POST(req({ ...form, coupon: 'WRONGCODE' }, '', '11.0.0.3'))).status).toBe(400);
    // success: signed in at once, Student ID returned, record has no hash in the admin list
    const ok = await signup.POST(req({ ...form, coupon: 'open day' }, '', '11.0.0.4'));
    expect(ok.status).toBe(200);
    const body = await ok.json();
    expect(body.studentCode).toMatch(/^ST-\d+-\d{2}$/);
    const cookie = ok.headers.get('set-cookie')!.split(';')[0];
    const mine = await (await me.GET(get(cookie))).json();
    expect(mine.student).toMatchObject({ name: 'Devika Nair', school: 'GVHSS Thodupuzha', source: 'self', coupon: 'OPENDAY', hasLogin: true });
    expect(mine.student.address).toMatchObject({ area: 'Thodupuzha', district: 'Idukki', state: 'Kerala' });
    expect(JSON.stringify(mine)).not.toMatch(/"hash"/);
    // same student again → "Is this you?" (V51.9.182: 409 with duplicate, not a flat refusal); can sign in later with the Student ID + password
    const again = await signup.POST(req({ ...form }, '', '11.0.0.5'));
    expect(again.status).toBe(409);
    expect((await again.json()).duplicate).toBe(true);
    expect((await sLogin.POST(req({ admissionNo: body.studentCode, pin: 'secret1' }, '', '12.0.0.1'))).status).toBe(200);
    expect((await sLogin.POST(req({ admissionNo: body.studentCode, pin: 'wrong' }, '', '12.0.0.2'))).status).toBe(401);
    // coupon discount reaches the fee bill: 10% of 1000 on every invoice
    await fees.POST(req({ action: 'generate', standard: '9', term: 'T9' }, admin));
    const inv = (await (await fees.GET(get(admin))).json()).invoices.find((i: { studentId: string; term: string }) => i.studentId === mine.student.id && i.term === 'T9');
    expect(inv).toMatchObject({ discount: 100, coupon: 'OPENDAY' });
    // flat coupon: once only
    const f2 = await signup.POST(req({ ...form, name: 'Flat Student', coupon: 'FLAT500' }, '', '11.0.0.6'));
    expect(f2.status).toBe(200);
    await fees.POST(req({ action: 'generate', standard: '9', term: 'T10' }, admin));
    await fees.POST(req({ action: 'generate', standard: '9', term: 'T11' }, admin));
    const all = (await (await fees.GET(get(admin))).json()).invoices;
    const flatId = (await (await me.GET(get(f2.headers.get('set-cookie')!.split(';')[0]))).json()).student.id;
    expect(all.filter((i: { studentId: string }) => i.studentId === flatId).map((i: { discount: number }) => i.discount)).toEqual([500, 0]);
    // used-up coupon (maxUses 2): the second use is OPENDAY's last
    expect((await signup.POST(req({ ...form, name: 'Third', coupon: 'OPENDAY' }, '', '11.0.0.7'))).status).toBe(200);
    expect(await chk('OPENDAY', '10.0.0.3')).toMatchObject({ valid: false });
    // admin can require a coupon
    await settings.POST(req({ signupNeedsCoupon: true }, admin));
    const need = await signup.POST(req({ ...form, name: 'No Coupon' }, '', '11.0.0.8'));
    expect((await need.json()).error).toMatch(/coupon code is needed/);
    expect((await couponApi.GET(new Request('http://x/c'))).json()).toBeTruthy();
    await settings.POST(req({ signupNeedsCoupon: false }, admin));
    // forgot password by full name works for a self sign-up student (admin still hands over the new password)
    const forgot = await import('@/app/api/ai-guru/student-portal/forgot/route');
    await forgot.POST(req({ admissionNo: body.studentCode, guardianPhone: 'devika  nair' }, '', '13.0.0.1'));
    const list = await (await students.GET(get(admin))).json();
    expect(list.pinRequests.some((r: { studentId: string }) => r.studentId === mine.student.id)).toBe(true);
  });
});
