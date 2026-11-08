'use client';
/**
 * V51.9.184 — one of the office's four student-management registers (Students, Activities, Fees, Affiliate), with the
 * dropdowns Country → State → District → School and Teacher, a search box, and a CSV download of what is shown.
 * Only the signed-in school office sees these pages; anyone else is sent back to the classroom.
 */
import { UpiPaymentsPanel } from './UpiPaymentsPanel';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchIfSignedIn } from '@/lib/ai-guru/net/session-hint';
import type { Sheet } from '@/lib/ai-guru/admin/registers';

const PAGES: Array<[Sheet, string, string]> = [
  ['students', '👩‍🎓 Students', '/ai-guru/admin/students'],
  ['activities', '📈 Activities', '/ai-guru/admin/activities'],
  ['fees', '💰 Fees', '/ai-guru/admin/fees'],
  ['affiliate', '🤝 Affiliate', '/ai-guru/admin/affiliate'],
  ['dues', '⏰ Fees due', '/ai-guru/admin/dues'],
];
const TITLE: Record<Sheet, [string, string]> = {
  students: ['Students', 'Everything each student gave at sign-up (or the office entered).'],
  activities: ['Activities', 'Trial start, study materials downloaded and created, and every day and time the app was used.'],
  fees: ['Fees', 'Every payment, newest first, with the coupon or class code the student joined with.'],
  dues: ['Fees due', 'Students who owe money now — grace over first. Opening this page also sends any reminders that are due (each bill and stage once) to the students’ Messages. Remind sends them again now; WhatsApp opens a ready message to the parent; Extra days keeps Parts 2–10 open until a date.'],
  affiliate: ['Affiliate', 'Students who brought others in: who joined under them, their payments, commission to be paid on the next payout day, and earlier months.'],
};
type Opt = { countries: string[]; states: string[]; districts: string[]; schools: string[]; teachers: Array<{ id: string; label: string }> };
type F = { country: string; state: string; district: string; school: string; teacher: string; q: string };
const EMPTY: F = { country: '', state: '', district: '', school: '', teacher: '', q: '' };
const sel = 'mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400';
const inr = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const th = 'sticky top-0 bg-[#0b1426] p-2 text-left text-xs font-bold uppercase tracking-wide text-slate-300';
const td = 'p-2 align-top';

/** The "Students management" menu: the four registers, shown on each register page and from the office's tabs. */
export function RegistersMenu({ current }: { current?: Sheet }) {
  return (
    <nav aria-label="Students management" className="flex flex-wrap gap-2" data-registers-menu>
      {PAGES.map(([id, label, href]) => <a key={id} href={href} aria-current={current === id ? 'page' : undefined} className={`rounded-full px-4 py-2 text-sm font-extrabold ${current === id ? 'bg-cyan-400 text-[#04121f]' : 'border border-white/15 text-slate-200 hover:bg-white/5'}`}>{label}</a>)}
    </nav>
  );
}

