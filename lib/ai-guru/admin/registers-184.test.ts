/** V51.9.184 — the four student-management registers through the real routes, with the place and teacher filters. */
import { beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const R: Record<string, any> = {};
let ipN = 1;
const req = (body: unknown, cookie = '') => new Request('http://x/a', { method: 'POST', headers: { cookie, 'x-forwarded-for': `31.0.0.${ipN++}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const get = (cookie: string, q: string) => new Request(`http://x/a?${q}`, { headers: { cookie } });
const j = async (r: Response) => r.json();
const sess = (r: Response) => (r.headers.getSetCookie?.() ?? [r.headers.get('set-cookie') ?? '']).map((c) => c.split(';')[0]).filter((c) => /^aig_(student|admin)=/.test(c)).join('; ');
const kid = (name: string, extra: Record<string, unknown> = {}) => ({ name, standard: '7', syllabus: 'kerala', medium: 'malayalam', school: 'GHSS Aluva', state: 'Kerala', district: 'Ernakulam', place: 'Aluva', password: 'secret1', confirm: 'secret1', motherTongue: 'Malayalam', ...extra });
let admin = '', classId = '', classCode = '';
const reg = async (q: string) => j(await R.reg.GET(get(admin, q)));

beforeAll(async () => {
  process.chdir(mkdtempSync(path.join(tmpdir(), 'reg-')));
  process.env.ADMIN_USERNAME = 'office'; process.env.ADMIN_PASSWORD = 'office-pass-2026';
  process.env.AI_GURU_PROXY_HOPS = '1';
  for (const [k, p] of Object.entries({ login: 'admin/login', classes: 'admin/classes', aff: 'admin/affiliates', fees: 'admin/fees', reg: 'admin/registers', signup: 'student-portal/signup', me: 'student-portal/me' })) R[k] = await import(`@/app/api/ai-guru/${p}/route`);
  admin = sess(await R.login.POST(req({ username: 'office', password: 'office-pass-2026' })));
  const c = await j(await R.classes.POST(req({ action: 'create', kind: 'class', name: 'Std 7 Maths A', teacherName: 'Lekha Teacher' }, admin)));
  classId = c.group.id; classCode = c.group.code;
  await R.aff.POST(req({ action: 'settings', affiliate: { enabled: true, commissionPct: 10, discountPct: 10, payoutDay: 4 } }, admin));
  // a referrer in Ernakulam, a friend in Thrissur in Lekha Teacher's class, and a student in Dubai
  const a = await R.signup.POST(req(kid('Anjali Menon', { guardianPhone: '9847012345', email: 'Anjali@Example.com' })));
  const code = (await j(await R.me.GET(new Request('http://x/a', { headers: { cookie: sess(a) } })))).affiliate.code;
  await R.signup.POST(req(kid('Arjun Nair', { coupon: code, fromLink: true, district: 'Thrissur', school: 'GHSS Ollur', place: 'Ollur' })));
  await R.signup.POST(req(kid('Fathima K', { coupon: classCode, district: 'Thrissur', school: 'GHSS Ollur', place: 'Ollur' })));
  await R.signup.POST(req(kid('Rahul Das', { country: 'United Arab Emirates', state: 'Dubai', district: 'Deira', school: 'Indian High School', place: 'Deira', motherTongue: 'Tamil', guardianPhone: '+971501234567' })));
  // a bill and a payment for Arjun (his referrer earns commission)
  const { readData, update } = await import('@/lib/ai-guru/admin/store');
  const arjun = (await readData()).students.find((s) => s.name === 'Arjun Nair')!;
  await update((d) => { d.invoices.push({ id: 'inv_t1', studentId: arjun.id, term: 'Term 1', items: [{ name: 'Fee', amount: 1000 }], discount: 0, payments: [], createdAt: new Date().toISOString() }); const st = d.students.find((s) => s.id === arjun.id)!; st.library = [{ documentId: 'doc:x', at: '2026-11-01T10:00:00Z' }]; });
  expect((await j(await R.fees.POST(req({ action: 'pay', invoiceId: 'inv_t1', amount: 600, date: '2026-11-02', mode: 'upi' }, admin)))).ok).toBe(true);
  // a class visit for Arjun
  const { recordEvent } = await import('@/lib/ai-guru/attendance/server-store');
  const now = Date.parse('2026-11-02T04:30:00Z');
  await recordEvent({ type: 'start', sessionId: 's1', studentId: arjun.quizId ?? `student:${arjun.id}`, studentName: 'Arjun' }, now);
  for (let m = 1; m <= 25; m++) await recordEvent({ type: 'beat', sessionId: 's1', studentId: arjun.quizId ?? `student:${arjun.id}` }, now + m * 60_000); // the app beats once a minute
});

describe('Students register', () => {
  it('keeps the sign-up record: country, phone / WhatsApp, e-mail, mother tongue, coupon, teacher', async () => {
    const r = await reg('sheet=students');
    expect(r.count).toBe(4);
    const anjali = r.rows.find((x: any) => x.name === 'Anjali Menon');
    expect(anjali).toMatchObject({ standard: '7', country: 'India', state: 'Kerala', district: 'Ernakulam', school: 'GHSS Aluva', phone: '9847012345', email: 'anjali@example.com', motherTongue: 'Malayalam' });
    expect(anjali.studentId).toMatch(/^ST-/);
    expect(r.rows.find((x: any) => x.name === 'Fathima K')).toMatchObject({ coupon: classCode, teacher: 'Lekha Teacher · Std 7 Maths A' });
    expect(r.rows.find((x: any) => x.name === 'Rahul Das')).toMatchObject({ country: 'United Arab Emirates', state: 'Dubai', district: 'Deira', motherTongue: 'Tamil' });
  });
  it('dropdowns narrow each other and the filters narrow the rows', async () => {
    const all = await reg('sheet=students');
    expect(all.options.countries).toEqual(['India', 'United Arab Emirates']);
    const india = await reg('sheet=students&country=India');
    expect(india.count).toBe(3);
    expect(india.options.states).toEqual(['Kerala']);
    const thrissur = await reg('sheet=students&country=India&state=Kerala&district=Thrissur');
    expect(thrissur.rows.map((x: any) => x.name).sort()).toEqual(['Arjun Nair', 'Fathima K']);
    expect(thrissur.options.schools).toEqual(['GHSS Ollur']);
    expect(all.options.teachers).toEqual([{ id: classId, label: 'Lekha Teacher · Std 7 Maths A' }]);
    expect((await reg(`sheet=students&teacher=${classId}`)).rows.map((x: any) => x.name)).toEqual(['Fathima K']);
    expect((await reg('sheet=students&q=anjali@')).count).toBe(1);
  });
  it('a bad e-mail or a missing mother tongue is refused at sign-up', async () => {
    expect((await j(await R.signup.POST(req(kid('Bad Mail', { email: 'not-an-email' }))))).error).toMatch(/e-mail/);
    expect((await j(await R.signup.POST(req(kid('No Tongue', { motherTongue: '' }))))).error).toMatch(/mother tongue/);
  });
});

describe('Activities, Fees and Affiliate registers', () => {
  it('activities: trial started, downloads, attendance with time and minutes', async () => {
    const r = await reg('sheet=activities&q=Arjun');
    const a = r.rows[0];
    expect(a.trialStarted).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(a.enrolledOn).toBe('2026-11-02');
    expect(a.downloads).toEqual([{ date: '2026-11-01', what: 'doc:x' }]);
    expect(a.attendance[0]).toEqual({ at: '2026-11-02 10:00', minutes: 25 });
    expect(a.totalMinutes).toBe(25);
  });
  it('fees: each payment with the coupon code the student joined with', async () => {
    const r = await reg('sheet=fees');
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ name: 'Arjun Nair', date: '2026-11-02', amount: 600, mode: 'upi', for: 'Term 1' });
    expect(r.rows[0].coupon).toMatch(/^ANJA/);
    expect((await reg('sheet=fees&district=Ernakulam')).rows).toHaveLength(0);
  });
  it('affiliate: students joined under, their payments, commission pending for the next payout', async () => {
    const r = await reg('sheet=affiliate');
    expect(r.rows).toHaveLength(1);
    const a = r.rows[0];
    expect(a.name).toBe('Anjali Menon');
    expect(a.joined.map((x: any) => x.name)).toEqual(['Arjun Nair']);
    expect(a.joined[0].payments[0]).toMatchObject({ date: '2026-11-02', amount: 600, commission: 60 });
    expect(a.pending).toBe(60);
    expect(a.nextPayout).toMatchObject({ payoutDate: '2026-12-04', amount: 60 });
  });
  it('CSV download, and a formula typed at sign-up stays text', async () => {
    await R.signup.POST(req(kid('=HYPERLINK("x")', { school: 'GHSS Aluva' })));
    const csv = await (await R.reg.GET(get(admin, 'sheet=students&format=csv'))).text();
    expect(csv.split('\n')[0]).toMatch(/^Student ID,Name,Class,Joined,Country/);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
  });
  it('only the school office can read them', async () => {
    expect((await R.reg.GET(get('', 'sheet=students'))).status).toBe(404);
  });
});
