import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { readData } from '@/lib/ai-guru/admin/store';
import { istToday } from '@/lib/ai-guru/admin/enrolment';
import { runDailyReminders } from '@/lib/ai-guru/messages/notify';

export const dynamic = 'force-dynamic';

/**
 * V51.9.186 — the daily fee-reminder run, called once a day by Google Cloud Scheduler (scripts/cloud/setup-daily-reminders.sh)
 * or any other scheduler, with the header  x-cron-secret: <AI_GURU_CRON_SECRET>.
 * Sends what is due today: the before-due and due-day reminders (once each), the grace-period reminder (every day of the
 * grace period) and the grace-over notice (once). Running it twice the same day sends nothing new.
 * Without AI_GURU_CRON_SECRET set on the server this address does not exist (404).
 */
function allowed(req: Request): boolean {
  const want = process.env.AI_GURU_CRON_SECRET ?? '';
  const got = req.headers.get('x-cron-secret') ?? '';
  if (want.length < 16) return false;
  const a = Buffer.from(got), w = Buffer.from(want); // V51.9.196 (security check): compare bytes, so odd characters cannot throw
  return a.length === w.length && timingSafeEqual(a, w);
}

export async function POST(req: Request) {
  if (!process.env.AI_GURU_CRON_SECRET) return NextResponse.json({ ok: false }, { status: 404 });
  if (!allowed(req)) return NextResponse.json({ ok: false }, { status: 401 });
  const run = await runDailyReminders(await readData(), istToday());
  return NextResponse.json({ ok: true, ...run });
}
