/**
 * V51.9.94: two kinds of fee plan, kept in two registers (pure rules, no I/O).
 *
 *  - Yearly register: one advance payment for 12 months, with the admin's yearly reduction (e.g. 10% off 12 × monthly).
 *  - Monthly register: one bill per month.
 *
 * Months run from the start date (20 Oct → 19 Nov), not by calendar month, so a student who joins mid-month pays for a
 * full month. Every record has its own fee bill (an ordinary invoice), so payments, receipts, the friend's commission and
 * coupon discounts work exactly as in Fees. A record counts once its bill is fully paid; the student can open every part
 * of every book until the end of the last paid period, plus the admin's grace days.
 */
import { couponDiscount, invoiceDue, invoicePaid, invoiceTotal, rupees, type Coupon, type Invoice } from './fees';

export interface PlanPrice { /** "all" or a standard such as "8". */ standard: string; /** Rupees a month. */ monthly: number }
export interface PlanSettings {
  prices: PlanPrice[];
  /** Reduction for paying 12 months in advance, % off 12 × the monthly fee. */
  yearlyReductionPct: number;
  /** Days after a paid period ends before the paid parts lock again. */
  graceDays: number;
}
export const DEFAULT_PLANS: PlanSettings = { prices: [], yearlyReductionPct: 10, graceDays: 5 };

interface PlanRecordBase {
  id: string; studentId: string; invoiceId: string;
  /** First and last day covered (YYYY-MM-DD, both included). */
  start: string; end: string;
  /** Monthly fee of the student's standard when the record was made (frozen). */
  monthlyRate: number;
  /** Friend's / class code discount on this bill (rupees). */
  couponDiscount: number; coupon?: string;
  /** What the student pays for this record. */
  total: number;
  createdAt: string;
}
/** One row of the yearly register. */
export interface YearlyRecord extends PlanRecordBase { kind: 'yearly'; months: 12; gross: number; reductionPct: number; reduction: number }
/** One row of the monthly register. */
export interface MonthlyRecord extends PlanRecordBase { kind: 'monthly' }
export type PlanRecord = YearlyRecord | MonthlyRecord;

const DAY = 86_400_000;
export const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
/** Same day n months later; a day the month does not have becomes its last day (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), Math.min(d, last))).toISOString().slice(0, 10);
}
/** Last day of a period of `months` starting on `start`. */
export const periodEnd = (start: string, months: number) => addDays(addMonths(start, months), -1);
const nice = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
export const periodLabel = (r: Pick<PlanRecord, 'kind' | 'start' | 'end'>) => `${r.kind === 'yearly' ? 'Yearly' : 'Monthly'} · ${nice(r.start)} – ${nice(r.end)}`;

const r2 = (n: number) => Math.round(n * 100) / 100;

/** The monthly fee of a standard (its own price, else the "all" price), or null when none is set. */
export function monthlyRateFor(s: Pick<PlanSettings, 'prices'>, standard: string): number | null {
  const std = standard.trim().toLowerCase();
  const p = s.prices.find((x) => x.standard.toLowerCase() === std) ?? s.prices.find((x) => x.standard === 'all');
  return p ? p.monthly : null;
}

/** What a yearly plan costs: 12 months, less the yearly reduction, less the student's code discount. */
export function yearlyQuote(monthly: number, reductionPct: number, coupon?: Coupon, flatUsed = false) {
  const gross = r2(monthly * 12);
  const reduction = r2((gross * Math.min(100, Math.max(0, reductionPct))) / 100);
  const afterReduction = r2(gross - reduction);
  const code = couponDiscount(coupon, afterReduction, flatUsed);
  return { gross, reductionPct, reduction, couponDiscount: code, total: r2(afterReduction - code), /** what the yearly reduction saves against 12 monthly bills */ saving: reduction };
}
/** What one month costs, less the student's code discount. */
export function monthlyQuote(monthly: number, coupon?: Coupon, flatUsed = false) {
  const code = couponDiscount(coupon, monthly, flatUsed);
  return { gross: monthly, couponDiscount: code, total: r2(monthly - code) };
}