export function RegisterPage({ sheet }: { sheet: Sheet }) {
  const [f, setF] = useState<F>(EMPTY);
  const [opt, setOpt] = useState<Opt | null>(null);
  const [rows, setRows] = useState<any[] | null>(null);
  const [daily, setDaily] = useState<{ at: string; date: string; sent: number } | null | undefined>(undefined);
  const qs = useMemo(() => { const p = new URLSearchParams({ sheet }); for (const [k, v] of Object.entries(f)) if (v) p.set(k, v); return p.toString(); }, [sheet, f]);
  const load = useCallback(async () => {
    const r = await fetchIfSignedIn(['admin'], `/api/ai-guru/admin/registers?${qs}`, { cache: 'no-store' });
    if (r.status === 404 || r.status === 401) { window.location.href = '/ai-guru'; return; }
    const j = await r.json().catch(() => null);
    if (j?.ok) { setOpt(j.options); setRows(j.rows); if ('daily' in j) setDaily(j.daily); }
  }, [qs]);
  useEffect(() => { const t = setTimeout(() => void load(), f.q ? 300 : 0); return () => clearTimeout(t); }, [load, f.q]);
  // choosing a place clears the narrower choices under it
  const pick = (k: keyof F, v: string) => setF((o) => ({ ...o, [k]: v, ...(k === 'country' ? { state: '', district: '', school: '' } : k === 'state' ? { district: '', school: '' } : k === 'district' ? { school: '' } : {}) }));
  const D = (k: keyof F, label: string, items: Array<string | { id: string; label: string }>) => (
    <label className="block min-w-[150px] flex-1 text-xs font-bold text-slate-300">{label}
      <select className={sel} value={f[k]} onChange={(e) => pick(k, e.target.value)} data-filter={k}>
        <option value="">All</option>
        {items.map((x) => typeof x === 'string' ? <option key={x} value={x}>{x}</option> : <option key={x.id} value={x.id}>{x.label}</option>)}
      </select>
    </label>
  );
  return (
    <main className="min-h-screen bg-[#06101c] px-4 py-6 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <a href="/ai-guru/admin" className="text-sm text-cyan-300 underline">← Admin</a>
          <h1 className="text-2xl font-extrabold">Students management · {TITLE[sheet][0]}</h1>
        </div>
        <RegistersMenu current={sheet} />
        <p className="text-sm text-slate-300">{TITLE[sheet][1]}</p>
        {sheet === 'fees' && <UpiPaymentsPanel onChange={load} />}
        {sheet === 'dues' && daily !== undefined && <p className={`rounded-xl border px-3 py-2 text-sm ${daily ? 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100' : 'border-amber-300/40 bg-amber-400/10 text-amber-100'}`} data-daily-run>
          {daily ? <>⏰ Daily reminders: last run {new Date(daily.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })} · {daily.sent} sent. Every day of the grace period each student gets a reminder; the day after it ends, the “grace period is over” notice.</>
            : <>⏰ The daily reminder run is not set up yet, so reminders go only when a student or the office opens a page. On Google Cloud, run <code>scripts/cloud/setup-daily-reminders.sh</code> once (docs/DEPLOY-GOOGLE-CLOUD.md, step 10).</>}
        </p>}
        <section aria-label="Filters" className="flex flex-wrap items-end gap-3 rounded-2xl border border-white/10 bg-white/[.04] p-4">
          {D('country', 'Country', opt?.countries ?? [])}
          {D('state', 'State', opt?.states ?? [])}
          {D('district', 'District', opt?.districts ?? [])}
          {D('school', 'School', opt?.schools ?? [])}
          {D('teacher', 'Teacher', opt?.teachers ?? [])}
          <label className="block min-w-[180px] flex-1 text-xs font-bold text-slate-300">Search (name, Student ID, phone, e-mail)
            <input className={sel} value={f.q} onChange={(e) => setF((o) => ({ ...o, q: e.target.value }))} data-filter="q" /></label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setF(EMPTY)} className="rounded-lg border border-white/15 px-3 py-2 text-sm font-bold">Clear</button>
            <a href={`/api/ai-guru/admin/registers?${qs}&format=csv`} className="rounded-lg bg-cyan-400 px-3 py-2 text-sm font-extrabold text-[#04121f]" data-csv>⬇ CSV</a>
          </div>
        </section>
        {rows === null ? <p className="text-slate-400">Loading…</p> : <>
          <p className="text-sm font-bold" data-count>{rows.length} {sheet === 'dues' ? (rows.length === 1 ? 'student owes' : 'students owe') : sheet === 'fees' ? (rows.length === 1 ? 'payment' : 'payments') : sheet === 'affiliate' ? (rows.length === 1 ? 'affiliate' : 'affiliates') : (rows.length === 1 ? 'student' : 'students')}{sheet === 'fees' && rows.length ? ` · total ${inr(rows.reduce((a, r) => a + Number(r.amount || 0), 0))}` : ''}{sheet === 'dues' && rows.length ? ` · ${inr(rows.reduce((a, r) => a + Number(r.total || 0), 0))} in all · ${rows.filter((r) => r.stage === 'over').length} past grace (Parts 2–10 locked)` : ''}</p>
          {rows.length === 0 ? <p className="rounded-2xl border border-white/10 p-6 text-center text-slate-400">Nothing here for these choices.</p>
            : <div className="max-h-[70vh] overflow-auto rounded-2xl border border-white/10" data-register={sheet}>{
              sheet === 'dues' ? <DuesTable rows={rows} reload={load} /> : sheet === 'students' ? <StudentsTable rows={rows} /> : sheet === 'activities' ? <ActivitiesTable rows={rows} /> : sheet === 'fees' ? <FeesTable rows={rows} /> : <AffiliateTable rows={rows} />
            }</div>}
        </>}
      </div>
    </main>
  );
}

