/**
 * V51.9.183 — making a monthly or yearly plan record and its fee bill (moved here from the plans route, so the UPI
 * payment confirmation can use the same rules as the office).
 */
import { newId, type AdminData } from './store';
import { invoiceFor, monthlyQuote, monthlyRateFor, nextStart, overlaps, periodEnd, yearlyQuote, type MonthlyRecord, type PlanRecord, type YearlyRecord } from './plans';

/** What a new plan record would cost this student today, without making it (null: no fee set for their standard). */
export function planQuote(data: AdminData, kind: 'yearly' | 'monthly', studentId: string): number | null {
  const st = data.students.find((s) => s.id === studentId);
  if (!st) return null;
  const rate = monthlyRateFor(data.settings.plans, st.standard);
  if (rate === null) return null;
  const cp = data.coupons.find((c) => c.code === st.coupon && c.active);
  const flatUsed = data.invoices.some((i) => i.studentId === st.id && i.coupon === st.coupon);
  return kind === 'yearly' ? yearlyQuote(rate, data.settings.plans.yearlyReductionPct, cp, flatUsed).total : monthlyQuote(rate, cp, flatUsed).total;
}

/** Makes one record and its fee bill. Returns an error text, or the record. */
export function addPlanRecord(data: AdminData, kind: 'yearly' | 'monthly', studentId: string, startRaw: string, today: string): string | PlanRecord {
  const st = data.students.find((s) => s.id === studentId);
  if (!st) return 'Student not found';
  const rate = monthlyRateFor(data.settings.plans, st.standard);
  if (rate === null) return `Set the monthly fee for Std ${st.standard || '?'} (or for all standards) first`;
  const all = [...data.yearly, ...data.monthly];
  const start = startRaw || nextStart(st.id, all, today);
  const end = periodEnd(start, kind === 'yearly' ? 12 : 1);
  if (overlaps(st.id, all, start, end)) return `${st.name} already has a plan covering part of ${start} – ${end}. Start after ${nextStart(st.id, all, today)}.`;
  const cp = data.coupons.find((c) => c.code === st.coupon && c.active);
  const flatUsed = data.invoices.some((i) => i.studentId === st.id && i.coupon === st.coupon);
  const now = new Date().toISOString();
  const base = { id: newId(kind === 'yearly' ? 'yr' : 'mo'), studentId: st.id, invoiceId: newId('inv'), start, end, monthlyRate: rate, coupon: st.coupon, createdAt: now };
  let rec: PlanRecord;
  if (kind === 'yearly') {
    const qy = yearlyQuote(rate, data.settings.plans.yearlyReductionPct, cp, flatUsed);
    rec = { ...base, kind: 'yearly', months: 12, gross: qy.gross, reductionPct: qy.reductionPct, reduction: qy.reduction, couponDiscount: qy.couponDiscount, total: qy.total } satisfies YearlyRecord;
    data.yearly.push(rec);
  } else {
    const qm = monthlyQuote(rate, cp, flatUsed);
    rec = { ...base, kind: 'monthly', couponDiscount: qm.couponDiscount, total: qm.total } satisfies MonthlyRecord;
    data.monthly.push(rec);
  }
  data.invoices.push(invoiceFor(rec, rec.invoiceId, now));
  return rec;
}
