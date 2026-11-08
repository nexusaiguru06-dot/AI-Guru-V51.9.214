// @vitest-environment node
/**
 * V51.9.188 — free doubt clearing in the trial on the school (app) key, with the office's limits; otherwise the
 * student's own key; and "🔑 Add your free Gemini key" reminders in Messages that open Settings when tapped.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { doubtWindow } from './school-key';
import { keyNudgeFor } from '../messages/notify';
import { addDays } from '../admin/plans';

const R: Record<string, any> = {};
let ipN = 1;
const req = (body: unknown, cookie = '') => new Request('http://x/a', { method: 'POST', headers: { cookie, 'x-forwarded-for': `62.0.0.${ipN++}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const get = (cookie = '', q = '') => new Request(`http://x/a${q}`, { headers: { cookie } });
const j = async (r: Response) => r.json();
const sess = (r: Response) => (r.headers.getSetCookie?.() ?? [r.headers.get('set-cookie') ?? '']).map((c) => c.split(';')[0]).filter((c) => /^aig_(student|admin)=/.test(c)).join('; ');
const KEY = 'AIza' + 'k'.repeat(35);

describe('pure rules', () => {
  const J = '2026-11-01T10:00:00+05:30';
  it('trial window: days from joining; enrolling does not end it early (V51.9.195)', () => {
    expect(doubtWindow(J, 7, '2026-11-01')).toMatchObject({ dayNo: 1, left: 7, until: '2026-11-07', open: true });
    expect(doubtWindow(J, 7, '2026-11-08')).toMatchObject({ dayNo: 8, left: 0, open: false });
    expect(doubtWindow(J, 7, '2026-11-03', true)).toMatchObject({ open: true, enrolled: true });
    expect(doubtWindow(J, 0, '2026-11-01')).toMatchObject({ open: false });
  });
  it('key reminders: last trial day, the day after, then weekly; none once the browser has a key', () => {
    const st = { createdAt: J };
    const on = (d: string, x: object = {}) => keyNudgeFor({ ...st, ...x }, 7, d)?.kind ?? null;
    expect(on('2026-11-03')).toBeNull();
    expect(on('2026-11-07')).toBe('last');
    expect(on('2026-11-08')).toBe('over');
    expect(on('2026-11-09')).toBeNull();
    expect(on(addDays('2026-11-08', 7))).toBe('weekly');
    expect(on('2026-11-08', { keySeenAt: '2026-11-02T00:00:00Z' })).toBeNull();
    expect(on('2026-11-03', { enrolled: { on: '2026-11-03', by: 'payment' } })).toBeNull(); // V51.9.195: the trial goes on after paying
    expect(keyNudgeFor(st, 0, '2026-11-01')).toBeNull(); // no trial: the sign-up welcome says it, no "ended"
  });
});

describe('the trial, end to end', () => {
  let admin = '', kid = '', kidId = '';
  const msgs = async () => {
    const { readThread } = await import('@/lib/ai-guru/messages/store');
    const { threadIdFor } = await import('@/lib/ai-guru/messages/core');
    return (await readThread(threadIdFor('student-admin', kidId)))?.messages ?? [];
  };
  beforeAll(async () => {
    process.chdir(mkdtempSync(path.join(tmpdir(), 'trial188-')));
    process.env.ADMIN_USERNAME = 'office'; process.env.ADMIN_PASSWORD = 'office-pass-2026';
    delete process.env.GEMINI_API_KEY;
    for (const [k, p] of Object.entries({ login: 'admin/login', alib: 'admin/library', signup: 'student-portal/signup', me: 'student-portal/me', dk: 'student-portal/doubt-key' })) R[k] = await import(`@/app/api/ai-guru/${p}/route`);
    R.key = await import('./school-key');
    R.notify = await import('../messages/notify');
    admin = sess(await R.login.POST(req({ username: 'office', password: 'office-pass-2026' })));
    await R.alib.POST(req({ action: 'settings', library: { cloudKey: KEY, dailyLimit: 5, reviewStudentWork: false, trialDoubts: { days: 3, perDay: 2, minutes: 8, afterPerDay: 0, afterMinutes: 5 } } }, admin)); // V51.9.189: none after the trial here
    kid = sess(await R.signup.POST(req({ name: 'Nila Raj', standard: '6', syllabus: 'kerala', medium: 'malayalam', school: 'GHSS', state: 'Kerala', district: 'Ernakulam', place: 'Aluva', password: 'secret1', confirm: 'secret1', motherTongue: 'Malayalam' })));
    kidId = (await j(await R.me.GET(get(kid)))).student.id;
  });

  it('sign-up brings a welcome in Messages that opens Settings when tapped', async () => {
    const w = (await msgs()).find((m: any) => /Welcome, Nila/.test(m.text));
    expect(w).toBeTruthy();
    expect(w.text).toMatch(/first 3 days you can ask doubts free .*\(2 a day, up to 8 minutes each\)/);
    expect(w.action).toEqual({ label: expect.stringMatching(/Add my free Gemini key/), href: '/ai-guru/settings/gemini' });
  });

  it('the office’s limits: sessions a day, minutes a session; the key never reaches the browser', async () => {
    const mins: number[] = [];
    R.key.setMint(async (k: string, m: number) => { expect(k).toBe(KEY); mins.push(m); return 'auth_tokens/one-use'; });
    expect(await j(await R.dk.GET(get(kid)))).toMatchObject({ open: true, days: 3, perDay: 2, used: 0, minutes: 8 });
    for (let i = 0; i < 2; i++) {
      const t = await j(await R.dk.POST(req({}, kid)));
      expect(t).toMatchObject({ ok: true, token: 'auth_tokens/one-use' });
      expect(JSON.stringify(t)).not.toContain(KEY);
    }
    expect(mins).toEqual([8, 8]);
    const third = await R.dk.POST(req({}, kid));
    expect(third.status).toBe(429);
    expect(await j(third)).toMatchObject({ needKey: true, keyPage: '/ai-guru/settings/gemini' });
    expect(await j(await R.dk.GET(get(kid)))).toMatchObject({ open: false, used: 2 });
  });

  it('enrolled students and the end of the trial: own key; the reminders arrive once each, then stop when a key is seen', async () => {
    const { update, readData } = await import('@/lib/ai-guru/admin/store');
    const { istToday } = await import('@/lib/ai-guru/admin/enrolment');
    // day 4: the trial is over (no free daily minutes after it, so only the own key is left)
    await R.alib.POST(req({ action: 'settings', library: { trialDoubts: { dailyMinutes: 0 } } }, admin));
    await update((d) => { d.students.find((s) => s.id === kidId)!.createdAt = new Date(Date.now() - 3 * 86_400_000).toISOString(); });
    const over = await R.dk.POST(req({}, kid));
    expect(over.status).toBe(403);
    expect(await j(over)).toMatchObject({ over: true, error: expect.stringMatching(/3-day free trial of doubt clearing ended/) });
    expect(await R.notify.sendKeyNudges(await readData(), istToday())).toBe(1);
    expect(await R.notify.sendKeyNudges(await readData(), istToday())).toBe(0); // once
    expect((await msgs()).filter((m: any) => /free doubt clearing trial has ended/.test(m.text) && m.action?.href === '/ai-guru/settings/gemini')).toHaveLength(1);
    // the browser says it has a key: no more reminders
    await R.dk.GET(get(kid, '?own=1'));
    expect((await readData()).students.find((s) => s.id === kidId)!.keySeenAt).toBeTruthy();
    expect(await R.notify.sendKeyNudges(await readData(), addDays(istToday(), 7))).toBe(0);
    // V51.9.195: paying during the trial does not end it (the day's sessions were used above, so: the daily limit)
    await update((d) => { const s = d.students.find((x) => x.id === kidId)!; s.createdAt = new Date().toISOString(); s.enrolled = { on: istToday(), by: 'payment' } as any; });
    expect(await j(await R.dk.GET(get(kid)))).toMatchObject({ trial: true, tier: 'trial' });
    const enr = await R.dk.POST(req({}, kid));
    expect(enr.status).not.toBe(403);
    R.key.setMint(null);
  });

  it('settings are checked', async () => {
    expect((await j(await R.alib.POST(req({ action: 'settings', library: { dailyLimit: 5, trialDoubts: { days: 7, perDay: 0, minutes: 10 } } }, admin)))).ok).toBe(false);
    expect((await j(await R.alib.POST(req({ action: 'settings', library: { dailyLimit: 5, trialDoubts: { days: 7, perDay: 5, minutes: 60 } } }, admin)))).ok).toBe(false);
    expect((await j(await R.alib.GET(get(admin)))).settings.trialDoubts).toEqual({ days: 3, perDay: 2, minutes: 8, afterPerDay: 0, afterMinutes: 5, dailyMinutes: 0, schoolPerDay: 200 });
  });
});
