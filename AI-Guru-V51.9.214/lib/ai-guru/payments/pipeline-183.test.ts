/**
 * V51.9.183 — the whole path, end to end through the real routes:
 * a friend's referral link → sign-up with the code → Part 1 free → the family pays by UPI and sends the 12-digit
 * reference → the office confirms → receipt, enrolment (all parts open) and the referrer's commission.
 * Also: a book the office uploads gets every study-material type for its free part queued at once.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';

const R: Record<string, any> = {};
let ipN = 1;
const req = (body: unknown, cookie = '', ip = `30.0.0.${ipN++}`) => new Request('http://x/a', { method: 'POST', headers: { cookie, 'x-forwarded-for': ip, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const get = (cookie = '', q = '') => new Request(`http://x/a${q}`, { headers: { cookie } });
const j = async (r: Response) => r.json();
const sess = (r: Response) => (r.headers.getSetCookie?.() ?? [r.headers.get('set-cookie') ?? '']).map((c) => c.split(';')[0]).filter((c) => /^aig_(student|admin)=/.test(c)).join('; ');
const kid = (name: string, extra: Record<string, unknown> = {}) => ({ name, standard: '8', syllabus: 'kerala', medium: 'malayalam', school: 'GHSS', state: 'Kerala', district: 'Ernakulam', place: 'Aluva', password: 'secret1', confirm: 'secret1', ...extra });
let admin = '';
const UTR = '412345678901';

beforeAll(async () => {
  process.chdir(mkdtempSync(path.join(tmpdir(), 'pipe-')));
  process.env.ADMIN_USERNAME = 'office'; process.env.ADMIN_PASSWORD = 'office-pass-2026';
  process.env.AI_GURU_PROXY_HOPS = '1';
  delete process.env.GEMINI_API_KEY;
  for (const [k, p] of Object.entries({ login: 'admin/login', aff: 'admin/affiliates', plans: 'admin/plans', upi: 'admin/upi', alib: 'admin/library', enrol: 'admin/enrolment', signup: 'student-portal/signup', me: 'student-portal/me', pay: 'student-portal/pay', index: 'material-studio/index' })) R[k] = await import(`@/app/api/ai-guru/${p}/route`);
  R.cloud = await import('@/lib/ai-guru/library/cloud');
  admin = sess(await R.login.POST(req({ username: 'office', password: 'office-pass-2026' })));
  expect((await R.aff.POST(req({ action: 'settings', affiliate: { enabled: true, commissionPct: 10, discountPct: 10, payoutDay: 4 } }, admin))).status).toBe(200);
  expect((await R.enrol.POST(req({ action: 'settings', access: { enabled: true, freeParts: [1] } }, admin))).status).toBe(200); // Part 1 free, the rest locked
  expect((await R.plans.POST(req({ action: 'settings', plans: { prices: [{ standard: '8', monthly: 500 }], yearlyReductionPct: 10, graceDays: 5 } }, admin))).status).toBe(200);
});

describe('referral link → class → UPI payment → confirmed', () => {
  let referrer = '', friend = '', friendCode = '';
  it('a friend joins with the referrer’s code and starts on the free trial', async () => {
    const a = await R.signup.POST(req(kid('Anjali Menon')));
    referrer = sess(a);
    const code = (await j(await R.me.GET(get(referrer)))).affiliate.code as string;
    const b = await R.signup.POST(req(kid('Arjun Nair', { coupon: code, fromLink: true })));
    friend = sess(b); friendCode = (await j(b)).studentCode;
    const me = await j(await R.me.GET(get(friend)));
    expect(me.access.status).toBe('free');
  });

  it('before the school sets a UPI ID: the family is told to pay at the office', async () => {
    const p = await j(await R.pay.GET(get(friend)));
    expect(p.upi).toBeNull();
    expect((await j(await R.pay.POST(req({ kind: 'monthly', utr: UTR }, friend)))).error).toMatch(/not set up UPI/);
  });

  it('the family sees the amount (with the friend’s discount) and a UPI link with the Student ID in the note', async () => {
    expect((await j(await R.upi.POST(req({ action: 'settings', vpa: 'not a vpa' }, admin)))).ok).toBe(false);
    expect((await j(await R.upi.POST(req({ action: 'settings', vpa: 'ghssaluva@okaxis', payee: 'GHSS Aluva' }, admin)))).ok).toBe(true);
    const p = await j(await R.pay.GET(get(friend)));
    const month = p.options.find((o: { kind: string }) => o.kind === 'monthly');
    expect(month.amount).toBe(450); // ₹500 less the friend's 10%
    expect(month.link).toMatch(/^upi:\/\/pay\?pa=ghssaluva%40okaxis&pn=GHSS\+Aluva&am=450\.00&cu=INR&tn=AI\+Guru\+AGT-\d{6}-[2-9A-HJ-NP-Z]{5}\+ST-/); // V51.9.190: AI Guru's transaction ID in the note
    expect(p.options.find((o: { kind: string }) => o.kind === 'yearly').amount).toBeGreaterThan(450);
  });

  it('a wrong reference is refused; a real one waits for the office; the same one cannot be sent twice', async () => {
    expect((await j(await R.pay.POST(req({ kind: 'monthly', utr: '1234' }, friend)))).error).toMatch(/12-digit/);
    const c = await j(await R.pay.POST(req({ kind: 'monthly', utr: '4123 4567 8901', paidOn: '2026-11-02' }, friend)));
    expect(c).toMatchObject({ ok: true, claim: { status: 'waiting', amount: 450, utr: UTR } });
    expect((await j(await R.pay.POST(req({ kind: 'yearly', utr: UTR }, friend)))).error).toMatch(/already been sent/);
    expect((await R.pay.GET(get())).status).toBe(401);
  });

  it('the office sees it, confirms it: receipt, enrolment (all parts open) and the referrer’s commission', async () => {
    const list = await j(await R.upi.GET(get(admin)));
    expect(list.waiting).toBe(1);
    const row = list.claims[0];
    expect(row.student).toMatchObject({ name: 'Arjun Nair', studentCode: friendCode });
    expect((await R.upi.GET(get(friend))).status).toBe(404); // the office's list is not for families
    const done = await j(await R.upi.POST(req({ action: 'confirm', id: row.id }, admin)));
    expect(done.claim).toMatchObject({ status: 'confirmed' });
    expect(done.claim.receiptNo).toBeTruthy();
    expect((await j(await R.upi.POST(req({ action: 'confirm', id: row.id }, admin)))).ok).toBe(false); // never twice
    const me = await j(await R.me.GET(get(friend)));
    expect(me.access.full).toBe(true);
    expect(me.fees.invoices.some((i: { payments: Array<{ mode: string; note?: string }> }) => i.payments.some((p) => p.mode === 'upi' && p.note?.startsWith(`UPI ${UTR} · AGT-`)))).toBe(true);
    const ref = await j(await R.me.GET(get(referrer)));
    expect(ref.affiliate.report.totals.earned).toBe(45); // 10% of ₹450
    const mine = await j(await R.pay.GET(get(friend)));
    expect(mine.claims[0]).toMatchObject({ status: 'confirmed', receiptNo: done.claim.receiptNo });
    expect(mine.claims[0].studentId).toBeUndefined();
  });

  it('the office can say "not found", and the family sees the reason', async () => {
    const c = await j(await R.pay.POST(req({ kind: 'yearly', utr: '499999999999' }, friend)));
    expect(c.ok).toBe(true);
    const r = await j(await R.upi.POST(req({ action: 'reject', id: c.claim.id, reason: 'Not in our statement' }, admin)));
    expect(r.claim).toMatchObject({ status: 'rejected', reason: 'Not in our statement' });
    expect((await j(await R.pay.GET(get(friend)))).claims.find((x: { id: string }) => x.id === c.claim.id).reason).toBe('Not in our statement');
  });
});

describe('the office uploads a textbook → its free part is made in full', () => {
  it('every study-material type is queued for Part 1 on the cloud key', async () => {
    R.cloud.setGenerator(async () => { await new Promise((r) => setTimeout(r, 5000)); throw new Error('not in this test'); });
    expect((await R.alib.POST(req({ action: 'settings', library: { cloudKey: 'AIza' + 'k'.repeat(35), studentsMayCreate: false, dailyLimit: 5, reviewStudentWork: false } }, admin))).status).toBe(200);
    const d = await PDFDocument.create(); for (let p = 0; p < 10; p++) d.addPage([210, 297]);
    const bytes = await d.save();
    const f = new FormData();
    f.append('file', new File([bytes.slice().buffer as ArrayBuffer], 'science-8.pdf', { type: 'application/pdf' }));
    f.append('pages', JSON.stringify(Array.from({ length: 10 }, (_, i) => ({ page: i + 1, text: `Chapter ${i + 1} Plants and animals. Living things need food, water and air. `.repeat(6) }))));
    for (const [k, v] of Object.entries({ subject: 'Science', grade: '8', syllabus: 'kerala', sourceLanguage: 'english', teachingLanguage: 'malayalam' })) f.append(k, v);
    const body = await j(await R.index.POST(new Request('http://x/i', { method: 'POST', body: f, headers: { cookie: admin } })));
    expect(body.ok).toBe(true);
    expect(body.freePart).toMatchObject({ parts: [1], queued: 11 });
    const jobs = (await R.cloud.jobsFor({ kind: 'admin' })).filter((x: { documentId: string }) => x.documentId === body.document.id);
    expect(new Set(jobs.map((x: { type: string }) => x.type)).size).toBe(11);
    expect(jobs.every((x: { part: number }) => x.part === 1)).toBe(true);
    R.cloud.setGenerator(null);
    await R.cloud.resetJobs();
  });
});
