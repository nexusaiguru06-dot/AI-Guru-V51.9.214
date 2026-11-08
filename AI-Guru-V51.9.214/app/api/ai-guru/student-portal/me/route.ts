import { NextResponse } from 'next/server';
import { isAdmin, studentFromRequest } from '@/lib/ai-guru/admin/auth';
import { ensureReferral, readData, update } from '@/lib/ai-guru/admin/store';
import { affiliateReport, rateFor } from '@/lib/ai-guru/admin/affiliate';
import { accessOf, dueOf, istToday, pricePreview } from '@/lib/ai-guru/admin/enrolment';
import { planOffer, planViewOf } from '@/lib/ai-guru/admin/content-access';
import { invoiceDue, invoicePaid, invoiceStatus, invoiceTotal, publicStudent, summarise } from '@/lib/ai-guru/admin/fees';
import { readForStudent } from '@/lib/ai-guru/quiz/server-store';
import { badgesOf, istDay } from '@/lib/ai-guru/share/badges';
import { chilliesOf, rollup } from '@/lib/ai-guru/quiz/records';
import { duesOf, worstStage } from '@/lib/ai-guru/admin/dues';
import { sendDueNotices, sendKeyNudges } from '@/lib/ai-guru/messages/notify';

import { ensurePartBills, needsPartBills, paidOldWay, partPlanOf, partPlanStatus } from '@/lib/ai-guru/admin/part-plan';
export const dynamic = 'force-dynamic';

/**
 * GET — the signed-in student's own record: details, fees with receipts, quiz progress and parent code.
 * GET ?as=<studentId> — the same for the admin (who may open every portal).
 */
export async function GET(request: Request) {
  const asId = new URL(request.url).searchParams.get('as');
  const id = asId && (await isAdmin(request)) ? asId : await studentFromRequest(request);
  if (!id) return NextResponse.json({ ok: false }, { status: 401 });
  let data = await readData();
  const need = data.students.find((s) => s.id === id);
  if (need && !(need.referralCode && data.coupons.some((c) => c.ownerStudentId === need.id))) { await update((d) => { const x = d.students.find((s) => s.id === id); if (x) ensureReferral(d, x); }); data = await readData(); } // older accounts get an affiliate code on first visit
  if (needsPartBills(data, id)) { await update((d) => { ensurePartBills(d, id); }); data = await readData(); } // V51.9.191: part bills for older accounts
  const st = data.students.find((s) => s.id === id);
  if (!st) return NextResponse.json({ ok: false }, { status: 401 });
  const invoices = data.invoices.filter((i) => i.studentId === st.id).map((i) => ({ ...i, total: invoiceTotal(i), paid: invoicePaid(i), due: invoiceDue(i), status: invoiceStatus(i) }));
  const quizId = st.quizId ?? `student:${st.id}`;
  // V51.9.185: fees due (for the banner), and this student's reminders in Messages (each sent once)
  const today = istToday();
  const dues = duesOf(st, data.invoices, [...data.yearly, ...data.monthly], today, data.settings.plans.graceDays);
  if (!asId && dues.length) await sendDueNotices(data, today, st.id).catch(() => 0);
  if (!asId) await sendKeyNudges(data, today, st.id).catch(() => 0); // V51.9.188: key reminders arrive even without the daily job
  const mine = await readForStudent(quizId); // V51.9.178: only this student's records are read
  const t = rollup(mine);
  return NextResponse.json({
    ok: true,
    student: publicStudent(st),
    quizId,
    school: data.school,
    fees: { invoices, summary: summarise(data.invoices.filter((i) => i.studentId === st.id)) },
    learning: { sessions: t.sessions, toffees: t.toffees, chillies: t.chillies, chilliesEarned: t.chilliesEarned, redeemed: t.redeemed, pct: t.pct, weak: t.weak.slice(0, 5), recent: t.recent.slice(0, 5).map((r) => ({ id: r.id, at: r.at, correct: r.correct, total: r.total, toffees: r.toffees, chillies: chilliesOf(r) })) },
    // V51.9.93: free part / enrolment, for the banner on the student's page (null when the lock is off)
    access: data.settings.access.enabled ? { ...accessOf(st, data.invoices, data.classes, istToday(), planViewOf(data)), offer: planOffer(data, st), freeParts: data.settings.access.freeParts, ...(partPlanOf(data.settings.access).enabled && !paidOldWay(st.id, data.invoices) ? ((pps) => ({ partPlan: pps, full: pps.allPaid || st.enrolled?.by === 'admin' }))(partPlanStatus(st, data.invoices, data.settings.access.freeParts, partPlanOf(data.settings.access))) : {}), due: dueOf(st.id, data.invoices), fee: pricePreview(data.heads, st.standard, data.coupons.find((c) => c.code === st.coupon && c.active)).pay } : null,
    dues: { stage: worstStage(dues), items: dues },
    parentCode: mine.at(-1)?.code ?? null,
    rewards: badgesOf(mine, istDay(new Date().toISOString())),
    affiliate: { enabled: data.settings.affiliate.enabled, code: st.referralCode ?? null, rate: rateFor(st, data.settings.affiliate), friendDiscountPct: data.settings.affiliate.discountPct, friendDiscountKind: data.settings.affiliate.discountKind ?? 'percent', payoutDay: data.settings.affiliate.payoutDay, report: affiliateReport(st.id, data.students, data.invoices) },
  });
}
