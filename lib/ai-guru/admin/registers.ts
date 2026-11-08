/**
 * V51.9.184 — the office's four student-management registers (pure: no I/O).
 *
 *  1. Students   — the raw sign-up record: Student ID, name, class, joining date, country, state, district, school,
 *                  phone / WhatsApp, email, mother tongue, the coupon / class code joined with.
 *  2. Activities — trial started, study materials downloaded (date), study materials created (date), attendance
 *                  (each day and time the app was used, and for how long).
 *  3. Fees       — every payment: Student ID, name, payment date, amount, mode, receipt, the coupon code joined with.
 *  4. Affiliate  — each student who brought others in: who joined under them, each one's payments, commission still
 *                  to be paid (next payout day, the 4th) and the payouts of earlier months.
 *
 * Every register can be narrowed by country → state → district → school, and by teacher (the teacher's class).
 */
import { affiliateReport, type AffiliateReport } from './affiliate';
import type { Invoice, Student } from './fees';
import type { ClassGroup } from './groups';
import type { AttendanceSession } from '../attendance/register';
import type { PlanRecord } from './plans';
import { duesOf, isInactive, worstStage } from './dues';

export const SHEETS = ['students', 'activities', 'fees', 'affiliate', 'dues'] as const;
export type Sheet = typeof SHEETS[number];

export interface RegisterFilter { country?: string; state?: string; district?: string; school?: string; teacher?: string; q?: string }

