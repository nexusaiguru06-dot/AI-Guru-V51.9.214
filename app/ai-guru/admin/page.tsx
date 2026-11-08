'use client';
import { useCallback, useEffect, useState } from 'react';
import { ClassesTab } from '@/components/ai-guru/admin/ClassesTab';
import { AffiliatesTab } from '@/components/ai-guru/admin/AffiliatesTab';
import { EnrolmentTab } from '@/components/ai-guru/admin/EnrolmentTab';
import { UpiTab } from '@/components/ai-guru/admin/UpiTab';
import { RegistersMenu } from '@/components/ai-guru/admin/RegisterPage';
import { LibraryTab } from '@/components/ai-guru/admin/LibraryTab';
import { MessagesTab } from '@/components/ai-guru/admin/MessagesTab';
import { AddressForm } from '@/components/ai-guru/admin/AddressForm';
import { PhotoEditor } from '@/components/ai-guru/student/PhotoEditor';
import { emptyAddress, formatAddress, type Address } from '@/lib/ai-guru/admin/address';
import { receiptHtml } from '@/lib/ai-guru/admin/receipt';
import { dashboardStats, invoiceDue, invoicePaid, invoiceStatus, invoiceTotal, rupees, summarise, type FeeHead, type FeeStatus, type Invoice, type PublicStudent as Student } from '@/lib/ai-guru/admin/fees';
import { fetchIfSignedIn } from '@/lib/ai-guru/net/session-hint';

