/**
 * Affiliate marketing (pure rules, no I/O). Every student has a personal referral code (a coupon) and link. A new student who
 * signs up with it gets the code's discount and becomes the sender's referral; the sender earns a commission on every fee
 * payment the school records for that student. Commission for a month's payments is settled on the 4th of the next month.
 */
import { invoiceDue, invoicePaid, invoiceTotal, type Commission, type Coupon, type Invoice, type Payment, type Student } from './fees';

export interface AffiliateSettings {
  enabled: boolean;
  /** Commission, % of each payment received from a referred student. */
  commissionPct: number;
  /** Discount for the friend who signs up with a code: % off fee bills, or (V51.9.92, discountKind 'flat') rupees off the first bill. */
  discountPct: number;
  /** V51.9.92: 'percent' (default) or 'flat' rupees. */
  discountKind?: 'percent' | 'flat';
  /** Day of the month commissions are paid (the previous month's payments). */
  payoutDay: number;
}
export const DEFAULT_AFFILIATE: AffiliateSettings = { enabled: true, commissionPct: 10, discountPct: 10, payoutDay: 4 };
export interface Payout { id: string; affiliateId: string; on: string; amount: number; count: number; reference: string; note?: string }

const paise = (n: number) => Math.round(n * 100);
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** A personal code: up to 4 letters of the name plus 4 random characters, e.g. ANJA7K2Q. `rand` is injectable for tests. */
export function referralCodeFor(name: string, taken: Set<string>, rand: () => number = Math.random): string {
  const base = name.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4).padEnd(3, 'X');
  for (let n = 0; n < 50; n++) {
    const code = base + Array.from({ length: 4 }, () => ALPHA[Math.floor(rand() * ALPHA.length)]).join('');
    if (!taken.has(code)) return code;
  }
  return base + Date.now().toString(36).toUpperCase().slice(-6);
}

/** Payments of month M are paid on `day` of month M+1 (a payment on 18 Oct is paid on 4 Nov; so is one on 2 Oct). */
export function payoutDateFor(paymentDate: string, day = 4): string {
  const [y, m] = paymentDate.split('-').map(Number);
  const ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1;
  return `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(28, Math.max(1, day))).padStart(2, '0')}`;
}

export const commissionOf = (amount: number, pct: number) => Math.round(amount * pct) / 100;
export const rateFor = (affiliate: Pick<Student, 'commissionPct'>, s: AffiliateSettings) => (typeof affiliate.commissionPct === 'number' ? affiliate.commissionPct : s.commissionPct);

/** The commission to attach to a payment just recorded for `student`, or undefined when nobody earns on it. */
export function commissionFor(student: Student, students: Student[], amount: number, date: string, s: AffiliateSettings): Commission | undefined {
  if (!s.enabled || !student.referredBy) return undefined;
  const aff = students.find((x) => x.id === student.referredBy);
  if (!aff) return undefined;
  const rate = rateFor(aff, s);
  const value = commissionOf(amount, rate);
  return value > 0 ? { affiliateId: aff.id, rate, amount: value, payoutDate: payoutDateFor(date, s.payoutDay) } : undefined;
}

export type CommissionStatus = 'pending' | 'due' | 'paid';
/** pending = payout day not reached; due = payout day reached, not yet paid out; paid = settled. */
export const statusOf = (c: Commission, today: string): CommissionStatus => (c.paid ? 'paid' : today >= c.payoutDate ? 'due' : 'pending');

export interface ReferralRow {
  student: Pick<Student, 'id' | 'name' | 'standard' | 'school' | 'studentCode'> & { place: string; joined: string };
  billed: number; paid: number; due: number;
  payments: Array<{ id: string; date: string; amount: number; mode: string; receiptNo: string; commission: number; rate: number; payoutDate: string; status: CommissionStatus }>;
  commission: number;
}
export interface AffiliateReport {
  affiliateId: string;
  referrals: ReferralRow[];
  totals: { referrals: number; billed: number; paid: number; due: number; earned: number; pending: number; dueNow: number; paidOut: number };
  /** One line per payout day. */
  months: Array<{ payoutDate: string; amount: number; payments: number; status: CommissionStatus }>;
  nextPayout?: { payoutDate: string; amount: number };
}

