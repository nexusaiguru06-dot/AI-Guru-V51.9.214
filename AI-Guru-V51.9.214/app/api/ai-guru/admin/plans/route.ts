import { NextResponse } from 'next/server';
import { bad, denied } from '../guard';
import { readData, update, type AdminData } from '@/lib/ai-guru/admin/store';
import { addPlanRecord as addRecord } from '@/lib/ai-guru/admin/plan-records';
import { csvOf, invoiceDue, invoicePaid, invoiceTotal, type Invoice } from '@/lib/ai-guru/admin/fees';
import { istToday } from '@/lib/ai-guru/admin/enrolment';
import { cleanPlanSettings, monthlyRateFor, nextStart, paidThrough, periodLabel, planPriceRows, recordStatus, type MonthlyRecord, type PlanRecord } from '@/lib/ai-guru/admin/plans';

export const dynamic = 'force-dynamic';
const day = (x: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(String(x ?? '')) ? String(x) : '');

function rowOf(r: PlanRecord, data: AdminData, inv: Invoice | undefined, today: string) {
  const st = data.students.find((s) => s.id === r.studentId);
  return {
    ...r, label: periodLabel(r), student: st ? { id: st.id, name: st.name, studentCode: st.studentCode, standard: st.standard, school: st.school ?? '' } : null,
    invoice: inv ? { id: inv.id, term: inv.term, total: invoiceTotal(inv), paid: invoicePaid(inv), due: invoiceDue(inv), payments: inv.payments.map((p) => ({ id: p.id, receiptNo: p.receiptNo, amount: p.amount, date: p.date, mode: p.mode })) } : null,
    status: recordStatus(r, inv, today, data.settings.plans.graceDays), current: r.start <= today && today <= r.end,
  };
}

/**
 * V51.9.94 — monthly and yearly fee plans, in two registers.
 * GET                              — settings, price table, both registers with bill and payment status, totals, students
 * GET ?format=csv&register=yearly  — the yearly register as a spreadsheet (register=monthly for the monthly one)
 */
