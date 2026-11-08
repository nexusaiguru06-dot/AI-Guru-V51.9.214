// @vitest-environment node
/**
 * V51.9.192 — pay to open: Parts 3–5 have no due date (no reminders); a part that is not paid cannot be used to make
 * study materials — even with the student's own key and for their own upload; paying a part makes its study materials
 * automatically (shared in the library) and tells the student.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { duesOf } from './dues';
import type { Invoice } from './fees';

describe('no reminders for the later parts', () => {
  it('a part bill without a due date is never "due"; Part 2 with its date is', () => {
    const b = (part: number, dueDate?: string): Invoice => ({ id: `i${part}`, studentId: 's', term: `Part ${part}`, items: [{ name: 'x', amount: 2000 }], discount: 0, payments: [], createdAt: '2026-01-01T00:00:00Z', partBill: { part }, ...(dueDate ? { dueDate } : {}) });
    expect(duesOf({ id: 's' }, [b(2, '2026-11-10'), b(3), b(4), b(5)], [], '2026-12-31', 5).map((d) => d.label)).toEqual(['Part 2']);
  });
});

const R: Record<string, any> = {};
let ipN = 1;
const req = (body: unknown, cookie = '') => new Request('http://x/a', { method: 'POST', headers: { cookie, 'x-forwarded-for': `66.0.0.${ipN++}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const get = (cookie = '', q = '') => new Request(`http://x/a${q}`, { headers: { cookie } });
const j = async (r: Response) => r.json();
const sess = (r: Response) => (r.headers.getSetCookie?.() ?? [r.headers.get('set-cookie') ?? '']).map((c) => c.split(';')[0]).filter((c) => /^aig_(student|admin)=/.test(c)).join('; ');
const KEY = 'AIza' + 'm'.repeat(35);

describe('pay to open', () => {
  let admin = '', kid = '', kidId = '';
  const msgs = async () => {
    const { readThread } = await import('@/lib/ai-guru/messages/store');
    const { threadIdFor } = await import('@/lib/ai-guru/messages/core');
    return (await readThread(threadIdFor('student-admin', kidId)))?.messages ?? [];
  };
  beforeAll(async () => {
    process.chdir(mkdtempSync(path.join(tmpdir(), 'open192-')));
    process.env.ADMIN_USERNAME = 'office'; process.env.ADMIN_PASSWORD = 'office-pass-2026';
    delete process.env.GEMINI_API_KEY;
    for (const [k, p] of Object.entries({ login: 'admin/login', enrol: 'admin/enrolment', alib: 'admin/library', fees: 'admin/fees', signup: 'student-portal/signup', me: 'student-portal/me', lib: 'student-portal/library', mats: 'material-studio/materials', src: 'material-studio/sources/[id]' })) R[k] = await import(`@/app/api/ai-guru/${p}/route`);
    R.cloud = await import('@/lib/ai-guru/library/cloud');
    R.cloud.setGenerator(async (_l: unknown, type: string, sources: Array<{ id: string; page: number }>) => ({ id: `m_${type}_${sources[0]?.page}_${Math.random().toString(36).slice(2, 6)}`, documentId: '', type, title: type, overview: '', sections: [], sources, materialLanguages: ['english'], qa: { status: 'passed', score: 90, issues: [] }, createdAt: new Date().toISOString() }));
    const { sampleBook } = await import('../material-studio/locks.fixtures');
    const store = await import('../material-studio/store');
    const { PDFDocument } = await import('pdf-lib');
    const pdf = await PDFDocument.create(); for (let p = 0; p < 50; p++) pdf.addPage([200, 200]);
    const bytes = Buffer.from(await pdf.save());
    await store.saveDocument({ ...sampleBook(), id: 'doc:k8', syllabus: 'kerala', grade: '8', owner: { kind: 'admin' } }, bytes);
    admin = sess(await R.login.POST(req({ username: 'office', password: 'office-pass-2026' })));
    await R.alib.POST(req({ action: 'settings', library: { cloudKey: KEY, dailyLimit: 5, reviewStudentWork: false } }, admin));
    await R.enrol.POST(req({ action: 'settings', access: { enabled: true, freeParts: [1], partPlan: { enabled: true, partPrice: 2000, upfrontPrice: 7000, trialDays: 7 } } }, admin));
    kid = sess(await R.signup.POST(req({ name: 'Meera Das', standard: '8', syllabus: 'kerala', medium: 'malayalam', school: 'GHSS', state: 'Kerala', district: 'Ernakulam', place: 'Aluva', password: 'secret1', confirm: 'secret1', motherTongue: 'Malayalam' })));
    kidId = (await j(await R.me.GET(get(kid)))).student.id;
    await R.lib.POST(req({ action: 'add', documentId: 'doc:k8' }, kid));
    // the student's own upload of another book
    await store.saveDocument({ ...sampleBook(), id: 'doc:own', syllabus: 'kerala', grade: '8', owner: { kind: 'student', id: kidId, name: 'Meera Das' } }, bytes);
  });

  const material = (documentId: string, page: number) => ({ id: `mine_${documentId}_${page}`, documentId, type: 'mcq', title: 'My MCQ', overview: '', sections: [], sources: [{ id: 'x', page, text: 't' }], materialLanguages: ['english'], qa: { status: 'passed', score: 90, issues: [] }, createdAt: new Date().toISOString() });
  const pageOfPart = async (documentId: string, part: number) => { const d = (await j(await R.src.GET(get(admin), { params: Promise.resolve({ id: documentId }) }))).document; return d.parts.find((p: any) => p.index === part).startPage as number; };

  it('the book tells the student which parts cannot be used to make materials, and the price', async () => {
    const d = (await j(await R.src.GET(get(kid), { params: Promise.resolve({ id: 'doc:k8' }) }))).document;
    expect(d.access).toMatchObject({ createLocked: [2, 3, 4, 5, 6, 7, 8, 9, 10], partPrice: 2000 });
    const own = (await j(await R.src.GET(get(kid), { params: Promise.resolve({ id: 'doc:own' }) }))).document;
    expect(own.access).toMatchObject({ full: true, createLocked: [2, 3, 4, 5, 6, 7, 8, 9, 10] }); // can read their own book, not make paid parts
  });

  it('V51.9.211: a student cannot save materials at all (the office makes them); the office is never limited', async () => {
    const r = await R.mats.POST(req({ material: material('doc:k8', await pageOfPart('doc:k8', 3)) }, kid));
    expect(r.status).toBe(403);
    expect(await j(r)).toMatchObject({ ok: false, error: expect.stringMatching(/admin portal/) });
    expect((await R.mats.POST(req({ material: material('doc:k8', await pageOfPart('doc:k8', 1)) }, kid))).status).toBe(403);
    expect((await j(await R.mats.POST(req({ material: { ...material('doc:k8', await pageOfPart('doc:k8', 4)), id: 'office_m' } }, admin)))).ok).toBe(true);
  });

  it('paying Part 2: it opens, its study materials are made automatically, and the student is told', async () => {
    const { readData } = await import('./store');
    const p2 = (await readData()).invoices.find((i) => i.studentId === kidId && i.partBill?.part === 2)!;
    expect((await j(await R.fees.POST(req({ action: 'pay', invoiceId: p2.id, amount: 2000, date: '2026-11-03', mode: 'cash' }, admin)))).ok).toBe(true);
    const m = (await msgs()).find((x: any) => /Part 2 is open in all your books/.test(x.text));
    expect(m).toBeTruthy();
    expect(m.text).toMatch(/being made for you now/);
    expect(m.action).toMatchObject({ href: '/ai-guru/student/library' });
    const jobs = (await R.cloud.jobsFor({ kind: 'admin' })).filter((x: any) => x.part === 2);
    expect(jobs.length).toBeGreaterThan(0);
    expect(new Set(jobs.map((x: any) => x.documentId))).toEqual(new Set(['doc:k8', 'doc:own']));
    // and now Part 2 can be used to make materials, Part 3 still not
    const d = (await j(await R.src.GET(get(kid), { params: Promise.resolve({ id: 'doc:k8' }) }))).document;
    expect(d.access.createLocked).toEqual([3, 4, 5, 6, 7, 8, 9, 10]);
    R.cloud.setGenerator(null);
  });
});
