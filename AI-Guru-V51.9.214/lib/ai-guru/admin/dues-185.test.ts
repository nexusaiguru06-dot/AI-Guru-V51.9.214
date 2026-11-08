/**
 * V51.9.185 — fees not paid on time: the stages, the lock after grace (term bills too), extra days, the reminders in
 * Messages (each once), the referrer's "joined under you" and "commission gained" messages, the office's Fees due page
 * and the teacher's "fee pending" mark.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { duesOf, worstStage } from './dues';
import { accessOf, istToday } from './enrolment';
import type { Invoice } from './fees';

const bill = (x: Partial<Invoice> = {}): Invoice => ({ id: 'i1', studentId: 's1', term: 'Term 2', items: [{ name: 'Fee', amount: 1000 }], discount: 0, payments: [], createdAt: '2026-10-01T00:00:00Z', ...x });

describe('stages (pure)', () => {
  const st = { id: 's1' };
  const at = (today: string, x: Partial<Invoice> = {}) => duesOf(st, [bill({ dueDate: '2026-11-10', ...x })], [], today, 5).map((d) => d.stage);
  it('soon → today → grace → over; nothing more than 3 days ahead; paid bills drop out', () => {
    expect(at('2026-11-06')).toEqual([]);
    expect(at('2026-11-07')).toEqual(['soon']);
    expect(at('2026-11-10')).toEqual(['today']);
    expect(at('2026-11-15')).toEqual(['grace']);
    expect(at('2026-11-16')).toEqual(['over']);
    expect(at('2026-11-16', { payments: [{ id: 'p', amount: 1000, date: '2026-11-12', mode: 'upi', receiptNo: 'R' }] })).toEqual([]);
  });
  it('a bill without a due date falls due 30 days after it was made; extra days hold it', () => {
    expect(duesOf(st, [bill()], [], '2026-10-31', 5)[0].dueDate).toBe('2026-10-31');
    expect(duesOf({ id: 's1', feeHold: { until: '2026-11-30', at: '' } }, [bill({ dueDate: '2026-11-10' })], [], '2026-11-20', 5).map((d) => d.stage)).toEqual(['held']);
    expect(worstStage(duesOf(st, [bill({ dueDate: '2026-11-10' }), bill({ id: 'i2', dueDate: '2026-11-25' })], [], '2026-11-22', 5))).toBe('over');
  });
  it('term bills: after the first payment, a later bill unpaid past grace locks Parts 2–10; extra days or paying opens them', () => {
    const paid = bill({ id: 'i0', term: 'Term 1', dueDate: '2026-06-01', payments: [{ id: 'p0', amount: 1000, date: '2026-06-01', mode: 'cash', receiptNo: 'R0' }] });
    const t2 = bill({ dueDate: '2026-11-10' });
    expect(accessOf({ id: 's1' }, [paid, t2], [], '2026-11-15')).toMatchObject({ status: 'enrolled', full: true });
    expect(accessOf({ id: 's1' }, [paid, t2], [], '2026-11-16')).toMatchObject({ status: 'lapsed', full: false });
    expect(accessOf({ id: 's1', feeHold: { until: '2026-11-30', at: '' } }, [paid, t2], [], '2026-11-20')).toMatchObject({ status: 'enrolled', full: true });
    expect(accessOf({ id: 's1' }, [paid, { ...t2, payments: [{ id: 'p2', amount: 1000, date: '2026-11-20', mode: 'upi', receiptNo: 'R2' }] }], [], '2026-11-20')).toMatchObject({ status: 'enrolled', full: true });
  });
});

const R: Record<string, any> = {};
let ipN = 1;
const req = (body: unknown, cookie = '') => new Request('http://x/a', { method: 'POST', headers: { cookie, 'x-forwarded-for': `32.0.0.${ipN++}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const get = (cookie: string, q = '') => new Request(`http://x/a${q}`, { headers: { cookie } });
const j = async (r: Response) => r.json();
const sess = (r: Response) => (r.headers.getSetCookie?.() ?? [r.headers.get('set-cookie') ?? '']).map((c) => c.split(';')[0]).filter((c) => /^aig_(student|admin)=/.test(c)).join('; ');
const kid = (name: string, extra: Record<string, unknown> = {}) => ({ name, standard: '7', syllabus: 'kerala', medium: 'malayalam', school: 'GHSS Aluva', state: 'Kerala', district: 'Ernakulam', place: 'Aluva', password: 'secret1', confirm: 'secret1', motherTongue: 'Malayalam', ...extra });
const days = (n: number) => istToday(Date.now() + n * 86_400_000);

describe('messages, banner data, the office page and the teacher mark', () => {
  let admin = '', anjali = '', arjun = '', arjunId = '', anjaliId = '', classCode = '', classKey = '';
  const officeMsgs = async (studentId: string) => {
    const { readThread } = await import('@/lib/ai-guru/messages/store');
    const { threadIdFor } = await import('@/lib/ai-guru/messages/core');
    return ((await readThread(threadIdFor('student-admin', studentId)))?.messages ?? []).map((m: { text: string }) => m.text);
  };
  beforeAll(async () => {
    process.chdir(mkdtempSync(path.join(tmpdir(), 'dues-')));
    process.env.ADMIN_USERNAME = 'office'; process.env.ADMIN_PASSWORD = 'office-pass-2026'; process.env.AI_GURU_PROXY_HOPS = '1';
    for (const [k, p] of Object.entries({ login: 'admin/login', aff: 'admin/affiliates', enrol: 'admin/enrolment', fees: 'admin/fees', classes: 'admin/classes', reg: 'admin/registers', dues: 'admin/dues', signup: 'student-portal/signup', me: 'student-portal/me', tc: 'teacher-classes' })) R[k] = await import(`@/app/api/ai-guru/${p}/route`);
    admin = sess(await R.login.POST(req({ username: 'office', password: 'office-pass-2026' })));
    await R.aff.POST(req({ action: 'settings', affiliate: { enabled: true, commissionPct: 10, discountPct: 10, payoutDay: 4 } }, admin));
    await R.enrol.POST(req({ action: 'settings', access: { enabled: true, freeParts: [1] } }, admin));
    const c = await j(await R.classes.POST(req({ action: 'create', kind: 'class', name: 'Std 7 Maths A', teacherName: 'Lekha Teacher' }, admin)));
    classCode = c.group.code; classKey = c.teacherKey;
    const a = await R.signup.POST(req(kid('Anjali Menon'))); anjali = sess(a);
    const am = await j(await R.me.GET(get(anjali))); anjaliId = am.student.id;
    const b = await R.signup.POST(req(kid('Arjun Nair', { coupon: am.affiliate.code, fromLink: true }))); arjun = sess(b);
    arjunId = (await j(await R.me.GET(get(arjun)))).student.id;
    // put Arjun in Lekha Teacher's class too
    const { update } = await import('./store');
    const { assignSerial } = await import('./class-content');
    await update((d) => { const s = d.students.find((x) => x.id === arjunId)!; const g = d.classes[0]; s.classId = g.id; assignSerial(g, s); });
  });

  it('the referrer is congratulated when a friend joins under them', async () => {
    const m = await officeMsgs(anjaliId);
    expect(m.some((t) => /Congratulations, Anjali! Arjun Nair \(Std 7, GHSS Aluva\) joined AI Guru with your link/.test(t))).toBe(true);
  });

  it('a first payment, then a bill past grace: the banner data says grace is over, and the reminder arrives once', async () => {
    const { update } = await import('./store');
    await update((d) => { d.invoices.push({ id: 'inv_a', studentId: arjunId, term: 'Term 1', items: [{ name: 'Fee', amount: 1000 }], discount: 0, dueDate: days(-40), payments: [], createdAt: new Date().toISOString() }); });
    expect((await j(await R.fees.POST(req({ action: 'pay', invoiceId: 'inv_a', amount: 1000, date: days(-40), mode: 'cash' }, admin)))).ok).toBe(true);
    // the referrer hears about the commission
    expect((await officeMsgs(anjaliId)).some((t) => /Arjun Nair paid their fee — you gained ₹100 commission/.test(t))).toBe(true);
    await update((d) => { d.invoices.push({ id: 'inv_b', studentId: arjunId, term: 'Term 2', items: [{ name: 'Fee', amount: 1000 }], discount: 0, dueDate: days(-8), payments: [], createdAt: new Date().toISOString() }); });
    const me = await j(await R.me.GET(get(arjun)));
    expect(me.dues.stage).toBe('over');
    expect(me.access).toMatchObject({ status: 'lapsed', full: false });
    await R.me.GET(get(arjun));
    const msgs = (await officeMsgs(arjunId)).filter((t) => /grace period is over, please make payment to continue/.test(t));
    expect(msgs).toHaveLength(1);
  });

  it('the office sees him on Fees due; extra days open the parts again; Remind sends again', async () => {
    const r = await j(await R.reg.GET(get(admin, '?sheet=dues')));
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ name: 'Arjun Nair', stage: 'over', total: 1000, daysOverdue: 8 });
    expect((await j(await R.dues.POST(req({ action: 'hold', studentId: arjunId, until: days(-1) }, admin)))).ok).toBe(false);
    expect((await j(await R.dues.POST(req({ action: 'hold', studentId: arjunId, until: days(7) }, admin)))).ok).toBe(true);
    expect((await j(await R.me.GET(get(arjun)))).access).toMatchObject({ status: 'enrolled', full: true });
    expect((await j(await R.reg.GET(get(admin, '?sheet=dues')))).rows[0]).toMatchObject({ stage: 'held', holdUntil: days(7) });
    await R.dues.POST(req({ action: 'clear', studentId: arjunId }, admin));
    const before = (await officeMsgs(arjunId)).length;
    expect((await j(await R.dues.POST(req({ action: 'remind', studentId: arjunId }, admin)))).sent).toBe(1);
    expect((await officeMsgs(arjunId)).length).toBe(before + 1);
    expect((await R.dues.POST(req({ action: 'remind', studentId: arjunId }))).status).toBe(404); // office only
  });

  it('the teacher sees "fee pending" (no amount); paying clears everything', async () => {
    const t = await j(await R.tc.POST(req({ code: classCode, key: classKey })));
    const row = t.roster.find((x: { name: string }) => x.name === 'Arjun Nair');
    expect(row.feePending).toBe(true);
    expect(JSON.stringify(row)).not.toMatch(/1000|amount/);
    expect((await j(await R.fees.POST(req({ action: 'pay', invoiceId: 'inv_b', amount: 1000, date: istToday(), mode: 'upi' }, admin)))).ok).toBe(true);
    const me = await j(await R.me.GET(get(arjun)));
    expect(me.dues.stage).toBeNull();
    expect(me.access).toMatchObject({ status: 'enrolled', full: true });
    expect((await j(await R.reg.GET(get(admin, '?sheet=dues')))).rows).toHaveLength(0);
  });
});
