/**
 * V51.9.185 — fees not paid on time (pure: no I/O). One set of rules for every bill, by term or by month / year:
 *
 *   soon   — due within the next 3 days            → a reminder
 *   today  — due today                             → a reminder
 *   grace  — past the due date, inside grace days   → a reminder; Parts 2–10 still open
 *   over   — grace days are over                   → "Your grace period is over, please make payment to continue";
 *                                                    Parts 2–10 lock again (Part 1, progress, quizzes, the Student ID stay)
 *   held   — the office gave extra days (until a date) → open, no reminder
 *
 * A student more than INACTIVE_DAYS overdue is shown as inactive in the office's lists (paying brings them back).
 */
import { invoiceDue, type Invoice, type Student } from './fees';
import { addDays, type PlanRecord } from './plans';

export const SOON_DAYS = 3;
export const INACTIVE_DAYS = 60;
export const DEFAULT_GRACE = 5;
export type DueStage = 'soon' | 'today' | 'grace' | 'over' | 'held';
export interface FeeHold { until: string; note?: string; at: string }
export interface Due { invoiceId: string; label: string; amount: number; dueDate: string; graceUntil: string; stage: DueStage; daysOverdue: number; holdUntil?: string }

const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/** A bill made without a due date falls due this many days after it was made. */
export const NO_DATE_DAYS = 30;
/** The day a bill is due: its own due date, else the start of its monthly / yearly period, else 30 days after it was made. */
export function dueDateOf(i: Invoice, plans: PlanRecord[]): string {
  return i.dueDate || plans.find((r) => r.invoiceId === i.id)?.start || addDays(i.createdAt.slice(0, 10), NO_DATE_DAYS);
}

/** Every bill of this student with money still due, from today's point of view (bills due more than 3 days ahead are left out). */
export function duesOf(st: Pick<Student, 'id'> & { feeHold?: FeeHold }, invoices: Invoice[], plans: PlanRecord[], today: string, graceDays = DEFAULT_GRACE): Due[] {
  const held = st.feeHold && st.feeHold.until >= today ? st.feeHold.until : undefined;
  // V51.9.192: a later part of the part plan has no due date — paid when the student is ready, so no reminders
  return invoices.filter((i) => i.studentId === st.id && invoiceDue(i) > 0 && !(i.partBill && !i.dueDate)).flatMap((i): Due[] => {
    const dueDate = dueDateOf(i, plans);
    const graceUntil = addDays(dueDate, graceDays);
    const late = daysBetween(dueDate, today);
    if (late < -SOON_DAYS) return [];
    const stage: DueStage = held && late > 0 ? 'held' : late < 0 ? 'soon' : late === 0 ? 'today' : today <= graceUntil ? 'grace' : 'over';
    return [{ invoiceId: i.id, label: i.term, amount: invoiceDue(i), dueDate, graceUntil, stage, daysOverdue: Math.max(0, late), ...(held ? { holdUntil: held } : {}) }];
  }).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/** The most serious stage among a student's bills (over > grace > today > soon > held), or null when nothing is due. */
export function worstStage(dues: Due[]): DueStage | null {
  for (const s of ['over', 'grace', 'today', 'soon', 'held'] as const) if (dues.some((d) => d.stage === s)) return s;
  return null;
}

/** Grace days are over on a bill (and no extra days): Parts 2–10 lock until it is paid. */
export const locksParts = (dues: Due[]) => dues.some((d) => d.stage === 'over');
export const isInactive = (dues: Due[]) => dues.some((d) => d.stage === 'over' && d.daysOverdue > INACTIVE_DAYS);

const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/** The office's message for a reminder (English and Malayalam), the same text the banner shows. */
export function dueMessage(name: string, d: Due): string {
  const first = name.split(' ')[0] || name;
  const pay = 'Pay by UPI from “My account” (💳 Pay the fee by UPI), or at the school office.';
  if (d.stage === 'over') return `⚠️ ${first}, your grace period is over, please make payment to continue. ${inr(d.amount)} for “${d.label}” was due on ${d.dueDate}. Parts 2–10 are locked until it is paid; Part 1, your progress and your Student ID are safe.\n${pay}`;
  if (d.stage === 'grace') {
    // V51.9.186: one of these every day of the grace period — "day 2 of 5 · 3 days left"
    const total = daysBetween(d.dueDate, d.graceUntil), left = total - d.daysOverdue;
    return `⏳ ${first}, grace period day ${d.daysOverdue} of ${total}: ${inr(d.amount)} for “${d.label}” was due on ${d.dueDate}. ${left > 0 ? `${left} day${left === 1 ? '' : 's'} left —` : 'Last day —'} please pay by ${d.graceUntil} to keep Parts 2–10 open.\n${pay}`;
  }
  if (d.stage === 'today') return `${first}, ${inr(d.amount)} for “${d.label}” is due today (${d.dueDate}).\n${pay}`;
  return `${first}, a reminder: ${inr(d.amount)} for “${d.label}” is due on ${d.dueDate}.\n${pay}`;
}