/** The invoice that carries a record (items show 12 × monthly and the yearly reduction, so the receipt explains the price). */
export function invoiceFor(r: PlanRecord, id: string, now: string): Invoice {
  const items = r.kind === 'yearly'
    ? [{ name: `Yearly fee (12 × ${rupees(r.monthlyRate)})`, amount: r.gross }]
    : [{ name: 'Monthly fee', amount: r.monthlyRate }];
  const discount = r2((r.kind === 'yearly' ? r.reduction : 0) + r.couponDiscount);
  return { id, studentId: r.studentId, term: periodLabel(r), items, discount, coupon: r.couponDiscount > 0 ? r.coupon : undefined, dueDate: r.start, payments: [], createdAt: now };
}

export type RecordStatus = 'paid' | 'partial' | 'due' | 'overdue' | 'upcoming';
/** Paid in full / part paid / due now / unpaid after its start + grace / not started and unpaid. */
export function recordStatus(r: Pick<PlanRecord, 'start'>, inv: Invoice | undefined, today: string, graceDays: number): RecordStatus {
  if (!inv) return 'due';
  if (invoiceTotal(inv) > 0 && invoiceDue(inv) <= 0) return 'paid';
  if (invoiceTotal(inv) <= 0) return 'paid';
  if (invoicePaid(inv) > 0) return 'partial';
  if (today < r.start) return 'upcoming';
  return today > addDays(r.start, graceDays) ? 'overdue' : 'due';
}

/** The last day covered by a fully paid record of this student (either register), or undefined. */
export function paidThrough(studentId: string, records: PlanRecord[], invoices: Invoice[]): string | undefined {
  const byId = new Map(invoices.map((i) => [i.id, i]));
  return records.filter((r) => r.studentId === studentId).filter((r) => { const inv = byId.get(r.invoiceId); return !!inv && (invoiceTotal(inv) <= 0 || invoiceDue(inv) <= 0); }).map((r) => r.end).sort().at(-1);
}

/** Where the next record should start: the day after the last record (paid or not), or today. */
export function nextStart(studentId: string, records: PlanRecord[], today: string): string {
  const last = records.filter((r) => r.studentId === studentId).map((r) => r.end).sort().at(-1);
  return last && last >= today ? addDays(last, 1) : today;
}

/** Two records of one student must not cover the same day. */
export const overlaps = (studentId: string, records: PlanRecord[], start: string, end: string) => records.some((r) => r.studentId === studentId && r.start <= end && start <= r.end);

/** Checks the plan settings form. */
export function cleanPlanSettings(raw: unknown): PlanSettings | string {
  const a = (raw ?? {}) as Partial<PlanSettings>;
  if (!Array.isArray(a.prices)) return 'Prices must be a list';
  const prices = a.prices.slice(0, 20).map((p) => ({ standard: String(p?.standard ?? '').replace(/\s+/g, ' ').trim().slice(0, 8) || 'all', monthly: r2(Number(p?.monthly)) }));
  if (prices.some((p) => !(p.monthly > 0 && p.monthly <= 100000))) return 'Each monthly fee must be between ₹1 and ₹1,00,000';
  if (new Set(prices.map((p) => p.standard.toLowerCase())).size !== prices.length) return 'Two prices cannot be for the same standard';
  const yearlyReductionPct = r2(Number(a.yearlyReductionPct));
  if (!(yearlyReductionPct >= 0 && yearlyReductionPct <= 90)) return 'Yearly reduction must be between 0 and 90 per cent';
  const graceDays = Math.round(Number(a.graceDays));
  if (!(graceDays >= 0 && graceDays <= 60)) return 'Grace days must be between 0 and 60';
  return { prices: prices.sort((x, y) => (x.standard === 'all' ? 1 : y.standard === 'all' ? -1 : x.standard.localeCompare(y.standard, undefined, { numeric: true }))), yearlyReductionPct, graceDays };
}

/** Monthly vs yearly for each priced standard, for the admin's table and the student's offer. */
export function planPriceRows(s: PlanSettings) {
  return s.prices.map((p) => { const y = yearlyQuote(p.monthly, s.yearlyReductionPct); return { standard: p.standard, monthly: p.monthly, twelveMonths: y.gross, yearly: y.total, saving: y.reduction }; });
}
