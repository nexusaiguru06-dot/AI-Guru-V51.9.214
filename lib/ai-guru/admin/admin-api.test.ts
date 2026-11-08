// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

let login: typeof import('@/app/api/ai-guru/admin/login/route');
let students: typeof import('@/app/api/ai-guru/admin/students/route');
let fees: typeof import('@/app/api/ai-guru/admin/fees/route');
let cookie = '';
const J = (body: unknown, c = cookie, method = 'POST') => new Request('http://x/api', { method, headers: { 'content-type': 'application/json', cookie: c }, body: JSON.stringify(body) });
const G = (url = 'http://x/api', c = cookie) => new Request(url, { headers: { cookie: c } });

beforeAll(async () => {
  process.chdir(mkdtempSync(path.join(tmpdir(), 'adm-')));
  process.env.ADMIN_USERNAME = 'boss'; process.env.ADMIN_PASSWORD = 'correct-horse-battery';
  login = await import('@/app/api/ai-guru/admin/login/route');
  students = await import('@/app/api/ai-guru/admin/students/route');
  fees = await import('@/app/api/ai-guru/admin/fees/route');
});

describe('admin sign-in and portal', () => {
  it('hides everything until the admin signs in; wrong details give a bare 401', async () => {
    expect((await students.GET(G())).status).toBe(404);
    const bad = await login.POST(J({ username: 'boss', password: 'nope' }, ''));
    expect(bad.status).toBe(401);
    expect(await bad.json()).toEqual({ ok: false });
    const ok = await login.POST(J({ username: 'boss', password: 'correct-horse-battery' }, ''));
    expect(ok.status).toBe(200);
    cookie = ok.headers.get('set-cookie')!.split(';')[0];
    expect(ok.headers.get('set-cookie')).toMatch(/HttpOnly/i);
    expect((await students.GET(G())).status).toBe(200);
    expect((await students.GET(G('http://x/api', 'aig_admin=1.deadbeef'))).status).toBe(404);
  });
  it('locks out after repeated misses', async () => {
    const r = new Request('http://x/api', { method: 'POST', headers: { 'x-forwarded-for': '9.9.9.9' }, body: JSON.stringify({ username: 'a', password: 'b' }) });
    for (let i = 0; i < 5; i++) await login.POST(new Request(r.url, { method: 'POST', headers: r.headers, body: JSON.stringify({ username: 'a', password: 'b' }) }));
    expect((await login.POST(new Request(r.url, { method: 'POST', headers: r.headers, body: JSON.stringify({ username: 'boss', password: 'correct-horse-battery' }) }))).status).toBe(429);
  });
  it('student with address → head → invoice → payment with receipt → no overpay', async () => {
    const bad = await students.POST(J({ student: { name: 'A', standard: '8', address: { line1: 'x', area: 'y', state: 'Kerala', district: 'Chennai', pincode: '683542' } } }));
    expect(bad.status).toBe(400);
    const s = await (await students.POST(J({ student: { name: 'Anjali Menon', standard: '8', guardianPhone: '9876543210', address: { line1: 'Rose Villa', area: 'Perumbavoor', state: 'Kerala', district: 'Ernakulam', pincode: '683542' } } }))).json();
    expect(s.ok).toBe(true);
    await fees.POST(J({ action: 'head', head: { name: 'Tuition', amount: 1500, standard: 'all' } }));
    const gen = await (await fees.POST(J({ action: 'generate', standard: '8', term: 'T1', dueDate: '2099-01-01' }))).json();
    expect(gen.created).toBe(1);
    expect((await (await fees.POST(J({ action: 'generate', standard: '8', term: 'T1' }))).json()).created).toBe(0);
    const inv = (await (await fees.GET(G())).json()).invoices[0];
    const over = await fees.POST(J({ action: 'pay', invoiceId: inv.id, amount: 2000, date: '2026-10-18', mode: 'upi' }));
    expect(over.status).toBe(400);
    const pay = await (await fees.POST(J({ action: 'pay', invoiceId: inv.id, amount: 500, date: '2026-10-18', mode: 'upi' }))).json();
    expect(pay.payment.receiptNo).toBe('RCP-2026-00001');
    const all = await (await fees.GET(G())).json();
    expect(all.summary).toMatchObject({ billed: 1500, collected: 500, due: 1000 });
    expect((await fees.POST(J({ action: 'removeInvoice', id: inv.id }))).status).toBe(409);
    expect((await students.DELETE(G(`http://x/api?id=${s.student.id}`, cookie) as Request)).status).toBe(409);
    expect((await (await fees.GET(G('http://x/api?format=csv'))).text())).toMatch(/Anjali Menon,8,T1,1500,500,1000,partial/);
  });
});
