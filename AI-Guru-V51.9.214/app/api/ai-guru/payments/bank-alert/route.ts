import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { parseBankCredit } from '@/lib/ai-guru/payments/bank-alert';
import { bankCredit } from '@/lib/ai-guru/payments/upi';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * V51.9.190 — the school's own bank alerts come in here, so UPI payments are confirmed automatically.
 * Sent by the school's Gmail script (scripts/payments/gmail-bank-alerts.gs) or an SMS forwarder on the school's phone,
 * with the header  x-alert-secret: <AI_GURU_BANK_ALERT_SECRET>  (16+ characters). Without that setting this address
 * does not exist (404).
 * POST { text, subject? } or { alerts: [{ text, subject?, source? }, …] } (up to 50).
 * A credit with a 12-digit UPI reference is kept once; it confirms the family's payment only when their UPI reference
 * AND amount are the same. Anything else is left for the office.
 */
function allowed(req: Request): boolean {
  const want = process.env.AI_GURU_BANK_ALERT_SECRET ?? '';
  const got = req.headers.get('x-alert-secret') ?? '';
  if (want.length < 16) return false;
  const a = Buffer.from(got), w = Buffer.from(want); // V51.9.196 (security check): compare bytes, so odd characters cannot throw
  return a.length === w.length && timingSafeEqual(a, w);
}

export async function POST(req: Request) {
  if (!process.env.AI_GURU_BANK_ALERT_SECRET) return NextResponse.json({ ok: false }, { status: 404 });
  if (!allowed(req)) return NextResponse.json({ ok: false }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const list: Array<{ text?: unknown; subject?: unknown; source?: unknown }> = Array.isArray(b.alerts) ? b.alerts.slice(0, 50) : [b];
  const results = [];
  for (const a of list) {
    const text = `${String(a.subject ?? '')} ${String(a.text ?? '')}`.slice(0, 6000);
    const c = parseBankCredit(text);
    if (!c) { results.push({ ignored: true }); continue; }
    const r = await bankCredit(c, a.source === 'sms' ? 'sms' : 'email', text);
    results.push({ utr: c.utr, amount: c.amount, status: r.alert.status, fresh: r.fresh, ...(r.confirmed ? { confirmed: r.confirmed.receiptNo } : {}) });
  }
  return NextResponse.json({ ok: true, results });
}