export async function GET(req: Request) {
  const d = await denied(req); if (d) return d;
  const data = await readData();
  const today = istToday();
  const inv = new Map(data.invoices.map((i) => [i.id, i]));
  const yearly = data.yearly.map((r) => rowOf(r, data, inv.get(r.invoiceId), today)).sort((a, b) => b.start.localeCompare(a.start));
  const monthly = data.monthly.map((r) => rowOf(r, data, inv.get(r.invoiceId), today)).sort((a, b) => b.start.localeCompare(a.start));
  const q = new URL(req.url).searchParams;
  if (q.get('format') === 'csv') {
    const which = q.get('register') === 'monthly' ? monthly : yearly;
    const head = ['Student', 'Student ID', 'Std', 'From', 'To', 'Monthly fee', ...(q.get('register') === 'monthly' ? [] : ['12 months', 'Yearly reduction %', 'Reduction']), 'Code discount', 'Total', 'Paid', 'Due', 'Status', 'Receipts'];
    const rows = which.map((r) => [r.student?.name ?? '', r.student?.studentCode ?? '', r.student?.standard ?? '', r.start, r.end, String(r.monthlyRate), ...(r.kind === 'yearly' ? [String(r.gross), String(r.reductionPct), String(r.reduction)] : []), String(r.couponDiscount), String(r.total), String(r.invoice?.paid ?? 0), String(r.invoice?.due ?? r.total), r.status, (r.invoice?.payments ?? []).map((p) => p.receiptNo).join(' ')]);
    return new NextResponse(csvOf([head, ...rows]), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${q.get('register') === 'monthly' ? 'monthly' : 'yearly'}-register.csv"` } });
  }
  const sum = (xs: typeof yearly, f: (r: (typeof yearly)[number]) => number) => Math.round(xs.reduce((a, r) => a + f(r) * 100, 0)) / 100;
  const activeIds = (xs: typeof yearly) => new Set(xs.filter((r) => r.current && r.status === 'paid').map((r) => r.studentId));
  const totals = {
    yearly: { records: yearly.length, activeStudents: activeIds(yearly).size, collected: sum(yearly, (r) => r.invoice?.paid ?? 0), due: sum(yearly, (r) => (r.status === 'upcoming' ? 0 : r.invoice?.due ?? 0)), reductionGiven: sum(yearly.filter((r) => r.status === 'paid'), (r) => (r.kind === 'yearly' ? r.reduction : 0)) },
    monthly: { records: monthly.length, activeStudents: activeIds(monthly).size, collected: sum(monthly, (r) => r.invoice?.paid ?? 0), due: sum(monthly, (r) => (r.status === 'upcoming' ? 0 : r.invoice?.due ?? 0)), overdue: monthly.filter((r) => r.status === 'overdue').length },
  };
  const all = [...data.yearly, ...data.monthly];
  const students = data.students.map((s) => ({ id: s.id, name: s.name, studentCode: s.studentCode, standard: s.standard, monthlyRate: monthlyRateFor(data.settings.plans, s.standard), paidThrough: paidThrough(s.id, all, data.invoices) ?? null, nextStart: nextStart(s.id, all, today), plan: data.yearly.some((r) => r.studentId === s.id && r.end >= today) ? 'yearly' : data.monthly.some((r) => r.studentId === s.id && r.end >= today) ? 'monthly' : null })).sort((a, b) => a.name.localeCompare(b.name));
  return NextResponse.json({ ok: true, today, settings: data.settings.plans, prices: planPriceRows(data.settings.plans), yearly, monthly, totals, students });
}


/**
 * POST { action: 'settings', plans: { prices: [{ standard, monthly }], yearlyReductionPct, graceDays } }
 *      { action: 'yearly', studentId, start? }    a 12-month advance plan (starts after the student's last plan, or today)
 *      { action: 'monthly', studentId, start? }   one month
 *      { action: 'nextMonth' }                    next month's bill for every monthly student whose last month ends within 7 days
 *      { action: 'remove', register, id }         only while nothing is paid on its bill
 * Payments are recorded on the record's bill with Fees → { action: 'pay', invoiceId, … } (receipt, commission, enrolment).
 */
export async function POST(req: Request) {
  const d = await denied(req); if (d) return d;
  const b = await req.json().catch(() => ({}));
  const today = istToday();
  if (b.action === 'settings') {
    const s = cleanPlanSettings(b.plans);
    if (typeof s === 'string') return bad(s);
    await update((data) => { data.settings.plans = s; });
    return NextResponse.json({ ok: true, settings: s, prices: planPriceRows(s) });
  }
  if (b.action === 'yearly' || b.action === 'monthly') {
    if (b.start !== undefined && b.start !== '' && !day(b.start)) return bad('Start date is not valid');
    const r = await update((data) => addRecord(data, b.action, String(b.studentId ?? ''), day(b.start), today));
    return typeof r === 'string' ? bad(r) : NextResponse.json({ ok: true, record: r });
  }
  if (b.action === 'nextMonth') {
    const r = await update((data) => {
      const made: string[] = [], skipped: string[] = [];
      const last = new Map<string, MonthlyRecord>();
      for (const m of data.monthly) if (!last.has(m.studentId) || last.get(m.studentId)!.end < m.end) last.set(m.studentId, m);
      for (const [sid, m] of last) {
        // a student who moved to a yearly plan after their last month is not billed monthly again
        if (data.yearly.some((y) => y.studentId === sid && y.end > m.end)) continue;
        if (m.end > addDaysLocal(today, 7)) continue; // the current month still has more than a week to run
        const res = addRecord(data, 'monthly', sid, '', today);
        (typeof res === 'string' ? skipped : made).push(typeof res === 'string' ? res : res.id);
      }
      return { made: made.length, skipped };
    });
    return NextResponse.json({ ok: true, ...r });
  }
  if (b.action === 'remove') {
    const reg = b.register === 'monthly' ? 'monthly' : 'yearly';
    const r = await update((data) => {
      const list: PlanRecord[] = data[reg];
      const rec = list.find((x) => x.id === b.id);
      if (!rec) return 'Record not found';
      const inv = data.invoices.find((i) => i.id === rec.invoiceId);
      if (inv && invoicePaid(inv) > 0) return 'A payment is recorded on this bill, so it cannot be removed';
      data.invoices = data.invoices.filter((i) => i.id !== rec.invoiceId);
      if (reg === 'yearly') data.yearly = data.yearly.filter((x) => x.id !== rec.id); else data.monthly = data.monthly.filter((x) => x.id !== rec.id);
      return '';
    });
    return r ? bad(r, 409) : NextResponse.json({ ok: true });
  }
  return bad('Unknown action');
}

const addDaysLocal = (d0: string, n: number) => new Date(Date.parse(`${d0}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
