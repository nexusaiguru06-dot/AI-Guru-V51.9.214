// @vitest-environment node
/**
 * V51.9.196 — fixes from the security check (ECC security-review checklist):
 *  • one account cannot be guessed from many addresses (20 wrong tries on an account, from anywhere, lock it 15 min);
 *  • a secret header with unusual characters is refused (401), never a server error;
 *  • HSTS and a content policy on every page.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const R: Record<string, any> = {};
const req = (body: unknown, h: Record<string, string> = {}) => new Request('http://x/a', { method: 'POST', headers: { 'content-type': 'application/json', ...h }, body: JSON.stringify(body) });

describe('security check', () => {
  beforeAll(async () => {
    process.chdir(mkdtempSync(path.join(tmpdir(), 'sec196-')));
    process.env.K_SERVICE = 'ai-guru'; // Cloud Run: the caller's address is the last X-Forwarded-For entry
    for (const [k, p] of Object.entries({ slogin: 'student-portal/login', tlogin: 'school-teacher/login', alert: 'payments/bank-alert', cron: 'cron/fee-reminders' })) R[k] = await import(`@/app/api/ai-guru/${p}/route`);
  });

  it('one student account: wrong tries from many addresses lock it', async () => {
    const from = (n: number) => ({ 'x-forwarded-for': `70.1.${Math.floor(n / 250)}.${n % 250}` });
    for (let n = 0; n < 20; n++) expect((await R.slogin.POST(req({ admissionNo: 'ST-9-26', pin: `guess${n}` }, from(n)))).status).toBe(401);
    expect((await R.slogin.POST(req({ admissionNo: 'ST-9-26', pin: 'guess-x' }, from(99)))).status).toBe(429);
    // another account is not affected
    expect((await R.slogin.POST(req({ admissionNo: 'ST-8-26', pin: 'guess' }, from(98)))).status).toBe(401);
  });

  it('one school-teacher account: the same', async () => {
    const from = (n: number) => ({ 'x-forwarded-for': `71.1.0.${n}` });
    for (let n = 0; n < 20; n++) expect((await R.tlogin.POST(req({ code: 'TS-3-26', password: `guess${n}` }, from(n)))).status).toBe(401);
    expect((await R.tlogin.POST(req({ code: 'TS-3-26', password: 'x' }, from(77)))).status).toBe(429);
  });

  it('secret headers: odd characters are refused, not a crash', async () => {
    process.env.AI_GURU_BANK_ALERT_SECRET = 'a'.repeat(32);
    process.env.AI_GURU_CRON_SECRET = 'b'.repeat(32);
    const odd = 'é'.repeat(16) + 'a'.repeat(16); // 32 characters, 48 bytes
    expect((await R.alert.POST(req({ text: 'x' }, { 'x-alert-secret': odd }))).status).toBe(401);
    expect((await R.cron.POST(req({}, { 'x-cron-secret': odd.replace(/a/g, 'b') }))).status).toBe(401);
  });

  it('security headers on every page', async () => {
    const cfg = (await import('@/next.config')).default as { headers: () => Promise<Array<{ headers: Array<{ key: string; value: string }> }>> };
    const h = Object.fromEntries((await cfg.headers())[0].headers.map((x) => [x.key, x.value]));
    expect(h['Strict-Transport-Security']).toMatch(/max-age=31536000/);
    expect(h['Content-Security-Policy']).toMatch(/object-src 'none'.*frame-ancestors 'self'/);
    expect(h['X-Frame-Options']).toBe('SAMEORIGIN');
  });
});
