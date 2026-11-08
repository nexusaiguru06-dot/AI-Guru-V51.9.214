/** V51.9.93 (server only): who is asking for book content, and which parts they may open. */
import { teacherCovers } from '../schools/rules';
import { schoolTeacherFromRequest } from '../schools/session';
import { nextPartBill, partPlanOf, schoolOff } from './part-plan';
import { invoiceDue } from './fees';
import { lockedPartsOf } from '../material-studio/locks';
import type { IndexedDocument } from '../material-studio/types';
import { isAdmin, studentFromRequest } from './auth';
import { readData, type AdminData } from './store';
import { dueOf, entitlement, istToday, pricePreview, type Entitlement, type PlanView } from './enrolment';
import { monthlyQuote, monthlyRateFor, yearlyQuote } from './plans';
import type { Student } from './fees';
import { guestIdFrom } from '../library/guest';

export interface ContentAccess extends Entitlement {
  /** School-wide free parts (a book may have its own). */
  freeParts: number[];
  /** For the "unlock" message: what the student owes, or would pay for their standard with their code. */
  due?: number; fee?: number; studentCode?: string;
  /** V51.9.94: the two plans for the student's standard, after their code discount (when monthly fees are set). */
  monthly?: number; yearly?: number; yearlyReductionPct?: number; paidThrough?: string;
  /** V51.9.95: the signed-in student (an uploader opens every part of their own book). */
  studentId?: string; isAdmin?: boolean;
  /** V51.9.107: this browser's guest id (a guest opens their own private books and materials). */
  guestId?: string;
  /** V51.9.192: the part plan is on — the price of one part (for "pay to open"). */
  partPrice?: number;
  /** V51.9.193: the contracted school of this student or school teacher, and the teacher (when a teacher is signed in). */
  schoolId?: string; schoolTeacherId?: string;
  /** V51.9.195: a school teacher opens in full only the books of their subject and standards. */
  teacherScope?: { subject: string; standards: string[]; syllabus: string };
}

export const planViewOf = (data: AdminData): PlanView => ({ records: [...data.yearly, ...data.monthly], graceDays: data.settings.plans.graceDays });

/** The monthly and yearly price a student would pay now (null when no monthly fee is set for their standard). */
export function planOffer(data: AdminData, st: Student) {
  const rate = monthlyRateFor(data.settings.plans, st.standard);
  if (rate === null) return null;
  const cp = data.coupons.find((c) => c.code === st.coupon && c.active);
  const flatUsed = data.invoices.some((i) => i.studentId === st.id && i.coupon === st.coupon);
  return { monthlyRate: rate, monthly: monthlyQuote(rate, cp, flatUsed).total, yearly: yearlyQuote(rate, data.settings.plans.yearlyReductionPct, cp, flatUsed).total, twelveMonths: Math.round(rate * 12 * 100) / 100, yearlyReductionPct: data.settings.plans.yearlyReductionPct };
}

/** V51.9.95: full access to this book? (everyone entitled, plus the student who uploaded it) */
const ownedBy = (x: { owner?: { kind: string; id?: string } }, a: ContentAccess) => (!!a.studentId && x.owner?.kind === 'student' && x.owner.id === a.studentId) || (!!a.guestId && x.owner?.kind === 'guest' && x.owner.id === a.guestId);
export const fullFor = (doc: { owner?: { kind: string; id?: string }; subject?: string; grade?: string; syllabus?: string }, a: ContentAccess) =>
  a.full || ownedBy(doc, a) || (!!a.teacherScope && teacherCovers(a.teacherScope, { subject: doc.subject ?? '', grade: doc.grade ?? '', syllabus: doc.syllabus }, a.teacherScope.syllabus));
/** V51.9.95: a hidden book or material is only for the admin and its owner. */
export const mayView = (x: { hidden?: boolean; owner?: { kind: string; id?: string }; school?: string }, a: ContentAccess) =>
  // V51.9.193: a school teacher's material is seen only by that school (and the office)
  (!x.school || !!a.isAdmin || a.schoolId === x.school) && (!x.hidden || !!a.isAdmin || ownedBy(x, a));

