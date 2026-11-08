/** V51.9.180 (UX review) — Material Studio asks whether the visitor is signed in, and gets only the kind back. */
import { beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const R: Record<string, any> = {};
const post = (body: unknown, ip: string) => new Request('http://x/a', { method: 'POST', headers: { 'x-forwarded-for': ip, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const get = (cookie = '') => new Request('http://x/a', { headers: { cookie } });
const cookieOf = (r: Response) => r.headers.get('set-cookie')!.split(';')[0];

beforeAll(async () => {
  process.chdir(mkdtempSync(path.join(tmpdir(), 'whoami-')));
  process.env.ADMIN_USERNAME = 'boss'; process.env.ADMIN_PASSWORD = 'correct-horse-battery';
  for (const [k, p] of Object.entries({ whoami: 'material-studio/whoami', signup: 'student-portal/signup', login: 'admin/login' })) R[k] = await import(`@/app/api/ai-guru/${p}/route`);
});

describe('GET /api/ai-guru/material-studio/whoami', () => {
  it('a visitor who is not signed in', async () => {
    const r = await R.whoami.GET(get());
    expect(r.headers.get('cache-control')).toContain('no-store');
    expect(await r.json()).toEqual({ ok: true, signedIn: false, kind: 'guest' });
  });
  it('a signed-in student, and nothing about who they are', async () => {
    const s = await R.signup.POST(post({ name: 'Anu', standard: '8', syllabus: 'kerala', medium: 'malayalam', school: 'GHSS', state: 'Kerala', district: 'Ernakulam', place: 'Aluva', password: 'secret1', confirm: 'secret1' }, '41.0.0.1'));
    const body = await (await R.whoami.GET(get(cookieOf(s)))).json();
    expect(body).toEqual({ ok: true, signedIn: true, kind: 'student' });
  });
  it('the school office', async () => {
    const c = cookieOf(await R.login.POST(post({ username: 'boss', password: 'correct-horse-battery' }, '41.0.0.2')));
    expect(await (await R.whoami.GET(get(c))).json()).toEqual({ ok: true, signedIn: true, kind: 'admin' });
  });
});
