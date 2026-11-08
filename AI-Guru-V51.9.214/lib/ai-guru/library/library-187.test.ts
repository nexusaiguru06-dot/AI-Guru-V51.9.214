// @vitest-environment node
/**
 * V51.9.187 — the library and the keys:
 *  • sign-in opens "Download your study materials" until a book is downloaded;
 *  • the classroom shelf shows a signed-in student's downloaded books (and nothing else);
 *  • the cloud key is the office's only (students use their own key for materials and doubts).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { mat, sampleBook } from '../material-studio/locks.fixtures';

const R: Record<string, any> = {};
let ipN = 1;
const req = (body: unknown, cookie = '') => new Request('http://x/a', { method: 'POST', headers: { cookie, 'x-forwarded-for': `61.0.0.${ipN++}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const get = (cookie = '', q = '') => new Request(`http://x/a${q}`, { headers: { cookie } });
const j = async (r: Response) => r.json();
const sess = (r: Response) => (r.headers.getSetCookie?.() ?? [r.headers.get('set-cookie') ?? '']).map((c) => c.split(';')[0]).filter((c) => /^aig_(student|admin)=/.test(c)).join('; ');
const KEY = 'AIza' + 'k'.repeat(35);
let admin = '';

describe('sign-in, the shelf and the school key', () => {
  let kid = '', password = 'secret1', code = '';
  beforeAll(async () => {
    process.chdir(mkdtempSync(path.join(tmpdir(), 'lib187-')));
    process.env.ADMIN_USERNAME = 'office'; process.env.ADMIN_PASSWORD = 'office-pass-2026';
    delete process.env.GEMINI_API_KEY;
    for (const [k, p] of Object.entries({ login: 'admin/login', alib: 'admin/library', signup: 'student-portal/signup', slogin: 'student-portal/login', me: 'student-portal/me', lib: 'student-portal/library', ready: 'material-studio/ready' })) R[k] = await import(`@/app/api/ai-guru/${p}/route`);
    const store = await import('@/lib/ai-guru/material-studio/store');
    const pdf = await PDFDocument.create(); for (let p = 0; p < 10; p++) pdf.addPage([200, 200]);
    const bytes = Buffer.from(await pdf.save());
    await store.saveDocument({ ...sampleBook(), id: 'doc:a', syllabus: 'kerala', grade: '8', owner: { kind: 'admin' } }, bytes);
    await store.saveDocument({ ...sampleBook(), id: 'doc:b', syllabus: 'kerala', grade: '8', owner: { kind: 'admin' } }, bytes);
    await store.saveMaterial({ ...mat('m-a', ['part-1'], [3], 'whiteboard-notes'), documentId: 'doc:a', owner: { kind: 'admin' } });
    await store.saveMaterial({ ...mat('m-b', ['part-1'], [3], 'mcq'), documentId: 'doc:b', owner: { kind: 'admin' } });
    admin = sess(await R.login.POST(req({ username: 'office', password: 'office-pass-2026' })));
    const r = await R.signup.POST(req({ name: 'Meera Das', standard: '8', syllabus: 'kerala', medium: 'malayalam', school: 'GHSS', state: 'Kerala', district: 'Ernakulam', place: 'Aluva', password, confirm: password, motherTongue: 'Malayalam' }));
    kid = sess(r);
    const me = await j(await R.me.GET(get(kid)));
    code = me.student.studentCode;
  });

  it('sign-in opens My books until a book is downloaded; then the account page', async () => {
    let r = await j(await R.slogin.POST(req({ admissionNo: code, pin: password })));
    expect(r).toMatchObject({ ok: true, books: 0, next: '/ai-guru/student/library?welcome=1' });
    await R.lib.POST(req({ action: 'add', documentId: 'doc:a' }, kid));
    r = await j(await R.slogin.POST(req({ admissionNo: code, pin: password })));
    expect(r).toMatchObject({ books: 1, next: '/ai-guru/student' });
  });

  it('the classroom shelf: a student sees only downloaded books; a visitor or the office sees every ready book', async () => {
    const mine = await j(await R.ready.GET(get(kid)));
    expect(mine).toMatchObject({ mine: true });
    expect(mine.books.map((b: { id: string }) => b.id)).toEqual(['doc:a']);
    const office = await j(await R.ready.GET(get(admin)));
    expect(office.mine).toBe(false);
    expect(office.books.map((b: { id: string }) => b.id).sort()).toEqual(['doc:a', 'doc:b']);
    // a downloaded book with no material yet is still on the student's shelf
    const store = await import('@/lib/ai-guru/material-studio/store');
    await store.saveDocument({ ...sampleBook(), id: 'doc:c', syllabus: 'kerala', grade: '8', owner: { kind: 'admin' } }, Buffer.from('%PDF'));
    await R.lib.POST(req({ action: 'add', documentId: 'doc:c' }, kid));
    expect((await j(await R.ready.GET(get(kid)))).books.map((b: { id: string }) => b.id).sort()).toEqual(['doc:a', 'doc:c']);
  });

  it('the cloud key is only the office’s: the setting cannot open it to students', async () => {
    expect((await j(await R.alib.POST(req({ action: 'settings', library: { cloudKey: KEY, studentsMayCreate: true, dailyLimit: 5, reviewStudentWork: false } }, admin)))).ok).toBe(true);
    expect((await j(await R.alib.GET(get(admin)))).settings).toMatchObject({ studentsMayCreate: false });
    expect((await j(await R.lib.GET(get(kid)))).cloud).toMatchObject({ allowed: false });
  });
});
