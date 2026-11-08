'use client';
import type { Access } from '@/lib/ai-guru/admin/enrolment';
import { useCallback, useEffect, useState } from 'react';
import { formatAddress } from '@/lib/ai-guru/admin/address';
import { receiptHtml } from '@/lib/ai-guru/admin/receipt';
import { rupees, type FeeStatus, type Invoice, type PublicStudent } from '@/lib/ai-guru/admin/fees';
import AffiliatePanel, { type AffiliateInfo } from '@/components/ai-guru/AffiliatePanel';
import { RewardCounters } from '@/components/ai-guru/quiz/RewardCounters';
import { MyClassPanel } from '@/components/ai-guru/share/MyClassPanel';
import { TeacherNotesBadge } from '@/components/ai-guru/share/TeacherNotesBadge';
import { BadgesPanel } from '@/components/ai-guru/share/BadgesPanel';
import type { BadgeState } from '@/lib/ai-guru/share/badges';
import { Chilli } from '@/components/ai-guru/quiz/Chilli';
import { Toffee } from '@/components/ai-guru/quiz/Toffee';
import { saveProfile } from '@/lib/ai-guru/student/profile';
import { StudentPhotoCard } from '@/components/ai-guru/student/StudentPhotoCard';
import { UpiPayPanel } from '@/components/ai-guru/payments/UpiPayPanel';
import { fetchIfSignedIn } from '@/lib/ai-guru/net/session-hint';
import { adoptAccount, forgetAccountOnDevice, visitorIdOnDevice } from '@/lib/ai-guru/student/device-session';
import { FeeBanner } from '@/components/ai-guru/payments/FeeBanner';
import { KeyNudge } from '@/components/ai-guru/student/KeyNudge';
import { StudentExams } from '@/components/ai-guru/student/StudentExams';

/** V51.9.191: paying by part */
interface PartPlanView { months: string[]; parts: number[]; opened: number[]; allPaid: boolean; trialEnds: string; next: { part: number; amount: number; dueDate: string; month?: string } | null; upfront: { amount: number; saves: number } | null; partPrice: number; total: number }
interface Me {
  ok: boolean; student: PublicStudent; quizId: string; school: { name: string; address: Parameters<typeof formatAddress>[0] };
  fees: { invoices: Array<Invoice & { total: number; paid: number; due: number; status: FeeStatus }>; summary: { billed: number; collected: number; due: number } };
  learning: { sessions: number; toffees: number; chillies: number; chilliesEarned?: number; redeemed?: number; pct: number; weak: Array<{ concept: string; pct: number }>; recent: Array<{ id: string; at: string; correct: number; total: number; toffees: number }> };
  parentCode: string | null;
  access?: (Access & { freeParts: number[]; due: number; fee: number; offer: { monthlyRate: number; monthly: number; yearly: number; twelveMonths: number; yearlyReductionPct: number } | null; partPlan?: PartPlanView }) | null;
  affiliate?: AffiliateInfo;
  rewards?: { badges: BadgeState[]; streak: { current: number; best: number } };
}
const STATUS: Record<FeeStatus, string> = { paid: 'bg-emerald-400/15 text-emerald-300', partial: 'bg-amber-400/15 text-amber-300', pending: 'bg-slate-400/15 text-slate-300', overdue: 'bg-rose-400/15 text-rose-300' };
const inp = 'mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-base text-white outline-none focus:border-cyan-400';

