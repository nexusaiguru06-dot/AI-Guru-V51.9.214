import { NextResponse } from 'next/server';
import { clientIp, LOCKED_MESSAGE, lockedOut, noteMiss, studentFromRequest } from '@/lib/ai-guru/admin/auth';
import { readData, update } from '@/lib/ai-guru/admin/store';
import { ensurePartBills, needsPartBills } from '@/lib/ai-guru/admin/part-plan';
import { claimsOf, createClaim, payOptions, readUpi, txnIdFor, upiLink } from '@/lib/ai-guru/payments/upi';
import { istToday } from '@/lib/ai-guru/admin/enrolment';

export const dynamic = 'force-dynamic';

/**
 * V51.9.183 — the family pays the fee by UPI and tells the school office.
 * GET  — the school's UPI ID, what can be paid now (each with its UPI link), and this student's earlier claims
 * POST { kind, invoiceId?, utr, paidOn } — "we paid": the office checks it against its statement and confirms
 */
export async function GET(request: Request) {
  const id = await studentFromRequest(request);
  if (!id) return NextResponse.json({ ok: false }, { status: 401 });
  if (needsPartBills(await readData(), id)) await update((d) => { ensurePartBills(d, id); }); // V51.9.191
  const [upi, data, claims] = await Promise.all([readUpi(), readData(), claimsOf(id)]);
  const st = data.students.find((s) => s.id === id);
  if (!st) return NextResponse.json({ ok: false }, { status: 401 });
  const note = `AI Guru ${st.studentCode ?? ''} ${st.name}`.trim();
  // V51.9.190: each choice has AI Guru's transaction ID, also written in the UPI note (the payer's app shows it)
  const today = istToday();
  const options = payOptions(data, id).map((o) => { const txnId = txnIdFor(id, o.kind, o.invoiceId, today); return { ...o, txnId, link: upi ? upiLink(upi, o.amount, `AI Guru ${txnId} ${st.studentCode ?? ''}`.trim()) : null }; });
  return NextResponse.json({ ok: true, upi, note, options, claims: claims.map(({ studentId: _s, paymentId: _p, ...c }) => c) });
}

export async function POST(request: Request) {
  const id = await studentFromRequest(request);
  if (!id) return NextResponse.json({ ok: false, error: 'Please sign in first.' }, { status: 401 });
  if (!(await readUpi())) return NextResponse.json({ ok: false, error: 'The school has not set up UPI payments yet. Please pay at the school office.' }, { status: 400 });
  const ip = clientIp(request);
  const key = `p:${ip}:${id}`;
  if (await lockedOut(key, Date.now(), 10)) return NextResponse.json({ ok: false, error: LOCKED_MESSAGE }, { status: 429 });
  const r = await createClaim(id, await request.json().catch(() => ({})));
  if (typeof r === 'string') { await noteMiss(key); return NextResponse.json({ ok: false, error: r }, { status: 400 }); }
  return NextResponse.json({ ok: true, claim: r });
}
