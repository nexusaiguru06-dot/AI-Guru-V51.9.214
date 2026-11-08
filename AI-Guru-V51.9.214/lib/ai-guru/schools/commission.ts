/**
 * V51.9.193 — the schools' commission account (server only). Every fee payment by a school's student adds one line:
 * the school's share and the teacher's share (the teacher whose ID the student joined with), paid out on the same
 * monthly day as the ordinary invite commission. Kept apart from the ordinary affiliate commission, which the student's
 * own invites still earn as before.
 */
import type { AdminData } from '../admin/store';
import { payoutDateFor } from '../admin/affiliate';
import { commissionOf } from './rules';
import { addCommissionOnce, getSchool } from './store';

export async function recordSchoolCommission(data: AdminData, paymentId: string): Promise<boolean> {
  const inv = data.invoices.find((i) => i.payments.some((p) => p.id === paymentId));
  const p = inv?.payments.find((x) => x.id === paymentId);
  const st = inv ? data.students.find((s) => s.id === inv.studentId) : undefined;
  if (!inv || !p || !st?.schoolLink || !(p.amount > 0)) return false;
  const sc = await getSchool(st.schoolLink.schoolId);
  if (!sc) return false;
  const c = commissionOf(p.amount, sc.terms, !!st.schoolLink.teacherId);
  return addCommissionOnce({
    id: `sc_${paymentId}`, paymentId, receiptNo: p.receiptNo, schoolId: sc.id, ...(st.schoolLink.teacherId ? { teacherId: st.schoolLink.teacherId } : {}),
    studentId: st.id, date: p.date, paid: p.amount, ...c, payoutDate: payoutDateFor(p.date, data.settings.affiliate.payoutDay),
  });
}