/** Student portal: sign in with the admission number and the PIN the school office gave, then see your own fees, details and progress. */
export default function StudentPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [state, setState] = useState<'loading' | 'out' | 'in'>('loading');
  const [adm, setAdm] = useState('');
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [noId, setNoId] = useState(false); // V51.9.182: "I don't know my Student ID" — ask with name, standard and school
  const [fName, setFName] = useState('');
  const [fStd, setFStd] = useState('');
  const [fSchool, setFSchool] = useState('');
  const [bye, setBye] = useState(false);
  useEffect(() => { const q = new URLSearchParams(window.location.search); const f = q.get('forgot'); if (f) { setForgot(true); setNoId(f === 'id'); } const id = q.get('id'); if (id) { setAdm(id); setFAdm(id); } setBye(q.has('bye')); }, []);
  const [fAdm, setFAdm] = useState('');
  const [fPhone, setFPhone] = useState('');
  const [fMsg, setFMsg] = useState('');
  const asId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('as') : null;

  const load = useCallback(async () => {
    const r = await fetchIfSignedIn(['student', 'admin'], `/api/ai-guru/student-portal/me${asId ? `?as=${encodeURIComponent(asId)}` : ''}`, { cache: 'no-store' });
    if (!r.ok) { setState('out'); return; }
    const j = (await r.json()) as Me;
    setMe(j); setState('in');
    if (!asId) {
      // Tie this browser to the registered student: quizzes, attendance and the MP4 footer now carry the right name and school.
      try {
        adoptAccount({ quizId: j.quizId, name: j.student.name, medium: (j.student as { medium?: string }).medium }); // V51.9.182
        saveProfile({ name: j.student.name, standard: j.student.standard, school: j.student.school ?? '', place: [j.student.address.area, j.student.address.district].filter(Boolean).join(', ') });
      } catch { /* storage blocked: the portal still works */ }
    }
  }, [asId]);
  useEffect(() => { load(); }, [load]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      const r = await fetch('/api/ai-guru/student-portal/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ admissionNo: adm, pin, visitorId: visitorIdOnDevice() }) });
      const lj = await r.json().catch(() => ({}));
      if (r.ok) { setPin(''); adoptAccount({ quizId: lj.quizId, name: lj.name }); if (lj.books === 0) { window.location.href = '/ai-guru/student/library?welcome=1'; return; } await load(); } // V51.9.187: no book yet → My books
      else setErr(r.status === 429 ? (lj.error ?? 'Too many wrong tries. Please wait 15 minutes.') : 'Student ID or password is not right. Check the dashes (ST-12-26). After 5 wrong tries you must wait 15 minutes, so use the box below if you are not sure.');
    } catch { setErr('Could not reach the server.'); } finally { setBusy(false); }
  };
  const askReset = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setFMsg('');
    try {
      const r = await fetch('/api/ai-guru/student-portal/forgot', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(noId ? (fPhone.replace(/\D/g, '').length >= 10 && !(fName.trim() && fStd && fSchool.trim()) ? { guardianPhone: fPhone, byPhone: true } : { guardianPhone: fName, standard: fStd, school: fSchool }) : { admissionNo: fAdm || adm, guardianPhone: fPhone }) });
      setFMsg(r.status === 429 ? 'Too many tries. Please wait 15 minutes.' : 'Thank you. If these details match, the school office has been told — they will give you your Student ID and a new password. Please meet them (or ask your teacher).');
    } catch { setFMsg('Could not reach the server.'); } finally { setBusy(false); }
  };
  // V51.9.182: sign-out also unties this phone (the next child starts as a new visitor, nothing of this one filled in)
  const signOut = async () => { await fetch('/api/ai-guru/student-portal/logout', { method: 'POST' }); forgetAccountOnDevice(); window.location.href = '/ai-guru/student'; }; // reload: the header updates too
  const print = (i: Me['fees']['invoices'][number], p: Invoice['payments'][number]) => {
    if (!me) return; const w = window.open('', '_blank', 'width=640,height=760'); if (!w) return;
    w.document.write(receiptHtml(me.school, me.student, i, p)); w.document.close();
  };

  if (state === 'loading') return <main className="min-h-screen bg-[#06101c] p-8 text-slate-400">Loading…</main>;
  if (state === 'out') return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#06101c] px-4 py-8 text-slate-100">
      {bye && <p role="status" className="mb-3 w-full max-w-sm rounded-2xl border border-emerald-300/40 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100" data-signed-out>✓ You are signed out. The next person can sign in here.</p>}
      <form onSubmit={signIn} className="w-full max-w-sm space-y-4 rounded-3xl border border-white/10 bg-white/[.04] p-6">
        <div className="flex items-center gap-3">{/* eslint-disable-next-line @next/next/no-img-element */}<img src="/aiguru-logo.png" alt="" width={44} height={44} className="h-11 w-11 object-contain" /><div><h1 className="text-xl font-extrabold">Student sign-in</h1><p className="text-sm text-slate-400">Your class, progress and fees</p></div></div>
        <label className="block text-sm font-bold text-slate-200">Student ID (like ST-12-26) or admission number<input className={inp} value={adm} onChange={(e) => setAdm(e.target.value)} autoComplete="username" autoCapitalize="characters" /></label>
        <label className="block text-sm font-bold text-slate-200">Password<input className={inp} type={showPw ? 'text' : 'password'} value={pin} onChange={(e) => setPin(e.target.value)} autoComplete="current-password" /></label>
        <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={showPw} onChange={(e) => setShowPw(e.target.checked)} />Show password</label>
        {err && <p role="alert" className="text-sm text-rose-300">{err}</p>}
        <button disabled={busy || !adm || !pin} className="w-full rounded-xl bg-cyan-400 py-3 font-extrabold text-[#04121f] disabled:opacity-50">{busy ? 'Checking…' : 'Sign in'}</button>
        <p className="text-center text-sm text-slate-400">New here? <a href="/ai-guru/student/signup" className="font-bold text-cyan-300 underline">Create an account</a></p>
        <a href="/ai-guru/classroom" className="block text-center text-sm text-slate-400 underline">Go to a class without signing in</a>
      </form>
      <section aria-label="Forgot password" className="mt-4 w-full max-w-sm rounded-3xl border border-white/10 bg-white/[.03] p-5 text-sm">
        <button type="button" onClick={() => setForgot((v) => !v)} aria-expanded={forgot} className="flex w-full items-center justify-between font-bold text-cyan-300">Forgot your password or Student ID?<span aria-hidden>{forgot ? '−' : '+'}</span></button>
        {forgot && (
          <form onSubmit={askReset} className="mt-3 space-y-3">
            <div className="flex gap-2 text-sm" role="group" aria-label="Do you know your Student ID?">
              <button type="button" onClick={() => setNoId(false)} aria-pressed={!noId} className={`flex-1 rounded-xl border px-3 py-2 font-bold ${!noId ? 'border-cyan-300 bg-cyan-400/15 text-cyan-100' : 'border-white/15 text-slate-300'}`}>I know my Student ID</button>
              <button type="button" onClick={() => setNoId(true)} aria-pressed={noId} className={`flex-1 rounded-xl border px-3 py-2 font-bold ${noId ? 'border-cyan-300 bg-cyan-400/15 text-cyan-100' : 'border-white/15 text-slate-300'}`} data-no-id>I forgot my Student ID too</button>
            </div>
            {noId ? <>
              <p className="text-slate-300">Give your full name, standard and school as you typed them when you signed up — or your parent’s mobile number if you gave it then. The school office will be told and will give you your Student ID and a new password. Please meet them, or ask your teacher.</p>
              <label className="block text-xs font-bold text-slate-300">Full name<input className={inp} value={fName} onChange={(e) => setFName(e.target.value)} autoComplete="name" /></label>
              <label className="block text-xs font-bold text-slate-300">Standard<select className={inp} value={fStd} onChange={(e) => setFStd(e.target.value)}><option value="">Choose…</option>{['LKG', 'UKG', ...Array.from({ length: 12 }, (_, i) => String(i + 1))].map((x) => <option key={x} value={x}>{/^\d+$/.test(x) ? `Std ${x}` : x}</option>)}</select></label>
              <label className="block text-xs font-bold text-slate-300">School<input className={inp} value={fSchool} onChange={(e) => setFSchool(e.target.value)} /></label>
              <label className="block text-xs font-bold text-slate-300">Or: parent’s mobile number given at sign-up<input className={inp} inputMode="tel" value={fPhone} onChange={(e) => setFPhone(e.target.value)} /></label>
            </> : <>
              <p className="text-slate-300">Enter your Student ID and your parent’s mobile number (or your full name). The school office will be told and will give you a new password in person.</p>
              <label className="block text-xs font-bold text-slate-300">Student ID or admission number<input className={inp} value={fAdm || adm} onChange={(e) => setFAdm(e.target.value)} autoCapitalize="characters" /></label>
              <label className="block text-xs font-bold text-slate-300">Parent’s mobile number, or your full name<input className={inp} inputMode="tel" value={fPhone} onChange={(e) => setFPhone(e.target.value)} /></label>
            </>}
            {fMsg && <p role="status" className="text-emerald-300">{fMsg}</p>}
            <button disabled={busy || (noId ? (fName.trim().length < 3 || !fStd || fSchool.trim().length < 2) && fPhone.replace(/\D/g, '').length < 10 : !(fAdm || adm) || fPhone.trim().length < 3)} className="w-full rounded-xl border border-cyan-400/50 py-3 font-extrabold text-cyan-300 disabled:opacity-50">Ask for help signing in</button>
          </form>)}
      </section>
    </main>
  );
  if (!me) return null;
  const s = me.student, f = me.fees, L = me.learning;
  return (
    <main className="min-h-screen bg-[#06101c] px-4 py-6 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex flex-wrap items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/aiguru-logo.png" alt="" width={44} height={44} className="h-11 w-11 object-contain" />
          <StudentPhotoCard name={s.name} photo={s.photo} photoRemoved={s.photoRemoved} asId={asId} onChanged={load} />{/* V51.9.99 */}
          <div><h1 className="text-2xl font-extrabold">{s.name}</h1><p className="text-sm text-slate-400">Std {s.standard}{s.school ? ` · ${s.school}` : ''}{s.admissionNo ? ` · Adm. ${s.admissionNo}` : ''}</p>{s.studentCode && <p className="mt-1 text-base text-slate-200" data-dashboard-id>Student ID <b className="font-mono text-xl text-cyan-300">{s.studentCode}</b> · use it to sign in</p>}</div>
          <div className="ml-auto flex gap-2">
            <a href="/ai-guru/classroom" className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-extrabold text-[#04121f]">Open classroom</a>
            {asId ? <a href="/ai-guru/admin" className="rounded-xl border border-white/15 px-3 py-2 text-xs font-bold">Back to admin</a> : <button onClick={signOut} className="rounded-xl border border-white/15 px-3 py-2 text-xs font-bold">Sign out</button>}
          </div>
        </header>
        {!asId && <RewardCounters studentId={me.quizId} server={{ toffees: L.toffees, chillies: L.chilliesEarned ?? L.chillies ?? 0, redeemed: L.redeemed ?? 0 }} />}
        {me.access?.partPlan && (() => { const pp = me.access.partPlan; const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10); return ( /* V51.9.191: paying by part */
          <section role="status" className="space-y-2 rounded-2xl border border-cyan-300/30 bg-cyan-400/5 p-4 text-sm" data-part-plan>
            <h2 className="text-base font-extrabold">📚 Your parts, month by month</h2>
            <ul className="flex flex-wrap gap-2">
              <li className="rounded-full bg-emerald-400/15 px-3 py-1 font-bold text-emerald-200">Part 1 · {pp.months?.[0]} · free ✓</li>
              {pp.parts.map((p) => <li key={p} title={pp.months?.[p - 1]} className={`rounded-full px-3 py-1 font-bold ${pp.opened.includes(p) ? 'bg-emerald-400/15 text-emerald-200' : pp.next?.part === p ? 'bg-amber-400/15 text-amber-100' : 'bg-white/5 text-slate-400'}`} data-part={p}>Part {p} · {pp.months?.[p - 1]} · {pp.opened.includes(p) ? 'open ✓' : pp.next?.part === p ? `next · ${rupees(pp.next.amount)}` : '🔒'}</li>)}
            </ul>
            {pp.allPaid ? <p className="text-emerald-200">🎉 Every part of every book is open.</p> : <>
              <p className="text-slate-300">🎁 The first month (Part 1) is free for every book.</p>
              {pp.next && <p>Next: <b>Part {pp.next.part}{pp.next.month ? ` (${pp.next.month})` : ''}</b> of every book — <b>{rupees(pp.next.amount)}</b>, {pp.next.dueDate ? <>due <b>{pp.next.dueDate}</b></> : <>pay when you are ready</>}. Paying the month opens Part {pp.next.part} at once.</p>}
              {pp.upfront && <p className="text-cyan-100">Or pay <b>{rupees(pp.upfront.amount)}</b> now for Parts {pp.parts[0]}–{pp.parts[pp.parts.length - 1]} all at once{pp.upfront.saves > 0 ? <> and save <b>{rupees(pp.upfront.saves)}</b></> : null} (instead of {pp.parts.length} × {rupees(pp.partPrice)} = {rupees(pp.total)}).</p>}
              <a href="#pay" className="inline-block rounded-lg bg-emerald-500 px-3 py-1.5 font-extrabold text-[#04121f]">💳 Pay by UPI</a>
            </>}
          </section>); })()}
        {me.access && !me.access.partPlan && (() => { const a = me.access; const pay = a.due > 0 ? rupees(a.due) : a.offer ? `${rupees(a.offer.monthly)} a month, or ${rupees(a.offer.yearly)} for a year in advance${a.offer.yearlyReductionPct ? ` (${a.offer.yearlyReductionPct}% off)` : ''}` : a.fee > 0 ? rupees(a.fee) : ''; return ( /* V51.9.93: free part / enrolment */
          <p role="status" className={`rounded-xl border px-4 py-2 text-sm ${a.full ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' : 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100'}`}>
            {a.status === 'enrolled' && <>✓ You are enrolled{a.paidThrough ? `, paid till ${a.paidThrough}` : a.enrolledOn ? ` since ${a.enrolledOn}` : ''}: every part of every book is open.{a.offer && a.paidThrough ? <> Next payment: {rupees(a.offer.monthly)} a month, or {rupees(a.offer.yearly)} for a year{a.offer.yearlyReductionPct ? ` (save ${a.offer.yearlyReductionPct}%)` : ''}.</> : null}</>}
            {a.status === 'lapsed' && <>{a.paidThrough ? <>Your paid period ended on <b>{a.paidThrough}</b>, so Parts 2–10 are locked again.</> : <>Your grace period is over, so Parts 2–10 are locked again.</>} Pay {pay ? <b>{pay}</b> : 'the fee'} by UPI (below) or at the school office with your Student ID <b className="font-mono">{s.studentCode}</b> to open them.</>}
            {a.status === 'pilot' && <>✓ Your centre’s free pilot (until {a.pilotUntil}): every part is open.</>}
            {a.status === 'free' && <>🎁 <b>Free trial:</b> {a.freeParts.length ? `Part ${a.freeParts.join(', ')}` : 'the free part'} of every book, with whiteboard notes, MCQ and revision. To open every part, pay {pay ? <b>{pay}</b> : 'the fee'} by UPI (below) or at the school office with your Student ID <b className="font-mono">{s.studentCode}</b>.</>}
          </p>); })()}
        {typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('welcome') && <p role="status" className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200">Welcome to AI Guru, {s.name.split(' ')[0]}! Your Student ID is <b className="font-mono">{s.studentCode}</b>. Write it down: you sign in with it and your password.</p>}
        {asId && <p className="rounded-xl border border-amber-300/30 bg-amber-400/10 px-4 py-2 text-sm text-amber-200">Admin view of this student. Nothing is changed on this device.</p>}

        {/* V51.9.182 (newcomer re-check): the class (or the box to join one) comes before fees and badges */}
        {!asId && <MyClassPanel />}
        {!asId && <StudentExams />}
        {!asId && <FeeBanner payHref="#pay" />}
        {!asId && <KeyNudge place="account" />}
        {/* V51.9.183: pay by UPI here (the office confirms) — or at the school office as before */}
        {!asId && <UpiPayPanel />}
        <section aria-label="Fees" className="space-y-3">
          <h2 className="text-lg font-extrabold">My fees</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {([['Billed', rupees(f.summary.billed), ''], ['Paid', rupees(f.summary.collected), 'text-emerald-300'], ['Still to pay', rupees(f.summary.due), f.summary.due > 0 ? 'text-amber-300' : 'text-emerald-300']] as const).map(([l, v, c]) => <div key={l} className="rounded-2xl border border-white/10 bg-white/[.04] p-4"><div className="text-xs font-bold uppercase tracking-wider text-slate-400">{l}</div><div className={`mt-1 text-3xl font-black ${c}`}>{v}</div></div>)}
          </div>
          {f.invoices.length === 0 ? <p className="text-slate-400">No fees have been billed yet.</p> : f.invoices.map((i) => (
            <div key={i.id} className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
              <div className="flex flex-wrap items-center gap-2"><b>{i.term}</b><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS[i.status]}`}>{i.status}</span>{i.dueDate && <span className="text-xs text-slate-400">due {i.dueDate}</span>}<span className="ml-auto font-extrabold">{rupees(i.due)} <span className="text-xs font-normal text-slate-400">of {rupees(i.total)} to pay</span></span></div>
              <div className="mt-2 text-xs text-slate-300">{i.items.map((x) => `${x.name} ${rupees(x.amount)}`).join(' · ')}{i.discount ? ` · discount ${rupees(i.discount)}` : ''}</div>
              {i.payments.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{i.payments.map((p) => <button key={p.id} onClick={() => print(i, p)} className="rounded-lg border border-white/15 px-2 py-1 text-xs text-cyan-300 hover:bg-white/5">Receipt {p.receiptNo} · {rupees(p.amount)} · {p.date}</button>)}</div>}
            </div>))}
          <p className="text-xs text-slate-500">Pay by UPI above: your payment shows here and your receipt comes to Messages once it is confirmed.</p>
        </section>

        <section aria-label="Progress" className="space-y-3">
          <h2 className="text-lg font-extrabold">My learning</h2>
          {L.sessions === 0 ? <p className="text-slate-400">No quiz yet. Take a quiz in the classroom: a right answer earns a toffee, a wrong one a chilli.</p> : (
            <>
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4"><div className="text-xs font-bold uppercase tracking-wider text-slate-400">Quizzes</div><div className="mt-1 text-3xl font-black">{L.sessions}</div></div>
                <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4"><div className="text-xs font-bold uppercase tracking-wider text-slate-400">Average</div><div className="mt-1 text-3xl font-black">{L.pct}%</div></div>
                <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4"><div className="text-xs font-bold uppercase tracking-wider text-slate-400">Toffees</div><div className="mt-1 flex items-center gap-2 text-3xl font-black text-amber-300"><Toffee size={34} />{L.toffees}</div></div>
                <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4"><div className="text-xs font-bold uppercase tracking-wider text-slate-400">Chillies</div><div className="mt-1 flex items-center gap-2 text-3xl font-black text-rose-300"><Chilli size={34} />{L.chillies ?? 0}</div></div>
              </div>
              {L.weak.length > 0 && <p className="rounded-2xl border border-amber-300/30 bg-amber-400/10 p-4 text-sm text-slate-200"><b className="text-amber-200">Practise a little more: </b>{L.weak.map((w) => `${w.concept} (${w.pct}%)`).join(' · ')}</p>}
            </>)}
        </section>

        {me.rewards && <BadgesPanel badges={me.rewards.badges} streak={me.rewards.streak} name={s.name} school={s.school || me.school.name} />}

        <a href="/ai-guru/lab3d" className="mt-5 flex items-center gap-3 rounded-2xl border border-violet-400/30 bg-violet-400/10 p-4 font-extrabold hover:border-violet-300"><span className="text-2xl">🧊</span><span>3D Lab<span className="block text-sm font-normal text-slate-300">Turn solids, build atoms, watch the planets</span></span></a>
        <a href="/ai-guru/teacher-notes" className="mt-5 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[.04] p-4 font-extrabold hover:border-cyan-400"><span>📘 Teachers Notes<TeacherNotesBadge /></span><span className="text-xs font-bold text-cyan-300">Open →</span></a>
        <a href="/ai-guru/student/library" className="flex items-center gap-3 rounded-2xl border border-emerald-400/25 bg-emerald-400/5 p-4 hover:border-emerald-400/50">{/* V51.9.95 */}
          <span className="text-3xl">📥</span><span><b className="block">Download your study materials</b><span className="text-sm text-slate-400">Your textbooks with whiteboard notes, MCQ and revision — or create them.</span></span><span className="ml-auto text-cyan-300">→</span></a>
        <a href={`/ai-guru/student/paper${s.standard ? `?std=${encodeURIComponent(s.standard)}` : ''}`} className="flex items-center gap-3 rounded-2xl border border-amber-400/25 bg-amber-400/5 p-4 hover:border-amber-400/50">{/* V51.9.98 */}
          <span className="text-3xl">📄</span><span><b className="block">Ask about your paper</b><span className="text-sm text-slate-400">Show your notes, homework or question paper to the camera and ask your doubt.</span></span><span className="ml-auto text-cyan-300">→</span></a>
        {me.affiliate && <AffiliatePanel info={me.affiliate} admin={!!asId} />}

        <section aria-label="Details" className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4 text-sm"><h2 className="mb-2 font-extrabold">My details</h2><p>Guardian: {s.guardianName || '—'}{s.guardianPhone ? ` · ${s.guardianPhone}` : ''}</p><p className="mt-1 text-slate-300">{formatAddress(s.address) || 'Address not recorded yet'}</p>{s.coupon && <p className="mt-2 text-xs text-emerald-300">Coupon {s.coupon} is on your account: its discount comes off your fee bills.</p>}<p className="mt-2 text-xs text-slate-500">Something wrong? Tell the school office to correct it.</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4 text-sm"><h2 className="mb-2 font-extrabold">For my parents</h2>{me.parentCode ? <><p className="text-slate-300">Give this code in the Parent portal to see your quiz reports:</p><p className="mt-2 font-mono text-2xl font-black tracking-widest text-cyan-300">{me.parentCode}</p></> : <p className="text-slate-400">Your parent code appears after your first quiz.</p>}</div>
        </section>
      </div>
    </main>
  );
}
