/**
 * V51.9.176 — the four fixes from the EGM review:
 *   B1 the visitor's address cannot be forged on Cloud Run (lockout and request limits),
 *   B2 the server's paid keys are used only for signed-in users,
 *   M4 a file-read error never turns into an empty record that is saved over the real one,
 *   M6 on a live site a saved (copied) admin sign-in such as xxx / yyy is never accepted.
 */
import { promises as fsp, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clientIp, platform } from './client-ip';

const req = (h: Record<string, string>) => ({ headers: new Headers(h) });

describe('B1 — client address', () => {
  it('on Cloud Run a forged Netlify header is ignored; the last X-Forwarded-For entry (added by Google) counts', () => {
    const env = { K_SERVICE: 'ai-guru' } as NodeJS.ProcessEnv;
    expect(platform(env)).toBe('cloud-run');
    expect(clientIp(req({ 'x-nf-client-connection-ip': '1.2.3.4', 'x-forwarded-for': '9.9.9.9, 5.6.7.8' }), env)).toBe('5.6.7.8');
    // a new forged value each time still maps to the same real address
    expect(clientIp(req({ 'x-nf-client-connection-ip': '7.7.7.7', 'x-forwarded-for': '8.8.8.8, 5.6.7.8' }), env)).toBe('5.6.7.8');
  });
  it('on Netlify the Netlify header is used', () => {
    expect(clientIp(req({ 'x-nf-client-connection-ip': '1.2.3.4', 'x-forwarded-for': '9.9.9.9' }), { AI_GURU_PLATFORM: 'netlify' } as NodeJS.ProcessEnv)).toBe('1.2.3.4');
    expect(clientIp(req({ 'x-nf-client-connection-ip': '1.2.3.4' }), { NETLIFY_BLOBS_CONTEXT: 'x' } as NodeJS.ProcessEnv)).toBe('1.2.3.4');
  });
  it('on a laptop every header is ignored', () => {
    expect(clientIp(req({ 'x-nf-client-connection-ip': '1.2.3.4', 'x-forwarded-for': '9.9.9.9' }), {} as NodeJS.ProcessEnv)).toBe('local');
  });
  it('Cloud Run wins over a Netlify setting (never trust the Netlify header on Google)', () => {
    expect(platform({ K_SERVICE: 'x', AI_GURU_PLATFORM: 'netlify' } as NodeJS.ProcessEnv)).toBe('cloud-run');
  });
});

