/**
 * Fee management (pure, no I/O). The shape follows the fees module of ScholarOS (MIT): a fee per student with
 * total / paid / due and a status, payments with receipt numbers. Money is whole paise to avoid rounding drift.
 */
import { addressProblems, cleanAddress, type Address } from './address';
import type { Enrolment } from './enrolment';
import type { PhotoMeta } from '../student/photo';

export interface FeeHead { id: string; name: string; /** Rupees. */ amount: number; /** "all" or a standard such as "8". */ standard: string }
/** Affiliate commission earned on one payment (the rate is frozen when the payment is recorded). */
export interface Commission { affiliateId: string; rate: number; amount: number; payoutDate: string; paid?: { on: string; payoutId: string } }
export interface Payment {
  id: string; amount: number; date: string; mode: 'cash' | 'upi' | 'card' | 'bank' | 'cheque'; receiptNo: string; note?: string; commission?: Commission;
  /** V51.9.190 (UPI): AI Guru's transaction ID, the bank's 12-digit UPI reference, and who confirmed it. */
  txnId?: string; utr?: string; confirmedBy?: 'office' | 'bank-alert' | 'statement';
}
export interface Invoice {
  id: string;
  studentId: string;
  term: string;
  items: Array<{ name: string; amount: number }>;
  discount: number;
  dueDate?: string;
  /** Coupon whose discount is inside `discount`. */
  coupon?: string;
  payments: Payment[];
  createdAt: string;
  /** V51.9.191: a bill made by the part plan (one part, or all the paid parts at once). */
  partBill?: { part?: number; all?: true };
}
export interface Student {
  id: string;
  name: string;
  standard: string;
  /** School the student attends (free text, the same spelling groups students under one school). */
  school?: string;
  admissionNo: string;
  guardianName: string;
  guardianPhone: string;
  address: Address;
  /** V51.9.185: extra days the office gave before Parts 2–10 lock for an unpaid fee (until that date). */
  feeHold?: { until: string; note?: string; at: string };
  /** V51.9.184: country (empty = India), e-mail and mother tongue, from the sign-up page (or the office). */
  country?: string;
  email?: string;
  motherTongue?: string;
  /** Student number such as ST-123-26 (older ones look like AIG0042) (made by the app; the admission number also works). */
  studentCode?: string;
  /** Who made the record: the office (default) or the student's own sign-up. */
  source?: 'office' | 'self';
  /** Coupon the student signed up with. */
  coupon?: string;
  /** V51.9.95: syllabus and medium from sign-up: the library shows the books that match them and the standard. */
  syllabus?: string;
  medium?: string;
  /** V51.9.95: books the student downloaded from the library (newest last). */
  library?: Array<{ documentId: string; at: string }>;
  /** V51.9.92: the code the student brought at sign-up (link or typed), kept even when it gave no discount. */
  signupCode?: string;
  /** The student whose affiliate link / code brought this student in. */
  referredBy?: string;
  /** The class or centre this student joined with its code. */
  classId?: string;
  /** Roll number inside that class (1, 2, 3 …): the teacher uses it to tell students apart. */
  classSerial?: number;
  /** Last time the student opened "Teachers Notes" (items shared after this show as new). */
  teacherSeenAt?: string;
  /** V51.9.155: last time the student opened "Subscribers" (students who joined after this show as new). */
  subscribersSeenAt?: string;
  /** This student's own affiliate code (a coupon others can use). */
  referralCode?: string;
  /** Commission % for this affiliate only; empty = the school-wide rate. */
  commissionPct?: number;
  /** Id of the student in the quiz / attendance records, when imported from them. */
  quizId?: string;
  /** V51.9.193: joined with a contracted school's ID (or its teacher's ID): the school, the teacher, and the discount
   *  on the part fees at that time. The ordinary invite link and commission are unchanged. */
  schoolLink?: { schoolId: string; schoolCode: string; schoolName: string; teacherId?: string; teacherName?: string; discountPct: number };
  /** V51.9.188: when this student's browser last said it has their own AI key (key reminders then stop). The key itself never comes here. */
  keySeenAt?: string;
  /** V51.9.92: set by the first recorded payment, or by the admin (a free seat). Enrolled students open every part of every book. */
  enrolled?: Enrolment;
  /** V51.9.99: the student's photo (the picture is a file on the server); whether it may go on shared reels. */
  photo?: PhotoMeta;
  /** V51.9.99: when the photo was last removed and by whom (a device that still has a copy then drops it instead of sending it back). */
  photoRemoved?: { at: string; by: 'student' | 'admin' };
  /** Server only: the student's login PIN as a scrypt hash. Never sent to a browser. */
  login?: { salt: string; hash: string };
  createdAt: string;
}
/** A student as the browser sees them: no hash, just whether a login is set. */
export type PublicStudent = Omit<Student, 'login'> & { hasLogin: boolean };
export const publicStudent = (s: Student): PublicStudent => { const { login, ...rest } = s; return { ...rest, hasLogin: !!login }; };
export type FeeStatus = 'paid' | 'partial' | 'pending' | 'overdue';

