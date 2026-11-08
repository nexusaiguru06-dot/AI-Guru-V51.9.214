import { NextResponse } from 'next/server';
import { studentFromRequest } from '@/lib/ai-guru/admin/auth';
import { readData, update } from '@/lib/ai-guru/admin/store';
import { istToday } from '@/lib/ai-guru/admin/enrolment';
import { doubtLimitsOf, doubtWindow, giveBackMinutes, mintToken, minutesUsedToday, takeMinutes, takeSession, untakeSession, usedToday } from '@/lib/ai-guru/doubt/school-key';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const noStore = { 'cache-control': 'no-store' };
const KEY_PAGE = '/ai-guru/settings/gemini';

async function where(req: Request) {
  const id = await studentFromRequest(req);
  if (!id) return null;
  const data = await readData();
  const st = data.students.find((s) => s.id === id);
  if (!st) return null;
  const lib = data.settings.library;
  const limits = doubtLimitsOf(data.settings);
  const key = lib.cloudKey || process.env.GEMINI_API_KEY || undefined;
  const today = istToday();
  const w = doubtWindow(st.createdAt, limits.days, today, !!st.enrolled);
  // V51.9.189: the trial allowance, else the smaller one after the trial (and for enrolled students), else none
  const tier: 'trial' | 'after' | 'none' = w.open ? 'trial' : limits.afterPerDay > 0 ? 'after' : 'none';
  const allow = tier === 'trial' ? { perDay: limits.perDay, minutes: limits.minutes } : tier === 'after' ? { perDay: limits.afterPerDay, minutes: limits.afterMinutes } : { perDay: 0, minutes: 0 };
  return { st, key, today, limits, w, tier, allow };
}

/**
 * V51.9.188 — free doubt clearing in the trial, on the school key, with limits.
 * V51.9.189 — after the trial (and for enrolled students), a daily allowance in MINUTES (V51.9.211, `dailyMinutes`, given in slices of up to 5); 0 = own key only.
 * GET  ?own=1 — where the student stands: { open, days, dayNo, left, until, perDay, used, minutes, enrolled }.
 *        `own=1` says this browser has the student's own key (only that fact is kept, so key reminders stop).
 * POST — a one-use Gemini Live token from the school key (it never leaves the server), within the day's allowance.
 */
export async function GET(req: Request) {
  const x = await where(req);
  if (!x) return NextResponse.json({ ok: false, open: false }, { status: 401, headers: noStore });
  if (new URL(req.url).searchParams.get('own') === '1' && (!x.st.keySeenAt || istToday(Date.parse(x.st.keySeenAt)) !== x.today)) {
    await update((d) => { const s = d.students.find((y) => y.id === x.st.id); if (s) s.keySeenAt = new Date().toISOString(); }).catch(() => undefined);
  }
  const used = x.tier === 'after' ? Math.ceil((await minutesUsedToday(x.st.id, x.today)) / x.limits.afterMinutes) : await usedToday(x.st.id, x.today);
  return NextResponse.json({ ok: true, ...x.w, trial: x.w.open, tier: x.tier, dailyMinutes: x.limits.dailyMinutes, open: x.tier !== 'none' && !!x.key && used < x.allow.perDay, perDay: x.allow.perDay, used, minutes: x.allow.minutes, keyPage: KEY_PAGE }, { headers: noStore });
}

export async function POST(req: Request) {
  const x = await where(req);
  if (!x) return NextResponse.json({ ok: false, error: 'Sign in first' }, { status: 401, headers: noStore });
  const addKey = 'Add your own free Gemini key in Settings to ask doubts any time.';
  if (!x.key) return NextResponse.json({ ok: false, needKey: true, error: addKey, keyPage: KEY_PAGE }, { status: 403, headers: noStore });
  if (x.tier === 'none') {
    const why = x.w.days ? `Your ${x.w.days}-day free trial of doubt clearing ended on ${x.w.until}.` : 'Free doubt clearing is not offered now.';
    return NextResponse.json({ ok: false, over: true, needKey: true, ...x.w, error: `${why} ${addKey}`, keyPage: KEY_PAGE }, { status: 403, headers: noStore });
  }
  if (x.tier === 'after') {
    const g = await takeMinutes(x.st.id, x.today, x.limits.dailyMinutes, x.limits.afterMinutes, x.limits.schoolPerDay);
    if (g === 'all') return NextResponse.json({ ok: false, needKey: true, limit: true, error: `Today's free doubt time on AI Guru's key is all used up. Please try again tomorrow, or ${addKey}`, keyPage: KEY_PAGE }, { status: 429, headers: noStore });
    if (g === 0) return NextResponse.json({ ok: false, needKey: true, limit: true, error: `You have used today's ${x.limits.dailyMinutes} free doubt minutes. Try again tomorrow, or ${addKey}`, keyPage: KEY_PAGE }, { status: 429, headers: noStore });
    try {
      const token = await mintToken(x.key, { minutes: g });
      const usedMin = await minutesUsedToday(x.st.id, x.today);
      return NextResponse.json({ ok: true, token, ...x.w, trial: false, tier: x.tier, minutes: g, perDay: x.allow.perDay, used: Math.ceil(usedMin / x.limits.afterMinutes), dailyMinutes: x.limits.dailyMinutes, minutesLeft: x.limits.dailyMinutes - usedMin }, { headers: noStore });
    } catch (e) {
      await giveBackMinutes(x.st.id, x.today, g).catch(() => undefined);
      return NextResponse.json({ ok: false, error: `Could not start a free doubt session (${e instanceof Error ? e.message.slice(0, 120) : 'error'}).` }, { status: 502, headers: noStore });
    }
  }
  const took = await takeSession(x.st.id, x.today, x.allow.perDay, x.limits.schoolPerDay);
  if (took === 'all') return NextResponse.json({ ok: false, needKey: true, limit: true, error: `Today's free doubt sessions on AI Guru's key are all used up. Please try again tomorrow, or ${addKey}`, keyPage: KEY_PAGE }, { status: 429, headers: noStore });
  if (took === 'mine') return NextResponse.json({ ok: false, needKey: true, limit: true, error: `You have used today's ${x.allow.perDay} free doubt session${x.allow.perDay === 1 ? '' : 's'}. Try again tomorrow, or ${addKey}`, keyPage: KEY_PAGE }, { status: 429, headers: noStore });
  try {
    const token = await mintToken(x.key, x.allow);
    return NextResponse.json({ ok: true, token, ...x.w, trial: x.w.open, tier: x.tier, minutes: x.allow.minutes, perDay: x.allow.perDay, used: await usedToday(x.st.id, x.today) }, { headers: noStore });
  } catch (e) {
    await untakeSession(x.st.id, x.today).catch(() => undefined); // V51.9.195: a session that never started is not counted
    return NextResponse.json({ ok: false, error: `Could not start a free doubt session (${e instanceof Error ? e.message.slice(0, 120) : 'error'}).` }, { status: 502, headers: noStore });
  }
}