export function affiliateReport(affiliateId: string, students: Student[], invoices: Invoice[], today = new Date().toISOString().slice(0, 10)): AffiliateReport {
  const rows: ReferralRow[] = [];
  const byDate = new Map<string, { amount: number; n: number; paid: number }>();
  const t = { billed: 0, paid: 0, due: 0, earned: 0, pending: 0, dueNow: 0, paidOut: 0 };
  for (const st of students.filter((x) => x.referredBy === affiliateId)) {
    const inv = invoices.filter((i) => i.studentId === st.id);
    const pays = inv.flatMap((i) => i.payments).sort((a, b) => a.date.localeCompare(b.date) || a.receiptNo.localeCompare(b.receiptNo));
    const row: ReferralRow = {
      student: { id: st.id, name: st.name, standard: st.standard, school: st.school, studentCode: st.studentCode, place: [st.address.area, st.address.district].filter(Boolean).join(', '), joined: st.createdAt.slice(0, 10) },
      billed: inv.reduce((a, i) => a + paise(invoiceTotal(i)), 0) / 100,
      paid: inv.reduce((a, i) => a + paise(invoicePaid(i)), 0) / 100,
      due: inv.reduce((a, i) => a + paise(invoiceDue(i)), 0) / 100,
      payments: [], commission: 0,
    };
    for (const p of pays) {
      const c = p.commission && p.commission.affiliateId === affiliateId ? p.commission : undefined;
      const status = c ? statusOf(c, today) : 'pending';
      row.payments.push({ id: p.id, date: p.date, amount: p.amount, mode: p.mode, receiptNo: p.receiptNo, commission: c?.amount ?? 0, rate: c?.rate ?? 0, payoutDate: c?.payoutDate ?? '', status });
      if (c) {
        row.commission += paise(c.amount);
        t.earned += paise(c.amount);
        if (status === 'paid') t.paidOut += paise(c.amount); else if (status === 'due') t.dueNow += paise(c.amount); else t.pending += paise(c.amount);
        const m = byDate.get(c.payoutDate) ?? { amount: 0, n: 0, paid: 0 };
        m.amount += paise(c.amount); m.n++; if (status === 'paid') m.paid += paise(c.amount);
        byDate.set(c.payoutDate, m);
      }
    }
    row.commission /= 100;
    t.billed += paise(row.billed); t.paid += paise(row.paid); t.due += paise(row.due);
    rows.push(row);
  }
  const months = [...byDate.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([payoutDate, m]) => ({ payoutDate, amount: m.amount / 100, payments: m.n, status: (m.paid === m.amount ? 'paid' : today >= payoutDate ? 'due' : 'pending') as CommissionStatus }));
  const next = [...byDate.entries()].filter(([d, m]) => m.paid < m.amount && d >= today).sort(([a], [b]) => a.localeCompare(b))[0];
  return {
    affiliateId, referrals: rows.sort((a, b) => b.student.joined.localeCompare(a.student.joined)), months,
    totals: { referrals: rows.length, billed: t.billed / 100, paid: t.paid / 100, due: t.due / 100, earned: t.earned / 100, pending: t.pending / 100, dueNow: t.dueNow / 100, paidOut: t.paidOut / 100 },
    nextPayout: next ? { payoutDate: next[0], amount: (next[1].amount - next[1].paid) / 100 } : undefined,
  };
}

/** Everything the admin sees for one student's revenue. */
export interface RevenueRow {
  id: string; name: string; standard: string; school: string; place: string; studentCode?: string; joined: string; source: string;
  coupon?: string; referredByName?: string;
  billed: number; discount: number; paid: number; due: number; commissionGenerated: number; net: number;
  payments: Array<{ date: string; amount: number; mode: string; receiptNo: string; commission: number; term: string }>;
}
export function revenueRows(students: Student[], invoices: Invoice[]): RevenueRow[] {
  return students.map((st) => {
    const inv = invoices.filter((i) => i.studentId === st.id);
    const payments = inv.flatMap((i) => i.payments.map((p: Payment) => ({ date: p.date, amount: p.amount, mode: p.mode, receiptNo: p.receiptNo, commission: p.commission?.amount ?? 0, term: i.term }))).sort((a, b) => b.date.localeCompare(a.date));
    const paid = inv.reduce((a, i) => a + paise(invoicePaid(i)), 0), com = payments.reduce((a, p) => a + paise(p.commission), 0);
    return {
      id: st.id, name: st.name, standard: st.standard, school: st.school ?? '', place: [st.address.area, st.address.district, st.address.state].filter(Boolean).join(', '), studentCode: st.studentCode, joined: st.createdAt.slice(0, 10), source: st.source ?? 'office',
      coupon: st.coupon, referredByName: st.referredBy ? students.find((x) => x.id === st.referredBy)?.name : undefined,
      billed: inv.reduce((a, i) => a + paise(invoiceTotal(i)), 0) / 100, discount: inv.reduce((a, i) => a + paise(i.discount), 0) / 100, paid: paid / 100, due: inv.reduce((a, i) => a + paise(invoiceDue(i)), 0) / 100,
      commissionGenerated: com / 100, net: (paid - com) / 100, payments,
    };
  }).sort((a, b) => b.paid - a.paid);
}

/** The personal coupon that carries a student's code. */
export const referralCoupon = (st: Student, s: AffiliateSettings): Coupon => ({ code: st.referralCode!, kind: s.discountKind === 'flat' ? 'flat' : 'percent', value: s.discountPct, used: 0, active: s.enabled, note: `Referral code of ${st.name}`, ownerStudentId: st.id });

export const shareText = (name: string, link: string) => `I study with AI Guru, an AI classroom in Malayalam and English. Join with my link and get a discount on fees: ${link}`;
