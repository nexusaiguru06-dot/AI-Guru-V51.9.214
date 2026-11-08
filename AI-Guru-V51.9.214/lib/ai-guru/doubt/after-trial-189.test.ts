// @vitest-environment node
/**
 * V51.9.189 — a student without a key can still clear doubts after the trial (and when enrolled), within a smaller
 * allowance the office sets; and "⚙ Settings" reads every office setting in one place.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const R: Record<string, any> = {};
let ipN = 1;
const req = (body: unknown, cookie = '') => new Request('http://x/a', { method: 'POST', headers: { cookie, 'x-forwarded-for': `63.0.0.${ipN++}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const get = (cookie = '', q = '') => new Request(`http://x/a${q}`, { headers: { cookie } });
const j = async (r: Response) => r.json();
const sess = (r: Response) => (r.headers.getSetCookie?.() ?? [r.headers.get('set-cookie') ?? '']).map((c) => c.split(';')[0]).filter((c) => /^aig_(student|admin)=/.test(c)).join('; ');
const KEY = 'AIza' + 'q'.repeat(35);
let admin = '', kid = '', kidId = '';

beforeAll(async () => {
  process.chdir(mkdtempSync(path.join(tmpdir(), 'after189-')));
  process.env.ADMIN_USERNAME = 'office'; process.env.ADMIN_PASSWORD = 'office-pass-2026';
  delete process.env.GEMINI_API_KEY; delete process.env.AI_GURU_CRON_SECRET;
  for (const [k, p] of Object.entries({ login: 'admin/login', alib: 'admin/library', all: 'admin/all-settings', aff: 'admin/affiliates', signup: 'student-portal/signup', me: 'student-portal/me', dk: 'student-portal/doubt-key' })) R[k] = await import(`@/app/api/ai-guru/${p}/route`);
  R.key = await import('./school-key');
  admin = sess(await R.login.POST(req({ username: 'office', password: 'office-pass-2026' })));
  kid = sess(await R.signup.POST(req({ name: 'Devan K', standard: '9', syllabus: 'kerala', medium: 'english', school: 'GHSS', state: 'Kerala', district: 'Thrissur', place: 'Ollur', password: 'secret1', confirm: 'secret1', motherTongue: 'Malayalam' })));
  kidId = (await j(await R.me.GET(get(kid)))).student.id;
});

describe('after the trial: a smaller allowance', () => {
  it('defaults: 10 free minutes a day (two slices of 5) once the trial is over; then a notification-worthy refusal', async () => {
    const mins: number[] = [];
    R.key.setMint(async (_k: string, m: number) => { mins.push(m); return 'auth_tokens/x'; });
    await R.alib.POST(req({ action: 'settings', library: { cloudKey: KEY, trialDoubts: { days: 2, perDay: 3, minutes: 10 } } }, admin));
    expect(await j(await R.dk.GET(get(kid)))).toMatchObject({ tier: 'trial', trial: true, perDay: 3, minutes: 10, open: true });
    const { update } = await import('@/lib/ai-guru/admin/store');
    await update((d) => { d.students.find((s) => s.id === kidId)!.createdAt = new Date(Date.now() - 5 * 86_400_000).toISOString(); });
    expect(await j(await R.dk.GET(get(kid)))).toMatchObject({ tier: 'after', trial: false, perDay: 2, minutes: 5, dailyMinutes: 10, open: true });
    expect(await j(await R.dk.POST(req({}, kid)))).toMatchObject({ ok: true, tier: 'after', perDay: 2, used: 1, minutes: 5 });
    expect(await j(await R.dk.POST(req({}, kid)))).toMatchObject({ ok: true, used: 2, minutes: 5 });
    expect(mins).toEqual([5, 5]);
    const again = await R.dk.POST(req({}, kid));
    expect(again.status).toBe(429);
    expect(await j(again)).toMatchObject({ limit: true, needKey: true, keyPage: '/ai-guru/settings/gemini', error: expect.stringMatching(/today's 10 free doubt minutes/) });
  });

  it('enrolled students without a key get the same smaller allowance after the trial; 0 = own key only', async () => {
    const { update } = await import('@/lib/ai-guru/admin/store');
    // V51.9.195: paying no longer ends the trial early, so this student joined 10 days ago
    await update((d) => { const s = d.students.find((x) => x.id === kidId)!; s.createdAt = new Date(Date.now() - 10 * 86_400_000).toISOString(); s.enrolled = { on: '2026-11-01', by: 'payment' }; });
    expect(await j(await R.dk.GET(get(kid)))).toMatchObject({ tier: 'after', enrolled: true });
    await R.alib.POST(req({ action: 'settings', library: { trialDoubts: { days: 2, perDay: 3, minutes: 10, dailyMinutes: 0 } } }, admin));
    expect(await j(await R.dk.GET(get(kid)))).toMatchObject({ tier: 'none', open: false });
    expect((await R.dk.POST(req({}, kid))).status).toBe(403);
    expect((await j(await R.alib.POST(req({ action: 'settings', library: { trialDoubts: { days: 2, perDay: 3, minutes: 10, dailyMinutes: 500 } } }, admin)))).ok).toBe(false);
    R.key.setMint(null);
  });
});

describe('⚙ Settings', () => {
  it('reads every office setting in one place (office only), the AI key masked', async () => {
    expect((await R.all.GET(get(kid))).status).not.toBe(200);
    await R.aff.POST(req({ action: 'settings', affiliate: { enabled: true, commissionPct: 12, discountPct: 10, payoutDay: 4 } }, admin));
    const a = await j(await R.all.GET(get(admin)));
    expect(a).toMatchObject({
      ok: true, signupNeedsCoupon: false,
      affiliate: { enabled: true, commissionPct: 12, payoutDay: 4 },
      access: { enabled: false, freeParts: [1] },
      plans: { graceDays: 5 },
      library: { hasEnvKey: false, trialDoubts: { days: 2, perDay: 3, minutes: 10, dailyMinutes: 0, afterPerDay: 0, afterMinutes: 5 } },
      upi: { vpa: '' }, daily: { lastRun: null, scheduled: false },
    });
    expect(a.library.cloudKey).toMatch(/^AIza…qqqq$/);
    expect(JSON.stringify(a)).not.toContain(KEY);
  });
});