export const rupees = (n: number) => `₹${(Math.round(n * 100) / 100).toLocaleString('en-IN', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2 })}`;
const paise = (n: number) => Math.round(n * 100);

export const invoiceTotal = (i: Pick<Invoice, 'items' | 'discount'>) => Math.max(0, (i.items.reduce((s, x) => s + paise(x.amount), 0) - paise(i.discount)) / 100);
export const invoicePaid = (i: Pick<Invoice, 'payments'>) => i.payments.reduce((s, p) => s + paise(p.amount), 0) / 100;
export const invoiceDue = (i: Invoice) => Math.max(0, paise(invoiceTotal(i)) - paise(invoicePaid(i))) / 100;

export function invoiceStatus(i: Invoice, today = new Date().toISOString().slice(0, 10)): FeeStatus {
  const due = invoiceDue(i);
  if (due <= 0) return 'paid';
  if (i.dueDate && i.dueDate < today) return 'overdue';
  return invoicePaid(i) > 0 ? 'partial' : 'pending';
}

export function summarise(invoices: Invoice[], today?: string) {
  const out = { billed: 0, collected: 0, due: 0, overdue: 0, count: invoices.length, byStatus: { paid: 0, partial: 0, pending: 0, overdue: 0 } as Record<FeeStatus, number> };
  let b = 0, c = 0, d = 0, o = 0;
  for (const i of invoices) {
    const st = invoiceStatus(i, today);
    out.byStatus[st]++;
    b += paise(invoiceTotal(i)); c += paise(invoicePaid(i)); d += paise(invoiceDue(i));
    if (st === 'overdue') o += paise(invoiceDue(i));
  }
  return { ...out, billed: b / 100, collected: c / 100, due: d / 100, overdue: o / 100 };
}

/** Fee heads that apply to a standard, as invoice lines. */
export const itemsFor = (heads: FeeHead[], standard: string) => heads.filter((h) => h.standard === 'all' || h.standard === standard).map((h) => ({ name: h.name, amount: h.amount }));

export const receiptNumber = (n: number, year = new Date().getFullYear()) => `RCP-${year}-${String(n).padStart(5, '0')}`;

export function paymentProblems(i: Invoice, amount: number, date: string): string[] {
  const p: string[] = [];
  if (!Number.isFinite(amount) || amount <= 0) p.push('Amount must be more than zero');
  else if (paise(amount) > paise(invoiceDue(i))) p.push(`Amount is more than the ${rupees(invoiceDue(i))} due`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) p.push('Date is not valid');
  return p;
}

/** V51.9.184: a plain e-mail address, lower-cased; '' when it is not one. */
export const cleanEmail = (e: unknown) => { const v = typeof e === 'string' ? e.trim().toLowerCase().slice(0, 120) : ''; return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(v) ? v : ''; };
const str = (s: unknown, max = 80) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, max) : '');

export function cleanStudent(x: Partial<Student>): { value: Omit<Student, 'id' | 'createdAt'>; problems: string[] } {
  const value = { name: str(x.name), standard: str(x.standard, 8), school: str(x.school, 100), admissionNo: str(x.admissionNo, 20), guardianName: str(x.guardianName), guardianPhone: str(x.guardianPhone, 15).replace(/[^\d+]/g, ''), address: cleanAddress(x.address), quizId: x.quizId ? str(x.quizId, 60) : undefined,
    // V51.9.184: only when sent, so an office edit without them keeps what the student gave at sign-up
    ...('country' in x ? { country: str(x.country, 40) || undefined } : {}), ...('email' in x ? { email: cleanEmail(x.email) || undefined } : {}), ...('motherTongue' in x ? { motherTongue: str(x.motherTongue, 30) || undefined } : {}) };
  const problems: string[] = [];
  if (!value.name) problems.push('Student name is needed');
  if (!value.standard) problems.push('Standard is needed');
  if (value.guardianPhone && !/^(\+91)?[6-9]\d{9}$/.test(value.guardianPhone)) problems.push('Phone must be a 10-digit Indian mobile number');
  problems.push(...addressProblems(value.address, false));
  return { value, problems };
}

