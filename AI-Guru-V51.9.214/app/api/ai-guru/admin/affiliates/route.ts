import { NextResponse } from 'next/server';
import { bad, denied } from '../guard';
import { ensureReferral, newId, readData, update } from '@/lib/ai-guru/admin/store';
import { affiliateReport, rateFor, revenueRows, statusOf } from '@/lib/ai-guru/admin/affiliate';
import { csvOf, rupees } from '@/lib/ai-guru/admin/fees';
import { priceTable } from '@/lib/ai-guru/admin/pricing';

export const dynamic = 'force-dynamic';

/**
 * GET                — settings, every affiliate (a student with a code) with totals, and the revenue of every student
 * GET ?id=<student>  — one affiliate's full report (every referred student, every payment, the monthly payouts)
 * GET ?format=csv    — the commission ledger (one row per commission)
 */
export async function GET(req: Request) {
  const d = await denied(req); if (d) return d;
  let data = await readData();
  if (data.students.some((s) => !(s.referralCode && data.coupons.some((c) => c.ownerStudentId === s.id)))) { await update((dd) => { for (const s of dd.students) ensureReferral(dd, s); }); data = await readData(); } // students made before affiliates existed get a code
  const q = new URL(req.url).searchParams;
  const today = new Date().toISOString().slice(0, 10);
  if (q.get('format') === 'csv') {
    const name = (id: string) => data.students.find((s) => s.id === id)?.name ?? '';
    const rows = [['Affiliate', 'Referred student', 'Payment date', 'Receipt', 'Payment', 'Rate %', 'Commission', 'Payout date', 'Status']];
    for (const i of data.invoices) for (const p of i.payments) if (p.commission) rows.push([name(p.commission.affiliateId), name(i.studentId), p.date, p.receiptNo, String(p.amount), String(p.commission.rate), String(p.commission.amount), p.commission.payoutDate, statusOf(p.commission, today)]);
    return new NextResponse(csvOf(rows), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="affiliate-commissions.csv"' } });
  }
  const id = q.get('id');
  if (id) {
    const a = data.students.find((s) => s.id === id);
    if (!a) return bad('Affiliate not found', 404);
    return NextResponse.json({ ok: true, affiliate: { id: a.id, name: a.name, code: a.referralCode, rate: rateFor(a, data.settings.affiliate), override: a.commissionPct ?? null }, report: affiliateReport(a.id, data.students, data.invoices, today), payouts: data.payouts.filter((p) => p.affiliateId === id).reverse() });
  }
  const affiliates = data.students.map((a) => {
    const r = affiliateReport(a.id, data.students, data.invoices, today);
    return { id: a.id, name: a.name, standard: a.standard, school: a.school ?? '', code: a.referralCode, rate: rateFor(a, data.settings.affiliate), override: a.commissionPct ?? null, ...r.totals, nextPayout: r.nextPayout ?? null };
  }).sort((x, y) => y.earned - x.earned || y.referrals - x.referrals);
  const totals = affiliates.reduce((t, a) => ({ referrals: t.referrals + a.referrals, earned: t.earned + a.earned, pending: t.pending + a.pending, dueNow: t.dueNow + a.dueNow, paidOut: t.paidOut + a.paidOut }), { referrals: 0, earned: 0, pending: 0, dueNow: 0, paidOut: 0 });
  return NextResponse.json({ ok: true, settings: data.settings.affiliate, affiliates, totals, revenue: revenueRows(data.students, data.invoices), prices: priceTable(data) });
}

/**
 * POST { action: 'settings', affiliate: { enabled, commissionPct, discountPct, payoutDay } }
 *      { action: 'override', studentId, commissionPct | null }     a different commission for one affiliate (applies to future payments)
 *      { action: 'payout', affiliateId, reference, note? }          marks every commission whose payout day has come as paid
 */
export async function POST(req: Request) {
  const d = await denied(req); if (d) return d;
  const b = await req.json().catch(() => ({}));
  if (b.action === 'settings') {
    const a = b.affiliate ?? {};
    const commissionPct = Math.round(Number(a.commissionPct) * 100) / 100, discountPct = Math.round(Number(a.discountPct) * 100) / 100, payoutDay = Math.floor(Number(a.payoutDay));
    const discountKind: 'percent' | 'flat' = a.discountKind === 'flat' ? 'flat' : 'percent';
    if (!(commissionPct >= 0 && commissionPct <= 100)) return bad('Commission must be between 0 and 100 per cent');
    if (discountKind === 'percent' && !(discountPct >= 0 && discountPct <= 100)) return bad('Friend’s discount must be between 0 and 100 per cent');
    if (discountKind === 'flat' && !(discountPct >= 0 && discountPct <= 100000)) return bad('Friend’s discount must be between ₹0 and ₹1,00,000');
    if (!(payoutDay >= 1 && payoutDay <= 28)) return bad('Payout day must be between 1 and 28');
    await update((data) => {
      data.settings.affiliate = { enabled: !!a.enabled, commissionPct, discountPct, discountKind, payoutDay };
      for (const c of data.coupons) if (c.ownerStudentId) { c.kind = discountKind; c.value = discountPct; c.active = !!a.enabled; }
    });
    return NextResponse.json({ ok: true });
  }
  if (b.action === 'override') {
    const v = b.commissionPct === null || b.commissionPct === '' ? undefined : Math.round(Number(b.commissionPct) * 100) / 100;
    if (v !== undefined && !(v >= 0 && v <= 100)) return bad('Commission must be between 0 and 100 per cent');
    const ok = await update((data) => { const s = data.students.find((x) => x.id === b.studentId); if (!s) return false; if (v === undefined) delete s.commissionPct; else s.commissionPct = v; return true; });
    return ok ? NextResponse.json({ ok: true }) : bad('Student not found', 404);
  }
  if (b.action === 'payout') {
    const reference = String(b.reference ?? '').trim().slice(0, 80);
    if (!reference) return bad('Write how it was paid (UPI reference, bank transfer, cash…)');
    const today = new Date().toISOString().slice(0, 10);
    const r = await update((data) => {
      const id = newId('pay');
      let amount = 0, count = 0;
      for (const i of data.invoices) for (const p of i.payments) {
        const c = p.commission;
        if (c && c.affiliateId === b.affiliateId && !c.paid && today >= c.payoutDate) { c.paid = { on: today, payoutId: id }; amount += Math.round(c.amount * 100); count++; }
      }
      if (!count) return null;
      data.payouts.push({ id, affiliateId: b.affiliateId, on: today, amount: amount / 100, count, reference, note: String(b.note ?? '').slice(0, 120) || undefined });
      return { amount: amount / 100, count };
    });
    return r ? NextResponse.json({ ok: true, ...r }) : bad('No commission is due for payout yet (it falls due on the payout day of the next month)', 409);
  }
  return bad('Unknown action');
}
