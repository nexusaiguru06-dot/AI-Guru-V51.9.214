// @vitest-environment node
/** V51.9.93: Part 1 free, Parts 2–10 for enrolled students — checked on every route that serves book content. */
import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { mat, sampleBook } from '../material-studio/locks.fixtures';

let admin = '';
const R: Record<string, any> = {};
const req = (body: unknown, cookie = '', ip = '1.1.1.1') => new Request('http://x/a', { method: 'POST', headers: { cookie, 'x-forwarded-for': ip, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const get = (cookie = '', q = '') => new Request(`http://x/a${q}`, { headers: { cookie } });
const j = async (r: Response) => r.json();
const cookieOf = (r: Response) => r.headers.get('set-cookie')!.split(';')[0];
const form = (name: string, extra = {}) => ({ name, standard: '8', school: 'GHSS', state: 'Kerala', district: 'Ernakulam', place: 'Aluva', password: 'secret1', confirm: 'secret1', ...extra });
const id = () => ({ params: Promise.resolve({ id: 'doc:test' }) });
let ip = 10;

async function pdfText(bytes: Uint8Array, page: number): Promise<string> {
  const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: bytes.slice(0), isEvalSupported: false }).promise;
  const tc = await (await doc.getPage(page)).getTextContent();
  const t = tc.items.map((i: any) => i.str).join(' ');
  await doc.destroy();
  return t;
}

beforeAll(async () => {
  process.chdir(mkdtempSync(path.join(tmpdir(), 'free-')));
  process.env.ADMIN_USERNAME = 'boss'; process.env.ADMIN_PASSWORD = 'correct-horse-battery';
  for (const [k, p] of Object.entries({ login: 'admin/login', fees: 'admin/fees', enrol: 'admin/enrolment', signup: 'student-portal/signup', me: 'student-portal/me', coupon: 'student-portal/coupon', sources: 'material-studio/sources/[id]', materials: 'material-studio/materials', pdf: 'material-studio/pdf/[id]', image: 'material-studio/page-image/[id]', repair: 'material-studio/repair-page/[id]' })) R[k] = await import(`@/app/api/ai-guru/${p}/route`);
  const store = await import('@/lib/ai-guru/material-studio/store');
  const pdf = await PDFDocument.create(); const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let p = 1; p <= 50; p++) pdf.addPage([400, 500]).drawText(`Secret text of page ${p}`, { x: 40, y: 250, size: 14, font });
  await store.saveDocument(sampleBook(), Buffer.from(await pdf.save()));
  await store.saveMaterial(mat('m1', ['part-1'], [2, 5], 'whiteboard-notes'));
  await store.saveMaterial(mat('m2', ['part-1'], [3], 'mcq'));
  await store.saveMaterial(mat('m3', ['part-2::ch2'], [12], 'mcq'));
  await store.saveMaterial(mat('m4', ['part-4'], [33], 'revision-notes'));
  admin = cookieOf(await R.login.POST(req({ username: 'boss', password: 'correct-horse-battery' })));
});

