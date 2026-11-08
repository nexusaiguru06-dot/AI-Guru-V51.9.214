'use client';

/**
 * V51.9.173 — the teacher portal's door. Students' results, attendance and quizzes are shown only to a teacher who has
 * signed in with the class code and the 6-digit key (or to the admin). The Classes page keeps its own code + key form.
 */
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export function TeacherGate({ children }: { children: React.ReactNode }) {
  const path = usePathname() ?? '';
  const open = path.startsWith('/ai-guru/teacher/classes');
  const [state, setState] = useState<'checking' | 'in' | 'out'>(open ? 'in' : 'checking');
  const [code, setCode] = useState('');
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (open) return;
    fetch('/api/ai-guru/teacher-portal/session', { cache: 'no-store' })
      .then((r) => r.json()).then((j) => setState(j?.signedIn ? 'in' : 'out')).catch(() => setState('out'));
  }, [open]);

  if (state === 'in') return <>{children}</>;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      const r = await fetch('/api/ai-guru/teacher-portal/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: code.trim(), key: key.trim() }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) setState('in'); else setErr(j.error || 'The class code or key is not right');
    } catch { setErr('Could not reach AI Guru. Check the connection and try again.'); } finally { setBusy(false); }
  };
  const inp = 'mt-1.5 block min-h-[48px] w-full rounded-xl border border-white/15 bg-white/[.06] px-4 text-base outline-none focus:border-cyan-300';
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#06101c] px-4 py-10 text-slate-100">
      {state === 'checking' ? <p className="text-slate-400">Loading…</p> : (
        <form onSubmit={submit} className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#0b1426] p-7 shadow-[0_20px_60px_rgba(0,0,0,.35)]">
          <img src="/aiguru-logo.png" alt="" width={48} height={48} className="mb-4 h-12 w-12 object-contain" />
          <h1 className="text-2xl font-extrabold">Teacher portal</h1>
          <p className="mt-1 text-sm text-slate-400">Sign in with your class code and the 6-digit key the school gave you.</p>
          <label className="mt-5 block text-sm font-bold">Class code<input value={code} onChange={(e) => setCode(e.target.value)} autoComplete="username" autoCapitalize="characters" className={inp} required /></label>
          <label className="mt-4 block text-sm font-bold">Key<input value={key} onChange={(e) => setKey(e.target.value.replace(/\D/g, '').slice(0, 6))} type="password" inputMode="numeric" autoComplete="current-password" className={inp} placeholder="6 digits" required /></label>
          {err && <p role="alert" className="mt-3 text-sm font-semibold text-rose-300">{err}</p>}
          <button type="submit" disabled={busy} className="mt-6 min-h-[48px] w-full rounded-xl bg-cyan-400 text-base font-extrabold text-[#04121f] disabled:opacity-70">{busy ? 'Signing in…' : 'Sign in'}</button>
          <p className="mt-4 text-center text-xs text-slate-500">Lost the key? The school office can make a new one.</p>
          {/* V51.9.193 */}
          <p className="mt-3 text-center text-sm text-slate-400">Teacher at a school that works with AI Guru (teacher ID TS-…)? <a href="/ai-guru/school-teacher" className="font-bold text-cyan-300 underline">School teacher portal</a></p>
        </form>
      )}
    </main>
  );
}

export default TeacherGate;
