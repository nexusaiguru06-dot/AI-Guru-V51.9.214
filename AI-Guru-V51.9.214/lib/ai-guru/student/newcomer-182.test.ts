/**
 * V51.9.182 — fixes from the Elephant–Goldfish newcomer review (docs/reviews/2026-11-02-newcomer/):
 * the sign-up reply carries what the Student ID screen needs, one class on one Wi-Fi does not lock itself out,
 * a lost Student ID can still be asked for, a class can be joined after sign-up, two children may share a name,
 * and a visitor's quizzes move to the new account.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const R: Record<string, any> = {};
const IP = '203.0.113.7'; // one school Wi-Fi address for everyone
const post = (body: unknown, cookie = '') => new Request('http://x/a', { method: 'POST', headers: { 'x-forwarded-for': IP, 'content-type': 'application/json', cookie }, body: JSON.stringify(body) });
const cookieOf = (r: Response) => (r.headers.getSetCookie?.() ?? [r.headers.get('set-cookie') ?? '']).map((c) => c.split(';')[0]).filter((c) => c.startsWith('aig_student=')).join('; ');
const kid = (name: string, extra: Record<string, unknown> = {}) => ({ name, standard: '7', syllabus: 'kerala', medium: 'malayalam', school: 'GHSS Aluva', state: 'Kerala', district: 'Ernakulam', place: 'Aluva', password: 'kid123', confirm: 'kid123', ...extra });
let classCode = '';

beforeAll(async () => {
  process.chdir(mkdtempSync(path.join(tmpdir(), 'newcomer-')));
  process.env.ADMIN_USERNAME = 'office'; process.env.ADMIN_PASSWORD = 'office-pass-2026';
  process.env.AI_GURU_PROXY_HOPS = '1';
  for (const [k, p] of Object.entries({ signup: 'student-portal/signup', login: 'student-portal/login', forgot: 'student-portal/forgot', join: 'student-portal/join', coupon: 'student-portal/coupon', alogin: 'admin/login', classes: 'admin/classes', students: 'admin/students' })) R[k] = await import(`@/app/api/ai-guru/${p}/route`);
  R.quiz = await import('@/lib/ai-guru/quiz/server-store');
  const admin = (await R.alogin.POST(new Request('http://x/a', { method: 'POST', headers: { 'x-forwarded-for': '198.51.100.1', 'content-type': 'application/json' }, body: JSON.stringify({ username: 'office', password: 'office-pass-2026' }) }))).headers.get('set-cookie')!.split(';')[0];
  const made = await (await R.classes.POST(new Request('http://x/a', { method: 'POST', headers: { cookie: admin, 'content-type': 'application/json' }, body: JSON.stringify({ action: 'create', kind: 'class', name: 'Std 7 Maths A', teacherName: 'Lekha Teacher' }) }))).json();
  classCode = made.group.code;
});

describe('sign-up', () => {
  it('replies with the Student ID, the class and the teacher, and moves the visitor quizzes', async () => {
    const visitorId = 'student:0b9f3c1e-2d4a-4c6b-9e8f-112233445566';
    await R.quiz.addRecord({ id: 'q1', studentId: visitorId, at: new Date().toISOString(), kind: 'quiz', items: [{ q: 'x', ok: true }], correct: 1, total: 1, toffees: 1 });
    const r = await R.signup.POST(post(kid('Anu', { coupon: classCode, visitorId, guardianPhone: '98470 12345' })));
    const j = await r.json();
    expect(j).toMatchObject({ ok: true, className: 'Std 7 Maths A', teacher: 'Lekha Teacher', moved: 1 });
    expect(j.studentCode).toMatch(/^ST-\d+-\d+$/);
    expect((await R.quiz.readForStudent(j.quizId)).map((x: { id: string }) => x.id)).toEqual(['q1']);
    expect(await R.quiz.readForStudent(visitorId)).toEqual([]);
    expect(r.headers.get('set-cookie')).toMatch(/aig_hint=student/);
  });
  it('never moves another account’s records (only random visitor ids)', async () => {
    expect(await R.quiz.moveVisitorRecords('student:stu_someone', 'student:stu_me')).toBe(0);
  });
  it('a second child with the same name, standard and school is asked "Is this you?" and can go on', async () => {
    const r = await R.signup.POST(post(kid('Anu')));
    expect(r.status).toBe(409);
    expect((await r.json()).duplicate).toBe(true);
    expect((await (await R.signup.POST(post(kid('Anu', { differentStudent: true })))).json()).ok).toBe(true);
  });
  it('a class of 40 can sign up together from one address (only failed sign-ups count)', async () => {
    for (let i = 0; i < 12; i++) expect((await (await R.signup.POST(post(kid(`Child ${i}`)))).json()).ok).toBe(true);
  });
  it('passwords longer than 30 characters are refused at sign-up (sign-in reads 30)', async () => {
    const long = 'x'.repeat(31);
    expect((await (await R.signup.POST(post(kid('Long Pw', { password: long, confirm: long })))).json()).error).toMatch(/at most 30/);
  });
  it('the code check names the teacher', async () => {
    const j = await (await R.coupon.GET(new Request(`http://x/a?code=${classCode}`, { headers: { 'x-forwarded-for': IP } }))).json();
    expect(j).toMatchObject({ valid: true, group: 'Std 7 Maths A', teacher: 'Lekha Teacher' });
  });
});

describe('sign-in lockout is per account, not per school Wi-Fi', () => {
  it('five typos by one child lock that child only; the class keeps signing in', async () => {
    const a = await (await R.signup.POST(post(kid('Typo Kid')))).json();
    const b = await (await R.signup.POST(post(kid('Careful Kid')))).json();
    for (let i = 0; i < 5; i++) expect((await R.login.POST(post({ admissionNo: a.studentCode, pin: 'wrong1' }))).status).toBe(401);
    const locked = await R.login.POST(post({ admissionNo: a.studentCode, pin: 'kid123' }));
    expect(locked.status).toBe(429);
    expect((await locked.json()).error).toMatch(/15 minutes/);
    const ok = await R.login.POST(post({ admissionNo: b.studentCode, pin: 'kid123' }));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ ok: true, studentCode: b.studentCode, name: 'Careful Kid' });
  });
});

describe('joining a class after sign-up', () => {
  it('a signed-in student types the class code and joins; a wrong code is refused', async () => {
    const r = await R.signup.POST(post(kid('Late Joiner')));
    const c = cookieOf(r);
    expect((await (await R.join.POST(post({ code: 'NOTACODE' }, c))).json()).ok).toBe(false);
    const j = await (await R.join.POST(post({ code: classCode.toLowerCase() }, c))).json();
    expect(j).toMatchObject({ ok: true, className: 'Std 7 Maths A', teacher: 'Lekha Teacher' });
    expect(typeof j.serial).toBe('number');
  });
  it('needs a signed-in student', async () => {
    expect((await R.join.POST(post({ code: classCode }))).status).toBe(401);
  });
});

describe('forgot password without the Student ID', () => {
  it('full name, standard and school put one exact match in front of the office', async () => {
    await R.signup.POST(post(kid('Meera Das', { school: 'GHSS Thrissur' })));
    await R.forgot.POST(post({ guardianPhone: 'meera  das', standard: '7', school: 'ghss thrissur' }));
    const { readData } = await import('@/lib/ai-guru/admin/store');
    const d = await readData();
    const meera = d.students.find((s) => s.name === 'Meera Das')!;
    expect(d.pinRequests.some((p) => p.studentId === meera.id)).toBe(true);
  });
  it('or by the parent’s mobile given at sign-up (one exact match)', async () => {
    const { readData } = await import('@/lib/ai-guru/admin/store');
    const anu = (await readData()).students.find((s) => s.guardianPhone && s.name === 'Anu')!;
    await R.forgot.POST(post({ guardianPhone: '+91 98470 12345', byPhone: true }));
    expect((await readData()).pinRequests.some((p) => p.studentId === anu.id)).toBe(true);
  });
  it('two children with the same details: nobody is put forward (the reply is the same)', async () => {
    const before = (await (await import('@/lib/ai-guru/admin/store')).readData()).pinRequests.length;
    const r = await R.forgot.POST(post({ guardianPhone: 'Anu', standard: '7', school: 'GHSS Aluva' }));
    expect(await r.json()).toEqual({ ok: true });
    expect((await (await import('@/lib/ai-guru/admin/store')).readData()).pinRequests.length).toBe(before);
  });
});