describe('free part and enrolment', () => {
  it('lock off (default): everything open to everyone, as before', async () => {
    const d = (await j(await R.sources.GET(get(), id()))).document;
    expect(d.access).toMatchObject({ full: true, lockedParts: [] });
    expect(d.sources.every((s: any) => s.text)).toBe(true);
    expect((await j(await R.materials.GET(get('', '?documentId=doc:test')))).materials.every((m: any) => !m.locked)).toBe(true);
  });

  it('lock on: a visitor gets Part 1 in full and only stubs of Parts 2–10', async () => {
    expect((await R.enrol.POST(req({ action: 'settings', access: { enabled: true, freeParts: [1] } }, admin))).status).toBe(200);
    const d = (await j(await R.sources.GET(get(), id()))).document;
    expect(d.access).toMatchObject({ full: false, signedIn: false, freeParts: [1], lockedParts: [2, 3, 4, 5, 6, 7, 8, 9, 10] });
    expect(d.sources.filter((s: any) => s.text).map((s: any) => s.page)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const ms = (await j(await R.materials.GET(get('', '?documentId=doc:test')))).materials;
    const by = Object.fromEntries(ms.map((m: any) => [m.id, m]));
    expect(by.m1).toMatchObject({ part: 1, sections: [{ content: 'secret question' }] });
    expect(by.m2.locked).toBeUndefined();
    expect(by.m3).toMatchObject({ part: 2, locked: true, sections: [] });
    expect(by.m4).toMatchObject({ part: 4, locked: true, sections: [], type: 'revision-notes' });
    expect(JSON.stringify([by.m3, by.m4])).not.toContain('secret');
    // page image of a locked page is a lock picture, never the page
    const img = await R.image.GET(new Request('http://x/i?page=15'), id());
    expect(img.headers.get('x-page-locked')).toBe('1');
    expect(await img.text()).toContain('Part 2');
    // the PDF keeps 50 pages, but locked pages have none of their text
    const pdf = new Uint8Array(await (await R.pdf.GET(get(), id())).arrayBuffer());
    expect((await PDFDocument.load(pdf)).getPageCount()).toBe(50);
    expect(await pdfText(pdf, 3)).toContain('Secret text of page 3');
    const p15 = await pdfText(pdf, 15);
    expect(p15).not.toContain('Secret');
    expect(p15).toContain('Part 2');
    // re-reading a locked page is refused (it would return its text)
    expect((await R.repair.POST(req({ page: 15 }), id())).status).toBe(403);
    // the sign-up page is told what is free
    expect((await j(await R.coupon.GET(new Request('http://x/c', { headers: { 'x-forwarded-for': '9.9.9.9' } })))).access).toEqual({ enabled: true, freeParts: [1] });
  });

  it('a new student studies Part 1; after the first payment every part opens', async () => {
    const s = await R.signup.POST(req(form('Arjun Nair'), '', `30.0.0.${ip++}`));
    const c = cookieOf(s);
    const me = await j(await R.me.GET(get(c)));
    expect(me.access).toMatchObject({ status: 'free', full: false, freeParts: [1] });
    let d = (await j(await R.sources.GET(get(c), id()))).document;
    expect(d.access).toMatchObject({ full: false, signedIn: true, studentCode: me.student.studentCode });
    // fee shown on the lock notice
    await R.fees.POST(req({ action: 'head', head: { name: 'Tuition', amount: 1000, standard: 'all' } }, admin));
    d = (await j(await R.sources.GET(get(c), id()))).document;
    expect(d.access.fee).toBe(1000);
    // the office bills and records a payment
    await R.fees.POST(req({ action: 'invoice', studentId: me.student.id, term: 'T1' }, admin));
    expect((await j(await R.sources.GET(get(c), id()))).document.access.due).toBe(1000);
    const inv = (await j(await R.fees.GET(get(admin)))).invoices.find((i: any) => i.studentId === me.student.id);
    await R.fees.POST(req({ action: 'pay', invoiceId: inv.id, amount: 500, date: '2026-10-20', mode: 'upi' }, admin));
    d = (await j(await R.sources.GET(get(c), id()))).document;
    expect(d.access).toMatchObject({ full: true, lockedParts: [] });
    expect(d.sources.every((s: any) => s.text)).toBe(true);
    expect((await j(await R.materials.GET(get(c, '?documentId=doc:test')))).materials.find((m: any) => m.id === 'm4').sections.length).toBe(1);
    expect(await pdfText(new Uint8Array(await (await R.pdf.GET(get(c), id())).arrayBuffer()), 15)).toContain('Secret text of page 15');
    expect((await j(await R.me.GET(get(c)))).access).toMatchObject({ status: 'enrolled', enrolledBy: 'payment' });
  });

  it('the admin sees books with their parts and materials, and can free a part for one book', async () => {
    const g = await j(await R.enrol.GET(get(admin)));
    const book = g.books.find((b: any) => b.id === 'doc:test');
    expect(book.parts.map((p: any) => [p.index, p.startPage, p.endPage, p.free])).toEqual([[1, 1, 10, true], [2, 11, 20, false], [3, 21, 30, false], [4, 31, 40, false], [5, 41, 50, false], [6, 51, 60, false], [7, 61, 70, false], [8, 71, 80, false], [9, 81, 90, false], [10, 91, 100, false]]);
    expect(book.parts[0].materials.sort()).toEqual(['mcq', 'whiteboard-notes']);
    expect(book.parts[3].materials).toEqual(['revision-notes']);
    expect(g.totals).toMatchObject({ enrolled: 1, free: 0 });
    await R.enrol.POST(req({ action: 'book', documentId: 'doc:test', freeParts: [1, 2] }, admin));
    let d = (await j(await R.sources.GET(get(), id()))).document;
    expect(d.access.lockedParts).toEqual([3, 4, 5, 6, 7, 8, 9, 10]);
    expect((await j(await R.materials.GET(get('', '?documentId=doc:test')))).materials.find((m: any) => m.id === 'm3').locked).toBeUndefined();
    await R.enrol.POST(req({ action: 'book', documentId: 'doc:test', freeParts: null }, admin));
    d = (await j(await R.sources.GET(get(), id()))).document;
    expect(d.access.lockedParts).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect((await R.enrol.POST(req({ action: 'book', documentId: 'doc:test', freeParts: [11] }, admin))).status).toBe(400);
    // a free seat opens everything; undo closes it again
    const s = await R.signup.POST(req(form('Staff Child'), '', `30.0.0.${ip++}`));
    const c = cookieOf(s);
    const sid = (await j(await R.me.GET(get(c)))).student.id;
    await R.enrol.POST(req({ action: 'enrol', studentId: sid, note: 'Staff' }, admin));
    expect((await j(await R.sources.GET(get(c), id()))).document.access.full).toBe(true);
    await R.enrol.POST(req({ action: 'unenrol', studentId: sid }, admin));
    expect((await j(await R.sources.GET(get(c), id()))).document.access.full).toBe(false);
    // the admin always sees every part
    expect((await j(await R.sources.GET(get(admin), id()))).document.access.full).toBe(true);
  });
});
