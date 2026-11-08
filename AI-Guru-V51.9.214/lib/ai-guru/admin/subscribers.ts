/**
 * V51.9.155 — "Subscribers": the students who joined AI Guru through a student's affiliate link or code, as that student
 * sees them. Pure rules, no I/O. Built on the affiliate report (commission, payouts) but shows the affiliate only what
 * they need: the friend's first name and initial, standard, school, when they joined, whether they are on the free trial
 * or paying, and the commission earned on them. The friend's home place and fee amounts are not shown.
 */
import { affiliateReport, type AffiliateReport, type AffiliateSettings } from './affiliate';
import type { Invoice, Student } from './fees';

export interface SubscriberRow { key: string; name: string; standard: string; school: string; joined: string; status: 'trial' | 'enrolled'; commission: number; isNew: boolean }
export interface SubscribersView {
  code: string;
  rate: number;
  offer: { kind: 'percent' | 'flat'; value: number };
  payoutDay: number;
  subscribers: SubscriberRow[];
  totals: AffiliateReport['totals'] & { enrolled: number; trial: number; newCount: number };
  months: AffiliateReport['months'];
  nextPayout?: AffiliateReport['nextPayout'];
}

/** "Devi Krishna R" → "Devi K." (enough to recognise a friend, not a full name). */
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Student';
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[1][0].toUpperCase()}.`;
}

/** How many students joined through this affiliate after they last looked (for the red dot on the menu). */
export function newSubscribers(me: Pick<Student, 'id' | 'subscribersSeenAt'>, students: Student[]): number {
  const seen = me.subscribersSeenAt ?? '';
  return students.filter((s) => s.referredBy === me.id && s.createdAt > seen).length;
}

export function subscribersView(me: Student, students: Student[], invoices: Invoice[], s: AffiliateSettings, rate: number, today = new Date().toISOString().slice(0, 10)): SubscribersView {
  const report = affiliateReport(me.id, students, invoices, today);
  const seen = me.subscribersSeenAt ?? '';
  const byId = new Map(students.map((x) => [x.id, x]));
  const subscribers: SubscriberRow[] = report.referrals.map((r, i) => {
    const st = byId.get(r.student.id);
    return {
      key: `s${i}`,
      name: shortName(r.student.name),
      standard: r.student.standard,
      school: r.student.school ?? '',
      joined: r.student.joined,
      status: r.paid > 0 || st?.enrolled ? 'enrolled' : 'trial',
      commission: r.commission,
      isNew: !!st && st.createdAt > seen,
    };
  });
  const enrolled = subscribers.filter((x) => x.status === 'enrolled').length;
  return {
    code: me.referralCode ?? '',
    rate,
    offer: { kind: s.discountKind === 'flat' ? 'flat' : 'percent', value: s.discountPct },
    payoutDay: s.payoutDay,
    subscribers,
    totals: { ...report.totals, enrolled, trial: subscribers.length - enrolled, newCount: subscribers.filter((x) => x.isNew).length },
    months: report.months,
    nextPayout: report.nextPayout,
  };
}
