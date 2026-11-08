import { NextResponse } from 'next/server';
import { bad, denied } from '../guard';
import { readData } from '@/lib/ai-guru/admin/store';
import { bankCredit, claimsOf, decideClaim, readUpi, saveUpi } from '@/lib/ai-guru/payments/upi';
import { allAlerts, parseStatement } from '@/lib/ai-guru/payments/bank-alert';

export const dynamic = 'force-dynamic';

/**
 * V51.9.183 — UPI payments for the school office.
 * GET  — the school's UPI ID, and every family's "we paid" claim (waiting first) with the student's name and Student ID
 * POST { action: 'settings', vpa, payee, auto? } | { action: 'confirm', id } | { action: 'reject', id, reason }
 *      { action: 'statement', text } — V51.9.190: match a bank statement's UPI credits with the families' payments
 * Confirming records the payment like a counter payment: receipt, the referrer's commission, enrolment (Parts 2–10 open).
 */
export async function GET(req: Request) {
  const d = await denied(req); if (d) return d;
  const [upi, claims, data] = await Promise.all([readUpi(), claimsOf(), readData()]);
  const who = new Map(data.students.map((s) => [s.id, s]));
  const rows = claims.map((c) => { const s = who.get(c.studentId); return { ...c, student: s ? { name: s.name, studentCode: s.studentCode ?? '', standard: s.standard } : null }; })
    .sort((a, b) => Number(b.status === 'waiting') - Number(a.status === 'waiting') || b.createdAt.localeCompare(a.createdAt));
  const alerts = (await allAlerts()).slice(0, 80);
  return NextResponse.json({ ok: true, upi: upi ?? { vpa: '', payee: data.school.name || '' }, claims: rows, waiting: rows.filter((c) => c.status === 'waiting').length,
    // V51.9.190: automatic confirmation — the bank alerts received, and whether the alert address is set up
    alerts, auto: { on: upi?.auto !== false, alertsSetUp: !!process.env.AI_GURU_BANK_ALERT_SECRET, lastAlert: alerts.find((a) => a.source !== 'statement')?.receivedAt ?? null /* V51.9.195: a statement upload is not an alert */ } });
}

export async function POST(req: Request) {
  const d = await denied(req); if (d) return d;
  const b = await req.json().catch(() => ({}));
  if (b.action === 'settings') { const s = await saveUpi(b); return typeof s === 'string' ? bad(s) : NextResponse.json({ ok: true, upi: s }); }
  if (b.action === 'confirm' || b.action === 'reject') {
    const r = await decideClaim(String(b.id ?? ''), b.action, String(b.reason ?? ''), 'office', { acceptMismatch: b.acceptMismatch === true });
    return typeof r === 'string' ? bad(r, 409) : NextResponse.json({ ok: true, claim: r });
  }
  // V51.9.190: a bank statement (CSV / delimited text): every UPI credit in it is matched with the families' payments
  if (b.action === 'statement') {
    const credits = parseStatement(String(b.text ?? '').slice(0, 3_000_000));
    if (!credits.length) return bad('No UPI credits found. Download the statement as CSV / delimited text (with Narration, Ref No and Deposit columns).');
    let confirmed = 0, matchedBefore = 0, mismatch = 0, unmatched = 0;
    for (const c of credits) {
      const r = await bankCredit(c, 'statement', c.line);
      if (r.confirmed) confirmed++; else if (!r.fresh && r.alert.status === 'matched') matchedBefore++; else if (r.alert.status === 'mismatch') mismatch++; else unmatched++;
    }
    return NextResponse.json({ ok: true, credits: credits.length, confirmed, matchedBefore, mismatch, unmatched });
  }
  return bad('Unknown action');
}
