/**
 * V51.9.183 — paying the fee by UPI, confirmed by the school office.
 *
 * The school sets its UPI ID (VPA) once. A family sees the amount, a UPI QR code and an "Open UPI app" link with the
 * amount and the Student ID filled in, pays from any UPI app, and types the 12-digit UPI reference (UTR) shown after
 * paying. The office sees each claim beside its bank / UPI statement and confirms it — which records the payment exactly
 * as a counter payment (receipt, the referrer's commission, enrolment that opens Parts 2–10) — or rejects it with a reason.
 * No payment company is involved and no money passes through AI Guru: it goes straight to the school's UPI account.
 */
import { docs } from '../storage';
import { rowKey } from '../storage/rows';
import { invoiceDue, type Invoice } from '../admin/fees';
import { newId, readData, update, type AdminData } from '../admin/store';
import { addPlanRecord, planQuote } from '../admin/plan-records';
import { nextPartBill, paidPartsList, partPlanOf, schoolOff, switchToUpfront, allLabel } from '../admin/part-plan';
import { recordPayment } from '../admin/record-payment';
import { istToday } from '../admin/enrolment';
import { notifyCommission, sendPaymentReceipt } from '../messages/notify';
import { createHash } from 'node:crypto';
import { getAlert, keepAlert, saveAlert, sameAmount, type AlertSource, type BankAlert, type BankCredit } from './bank-alert';

const SETTINGS = 'data/ai-guru/payments/upi.json';
const DIR = 'data/ai-guru/payments/claims';
const keyOf = (id: string) => rowKey(DIR, id);

/** V51.9.190: `auto` = confirm a payment by itself when the bank's credit has the same UPI reference and amount (default on). */
export interface UpiSettings { vpa: string; payee: string; auto?: boolean }
/** V51.9.191: 'parts-all' = all the paid parts at once (the part plan's ₹7,000). */
export type PayKind = 'invoice' | 'monthly' | 'yearly' | 'parts-all';
export interface PayOption { kind: PayKind; invoiceId?: string; label: string; amount: number }
export type ClaimStatus = 'waiting' | 'confirming' | 'confirmed' | 'rejected';
export interface PaymentClaim {
  id: string; studentId: string; kind: PayKind; invoiceId?: string; label: string; amount: number;
  utr: string; paidOn: string; status: ClaimStatus; reason?: string; receiptNo?: string; paymentId?: string;
  createdAt: string; decidedAt?: string;
  /** V51.9.190: AI Guru's transaction ID (also in the UPI note), and who confirmed it. */
  txnId?: string; confirmedBy?: 'office' | 'bank-alert' | 'statement';
}
export type ConfirmedBy = NonNullable<PaymentClaim['confirmedBy']>;

/** V51.9.190 — AI Guru's transaction ID for one payment choice of one student on one day: AGT-261103-7KQ2M.
 *  The same all day (the QR, the UPI note and the claim agree), different for each bill / month / year and day. */
export function txnIdFor(studentId: string, kind: PayKind, invoiceId: string | undefined, day: string): string {
  const h = createHash('sha256').update(`${studentId}|${kind}|${invoiceId ?? ''}|${day}`).digest();
  const A = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = ''; for (let i = 0; i < 5; i++) code += A[h[i] % A.length];
  return `AGT-${day.slice(2).replace(/-/g, '')}-${code}`;
}

/** A UPI ID: name@bank (letters, digits, dot, dash, underscore before the @). */
export const validVpa = (v: string) => /^[a-z0-9._-]{2,64}@[a-z][a-z0-9]{1,63}$/i.test(v.trim());
/** The UPI transaction reference (UTR / RRN): 12 digits; spaces are ignored. */
export const cleanUtr = (v: unknown) => String(v ?? '').replace(/\s+/g, '');
export const validUtr = (v: string) => /^\d{12}$/.test(v);

/** The standard UPI payment link (NPCI "upi://pay"), read by every UPI app and by the QR code. */
export function upiLink(s: UpiSettings, amount: number, note: string): string {
  const q = new URLSearchParams({ pa: s.vpa.trim(), pn: s.payee.trim() || 'School', am: amount.toFixed(2), cu: 'INR', tn: note.slice(0, 50) });
  return `upi://pay?${q.toString()}`;
}

