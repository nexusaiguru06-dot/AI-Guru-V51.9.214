/**
 * V51.9.155 — the signed-in student's Subscribers (students who joined through their affiliate link or code).
 *   GET            → their code, the offer, their commission rate, every subscriber, totals and payouts
 *   GET ?count=1   → { unseen } how many joined since they last opened the page (the red dot on the menu)
 *   POST { action: 'seen' } → opened the page now
 * The admin may look at a student's page with ?as=<studentId>.
 */
import { NextResponse } from 'next/server';
import { isAdmin, studentFromRequest } from '@/lib/ai-guru/admin/auth';
import { ensureReferral, readData, update } from '@/lib/ai-guru/admin/store';
import { rateFor } from '@/lib/ai-guru/admin/affiliate';
import { newSubscribers, subscribersView } from '@/lib/ai-guru/admin/subscribers';

export const dynamic = 'force-dynamic';
const no = () => NextResponse.json({ ok: false, error: 'Sign in to see your subscribers.' }, { status: 401 });

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const asId = q.get('as');
  const id = asId && (await isAdmin(req)) ? asId : await studentFromRequest(req);
  if (!id) return no();
  let data = await readData();
  let me = data.students.find((s) => s.id === id);
  if (!me) return no();
  if (q.get('count')) return NextResponse.json({ ok: true, unseen: data.settings.affiliate.enabled ? newSubscribers(me, data.students) : 0 });
  if (!(me.referralCode && data.coupons.some((c) => c.ownerStudentId === id))) { await update((d) => { const x = d.students.find((s) => s.id === id); if (x) ensureReferral(d, x); }); data = await readData(); me = data.students.find((s) => s.id === id)!; }
  const s = data.settings.affiliate;
  const v = subscribersView(me, data.students, data.invoices, s, rateFor(me, s));
  const { referrals, earned, pending, dueNow, paidOut, enrolled, trial, newCount } = v.totals; // the friends' own fee amounts stay with the office
  return NextResponse.json({ ok: true, enabled: s.enabled, me: { name: me.name.split(' ')[0], code: v.code }, rate: v.rate, offer: v.offer, payoutDay: v.payoutDay, subscribers: v.subscribers, totals: { referrals, earned, pending, dueNow, paidOut, enrolled, trial, newCount }, months: v.months, nextPayout: v.nextPayout ?? null, admin: !!asId });
}

export async function POST(req: Request) {
  const id = await studentFromRequest(req);
  if (!id) return no();
  const b = await req.json().catch(() => ({}));
  if (b.action !== 'seen') return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
  await update((d) => { const x = d.students.find((s) => s.id === id); if (x) x.subscribersSeenAt = new Date().toISOString(); });
  return NextResponse.json({ ok: true });
}
