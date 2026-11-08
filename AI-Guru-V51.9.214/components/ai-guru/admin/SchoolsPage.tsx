'use client';
/**
 * V51.9.193 — 🏫 Schools (office): contracted schools on their own page and record.
 *  • Add a school → its school ID (SC-…) and its own terms: school %, teacher %, students' discount %.
 *  • Teachers who signed up with the school ID: approve, switch off, new password; their students, exams and edits.
 *  • The school's students; the schools' commission account (separate from the ordinary invite commission), paid out
 *    to the school and to each teacher; and every teacher's activity (materials made / edited / removed, exams).
 */
import { useCallback, useEffect, useState } from 'react';
import { fetchIfSignedIn } from '@/lib/ai-guru/net/session-hint';

type Terms = { schoolPct: number; teacherPct: number; studentDiscountPct: number };
interface Teacher { id: string; code: string; name: string; phone: string; email: string; subject: string; standards: string[]; status: string; students: number; exams: number; edits: number; commission: { earned: number; pending: number }; createdAt: string }
interface Line { id: string; date: string; receiptNo: string; student: string; teacher: string; teacherId?: string; paid: number; schoolAmount: number; teacherAmount: number; payoutDate: string; schoolPaidOn?: string; teacherPaidOn?: string }
interface School { id: string; code: string; name: string; place: string; district: string; state: string; syllabus: string; contactName: string; contactPhone: string; email: string; terms: Terms; active: boolean; teachers: Teacher[]; exams?: Array<{ id: string; title: string; subject: string; standard: string; teacher: string; opens: string; closes: string; questions: number; results: Array<{ student: string; score: number; total: number; late: boolean; at: string }> }>; students: Array<{ id: string; studentCode: string; name: string; standard: string; teacher: string; joined: string }>; account: { fees: number; schoolEarned: number; schoolPending: number; teachersEarned: number; teachersPending: number }; commissions: Line[] }
interface Data { schools: School[]; log: Array<{ id: string; at: string; schoolId: string; teacherId: string; teacher: string; action: string; what: string }>; defaults: Terms; syllabi: Array<[string, string]> }

