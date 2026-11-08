import { NextResponse } from 'next/server';
import { bad, denied } from '../guard';
import { readData, update } from '@/lib/ai-guru/admin/store';
import { istToday } from '@/lib/ai-guru/admin/enrolment';
import { dueMessage, duesOf } from '@/lib/ai-guru/admin/dues';
import { officeToStudent } from '@/lib/ai-guru/messages/notify';

export const dynamic = 'force-dynamic';
const day = (x: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(String(x ?? '')) ? String(x) : '');

/**
 * V51.9.185 — fees due, office actions.
 * POST { action: 'hold', studentId, until, note? }  extra days: Parts 2–10 stay open and no reminder until that date
 *      { action: 'clear', studentId }               take the extra days back
 *      { action: 'remind', studentId }              send the reminder for each bill now (into the student's Messages)
 */
export async function POST(req: Request) {
  const d = await denied(req); if (d) return d;
  const b = await req.json().catch(() => ({}));
  const id = String(b.studentId ?? '');
  const today = istToday();
  if (b.action === 'hold') {
    const until = day(b.until);
    if (!until || until <= today) return bad('Choose a date after today');
    if (until > istToday(Date.now() + 92 * 86_400_000)) return bad('Extra days can be given for at most 3 months at a time');
    const r = await update((data) => { const s = data.students.find((x) => x.id === id); if (!s) return false; s.feeHold = { until, note: String(b.note ?? '').trim().slice(0, 120) || undefined, at: new Date().toISOString() }; return true; });
    return r ? NextResponse.json({ ok: true, until }) : bad('Student not found', 404);
  }
  if (b.action === 'clear') {
    const r = await update((data) => { const s = data.students.find((x) => x.id === id); if (!s) return false; delete s.feeHold; return true; });
    return r ? NextResponse.json({ ok: true }) : bad('Student not found', 404);
  }
  if (b.action === 'remind') {
    const data = await readData();
    const s = data.students.find((x) => x.id === id);
    if (!s) return bad('Student not found', 404);
    const dues = duesOf(s, data.invoices, [...data.yearly, ...data.monthly], today, data.settings.plans.graceDays);
    if (!dues.length) return bad('Nothing is due for this student');
    for (const x of dues) await officeToStudent(s, dueMessage(s.name, x), 'money');
    return NextResponse.json({ ok: true, sent: dues.length });
  }
  return bad('Unknown action');
}