export async function readUpi(): Promise<UpiSettings | null> {
  const s = await docs.get<UpiSettings>(SETTINGS);
  return s && validVpa(s.vpa) ? s : null;
}
export async function saveUpi(raw: { vpa?: unknown; payee?: unknown; auto?: unknown }): Promise<UpiSettings | string> {
  const vpa = String(raw.vpa ?? '').trim(), payee = String(raw.payee ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
  const auto = raw.auto === undefined ? ((await docs.get<UpiSettings>(SETTINGS))?.auto ?? true) : raw.auto !== false;
  if (!vpa) { await docs.del(SETTINGS); return { vpa: '', payee }; }
  if (!validVpa(vpa)) return 'That is not a UPI ID (it looks like schoolname@okaxis)';
  const s = { vpa, payee, auto };
  await docs.put(SETTINGS, s);
  return s;
}

/** What this student can pay now: each bill with something due, and — when the school has monthly fees — a month or a year. */
export function payOptions(data: AdminData, studentId: string): PayOption[] {
  // V51.9.191: part-plan bills — only the next part to open (Parts open in order), and "all at once" before any is paid
  const { next, upfrontOk } = nextPartBill(studentId, data.invoices);
  const out: PayOption[] = data.invoices.filter((i: Invoice) => i.studentId === studentId && invoiceDue(i) > 0 && (!i.partBill?.part || i.id === next?.id))
    .map((i) => ({ kind: 'invoice' as const, invoiceId: i.id, label: i.partBill?.part ? `${i.term} of every book` : i.term, amount: invoiceDue(i) }));
  const pp = partPlanOf(data.settings.access);
  if (pp.enabled && upfrontOk) {
    const parts = paidPartsList(data.settings.access.freeParts);
    const st = data.students.find((x) => x.id === studentId);
    const part = pp.partPrice - (st ? schoolOff(st, pp.partPrice) : 0), all = pp.upfrontPrice - (st ? schoolOff(st, pp.upfrontPrice) : 0); // V51.9.193: school discount
    const saves = Math.round((part * parts.length - all) * 100) / 100;
    out.push({ kind: 'parts-all', label: `${allLabel(parts)}${saves > 0 ? ` — save ₹${saves.toLocaleString('en-IN')}` : ''}`, amount: all });
  }
  // V51.9.194: with the part plan on, fees are paid only by part — never a month or a year
  if (!out.length && !pp.enabled) {
    const m = planQuote(data, 'monthly', studentId), y = planQuote(data, 'yearly', studentId);
    if (m !== null && m > 0) out.push({ kind: 'monthly', label: 'One month', amount: m });
    if (y !== null && y > 0) out.push({ kind: 'yearly', label: '12 months (yearly)', amount: y });
  }
  return out;
}

/** V51.9.195 — one claim per UPI reference, taken atomically (a rejected claim gives it back). */
const UTRS = 'data/ai-guru/payments/utrs';
interface UtrHold { claimId: string; active: boolean }
async function holdUtr(utr: string, claimId: string): Promise<boolean> {
  return docs.update<UtrHold, boolean>(rowKey(UTRS, utr), (cur) => {
    if (cur?.active && cur.claimId !== claimId) return { value: cur, result: false };
    return { value: { claimId, active: true }, result: true };
  });
}
async function releaseUtr(utr: string, claimId: string): Promise<void> {
  await docs.update<UtrHold, null>(rowKey(UTRS, utr), (cur) => ({ value: cur && cur.claimId === claimId ? { ...cur, active: false } : cur ?? undefined, result: null }));
}

/** Thrown inside store.update() so a failed confirmation saves nothing (the bills stay as they were). */
class Undo extends Error {}

const allClaims = async () => (await docs.values<PaymentClaim>(DIR)).filter((c) => c && c.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
export async function claimsOf(studentId?: string): Promise<PaymentClaim[]> {
  return (await allClaims()).filter((c) => !studentId || c.studentId === studentId);
}

/** A family says "we paid": checked against what is really due, the UTR is new, and one claim waits per bill at a time. */
export async function createClaim(studentId: string, b: { kind?: unknown; invoiceId?: unknown; utr?: unknown; paidOn?: unknown; txnId?: unknown }): Promise<PaymentClaim | string> {
  const utr = cleanUtr(b.utr);
  if (!validUtr(utr)) return 'The UPI reference is the 12-digit number your UPI app shows after paying (UTR / UPI Ref No.).';
  const today = istToday();
  const paidOn = /^\d{4}-\d{2}-\d{2}$/.test(String(b.paidOn ?? '')) ? String(b.paidOn) : today;
  if (paidOn > today) return 'The payment date cannot be in the future';
  const data = await readData();
  const opt = payOptions(data, studentId).find((o) => o.kind === b.kind && (o.kind !== 'invoice' || o.invoiceId === b.invoiceId));
  if (!opt) return 'Nothing to pay for that choice now. Reload the page.';
  const claims = await allClaims();
  if (claims.some((c) => c.utr === utr && c.status !== 'rejected')) return 'This UPI reference has already been sent.';
  if (claims.some((c) => c.studentId === studentId && (c.status === 'waiting' || c.status === 'confirming') && c.kind === opt.kind && c.invoiceId === opt.invoiceId)) return 'A payment for this is already waiting for the school office to check.';
  // the transaction ID shown with the QR (that day's, or a few days back when the family tells us later)
  const days = [0, 1, 2, 3, 4, 5, 6, 7].map((n) => istToday(Date.now() - n * 86_400_000));
  const sent = String(b.txnId ?? '');
  const txnId = days.map((d) => txnIdFor(studentId, opt.kind, opt.invoiceId, d)).find((t) => t === sent) ?? txnIdFor(studentId, opt.kind, opt.invoiceId, paidOn);
  const c: PaymentClaim = { id: newId('upi'), studentId, kind: opt.kind, invoiceId: opt.invoiceId, label: opt.label, amount: opt.amount, utr, paidOn, status: 'waiting', txnId, createdAt: new Date().toISOString() };
  // V51.9.195: the UPI reference is held for this claim under its own lock, so two claims sent at the same moment cannot share it
  if (!(await holdUtr(utr, c.id))) return 'This UPI reference has already been sent.';
  await docs.put(keyOf(c.id), c);
  // V51.9.190: the bank already told us about this UPI reference → confirm at once (same amount only)
  const alert = await getAlert(utr);
  if (alert && alert.status === 'unmatched') { const done = await settle(alert); if (done?.id === c.id) return done; }
  return (await docs.get<PaymentClaim>(keyOf(c.id))) ?? c;
}

/**
 * The office confirms (the payment is recorded: receipt, commission, enrolment) or rejects with a reason.
 * The claim is first moved to "confirming" under its own lock, so two office tabs can never record it twice.
 */
export async function decideClaim(id: string, decision: 'confirm' | 'reject', reason = '', by: ConfirmedBy = 'office', opts: { acceptMismatch?: boolean } = {}): Promise<PaymentClaim | string> {
  if (!/^upi_[a-z0-9]+$/.test(id)) return 'Not found';
  if (decision === 'reject') {
    return docs.update<PaymentClaim, PaymentClaim | string>(keyOf(id), (c) => {
      if (!c) return { value: undefined, result: 'Not found' };
      if (c.status !== 'waiting') return { value: c, result: `This payment is already ${c.status}` };
      const next: PaymentClaim = { ...c, status: 'rejected', reason: reason.trim().slice(0, 200) || 'The school office could not find this payment.', decidedAt: new Date().toISOString() };
      return { value: next, result: next };
    }).then(async (r) => { if (typeof r !== 'string') await releaseUtr(r.utr, r.id); return r; });
  }
  // V51.9.195: never two confirmed payments on one UPI reference; and the office must say so to confirm when the bank showed another amount
  const cur = await docs.get<PaymentClaim>(keyOf(id));
  if (cur && (await allClaims()).some((c) => c.id !== id && c.utr === cur.utr && c.status === 'confirmed')) return 'Another payment with this UPI reference is already confirmed.';
  const alert = cur ? await getAlert(cur.utr) : null;
  if (cur && by === 'office' && alert && !sameAmount(alert.amount, cur.amount) && !opts.acceptMismatch) {
    return `MISMATCH: the bank shows ₹${alert.amount} for this UPI reference, but the family paid for ₹${cur.amount}. Confirm again only if you have checked the bank.`;
  }
  const taken = await docs.update<PaymentClaim, PaymentClaim | string>(keyOf(id), (c) => {
    if (!c) return { value: undefined, result: 'Not found' };
    if (c.status !== 'waiting') return { value: c, result: `This payment is already ${c.status}` };
    const next: PaymentClaim = { ...c, status: 'confirming' };
    return { value: next, result: next };
  });
  if (typeof taken === 'string') return taken;
  const r = await update((data) => {
    let invoiceId = taken.invoiceId;
    // V51.9.195: any problem throws, so nothing is saved (a failed ₹7,000 confirmation no longer leaves the bills changed)
    if (taken.kind === 'parts-all') {
      const sw = switchToUpfront(data, taken.studentId, istToday());
      if (typeof sw === 'string') throw new Undo(sw);
      invoiceId = sw.invoiceId;
      const inv = data.invoices.find((i) => i.id === invoiceId);
      if (!inv || !sameAmount(invoiceDue(inv), taken.amount)) throw new Undo(`The all-at-once price is now ₹${inv ? invoiceDue(inv) : '?'}, the family paid ₹${taken.amount}. Please check with the family.`);
    } else if (taken.kind !== 'invoice') {
      const rec = addPlanRecord(data, taken.kind, taken.studentId, '', istToday());
      if (typeof rec === 'string') throw new Undo(rec);
      invoiceId = rec.invoiceId;
    }
    const p = recordPayment(data, invoiceId ?? '', taken.amount, taken.paidOn, 'upi', `UPI ${taken.utr}${taken.txnId ? ` · ${taken.txnId}` : ''}`);
    if (typeof p === 'string') throw new Undo(p);
    p.utr = taken.utr; p.confirmedBy = by; if (taken.txnId) p.txnId = taken.txnId;
    return p;
  }).catch((e) => (e instanceof Error ? e.message : 'Could not record the payment'));
  const done: PaymentClaim = typeof r === 'string'
    ? { ...taken, status: 'waiting', reason: `Could not record: ${r}` }
    : { ...taken, status: 'confirmed', reason: undefined, receiptNo: r.receiptNo, paymentId: r.id, confirmedBy: by, decidedAt: new Date().toISOString() };
  await docs.put(keyOf(id), done);
  // V51.9.185: the referrer's "commission gained" message
  if (typeof r !== 'string' && r.commission) await notifyCommission(await readData(), r.commission, taken.studentId, istToday()).catch(() => undefined);
  // V51.9.195: the school's commission is recorded here too (not only inside the receipt), and the bank's alert is marked as settled
  if (typeof r !== 'string') {
    await import('../schools/commission').then(async (m) => m.recordSchoolCommission(await readData(), r.id)).catch(() => false);
    if (alert && alert.status !== 'matched') await saveAlert({ ...alert, status: 'matched', claimId: id, note: `${by === 'office' ? 'Confirmed by the office' : 'Confirmed'}${!sameAmount(alert.amount, taken.amount) ? ' (the office accepted a different amount)' : ''} · receipt ${r.receiptNo}` }).catch(() => undefined);
  }
  // V51.9.190: the family gets "🎉 Congratulations" with the receipt in Messages
  if (typeof r !== 'string') { const upi = await readUpi(); await sendPaymentReceipt(await readData(), r.id, upi ? `${upi.payee || upi.vpa} · ${upi.vpa}` : undefined).catch(() => undefined); }
  return typeof r === 'string' ? r : done;
}

/**
 * V51.9.190 — matches one bank credit with a family's claim: the same 12-digit UPI reference AND the same amount confirms
 * it (when the school has "confirm automatically" on); the same reference with a different amount is left for the office.
 * Returns the confirmed claim, if any.
 */
async function settle(alert: BankAlert): Promise<PaymentClaim | null> {
  const upi = await readUpi();
  const claim = (await allClaims()).find((c) => c.utr === alert.utr && c.status === 'waiting');
  if (!claim) return null;
  if (!sameAmount(claim.amount, alert.amount)) {
    const note = `The bank shows ₹${alert.amount} for this UPI reference, the family paid for ₹${claim.amount}. Please check.`;
    await saveAlert({ ...alert, status: 'mismatch', claimId: claim.id, note });
    await docs.put(keyOf(claim.id), { ...claim, reason: note });
    return null;
  }
  if (upi && upi.auto === false) { await saveAlert({ ...alert, status: 'matched', claimId: claim.id, note: 'Matches — waiting for the office to confirm (automatic confirmation is off).' }); return null; }
  const by: ConfirmedBy = alert.source === 'statement' ? 'statement' : 'bank-alert';
  const r = await decideClaim(claim.id, 'confirm', '', by);
  if (typeof r === 'string') { await saveAlert({ ...alert, claimId: claim.id, note: r }); return null; }
  await saveAlert({ ...alert, status: 'matched', claimId: claim.id, note: `Confirmed automatically · receipt ${r.receiptNo}` });
  return r;
}

/** A credit from the bank (alert or statement line): kept once per UPI reference, then matched. */
export async function bankCredit(c: BankCredit, source: AlertSource, text: string): Promise<{ alert: BankAlert; confirmed?: PaymentClaim; fresh: boolean }> {
  const { alert, fresh } = await keepAlert(c, source, text);
  if (alert.status !== 'unmatched') return { alert, fresh };
  const confirmed = await settle(alert);
  return { alert: (await getAlert(alert.utr)) ?? alert, ...(confirmed ? { confirmed } : {}), fresh };
}