const List = ({ items, empty = '—' }: { items: string[]; empty?: string }) => items.length ? <details><summary className="cursor-pointer">{items.length} · {items[0]}</summary><ul className="mt-1 space-y-0.5 text-xs text-slate-300">{items.map((x, i) => <li key={i}>{x}</li>)}</ul></details> : <span className="text-slate-500">{empty}</span>;

function StudentsTable({ rows }: { rows: any[] }) {
  return <table className="w-full min-w-[1400px] text-sm"><thead><tr>{['Student ID', 'Name', 'Class', 'Joined', 'Country', 'State', 'District', 'Place', 'School', 'Phone / WhatsApp', 'E-mail', 'Mother tongue', 'Coupon / class code', 'Teacher'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
    <tbody>{rows.map((r) => <tr key={r.studentId} className="border-t border-white/10">
      <td className={`${td} font-mono`}>{r.studentId}</td><td className={`${td} font-bold`}>{r.name}</td><td className={td}>{r.standard}</td><td className={`${td} whitespace-nowrap`}>{r.joined}</td><td className={td}>{r.country}</td><td className={td}>{r.state}</td><td className={td}>{r.district}</td><td className={td}>{r.place}</td><td className={td}>{r.school}</td>
      <td className={td}>{r.phone ? <a className="text-cyan-300 underline" href={`https://wa.me/${r.phone.replace(/\D/g, '').length === 10 ? `91${r.phone.replace(/\D/g, '')}` : r.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">{r.phone}</a> : '—'}</td>
      <td className={td}>{r.email || '—'}</td><td className={td}>{r.motherTongue || '—'}</td><td className={`${td} font-mono`}>{r.coupon || '—'}</td><td className={td}>{r.teacher || '—'}</td>
    </tr>)}</tbody></table>;
}
function ActivitiesTable({ rows }: { rows: any[] }) {
  return <table className="w-full min-w-[1200px] text-sm"><thead><tr>{['Student ID', 'Name', 'Class', 'Trial started', 'Enrolled', 'Downloaded study materials', 'Created study materials', 'Attendance (date, time · minutes)', 'Last active', 'Total time'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
    <tbody>{rows.map((r) => <tr key={r.studentId} className="border-t border-white/10">
      <td className={`${td} font-mono`}>{r.studentId}</td><td className={`${td} font-bold`}>{r.name}</td><td className={td}>{r.standard}</td><td className={`${td} whitespace-nowrap`}>{r.trialStarted}</td><td className={`${td} whitespace-nowrap`}>{r.enrolledOn || <span className="text-amber-300">trial</span>}</td>
      <td className={td}><List items={r.downloads.map((d: any) => `${d.date} · ${d.what}`)} /></td>
      <td className={td}><List items={r.created.map((d: any) => `${d.date} · ${d.what}`)} /></td>
      <td className={td}><List items={r.attendance.map((d: any) => `${d.at} · ${d.minutes} min`)} empty="not yet" /></td>
      <td className={`${td} whitespace-nowrap`}>{r.lastActive || '—'}</td><td className={td}>{r.totalMinutes} min</td>
    </tr>)}</tbody></table>;
}
function FeesTable({ rows }: { rows: any[] }) {
  const by: Record<string, string> = { 'bank-alert': '🏦 bank (auto)', statement: '📄 statement (auto)', office: 'office' };
  return <table className="w-full min-w-[1100px] text-sm"><thead><tr>{['Student ID', 'Name', 'Payment date', 'Amount', 'Mode', 'Receipt', 'Transaction ID · UPI ref', 'For', 'Coupon code joined'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
    <tbody>{rows.map((r) => <tr key={r.receiptNo + r.studentId} className="border-t border-white/10">
      <td className={`${td} font-mono`}>{r.studentId}</td><td className={`${td} font-bold`}>{r.name}</td><td className={`${td} whitespace-nowrap`}>{r.date}</td><td className={`${td} font-bold text-emerald-300`}>{inr(r.amount)}</td><td className={`${td} uppercase`}>{r.mode}</td><td className={`${td} font-mono`}>{r.receiptNo}</td><td className={`${td} font-mono text-xs`}>{r.txnId || r.utr ? <>{r.txnId || '—'}<span className="block text-slate-400">{r.utr}{r.confirmedBy ? ` · ${by[r.confirmedBy] ?? r.confirmedBy}` : ''}</span></> : '—'}</td><td className={td}>{r.for}</td><td className={`${td} font-mono`}>{r.coupon || '—'}</td>
    </tr>)}</tbody></table>;
}
function AffiliateTable({ rows }: { rows: any[] }) {
  return <table className="w-full min-w-[1100px] text-sm"><thead><tr>{['Student ID', 'Name', 'Code', 'Students joined under', 'Payments by each student', 'Commission pending', 'Next payout', 'Previous months'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
    <tbody>{rows.map((r) => <tr key={r.studentId} className="border-t border-white/10">
      <td className={`${td} font-mono`}>{r.studentId}</td><td className={`${td} font-bold`}>{r.name}</td><td className={`${td} font-mono`}>{r.code}</td>
      <td className={td}><List items={r.joined.map((j: any) => `${j.name} (${j.studentId}) · Std ${j.standard} · joined ${j.joined}`)} /></td>
      <td className={td}><List items={r.joined.flatMap((j: any) => j.payments.map((p: any) => `${j.name}: ${p.date} · ${inr(p.amount)} → commission ${inr(p.commission)} (${p.status})`))} empty="no payments yet" /></td>
      <td className={`${td} font-bold text-amber-300`}>{inr(r.pending)}</td>
      <td className={td}>{r.nextPayout ? `${r.nextPayout.payoutDate} · ${inr(r.nextPayout.amount)}` : '—'}</td>
      <td className={td}><List items={r.months.map((m: any) => `${m.payoutDate} · ${inr(m.amount)} · ${m.status}`)} /></td>
    </tr>)}</tbody></table>;
}

const STAGE: Record<string, [string, string]> = {
  over: ['Grace over · locked', 'bg-rose-500/20 text-rose-100'], grace: ['In grace days', 'bg-amber-400/20 text-amber-100'],
  today: ['Due today', 'bg-cyan-400/15 text-cyan-100'], soon: ['Due soon', 'bg-white/10 text-slate-200'], held: ['Extra days', 'bg-emerald-400/15 text-emerald-100'],
};
function DuesTable({ rows, reload }: { rows: any[]; reload: () => void }) {
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');
  const act = async (studentId: string, body: Record<string, unknown>, done: string) => {
    setBusy(studentId); setNote('');
    const j = await fetch('/api/ai-guru/admin/dues', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ studentId, ...body }) }).then((r) => r.json()).catch(() => ({ ok: false, error: 'Could not reach the server' }));
    setBusy(''); setNote(j.ok ? done : j.error); if (j.ok) reload();
  };
  const hold = (r: any) => {
    const d = new Date(Date.now() + 5.5 * 3600_000 + 7 * 86_400_000).toISOString().slice(0, 10);
    const until = window.prompt(`Keep Parts 2–10 open for ${r.name} until (YYYY-MM-DD):`, d);
    if (until) void act(r.key, { action: 'hold', until, note: 'Extra days from the office' }, `Extra days for ${r.name} until ${until}.`);
  };
  const wa = (r: any) => {
    const digits = String(r.phone || '').replace(/\D/g, '');
    const to = digits.length === 10 ? `91${digits}` : digits;
    const text = `AI Guru: ${r.name} (${r.studentId}) — fee of ${inr(r.total)} ${r.stage === 'over' ? `was due on ${r.dueDate}. The grace period is over; please make payment to continue.` : r.stage === 'grace' ? `was due on ${r.dueDate}. Please pay by ${r.graceUntil}.` : `is due on ${r.dueDate}.`} Pay by UPI from “My account” in the AI Guru app, or at the school office.`;
    return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
  };
  return <>
    {note && <p role="status" className="sticky left-0 top-0 z-10 bg-[#0b1426] p-2 text-sm text-emerald-300">{note}</p>}
    <table className="w-full min-w-[1250px] text-sm"><thead><tr>{['Student ID', 'Name', 'Class · school', 'Teacher', 'Stage', 'Amount due', 'Due date', 'Days overdue', 'Bills', 'Act'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
    <tbody>{rows.map((r) => <tr key={r.key} className="border-t border-white/10" data-due-row={r.stage}>
      <td className={`${td} font-mono`}>{r.studentId}</td>
      <td className={`${td} font-bold`}>{r.name}{r.inactive && <span className="ml-1 rounded bg-slate-500/30 px-1.5 text-xs font-normal">inactive</span>}</td>
      <td className={td}>{r.standard} · {r.school}</td><td className={td}>{r.teacher || '—'}</td>
      <td className={td}><span className={`rounded-full px-2 py-1 text-xs font-bold ${STAGE[r.stage][1]}`}>{STAGE[r.stage][0]}</span>{r.holdUntil && <span className="block text-xs text-emerald-300">extra days until {r.holdUntil}</span>}</td>
      <td className={`${td} font-bold text-amber-200`}>{inr(r.total)}</td>
      <td className={`${td} whitespace-nowrap`}>{r.dueDate}<span className="block text-xs text-slate-400">grace until {r.graceUntil}</span></td>
      <td className={td}>{r.daysOverdue || '—'}</td>
      <td className={td}><List items={r.bills.map((b: any) => `${b.label} · ${inr(b.amount)} · due ${b.dueDate}`)} /></td>
      <td className={td}><span className="flex flex-wrap gap-1.5">
        <button type="button" disabled={busy === r.key} onClick={() => void act(r.key, { action: 'remind' }, `Reminder sent to ${r.name}'s Messages.`)} className="rounded-lg border border-white/15 px-2 py-1 text-xs font-bold" data-due-remind>📩 Remind</button>
        {r.phone && <a href={wa(r)} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-emerald-300/40 px-2 py-1 text-xs font-bold text-emerald-200" data-due-whatsapp>WhatsApp</a>}
        {r.holdUntil ? <button type="button" disabled={busy === r.key} onClick={() => void act(r.key, { action: 'clear' }, `Extra days taken back for ${r.name}.`)} className="rounded-lg border border-white/15 px-2 py-1 text-xs font-bold">Undo extra days</button>
          : <button type="button" disabled={busy === r.key} onClick={() => hold(r)} className="rounded-lg border border-white/15 px-2 py-1 text-xs font-bold" data-due-hold>Extra days</button>}
        <a href="/ai-guru/admin?tab=fees" className="rounded-lg border border-white/15 px-2 py-1 text-xs font-bold">Record payment</a>
      </span></td>
    </tr>)}</tbody></table>
  </>;
}
