'use client';
/**
 * V51.9.182 (newcomer review) — "Enter your class code": a signed-in student joins their teacher's class after signing up
 * (from the dashboard, Teachers Notes, or an invite link opened while signed in). Uses POST student-portal/join.
 */
import { useState } from 'react';

export function JoinClassBox({ initialCode = '', onJoined }: { initialCode?: string; onJoined?: (j: { className: string; teacher?: string }) => void }) {
  const [code, setCode] = useState(initialCode);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const join = async (e: React.FormEvent) => {
    e.preventDefault(); if (!code.trim()) return;
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/ai-guru/student-portal/join', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) });
      const j = await r.json().catch(() => ({}));
      if (j.ok) {
        const warn = j.classStandard ? ` Note: this class is for Std ${j.classStandard}. If that is not your standard, ask your teacher.` : '';
        setMsg({ ok: true, text: `✓ You joined ${j.className}${j.teacher ? ` with ${j.teacher}` : ''}.${warn}` }); onJoined?.(j);
      }
      else setMsg({ ok: false, text: j.error ?? 'Could not join. Please try again.' });
    } catch { setMsg({ ok: false, text: 'Could not reach the server.' }); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={join} className="space-y-2 rounded-2xl border border-cyan-300/30 bg-cyan-400/5 p-4" aria-label="Join your teacher's class" data-join-class>
      <p className="text-base font-extrabold">🏫 Join your teacher’s class</p>
      <label className="block text-sm font-bold text-slate-200">Class code from your teacher
        <span className="mt-1 flex gap-2"><input value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="characters" placeholder="8 letters, e.g. ABCD1234" className="min-h-[48px] w-full rounded-xl border border-white/15 bg-black/30 px-4 font-mono text-base uppercase text-white outline-none focus:border-cyan-400" data-join-code />
          <button disabled={busy || !code.trim()} className="min-h-[48px] shrink-0 rounded-xl bg-cyan-400 px-5 font-extrabold text-[#04121f] disabled:opacity-50">{busy ? '…' : 'Join'}</button></span>
      </label>
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`text-sm ${msg.ok ? 'text-emerald-300' : 'text-rose-300'}`}>{msg.text}</p>}
    </form>
  );
}
