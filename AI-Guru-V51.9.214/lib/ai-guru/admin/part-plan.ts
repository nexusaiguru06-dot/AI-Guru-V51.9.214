/**
 * V51.9.211 — paying by month. Every textbook is cut into TEN parts, one for each academic month; the office links each
 * part to a month (Kerala's year starts in June, other states differ). Part 1 is free for everyone.
 *
 *  • Each later part costs `partPrice` (the monthly fee). Paying a month opens that part of EVERY book at once — no
 *    calendar locking; the month only names the part, its bill and "this month's part". Paid parts stay open.
 *  • Paid all at once, before any month is paid, the paid parts cost `upfrontPrice`.
 *  • Bills have no due date: the student pays when ready to go on.
 *
 * Bills are made by AI Guru for each new student (one per paid part) so they show on the Fees page and in the student's
 * "Pay by UPI". Pure rules here; `ensurePartBills` runs inside store.update().
 */
import { invoiceDue, invoicePaid, type Invoice, type Student } from './fees';
import { addDays } from './plans';
import { PART_COUNT } from '../material-studio/parts';
import type { AdminData } from './store';

/** Same ids as store.newId (kept here so this file stays free of server code: the office pages use these rules too). */
const newId = (p: string) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export interface PartPlan {
  enabled: boolean;
  /** ₹ for each paid part, by instalments. */
  partPrice: number;
  /** ₹ for all the paid parts together, paid before any part. */
  upfrontPrice: number;
  /** Free doubt-clearing trial length in days from joining (the joining day is day 1). */
  trialDays: number;
  /** V51.9.211: the academic month each part is linked to (10 names; the office can change them). */
  months: string[];
}
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** Kerala's academic year: June to March. */
export const DEFAULT_MONTHS = ['June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
export const DEFAULT_PART_PLAN: PartPlan = { enabled: false, partPrice: 800, upfrontPrice: 6500, trialDays: 7, months: DEFAULT_MONTHS };
export const partPlanOf = (a: { partPlan?: Partial<PartPlan> } | undefined): PartPlan => {
  const p = { ...DEFAULT_PART_PLAN, ...(a?.partPlan ?? {}) };
  return { ...p, months: Array.from({ length: PART_COUNT }, (_, i) => (Array.isArray(p.months) && MONTH_NAMES.includes(p.months[i]) ? p.months[i] : DEFAULT_MONTHS[i])) };
};
/** The month a part is linked to ("July"), or '' when unknown. */
export const monthOfPart = (months: string[] | undefined, p: number) => (months ?? DEFAULT_MONTHS)[p - 1] ?? '';

/** V51.9.193: the school's student discount on a price (₹, rounded to the rupee). */
export const schoolOff = (st: Pick<Student, 'schoolLink'>, price: number) => (st.schoolLink?.discountPct ? Math.round(price * st.schoolLink.discountPct / 100) : 0);

/** Marks a bill made by the part plan: one part, or all the paid parts together. */
export interface PartBill { part?: number; all?: true }

/** The parts that are paid for (2–10 when Part 1 is free). */
export const paidPartsList = (freeParts: number[], partCount = PART_COUNT) => Array.from({ length: partCount }, (_, i) => i + 1).filter((p) => !freeParts.includes(p));

/** The trial's LAST day (the joining day is day 1): the day the free doubt trial ends. */
export const trialEndOf = (joinDay: string, plan: Pick<PartPlan, 'trialDays'>) => addDays(joinDay, Math.max(0, plan.trialDays - 1));

const istDay = (iso: string) => new Date((Date.parse(iso) || Date.now()) + 5.5 * 3600_000).toISOString().slice(0, 10);
const r2 = (n: number) => Math.round(n * 100) / 100;
export const partLabel = (p: number, months?: string[]) => (months ? `Part ${p} · ${monthOfPart(months, p)}` : `Part ${p}`);
export const allLabel = (parts: number[]) => `Parts ${parts[0]}–${parts[parts.length - 1]} (all at once)`;

/** This student's part-plan bills. */
export const partBillsOf = (studentId: string, invoices: Invoice[]) => invoices.filter((i) => i.studentId === studentId && i.partBill);

/** Parts this student has opened by paying (empty when not on the part plan). */
export function openedParts(studentId: string, invoices: Invoice[], freeParts: number[]): number[] {
  const bills = partBillsOf(studentId, invoices);
  const paid = (i: Invoice) => invoiceDue(i) <= 0 && invoicePaid(i) > 0;
  if (bills.some((i) => i.partBill?.all && paid(i))) return paidPartsList(freeParts);
  return bills.filter((i) => i.partBill?.part && paid(i)).map((i) => i.partBill!.part!).sort((a, b) => a - b);
}

/** The next instalment to pay (the lowest unpaid part), and whether the all-at-once price is still possible. */
export function nextPartBill(studentId: string, invoices: Invoice[]): { next?: Invoice; upfrontOk: boolean } {
  const bills = partBillsOf(studentId, invoices).filter((i) => i.partBill?.part);
  const next = bills.filter((i) => invoiceDue(i) > 0).sort((a, b) => a.partBill!.part! - b.partBill!.part!)[0];
  const anyPaid = bills.some((i) => invoicePaid(i) > 0) || partBillsOf(studentId, invoices).some((i) => i.partBill?.all);
  return { next, upfrontOk: !anyPaid && bills.length > 0 };
}

/** Whether AI Guru makes part bills for this student: a student who has paid nothing yet and has no free seat. */
const eligible = (st: Student, invoices: Invoice[]) => st.enrolled?.by !== 'admin' && !invoices.some((i) => i.studentId === st.id && (i.partBill || invoicePaid(i) > 0));

/**
 * Makes the part bills for every eligible student (once): one bill for each paid part, named for its month, with no due
 * date (paid when the student is ready; no reminders).
 * Call inside store.update(). Returns how many students got bills.
 */
export function ensurePartBills(data: AdminData, onlyStudentId?: string): number {
  const plan = partPlanOf(data.settings.access);
  if (!plan.enabled) return 0;
  const parts = paidPartsList(data.settings.access.freeParts);
  if (!parts.length) return 0;
  let n = 0;
  for (const st of data.students.filter((s) => !onlyStudentId || s.id === onlyStudentId)) {
    if (!eligible(st, data.invoices)) continue;
    parts.forEach((p) => data.invoices.push({
      id: newId('inv'), studentId: st.id, term: partLabel(p, plan.months), items: [{ name: `${partLabel(p, plan.months)} of every textbook`, amount: plan.partPrice }],
      discount: schoolOff(st, plan.partPrice), /* V51.9.193: a contracted school's students pay less */ payments: [], createdAt: new Date().toISOString(), partBill: { part: p },
    }));
    n++;
  }
  return n;
}

/**
 * Paying all at once: the unpaid part bills are replaced by one bill of `upfrontPrice` (due today). Only before any part
 * is paid. Call inside store.update(). Returns the new bill's id, or an error text.
 */
export function switchToUpfront(data: AdminData, studentId: string, today: string): string | { invoiceId: string } {
  const plan = partPlanOf(data.settings.access);
  const { upfrontOk } = nextPartBill(studentId, data.invoices);
  if (!plan.enabled || !upfrontOk) return 'Paying all at once is possible only before the first part is paid';
  const parts = paidPartsList(data.settings.access.freeParts);
  data.invoices = data.invoices.filter((i) => !(i.studentId === studentId && i.partBill?.part && invoicePaid(i) === 0));
  const st = data.students.find((x) => x.id === studentId);
  const inv: Invoice = { id: newId('inv'), studentId, term: allLabel(parts), items: [{ name: `${allLabel(parts)} of every textbook`, amount: plan.upfrontPrice }], discount: st ? schoolOff(st, plan.upfrontPrice) : 0, dueDate: today, payments: [], createdAt: new Date().toISOString(), partBill: { all: true } };
  data.invoices.push(inv);
  return { invoiceId: inv.id };
}

/** Checks the plan the office saves. */
export function cleanPartPlan(raw: unknown, paidCount: number): PartPlan | string {
  const a = { ...DEFAULT_PART_PLAN, ...((raw ?? {}) as Partial<PartPlan>) };
  const p: PartPlan = { enabled: !!a.enabled, partPrice: r2(Number(a.partPrice)), upfrontPrice: r2(Number(a.upfrontPrice)), trialDays: Math.round(Number(a.trialDays)), months: [] };
  const rawMonths = (raw as Partial<PartPlan> | undefined)?.months;
  if (rawMonths !== undefined && (!Array.isArray(rawMonths) || rawMonths.length !== PART_COUNT || rawMonths.some((m) => !MONTH_NAMES.includes(m)))) return `Link each of the ${PART_COUNT} parts to a month`;
  p.months = partPlanOf({ partPlan: { months: rawMonths } }).months;
  if (!(p.partPrice > 0 && p.partPrice <= 100000)) return 'The price of a part must be between ₹1 and ₹1,00,000';
  if (!(p.upfrontPrice > 0 && p.upfrontPrice <= 1000000)) return 'The all-at-once price must be between ₹1 and ₹10,00,000';
  if (paidCount > 0 && p.upfrontPrice > p.partPrice * paidCount) return `The all-at-once price should not be more than ${paidCount} × the part price`;
  if (!(p.trialDays >= 0 && p.trialDays <= 90)) return 'Free trial days must be between 0 and 90';
  return p;
}

/** For the student and the office: where this student stands on the part plan. */
export function partPlanStatus(st: Pick<Student, 'id' | 'createdAt' | 'schoolLink'>, invoices: Invoice[], freeParts: number[], plan: PartPlan) {
  const part = plan.partPrice - schoolOff(st, plan.partPrice), all = plan.upfrontPrice - schoolOff(st, plan.upfrontPrice); // V51.9.193
  const parts = paidPartsList(freeParts);
  const opened = openedParts(st.id, invoices, freeParts);
  const { next, upfrontOk } = nextPartBill(st.id, invoices);
  return {
    parts, opened, allPaid: parts.length > 0 && parts.every((p) => opened.includes(p)),
    trialEnds: trialEndOf(istDay(st.createdAt), plan), months: plan.months,
    next: next ? { part: next.partBill!.part!, amount: invoiceDue(next), dueDate: next.dueDate ?? '', month: monthOfPart(plan.months, next.partBill!.part!) } : null,
    upfront: upfrontOk ? { amount: all, saves: r2(part * parts.length - all) } : null,
    partPrice: part, total: r2(part * parts.length), ...(st.schoolLink?.discountPct ? { schoolDiscountPct: st.schoolLink.discountPct, school: st.schoolLink.schoolName } : {}),
  };
}

/** Whether this student still needs part bills (read-only check before a write). */
export const needsPartBills = (data: AdminData, studentId: string) => {
  const st = data.students.find((s) => s.id === studentId);
  return !!st && partPlanOf(data.settings.access).enabled && paidPartsList(data.settings.access.freeParts).length > 0 && eligible(st, data.invoices);
};

/** V51.9.195: paid the old way (a bill that is not a part bill): the part plan does not apply to this student. */
export const paidOldWay = (studentId: string, invoices: Invoice[]) => invoices.some((i) => i.studentId === studentId && !i.partBill && invoicePaid(i) > 0);
