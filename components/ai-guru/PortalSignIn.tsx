'use client';
import { useEffect, useState } from 'react';
import { fetchIfSignedIn, mayHaveSession } from '@/lib/ai-guru/net/session-hint';
import { adoptAccount, forgetAccountOnDevice, visitorIdOnDevice } from '@/lib/ai-guru/student/device-session';

/**
 * The sign-in box shared by every portal (student classroom, teacher, parent). It sends the username and password
 * to one endpoint; the admin's details open the admin portal, which has no card or link anywhere on the front page.
 * Any other details get the same plain "not recognised" answer, so nothing here shows that an admin exists.
 * V51.9.182 (newcomer review): a signed-in student sees their name, Student ID and Sign out here (it used to say "Sign in"
 * all the time); the student sign-in is tried FIRST, so students no longer use up the admin's 5 tries for the address
 * (and a Student ID is never sent to the admin sign-in); the box links to "Forgot password", in English and Malayalam.
 */
const looksLikeStudentId = (x: string) => /^(st-?\d+-?\d+|\d{1,12})$/i.test(x.trim());
export function PortalSignIn() {
  const [open, setOpen] = useState(false);
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [student, setStudent] = useState<{ name: string; code: string } | null>(null);
  // An admin who is already signed in goes through every portal freely: this box becomes a menu of them.
  useEffect(() => { if (!mayHaveSession('admin')) return; fetch('/api/ai-guru/admin/session', { cache: 'no-store' }).then((r) => setAdmin(r.ok)).catch(() => undefined); }, []);
  useEffect(() => {
    const check = () => fetchIfSignedIn(['student'], '/api/ai-guru/student-portal/me', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null))
      .then((j) => { setStudent(j?.student ? { name: String(j.student.name ?? ''), code: String(j.student.studentCode ?? '') } : null); }).catch(() => undefined);
    void check();
    // V51.9.182 (re-check): sign-up and sign-in on the same page tell the header at once
    window.addEventListener('aig-signed-in', check);
    return () => window.removeEventListener('aig-signed-in', check);
  }, []);
  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg('');
    try {
      // students first: the Student ID (or admission number) and password
      const sr = await fetch('/api/ai-guru/student-portal/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ admissionNo: u, pin: p, visitorId: visitorIdOnDevice() }) });
      const sj = await sr.json().catch(() => ({}));
      if (sr.ok) { adoptAccount({ quizId: sj.quizId, name: sj.name }); window.location.href = typeof sj.next === 'string' && sj.next.startsWith('/ai-guru/') ? sj.next : '/ai-guru/student'; return; } // V51.9.187: no book yet → My books
      let locked = sr.status === 429;
      // then the school office (never with something that looks like a Student ID)
      if (!looksLikeStudentId(u)) {
        const r = await fetch('/api/ai-guru/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: u, password: p }) });
        const j = await r.json().catch(() => ({}));
        if (j.ok) { window.location.href = '/ai-guru/admin'; return; }
        locked = locked && r.status === 429;
      }
      setMsg(locked ? 'Too many wrong tries. Please wait 15 minutes.' : 'Student ID or password is not right. Check the dashes (ST-12-26). After 5 wrong tries you must wait 15 minutes, so use “Forgot” below if you are not sure.');
      setP('');
    } catch { setMsg('Could not reach the server.'); } finally { setBusy(false); }
  };
  if (admin) {
    const links: Array<[string, string]> = [['New Schools', '/ai-guru/admin'], ['📋 Students', '/ai-guru/admin/students'], ['📈 Activities', '/ai-guru/admin/activities'], ['💰 Fees', '/ai-guru/admin/fees'], ['🤝 Affiliate', '/ai-guru/admin/affiliate'], ['⏰ Fees due', '/ai-guru/admin/dues'], ['🏫 Schools', '/ai-guru/admin/schools'], ['⚙ Settings', '/ai-guru/admin/settings'], ['Student classroom', '/ai-guru/classroom'], ['Student portal (sign-in)', '/ai-guru/student'], ['Teacher portal', '/ai-guru/teacher'], ['Parent portal', '/ai-guru/parent']];
    return (
      <div className="relative shrink-0">
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="rounded-lg border border-amber-300/40 bg-amber-400/10 px-3 py-2 text-xs font-bold text-amber-200 hover:bg-amber-400/20">Admin ▾</button>
        {open && (
          <div className="absolute right-0 z-[60] mt-2 w-52 space-y-1 rounded-2xl border border-white/15 bg-[#0a1a2b] p-2 text-left shadow-2xl">
            {links.map(([l, h]) => <a key={h} href={h} className="block rounded-lg px-3 py-2 text-sm font-bold text-slate-100 hover:bg-white/10">{l}</a>)}
            <button type="button" onClick={async () => { await fetch('/api/ai-guru/admin/logout', { method: 'POST' }); window.location.href = '/ai-guru'; }} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-400 hover:bg-white/10">Sign out</button>
          </div>
        )}
      </div>
    );
  }
  if (student) return (
    <div className="relative shrink-0">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="max-w-[9rem] truncate rounded-lg border border-cyan-300/40 bg-cyan-400/10 px-3 py-2 text-xs font-bold text-cyan-100 hover:bg-cyan-400/20" data-signed-in-student>👤 {student.name.split(' ')[0] || 'Me'} ▾</button>
      {open && (
        <div className="absolute right-0 z-[60] mt-2 w-60 space-y-1 rounded-2xl border border-white/15 bg-[#0a1a2b] p-2 text-left shadow-2xl">
          <p className="px-3 py-2 text-xs text-slate-300">Signed in as <b className="text-white">{student.name}</b>{student.code ? <> · <span className="font-mono text-cyan-300">{student.code}</span></> : null}</p>
          {([['My account', '/ai-guru/student'], ['My class', '/ai-guru/classroom'], ['Join a class', '/ai-guru/student#my-class'], ['Teachers Notes', '/ai-guru/teacher-notes']] as const).map(([l, h]) => <a key={h} href={h} className="block rounded-lg px-3 py-2 text-sm font-bold text-slate-100 hover:bg-white/10">{l}</a>)}
          <button type="button" onClick={async () => { await fetch('/api/ai-guru/student-portal/logout', { method: 'POST' }); forgetAccountOnDevice(); window.location.href = '/ai-guru/student?bye=1'; }} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-300 hover:bg-white/10" data-sign-out>Sign out</button>
        </div>
      )}
    </div>
  );
  return (
    <div className="relative shrink-0">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="rounded-lg border border-white/15 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/5">Sign in</button>
      {open && (
        <form onSubmit={go} className="absolute right-0 z-[60] mt-2 w-72 space-y-3 rounded-2xl border border-white/15 bg-[#0a1a2b] p-4 text-left shadow-2xl">
          <label className="block text-xs font-bold text-slate-300">Student ID (like ST-12-26) or admission number<input value={u} onChange={(e) => setU(e.target.value)} autoComplete="username" autoCapitalize="none" className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm font-normal text-white outline-none focus:border-cyan-400" /></label>
          <label className="block text-xs font-bold text-slate-300">Password<input type="password" value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm font-normal text-white outline-none focus:border-cyan-400" /></label>
          {msg && <p role="alert" className="text-xs text-rose-300">{msg}</p>}
          <button disabled={busy || !u || !p} className="w-full rounded-lg bg-cyan-400 py-2 text-sm font-extrabold text-[#04121f] disabled:opacity-50">{busy ? 'Checking…' : 'Sign in'}</button>
          <a href={`/ai-guru/student?forgot=1${u ? `&id=${encodeURIComponent(u)}` : ''}`} className="block text-center text-xs text-slate-300 underline">Forgot your password or Student ID?</a>
          <a href="/ai-guru/student/signup" className="block rounded-lg border border-cyan-300/40 py-2 text-center text-sm font-bold text-cyan-200">New student? Make an account</a>
        </form>
      )}
    </div>
  );
}
