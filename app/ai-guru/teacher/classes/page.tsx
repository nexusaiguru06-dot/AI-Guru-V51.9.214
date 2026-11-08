'use client';
import { useState } from 'react';
import { Shell, Stat, TeacherNav } from '@/components/ai-guru/quiz/ReportBits';
import { ClassWorkspace } from '@/components/ai-guru/teacher/ClassWorkspace';
import { posterHtml } from '@/lib/ai-guru/share/poster';

interface View { teacherCode?: string; teacherName?: string; name: string; kind: 'class' | 'centre'; code: string; discountPct: number; joined: number; activeThisWeek: number; pilotActive: boolean; pilotUntil?: string; tiers: { tiers: Array<{ at: number; reward: string; status: 'given' | 'earned' | 'locked'; left: number }>; next: { at: number; left: number } | null }; board: Array<{ name: string; points: number; quizzes: number; rank: number; streak: number }> }
interface RosterRow { feePending?: boolean; serial: number | null; studentCode: string; name: string; standard: string; sessions: number; pct: number; toffees: number; chillies: number; weak: Array<{ concept: string; pct: number }>; last: string | null }
interface Res { roster: RosterRow[]; group: View; link: string; invite: string; members: Array<{ name: string; standard: string }> }

/** Teacher portal · my class: join code and link, how many have joined, rewards, and the weekly star-point board. */
export default function TeacherClassPage() {
  const [code, setCode] = useState(''); const [key, setKey] = useState('');
  const [r, setR] = useState<Res | null>(null); const [err, setErr] = useState('');
  const open = async () => {
    setErr('');
    const res = await fetch('/api/ai-guru/teacher-classes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code, key }) });
    const j = await res.json().catch(() => ({}));
    if (j.ok) setR(j); else setErr(j.error || 'Could not open the class');
  };
  const poster = () => { if (!r) return; const w = window.open('', '_blank'); if (!w) return; w.document.write(posterHtml(r.group, r.link)); w.document.close(); setTimeout(() => w.print(), 400); };
  const g = r?.group;
  const tone = { given: 'bg-emerald-400/20 text-emerald-200', earned: 'bg-amber-300/20 text-amber-200', locked: 'bg-white/5 text-slate-400' } as const;
  return (
    <Shell title="My class" sub="Your class code, who has joined, your rewards and this week’s star points.">
      <TeacherNav current="classes" />
      {!r && (
        <form onSubmit={(e) => { e.preventDefault(); void open(); }} className="max-w-sm space-y-3 rounded-2xl border border-white/10 bg-white/[.04] p-5">
          <label className="block text-xs font-bold text-slate-300">Class code<input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 font-mono text-white" autoComplete="off" /></label>
          <label className="block text-xs font-bold text-slate-300">Teacher key (6 digits from the office)<input value={key} onChange={(e) => setKey(e.target.value)} inputMode="numeric" maxLength={6} type="password" className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-white" /></label>
          {err && <p role="alert" className="text-sm text-rose-300">{err}</p>}
          <button className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-extrabold text-[#04121f]">Open my class</button>
        </form>
      )}
      {r && g && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3"><h2 className="text-xl font-extrabold">{g.name}</h2><span className="rounded-full bg-cyan-400/15 px-3 py-1 font-mono text-sm font-bold text-cyan-200">{g.code}</span>{g.teacherCode && <span className="rounded-full bg-violet-400/15 px-3 py-1 font-mono text-xs font-bold text-violet-200" title="Your teacher number">{g.teacherCode}</span>}{g.pilotActive && <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-bold text-emerald-200">Free pilot until {g.pilotUntil}</span>}</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3"><Stat label="Joined">{String(g.joined)}</Stat><Stat label="Active this week">{String(g.activeThisWeek)}</Stat><Stat label="Fee discount">{`${g.discountPct}%`}</Stat></div>
          <section className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
            <h3 className="font-extrabold">Invite students</h3>
            <p className="mt-1 break-all text-sm text-slate-300">{r.link}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <a className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-extrabold text-white" href={`https://wa.me/?text=${encodeURIComponent(r.invite)}`} target="_blank" rel="noreferrer">Share on WhatsApp</a>
              <button onClick={poster} className="rounded-lg border border-white/15 px-3 py-2 text-xs font-bold">Print poster with QR</button>
            </div>
          </section>
          <section className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
            <h3 className="font-extrabold">My students and their progress</h3>
            <p className="text-xs text-slate-400">Roll no. is your own serial number in this class; Student no. is the AI Guru number.</p>
            <div className="mt-2 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-slate-400"><tr><th className="py-1">Roll</th><th>Student no.</th><th>Name</th><th>Std</th><th>Quizzes</th><th>Score</th><th>🍬</th><th>🌶</th><th>Needs help with</th><th>Last</th></tr></thead>
              <tbody>{r.roster.map((s) => <tr key={s.studentCode + s.name} className="border-t border-white/5"><td className="py-1 font-mono font-bold">{s.serial ?? '—'}</td><td className="font-mono text-xs text-cyan-300">{s.studentCode}</td><td className="font-bold">{s.name}{s.feePending && <span className="ml-1.5 rounded bg-amber-400/20 px-1.5 py-0.5 text-[11px] font-bold text-amber-200" title="The student's fee is pending (the school office handles it)" data-fee-pending>fee pending</span>}</td><td>{s.standard}</td><td>{s.sessions}</td><td className="font-extrabold">{s.sessions ? `${s.pct}%` : '—'}</td><td className="text-amber-300">{s.toffees}</td><td className="text-rose-300">{s.chillies}</td><td className="text-xs text-slate-300">{s.weak.length ? s.weak.map((w) => `${w.concept} (${w.pct}%)`).join(', ') : '—'}</td><td className="text-xs text-slate-400">{s.last ?? '—'}</td></tr>)}</tbody></table></div>
            {!r.roster.length && <p className="text-sm text-slate-400">No students yet. Share the invite link above.</p>}
          </section>
          <ClassWorkspace code={code} keyText={key} />
          <section className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
            <h3 className="font-extrabold">Your rewards</h3>
            <ul className="mt-2 grid gap-2 sm:grid-cols-3">{g.tiers.tiers.map((t) => <li key={t.at} className={`rounded-xl p-3 text-sm ${tone[t.status]}`}><b>{t.at} students</b><br />{t.reward}<br /><span className="text-xs">{t.status === 'given' ? '✓ Given' : t.status === 'earned' ? 'Earned — the office will give it' : `${t.left} more to go`}</span></li>)}</ul>
          </section>
          <section className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
            <h3 className="font-extrabold">Star points this week</h3>
            <div className="mt-2 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-slate-400"><tr><th className="py-1">#</th><th>Student</th><th>Quizzes</th><th>Streak</th><th>Points</th></tr></thead>
              <tbody>{g.board.map((b) => <tr key={b.name} className="border-t border-white/5"><td className="py-1">{b.rank}</td><td>{b.name}</td><td>{b.quizzes}</td><td>{b.streak}</td><td className="font-bold text-amber-300">{b.points}</td></tr>)}</tbody></table></div>
            {!g.board.length && <p className="text-sm text-slate-400">No students yet. Share the link above.</p>}
          </section>
        </div>
      )}
    </Shell>
  );
}
