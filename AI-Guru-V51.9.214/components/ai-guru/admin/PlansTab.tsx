'use client';
/**
 * V51.9.94 — Admin: monthly and yearly fee plans. Monthly fee per standard, the yearly reduction %, grace days; then two
 * registers: the yearly register (12-month advance payments) and the monthly register (one bill a month). Each row has
 * its own fee bill: record payments here (receipt, friend's commission, unlock) exactly as in Fees.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { rupees, type Invoice, type PublicStudent } from '@/lib/ai-guru/admin/fees';
import { receiptHtml } from '@/lib/ai-guru/admin/receipt';
import type { PlanPrice, PlanSettings, RecordStatus } from '@/lib/ai-guru/admin/plans';

interface Pay { id: string; receiptNo: string; amount: number; date: string; mode: string }
interface Row {
  id: string; kind: 'yearly' | 'monthly'; studentId: string; invoiceId: string; start: string; end: string; label: string; monthlyRate: number; total: number; couponDiscount: number; coupon?: string;
  gross?: number; reductionPct?: number; reduction?: number; status: RecordStatus; current: boolean;
  student: { id: string; name: string; studentCode?: string; standard: string; school: string } | null;
  invoice: { id: string; term: string; total: number; paid: number; due: number; payments: Pay[] } | null;
}
interface Stu { id: string; name: string; studentCode?: string; standard: string; monthlyRate: number | null; paidThrough: string | null; nextStart: string; plan: 'yearly' | 'monthly' | null }
interface PriceRow { standard: string; monthly: number; twelveMonths: number; yearly: number; saving: number }
interface Totals { yearly: { records: number; activeStudents: number; collected: number; due: number; reductionGiven: number }; monthly: { records: number; activeStudents: number; collected: number; due: number; overdue: number } }
type Say = (ok: boolean, t: string) => void;

const call = async (url: string, body?: unknown) => { const r = await fetch(url, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' }); const j = await r.json().catch(() => ({})); return { ok: !!j.ok, j }; };
const api = (body?: unknown) => call('/api/ai-guru/admin/plans', body);
const inp = 'mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400';
const btn = 'rounded-lg bg-cyan-400 px-4 py-2 text-sm font-extrabold text-[#04121f] disabled:opacity-50';
const ghost = 'rounded-lg border border-white/15 px-2.5 py-1.5 text-xs font-bold text-slate-200 hover:bg-white/5';
const TONE: Record<RecordStatus, string> = { paid: 'bg-emerald-400/15 text-emerald-300', partial: 'bg-amber-400/15 text-amber-200', due: 'bg-cyan-400/15 text-cyan-200', overdue: 'bg-rose-400/15 text-rose-300', upcoming: 'bg-slate-400/15 text-slate-300' };
const LABEL: Record<RecordStatus, string> = { paid: 'Paid', partial: 'Part paid', due: 'Due', overdue: 'Overdue', upcoming: 'Upcoming' };
const today = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
const std = (s: string) => (s === 'all' ? 'All other standards' : /^\d+$/.test(s) ? `Std ${s}` : s);

export function PlansTab({ say }: { say: Say }) {
  const [set, setSet] = useState<PlanSettings | null>(null);
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [yearly, setYearly] = useState<Row[]>([]);
  const [monthly, setMonthly] = useState<Row[]>([]);
  const [tot, setTot] = useState<Totals | null>(null);
  const [students, setStudents] = useState<Stu[]>([]);
  const [reg, setReg] = useState<'yearly' | 'monthly'>('yearly');
  const [q, setQ] = useState('');
  const [statusF, setStatusF] = useState<'' | RecordStatus>('');
  const [nw, setNw] = useState<{ studentId: string; kind: 'yearly' | 'monthly'; start: string }>({ studentId: '', kind: 'yearly', start: '' });
  const [pay, setPay] = useState<{ row: Row; amount: string; date: string; mode: string; note: string } | null>(null);
  const load = useCallback(async () => { const r = await api(); if (r.ok) { setSet(r.j.settings); setPrices(r.j.prices); setYearly(r.j.yearly); setMonthly(r.j.monthly); setTot(r.j.totals); setStudents(r.j.students); } }, []);
  useEffect(() => { void load(); }, [load]);
  const rows = reg === 'yearly' ? yearly : monthly;
  const shown = useMemo(() => { const n = q.trim().toLowerCase(); return rows.filter((r) => (!statusF || r.status === statusF) && (!n || `${r.student?.name ?? ''} ${r.student?.studentCode ?? ''} ${r.student?.school ?? ''}`.toLowerCase().includes(n))); }, [rows, q, statusF]);
  if (!set || !tot) return <p className="text-slate-400">Loading…</p>;

  const pick = students.find((s) => s.id === nw.studentId);
  const setPrice = (i: number, p: Partial<PlanPrice>) => setSet({ ...set, prices: set.prices.map((x, k) => (k === i ? { ...x, ...p } : x)) });
  const stds = [...new Set(students.map((s) => s.standard).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const unpriced = stds.filter((s) => !set.prices.some((p) => p.standard === s));
  const save = async () => { const r = await api({ action: 'settings', plans: set }); say(r.ok, r.ok ? `Saved. Yearly plans now get ${set.yearlyReductionPct}% off 12 months (new plans only; plans already made keep their price).` : r.j.error ?? 'Could not save'); if (r.ok) await load(); };
  const create = async () => { const r = await api({ action: nw.kind, studentId: nw.studentId, start: nw.start }); say(r.ok, r.ok ? `${nw.kind === 'yearly' ? 'Yearly' : 'Monthly'} plan made for ${pick?.name}: ${rupees(r.j.record.total)} from ${r.j.record.start} to ${r.j.record.end}. Record the payment below when it is paid.` : r.j.error ?? 'Could not make the plan'); if (r.ok) { setReg(nw.kind); setNw({ ...nw, studentId: '', start: '' }); await load(); } };
  const nextMonth = async () => { const r = await api({ action: 'nextMonth' }); say(r.ok, r.ok ? `${r.j.made} monthly bill(s) made for the next month.${r.j.skipped?.length ? ` Skipped: ${r.j.skipped.join('; ')}` : ''}` : 'Could not make the bills'); if (r.ok) await load(); };
  const remove = async (r: Row) => { if (!confirm(`Remove ${r.label} for ${r.student?.name}? Its unpaid bill is removed too.`)) return; const x = await api({ action: 'remove', register: r.kind, id: r.id }); say(x.ok, x.ok ? 'Removed.' : x.j.error ?? 'Could not remove'); if (x.ok) await load(); };
  const record = async () => { if (!pay) return; const r = await call('/api/ai-guru/admin/fees', { action: 'pay', invoiceId: pay.row.invoiceId, amount: pay.amount, date: pay.date, mode: pay.mode, note: pay.note }); say(r.ok, r.ok ? `Receipt ${r.j.payment.receiptNo} recorded for ${pay.row.student?.name}.` : r.j.error ?? 'Could not record'); if (r.ok) { setPay(null); await load(); } };
  const print = async (r: Row, p: Pay) => {
    const [f, s] = await Promise.all([call('/api/ai-guru/admin/fees'), call('/api/ai-guru/admin/students')]);
    const inv = (f.j.invoices as Invoice[] | undefined)?.find((i) => i.id === r.invoiceId); const pp = inv?.payments.find((x) => x.id === p.id);
    const st = (s.j.students as PublicStudent[] | undefined)?.find((x) => x.id === r.studentId);
    if (!inv || !pp) return say(false, 'Bill not found');
    const w = window.open('', '_blank', 'width=640,height=760'); if (!w) return say(false, 'Allow pop-ups to print the receipt');
    w.document.write(receiptHtml(f.j.school, st, inv, pp)); w.document.close();
  };
  const T = reg === 'yearly' ? tot.yearly : tot.monthly;

  return (
    <div className="space-y-6">
      {/* V51.9.195: one place for every setting */}
      <p className="rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-100" data-settings-banner>⚙ Every office setting (part prices, free trial, UPI, free doubts, commission, schools) is on one page: <a href="/ai-guru/admin/settings" className="font-bold underline">⚙ Settings</a>. Changes made here show there too.</p>
      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[.04] p-4">
        <h2 className="text-lg font-extrabold">Monthly fee and yearly reduction</h2>
        <p className="text-xs text-slate-400">Students pay monthly, or a year in advance with the reduction below. A paid month or year opens every part of every book until it ends; after the grace days the paid parts lock again until the next payment.</p>
        <div className="space-y-2">
          {set.prices.map((p, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2">
              <label className="text-xs font-bold text-slate-300">Standard<select className={inp} value={p.standard} onChange={(e) => setPrice(i, { standard: e.target.value })}>{[p.standard, ...unpriced, ...(set.prices.some((x) => x.standard === 'all') ? [] : ['all'])].filter((v, k, a) => a.indexOf(v) === k).map((s) => <option key={s} value={s}>{std(s)}</option>)}</select></label>
              <label className="text-xs font-bold text-slate-300">Monthly fee (₹)<input type="number" min={1} className={`${inp} w-32`} value={p.monthly} onChange={(e) => setPrice(i, { monthly: Number(e.target.value) })} /></label>
              <button className={ghost} onClick={() => setSet({ ...set, prices: set.prices.filter((_, k) => k !== i) })}>Remove</button>
            </div>))}
          <div className="flex flex-wrap gap-2">
            {unpriced.length > 0 && <button className={ghost} onClick={() => setSet({ ...set, prices: [...set.prices, { standard: unpriced[0], monthly: 500 }] })}>+ Monthly fee for a standard</button>}
            {!set.prices.some((p) => p.standard === 'all') && <button className={ghost} onClick={() => setSet({ ...set, prices: [...set.prices, { standard: 'all', monthly: 500 }] })}>+ Monthly fee for all other standards</button>}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:max-w-xl">
          <label className="text-xs font-bold text-slate-300">Yearly reduction (%)<input type="number" min={0} max={90} step="0.5" className={inp} value={set.yearlyReductionPct} onChange={(e) => setSet({ ...set, yearlyReductionPct: Number(e.target.value) })} /><span className="font-normal text-slate-500">off 12 × the monthly fee, for paying a year in advance</span></label>
          <label className="text-xs font-bold text-slate-300">Grace days<input type="number" min={0} max={60} className={inp} value={set.graceDays} onChange={(e) => setSet({ ...set, graceDays: Number(e.target.value) })} /><span className="font-normal text-slate-500">after a paid period ends, before the paid parts lock</span></label>
        </div>
        <button className={btn} onClick={save}>Save</button>
        {prices.length > 0 && <div className="overflow-x-auto rounded-xl border border-white/10"><table className="w-full text-left text-sm"><thead className="bg-white/5 text-xs uppercase text-slate-400"><tr><th className="p-2">Std</th><th className="p-2 text-right">Monthly</th><th className="p-2 text-right">12 months</th><th className="p-2 text-right">Yearly (−{set.yearlyReductionPct}%)</th><th className="p-2 text-right">Saving</th></tr></thead>
          <tbody>{prices.map((p) => <tr key={p.standard} className="border-t border-white/10"><td className="p-2 font-bold">{std(p.standard)}</td><td className="p-2 text-right">{rupees(p.monthly)}</td><td className="p-2 text-right text-slate-400">{rupees(p.twelveMonths)}</td><td className="p-2 text-right font-bold text-emerald-300">{rupees(p.yearly)}</td><td className="p-2 text-right text-amber-300">{rupees(p.saving)}</td></tr>)}</tbody></table>
          <p className="p-2 text-[11px] text-slate-500">Before the friend’s or class code discount (shown on each bill). Prices from the last save.</p></div>}
      </section>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[.04] p-4">
        <h2 className="text-lg font-extrabold">New plan</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="text-xs font-bold text-slate-300 sm:col-span-2">Student<select className={inp} value={nw.studentId} onChange={(e) => setNw({ ...nw, studentId: e.target.value, start: '' })}><option value="">Choose…</option>{students.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.studentCode ?? ''} · Std {s.standard || '?'}{s.plan ? ` · on ${s.plan}` : ''}</option>)}</select></label>
          <fieldset className="text-xs font-bold text-slate-300"><legend>Plan</legend><div className="mt-2 flex gap-3 text-sm font-normal">{(['yearly', 'monthly'] as const).map((k) => <label key={k} className="flex items-center gap-1.5"><input type="radio" checked={nw.kind === k} onChange={() => setNw({ ...nw, kind: k })} />{k === 'yearly' ? 'Yearly (advance)' : 'Monthly'}</label>)}</div></fieldset>
          <label className="text-xs font-bold text-slate-300">Starts<input type="date" className={inp} value={nw.start || pick?.nextStart || ''} onChange={(e) => setNw({ ...nw, start: e.target.value })} /></label>
        </div>
        {pick && <p className="text-xs text-slate-400">{pick.monthlyRate === null ? <span className="text-amber-200">No monthly fee is set for Std {pick.standard || '?'} yet.</span> : <>Monthly fee {rupees(pick.monthlyRate)} · yearly {rupees(Math.round(pick.monthlyRate * 12 * (100 - set.yearlyReductionPct)) / 100)} before code discount</>}{pick.paidThrough ? ` · paid till ${pick.paidThrough}` : ' · nothing paid on a plan yet'}</p>}
        <button className={btn} disabled={!nw.studentId || pick?.monthlyRate === null} onClick={create}>Make the plan and its bill</button>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        {(['yearly', 'monthly'] as const).map((k) => <button key={k} onClick={() => setReg(k)} aria-pressed={reg === k} className={`rounded-full px-4 py-2 text-sm font-extrabold ${reg === k ? 'bg-white text-[#04121f]' : 'border border-white/15 text-slate-200'}`}>{k === 'yearly' ? `Yearly register (${tot.yearly.records})` : `Monthly register (${tot.monthly.records})`}</button>)}
        {reg === 'monthly' && <button className={ghost} onClick={nextMonth} title="For every monthly student whose last month ends within 7 days">Make next month’s bills</button>}
        <a className={`${ghost} ml-auto`} href={`/api/ai-guru/admin/plans?format=csv&register=${reg}`}>Download {reg} register (CSV)</a>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([['Students on it now', String(T.activeStudents)], ['Collected', rupees(T.collected)], ['Still due', rupees(T.due)], reg === 'yearly' ? ['Yearly reduction given', rupees(tot.yearly.reductionGiven)] : ['Overdue bills', String(tot.monthly.overdue)]] as const).map(([l, v]) => <div key={l} className="rounded-2xl border border-white/10 bg-white/[.04] p-3"><div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{l}</div><div className="mt-1 text-xl font-black">{v}</div></div>)}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, ID, school" aria-label="Search" className={`${inp} mt-0 max-w-xs`} />
        <select aria-label="Status" value={statusF} onChange={(e) => setStatusF(e.target.value as '' | RecordStatus)} className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm"><option value="">Every status</option>{(Object.keys(LABEL) as RecordStatus[]).map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}</select>
        <span className="text-xs text-slate-400">Showing {shown.length} of {rows.length}</span>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-white/10"><table className="w-full min-w-[860px] text-left text-sm"><caption className="sr-only">{reg === 'yearly' ? 'Yearly register' : 'Monthly register'}</caption>
        <thead className="bg-white/5 text-xs uppercase text-slate-400"><tr><th className="p-2">Student</th><th className="p-2">Period</th><th className="p-2 text-right">Price</th><th className="p-2 text-right">Paid / due</th><th className="p-2">Status</th><th className="p-2">Actions</th></tr></thead>
        <tbody>{shown.map((r) => (
          <tr key={r.id} className="border-t border-white/10 align-top">
            <td className="p-2"><b>{r.student?.name ?? '(removed)'}</b><div className="text-xs text-slate-400">{r.student?.studentCode} · Std {r.student?.standard}</div></td>
            <td className="p-2 text-xs">{r.start} → {r.end}{r.current && <span className="ml-1 rounded-full bg-white/10 px-1.5 text-[10px]">now</span>}</td>
            <td className="p-2 text-right text-xs">{r.kind === 'yearly' ? <><div className="text-slate-400">12 × {rupees(r.monthlyRate)} = {rupees(r.gross ?? 0)}</div><div className="text-emerald-300">− {r.reductionPct}% yearly {rupees(r.reduction ?? 0)}</div></> : <div className="text-slate-400">{rupees(r.monthlyRate)}</div>}{r.couponDiscount > 0 && <div className="text-emerald-300">− code {r.coupon} {rupees(r.couponDiscount)}</div>}<b className="text-sm">{rupees(r.total)}</b></td>
            <td className="p-2 text-right text-xs"><span className="text-emerald-300">{rupees(r.invoice?.paid ?? 0)}</span>{(r.invoice?.due ?? 0) > 0 && <div className="font-bold text-amber-300">{rupees(r.invoice!.due)} due</div>}{r.invoice?.payments.map((p) => <div key={p.id}><button onClick={() => print(r, p)} className="text-cyan-300 underline">{p.receiptNo}</button></div>)}</td>
            <td className="p-2 text-xs"><span className={`rounded-full px-2 py-0.5 font-bold ${TONE[r.status]}`}>{LABEL[r.status]}</span></td>
            <td className="p-2"><div className="flex flex-wrap gap-1.5">{(r.invoice?.due ?? 0) > 0 && <button className={ghost} onClick={() => setPay({ row: r, amount: String(r.invoice!.due), date: today(), mode: 'upi', note: '' })}>Record payment</button>}{(r.invoice?.paid ?? 0) === 0 && <button className={ghost} onClick={() => remove(r)}>Remove</button>}</div></td>
          </tr>))}
          {shown.length === 0 && <tr><td colSpan={6} className="p-4 text-slate-400">{rows.length ? 'No rows match.' : `No ${reg} plans yet. Make one above.`}</td></tr>}</tbody></table></div>

      {pay && (
        <div role="dialog" aria-modal="true" aria-label="Record payment" className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-sm space-y-3 rounded-2xl border border-white/15 bg-[#0a1a2b] p-5">
            <h3 className="font-extrabold">Payment · {pay.row.student?.name}</h3><p className="text-sm text-slate-400">{pay.row.label} · due {rupees(pay.row.invoice?.due ?? 0)}</p>
            <label className="block text-xs font-bold text-slate-300">Amount ₹<input className={inp} inputMode="decimal" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} /></label>
            <label className="block text-xs font-bold text-slate-300">Date<input type="date" className={inp} value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })} /></label>
            <label className="block text-xs font-bold text-slate-300">Mode<select className={inp} value={pay.mode} onChange={(e) => setPay({ ...pay, mode: e.target.value })}>{['cash', 'upi', 'card', 'bank', 'cheque'].map((m) => <option key={m}>{m}</option>)}</select></label>
            <label className="block text-xs font-bold text-slate-300">Note (optional)<input className={inp} value={pay.note} onChange={(e) => setPay({ ...pay, note: e.target.value })} /></label>
            <p className="text-[11px] text-slate-500">Paying the full amount opens every part of every book until {pay.row.end} (+{set.graceDays} grace days). The friend’s commission is worked out as in Fees.</p>
            <div className="flex gap-2"><button className={btn} onClick={record}>Record</button><button className={ghost} onClick={() => setPay(null)}>Cancel</button></div>
          </div></div>)}
    </div>
  );
}
