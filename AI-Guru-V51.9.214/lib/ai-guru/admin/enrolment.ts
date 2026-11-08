/**
 * V51.9.93: free trial = the free part of every book; enrolment unlocks the rest (pure rules, no I/O).
 *
 * Material Studio splits every uploaded textbook into five parts. Part 1 (or whichever parts the admin marks free, per book
 * or school-wide) is the trial: anyone can study it, with all its study materials — whiteboard notes, MCQ, revision and the
 * rest. Parts 2–10 and their materials open only for enrolled students. The first fee payment the office records enrols a
 * student; the admin can also enrol a student by hand (a free seat). Students of a tuition centre in its free pilot get
 * everything while the pilot lasts. Everything is open until the admin switches the lock on.
 */
import { couponDiscount, invoicePaid, invoiceTotal, itemsFor, type Coupon, type FeeHead, type Invoice, type Student } from './fees';
import type { ClassGroup } from './groups';
import { addDays, paidThrough, type PlanRecord } from './plans';
import { DEFAULT_GRACE, duesOf, locksParts } from './dues';
import { PART_COUNT } from '../material-studio/parts';
import { cleanPartPlan, openedParts, paidPartsList, partPlanOf, type PartPlan } from './part-plan';

export interface AccessSettings {
  /** Parts outside the free ones are locked for students who have not paid. Off = every part open, as before. */
  enabled: boolean;
  /** School-wide free parts (1–10) for books that have no setting of their own. Default: Part 1. */
  freeParts: number[];
  /** V51.9.191: paying by part — a monthly fee for each paid part or one all-at-once price; each paid part opens in every book. */
  partPlan?: PartPlan;
}
export const DEFAULT_ACCESS: AccessSettings = { enabled: false, freeParts: [1] };

export interface Enrolment { on: string; by: 'payment' | 'admin'; note?: string }

/** enrolled = paid (or a free seat); pilot = centre in its free pilot; lapsed = a paid monthly/yearly period ended
 *  (V51.9.94); free = the free parts only (the trial). */
export type AccessStatus = 'enrolled' | 'pilot' | 'lapsed' | 'free';
export interface Access { status: AccessStatus; full: boolean; enrolledOn?: string; enrolledBy?: 'payment' | 'admin'; pilotUntil?: string; /** V51.9.94: last day of the last paid monthly/yearly period. */ paidThrough?: string; /** …and the day the paid parts lock after the grace days. */ openUntil?: string }
/** V51.9.94: the student's monthly/yearly records and the grace days, when the school uses plans. */
export interface PlanView { records: PlanRecord[]; graceDays: number }

/** Today's date in India (YYYY-MM-DD). */
export const istToday = (now: number = Date.now()) => new Date(now + 5.5 * 3600_000).toISOString().slice(0, 10);

/** The first day a fee payment was recorded for the student, or undefined. */
export const firstPaymentDate = (studentId: string, invoices: Invoice[]) =>
  invoices.filter((i) => i.studentId === studentId).flatMap((i) => i.payments.filter((p) => p.amount > 0).map((p) => p.date)).sort()[0];

/** Where a student stands. A recorded payment always enrols, even if nobody pressed "enrol". */
export function accessOf(st: Pick<Student, 'id' | 'enrolled' | 'classId' | 'feeHold'>, invoices: Invoice[], classes: Pick<ClassGroup, 'id' | 'kind' | 'pilotUntil' | 'active'>[], today: string, plan?: PlanView): Access {
  const g = st.classId ? classes.find((c) => c.id === st.classId) : undefined;
  const pilot: Access | undefined = g && g.active && g.kind === 'centre' && g.pilotUntil && g.pilotUntil >= today ? { status: 'pilot', full: true, pilotUntil: g.pilotUntil } : undefined;
  // A free seat from the office never runs out.
  if (st.enrolled?.by === 'admin') return { status: 'enrolled', full: true, enrolledOn: st.enrolled.on, enrolledBy: 'admin' };
  // V51.9.185: extra days from the office keep everything open until that date.
  const held = st.feeHold && st.feeHold.until >= today ? st.feeHold.until : undefined;
  // V51.9.94: a student on a monthly or yearly plan is enrolled while a paid period (plus grace days) covers today.
  const mine = plan?.records.filter((r) => r.studentId === st.id) ?? [];
  if (plan && mine.length) {
    const pt = paidThrough(st.id, mine, invoices);
    const first = firstPaymentDate(st.id, invoices);
    if (pt) {
      const openUntil = addDays(pt, plan.graceDays);
      if (today <= openUntil || held) return { status: 'enrolled', full: true, enrolledOn: st.enrolled?.on ?? first, enrolledBy: 'payment', paidThrough: pt, openUntil: held && held > openUntil ? held : openUntil };
      return pilot ?? { status: 'lapsed', full: false, paidThrough: pt, openUntil };
    }
    return pilot ?? { status: 'free', full: false };
  }
  // Fee bills made in Fees (by term): the first payment enrols — and (V51.9.185) a later bill left unpaid after its due
  // date and the grace days locks Parts 2–10 again, unless the office gave extra days. Paying opens them at once.
  const paid = st.enrolled?.on ?? firstPaymentDate(st.id, invoices);
  if (paid) {
    const over = locksParts(duesOf(st, invoices, [], today, plan?.graceDays ?? DEFAULT_GRACE));
    if (over) return pilot ?? { status: 'lapsed', full: false, enrolledOn: paid, enrolledBy: st.enrolled?.by ?? 'payment' };
    return { status: 'enrolled', full: true, enrolledOn: paid, enrolledBy: st.enrolled?.by ?? 'payment' };
  }
  return pilot ?? { status: 'free', full: false };
}

