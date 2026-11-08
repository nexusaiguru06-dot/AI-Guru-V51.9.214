// @vitest-environment node
/** V51.9.95: the study-material library end to end — sign-up syllabus → matching books → download; uploads and materials
 *  saved under who made them; privacy, hiding, review; creating on the cloud (AI call replaced by a fake). */
import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { mat, sampleBook } from '../material-studio/locks.fixtures';
import type { StudyMaterial } from '../material-studio/types';

let admin = '';
const R: Record<string, any> = {};
const req = (body: unknown, cookie = '', ip = '1.1.1.1') => new Request('http://x/a', { method: 'POST', headers: { cookie, 'x-forwarded-for': ip, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const get = (cookie = '', q = '') => new Request(`http://x/a${q}`, { headers: { cookie } });
const j = async (r: Response) => r.json();
const cookieOf = (r: Response) => r.headers.get('set-cookie')!.split(';')[0];
const form = (name: string, extra = {}) => ({ name, standard: '8', syllabus: 'kerala', medium: 'malayalam', school: 'GHSS', state: 'Kerala', district: 'Ernakulam', place: 'Aluva', password: 'secret1', confirm: 'secret1', ...extra });
let ip = 10;
const signup = async (name: string, extra = {}) => { const r = await R.signup.POST(req(form(name, extra), '', `40.0.0.${ip++}`)); const c = cookieOf(r); return { c, id: (await j(await R.me.GET(get(c)))).student.id as string }; };
let pdfBytes: Uint8Array;
const KEY = 'AIza' + 'k'.repeat(35);
const wait = async (f: () => boolean | Promise<boolean>) => { for (let i = 0; i < 150 && !(await f()); i++) await new Promise((r) => setTimeout(r, 20)); };

beforeAll(async () => {
  process.chdir(mkdtempSync(path.join(tmpdir(), 'lib-')));
  process.env.ADMIN_USERNAME = 'boss'; process.env.ADMIN_PASSWORD = 'correct-horse-battery';
  delete process.env.GEMINI_API_KEY;
  for (const [k, p] of Object.entries({ login: 'admin/login', enrol: 'admin/enrolment', alib: 'admin/library', signup: 'student-portal/signup', me: 'student-portal/me', lib: 'student-portal/library', jobs: 'library/jobs', sources: 'material-studio/sources/[id]', materials: 'material-studio/materials', index: 'material-studio/index' })) R[k] = await import(`@/app/api/ai-guru/${p}/route`);
  R.cloud = await import('@/lib/ai-guru/library/cloud');
  const store = await import('@/lib/ai-guru/material-studio/store');
  R.mstore = store;
  const pdf = await PDFDocument.create(); for (let p = 0; p < 50; p++) pdf.addPage([200, 200]);
  pdfBytes = await pdf.save();
  const hash = createHash('sha256').update(pdfBytes).digest('hex');
  const k8 = { ...sampleBook(), id: 'doc:k8', syllabus: 'kerala', grade: '8', sourceLanguage: 'malayalam', owner: { kind: 'admin' as const }, pdfHash: hash };
  await store.saveDocument(k8, Buffer.from(pdfBytes));
  await store.saveDocument({ ...sampleBook(), id: 'doc:k8en', syllabus: 'kerala', grade: '8', sourceLanguage: 'english', subject: 'Maths EN' }, Buffer.from(pdfBytes));
  await store.saveDocument({ ...sampleBook(), id: 'doc:c8', syllabus: 'cbse', grade: '8' }, Buffer.from(pdfBytes));
  await store.saveDocument({ ...sampleBook(), id: 'doc:k9', syllabus: 'kerala', grade: '9' }, Buffer.from(pdfBytes));
  await store.saveMaterial({ ...mat('m-mcq1', ['part-1'], [3], 'mcq'), documentId: 'doc:k8', owner: { kind: 'admin' } });
  admin = cookieOf(await R.login.POST(req({ username: 'boss', password: 'correct-horse-battery' })));
});

describe('study-material library', () => {
  it('a new student sees the books of their syllabus and standard (own medium first) and downloads one', async () => {
    const s = await signup('Arjun Nair');
    expect((await j(await R.me.GET(get(s.c)))).student).toMatchObject({ syllabus: 'kerala', medium: 'malayalam' });
    const g = await j(await R.lib.GET(get(s.c)));
    expect(g.books.map((b: any) => b.id)).toEqual(['doc:k8', 'doc:k8en']);
    expect(g.books[0]).toMatchObject({ by: 'AI Guru', mediumMatch: true, inLibrary: false, parts: expect.any(Array) });
    expect(g.books[0].parts[0].materials).toEqual([{ id: 'm-mcq1', type: 'mcq', by: 'AI Guru' }]);
    expect((await j(await R.lib.GET(get(s.c, '?all=1')))).books.length).toBe(4);
    await R.lib.POST(req({ action: 'add', documentId: 'doc:k8' }, s.c));
    expect((await j(await R.lib.GET(get(s.c)))).library).toEqual(['doc:k8']);
    expect((await R.lib.POST(req({ action: 'add', documentId: 'doc:none' }, s.c))).status).toBe(404);
    expect((await R.lib.GET(get())).status).toBe(401);
  });

  it('a student who signed up without a syllabus is asked for it', async () => {
    const s = await signup('Old App', { syllabus: undefined, medium: undefined });
    let g = await j(await R.lib.GET(get(s.c)));
    expect(g.profile).toMatchObject({ syllabus: '', medium: '' });
    expect(g.books).toEqual([]);
    expect((await R.lib.POST(req({ action: 'profile', syllabus: 'mars' }, s.c))).status).toBe(400);
    await R.lib.POST(req({ action: 'profile', syllabus: 'cbse', medium: 'english' }, s.c));
    g = await j(await R.lib.GET(get(s.c)));
    expect(g.books.map((b: any) => b.id)).toEqual(['doc:c8']);
  });

  it('the same PDF is not indexed again (V51.9.107: a guest gets the shared book too)', async () => {
    const fd = () => { const f = new FormData(); f.append('file', new File([pdfBytes.slice().buffer as ArrayBuffer], 'book.pdf', { type: 'application/pdf' })); f.append('pages', JSON.stringify([{ page: 1, text: 'x' }])); for (const [k, v] of Object.entries({ subject: 'Maths', grade: '8', syllabus: 'kerala', sourceLanguage: 'malayalam', teachingLanguage: 'malayalam' })) f.append(k, v); return f; };
    expect(await j(await R.index.POST(new Request('http://x/i', { method: 'POST', body: fd() })))).toMatchObject({ ok: true, reused: true, document: { id: 'doc:k8' } });
    const s = await signup('Uploader');
    const r = await R.index.POST(new Request('http://x/i', { method: 'POST', body: fd(), headers: { cookie: s.c } }));
    expect(r.status).toBe(403); // V51.9.211: students no longer upload books
    expect(await j(r)).toMatchObject({ ok: false, error: expect.stringMatching(/admin portal/) });
  });

  it('materials are saved under who made them; other students never see the maker’s name; hide and review', async () => {
    const a = await signup('Maker Student');
    const b = await signup('Other Student');
    // V51.9.107: without a sign-in the material is saved privately (a guest), never into the shared library
    expect(await j(await R.materials.POST(req({ material: { ...mat('m-x', ['part-1'], [2], 'qa'), documentId: 'doc:k8' } })))).toMatchObject({ ok: true, guest: true, material: { hidden: true, owner: { kind: 'guest' } } });
    const m = { ...mat('m-rev', ['part-1'], [4], 'revision-notes'), documentId: 'doc:k8' };
    // V51.9.211: a student cannot save materials any more; this one is seeded as an older student-made material
    expect((await R.materials.POST(req({ material: m }, a.c))).status).toBe(403);
    await R.mstore.saveMaterial({ ...m, owner: { kind: 'student', id: a.id, name: 'Maker Student', via: 'studio' } });
    const asOther = (await j(await R.materials.GET(get(b.c, '?documentId=doc:k8')))).materials.find((x: any) => x.id === 'm-rev');
    expect(asOther.owner).toEqual({ kind: 'student', via: 'studio' });
    const asAdmin = (await j(await R.materials.GET(get(admin, '?documentId=doc:k8')))).materials.find((x: any) => x.id === 'm-rev');
    expect(asAdmin.owner).toMatchObject({ kind: 'student', id: a.id, name: 'Maker Student' });
    // someone else cannot overwrite it
    expect((await R.materials.POST(req({ material: { ...m, title: 'mine now' } }, b.c))).status).toBe(403);
    // the library lists it under "A student"
    expect((await j(await R.lib.GET(get(b.c)))).books[0].parts[0].materials).toContainEqual({ id: 'm-rev', type: 'revision-notes', by: 'A student' });
    // the admin hides it: others no longer get it, its maker still does
    await R.alib.POST(req({ action: 'material', id: 'm-rev', hidden: true }, admin));
    expect((await j(await R.materials.GET(get(b.c, '?documentId=doc:k8')))).materials.some((x: any) => x.id === 'm-rev')).toBe(false);
    expect((await j(await R.materials.GET(get(a.c, '?documentId=doc:k8')))).materials.some((x: any) => x.id === 'm-rev')).toBe(true);
    // with review on, a new student material starts hidden
    await R.alib.POST(req({ action: 'settings', library: { reviewStudentWork: true, studentsMayCreate: false, dailyLimit: 5 } }, admin));
    await R.alib.POST(req({ action: 'settings', library: { reviewStudentWork: false, studentsMayCreate: false, dailyLimit: 5 } }, admin));
  });

  it('the student who uploaded a book opens all of it; others get the free part', async () => {
    const owner = await signup('Book Owner');
    const other = await signup('Book Reader');
    await R.mstore.saveDocument({ ...sampleBook(), id: 'doc:own', syllabus: 'kerala', grade: '8', owner: { kind: 'student', id: owner.id, name: 'Book Owner', via: 'studio' } }, Buffer.from(pdfBytes));
    await R.enrol.POST(req({ action: 'settings', access: { enabled: true, freeParts: [1] } }, admin));
    const mine = (await j(await R.sources.GET(get(owner.c), { params: Promise.resolve({ id: 'doc:own' }) }))).document;
    expect(mine.access.lockedParts).toEqual([]);
    expect(mine.owner).toMatchObject({ name: 'Book Owner' });
    const theirs = (await j(await R.sources.GET(get(other.c), { params: Promise.resolve({ id: 'doc:own' }) }))).document;
    expect(theirs.access.lockedParts).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(theirs.owner).toEqual({ kind: 'student', via: 'studio' });
    expect((await j(await R.lib.GET(get(owner.c)))).books.find((b: any) => b.id === 'doc:own')).toMatchObject({ by: 'You', own: true });
    await R.enrol.POST(req({ action: 'settings', access: { enabled: false, freeParts: [1] } }, admin));
  });

  it('creating on the cloud: key needed, existing materials reused, QA gate, student limits and parts', async () => {
    const pass = (type: string): StudyMaterial => ({ ...mat(`cloud-${type}-${Math.random().toString(36).slice(2, 6)}`, ['part-1'], [3], type as any), documentId: 'doc:k8', qa: { status: 'passed', score: 92, issues: [], checkedAt: '' } });
    R.cloud.setGenerator(async (_doc: string, type: string) => (type === 'worksheet' ? { ...pass(type), qa: { status: 'failed', score: 40, issues: ['bad'], checkedAt: '' } } : pass(type)));
    // no key yet
    expect((await R.jobs.POST(req({ documentId: 'doc:k8', part: 1, types: ['qa'] }, admin))).status).toBe(403);
    await R.alib.POST(req({ action: 'settings', library: { cloudKey: KEY, studentsMayCreate: false, dailyLimit: 2, reviewStudentWork: false } }, admin));
    const g = await j(await R.alib.GET(get(admin)));
    expect(g.settings.cloudKey).toBe(`${KEY.slice(0, 4)}…${KEY.slice(-4)}`);
    expect(JSON.stringify(g)).not.toContain(KEY);
    // admin: MCQ already exists for Part 1 → reused; Q&A and worksheet are made
    const r = await j(await R.jobs.POST(req({ documentId: 'doc:k8', part: 1, types: ['mcq', 'qa', 'worksheet'] }, admin)));
    expect(r.results.find((x: any) => x.type === 'mcq')).toMatchObject({ existing: 'm-mcq1' });
    const ids = r.results.filter((x: any) => x.job).map((x: any) => x.job.id);
    expect(ids.length).toBe(2);
    await wait(async () => (await Promise.all(ids.map((id: string) => R.cloud.getJob(id)))).every((j: any) => ['done', 'failed'].includes(j?.status)));
    const qa = await R.cloud.getJob(ids[0]), ws = await R.cloud.getJob(ids[1]);
    expect(qa).toMatchObject({ status: 'done' });
    expect((await R.mstore.getMaterial(qa.materialId)).owner).toEqual({ kind: 'admin', via: 'cloud' });
    expect(ws).toMatchObject({ status: 'failed', error: expect.stringMatching(/QA gate/) });
    // V51.9.187: students never create on the school cloud — they use their own key in Material Studio
    const s = await signup('Cloud Kid');
    expect((await R.jobs.POST(req({ documentId: 'doc:k8', part: 1, types: ['flashcards'] }, s.c))).status).toBe(403);
    await R.alib.POST(req({ action: 'settings', library: { studentsMayCreate: true, dailyLimit: 2, reviewStudentWork: false } }, admin));
    expect((await j(await R.lib.GET(get(s.c)))).cloud).toMatchObject({ allowed: false });
    const refused = await R.jobs.POST(req({ documentId: 'doc:k8', part: 1, types: ['mind-map'] }, s.c));
    expect(refused.status).toBe(403);
    expect((await j(refused)).error).toMatch(/own free Gemini key/);
    await R.enrol.POST(req({ action: 'settings', access: { enabled: true, freeParts: [1] } }, admin));
    R.cloud.setGenerator(null);
  });

  it('the admin fixes a book’s details, sees downloads, deletes a book (it leaves My books)', async () => {
    await R.alib.POST(req({ action: 'book', id: 'doc:k9', grade: '8', syllabus: 'kerala' }, admin));
    expect((await R.alib.POST(req({ action: 'book', id: 'doc:k9', syllabus: 'mars' }, admin))).status).toBe(400);
    const g = await j(await R.alib.GET(get(admin)));
    const k8 = g.books.find((b: any) => b.id === 'doc:k8');
    expect(k8.downloads).toBe(1);
    expect(k8.parts[0].materials.some((m: any) => m.owner.name === 'Maker Student')).toBe(true);
    expect(g.totals.byStudents).toBeGreaterThan(0);
    const s = await signup('Deleter Victim');
    await R.lib.POST(req({ action: 'add', documentId: 'doc:k9' }, s.c));
    await R.alib.POST(req({ action: 'deleteBook', id: 'doc:k9' }, admin));
    expect((await j(await R.lib.GET(get(s.c)))).library).toEqual([]);
    expect(await R.mstore.getDocument('doc:k9')).toBeNull();
  });
});

/* ---------------- V51.9.107: working without signing in ---------------- */
import { vi } from 'vitest';
import { deviceProfileFrom } from '../student/signup-profile';

describe('V51.9.107 guests (no sign-in)', () => {
  const newPdf = async (pages: number) => { const d = await PDFDocument.create(); for (let p = 0; p < pages; p++) d.addPage([210, 297]); return d.save(); };
  const fdOf = (bytes: Uint8Array, extra: Record<string, string> = {}) => { const f = new FormData(); f.append('file', new File([bytes.slice().buffer as ArrayBuffer], 'my-book.pdf', { type: 'application/pdf' })); f.append('pages', JSON.stringify([{ page: 1, text: 'Chapter 1 Fractions. A fraction is a part of a whole. '.repeat(8) }, { page: 2, text: 'Chapter 2 Decimals. Tenths and hundredths. '.repeat(8) }])); for (const [k, v] of Object.entries({ subject: 'Maths', grade: '7', syllabus: 'kerala', sourceLanguage: 'english', teachingLanguage: 'english', guestName: 'Anu', ...extra })) f.append(k, v); return f; };

  it('a guest uploads a book: private to their browser, never the server key or the cloud key', async () => {
    process.env.GEMINI_API_KEY = 'AIza' + 's'.repeat(35); // the server's own key: a guest must not use it
    await R.alib.POST(req({ action: 'settings', settings: { cloudKey: 'AIza' + 'c'.repeat(35), studentsMayCreate: true } }, admin)).catch(() => undefined);
    const spy = vi.spyOn(globalThis, 'fetch');
    try {
      const book = await newPdf(3);
      const res = await R.index.POST(new Request('http://x/i', { method: 'POST', body: fdOf(book) }));
      const body = await j(res);
      expect(body).toMatchObject({ ok: true, guest: true, document: { hidden: true, owner: { kind: 'guest', name: 'Anu', via: 'studio' } } });
      expect(body.document.chapters.length).toBeGreaterThan(0); // chapters found without AI
      const cookie = res.headers.get('set-cookie')!.split(';')[0];
      expect(cookie).toMatch(/^aiguru_guest=g_[a-z0-9]{24}$/);
      expect(res.headers.get('set-cookie')).toMatch(/HttpOnly/);
      const used = spy.mock.calls.map((c) => String(c[0]) + JSON.stringify(c[1] ?? {})).join('\n');
      expect(used).not.toContain('s'.repeat(35));
      expect(used).not.toContain('c'.repeat(35));
      const id = body.document.id as string;
      // this browser opens it; another browser, a signed-in student and the shared library do not see it
      expect((await R.sources.GET(get(cookie), { params: Promise.resolve({ id }) })).status).toBe(200);
      expect((await R.sources.GET(get('aiguru_guest=g_' + 'z'.repeat(24)), { params: Promise.resolve({ id }) })).status).toBe(404);
      expect((await R.sources.GET(get(), { params: Promise.resolve({ id }) })).status).toBe(404);
      const st = await signup('Neighbour Kid', { standard: '7' });
      expect((await R.sources.GET(get(st.c), { params: Promise.resolve({ id }) })).status).toBe(404);
      expect((await j(await R.lib.GET(get(st.c, '?all=1')))).books.map((b: any) => b.id)).not.toContain(id);
      // the admin sees who made it
      const al = await j(await R.alib.GET(get(admin)));
      expect(al.books.find((b: any) => b.id === id)?.owner).toMatchObject({ kind: 'guest', name: 'Anu' });
      // the guest uploads the same PDF again: their own book comes back (not indexed twice)
      expect(await j(await R.index.POST(new Request('http://x/i', { method: 'POST', body: fdOf(book), headers: { cookie } })))).toMatchObject({ ok: true, reused: true, document: { id } });

      // materials: saved privately; another guest cannot overwrite them
      const m = { ...mat('m-guest-1', ['part-1'], [1], 'mcq'), documentId: id };
      const saved = await R.materials.POST(req({ material: m, guestName: 'Anu' }, cookie));
      expect(await j(saved)).toMatchObject({ ok: true, guest: true, material: { hidden: true, owner: { kind: 'guest' } } });
      const other = await R.materials.POST(req({ material: m }, 'aiguru_guest=g_' + 'y'.repeat(24)));
      expect(other.status).toBe(403);
      const mine = await j(await R.materials.GET(new Request(`http://x/m?documentId=${encodeURIComponent(id)}`, { headers: { cookie } })));
      expect(mine.materials.map((x: any) => x.id)).toContain('m-guest-1');
      const theirs = await j(await R.materials.GET(new Request(`http://x/m?documentId=${encodeURIComponent(id)}`)));
      expect(theirs.materials.map((x: any) => x.id)).not.toContain('m-guest-1');
      // creating on the cloud (AI Guru's key) still needs a sign-in
      expect((await R.jobs.POST(req({ documentId: id, part: 1, types: ['mcq'] }, cookie))).status).toBe(401);
    } finally {
      spy.mockRestore();
      delete process.env.GEMINI_API_KEY;
    }
  });

  it('the sign-up form keeps what was typed on the device for the reels, without an account', () => {
    const had = { name: 'Old', standard: '6', school: 'Old School', place: 'Kochi' };
    expect(deviceProfileFrom({ name: '  Anu  Thomas ', standard: '8', school: '', place: 'Aluva', district: 'Ernakulam' }, had)).toEqual({ name: 'Anu Thomas', standard: '8', school: 'Old School', place: 'Aluva, Ernakulam' });
    expect(deviceProfileFrom({ name: '', standard: '', school: '', place: '', district: '' }, had)).toBeNull();
  });
});