/** V51.9.193 — for a school's students and teachers: their teacher's version replaces the AI material it was made from. */
export function schoolVersions<T extends { id: string; basedOn?: string; school?: string }>(list: T[], a: ContentAccess): T[] {
  if (!a.schoolId) return list;
  const replaced = new Set(list.filter((m) => m.school === a.schoolId && m.basedOn).map((m) => m.basedOn!));
  return list.filter((m) => !replaced.has(m.id));
}

/** V51.9.95: other students never see which student made a book or material (only that a student did). */
export function withPublicOwner<T extends { owner?: { kind: 'admin' | 'student' | 'guest'; id?: string; name?: string; via?: 'studio' | 'cloud' } }>(x: T, a: ContentAccess): T {
  if (!x.owner || x.owner.kind === 'admin' || a.isAdmin || ownedBy(x, a)) return x;
  return { ...x, owner: { kind: 'student', via: x.owner.via } };
}

/**
 * V51.9.192 — parts of this book the person may NOT make study materials for: on the part plan, a part that is not free
 * and not paid — even for their own upload and with their own AI key (the office and fully paid students: none).
 */
export function createLockedParts(doc: Pick<IndexedDocument, 'freeParts'>, a: ContentAccess): number[] {
  if (!a.partPrice || a.isAdmin || a.full) return [];
  return lockedPartsOf(doc, a.freeParts, false, a.paidParts).lockedParts;
}

export async function contentAccessFor(req: Request): Promise<ContentAccess> {
  const data = await readData();
  const s = data.settings.access;
  const [admin, id, tch] = await Promise.all([isAdmin(req), studentFromRequest(req), schoolTeacherFromRequest(req)]);
  const guestId = !admin && !id && !tch ? guestIdFrom(req) ?? undefined : undefined;
  const student = id ? data.students.find((x) => x.id === id) : undefined;
  // V51.9.193: a school teacher sees every part (to prepare and correct), and their school's materials
  // V51.9.195 (review): only the books of the teacher's subject and standards open in full, not every book
  if (tch && !id) return { full: false, why: 'visitor', signedIn: true, freeParts: s.freeParts, isAdmin: false, schoolId: tch.schoolId, schoolTeacherId: tch.id, teacherScope: { subject: tch.subject, standards: tch.standards, syllabus: tch.school.syllabus } };
  const sch = student?.schoolLink ? { schoolId: student.schoolLink.schoolId } : {};
  if (!s.enabled) return { full: true, why: 'off', signedIn: !!id, freeParts: s.freeParts, studentId: id ?? undefined, isAdmin: admin, guestId, ...sch };
  const e0 = entitlement({ settings: s, isAdmin: admin, student, invoices: data.invoices, classes: data.classes, today: istToday(), plan: planViewOf(data) });
  const pp = partPlanOf(s);
  const e = pp.enabled ? { ...e0, partPrice: pp.partPrice } : e0;
  if (e.full || !student) return { ...e, freeParts: s.freeParts, studentId: student?.id, isAdmin: admin, guestId, ...sch };
  const cp = data.coupons.find((c) => c.code === student.coupon && c.active);
  // V51.9.194: on the part plan there are no monthly / yearly offers, and "due" is the next part's fee (not every part together)
  const offer = pp.enabled ? null : planOffer(data, student);
  const nextBill = pp.enabled ? nextPartBill(student.id, data.invoices).next : undefined;
  return { ...e, ...sch, ...(pp.enabled ? { partPrice: pp.partPrice - schoolOff(student, pp.partPrice) } /* V51.9.195: the school's discount, as on the bills */ : {}), studentId: student.id, isAdmin: admin, freeParts: s.freeParts, due: nextBill ? invoiceDue(nextBill) : dueOf(student.id, data.invoices), fee: pricePreview(data.heads, student.standard, cp).pay, studentCode: student.studentCode, ...(offer ? { monthly: offer.monthly, yearly: offer.yearly, yearlyReductionPct: offer.yearlyReductionPct } : {}) };
}