const inp = 'mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400';
const btn = 'rounded-xl bg-cyan-400 px-4 py-2 text-sm font-extrabold text-[#04121f] disabled:opacity-50';
const ghost = 'rounded-lg border border-white/15 px-2.5 py-1 text-xs font-bold text-slate-200 hover:bg-white/5 disabled:opacity-50';
const lab = 'block text-xs font-bold text-slate-300';
const inr = (n: number) => `₹${(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const blank = (t: Terms) => ({ id: '', name: '', place: '', district: '', state: 'Kerala', syllabus: 'kerala', contactName: '', contactPhone: '', email: '', terms: t, active: true });

export function SchoolsPage() {
  const [d, setD] = useState<Data | null>(null);
  const [form, setForm] = useState<ReturnType<typeof blank> | null>(null);
  const [open, setOpen] = useState('');
  const [note, setNote] = useState<{ ok: boolean; text: string; href?: string } | null>(null);
  const [logFor, setLogFor] = useState('');
  const call = (body: unknown) => fetch('/api/ai-guru/admin/schools', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json()).catch(() => ({ ok: false, error: 'Could not reach the server' }));
  const load = useCallback(async () => {
    const r = await fetchIfSignedIn(['admin'], '/api/ai-guru/admin/schools', { cache: 'no-store' });
    if (r.status === 401 || r.status === 404) { window.location.href = '/ai-guru/admin'; return; }
    const j = await r.json().catch(() => null); if (j?.ok) setD(j);
  }, []);
  useEffect(() => { void load(); }, [load]);
  if (!d) return <main className="min-h-screen bg-[#06101c] p-8 text-slate-400">Loading…</main>;
  const say = (ok: boolean, text: string) => setNote({ ok, text });
  const saveSchool = async () => { if (!form) return; const j = await call({ action: 'school', school: form }); say(!!j.ok, j.ok ? `Saved. School ID: ${j.school.code} — give it to the school; teachers sign up with it, students join with it.` : j.error); if (j.ok) { setForm(null); setOpen(j.school.id); await load(); } };
  const teacher = async (id: string, status: 'active' | 'off') => { const j = await call({ action: 'teacher', id, status }); if (j.ok && j.tell?.whatsapp) setNote({ ok: true, text: 'Teacher approved: they can sign in now. Tell them:', href: j.tell.whatsapp }); else say(!!j.ok, j.ok ? (status === 'active' ? 'Teacher approved: they can sign in now. (No phone number to message them: please tell them yourself.)' : 'Teacher switched off.') : j.error); await load(); };
  const password = async (t: Teacher) => { if (!window.confirm(`Make a new password for ${t.name}?`)) return; const j = await call({ action: 'password', id: t.id }); say(!!j.ok, j.ok ? `New password for ${t.name} (${j.code}): ${j.password} — give it to them; it is shown only now.` : j.error); };
  const paid = async (ids: string[], who: 'school' | 'teacher', label: string) => { if (!ids.length || !window.confirm(`Mark ${label} as paid today?`)) return; const j = await call({ action: 'paid', ids, who }); say(!!j.ok, j.ok ? `${j.marked} line(s) marked paid.` : j.error); await load(); };
  const totals = d.schools.reduce((a, s) => ({ fees: a.fees + s.account.fees, school: a.school + s.account.schoolPending, teacher: a.teacher + s.account.teachersPending, students: a.students + s.students.length }), { fees: 0, school: 0, teacher: 0, students: 0 });

  return (
    <main className="min-h-screen bg-[#06101c] px-4 py-6 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-wrap items-center gap-3"><a href="/ai-guru/admin" className="text-xs text-slate-400">← Office</a><h1 className="text-2xl font-extrabold">🏫 Schools </h1>
          <button className={`${btn} ml-auto`} onClick={() => setForm(blank(d.defaults))} data-school-add>＋ Add a school</button></header>
        <p className="text-sm text-slate-400">{d.schools.length} schools · {totals.students} students · fees {inr(totals.fees)} · to pay: schools {inr(totals.school)}, teachers {inr(totals.teacher)}. Separate from the ordinary invite commission, which school students still earn as usual.</p>
        {note && <p role="status" className={`rounded-xl border px-3 py-2 text-sm ${note.ok ? 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100' : 'border-rose-300/30 bg-rose-400/10 text-rose-100'}`}>{note.text}{note.href && <> <a href={note.href} target="_blank" rel="noreferrer" className="font-bold underline" data-approve-whatsapp>💬 Send on WhatsApp</a></>}</p>}

        {form && <section className="space-y-3 rounded-2xl border border-cyan-300/30 bg-cyan-400/5 p-4" data-school-form>
          <h2 className="text-lg font-extrabold">{form.id ? 'Edit school' : 'Add a school'}</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className={`${lab} sm:col-span-2`}>School name<input className={inp} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-school-name /></label>
            <label className={lab}>Syllabus<select className={inp} value={form.syllabus} onChange={(e) => setForm({ ...form, syllabus: e.target.value })}><option value="">Any</option>{d.syllabi.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            <label className={lab}>Place<input className={inp} value={form.place} onChange={(e) => setForm({ ...form, place: e.target.value })} /></label>
            <label className={lab}>District<input className={inp} value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} /></label>
            <label className={lab}>State<input className={inp} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></label>
            <label className={lab}>Contact person<input className={inp} value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></label>
            <label className={lab}>Phone<input className={inp} value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} /></label>
            <label className={lab}>E-mail<input className={inp} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          </div>
          <fieldset className="grid gap-3 rounded-xl border border-white/10 p-3 sm:grid-cols-3"><legend className="px-1 text-xs font-bold text-cyan-200">This school’s terms (of every fee its students pay)</legend>
            <label className={lab}>School’s commission %<input type="number" min={0} max={60} step={0.5} className={inp} value={form.terms.schoolPct} onChange={(e) => setForm({ ...form, terms: { ...form.terms, schoolPct: Number(e.target.value) } })} data-school-pct /></label>
            <label className={lab}>Teacher’s commission %<input type="number" min={0} max={60} step={0.5} className={inp} value={form.terms.teacherPct} onChange={(e) => setForm({ ...form, terms: { ...form.terms, teacherPct: Number(e.target.value) } })} /><span className="font-normal text-slate-500">To the teacher whose ID the student joined with.</span></label>
            <label className={lab}>Students’ discount %<input type="number" min={0} max={60} step={0.5} className={inp} value={form.terms.studentDiscountPct} onChange={(e) => setForm({ ...form, terms: { ...form.terms, studentDiscountPct: Number(e.target.value) } })} /><span className="font-normal text-slate-500">Off the part fees, for students who join with the school or teacher ID.</span></label>
          </fieldset>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />Active (teachers can sign up and sign in; students can join)</label>
          <div className="flex gap-2"><button className={btn} onClick={() => void saveSchool()} data-school-save>Save</button><button className={ghost} onClick={() => setForm(null)}>Cancel</button></div>
        </section>}

        {d.schools.length === 0 && !form && <p className="text-slate-400">No school yet. Add one: it gets a school ID that its teachers sign up with and its students join with.</p>}
        {d.schools.map((s) => { const isOpen = open === s.id; const pendS = s.commissions.filter((c) => !c.schoolPaidOn && c.schoolAmount > 0).map((c) => c.id); return (
          <article key={s.id} className={`rounded-2xl border p-4 ${s.active ? 'border-white/10 bg-white/[.04]' : 'border-white/5 bg-white/[.02] opacity-70'}`} data-school={s.code}>
            <div className="flex flex-wrap items-center gap-2">
              <button className="text-left" onClick={() => setOpen(isOpen ? '' : s.id)}><b className="text-lg">{s.name}</b> <span className="font-mono text-cyan-300">{s.code}</span><span className="block text-xs text-slate-400">{[s.place, s.district, s.state].filter(Boolean).join(', ')} · {s.teachers.length} teachers ({s.teachers.filter((t) => t.status === 'pending').length} waiting) · {s.students.length} students · school {s.terms.schoolPct}% · teacher {s.terms.teacherPct}% · discount {s.terms.studentDiscountPct}%{s.active ? '' : ' · inactive'}</span></button>
              <span className="ml-auto text-right text-xs">fees {inr(s.account.fees)}<br />to pay: school <b className="text-amber-200">{inr(s.account.schoolPending)}</b> · teachers <b className="text-amber-200">{inr(s.account.teachersPending)}</b></span>
              <button className={ghost} onClick={() => setForm({ id: s.id, name: s.name, place: s.place, district: s.district, state: s.state, syllabus: s.syllabus, contactName: s.contactName, contactPhone: s.contactPhone, email: s.email, terms: s.terms, active: s.active })}>Edit</button>
            </div>
            {isOpen && <div className="mt-4 space-y-4">
              <section><h3 className="font-extrabold">Teachers</h3>
                {s.teachers.length === 0 ? <p className="text-sm text-slate-400">No teacher yet. Teachers sign up at /ai-guru/school-teacher/join with the school ID {s.code}.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead><tr className="text-left text-xs text-slate-400"><th>Teacher</th><th>Subject · Std</th><th>Status</th><th>Students</th><th>Exams</th><th>Edits</th><th>Commission (to pay)</th><th /></tr></thead>
                  <tbody>{s.teachers.map((t) => { const pendT = s.commissions.filter((c) => c.teacherId === t.id && !c.teacherPaidOn && c.teacherAmount > 0).map((c) => c.id); return <tr key={t.id} className="border-t border-white/10" data-teacher={t.status}>
                    <td className="py-1.5"><b>{t.name}</b> <span className="font-mono text-xs text-cyan-300">{t.code}</span><span className="block text-xs text-slate-400">{t.phone}{t.email ? ` · ${t.email}` : ''}</span></td>
                    <td>{t.subject} · {t.standards.join(', ')}</td>
                    <td>{t.status === 'pending' ? <span className="text-amber-200">waiting</span> : t.status === 'active' ? <span className="text-emerald-300">active</span> : 'off'}</td>
                    <td>{t.students}</td><td>{t.exams}</td><td><button className="underline" onClick={() => setLogFor(t.id)}>{t.edits}</button></td>
                    <td>{inr(t.commission.earned)} ({inr(t.commission.pending)})</td>
                    <td className="space-x-1 whitespace-nowrap">{t.status !== 'active' && <button className={ghost} onClick={() => void teacher(t.id, 'active')} data-approve>{t.status === 'pending' ? 'Approve' : 'Switch on'}</button>}{t.status === 'active' && <button className={ghost} onClick={() => void teacher(t.id, 'off')}>Switch off</button>}<button className={ghost} onClick={() => void password(t)}>New password</button>{pendT.length > 0 && <button className={ghost} onClick={() => void paid(pendT, 'teacher', `${t.name}’s ${inr(t.commission.pending)}`)}>Paid {inr(t.commission.pending)}</button>}</td>
                  </tr>; })}</tbody></table></div>}
              </section>
              <section><div className="flex flex-wrap items-center gap-2"><h3 className="font-extrabold">Commission account</h3>{pendS.length > 0 && <button className={ghost} onClick={() => void paid(pendS, 'school', `the school’s ${inr(s.account.schoolPending)}`)}>School paid {inr(s.account.schoolPending)}</button>}</div>
                {s.commissions.length === 0 ? <p className="text-sm text-slate-400">No fee paid by this school’s students yet.</p> : <div className="max-h-72 overflow-auto"><table className="w-full min-w-[820px] text-sm"><thead><tr className="text-left text-xs text-slate-400"><th>Date</th><th>Student</th><th>Receipt</th><th>Fee</th><th>School</th><th>Teacher</th><th>Payout</th></tr></thead>
                  <tbody>{s.commissions.map((c) => <tr key={c.id} className="border-t border-white/10"><td>{c.date}</td><td>{c.student}</td><td className="font-mono text-xs">{c.receiptNo}</td><td>{inr(c.paid)}</td><td>{inr(c.schoolAmount)} {c.schoolPaidOn ? <span className="text-emerald-300">✓ {c.schoolPaidOn}</span> : ''}</td><td>{c.teacher ? <>{c.teacher}: {inr(c.teacherAmount)} {c.teacherPaidOn ? <span className="text-emerald-300">✓ {c.teacherPaidOn}</span> : ''}</> : '—'}</td><td>{c.payoutDate}</td></tr>)}</tbody></table></div>}
              </section>
              <section data-school-exams><h3 className="font-extrabold">Exams and results ({s.exams?.length ?? 0})</h3>
                {!s.exams?.length ? <p className="text-sm text-slate-400">No exam yet. Teachers set exams from their own page.</p> : <ul className="space-y-2 text-sm">{s.exams.map((e) => (
                  <li key={e.id} className="rounded-xl border border-white/10 p-2"><b>{e.title}</b> <span className="text-slate-400">· {e.subject} Std {e.standard} · {e.teacher} · {e.opens} to {e.closes} · {e.questions} questions · {e.results.length} handed in</span>
                    {e.results.length > 0 && <div className="mt-1 flex flex-wrap gap-1.5">{e.results.map((r, k) => <span key={k} className="rounded-full bg-white/5 px-2 py-0.5 text-xs">{r.student}: <b>{r.score}/{r.total}</b>{r.late ? ' (late)' : ''}</span>)}</div>}</li>))}</ul>}
              </section>
              <section><h3 className="font-extrabold">Students ({s.students.length})</h3>
                {s.students.length === 0 ? <p className="text-sm text-slate-400">Students join with the school ID {s.code} or a teacher’s ID in the code box at sign-up.</p> : <div className="max-h-60 overflow-auto"><table className="w-full text-sm"><tbody>{s.students.map((x) => <tr key={x.id} className="border-t border-white/10"><td className="py-1">{x.name}</td><td className="font-mono text-xs">{x.studentCode}</td><td>Std {x.standard}</td><td className="text-xs text-slate-400">{x.teacher || '—'}</td><td className="text-xs text-slate-400">{x.joined}</td></tr>)}</tbody></table></div>}
              </section>
            </div>}
          </article>); })}

        <section className="space-y-2 rounded-2xl border border-white/10 bg-white/[.03] p-4" data-teacher-log>
          <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-extrabold">Teachers’ activity</h2>
            <select className={`${inp} mt-0 ml-auto max-w-xs`} value={logFor} onChange={(e) => setLogFor(e.target.value)}><option value="">Every teacher</option>{d.schools.flatMap((s) => s.teachers.map((t) => <option key={t.id} value={t.id}>{t.name} · {s.name}</option>))}</select></div>
          <ul className="max-h-96 space-y-1 overflow-y-auto text-sm">{d.log.filter((e) => !logFor || e.teacherId === logFor).map((e) => <li key={e.id} className="border-b border-white/5 py-1"><span className="text-xs text-slate-400">{new Date(e.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</span> · <b>{e.teacher}</b> · {e.what}</li>)}</ul>
        </section>
      </div>
    </main>
  );
}
