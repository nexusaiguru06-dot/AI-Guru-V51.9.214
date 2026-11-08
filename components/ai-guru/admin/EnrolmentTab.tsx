'use client';
/**
 * V51.9.93 — Admin: free part (trial) and enrolment. Every uploaded book is split into ten parts, one for each academic month; the free parts (Part 1
 * by default) can be studied by anyone with all their study materials, the rest opens when the student is enrolled.
 * Lists every newcomer with how they came in (friend's link, class code, coupon, direct, office) and whether they paid.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { rupees } from '@/lib/ai-guru/admin/fees';
import { STATUS_LABEL, type AccessSettings, type AccessStatus } from '@/lib/ai-guru/admin/enrolment';

type Via = 'friend' | 'school' | 'class' | 'coupon' | 'direct' | 'office';
interface Row {
  id: string; name: string; studentCode?: string; standard: string; school: string; joined: string; source: string; via: Via;
  referredBy: { id: string; name: string; code?: string } | null; className: string | null; schoolLink?: { name: string; discountPct: number; teacher: string } | null; partsPaid?: number[] | null; coupon: string | null; signupCode: string | null;
  enrolledNote: string | null; status: AccessStatus; enrolledOn?: string; enrolledBy?: 'payment' | 'admin'; pilotUntil?: string; paidThrough?: string; openUntil?: string; due: number; price: number;
}
interface Book { id: string; fileName: string; subject: string; grade: string; pageCount: number; ownFreeParts: number[] | null; parts: Array<{ index: number; startPage: number; endPage: number; chapters: string[]; free: boolean; materials: string[] }> }
interface Totals { students: number; free: number; enrolled: number; pilot: number; selfJoined: number; selfPaid: number; viaFriend: number; viaFriendPaid: number }
type Say = (ok: boolean, t: string) => void;

const api = async (body?: unknown) => { const r = await fetch('/api/ai-guru/admin/enrolment', { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' }); const j = await r.json().catch(() => ({})); return { ok: !!j.ok, j }; };
const inp = 'mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400';
const btn = 'rounded-lg bg-cyan-400 px-4 py-2 text-sm font-extrabold text-[#04121f] disabled:opacity-50';
const ghost = 'rounded-lg border border-white/15 px-2.5 py-1.5 text-xs font-bold text-slate-200 hover:bg-white/5';
const TONE: Record<AccessStatus, string> = { free: 'bg-cyan-400/15 text-cyan-200', enrolled: 'bg-emerald-400/15 text-emerald-300', pilot: 'bg-violet-400/15 text-violet-200', lapsed: 'bg-rose-400/15 text-rose-300' };
const VIA: Record<Via, string> = { friend: 'Friend’s link', school: 'Contracted school', class: 'Class code', coupon: 'Coupon', direct: 'Signed up directly', office: 'Added by office' };
const MAT: Record<string, string> = { 'whiteboard-notes': 'Whiteboard', mcq: 'MCQ', 'revision-notes': 'Revision', qa: 'Q&A', flashcards: 'Flashcards', worksheet: 'Worksheet', 'question-paper': 'Question paper', ppt: 'Slides', 'mind-map': 'Mind map', 'knowledge-base': 'Knowledge base', 'problems-formulae': 'Problems' };
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—');

export function EnrolmentTab({ say }: { say: Say }) {
  const [set, setSet] = useState<AccessSettings | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [tot, setTot] = useState<Totals | null>(null);
  const [status, setStatus] = useState<'' | AccessStatus>('');
  const [via, setVia] = useState<'' | Via>('');
  const [q, setQ] = useState('');
  const load = useCallback(async () => { const r = await api(); if (r.ok) { setSet(r.j.settings); setRows(r.j.rows); setTot(r.j.totals); setBooks(r.j.books ?? []); } }, []);
  useEffect(() => { void load(); }, [load]);
  const act = async (body: Record<string, unknown>, ok: string) => { const r = await api(body); say(r.ok, r.ok ? ok : r.j.error ?? 'Could not do that'); if (r.ok) await load(); };
  const shown = useMemo(() => { const n = q.trim().toLowerCase(); return rows.filter((r) => (!status || r.status === status) && (!via || r.via === via) && (!n || `${r.name} ${r.studentCode ?? ''} ${r.school} ${r.referredBy?.name ?? ''} ${r.className ?? ''} ${r.signupCode ?? ''}`.toLowerCase().includes(n))); }, [rows, status, via, q]);
  if (!set || !tot) return <p className="text-slate-400">Loading…</p>;

  const toggleDefault = (p: number) => setSet({ ...set, freeParts: set.freeParts.includes(p) ? set.freeParts.filter((x) => x !== p) : [...set.freeParts, p].sort() });
  const saveSet = async () => { const r = await api({ action: 'settings', access: set }); say(r.ok, r.ok ? (set.enabled ? `Saved. Students who have not paid can study ${set.freeParts.length ? `Part ${set.freeParts.join(', ')}` : 'no part'} of each book; the other parts open when they are enrolled.` : 'Saved. Every part of every book is open to everyone.') : r.j.error ?? 'Could not save'); if (r.ok) await load(); };
  const toggleBookPart = (b: Book, p: number) => { const cur = b.parts.filter((x) => x.free).map((x) => x.index); const next = cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p].sort(); void act({ action: 'book', documentId: b.id, freeParts: next }, `${b.fileName}: free ${next.length ? `Part ${next.join(', ')}` : 'nothing'}.`); };

  return (
    <div className="space-y-6">
      {/* V51.9.195: one place for every setting */}
      <p className="rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-100" data-settings-banner>⚙ Every office setting (part prices, free trial, UPI, free doubts, commission, schools) is on one page: <a href="/ai-guru/admin/settings" className="font-bold underline">⚙ Settings</a>. Changes made here show there too.</p>
      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[.04] p-4">
        <h2 className="text-lg font-extrabold">Free part (trial)</h2>
        <p className="text-xs text-slate-400">Every book uploaded in Material Studio is split into ten parts, one for each academic month. A free part can be studied by anyone — the textbook pages, the classroom teaching and all its study materials (whiteboard notes, MCQ, revision and the rest). The other parts open when the student is enrolled: the first fee payment recorded in Fees enrols them at once, or enrol a free seat below. Students of a tuition centre in its free pilot get every part.</p>
        <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={set.enabled} onChange={(e) => setSet({ ...set, enabled: e.target.checked })} />Lock the other parts for students who have not paid</label>
        <div className="text-sm"><span className="text-xs font-bold text-slate-300">Free parts of every book (unless a book has its own)</span>
          <div className="mt-1 flex flex-wrap gap-1.5">{[1, 2, 3, 4, 5].map((p) => <button key={p} type="button" aria-pressed={set.freeParts.includes(p)} onClick={() => toggleDefault(p)} className={`rounded-full px-3 py-1 text-xs font-bold ${set.freeParts.includes(p) ? 'bg-emerald-400 text-[#04121f]' : 'border border-white/15 text-slate-300'}`}>Part {p} {set.freeParts.includes(p) ? '· free' : '· paid'}</button>)}</div></div>
        <button className={btn} onClick={saveSet}>Save</button>
        {!set.enabled && <p className="text-xs text-amber-200">The lock is off: every part is open to everyone, as before.</p>}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-extrabold">Books</h2>
        {books.length === 0 && <p className="text-sm text-slate-400">No books yet. Upload a textbook PDF in Material Studio.</p>}
        {books.map((b) => (
          <div key={b.id} className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
            <div className="flex flex-wrap items-baseline gap-2"><h3 className="font-extrabold">{b.fileName}</h3><span className="text-xs text-slate-400">{[b.subject, b.grade && `Std ${b.grade}`, `${b.pageCount} pages`].filter(Boolean).join(' · ')}</span>
              <span className="ml-auto text-xs text-slate-400">{b.ownFreeParts ? <>Own setting · <button className="text-cyan-300 underline" onClick={() => act({ action: 'book', documentId: b.id, freeParts: null }, `${b.fileName} follows the school-wide free parts again.`)}>use school-wide</button></> : 'School-wide setting'}</span></div>
            <div className="mt-3 grid gap-2 sm:grid-cols-5">{b.parts.map((p) => (
              <button key={p.index} onClick={() => toggleBookPart(b, p.index)} title="Click to make this part free or paid for this book" className={`rounded-xl border p-2.5 text-left text-xs ${p.free ? 'border-emerald-400/40 bg-emerald-400/10' : 'border-white/10 bg-black/20'}`}>
                <div className="flex items-center justify-between"><b className="text-sm">Part {p.index}</b><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${p.free ? 'bg-emerald-400 text-[#04121f]' : 'bg-white/10 text-slate-300'}`}>{p.free ? 'FREE' : set.enabled ? '🔒 PAID' : 'paid'}</span></div>
                <div className="mt-1 text-slate-400">pp. {p.startPage}–{p.endPage}</div>
                {p.chapters.length > 0 && <div className="mt-1 line-clamp-2 text-slate-300">{p.chapters.join(' · ')}</div>}
                <div className="mt-1 text-[10px] text-slate-500">{p.materials.length ? [...new Set(p.materials)].map((m) => MAT[m] ?? m).join(', ') : 'no materials yet'}</div>
              </button>))}</div>
          </div>))}
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {([['Students', String(tot.students), ''], ['On free trial', String(tot.free), 'free'], ['Enrolled', String(tot.enrolled), 'enrolled'], ['Centre pilot', String(tot.pilot), 'pilot'], ['Sign-ups who paid', `${tot.selfPaid}/${tot.selfJoined} · ${pct(tot.selfPaid, tot.selfJoined)}`, ''], ['Friend referrals who paid', `${tot.viaFriendPaid}/${tot.viaFriend} · ${pct(tot.viaFriendPaid, tot.viaFriend)}`, '']] as const).map(([l, v, s]) => (
          <button key={l} onClick={() => setStatus(s as '' | AccessStatus)} className="rounded-2xl border border-white/10 bg-white/[.04] p-3 text-left hover:bg-white/[.07]"><div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{l}</div><div className="mt-1 text-xl font-black">{v}</div></button>))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, ID, school, friend, class, code" aria-label="Search" className={`${inp} mt-0 max-w-xs`} />
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as '' | AccessStatus)} className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm"><option value="">Every status</option>{(Object.keys(STATUS_LABEL) as AccessStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select>
        <select aria-label="Came through" value={via} onChange={(e) => setVia(e.target.value as '' | Via)} className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm"><option value="">Came through: any</option>{(Object.keys(VIA) as Via[]).map((v) => <option key={v} value={v}>{VIA[v]} ({rows.filter((r) => r.via === v).length})</option>)}</select>
        <span className="text-xs text-slate-400">Showing {shown.length} of {rows.length}</span>
        <a className={`${ghost} ml-auto`} href="/api/ai-guru/admin/enrolment?format=csv">Download (CSV)</a>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10"><table className="w-full min-w-[860px] text-left text-sm"><caption className="sr-only">Students, how they came in and whether they are enrolled</caption>
        <thead className="bg-white/5 text-xs uppercase text-slate-400"><tr><th className="p-2">Student</th><th className="p-2">Came through</th><th className="p-2">Status</th><th className="p-2 text-right">Owes / fee</th><th className="p-2">Actions</th></tr></thead>
        <tbody>{shown.map((r) => (
          <tr key={r.id} className="border-t border-white/10 align-top">
            <td className="p-2"><b>{r.name}</b><div className="text-xs text-slate-400">{r.studentCode} · Std {r.standard || '—'}{r.school ? ` · ${r.school}` : ''}<br />joined {r.joined}</div></td>
            <td className="p-2 text-xs"><div className="font-bold">{VIA[r.via]}</div>
              {r.referredBy && <div>Friend: <b>{r.referredBy.name}</b> <span className="font-mono text-cyan-300">{r.referredBy.code}</span></div>}
              {r.className && <div>Class: <b>{r.className}</b></div>}
              {r.schoolLink && <div>School: <b>{r.schoolLink.name}</b>{r.schoolLink.teacher ? ` · ${r.schoolLink.teacher}` : ''}{r.schoolLink.discountPct ? ` · ${r.schoolLink.discountPct}% off` : ''}</div>}
              {(r.signupCode || r.coupon) && !r.schoolLink && !(r.referredBy?.code && r.referredBy.code === (r.signupCode ?? r.coupon) && r.coupon) && <div className="text-slate-400">Code <span className="font-mono">{r.signupCode ?? r.coupon}</span>{r.signupCode && !r.coupon ? ' (no discount)' : ''}</div>}</td>
            <td className="p-2 text-xs"><span className={`rounded-full px-2 py-0.5 font-bold ${TONE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
              <div className="mt-1 text-slate-400">
                {r.partsPaid && r.status !== 'pilot' ? <>{r.partsPaid.length ? `Paid: Part ${r.partsPaid.join(', ')}` : 'No part paid yet'}</> /* V51.9.195: fees are paid by part */ : r.status === 'enrolled' && <>since {r.enrolledOn} · {r.enrolledBy === 'payment' ? 'paid' : `by office${r.enrolledNote ? ` (${r.enrolledNote})` : ''}`}{r.paidThrough ? ` · paid till ${r.paidThrough}` : ''}</>}
                {r.status === 'lapsed' && <>paid till {r.paidThrough} · locked since {r.openUntil}</>}
                {r.status === 'pilot' && <>pilot until {r.pilotUntil}</>}
              </div></td>
            <td className="p-2 text-right text-xs">{r.due > 0 ? <b className="text-amber-300">{rupees(r.due)} due</b> : r.status === 'enrolled' ? <span className="text-slate-500">—</span> : r.price > 0 ? <span>fee {rupees(r.price)}</span> : <span className="text-slate-500">no fee heads</span>}</td>
            <td className="p-2"><div className="flex flex-wrap items-center gap-1.5">
              {r.status !== 'enrolled' && <button className={ghost} onClick={() => { const note = prompt(`Enrol ${r.name} without a payment? Write why (e.g. scholarship, staff child).`, ''); if (note !== null) void act({ action: 'enrol', studentId: r.id, note }, `${r.name} is enrolled: every part is open.`); }}>Enrol (free seat)</button>}
              {r.status === 'enrolled' && r.enrolledBy === 'admin' && <button className={ghost} onClick={() => act({ action: 'unenrol', studentId: r.id }, `Hand enrolment of ${r.name} undone.`)}>Undo enrolment</button>}
              {(r.status === 'free' || r.status === 'lapsed') && <span className="text-[11px] text-slate-500">or start a monthly / yearly plan</span>}
            </div></td>
          </tr>))}
          {shown.length === 0 && <tr><td colSpan={5} className="p-4 text-slate-400">No students match.</td></tr>}</tbody></table></div>
      <p className="text-xs text-slate-500">Commission and the friend’s discount are set in Affiliates; each class’s discount in Classes &amp; centres. Material Studio needs the admin sign-in to make materials for paid parts while the lock is on.</p>
    </div>
  );
}