export const STATUS_LABEL: Record<AccessStatus, string> = { enrolled: 'Enrolled', pilot: 'Centre pilot (all parts)', lapsed: 'Paid period ended', free: 'Free trial (free parts only)' };

/** Who is asking, and may they open every part? */
export interface Entitlement {
  full: boolean; why: 'off' | 'admin' | 'enrolled' | 'pilot' | 'lapsed' | 'free' | 'visitor'; signedIn: boolean;
  /** V51.9.191 (part plan): the parts this student has opened by paying — open in every book, with the free parts. */
  paidParts?: number[];
}
export function entitlement(o: { settings: AccessSettings; isAdmin: boolean; student?: Student; invoices: Invoice[]; classes: Pick<ClassGroup, 'id' | 'kind' | 'pilotUntil' | 'active'>[]; today: string; plan?: PlanView }): Entitlement {
  if (!o.settings.enabled) return { full: true, why: 'off', signedIn: !!o.student };
  if (o.isAdmin) return { full: true, why: 'admin', signedIn: !!o.student };
  if (!o.student) return { full: false, why: 'visitor', signedIn: false };
  const a = accessOf(o.student, o.invoices, o.classes, o.today, o.plan);
  // V51.9.191: on the part plan, each paid part opens on its own; everything only when every part is paid (a free seat
  // from the office or a centre's pilot still opens everything)
  const pp = partPlanOf(o.settings);
  // V51.9.195 (review): a student who paid the old way (a bill that is not a part bill) keeps what they paid for —
  // switching the part plan on must never lock out a paying student
  const paidOldWay = o.invoices.some((i) => i.studentId === o.student!.id && !i.partBill && invoicePaid(i) > 0);
  if (pp.enabled && !paidOldWay && !(a.status === 'pilot' || a.enrolledBy === 'admin')) {
    const paidParts = openedParts(o.student.id, o.invoices, o.settings.freeParts);
    const all = paidPartsList(o.settings.freeParts);
    const full = all.length > 0 && all.every((p) => paidParts.includes(p));
    return { full, why: full ? 'enrolled' : paidParts.length ? (a.status === 'lapsed' ? 'lapsed' : 'enrolled') : 'free', signedIn: true, paidParts };
  }
  return { full: a.full, why: a.status, signedIn: true };
}

/** Parts of a book this person may not open (empty = everything open). */
export function lockedParts(freeParts: number[], partCount: number, e: Pick<Entitlement, 'full'>): number[] {
  if (e.full) return [];
  return Array.from({ length: partCount }, (_, i) => i + 1).filter((p) => !freeParts.includes(p));
}

/** What the student would pay for their standard today, with their coupon (friend's or class code). */
export function pricePreview(heads: FeeHead[], standard: string, coupon?: Coupon): { items: Array<{ name: string; amount: number }>; total: number; discount: number; pay: number } {
  const items = itemsFor(heads, standard);
  const total = invoiceTotal({ items, discount: 0 });
  const discount = couponDiscount(coupon, total, false);
  return { items, total, discount, pay: Math.max(0, Math.round((total - discount) * 100) / 100) };
}

/** Amount still due on the student's invoices. */
export const dueOf = (studentId: string, invoices: Invoice[]) => Math.round(invoices.filter((i) => i.studentId === studentId).reduce((a, i) => a + (invoiceTotal(i) - invoicePaid(i)) * 100, 0)) / 100;

/** Checks a list of free parts (1–10, no repeats, sorted). Empty is allowed: nothing free. */
export function cleanParts(raw: unknown, partCount = PART_COUNT): number[] | string {
  if (!Array.isArray(raw)) return 'Free parts must be a list';
  const out = [...new Set(raw.map((x) => Math.round(Number(x))))].sort((a, b) => a - b);
  if (out.some((p) => !(p >= 1 && p <= partCount))) return `Parts are numbered 1 to ${partCount}`;
  return out;
}

export function cleanAccess(raw: unknown): AccessSettings | string {
  const a = (raw ?? {}) as Partial<AccessSettings>;
  const freeParts = cleanParts(a.freeParts ?? [1]);
  if (typeof freeParts === 'string') return freeParts;
  // V51.9.191: the part plan (paying by part needs the lock on)
  const partPlan = cleanPartPlan(a.partPlan, paidPartsList(freeParts).length);
  if (typeof partPlan === 'string') return partPlan;
  return { enabled: !!a.enabled || partPlan.enabled, freeParts, partPlan };
}
