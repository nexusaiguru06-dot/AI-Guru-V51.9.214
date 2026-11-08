'use client';
/**
 * V51.9.182 (newcomer review, blocker 1) — the screen straight after sign-up: the Student ID the child signs in with,
 * large, in English and Malayalam, with a way to send it to a parent, and (when a class code was used) the class and
 * teacher they joined. The way on is open only after "I have written it down" is ticked.
 * The ID and password are also offered to the browser's password manager, so the phone fills them in next time.
 */
import { useState } from 'react';

export interface NewAccount { studentCode: string; name: string; className?: string; teacher?: string; note?: string }

declare global { interface Window { PasswordCredential?: new (d: { id: string; password: string; name?: string }) => Credential } }

export function StudentIdCard({ acct, password }: { acct: NewAccount; password: string }) {
  const [kept, setKept] = useState(false);
  const site = typeof window !== 'undefined' ? window.location.origin : '';
  const share = `AI Guru — ${acct.name}\nStudent ID: ${acct.studentCode}\nSign in at ${site}/ai-guru/student with this Student ID and the password you chose.`;
  const save = async () => {
    try { if (window.PasswordCredential && navigator.credentials?.store) await navigator.credentials.store(new window.PasswordCredential({ id: acct.studentCode, password, name: acct.name })); } catch { /* the browser may say no */ }
  };
  const go = (href: string) => async () => { await save(); window.location.href = href; };
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#06101c] px-4 py-8 text-slate-100">
      <section aria-labelledby="id-title" className="w-full max-w-lg space-y-5 rounded-3xl border border-cyan-300/30 bg-white/[.04] p-6 text-center" data-student-id-card>
        <p className="text-lg font-bold">🎉 Welcome, {acct.name.split(' ')[0]}!</p>
        {acct.className && <p className="rounded-2xl border border-emerald-300/40 bg-emerald-400/10 px-4 py-3 text-base text-emerald-100" data-joined-class>✓ You joined <b>{acct.className}</b>{acct.teacher ? <> with <b>{acct.teacher}</b></> : null}.</p>}
        <div>
          <h1 id="id-title" className="text-base font-bold text-slate-200">Your Student ID</h1>
          <p className="mt-2 select-all font-mono text-5xl font-black tracking-wider text-cyan-300" data-student-id>{acct.studentCode}</p>
          <p className="mt-3 text-base text-slate-200">Write it down. Next time, sign in with this <b>Student ID</b> and the <b>password you just chose</b>.</p>
          
        </div>
        {/* for the browser's password manager: it can now remember the ID and password together */}
        <form onSubmit={(e) => e.preventDefault()} className="sr-only" aria-hidden>
          <input name="username" autoComplete="username" value={acct.studentCode} readOnly tabIndex={-1} />
          <input name="password" type="password" autoComplete="new-password" value={password} readOnly tabIndex={-1} />
        </form>
        <a href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noopener noreferrer" className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 font-extrabold text-[#04121f]" data-share-id>📲 Send the ID to my parent on WhatsApp</a>
        {acct.note && <p className="text-sm text-amber-200">{acct.note}</p>}
        <label className="flex items-center justify-center gap-3 text-base font-bold">
          <input type="checkbox" checked={kept} onChange={(e) => setKept(e.target.checked)} className="h-6 w-6" data-id-kept />
          I have written down my Student ID
        </label>
        {!kept && <p className="text-sm text-amber-200" data-tick-hint>Tick the box above to go on.</p>}
        <div className="grid gap-3">
          {/* V51.9.187: a new student downloads their textbooks first; they then appear in the classroom */}
          <button type="button" disabled={!kept} onClick={go('/ai-guru/student/library?welcome=1')} className="min-h-[52px] rounded-xl bg-amber-400 px-4 py-3 text-lg font-extrabold text-[#1a1200] disabled:opacity-40" data-pick-books>📥 Download my textbooks</button>
          <button type="button" disabled={!kept} onClick={go('/ai-guru/classroom')} className="min-h-[48px] rounded-xl border border-white/20 px-4 py-3 font-bold text-slate-200 disabled:opacity-40" data-go-class>▶ Go to my class</button>
        </div>
      </section>
    </main>
  );
}
