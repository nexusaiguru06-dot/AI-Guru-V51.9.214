'use client';
/**
 * V51.9.183 — the office's "UPI payments" tab: the school's UPI ID, and each family's "we paid" claim with its 12-digit
 * UPI reference. Check the reference in the bank / UPI app statement, then Confirm (recorded like a counter payment:
 * receipt, commission, enrolment) or Not found (the family sees the reason).
 */
import { useCallback, useEffect, useState } from 'react';
import { UpiPaymentsPanel } from './UpiPaymentsPanel';

const inp = 'mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400';
const btn = 'rounded-lg bg-cyan-400 px-4 py-2 text-sm font-extrabold text-[#04121f] disabled:opacity-50';

export function UpiTab({ say }: { say: (ok: boolean, text: string) => void }) {
  const [vpa, setVpa] = useState('');
  const [payee, setPayee] = useState('');
  const call = (body: unknown) => fetch('/api/ai-guru/admin/upi', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json()).catch(() => ({ ok: false, error: 'Could not reach the server' }));
  const load = useCallback(async () => {
    const j = await fetch('/api/ai-guru/admin/upi', { cache: 'no-store' }).then((r) => r.json()).catch(() => null);
    if (j?.ok) { setVpa(j.upi.vpa); setPayee(j.upi.payee); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const save = async () => { const j = await call({ action: 'settings', vpa, payee }); say(!!j.ok, j.ok ? (vpa ? 'UPI ID saved. Families now see a QR code and an “Open UPI app” button.' : 'UPI payments switched off.') : j.error); };
  return (
    <div className="space-y-6">
      {/* V51.9.195: one place for every setting */}
      <p className="rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-100" data-settings-banner>⚙ Every office setting (part prices, free trial, UPI, free doubts, commission, schools) is on one page: <a href="/ai-guru/admin/settings" className="font-bold underline">⚙ Settings</a>. Changes made here show there too.</p>
      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[.04] p-4">
        <h2 className="text-lg font-extrabold">School UPI ID</h2>
        <p className="text-sm text-slate-300">Families pay this UPI ID directly from their own UPI app; the money goes straight to the school. Leave it empty to switch UPI payments off.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-bold text-slate-300">UPI ID (VPA)<input className={inp} value={vpa} onChange={(e) => setVpa(e.target.value)} placeholder="schoolname@okaxis" data-upi-vpa /></label>
          <label className="block text-xs font-bold text-slate-300">Name shown in the UPI app<input className={inp} value={payee} onChange={(e) => setPayee(e.target.value)} placeholder="GHSS Aluva" /></label>
        </div>
        <button className={btn} onClick={() => void save()}>Save</button>
      </section>
      {/* V51.9.190: the same panel as on the Fees page — automatic confirmation, waiting payments, bank credits, statement */}
      <UpiPaymentsPanel />
    </div>
  );
}
