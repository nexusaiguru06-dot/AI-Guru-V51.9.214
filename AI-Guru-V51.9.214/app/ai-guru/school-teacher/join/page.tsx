'use client';
/** V51.9.193 — a teacher of a contracted school signs up with the school ID, their subject and their standards. */
import { useState } from 'react';
import { STANDARDS, SUBJECTS } from '@/lib/ai-guru/schools/rules';

const inp = 'mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-base text-white outline-none focus:border-cyan-400';

export default function JoinPage() {
  const [f, setF] = useState({ schoolCode: '', name: '', phone: '', email: '', subject: '', standards: [] as string[], password: '', confirm: '' });
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ code: string; school: string; subject: string; standards: string[] } | null>(null);
  const send = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    const r = await fetch('/api/ai-guru/school-teacher/signup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(f) }).then((x) => x.json()).catch(() => ({ ok: false, error: 'Could not reach the server' }));
    setBusy(false);
    if (r.ok) setDone({ code: r.teacher.code, school: r.school.name, subject: r.teacher.subject, standards: r.teacher.standards }); else setErr(r.error);
  };
  return (
    <main className="min-h-screen bg-[#06101c] text-slate-100">
      <div className="mx-auto max-w-xl space-y-4 px-4 py-6">
        <h1 className="text-2xl font-extrabold">Teacher sign-up <span className="block text-sm font-normal text-slate-400">For teachers of a school that works with AI Guru</span></h1>
        {done ? (
          <section className="space-y-3 rounded-2xl border border-emerald-300/40 bg-emerald-400/10 p-5 text-center" data-teacher-done>
            <p className="text-sm">Your teacher ID</p>
            <p className="font-mono text-4xl font-extrabold text-emerald-200" data-teacher-code>{done.code}</p>
            <p className="text-sm">{done.school} · {done.subject} · Std {done.standards.join(', ')}</p>
            <p className="text-sm text-amber-100">Write it down. You can sign in once the school office approves you. Your students join with this ID.</p>
            <a href="/ai-guru/school-teacher" className="inline-block rounded-xl bg-cyan-400 px-4 py-2 font-extrabold text-[#04121f]">Go to sign in</a>
          </section>
        ) : (
          <form onSubmit={send} className="space-y-3 rounded-2xl border border-white/10 bg-white/[.04] p-5" data-teacher-join>
            <label className="block text-sm font-bold">School ID <span className="font-normal text-slate-400">(from your school office, e.g. SC-1-26)</span><input className={`${inp} font-mono uppercase`} value={f.schoolCode} onChange={(e) => setF({ ...f, schoolCode: e.target.value })} required /></label>
            <label className="block text-sm font-bold">Your name<input className={inp} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-bold">Phone / WhatsApp<input className={inp} inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} required /></label>
              <label className="block text-sm font-bold">E-mail <span className="font-normal text-slate-400">(optional)</span><input className={inp} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
            </div>
            <label className="block text-sm font-bold">Your subject<select className={inp} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} required><option value="">Choose…</option>{SUBJECTS.map((s) => <option key={s}>{s}</option>)}</select></label>
            <fieldset><legend className="text-sm font-bold">Standards you teach this subject</legend>
              <div className="mt-1 flex flex-wrap gap-2">{STANDARDS.map((s) => { const on = f.standards.includes(s); return <button key={s} type="button" aria-pressed={on} onClick={() => setF({ ...f, standards: on ? f.standards.filter((x) => x !== s) : [...f.standards, s] })} className={`min-w-[3rem] rounded-full px-3 py-1.5 text-sm font-bold ${on ? 'bg-cyan-400 text-[#04121f]' : 'border border-white/15 text-slate-300'}`}>Std {s}</button>; })}</div></fieldset>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-bold">Password<input className={inp} type="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required /></label>
              <label className="block text-sm font-bold">Password again<input className={inp} type="password" autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} required /></label>
            </div>
            <button className="w-full rounded-xl bg-cyan-400 py-3 font-extrabold text-[#04121f] disabled:opacity-50" disabled={busy}>{busy ? 'Signing up…' : 'Sign up'}</button>
            {err && <p role="alert" className="text-sm text-rose-300">{err}</p>}
            <p className="text-center text-sm text-slate-400">Already have a teacher ID? <a href="/ai-guru/school-teacher" className="font-bold text-cyan-300 underline">Sign in</a></p>
          </form>
        )}
      </div>
    </main>
  );
}
