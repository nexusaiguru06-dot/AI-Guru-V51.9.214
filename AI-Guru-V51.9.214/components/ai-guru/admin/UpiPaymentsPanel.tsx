'use client';
/**
 * V51.9.190 — UPI payments on the office's Fees page (and the UPI tab):
 *  • how automatic confirmation stands (on/off, whether the bank alerts reach AI Guru, the last one);
 *  • payments waiting (Confirm / Not found by hand, for anything the bank did not match);
 *  • the bank's credits: matched, a different amount, or no family claim yet;
 *  • upload a bank statement: every UPI credit in it is matched (same UPI reference AND amount → confirmed).
 */
import { useCallback, useEffect, useState } from 'react';

interface Claim { id: string; label: string; amount: number; utr: string; paidOn: string; status: string; reason?: string; receiptNo?: string; txnId?: string; confirmedBy?: string; createdAt: string; student: { name: string; studentCode: string; standard: string } | null }
interface Alert { utr: string; amount: number; source: string; receivedAt: string; text: string; status: string; note?: string; vpa?: string }
interface Info { upi: { vpa: string; payee: string; auto?: boolean }; claims: Claim[]; alerts: Alert[]; auto: { on: boolean; alertsSetUp: boolean; lastAlert: string | null } }

const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const btn = 'rounded-lg bg-cyan-400 px-3 py-1.5 text-xs font-extrabold text-[#04121f] disabled:opacity-50';
const ghost = 'rounded-lg border border-white/15 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-white/5 disabled:opacity-50';
const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const BY: Record<string, string> = { 'bank-alert': '🏦 by the bank alert', statement: '📄 by the statement', office: 'by the office' };