type Tab = 'overview' | 'messages' | 'students' | 'library' | 'enrolment' | 'plans' | 'upi' | 'fees' | 'coupons' | 'affiliates' | 'classes' | 'settings';
const api = async (path: string, body?: unknown, method = body ? 'POST' : 'GET') => {
  const r = await (path === 'login' ? fetch : (u: string, i: RequestInit) => fetchIfSignedIn(['admin'], u, i))(`/api/ai-guru/admin/${path}`, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  const j = await r.json().catch(() => ({}));
  return { ok: !!j.ok, status: r.status, j };
};
const inp = 'mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400';
const btn = 'rounded-lg bg-cyan-400 px-4 py-2 text-sm font-extrabold text-[#04121f] disabled:opacity-50';
const ghost = 'rounded-lg border border-white/15 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/5';
const STATUS: Record<FeeStatus, string> = { paid: 'bg-emerald-400/15 text-emerald-300', partial: 'bg-amber-400/15 text-amber-300', pending: 'bg-slate-400/15 text-slate-300', overdue: 'bg-rose-400/15 text-rose-300' };
const today = () => new Date().toISOString().slice(0, 10);
const blankStudent = (): Partial<Student> => ({ name: '', standard: '', school: '', admissionNo: '', guardianName: '', guardianPhone: '', address: emptyAddress() });

/** Admin portal. In the Portals menu as “New Schools”; the sign-in box of any portal also opens it for the admin's username and password. */
export default function AdminPage() {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');
  // V51.9.185: /ai-guru/admin?tab=fees opens that tab (from the Fees due page's "Record payment")
  useEffect(() => { const t = new URLSearchParams(window.location.search).get('tab'); if (t) setTab(t as Tab); }, []);
  const [students, setStudents] = useState<Student[]>([]);
  const [pinRequests, setPinRequests] = useState<Array<{ studentId: string; at: string }>>([]);
  const [heads, setHeads] = useState<FeeHead[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [school, setSchool] = useState<{ name: string; address: Address }>({ name: '', address: emptyAddress() });
  const [envLogin, setEnvLogin] = useState(false);
  const [needsCoupon, setNeedsCoupon] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const say = (ok: boolean, text: string) => setNote({ ok, text });
  // V51.9.153: unread messages for the office (tab badge)
  const [msgUnread, setMsgUnread] = useState(0);
  // V51.9.183: UPI payments waiting for the office to check (tab badge)
  const [upiWaiting, setUpiWaiting] = useState(0);
  useEffect(() => { fetchIfSignedIn(['admin'], '/api/ai-guru/admin/upi', { cache: 'no-store' }).then((r) => r.json()).then((j) => { if (j?.ok) setUpiWaiting(j.waiting); }).catch(() => undefined); }, [tab]);
  useEffect(() => { const go = () => fetchIfSignedIn(['admin'], '/api/ai-guru/admin/messages?status=open', { cache: 'no-store' }).then((r) => r.json()).then((j) => { if (j?.ok) setMsgUnread(j.unread); }).catch(() => undefined); go(); const id = setInterval(go, 30000); return () => clearInterval(id); }, []);

  const [signedOut, setSignedOut] = useState(false);
  const load = useCallback(async () => {
    const [s, f, c] = await Promise.all([api('students'), api('fees'), api('settings')]);
    if (!s.ok) { setSignedOut(true); return; } // V51.9.195: not signed in as the office → the office sign-in form (not the classroom)
    setSignedOut(false);
    setStudents(s.j.students); setPinRequests(s.j.pinRequests ?? []); setHeads(f.j.heads); setInvoices(f.j.invoices); setSchool(c.j.school); setEnvLogin(!!c.j.envLogin); setNeedsCoupon(!!c.j.signupNeedsCoupon); setReady(true);
  }, []);
  useEffect(() => { load(); }, [load]);

  if (signedOut) return <OfficeSignIn onDone={() => void load()} />;
  if (!ready) return <main className="min-h-screen bg-[#06101c] p-8 text-slate-400">Loading…</main>;
  const sum = summarise(invoices);
  const ds = dashboardStats(students, invoices);
  const nameOf = (id: string) => students.find((s) => s.id === id);
  const signOut = async () => { await api('logout', {}); window.location.href = '/ai-guru'; };

  return (
    <main className="min-h-screen bg-[#06101c] px-4 py-6 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-5 flex flex-wrap items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/aiguru-logo.png" alt="" width={44} height={44} className="h-11 w-11 object-contain" />
          <div><h1 className="text-2xl font-extrabold">New Schools</h1><p className="text-sm text-slate-400">{school.name || 'Students, addresses and fees'}</p></div>
          <a href="/ai-guru/admin/lesson-plans" className={`${ghost} ml-auto`} data-admin-lesson-plans>🧠 Lesson plans</a>
          <a href="/ai-guru/admin/schools" className={ghost} data-admin-schools>🏫 Schools</a>
          <a href="/ai-guru/admin/settings" className={ghost} data-admin-settings>⚙ Settings</a>
          <button onClick={signOut} className={ghost}>Sign out</button>
        </header>
        {/* V51.9.184: Students management — the four registers, each its own page with country / state / district / school / teacher filters */}
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-cyan-300/20 bg-cyan-400/5 p-3" data-students-management>
          <span className="text-sm font-extrabold text-cyan-100">📋 Students management</span>
          <RegistersMenu />
        </div>
        <nav className="mb-6 flex flex-wrap gap-2" aria-label="Admin portal">
          {([['overview', 'Overview'], ['messages', `💬 Messages${msgUnread ? ` (${msgUnread})` : ''}`], ['students', `Students & addresses (${students.length})${pinRequests.length ? ` · 🔑 ${pinRequests.length} forgot password` : ''}`], ['library', 'Study materials'], ['enrolment', 'Free part & enrolment'], ['upi', `💳 UPI payments${upiWaiting ? ` (${upiWaiting} to check)` : ''}`], ['fees', 'Fees'], ['coupons', 'Coupons'], ['affiliates', 'Affiliates'], ['classes', 'Classes & centres'], ['settings', 'Settings']] as const).map(([id, label]) => (
            <button key={id} onClick={() => { setTab(id); setNote(null); }} aria-current={tab === id ? 'page' : undefined} className={`rounded-full px-4 py-2 text-sm font-extrabold ${tab === id ? 'bg-cyan-400 text-[#04121f]' : 'border border-white/15 text-slate-200 hover:bg-white/5'}`}>{label}</button>
          ))}
        </nav>
        {note && <p role="status" className={`mb-4 rounded-xl border px-4 py-2 text-sm ${note.ok ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' : 'border-rose-400/30 bg-rose-400/10 text-rose-200'}`}>{note.text}</p>}

        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {([['Students', String(students.length)], ['Billed', rupees(sum.billed)], ['Collected', rupees(sum.collected)], ['Still due', rupees(sum.due)]] as const).map(([l, v]) => <div key={l} className="rounded-2xl border border-white/10 bg-white/[.04] p-4"><div className="text-xs font-bold uppercase tracking-wider text-slate-400">{l}</div><div className="mt-1 text-3xl font-black">{v}</div></div>)}
            </div>
            <div className="flex flex-wrap gap-2">{(Object.keys(STATUS) as FeeStatus[]).map((k) => <span key={k} className={`rounded-full px-3 py-1 text-sm font-bold ${STATUS[k]}`}>{k}: {sum.byStatus[k]}</span>)}{sum.overdue > 0 && <span className="rounded-full bg-rose-400/15 px-3 py-1 text-sm font-bold text-rose-300">overdue amount {rupees(sum.overdue)}</span>}</div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card title="Fees by standard" note="collected · still due">
                {ds.byStandard.length === 0 ? <Empty /> : ds.byStandard.map((r) => { const t = r.collected + r.due || 1; return (
                  <div key={r.standard} className="mb-2"><div className="mb-1 flex justify-between text-xs text-slate-300"><b>Std {r.standard}</b><span>{rupees(r.collected)} · <span className="text-amber-300">{rupees(r.due)}</span></span></div>
                    <div className="flex h-3 overflow-hidden rounded-full bg-white/10" role="img" aria-label={`Std ${r.standard}: ${rupees(r.collected)} collected, ${rupees(r.due)} due`}><div className="bg-emerald-400" style={{ width: `${(r.collected / t) * 100}%` }} /><div className="bg-amber-400/80" style={{ width: `${(r.due / t) * 100}%` }} /></div></div>); })}
              </Card>
              <Card title="Collected each month" note="last 6 months">
                <div className="flex h-40 items-end gap-3" role="img" aria-label="Fees collected in each of the last six months">
                  {ds.monthly.map((m) => { const mx = Math.max(1, ...ds.monthly.map((x) => x.amount)); return (
                    <div key={m.month} className="flex flex-1 flex-col items-center justify-end gap-1"><span className="text-[10px] text-slate-300">{m.amount ? rupees(m.amount) : ''}</span><div className="flex h-28 w-full items-end"><div className="w-full rounded-t-lg bg-cyan-400/80" style={{ height: `${Math.max(m.amount ? 6 : 2, (m.amount / mx) * 100)}%` }} /></div><span className="text-[10px] text-slate-400">{new Date(`${m.month}-01T00:00:00Z`).toLocaleString('en', { month: 'short', timeZone: 'UTC' })}</span></div>); })}
                </div>
              </Card>
              <Card title="Students by district" note={ds.missingAddress ? `${ds.missingAddress} without a full address` : 'all addresses complete'}>
                {ds.byDistrict.length === 0 ? <Empty /> : ds.byDistrict.slice(0, 8).map((r) => (
                  <div key={r.district} className="mb-1.5 flex items-center gap-2 text-xs"><span className="w-28 shrink-0 truncate text-slate-300">{r.district}</span><div className="h-2.5 flex-1 rounded-full bg-white/10"><div className="h-full rounded-full bg-violet-400" style={{ width: `${(r.count / ds.byDistrict[0].count) * 100}%` }} /></div><b className="w-6 text-right">{r.count}</b></div>))}
              </Card>
              <Card title="Latest receipts" note="newest first">
                {ds.recent.length === 0 ? <Empty text="No payments yet." /> : ds.recent.map((p) => (
                  <div key={p.id} className="mb-1.5 flex items-center gap-2 text-sm"><span className="font-bold">{nameOf(p.studentId)?.name ?? '—'}</span><span className="text-xs text-slate-400">{p.receiptNo} · {p.date} · {p.mode}</span><span className="ml-auto font-extrabold text-emerald-300">{rupees(p.amount)}</span></div>))}
              </Card>
            </div>
            <section><h2 className="mb-2 text-lg font-extrabold">Who owes the most</h2>
              <div className="space-y-2">{invoices.filter((i) => invoiceDue(i) > 0).sort((a, b) => invoiceDue(b) - invoiceDue(a)).slice(0, 8).map((i) => <div key={i.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.04] px-4 py-2 text-sm"><b>{nameOf(i.studentId)?.name ?? '—'}</b><span className="text-slate-400">Std {nameOf(i.studentId)?.standard} · {i.term}</span><span className="ml-auto font-extrabold text-amber-300">{rupees(invoiceDue(i))}</span></div>)}
                {!invoices.some((i) => invoiceDue(i) > 0) && <p className="text-slate-400">Nothing is due.</p>}</div></section>
          </div>
        )}

        {tab === 'messages' && <MessagesTab say={say} />}
        {tab === 'students' && <StudentsTab students={students} pinRequests={pinRequests} invoices={invoices} say={say} reload={load} />}
        {tab === 'library' && <LibraryTab say={say} />}
        {tab === 'enrolment' && <EnrolmentTab say={say} />}
        {/* V51.9.194: no monthly / yearly plans — fees are paid by part (⚙ Settings → Free trial & part fees) */}
        {tab === 'upi' && <UpiTab say={say} />}
        {tab === 'fees' && <FeesTab students={students} heads={heads} invoices={invoices} school={school} say={say} reload={load} />}
        {tab === 'coupons' && <CouponsTab say={say} />}
        {tab === 'affiliates' && <AffiliatesTab say={say} />}
        {tab === 'classes' && <ClassesTab say={say} />}
        {tab === 'settings' && <SettingsTab school={school} envLogin={envLogin} needsCoupon={needsCoupon} say={say} reload={load} />}
      </div>
    </main>
  );
}

function Card({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-white/10 bg-white/[.04] p-4"><div className="mb-3 flex items-baseline gap-2"><h2 className="font-extrabold">{title}</h2>{note && <span className="ml-auto text-xs text-slate-400">{note}</span>}</div>{children}</section>;
}
const Empty = ({ text = 'Nothing to show yet.' }: { text?: string }) => <p className="text-sm text-slate-400">{text}</p>;

function StudentsTab({ students, pinRequests, invoices, say, reload }: { students: Student[]; pinRequests: Array<{ studentId: string; at: string }>; invoices: Invoice[]; say: (ok: boolean, t: string) => void; reload: () => Promise<void> }) {
  const [form, setForm] = useState<Partial<Student> | null>(null);
  const [q, setQ] = useState('');
  const [stF, setStF] = useState('');
  const [diF, setDiF] = useState('');
  const [scF, setScF] = useState('');
  const [pinShown, setPinShown] = useState<{ name: string; adm: string; pin: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [photoFor, setPhotoFor] = useState<Student | null>(null); // V51.9.99
  const photoUrl = (s: Student) => (s.photo ? `/api/ai-guru/admin/students/photo?id=${encodeURIComponent(s.id)}&v=${encodeURIComponent(s.photo.at)}` : null);
  const f = form;
  const save = async () => {
    setBusy(true);
    const r = f?.id ? await api('students', { student: f }, 'PUT') : await api('students', { student: f });
    setBusy(false);
    if (!r.ok) return say(false, r.j.error ?? 'Could not save');
    say(true, 'Saved'); setForm(null); await reload();
  };
  const remove = async (s: Student) => {
    if (!confirm(`Delete ${s.name} and their unpaid invoices?`)) return;
    const r = await api(`students?id=${encodeURIComponent(s.id)}`, undefined, 'DELETE');
    say(r.ok, r.ok ? 'Deleted' : r.j.error ?? 'Could not delete'); await reload();
  };
  const setPin = async (s: Student) => {
    if (s.hasLogin && !confirm(`Make a new password for ${s.name}? The old one stops working.`)) return;
    const r = await api('students', { action: 'setPin', id: s.id });
    if (!r.ok) return say(false, r.j.error ?? 'Could not set the password');
    setPinShown({ name: s.name, adm: s.studentCode ?? s.admissionNo, pin: r.j.pin }); await reload();
  };
  const setReferrer = async (s: Student) => { // V51.9.92: e.g. a friend's referral that came in through the office
    const cur = s.referredBy ? students.find((x) => x.id === s.referredBy)?.referralCode ?? '' : '';
    const code = prompt(`Friend's or class code that brought ${s.name} in (empty = no friend):`, cur);
    if (code === null) return;
    const r = await api('students', { action: 'setReferrer', id: s.id, code });
    say(r.ok, r.ok ? (code.trim() ? `${s.name} is now linked to code ${code.trim().toUpperCase()}. New fee bills get its discount; commission counts from the next payment.` : `${s.name} has no referring friend now.`) : r.j.error ?? 'Could not save'); await reload();
  };
  const clearPin = async (s: Student) => { const r = await api('students', { action: 'clearPin', id: s.id }); say(r.ok, r.ok ? `${s.name} can no longer sign in` : r.j.error ?? 'Could not do that'); await reload(); };
  const importQuiz = async () => {
    const r = await fetch('/api/ai-guru/progress?role=teacher', { cache: 'no-store' }).then((x) => x.json()).catch(() => null);
    const list = (r?.students ?? []).map((s: { studentId: string; name: string }) => ({ quizId: s.studentId, name: s.name }));
    const a = await api('students', { action: 'import', students: list });
    say(a.ok, a.ok ? `${a.j.added} student(s) added from the quiz results. Fill in their standard and address.` : 'Could not import'); await reload();
  };
  // State / district filter: only places that have students are listed, each with its count.
  const count = (pred: (s: Student) => boolean) => students.filter(pred).length;
  const states = [...new Set(students.map((s) => s.address.state).filter(Boolean))].sort();
  const districts = [...new Set(students.filter((s) => !stF || s.address.state === stF).map((s) => s.address.district).filter(Boolean))].sort();
  const schools = [...new Set(students.map((s) => s.school || '').filter(Boolean))].sort();
  const shown = students.filter((s) => `${s.name} ${s.standard} ${s.admissionNo}`.toLowerCase().includes(q.toLowerCase()) && (!stF || s.address.state === stF) && (!diF || s.address.district === diF) && (!scF || (scF === '__none' ? !s.school : s.school === scF)));
  if (f) return (
    <div className="max-w-3xl space-y-4">
      <h2 className="text-lg font-extrabold">{f.id ? 'Edit student' : 'New student'}</h2>
      <datalist id="school-list">{[...new Set(students.map((x) => x.school).filter(Boolean))].map((x) => <option key={x} value={x} />)}</datalist>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold text-slate-300">Name<input className={inp} value={f.name ?? ''} onChange={(e) => setForm({ ...f, name: e.target.value })} /></label>
        <label className="text-xs font-bold text-slate-300">Standard<input className={inp} value={f.standard ?? ''} onChange={(e) => setForm({ ...f, standard: e.target.value })} placeholder="e.g. 8" /></label>
        <label className="text-xs font-bold text-slate-300">School<input className={inp} list="school-list" value={f.school ?? ''} onChange={(e) => setForm({ ...f, school: e.target.value })} placeholder="Name of school" /></label>
        <label className="text-xs font-bold text-slate-300">Admission number<input className={inp} value={f.admissionNo ?? ''} onChange={(e) => setForm({ ...f, admissionNo: e.target.value })} /></label>
        <label className="text-xs font-bold text-slate-300">Parent / guardian<input className={inp} value={f.guardianName ?? ''} onChange={(e) => setForm({ ...f, guardianName: e.target.value })} /></label>
        <label className="text-xs font-bold text-slate-300">Guardian mobile<input className={inp} inputMode="tel" value={f.guardianPhone ?? ''} onChange={(e) => setForm({ ...f, guardianPhone: e.target.value })} /></label>
      </div>
      <AddressForm legend="Home address" value={f.address ?? emptyAddress()} onChange={(a) => setForm({ ...f, address: a })} />
      <div className="flex gap-2"><button disabled={busy} onClick={save} className={btn}>Save</button><button onClick={() => setForm(null)} className={ghost}>Cancel</button></div>
    </div>
  );
  return (
    <div className="space-y-4">
      {pinShown && (
        <div role="dialog" aria-modal="true" aria-label="Student PIN" className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-sm space-y-3 rounded-2xl border border-white/15 bg-[#0a1a2b] p-5 text-center">
            <h3 className="font-extrabold">{pinShown.name}</h3>
            <p className="text-sm text-slate-300">Student ID <b>{pinShown.adm}</b></p>
            <p className="font-mono text-4xl font-black tracking-[.3em] text-cyan-300">{pinShown.pin}</p>
            <p className="text-xs text-amber-200">Give this password to the student now and ask them to keep it safe. It is stored scrambled and cannot be shown again; make a new one if it is lost.</p>
            <button className={btn} onClick={() => setPinShown(null)}>Done</button>
          </div></div>)}
      {pinRequests.length > 0 && (
        <div role="status" className="space-y-2 rounded-2xl border border-amber-300/30 bg-amber-400/10 p-4"><b className="text-amber-200">Students who forgot their password</b>
          {pinRequests.map((r) => { const st = students.find((x) => x.id === r.studentId); return st ? <div key={r.studentId} className="flex flex-wrap items-center gap-3 text-sm"><span className="font-bold">{st.name}</span><span className="text-xs text-slate-300">ID {st.studentCode ?? st.admissionNo} · asked {new Date(r.at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span><button onClick={() => setPin(st)} className="ml-auto rounded-lg bg-cyan-400 px-3 py-1 text-xs font-extrabold text-[#04121f]">Make new password</button></div> : null; })}
        </div>)}
      <div className="flex flex-wrap gap-2"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, standard, admission no." aria-label="Search students" className={`${inp} mt-0 max-w-xs`} /><button onClick={() => setForm(blankStudent())} className={btn}>+ Add student</button><button onClick={importQuiz} className={ghost}>Import from quiz results</button></div>
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Filter by state" value={stF} onChange={(e) => { setStF(e.target.value); setDiF(''); }} className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"><option value="">All states ({students.length})</option>{states.map((x) => <option key={x} value={x}>{x} ({count((s) => s.address.state === x)})</option>)}</select>
        <select aria-label="Filter by district" value={diF} onChange={(e) => setDiF(e.target.value)} className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"><option value="">All districts</option>{districts.map((x) => <option key={x} value={x}>{x} ({count((s) => s.address.district === x && (!stF || s.address.state === stF))})</option>)}</select>
        <select aria-label="Filter by school" value={scF} onChange={(e) => setScF(e.target.value)} className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"><option value="">All schools</option>{schools.map((x) => <option key={x} value={x}>{x} ({count((s) => s.school === x)})</option>)}{count((s) => !s.school) > 0 && <option value="__none">No school set ({count((s) => !s.school)})</option>}</select>
        {(stF || diF || scF) && <button onClick={() => { setStF(''); setDiF(''); setScF(''); }} className={ghost}>Clear filter</button>}
        <span className="text-xs text-slate-400">Showing {shown.length} of {students.length}{count((s) => !s.address.district) > 0 && ` · ${count((s) => !s.address.district)} without a district`}</span>
      </div>
      {shown.length === 0 ? <p className="text-slate-400">No students yet. Add one, or import the students who have taken quizzes.</p> : (
        <div className="overflow-x-auto rounded-2xl border border-white/10"><table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-wider text-slate-400"><tr><th className="p-3">Student</th><th>Std</th><th>School</th><th>Guardian</th><th>Address</th><th>Fees due</th><th>Login</th><th /></tr></thead>
          <tbody>{shown.map((s) => { const due = invoices.filter((i) => i.studentId === s.id).reduce((a, i) => a + invoiceDue(i), 0); const addr = formatAddress(s.address); return (
            <tr key={s.id} className="border-t border-white/10 align-top">
              <td className="p-3 font-bold"><button onClick={() => setPhotoFor(s)} className="float-left mr-3 mt-0.5" title={s.photo ? `Photo${s.photo.onReels ? ' — shown on reels' : ''}` : 'Add a photo'}>{photoUrl(s)
                ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={photoUrl(s)!} alt="" className={`h-10 w-10 rounded-full object-cover ${s.photo?.onReels ? 'ring-2 ring-cyan-400' : 'ring-1 ring-white/30'}`} />
                : <span className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-white/25 text-sm text-slate-500">📷</span>}</button>{s.name}{s.source === 'self' && <span className="ml-2 rounded-full bg-violet-400/15 px-2 py-0.5 text-[10px] font-bold text-violet-300">self sign-up</span>}<div className="text-xs font-normal text-slate-400">{[s.studentCode, s.admissionNo && `Adm. ${s.admissionNo}`, s.coupon && `coupon ${s.coupon}`].filter(Boolean).join(' · ')}</div>{s.referredBy && <div className="text-xs font-normal text-cyan-200">Friend: {students.find((x) => x.id === s.referredBy)?.name ?? '(removed)'}</div>}</td><td>{s.standard || '—'}</td><td className="max-w-[10rem] text-xs text-slate-300">{s.school || <span className="text-amber-300">Not set</span>}</td>
              <td>{s.guardianName || '—'}<div className="text-xs text-slate-400">{s.guardianPhone}</div></td>
              <td className="max-w-xs text-xs text-slate-300">{addr || <span className="text-amber-300">Address missing</span>}</td>
              <td className={due > 0 ? 'font-extrabold text-amber-300' : 'text-slate-400'}>{rupees(due)}</td>
              <td className="whitespace-nowrap text-xs">{s.hasLogin ? <span className="text-emerald-300">✓ set</span> : <span className="text-slate-500">not set</span>}<div className="mt-1 space-x-2"><button onClick={() => setPin(s)} className="text-cyan-300 underline">{s.hasLogin ? 'New password' : 'Make password'}</button>{s.hasLogin && <><button onClick={() => clearPin(s)} className="text-slate-400 hover:text-rose-300">Block</button><a href={`/ai-guru/student?as=${encodeURIComponent(s.id)}`} className="text-slate-300 underline">View</a></>}</div></td>
              <td className="space-x-2 whitespace-nowrap p-3"><button onClick={() => setForm(s)} className={ghost}>Edit</button><button onClick={() => setReferrer(s)} className={ghost} title="Who brought this student in: a friend's code or a class code">Referred by…</button><button onClick={() => remove(s)} className={ghost}>Delete</button></td>
            </tr>); })}</tbody></table></div>)}
      {photoFor && (
        <PhotoEditor who="admin" name={photoFor.name} current={photoUrl(photoFor)} prefs={{ onReels: !!photoFor.photo?.onReels, guardianOk: !!photoFor.photo?.guardianOk }}
          onSave={async (image, prefs) => { const r = await api('students/photo', { id: photoFor.id, ...(image ? { image } : {}), ...prefs }); if (!r.ok) return r.j.error ?? 'Could not save the photo'; say(true, 'Photo saved'); await reload(); }}
          onRemove={async () => { const r = await api(`students/photo?id=${encodeURIComponent(photoFor.id)}`, undefined, 'DELETE'); if (!r.ok) return r.j.error ?? 'Could not remove'; say(true, 'Photo removed'); await reload(); }}
          onClose={() => setPhotoFor(null)} />
      )}
    </div>
  );
}

function FeesTab({ students, heads, invoices, school, say, reload }: { students: Student[]; heads: FeeHead[]; invoices: Invoice[]; school: { name: string; address: Address }; say: (ok: boolean, t: string) => void; reload: () => Promise<void> }) {
  const [head, setHead] = useState({ name: '', amount: '', standard: 'all' });
  const [gen, setGen] = useState({ standard: '', term: '', dueDate: '' });
  const [one, setOne] = useState({ studentId: '', term: '', dueDate: '', discount: '' });
  const [pay, setPay] = useState<{ inv: Invoice; amount: string; date: string; mode: string; note: string } | null>(null);
  const [filter, setFilter] = useState<'all' | FeeStatus>('all');
  const nameOf = (id: string) => students.find((s) => s.id === id);
  const run = async (action: string, body: Record<string, unknown>, ok: (j: Record<string, unknown>) => string) => {
    const r = await api('fees', { action, ...body });
    say(r.ok, r.ok ? ok(r.j) : r.j.error ?? 'Could not do that'); if (r.ok) await reload(); return r;
  };
  const standards = [...new Set(students.map((s) => s.standard).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const receipt = (i: Invoice, p: Invoice['payments'][number]) => {
    const w = window.open('', '_blank', 'width=640,height=760'); if (!w) return say(false, 'Allow pop-ups to print the receipt');
    w.document.write(receiptHtml(school, nameOf(i.studentId), i, p));
    w.document.close();
  };
  const list = invoices.filter((i) => filter === 'all' || invoiceStatus(i) === filter);
  return (
    <div className="space-y-8">
      <section className="space-y-3"><h2 className="text-lg font-extrabold">Fee heads</h2>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-bold text-slate-300">Name<input className={`${inp} w-44`} value={head.name} onChange={(e) => setHead({ ...head, name: e.target.value })} placeholder="Tuition" /></label>
          <label className="text-xs font-bold text-slate-300">Amount ₹<input className={`${inp} w-28`} inputMode="decimal" value={head.amount} onChange={(e) => setHead({ ...head, amount: e.target.value })} /></label>
          <label className="text-xs font-bold text-slate-300">Standard<input className={`${inp} w-24`} value={head.standard} onChange={(e) => setHead({ ...head, standard: e.target.value })} placeholder="all or 8" /></label>
          <button className={btn} onClick={async () => { const r = await run('head', { head }, () => 'Fee head saved'); if (r.ok) setHead({ name: '', amount: '', standard: 'all' }); }}>Add</button>
        </div>
        <div className="flex flex-wrap gap-2">{heads.map((h) => <span key={h.id} className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[.04] px-3 py-1 text-sm">{h.name} · {rupees(h.amount)} · {h.standard === 'all' ? 'all' : `Std ${h.standard}`}<button aria-label={`Remove ${h.name}`} onClick={() => run('removeHead', { id: h.id }, () => 'Removed')} className="text-slate-400 hover:text-rose-300">×</button></span>)}{!heads.length && <p className="text-sm text-slate-400">Add the fee heads first (Tuition, Exam, Transport…).</p>}</div>
      </section>
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3 rounded-2xl border border-white/10 p-4"><h2 className="font-extrabold">Bill a whole standard</h2>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs font-bold text-slate-300">Standard<select className={`${inp} w-24`} value={gen.standard} onChange={(e) => setGen({ ...gen, standard: e.target.value })}><option value="">—</option>{standards.map((s) => <option key={s}>{s}</option>)}</select></label>
            <label className="text-xs font-bold text-slate-300">Term<input className={`${inp} w-40`} value={gen.term} onChange={(e) => setGen({ ...gen, term: e.target.value })} placeholder="Term 1 2026-27" /></label>
            <label className="text-xs font-bold text-slate-300">Due date<input type="date" className={`${inp} w-40`} value={gen.dueDate} onChange={(e) => setGen({ ...gen, dueDate: e.target.value })} /></label>
            <button className={btn} onClick={() => run('generate', gen, (j) => `${j.created} invoice(s) created`)}>Create invoices</button>
          </div></div>
        <div className="space-y-3 rounded-2xl border border-white/10 p-4"><h2 className="font-extrabold">Bill one student</h2>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs font-bold text-slate-300">Student<select className={`${inp} w-48`} value={one.studentId} onChange={(e) => setOne({ ...one, studentId: e.target.value })}><option value="">—</option>{students.map((s) => <option key={s.id} value={s.id}>{s.name} (Std {s.standard || '?'})</option>)}</select></label>
            <label className="text-xs font-bold text-slate-300">Term<input className={`${inp} w-36`} value={one.term} onChange={(e) => setOne({ ...one, term: e.target.value })} /></label>
            <label className="text-xs font-bold text-slate-300">Discount ₹<input className={`${inp} w-24`} inputMode="decimal" value={one.discount} onChange={(e) => setOne({ ...one, discount: e.target.value })} /></label>
            <label className="text-xs font-bold text-slate-300">Due date<input type="date" className={`${inp} w-40`} value={one.dueDate} onChange={(e) => setOne({ ...one, dueDate: e.target.value })} /></label>
            <button className={btn} onClick={() => run('invoice', one, () => 'Invoice created')}>Create</button>
          </div></div>
      </section>
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2"><h2 className="mr-2 text-lg font-extrabold">Invoices</h2>
          {(['all', 'pending', 'partial', 'overdue', 'paid'] as const).map((s) => <button key={s} onClick={() => setFilter(s)} aria-pressed={filter === s} className={`rounded-full px-3 py-1 text-xs font-bold ${filter === s ? 'bg-cyan-400 text-[#04121f]' : 'border border-white/15 text-slate-300'}`}>{s}</button>)}
          <a href="/api/ai-guru/admin/fees?format=csv" className={`${ghost} ml-auto`}>⬇ Fee register (CSV)</a></div>
        {list.length === 0 ? <p className="text-slate-400">No invoices here.</p> : (
          <div className="overflow-x-auto rounded-2xl border border-white/10"><table className="w-full min-w-[780px] text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-wider text-slate-400"><tr><th className="p-3">Student</th><th>Term</th><th>Total</th><th>Paid</th><th>Due</th><th>Status</th><th /></tr></thead>
            <tbody>{list.map((i) => { const st = invoiceStatus(i); return (
              <tr key={i.id} className="border-t border-white/10 align-top">
                <td className="p-3 font-bold">{nameOf(i.studentId)?.name ?? '—'}<div className="text-xs font-normal text-slate-400">Std {nameOf(i.studentId)?.standard}</div></td>
                <td>{i.term}{i.dueDate && <div className="text-xs text-slate-400">due {i.dueDate}</div>}</td><td>{rupees(invoiceTotal(i))}</td><td>{rupees(invoicePaid(i))}</td><td className="font-extrabold">{rupees(invoiceDue(i))}</td>
                <td><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS[st]}`}>{st}</span></td>
                <td className="space-y-1 p-3 text-right">
                  {st !== 'paid' && <button onClick={() => setPay({ inv: i, amount: String(invoiceDue(i)), date: today(), mode: 'cash', note: '' })} className={ghost}>Record payment</button>}
                  {i.payments.map((p) => <div key={p.id}><button onClick={() => receipt(i, p)} className="text-xs text-cyan-300 underline">{p.receiptNo} · {rupees(p.amount)}</button></div>)}
                  {!i.payments.length && <button onClick={() => run('removeInvoice', { id: i.id }, () => 'Invoice removed')} className="text-xs text-slate-400 hover:text-rose-300">Remove</button>}
                </td></tr>); })}</tbody></table></div>)}
      </section>
      {pay && (
        <div role="dialog" aria-modal="true" aria-label="Record payment" className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-sm space-y-3 rounded-2xl border border-white/15 bg-[#0a1a2b] p-5">
            <h3 className="font-extrabold">Payment · {nameOf(pay.inv.studentId)?.name}</h3><p className="text-sm text-slate-400">{pay.inv.term} · due {rupees(invoiceDue(pay.inv))}</p>
            <label className="block text-xs font-bold text-slate-300">Amount ₹<input className={inp} inputMode="decimal" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} /></label>
            <label className="block text-xs font-bold text-slate-300">Date<input type="date" className={inp} value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })} /></label>
            <label className="block text-xs font-bold text-slate-300">Mode<select className={inp} value={pay.mode} onChange={(e) => setPay({ ...pay, mode: e.target.value })}>{['cash', 'upi', 'card', 'bank', 'cheque'].map((m) => <option key={m}>{m}</option>)}</select></label>
            <label className="block text-xs font-bold text-slate-300">Note (optional)<input className={inp} value={pay.note} onChange={(e) => setPay({ ...pay, note: e.target.value })} /></label>
            <div className="flex gap-2"><button className={btn} onClick={async () => { const r = await run('pay', { invoiceId: pay.inv.id, amount: pay.amount, date: pay.date, mode: pay.mode, note: pay.note }, (j) => `Receipt ${(j.payment as { receiptNo: string }).receiptNo} recorded`); if (r.ok) setPay(null); }}>Record</button><button className={ghost} onClick={() => setPay(null)}>Cancel</button></div>
            {/* V51.9.191: a part-plan bill, before any part is paid: the whole plan at the all-at-once price */}
            {(pay.inv as Invoice & { partBill?: { part?: number } }).partBill?.part && !invoices.some((x) => x.studentId === pay.inv.studentId && (x as Invoice & { partBill?: unknown }).partBill && x.payments.length) && <button className={ghost} data-parts-upfront onClick={async () => { const r = await run('partsUpfront', { studentId: pay.inv.studentId, date: pay.date, mode: pay.mode, note: pay.note }, (j) => `All parts paid at once · receipt ${(j.payment as { receiptNo: string }).receiptNo}`); if (r.ok) setPay(null); }}>Instead: all remaining parts at once (the all-at-once price)</button>}
          </div></div>)}
    </div>
  );
}

function SettingsTab({ school, envLogin, needsCoupon, say, reload }: { school: { name: string; address: Address }; envLogin: boolean; needsCoupon: boolean; say: (ok: boolean, t: string) => void; reload: () => Promise<void> }) {
  const [s, setS] = useState(school);
  const [pw, setPw] = useState({ current: '', next: '', username: '' });
  return (
    <div className="max-w-3xl space-y-8">
      <section className="space-y-3"><h2 className="text-lg font-extrabold">School</h2>
        <label className="block text-xs font-bold text-slate-300">School name<input className={inp} value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} /></label>
        <AddressForm legend="School address (printed on receipts)" value={s.address} onChange={(a) => setS({ ...s, address: a })} />
        <button className={btn} onClick={async () => { const r = await api('settings', { school: s }); say(r.ok, r.ok ? 'School details saved' : r.j.error ?? 'Could not save'); if (r.ok) await reload(); }}>Save school</button></section>
      <section className="space-y-3"><h2 className="text-lg font-extrabold">Student sign-up</h2>
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={needsCoupon} onChange={async (e) => { const r = await api('settings', { signupNeedsCoupon: e.target.checked }); say(r.ok, r.ok ? (e.target.checked ? 'Sign-up now needs a coupon code' : 'Anyone can sign up (a coupon is optional)') : 'Could not save'); await reload(); }} />Students must have a valid coupon code to sign up</label>
        <p className="text-xs text-slate-400">Sign-up page: <code>/ai-guru/student/signup</code>. Make coupon codes in the Coupons tab.</p></section>
      <section className="space-y-3"><h2 className="text-lg font-extrabold">Admin sign-in</h2>
        {envLogin ? <p className="text-sm text-slate-400">The admin username and password are set by ADMIN_USERNAME and ADMIN_PASSWORD in the server settings. Change them there.</p> : (
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-bold text-slate-300">New username (optional)<input className={inp} autoComplete="off" value={pw.username} onChange={(e) => setPw({ ...pw, username: e.target.value })} /></label>
            <label className="text-xs font-bold text-slate-300">Current password<input type="password" autoComplete="current-password" className={inp} value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></label>
            <label className="text-xs font-bold text-slate-300">New password (10+ characters)<input type="password" autoComplete="new-password" className={inp} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></label>
            <div><button className={btn} onClick={async () => { const r = await api('settings', { password: pw }); say(r.ok, r.ok ? 'Sign-in changed' : r.j.error ?? 'Could not change'); if (r.ok) setPw({ current: '', next: '', username: '' }); }}>Change sign-in</button></div>
          </div>)}
      </section>
    </div>
  );
}


interface CouponRow { code: string; kind: 'percent' | 'flat'; value: number; maxUses?: number; used: number; expires?: string; note?: string; active: boolean }
function CouponsTab({ say }: { say: (ok: boolean, t: string) => void }) {
  const [list, setList] = useState<CouponRow[]>([]);
  const [users, setUsers] = useState<Record<string, number>>({});
  const [c, setC] = useState({ code: '', kind: 'percent', value: '', maxUses: '', expires: '', note: '' });
  const load = useCallback(async () => { const r = await api('coupons'); if (r.ok) { setList(r.j.coupons); setUsers(r.j.students); } }, []);
  useEffect(() => { load(); }, [load]);
  const add = async () => { const r = await api('coupons', { coupon: c }); say(r.ok, r.ok ? `Coupon ${r.j.coupon.code} saved` : r.j.error ?? 'Could not save'); if (r.ok) { setC({ code: '', kind: 'percent', value: '', maxUses: '', expires: '', note: '' }); await load(); } };
  const gen = () => setC({ ...c, code: Array.from({ length: 8 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('') });
  return (
    <div className="space-y-6">
      <section className="space-y-3"><h2 className="text-lg font-extrabold">New coupon</h2>
        <p className="text-sm text-slate-400">A student types the code when signing up. A percentage coupon takes that much off every fee bill; a rupee coupon takes it off the first bill.</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-bold text-slate-300">Code<div className="flex gap-1"><input className={`${inp} w-36 font-mono uppercase`} value={c.code} onChange={(e) => setC({ ...c, code: e.target.value })} /><button type="button" onClick={gen} className={`${ghost} mt-1`}>Make one</button></div></label>
          <label className="text-xs font-bold text-slate-300">Kind<select className={`${inp} w-32`} value={c.kind} onChange={(e) => setC({ ...c, kind: e.target.value })}><option value="percent">% off</option><option value="flat">₹ off</option></select></label>
          <label className="text-xs font-bold text-slate-300">Value<input className={`${inp} w-24`} inputMode="decimal" value={c.value} onChange={(e) => setC({ ...c, value: e.target.value })} /></label>
          <label className="text-xs font-bold text-slate-300">Max uses<input className={`${inp} w-24`} inputMode="numeric" value={c.maxUses} onChange={(e) => setC({ ...c, maxUses: e.target.value })} placeholder="no limit" /></label>
          <label className="text-xs font-bold text-slate-300">Expires<input type="date" className={`${inp} w-40`} value={c.expires} onChange={(e) => setC({ ...c, expires: e.target.value })} /></label>
          <label className="text-xs font-bold text-slate-300">Note<input className={`${inp} w-44`} value={c.note} onChange={(e) => setC({ ...c, note: e.target.value })} placeholder="e.g. Open day 2026" /></label>
          <button className={btn} onClick={add}>Save coupon</button>
        </div></section>
      <section className="space-y-3"><h2 className="text-lg font-extrabold">Coupons</h2>
        {list.length === 0 ? <p className="text-slate-400">No coupons yet.</p> : (
          <div className="overflow-x-auto rounded-2xl border border-white/10"><table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-wider text-slate-400"><tr><th className="p-3">Code</th><th>Gives</th><th>Used</th><th>Expires</th><th>Note</th><th>Status</th><th /></tr></thead>
            <tbody>{list.map((k) => (
              <tr key={k.code} className="border-t border-white/10"><td className="p-3 font-mono font-bold">{k.code}</td><td>{k.kind === 'percent' ? `${k.value}% off` : `${rupees(k.value)} off`}</td><td>{k.used}{k.maxUses ? ` / ${k.maxUses}` : ''}{users[k.code] ? ` · ${users[k.code]} student(s)` : ''}</td><td>{k.expires ?? '—'}</td><td className="text-xs text-slate-300">{k.note ?? ''}</td>
                <td><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${k.active ? 'bg-emerald-400/15 text-emerald-300' : 'bg-slate-400/15 text-slate-400'}`}>{k.active ? 'on' : 'off'}</span></td>
                <td className="space-x-2 p-3 text-right"><button className={ghost} onClick={async () => { await api('coupons', { action: 'toggle', code: k.code }); await load(); }}>{k.active ? 'Switch off' : 'Switch on'}</button>{k.used === 0 && <button className={ghost} onClick={async () => { const r = await api(`coupons?code=${k.code}`, undefined, 'DELETE'); say(r.ok, r.ok ? 'Deleted' : r.j.error); await load(); }}>Delete</button>}</td></tr>))}</tbody></table></div>)}
      </section>
    </div>
  );
}

/** V51.9.195 (review) — the school office signs in here; a student is sent to their own sign-in. */
function OfficeSignIn({ onDone }: { onDone: () => void }) {
  const [u, setU] = useState(''), [p, setP] = useState(''), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false);
  const go = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg('');
    const r = await fetch('/api/ai-guru/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: u, password: p }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (j.ok) onDone(); else setMsg(r?.status === 429 ? 'Too many wrong tries. Please wait 15 minutes.' : 'The office username or password is not right.');
  };
  const field = 'mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm font-normal text-white outline-none focus:border-cyan-400';
  return (
    <main className="grid min-h-screen place-items-center bg-[#06101c] px-4 text-slate-100">
      <form onSubmit={go} className="w-full max-w-sm space-y-3 rounded-2xl border border-white/10 bg-white/[.04] p-6" data-office-signin>
        <h1 className="text-xl font-extrabold">🏫 New Schools sign-in</h1>
        <p className="text-xs text-slate-400">For the AI Guru office and new schools being set up. Students sign in on <a className="underline" href="/ai-guru/student">My account</a>; school teachers on <a className="underline" href="/ai-guru/school-teacher">their page</a>.</p>
        <label className="block text-xs font-bold text-slate-300">Office username<input value={u} onChange={(e) => setU(e.target.value)} autoComplete="username" autoCapitalize="none" className={field} /></label>
        <label className="block text-xs font-bold text-slate-300">Password<input type="password" value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" className={field} /></label>
        {msg && <p role="alert" className="text-xs text-rose-300">{msg}</p>}
        <button disabled={busy || !u || !p} className="w-full rounded-xl bg-cyan-400 py-2.5 text-sm font-extrabold text-[#04121f] disabled:opacity-50">{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </main>
  );
}