describe('B2 — server keys only for signed-in users', () => {
  const saved = { ...process.env };
  let cookie: string | null = null;
  beforeEach(() => {
    vi.resetModules();
    process.env.AI_GURU_DATA_ROOT = mkdtempSync(path.join(tmpdir(), 'keys-'));
    process.env.GEMINI_API_KEY = 'server-gemini-key';
    process.env.ADMIN_USERNAME = 'boss'; process.env.ADMIN_PASSWORD = 'a-long-password-1'; process.env.ADMIN_SESSION_SECRET = 's';
    process.env.AI_GURU_SERVER_KEYS = 'signed-in';
    vi.doMock('next/headers', () => ({ headers: async () => { if (cookie === null) throw new Error('outside a request'); return new Headers({ cookie }); } }));
  });
  afterEach(() => { process.env = { ...saved }; vi.doUnmock('next/headers'); cookie = null; });

  it('a visitor who is not signed in does not get the server key', async () => {
    cookie = '';
    const { serverKey } = await import('./server-keys');
    expect(await serverKey('GEMINI_API_KEY')).toBeUndefined();
    cookie = 'aig_student=forged.9999999999999.abc';
    expect(await serverKey('GEMINI_API_KEY')).toBeUndefined();
  });
  it('a signed-in student, teacher or admin gets it', async () => {
    const auth = await import('../admin/auth');
    const { serverKey } = await import('./server-keys');
    cookie = `aig_student=${encodeURIComponent((await auth.makeStudentSession('st_1')).value)}`;
    expect(await serverKey('GEMINI_API_KEY')).toBe('server-gemini-key');
    cookie = `aig_teacher=${encodeURIComponent((await auth.makeTeacherSession('cl_1')).value)}`;
    expect(await serverKey('GEMINI_API_KEY')).toBe('server-gemini-key');
    cookie = `aig_admin=${encodeURIComponent((await auth.makeSession()).value)}`;
    expect(await serverKey('GEMINI_API_KEY')).toBe('server-gemini-key');
  });
  it('outside a web request (scripts, tests) the key is allowed; AI_GURU_SERVER_KEYS=everyone allows all', async () => {
    cookie = null;
    const { serverKey } = await import('./server-keys');
    expect(await serverKey('GEMINI_API_KEY')).toBe('server-gemini-key');
    cookie = '';
    process.env.AI_GURU_SERVER_KEYS = 'everyone';
    expect(await serverKey('GEMINI_API_KEY')).toBe('server-gemini-key');
  });
  it('the default is signed-in on a live site and everyone on a laptop', async () => {
    const { keyPolicy } = await import('./server-keys');
    delete process.env.AI_GURU_SERVER_KEYS;
    (process.env as Record<string, string>).NODE_ENV = 'production';
    expect(keyPolicy()).toBe('signed-in');
    (process.env as Record<string, string>).NODE_ENV = 'development';
    expect(keyPolicy()).toBe('everyone');
  });
  it('Sarvam voice: a visitor without a key gets a clear "sign in" error instead of using the server key', async () => {
    cookie = '';
    process.env.SARVAM_API_KEY = 'server-sarvam-key';
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { sarvamTTS } = await import('../tts/providers');
    await expect(sarvamTTS({ text: 'hello', languageCode: 'en-IN' } as never)).rejects.toThrow('Sign in');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe('M4 — a read error never wipes saved records (local files on a laptop)', () => {
  const saved = { ...process.env };
  beforeEach(() => { delete process.env.AI_GURU_STORE; });
  afterEach(() => { process.env = { ...saved }; vi.restoreAllMocks(); });

  it('a busy or locked file makes the change fail, and the real record stays', async () => {
    vi.resetModules();
    const root = mkdtempSync(path.join(tmpdir(), 'wipe-'));
    process.env.AI_GURU_DATA_ROOT = root;
    delete process.env.AI_GURU_STORE;
    const { update, readData } = await import('../admin/store');
    await update((d) => { d.students.push({ id: 'st_1', name: 'Anu' } as never); });
    expect((await readData()).students).toHaveLength(1);

    const real = fsp.readFile.bind(fsp);
    const spy = vi.spyOn(fsp, 'readFile').mockImplementation((async (...a: Parameters<typeof fsp.readFile>) => {
      if (String(a[0]).endsWith('records.json')) throw Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' });
      return real(...a);
    }) as typeof fsp.readFile);
    await expect(update((d) => { d.students.push({ id: 'st_2', name: 'Ravi' } as never); })).rejects.toThrow('EBUSY');
    spy.mockRestore();

    const after = await readData();
    expect(after.students.map((s) => s.id)).toEqual(['st_1']); // not wiped, not overwritten
  });
  it('a damaged record is not treated as empty either', async () => {
    vi.resetModules();
    const root = mkdtempSync(path.join(tmpdir(), 'bad-'));
    process.env.AI_GURU_DATA_ROOT = root;
    await fsp.mkdir(path.join(root, 'data/ai-guru/admin'), { recursive: true });
    await fsp.writeFile(path.join(root, 'data/ai-guru/admin/records.json'), '{"students":[{"id":"st_1"');
    const { update } = await import('../admin/store');
    await expect(update(() => undefined)).rejects.toThrow('not valid JSON');
    expect(await fsp.readFile(path.join(root, 'data/ai-guru/admin/records.json'), 'utf8')).toBe('{"students":[{"id":"st_1"');
  });
});

describe('M6 — a saved admin sign-in is ignored on a live site', () => {
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; });

  it('V51.9.214: the demo xxx / yyy works on a live site only while no ADMIN_* sign-in is set', async () => {
    vi.resetModules();
    const root = mkdtempSync(path.join(tmpdir(), 'adm-'));
    process.env.AI_GURU_DATA_ROOT = root;
    delete process.env.ADMIN_USERNAME; delete process.env.ADMIN_PASSWORD; delete process.env.AI_GURU_ALLOW_DEV_ADMIN; delete process.env.AI_GURU_NO_DEMO_ADMIN;
    (process.env as Record<string, string>).NODE_ENV = 'production';
    const demo = await import('../admin/auth');
    expect(await demo.checkCredentials('xxx', 'yyy')).toBe(true); // demo site with nothing set: the owner's xxx / yyy

    process.env.ADMIN_USERNAME = 'office'; process.env.ADMIN_PASSWORD = 'a-long-real-password';
    vi.resetModules();
    const live = await import('../admin/auth');
    expect(await live.checkCredentials('xxx', 'yyy')).toBe(false); // a real sign-in is set: the demo one stops by itself
    expect(await live.checkCredentials('office', 'a-long-real-password')).toBe(true);

    delete process.env.ADMIN_USERNAME; delete process.env.ADMIN_PASSWORD; process.env.AI_GURU_NO_DEMO_ADMIN = '1';
    vi.resetModules();
    const off = await import('../admin/auth');
    expect(await off.checkCredentials('xxx', 'yyy')).toBe(false); // switched off on purpose
  });
  it('the copy script skips auth.json', async () => {
    const src = await fsp.readFile(path.join(__dirname, '../../../scripts/cloud/copy-data-to-cloud.ts'), 'utf8');
    expect(src).toMatch(/auth\\\.json/);
  });
});