export const csvOf = (rows: string[][]) => rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\n');

/** Numbers for the admin dashboard charts. */
export function dashboardStats(students: Student[], invoices: Invoice[], months = 6, now = new Date()) {
  const std = new Map<string, { standard: string; collected: number; due: number }>();
  const byId = new Map(students.map((s) => [s.id, s]));
  for (const i of invoices) {
    const k = byId.get(i.studentId)?.standard || '?';
    const r = std.get(k) ?? { standard: k, collected: 0, due: 0 };
    r.collected += paise(invoicePaid(i)); r.due += paise(invoiceDue(i));
    std.set(k, r);
  }
  const byStandard = [...std.values()].map((r) => ({ ...r, collected: r.collected / 100, due: r.due / 100 })).sort((a, b) => a.standard.localeCompare(b.standard, undefined, { numeric: true }));
  const keys: string[] = [];
  for (let m = months - 1; m >= 0; m--) { const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - m, 1)); keys.push(d.toISOString().slice(0, 7)); }
  const monthly = keys.map((month) => ({ month, amount: invoices.flatMap((i) => i.payments).filter((p) => p.date.startsWith(month)).reduce((a, p) => a + paise(p.amount), 0) / 100 }));
  const dist = new Map<string, number>();
  for (const s of students) { const d = s.address.district || 'No address'; dist.set(d, (dist.get(d) ?? 0) + 1); }
  const byDistrict = [...dist.entries()].map(([district, count]) => ({ district, count })).sort((a, b) => b.count - a.count);
  const recent = invoices.flatMap((i) => i.payments.map((p) => ({ ...p, studentId: i.studentId, term: i.term }))).sort((a, b) => (a.date === b.date ? b.receiptNo.localeCompare(a.receiptNo) : b.date.localeCompare(a.date))).slice(0, 6);
  const missingAddress = students.filter((s) => !s.address.line1 || !s.address.district || !s.address.pincode).length;
  return { byStandard, monthly, byDistrict, recent, missingAddress };
}


// ---- Coupons (V51.9.72) -----------------------------------------------------------------------------------
export interface Coupon { /** Set on a student's personal affiliate coupon. */ ownerStudentId?: string; /** Set on a class or centre join code. */ ownerClassId?: string; code: string; kind: 'percent' | 'flat'; value: number; maxUses?: number; used: number; expires?: string; note?: string; active: boolean }

export const normaliseCode = (c: unknown) => String(c ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);

/** Why a coupon cannot be used now ('' = fine). */
export function couponProblem(c: Coupon | undefined, today = new Date().toISOString().slice(0, 10)): string {
  if (!c || !c.active) return 'This coupon code is not valid';
  if (c.expires && c.expires < today) return 'This coupon has expired';
  if (c.maxUses && c.used >= c.maxUses) return 'This coupon has been used up';
  return '';
}
export const couponLabel = (c: Coupon) => (c.kind === 'percent' ? `${c.value}% off fees` : `${rupees(c.value)} off the first fee bill`);

/** Discount (rupees) the coupon gives on an invoice of `total`; a flat coupon counts once, on the first invoice. */
export function couponDiscount(c: Coupon | undefined, total: number, flatAlreadyUsed: boolean): number {
  if (!c || !c.active) return 0;
  if (c.kind === 'percent') return Math.min(total, Math.round(total * Math.min(100, c.value)) / 100);
  return flatAlreadyUsed ? 0 : Math.min(total, c.value);
}

/** Problems with a student's own sign-up form (empty = fine). */
export function signupProblems(x: { name?: string; standard?: string; school?: string; state?: string; district?: string; place?: string; password?: string; confirm?: string }): string[] {
  const p: string[] = [];
  if (!str(x.name)) p.push('Name is needed');
  if (!str(x.standard, 8)) p.push('Standard is needed');
  if (!str(x.school, 100)) p.push('School is needed');
  if (!str(x.place)) p.push('Place is needed');
  const pw = String(x.password ?? '');
  if (pw.length < 6) p.push('Password needs at least 6 characters');
  else if (pw.length > 30) p.push('Password can have at most 30 characters'); // V51.9.182: sign-in reads 30
  else if (pw.toLowerCase() === str(x.name).toLowerCase()) p.push('Password must not be your name');
  if (pw !== String(x.confirm ?? '')) p.push('The two passwords are not the same');
  return p;
}