export function UpiPaymentsPanel({ onChange }: { onChange?: () => void }) {
  const [d, setD] = useState<Info | null>(null);
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const call = (body: unknown) => fetch('/api/ai-guru/admin/upi', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json()).catch(() => ({ ok: false, error: 'Could not reach the server' }));
  const load = useCallback(async () => { const j = await fetch('/api/ai-guru/admin/upi', { cache: 'no-store' }).then((r) => r.json()).catch(() => null); if (j?.ok) setD(j); }, []);
  useEffect(() => { void load(); const t = setInterval(() => void load(), 30_000); return () => clearInterval(t); }, [load]);
  if (!d) return null;

  const decide = async (id: string, action: 'confirm' | 'reject') => {
    const reason = action === 'reject' ? window.prompt('Why is it not confirmed? The family will see this.', 'This UPI reference is not in our bank statement.') : '';
    if (action === 'reject' && reason === null) return;
    setBusy(id);
    let j = await call({ action, id, reason });
    // V51.9.195: the bank showed another amount for this UPI reference — confirm only after a second, clear yes
    if (!j.ok && action === 'confirm' && typeof j.error === 'string' && j.error.startsWith('MISMATCH:')) {
      if (window.confirm(`${j.error.replace('MISMATCH: ', '')}\n\nConfirm this payment anyway?`)) j = await call({ action, id, reason, acceptMismatch: true });
      else j = { ok: false, error: 'Not confirmed: the amounts differ. Check the bank, or mark it as not found.' };
    }
    setBusy('');
    setNote({ ok: !!j.ok, text: j.ok ? (action === 'confirm' ? `Recorded · receipt ${j.claim.receiptNo}. The student got 🎉 Congratulations with the receipt in Messages.` : 'Marked as not found. The family sees your reason.') : j.error });
    await load(); onChange?.();
  };
  const statement = async (f: File | undefined) => {
    if (!f) return;
    setBusy('statement'); setNote(null);
    const j = await call({ action: 'statement', text: await f.text() });
    setBusy('');
    setNote(j.ok ? { ok: true, text: `${j.credits} UPI credit${j.credits === 1 ? '' : 's'} read · ${j.confirmed} payment${j.confirmed === 1 ? '' : 's'} confirmed now · ${j.matchedBefore} already matched · ${j.mismatch} with a different amount · ${j.unmatched} with no family claim yet.` } : { ok: false, text: j.error ?? 'Could not read the statement' });
    await load(); onChange?.();
  };
  const toggleAuto = async () => { const j = await call({ action: 'settings', vpa: d.upi.vpa, payee: d.upi.payee, auto: !d.auto.on }); setNote({ ok: !!j.ok, text: j.ok ? (d.auto.on ? 'Automatic confirmation is off: you confirm each payment.' : 'Automatic confirmation is on.') : j.error }); await load(); };

  const waiting = d.claims.filter((c) => c.status === 'waiting' || c.status === 'confirming');
  const recent = d.claims.filter((c) => c.status === 'confirmed').slice(0, 8);
  const odd = d.alerts.filter((a) => a.status !== 'matched').slice(0, 12);

  return (
    <section className="space-y-4 rounded-2xl border border-emerald-300/25 bg-emerald-400/5 p-4" data-upi-panel>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-extrabold">💳 UPI payments</h2>
        {d.upi.vpa ? <span className="font-mono text-sm text-slate-300">{d.upi.vpa}{d.upi.payee ? ` · ${d.upi.payee}` : ''}</span> : <a href="/ai-guru/admin/settings#upi" className="text-sm text-amber-200 underline">Set the school’s UPI ID in ⚙ Settings</a>}
        <button className={`${ghost} ml-auto`} onClick={() => void toggleAuto()} data-upi-auto={d.auto.on ? 'on' : 'off'}>{d.auto.on ? '⚡ Automatic confirmation: on' : 'Automatic confirmation: off'}</button>
      </div>
      <p className={`rounded-xl border px-3 py-2 text-sm ${d.auto.alertsSetUp ? 'border-emerald-300/30 text-emerald-100' : 'border-amber-300/40 bg-amber-400/10 text-amber-100'}`} data-alerts-status>
        {d.auto.alertsSetUp
          ? <>🏦 Bank alerts are set up{d.auto.lastAlert ? ` · last alert ${when(d.auto.lastAlert)}` : ' · no alert has arrived yet, so check the Gmail script is running'}. A payment is confirmed by itself when the bank’s credit has the same UPI reference and amount the family gave.</>
          : <>🏦 Bank alerts are not connected yet, so you confirm payments here (or upload a statement below). To confirm automatically, set up the Gmail script once: docs/DEPLOY-GOOGLE-CLOUD.md step 11.</>}
      </p>
      {note && <p role="status" className={`text-sm ${note.ok ? 'text-emerald-300' : 'text-rose-300'}`}>{note.text}</p>}

      <div>
        <h3 className="font-extrabold">Waiting ({waiting.length})</h3>
        {waiting.length === 0 ? <p className="text-sm text-slate-400">Nothing waiting.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-xs uppercase text-slate-400"><tr><th className="p-2">Student</th><th className="p-2">For</th><th className="p-2">Amount</th><th className="p-2">UPI ref · Transaction ID</th><th className="p-2">Paid on</th><th className="p-2" /></tr></thead>
          <tbody>{waiting.map((c) => <tr key={c.id} className="border-t border-white/10" data-upi-claim="waiting">
            <td className="p-2"><b>{c.student?.name ?? '?'}</b><span className="block text-xs text-slate-400">{c.student?.studentCode} · Std {c.student?.standard}</span></td>
            <td className="p-2">{c.label}</td><td className="p-2 font-bold">{inr(c.amount)}</td>
            <td className="p-2 font-mono text-xs">{c.utr}<span className="block text-slate-400">{c.txnId}</span>{c.reason && <span className="block font-sans text-amber-200">{c.reason}</span>}</td><td className="p-2">{c.paidOn}</td>
            <td className="p-2"><span className="flex gap-2"><button className={btn} disabled={!!busy} onClick={() => void decide(c.id, 'confirm')} data-upi-confirm>Confirm</button><button className={ghost} disabled={!!busy} onClick={() => void decide(c.id, 'reject')}>Not found</button></span></td>
          </tr>)}</tbody></table></div>}
      </div>

      {recent.length > 0 && <div><h3 className="font-extrabold">Confirmed lately</h3>
        <ul className="mt-1 space-y-1 text-sm">{recent.map((c) => <li key={c.id} data-upi-confirmed={c.confirmedBy ?? 'office'}>✓ <b>{c.student?.name}</b> · {inr(c.amount)} · {c.label} · receipt {c.receiptNo} <span className="text-slate-400">{BY[c.confirmedBy ?? 'office']}</span></li>)}</ul></div>}

      {odd.length > 0 && <div><h3 className="font-extrabold">Bank credits to look at</h3>
        <ul className="mt-1 space-y-1 text-sm">{odd.map((a) => <li key={a.utr} className={a.status === 'mismatch' ? 'text-amber-200' : 'text-slate-300'} data-bank-alert={a.status}>
          {a.status === 'mismatch' ? '⚠' : '•'} {inr(a.amount)} · UPI ref <span className="font-mono">{a.utr}</span>{a.vpa ? ` · from ${a.vpa}` : ''} · {when(a.receivedAt)} — {a.status === 'mismatch' ? a.note : 'no family has sent this UPI reference yet (it is matched as soon as they do)'}</li>)}</ul></div>}

      <label className="block rounded-xl border border-dashed border-white/20 p-3 text-sm">
        <b>📄 Upload a bank statement</b> <span className="text-slate-400">(CSV / delimited text from HDFC NetBanking: Narration, Ref No, Deposit Amt). Every UPI credit is matched — same UPI reference and amount → confirmed.</span>
        <input type="file" accept=".csv,.txt,text/csv,text/plain" className="mt-2 block text-xs" disabled={busy === 'statement'} onChange={(e) => void statement(e.target.files?.[0])} data-statement />
      </label>
    </section>
  );
}
