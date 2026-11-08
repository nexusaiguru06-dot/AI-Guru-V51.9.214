/**
 * V51.9.186 — the daily fee-reminder run: one reminder every day of the grace period (from the day after the due date
 * to the last grace day), "grace period is over" once the day after, nothing twice on one day; and the cron address
 * only answers the scheduler's secret.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { addDays } from '../admin/plans';

const SECRET = 'c'.repeat(64);
let studentId = '';
const texts = async () => {
  const { readThread } = await import('./store');
  const { threadIdFor } = await import('./core');
  return ((await readThread(threadIdFor('student-admin', studentId)))?.messages ?? []).map((m: { text: string }) => m.text);
};

beforeAll(async () => {
  process.chdir(mkdtempSync(path.join(tmpdir(), 'daily-')));
  const { update } = await import('../admin/store');
  await update((d) => {
    d.settings.plans.graceDays = 5;
    d.students.push({ id: 'stu_a', studentCode: 'ST-9-26', name: 'Arjun Nair', standard: '7', admissionNo: '', guardianName: '', guardianPhone: '', address: { line1: '', area: 'Aluva', district: 'Ernakulam', state: 'Kerala', pincode: '' }, createdAt: '2026-06-01T00:00:00Z', keySeenAt: '2026-06-01T00:00:00Z' }); // V51.9.188: has a key, so only fee reminders here
    d.invoices.push({ id: 'inv_1', studentId: 'stu_a', term: 'Term 2', items: [{ name: 'Fee', amount: 900 }], discount: 0, dueDate: '2026-11-10', payments: [], createdAt: '2026-10-01T00:00:00Z' });
  });
  studentId = 'stu_a';
});

describe('a reminder every day of the grace period', () => {
  it('due 10 Nov, 5 grace days: daily reminders 11–15 Nov (day 1..5 of 5), then "grace period is over" once on 16 Nov', async () => {
    const { runDailyReminders, readLastRun } = await import('./notify');
    const { readData } = await import('../admin/store');
    const sentOn: Record<string, number> = {};
    for (let i = 0; i <= 8; i++) {
      const day = addDays('2026-11-09', i);
      const a = await runDailyReminders(await readData(), day);
      const b = await runDailyReminders(await readData(), day); // the job runs twice: nothing twice
      expect(b.sent).toBe(0);
      sentOn[day] = a.sent;
    }
    expect(sentOn).toEqual({ '2026-11-09': 1, '2026-11-10': 1, '2026-11-11': 1, '2026-11-12': 1, '2026-11-13': 1, '2026-11-14': 1, '2026-11-15': 1, '2026-11-16': 1, '2026-11-17': 0 });
    const t = await texts();
    expect(t.filter((x) => /grace period day/.test(x)).map((x) => x.match(/day (\d) of (\d)/)!.slice(1).join('/'))).toEqual(['1/5', '2/5', '3/5', '4/5', '5/5']);
    expect(t.find((x) => /day 5 of 5/.test(x))).toMatch(/Last day — please pay by 2026-11-15/);
    expect(t.find((x) => /day 2 of 5/.test(x))).toMatch(/3 days left/);
    expect(t.filter((x) => /grace period is over, please make payment to continue/.test(x))).toHaveLength(1);
    expect(await readLastRun()).toMatchObject({ date: '2026-11-17', sent: 0 });
  });
});

describe('the cron address', () => {
  it('does not exist without a secret on the server; refuses a wrong one; runs with the right one', async () => {
    const { POST } = await import('@/app/api/ai-guru/cron/fee-reminders/route');
    const call = (h: Record<string, string> = {}) => POST(new Request('http://x/c', { method: 'POST', headers: h }));
    delete process.env.AI_GURU_CRON_SECRET;
    expect((await call({ 'x-cron-secret': SECRET })).status).toBe(404);
    process.env.AI_GURU_CRON_SECRET = SECRET;
    expect((await call()).status).toBe(401);
    expect((await call({ 'x-cron-secret': 'c'.repeat(63) + 'd' })).status).toBe(401);
    const ok = await call({ 'x-cron-secret': SECRET });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ ok: true });
    process.env.AI_GURU_CRON_SECRET = 'short';
    expect((await call({ 'x-cron-secret': 'short' })).status).toBe(401); // a weak secret is never accepted
    delete process.env.AI_GURU_CRON_SECRET;
  });
});
