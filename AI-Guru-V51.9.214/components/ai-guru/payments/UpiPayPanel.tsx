'use client';
/**
 * V51.9.183 — "Pay the fee by UPI" for a signed-in student (My account, and from a locked part in the classroom).
 * 1. choose what to pay (a bill, or a month / a year), 2. scan the QR or tap "Open UPI app" (amount and Student ID are
 * filled in), 3. type the 12-digit UPI reference shown after paying. The school office checks it and confirms; the
 * student sees "Waiting", then "Confirmed — receipt …" (all parts open) or the office's reason.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import qrcode from 'qrcode-generator';

interface Option { kind: 'invoice' | 'monthly' | 'yearly'; invoiceId?: string; label: string; amount: number; link: string | null; txnId?: string }
interface Claim { id: string; label: string; amount: number; utr: string; paidOn: string; status: 'waiting' | 'confirming' | 'confirmed' | 'rejected'; reason?: string; receiptNo?: string; createdAt: string; txnId?: string; confirmedBy?: string }
interface PayInfo { upi: { vpa: string; payee: string } | null; note: string; options: Option[]; claims: Claim[] }

const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const today = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

function QrImage({ text }: { text: string }) {
  const src = useMemo(() => { const q = qrcode(0, 'M'); q.addData(text); q.make(); return q.createDataURL(6, 2); }, [text]);
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="UPI QR code for this payment" width={220} height={220} className="mx-auto h-[220px] w-[220px] rounded-xl bg-white p-2" data-upi-qr />;
}

export function UpiPayPanel() {
  const [d, setD] = useState<PayInfo | null>(null);
  const [pick, setPick] = useState(0);
  const [utr, setUtr] = useState('');
  const [paidOn, setPaidOn] = useState(today());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = useCallback(() => fetch('/api/ai-guru/student-portal/pay', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => j?.ok && setD(j)).catch(() => undefined), []);
  useEffect(() => { void load(); }, [load]);
  if (!d) return null;
  const opt = d.options[pick];
  const waiting = d.claims.filter((c) => c.status === 'waiting' || c.status === 'confirming');
  const send = async (e: React.FormEvent) => {
    e.preventDefault(); if (!opt) return;
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/ai-guru/student-portal/pay', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: opt.kind, invoiceId: opt.invoiceId, utr, paidOn, txnId: opt.txnId }) });
      const j = await r.json().catch(() => ({}));
      if (j.ok) {
        setUtr('');
        // V51.9.190: when the bank has already told the school, the payment is confirmed at once
        setMsg(j.claim?.status === 'confirmed'
          ? { ok: true, text: `🎉 Congratulations! Payment confirmed · receipt ${j.claim.receiptNo}. Your receipt is in Messages.` }
          : { ok: true, text: 'Sent. It is confirmed automatically as soon as the bank tells the school (usually a few minutes), and your receipt comes to Messages.' });
        void load();
      }
      else setMsg({ ok: false, text: j.error ?? 'Could not send. Please try again.' });
    } catch { setMsg({ ok: false, text: 'Could not reach the server.' }); } finally { setBusy(false); }
  };
  return (
    <section id="pay" aria-label="Pay the fee by UPI" className="space-y-4 rounded-2xl border border-emerald-300/30 bg-emerald-400/5 p-4" data-upi-pay>
      <h2 className="text-lg font-extrabold">💳 Pay the fee by UPI<span className="block text-sm font-medium text-slate-300">Pay from any UPI app — the part opens once it is confirmed</span></h2>
      {d.claims.length > 0 && (
        <ul className="space-y-2" aria-label="Payments sent">
          {d.claims.slice(0, 5).map((c) => (
            <li key={c.id} className={`rounded-xl border px-3 py-2 text-sm ${c.status === 'confirmed' ? 'border-emerald-300/40 bg-emerald-400/10 text-emerald-100' : c.status === 'rejected' ? 'border-rose-300/40 bg-rose-400/10 text-rose-100' : 'border-amber-300/40 bg-amber-400/10 text-amber-50'}`} data-claim={c.status}>
              <b>{inr(c.amount)}</b> · {c.label} · UPI ref {c.utr} · {c.paidOn}<br />
              {c.txnId && <span className="block font-mono text-xs opacity-80">Transaction ID {c.txnId}</span>}
              {c.status === 'confirmed' ? <>🎉 Congratulations! Confirmed{c.confirmedBy === 'bank-alert' || c.confirmedBy === 'statement' ? ' by the bank' : ' by the school office'} · receipt {c.receiptNo} (in <a href="/ai-guru/messages" className="underline">Messages</a>). {c.label} is open now.</>
                : c.status === 'rejected' ? <>✕ Not confirmed: {c.reason} · Please meet the school office.</>
                : <>⏳ Waiting for the bank’s confirmation (usually a few minutes; the office checks anything else).</>}
            </li>))}
        </ul>
      )}
      {!d.upi ? <p className="text-sm text-slate-300">The school has not set up UPI payments yet. Please pay at the school office with your Student ID.</p>
        : !d.options.length ? (waiting.length ? null : <p className="text-sm text-slate-300">Nothing to pay right now. If you want to join, ask the school office to set your fee.</p>)
        : <>
          {d.options.length > 1 && (
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="What to pay for">
              {d.options.map((o, i) => <button key={`${o.kind}${o.invoiceId ?? ''}`} type="button" role="radio" aria-checked={i === pick} onClick={() => setPick(i)} className={`min-h-[44px] rounded-xl border px-4 text-sm font-bold ${i === pick ? 'border-emerald-300 bg-emerald-400/20 text-emerald-50' : 'border-white/15 text-slate-200'}`}>{o.label} · {inr(o.amount)}</button>)}
            </div>
          )}
          {opt && opt.link && <div className="space-y-3 text-center">
            <p className="text-base">Pay <b className="text-2xl text-emerald-300" data-upi-amount>{inr(opt.amount)}</b> to <b>{d.upi.payee || d.upi.vpa}</b><span className="block font-mono text-sm text-slate-300">{d.upi.vpa}</span></p>
            <QrImage text={opt.link} />
            <p className="text-sm text-slate-300">Scan with Google Pay, PhonePe, Paytm or any UPI app — or on this phone:</p>
            <a href={opt.link} className="inline-flex min-h-[48px] items-center rounded-xl bg-emerald-500 px-5 font-extrabold text-[#04121f]" data-upi-open>📲 Open UPI app</a>
            {opt.txnId && <p className="text-sm">Transaction ID <b className="font-mono text-cyan-200" data-upi-txn>{opt.txnId}</b><span className="block text-xs text-slate-400">It is filled in as the payment note, so the school knows who paid.</span></p>}
          </div>}
          <form onSubmit={send} className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="text-sm font-bold">After paying: tell the school office</p>
            <label className="block text-sm text-slate-200">UPI reference (UTR) — the 12-digit number your UPI app shows
              <input value={utr} onChange={(e) => setUtr(e.target.value)} inputMode="numeric" autoComplete="off" maxLength={16} placeholder="e.g. 4xxxxxxxxxx1" className="mt-1 min-h-[48px] w-full rounded-xl border border-white/15 bg-black/30 px-4 font-mono text-base text-white outline-none focus:border-emerald-300" data-upi-utr /></label>
            <label className="block text-sm text-slate-200">Date paid
              <input type="date" value={paidOn} max={today()} onChange={(e) => setPaidOn(e.target.value)} className="mt-1 min-h-[44px] w-full rounded-xl border border-white/15 bg-black/30 px-4 text-base text-white" /></label>
            <button disabled={busy || utr.replace(/\s/g, '').length !== 12} className="min-h-[48px] w-full rounded-xl bg-cyan-400 font-extrabold text-[#04121f] disabled:opacity-50" data-upi-send>{busy ? 'Sending…' : 'I have paid — send to the office'}</button>
            {msg && <p role={msg.ok ? 'status' : 'alert'} className={`text-sm ${msg.ok ? 'text-emerald-300' : 'text-rose-300'}`}>{msg.text}</p>}
          </form>
        </>}
    </section>
  );
}