const norm = (s: string | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
const same = (a: string | undefined, b: string | undefined) => norm(a).toLowerCase() === norm(b).toLowerCase();
const day = (iso: string | undefined) => (iso ?? '').slice(0, 10);
/** India Standard Time, as the office reads it: "2026-11-02 18:40". */
export const istTime = (iso: string) => { const t = Date.parse(iso); return Number.isFinite(t) ? new Date(t + 5.5 * 3600_000).toISOString().slice(0, 16).replace('T', ' ') : ''; };

export const countryOf = (s: Student) => norm(s.country) || 'India';
const teacherOf = (s: Student, classes: ClassGroup[]) => classes.find((c) => c.id === s.classId);

/** Does this student match the chosen country, state, district, school, teacher and search text? */
export function matches(s: Student, f: RegisterFilter, classes: ClassGroup[]): boolean {
  if (f.country && !same(countryOf(s), f.country)) return false;
  if (f.state && !same(s.address.state, f.state)) return false;
  if (f.district && !same(s.address.district, f.district)) return false;
  if (f.school && !same(s.school, f.school)) return false;
  if (f.teacher && s.classId !== f.teacher) return false;
  if (f.q) {
    const q = f.q.toLowerCase();
    if (![s.name, s.studentCode, s.admissionNo, s.guardianPhone, s.email, s.school].some((x) => (x ?? '').toLowerCase().includes(q))) return false;
  }
  return true;
}

/** The dropdown choices, each narrowed by the choices above it (state by country, district by state, school by district). */
export function filterOptions(students: Student[], classes: ClassGroup[], f: RegisterFilter) {
  const uniq = (xs: string[]) => [...new Set(xs.map(norm).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const inCountry = students.filter((s) => !f.country || same(countryOf(s), f.country));
  const inState = inCountry.filter((s) => !f.state || same(s.address.state, f.state));
  const inDistrict = inState.filter((s) => !f.district || same(s.address.district, f.district));
  const used = new Set(students.map((s) => s.classId).filter(Boolean));
  return {
    countries: uniq(students.map(countryOf)),
    states: uniq(inCountry.map((s) => s.address.state)),
    districts: uniq(inState.map((s) => s.address.district)),
    schools: uniq(inDistrict.map((s) => s.school ?? '')),
    teachers: classes.filter((c) => used.has(c.id)).map((c) => ({ id: c.id, label: `${c.teacherName || 'Teacher'} · ${c.name}` })).sort((a, b) => a.label.localeCompare(b.label)),
  };
}

const base = (s: Student) => ({ studentId: s.studentCode || s.admissionNo || s.id, name: s.name });

// ---------- 1. Students ----------
export function studentRows(students: Student[], classes: ClassGroup[]) {
  return students.map((s) => ({
    ...base(s), standard: s.standard, joined: day(s.createdAt), country: countryOf(s), state: s.address.state, district: s.address.district,
    place: s.address.area, school: s.school ?? '', phone: s.guardianPhone, email: s.email ?? '', motherTongue: s.motherTongue ?? '',
    coupon: s.signupCode || s.coupon || '', teacher: (() => { const c = teacherOf(s, classes); return c ? `${c.teacherName} · ${c.name}` : ''; })(),
    source: s.source === 'self' ? 'Signed up' : 'Office',
  })).sort((a, b) => b.joined.localeCompare(a.joined) || a.name.localeCompare(b.name));
}

// ---------- 2. Activities ----------
export interface CreatedMaterial { ownerStudentId: string; createdAt: string; type: string; title: string }
export function activityRows(students: Student[], o: { books: Map<string, string>; created: CreatedMaterial[]; attendance: AttendanceSession[] }) {
  return students.map((s) => {
    const quiz = s.quizId ?? `student:${s.id}`;
    const visits = o.attendance.filter((a) => a.studentId === quiz).sort((a, b) => b.enteredAt.localeCompare(a.enteredAt));
    const downloads = (s.library ?? []).map((l) => ({ date: day(l.at), what: o.books.get(l.documentId) ?? l.documentId })).sort((a, b) => b.date.localeCompare(a.date));
    const created = o.created.filter((m) => m.ownerStudentId === s.id).map((m) => ({ date: day(m.createdAt), what: `${m.type} · ${m.title}` })).sort((a, b) => b.date.localeCompare(a.date));
    return {
      ...base(s), standard: s.standard, trialStarted: day(s.createdAt), enrolledOn: s.enrolled?.on ?? '',
      downloads, created,
      attendance: visits.map((v) => ({ at: istTime(v.enteredAt), minutes: Math.round((v.activeSeconds ?? 0) / 60) })),
      lastActive: visits[0] ? istTime(visits[0].lastSeenAt || visits[0].enteredAt) : '',
      totalMinutes: Math.round(visits.reduce((a, v) => a + (v.activeSeconds ?? 0), 0) / 60),
    };
  }).sort((a, b) => b.lastActive.localeCompare(a.lastActive) || b.trialStarted.localeCompare(a.trialStarted));
}

// ---------- 3. Fees ----------
export function feeRows(students: Student[], invoices: Invoice[]) {
  const who = new Map(students.map((s) => [s.id, s]));
  return invoices.flatMap((i) => {
    const s = who.get(i.studentId);
    if (!s) return [];
    return i.payments.map((p) => ({
      ...base(s), date: p.date, amount: p.amount, mode: p.mode, receiptNo: p.receiptNo, for: i.term,
      coupon: s.signupCode || s.coupon || i.coupon || '', note: p.note ?? '', studentKey: s.id,
      txnId: p.txnId ?? '', utr: p.utr ?? '', confirmedBy: p.confirmedBy ?? '', // V51.9.190
    }));
  }).sort((a, b) => b.date.localeCompare(a.date) || b.receiptNo.localeCompare(a.receiptNo));
}

// ---------- 4. Affiliate ----------
export function affiliateRows(students: Student[], invoices: Invoice[], today: string, inScope: (s: Student) => boolean) {
  return students.filter((a) => inScope(a) && students.some((s) => s.referredBy === a.id)).map((a) => {
    const r: AffiliateReport = affiliateReport(a.id, students, invoices, today);
    return {
      ...base(a), code: a.referralCode ?? '',
      joined: r.referrals.map((x) => ({ studentId: x.student.studentCode ?? '', name: x.student.name, standard: x.student.standard, joined: day(x.student.joined), paid: x.paid, commission: x.commission, payments: x.payments.map((p) => ({ date: p.date, amount: p.amount, commission: p.commission, status: p.status })) })),
      totals: r.totals,
      pending: r.totals.pending + r.totals.dueNow,
      nextPayout: r.nextPayout ?? null,
      months: r.months,
    };
  }).sort((a, b) => b.pending - a.pending || b.joined.length - a.joined.length);
}

// ---------- 5. Fees due (V51.9.185) ----------
/** Students who owe money now: the worst stage first (grace over, then in grace, due today, due soon), then the oldest. */
export function dueRows(students: Student[], invoices: Invoice[], plans: PlanRecord[], today: string, graceDays: number, classes: ClassGroup[]) {
  const order = { over: 0, grace: 1, today: 2, soon: 3, held: 4 } as const;
  return students.flatMap((s) => {
    const dues = duesOf(s, invoices, plans, today, graceDays);
    const stage = worstStage(dues);
    if (!stage) return [];
    const c = teacherOf(s, classes);
    return [{
      ...base(s), key: s.id, standard: s.standard, school: s.school ?? '', phone: s.guardianPhone, teacher: c ? `${c.teacherName} · ${c.name}` : '',
      stage, total: Math.round(dues.reduce((a, d) => a + d.amount * 100, 0)) / 100, dueDate: dues[0].dueDate, graceUntil: dues[0].graceUntil,
      daysOverdue: Math.max(...dues.map((d) => d.daysOverdue)), inactive: isInactive(dues), holdUntil: s.feeHold && s.feeHold.until >= today ? s.feeHold.until : '',
      bills: dues.map((d) => ({ label: d.label, amount: d.amount, dueDate: d.dueDate, stage: d.stage })),
    }];
  }).sort((a, b) => order[a.stage] - order[b.stage] || b.daysOverdue - a.daysOverdue);
}

/** A cell that a spreadsheet would read as a formula (=, +, -, @ at the start) is kept as text. Names, schools and
 *  e-mails come from the public sign-up page, so they are never trusted. */
const safeCell = (c: unknown) => { const v = String(c ?? ''); return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v; };

/** A CSV cell list for each register (the same columns the page shows). */
export function csvRows(sheet: Sheet, rows: unknown[]): string[][] {
  return csvCells(sheet, rows).map((r) => r.map(safeCell));
}
function csvCells(sheet: Sheet, rows: unknown[]): string[][] {
  const r = rows as Array<Record<string, any>>;
  if (sheet === 'students') return [['Student ID', 'Name', 'Class', 'Joined', 'Country', 'State', 'District', 'Place', 'School', 'Phone / WhatsApp', 'Email', 'Mother tongue', 'Coupon / class code', 'Teacher', 'Source'],
    ...r.map((x) => [x.studentId, x.name, x.standard, x.joined, x.country, x.state, x.district, x.place, x.school, x.phone, x.email, x.motherTongue, x.coupon, x.teacher, x.source])];
  if (sheet === 'activities') return [['Student ID', 'Name', 'Class', 'Trial started', 'Enrolled on', 'Downloaded (date · book)', 'Created (date · material)', 'Attendance (date time · minutes)', 'Last active', 'Total minutes'],
    ...r.map((x) => [x.studentId, x.name, x.standard, x.trialStarted, x.enrolledOn, x.downloads.map((d: any) => `${d.date} · ${d.what}`).join('; '), x.created.map((d: any) => `${d.date} · ${d.what}`).join('; '), x.attendance.map((d: any) => `${d.at} · ${d.minutes} min`).join('; '), x.lastActive, String(x.totalMinutes)])];
  if (sheet === 'fees') return [['Student ID', 'Name', 'Payment date', 'Amount', 'Mode', 'Receipt', 'Transaction ID', 'UPI reference', 'Confirmed by', 'For', 'Coupon code joined', 'Note'],
    ...r.map((x) => [x.studentId, x.name, x.date, String(x.amount), x.mode, x.receiptNo, x.txnId ?? '', x.utr ?? '', x.confirmedBy ?? '', x.for, x.coupon, x.note])];
  if (sheet === 'dues') return [['Student ID', 'Name', 'Class', 'School', 'Phone / WhatsApp', 'Teacher', 'Stage', 'Amount due', 'Due date', 'Grace until', 'Days overdue', 'Extra days until', 'Inactive', 'Bills'],
    ...r.map((x) => [x.studentId, x.name, x.standard, x.school, x.phone, x.teacher, x.stage, String(x.total), x.dueDate, x.graceUntil, String(x.daysOverdue), x.holdUntil, x.inactive ? 'yes' : '', x.bills.map((b: any) => `${b.label} · ${b.amount} · ${b.dueDate}`).join('; ')])];
  return [['Student ID', 'Name', 'Code', 'Students joined', 'Each student: paid · commission', 'Commission pending', 'Next payout', 'Earlier months (payout date · amount · status)'],
    ...r.map((x) => [x.studentId, x.name, x.code, String(x.joined.length), x.joined.map((j: any) => `${j.name} (${j.studentId}): ${j.paid} · ${j.commission}`).join('; '), String(x.pending), x.nextPayout ? `${x.nextPayout.payoutDate} · ${x.nextPayout.amount}` : '', x.months.map((m: any) => `${m.payoutDate} · ${m.amount} · ${m.status}`).join('; ')])];
}
