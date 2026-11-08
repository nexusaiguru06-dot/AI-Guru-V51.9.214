// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

describe('development sign-in xxx / yyy', () => {
  let login: typeof import('@/app/api/ai-guru/admin/login/route');
  let session: typeof import('@/app/api/ai-guru/admin/session/route');
  beforeAll(async () => {
    process.chdir(mkdtempSync(path.join(tmpdir(), 'adm2-')));
    delete process.env.ADMIN_USERNAME; delete process.env.ADMIN_PASSWORD;
    login = await import('@/app/api/ai-guru/admin/login/route');
    session = await import('@/app/api/ai-guru/admin/session/route');
  });
  const post = (u: string, p: string) => login.POST(new Request('http://x/l', { method: 'POST', body: JSON.stringify({ username: u, password: p }) }));
  it('xxx / yyy opens the admin session; anything else does not', async () => {
    expect((await post('xxx', 'nope')).status).toBe(401);
    const ok = await post('xxx', 'yyy');
    expect(ok.status).toBe(200);
    const c = ok.headers.get('set-cookie')!.split(';')[0];
    expect((await session.GET(new Request('http://x/s', { headers: { cookie: c } }))).status).toBe(200);
    expect((await session.GET(new Request('http://x/s'))).status).toBe(404);
  });
});
