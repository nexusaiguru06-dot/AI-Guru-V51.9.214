'use client';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { ReferralReport } from '@/components/ai-guru/AffiliatePanel';
import { rupees } from '@/lib/ai-guru/admin/fees';
import type { AffiliateReport, AffiliateSettings, Payout, RevenueRow } from '@/lib/ai-guru/admin/affiliate';
import type { PriceRow } from '@/lib/ai-guru/admin/pricing';

type Row = { id: string; name: string; standard: string; school: string; code?: string; rate: number; override: number | null; referrals: number; earned: number; pending: number; dueNow: number; paidOut: number; nextPayout: { payoutDate: string; amount: number } | null };
type Say = (ok: boolean, t: string) => void;
const api = async (body?: unknown, q = '') => { const r = await fetch(`/api/ai-guru/admin/affiliates${q}`, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' }); const j = await r.json().catch(() => ({})); return { ok: !!j.ok, j }; };
const inp = 'mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400';
const btn = 'rounded-lg bg-cyan-400 px-4 py-2 text-sm font-extrabold text-[#04121f] disabled:opacity-50';
const ghost = 'rounded-lg border border-white/15 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/5';

/** Admin: affiliate settings, who earns what, payouts, and the revenue of every student. */
export function AffiliatesTab({ say }: { say: Say }) {
  const [set, setSet] = useState<AffiliateSettings | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [rev, setRev] = useState<RevenueRow[]>([]);
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [view, setView] = useState<'affiliates' | 'revenue'>('affiliates');
  const [open, setOpen] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ affiliate: { id: string; name: string; code: string; rate: number; override: number | null }; report: AffiliateReport; payouts: Payout[] } | null>(null);
  const [ref, setRef] = useState('');
  const [ov, setOv] = useState('');
  const [q, setQ] = useState('');
  const load = useCallback(async () => { const r = await api(); if (r.ok) { setSet(r.j.settings); setRows(r.j.affiliates); setRev(r.j.revenue); setPrices(r.j.prices ?? []); } }, []);
  useEffect(() => { load(); }, [load]);
  const show = async (id: string) => { const r = await api(undefined, `?id=${id}`); if (r.ok) { setDetail(r.j); setOv(r.j.affiliate.override == null ? '' : String(r.j.affiliate.override)); setRef(''); } };
  const save = async () => { if (!set) return; const r = await api({ action: 'settings', affiliate: set }); say(r.ok, r.ok ? 'Affiliate settings saved. Every referral coupon now follows them.' : r.j.error ?? 'Could not save'); if (r.ok) await load(); };
  const override = async () => { if (!detail) return; const r = await api({ action: 'override', studentId: detail.affiliate.id, commissionPct: ov === '' ? null : Number(ov) }); say(r.ok, r.ok ? 'Commission rate updated for new payments' : r.j.error ?? 'Could not update'); if (r.ok) { await load(); await show(detail.affiliate.id); } };
  const payout = async () => { if (!detail) return; const r = await api({ action: 'payout', affiliateId: detail.affiliate.id, reference: ref }); say(r.ok, r.ok ? `Marked ${rupees(r.j.amount)} (${r.j.count} commissions) as paid` : r.j.error ?? 'Could not record payout'); if (r.ok) { await load(); await show(detail.affiliate.id); } };
  if (!set) return <p className="text-slate-400">Loading…</p>;
  const tot = rows.reduce((t, r) => ({ ref: t.ref + r.referrals, earned: t.earned + r.earned, due: t.due + r.dueNow, paid: t.paidOut + r.paidOut, pend: t.pend + r.pending, paidOut: t.paidOut + r.paidOut }), { ref: 0, earned: 0, due: 0, paid: 0, pend: 0, paidOut: 0 });
  const needle = q.trim().toLowerCase();
  const revShown = rev.filter((r) => !needle || `${r.name} ${r.school} ${r.studentCode ?? ''} ${r.coupon ?? ''}`.toLowerCase().includes(needle));
  const num = (k: keyof AffiliateSettings, label: string, hint: string) => <label className="block text-xs font-bold text-slate-300">{label}<input className={inp} type="number" min={0} step="0.5" value={String(set[k])} onChange={(e) => setSet({ ...set, [k]: Number(e.target.value) })} /><span className="font-normal text-slate-500">{hint}</span></label>;

  if (detail) {
    const a = detail.affiliate;
    return (
      <div className="space-y-5">
        <button onClick={() => setDetail(null)} className={ghost}>← All affiliates</button>
        <div><h2 className="text-xl font-extrabold">{a.name}</h2><p className="text-sm text-slate-400"><a className="mr-2 text-cyan-300 underline" target="_blank" rel="noreferrer" href={`/ai-guru/subscribers?as=${encodeURIComponent(a.id)}`}>Open their Subscribers page ↗</a>Code <b className="font-mono text-cyan-300">{a.code}</b> · commission {a.rate}%{a.override != null ? ' (set for this student)' : ' (school-wide rate)'}</p></div>
        <section className="grid gap-4 rounded-2xl border border-white/10 bg-white/[.04] p-4 sm:grid-cols-2">
          <div><h3 className="font-extrabold">Pay out</h3><p className="text-xs text-slate-400">Pays every commission that has reached its payout date ({rupees(detail.report.totals.dueNow)} now). Send the money yourself, then enter your reference (UPI id, bank txn no.).</p>
            <div className="mt-2 flex gap-2"><input className={inp} placeholder="Payment reference" value={ref} onChange={(e) => setRef(e.target.value)} /><button className={`${btn} mt-1 shrink-0`} disabled={!ref.trim() || detail.report.totals.dueNow <= 0} onClick={payout}>Mark paid</button></div></div>
          <div><h3 className="font-extrabold">Rate for this student</h3><p className="text-xs text-slate-400">Leave empty to use the school-wide rate. Applies to new payments only.</p>
            <div className="mt-2 flex gap-2"><input className={inp} type="number" min={0} max={100} step="0.5" placeholder={`${set.commissionPct}`} value={ov} onChange={(e) => setOv(e.target.value)} /><button className={`${ghost} mt-1 shrink-0`} onClick={override}>Save rate</button></div></div>
        </section>
        <ReferralReport report={detail.report} />
        {detail.payouts.length > 0 && <section><h3 className="mb-2 font-extrabold">Payout history</h3>
          <div className="overflow-x-auto rounded-2xl border border-white/10"><table className="w-full text-left text-sm"><thead className="bg-white/5 text-xs uppercase text-slate-400"><tr><th className="p-2">Date</th><th className="p-2 text-right">Amount</th><th className="p-2">Commissions</th><th className="p-2">Reference</th></tr></thead>
            <tbody>{detail.payouts.map((p) => <tr key={p.id} className="border-t border-white/10"><td className="p-2 font-mono">{p.on}</td><td className="p-2 text-right font-bold">{rupees(p.amount)}</td><td className="p-2">{p.count}</td><td className="p-2">{p.reference}</td></tr>)}</tbody></table></div></section>}
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[.04] p-4">
        <h2 className="text-lg font-extrabold">Affiliate settings</h2>
        <p className="text-xs text-slate-400">Every student gets an invite link and code. A friend who opens the link gets the code filled in on the sign-up form and the discount below; the student earns the commission on each fee the friend pays and sees them all under 👥 Subscribers in the top menu. Reels made by students carry their link, QR and code.</p>
        <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={set.enabled} onChange={(e) => setSet({ ...set, enabled: e.target.checked })} />Affiliate system is on</label>
        <div className="grid gap-4 sm:grid-cols-3">
          {num('commissionPct', 'Commission to the sender (%)', 'of every fee payment the friend makes')}
          <div>{num('discountPct', set.discountKind === 'flat' ? 'Discount for the friend (₹)' : 'Discount for the friend (%)', set.discountKind === 'flat' ? 'rupees off the friend’s first fee bill' : 'off every fee bill of the friend')}
            <div className="mt-1 flex gap-1 text-xs">{(['percent', 'flat'] as const).map((k) => <button key={k} type="button" aria-pressed={(set.discountKind ?? 'percent') === k} onClick={() => setSet({ ...set, discountKind: k })} className={`rounded-full px-3 py-1 font-bold ${(set.discountKind ?? 'percent') === k ? 'bg-white text-[#04121f]' : 'border border-white/15 text-slate-300'}`}>{k === 'percent' ? '% off every bill' : '₹ off first bill'}</button>)}</div></div>
          {num('payoutDay', 'Payout day of the month', 'previous month’s commission is paid on this day (1 to 28)')}
        </div>
        <button className={btn} onClick={save}>Save settings</button>
        {prices.length > 0 && <div className="pt-2"><h3 className="text-sm font-extrabold">What each standard pays (first bill)</h3>
          <p className="text-xs text-slate-500">From the fee heads, with the saved settings. Commission is what the friend earns when this bill is paid. Class codes use the discount set in Classes &amp; centres.</p>
          <div className="mt-2 overflow-x-auto rounded-xl border border-white/10"><table className="w-full text-left text-sm"><thead className="bg-white/5 text-xs uppercase text-slate-400"><tr><th className="p-2">Std</th><th className="p-2 text-right">Fee</th><th className="p-2 text-right">With a friend’s code</th><th className="p-2 text-right">With a class code</th><th className="p-2 text-right">Friend earns</th></tr></thead>
            <tbody>{prices.map((p) => <tr key={p.standard} className="border-t border-white/10"><td className="p-2 font-bold">{p.standard}</td><td className="p-2 text-right">{rupees(p.fee)}</td><td className="p-2 text-right text-emerald-300">{rupees(p.friendPays)}</td><td className="p-2 text-right">{rupees(p.classPays)}</td><td className="p-2 text-right text-amber-300">{rupees(p.commission)}</td></tr>)}</tbody></table></div></div>}
      </section>
      <div className="flex flex-wrap items-center gap-2">
        {(['affiliates', 'revenue'] as const).map((v) => <button key={v} onClick={() => setView(v)} aria-pressed={view === v} className={`rounded-full px-4 py-2 text-sm font-extrabold ${view === v ? 'bg-white text-[#04121f]' : 'border border-white/15 text-slate-200'}`}>{v === 'affiliates' ? 'Affiliates & payouts' : 'Student revenue'}</button>)}
        <a className={`${ghost} ml-auto`} href="/api/ai-guru/admin/affiliates?format=csv">Download commission ledger (CSV)</a>
      </div>
      {view === 'affiliates' ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">{([['Referred students', String(tot.ref)], ['Commission earned', rupees(tot.earned)], ['Pending', rupees(tot.pend)], ['To pay now', rupees(tot.due)], ['Paid out', rupees(tot.paidOut)]] as const).map(([l, v]) => <div key={l} className="rounded-2xl border border-white/10 bg-white/[.04] p-3"><div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{l}</div><div className="mt-1 text-xl font-black">{v}</div></div>)}</div>
          <div className="overflow-x-auto rounded-2xl border border-white/10"><table className="w-full text-left text-sm"><caption className="sr-only">Affiliates</caption>
            <thead className="bg-white/5 text-xs uppercase text-slate-400"><tr><th className="p-2">Affiliate</th><th className="p-2">Code</th><th className="p-2 text-right">Rate</th><th className="p-2 text-right">Students</th><th className="p-2 text-right">Earned</th><th className="p-2 text-right">Pending</th><th className="p-2 text-right">To pay</th><th className="p-2 text-right">Paid</th><th className="p-2">Next payout</th><th className="p-2" /></tr></thead>
            <tbody>{rows.map((r) => <tr key={r.id} className="border-t border-white/10"><td className="p-2"><b>{r.name}</b><div className="text-xs text-slate-400">Std {r.standard}{r.school ? ` · ${r.school}` : ''}</div></td><td className="p-2 font-mono text-cyan-300">{r.code}</td><td className="p-2 text-right">{r.rate}%{r.override != null && '*'}</td><td className="p-2 text-right">{r.referrals}</td><td className="p-2 text-right">{rupees(r.earned)}</td><td className="p-2 text-right">{rupees(r.pending)}</td><td className={`p-2 text-right font-bold ${r.dueNow > 0 ? 'text-amber-300' : ''}`}>{rupees(r.dueNow)}</td><td className="p-2 text-right text-emerald-300">{rupees(r.paidOut)}</td><td className="p-2 text-xs">{r.nextPayout ? `${r.nextPayout.payoutDate} · ${rupees(r.nextPayout.amount)}` : '—'}</td><td className="p-2"><button className={ghost} onClick={() => show(r.id)}>Open</button></td></tr>)}
              {rows.length === 0 && <tr><td colSpan={10} className="p-4 text-slate-400">No students yet.</td></tr>}</tbody></table></div>
          <p className="text-xs text-slate-500">* rate set for this student. Commission is a percentage of each payment you record for a student who joined with the affiliate’s link.</p>
        </>
      ) : (
        <>
          <label className="block max-w-sm text-xs font-bold text-slate-300">Find a student<input className={inp} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, school, Student ID or coupon" /></label>
          <div className="overflow-x-auto rounded-2xl border border-white/10"><table className="w-full text-left text-sm"><caption className="sr-only">Revenue of each student</caption>
            <thead className="bg-white/5 text-xs uppercase text-slate-400"><tr><th className="p-2">Student</th><th className="p-2">Joined</th><th className="p-2">Came through</th><th className="p-2 text-right">Billed</th><th className="p-2 text-right">Discount</th><th className="p-2 text-right">Paid</th><th className="p-2 text-right">Pending</th><th className="p-2 text-right">Commission</th><th className="p-2 text-right">Net revenue</th><th className="p-2" /></tr></thead>
            <tbody>{revShown.map((r) => <Fragment key={r.id}><tr className="border-t border-white/10"><td className="p-2"><b>{r.name}</b><div className="text-xs text-slate-400">{r.studentCode} · Std {r.standard}{r.school ? ` · ${r.school}` : ''}<br />{r.place}</div></td><td className="p-2 font-mono text-xs">{r.joined}</td><td className="p-2 text-xs">{r.referredByName ? <>Referred by <b>{r.referredByName}</b><br /><span className="font-mono text-cyan-300">{r.coupon}</span></> : r.coupon ? <span className="font-mono text-cyan-300">{r.coupon}</span> : r.source}</td><td className="p-2 text-right">{rupees(r.billed)}</td><td className="p-2 text-right">{rupees(r.discount)}</td><td className="p-2 text-right text-emerald-300">{rupees(r.paid)}</td><td className="p-2 text-right text-amber-300">{rupees(r.due)}</td><td className="p-2 text-right">{rupees(r.commissionGenerated)}</td><td className="p-2 text-right font-extrabold">{rupees(r.net)}</td><td className="p-2"><button className={ghost} aria-expanded={open === r.id} onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? 'Hide' : 'Payments'}</button></td></tr>
              {open === r.id && <tr className="bg-black/20"><td colSpan={10} className="p-3">{r.payments.length === 0 ? <span className="text-xs text-slate-400">No payments yet.</span> : <table className="w-full text-xs"><thead className="text-slate-400"><tr><th className="text-left">Date</th><th className="text-left">Term</th><th className="text-left">Receipt</th><th className="text-left">Mode</th><th className="text-right">Amount</th><th className="text-right">Commission</th></tr></thead><tbody>{r.payments.map((p, i) => <tr key={i} className="border-t border-white/5"><td className="py-1 font-mono">{p.date}</td><td>{p.term}</td><td>{p.receiptNo}</td><td>{p.mode}</td><td className="text-right">{rupees(p.amount)}</td><td className="text-right">{p.commission ? rupees(p.commission) : '—'}</td></tr>)}</tbody></table>}</td></tr>}</Fragment>)}
              {revShown.length === 0 && <tr><td colSpan={10} className="p-4 text-slate-400">No students match.</td></tr>}</tbody></table></div>
        </>
      )}
    </div>
  );
}
