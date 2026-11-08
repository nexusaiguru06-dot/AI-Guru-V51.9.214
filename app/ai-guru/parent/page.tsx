'use client';
import { useEffect, useState } from 'react';
import { RewardFeed, SessionCard, Shell, Stat, ChilliCount, ToffeeCount, tierColour } from '@/components/ai-guru/quiz/ReportBits';
import { BadgesPanel } from '@/components/ai-guru/share/BadgesPanel';
import { WeeklyPanel } from '@/components/ai-guru/share/WeeklyPanel';
import { badgesOf, istDay } from '@/lib/ai-guru/share/badges';
import type { SessionRecord } from '@/lib/ai-guru/quiz/records';
import { fetchIfSignedIn } from '@/lib/ai-guru/net/session-hint';

interface Report { ok: boolean; studentName: string | null; sessions: number; toffees: number; chillies: number; pct: number; recent: SessionRecord[]; weak: { concept: string; pct: number; asked: number }[] }
const KEY = 'ai-guru:parent-code';

/** Parent portal, first version: type the code your child sees at the end of a quiz. */
export default function ParentPage() {
  const [code, setCode] = useState('');
  const [rep, setRep] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  // Signed-in admin: pick any student instead of typing a parent code.
  const [pick, setPick] = useState<Array<{ code: string; name: string }> | null>(null);
  useEffect(() => { fetchIfSignedIn(['admin'], '/api/ai-guru/admin/session', { cache: 'no-store' }).then((r) => (r.ok ? fetch('/api/ai-guru/progress?role=teacher', { cache: 'no-store' }).then((x) => x.json()) : null)).then((d) => { if (d?.students) setPick(d.students); }).catch(() => undefined); }, []);
  const look = async (c: string) => {
    const v = c.trim().toUpperCase(); if (!v) return;
    setBusy(true);
    try { const r = (await (await fetch(`/api/ai-guru/progress?role=parent&code=${encodeURIComponent(v)}`, { cache: 'no-store' })).json()) as Report; setRep(r); try { localStorage.setItem(KEY, v); } catch { /* ignore */ } } finally { setBusy(false); }
  };
  useEffect(() => { try { const c = localStorage.getItem(KEY); if (c) { setCode(c); look(c); } } catch { /* ignore */ } }, []);
  // V51.9.117: new toffees and chillies show up by themselves (every 30 s) while the page is open
  const showing = !!rep?.sessions;
  useEffect(() => {
    if (!showing) return;
    const id = setInterval(() => { try { const c = localStorage.getItem(KEY); if (c) fetch(`/api/ai-guru/progress?role=parent&code=${encodeURIComponent(c)}`, { cache: 'no-store' }).then((r) => r.json()).then((r: Report) => { if (r?.ok) setRep(r); }).catch(() => undefined); } catch { /* storage blocked */ } }, 30000);
    return () => clearInterval(id);
  }, [showing]);
  const trend = rep?.recent.slice(0, 8).reverse() ?? [];
  return (
    <Shell title="Parent portal" sub="See how your child is doing">
      <form onSubmit={(e) => { e.preventDefault(); look(code); }} className="mb-6 flex max-w-md gap-2">
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Parent code (shown after your child’s quiz)" maxLength={12} aria-label="Parent code" className="flex-1 rounded-xl border border-white/15 bg-black/30 px-4 py-3 font-mono uppercase outline-none focus:border-cyan-400" />
        <button disabled={busy} className="rounded-xl bg-cyan-400 px-5 font-extrabold text-[#04121f] disabled:opacity-60">Show</button>
      </form>
      {pick && <label className="mb-6 block max-w-md text-xs font-bold text-amber-200">Admin: view as the parent of<select aria-label="Choose a student" defaultValue="" onChange={(e) => { if (e.target.value) { setCode(e.target.value); look(e.target.value); } }} className="mt-1 w-full rounded-xl border border-amber-300/30 bg-black/30 px-4 py-3 text-sm font-normal text-white"><option value="">Choose a student…</option>{pick.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}</select></label>}
      {rep && rep.sessions === 0 && <p className="text-slate-300">No quiz found for this code yet. Check the code on your child’s screen after a quiz.</p>}
      {rep && rep.sessions > 0 && (
        <div className="space-y-8">
          <h2 className="text-xl font-extrabold">{rep.studentName}</h2>
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Quizzes taken">{rep.sessions}</Stat>
            <Stat label="Average score"><span className={tierColour(rep.pct)}>{rep.pct}%</span></Stat>
            <Stat label="Toffees earned"><ToffeeCount n={rep.toffees} /></Stat>
            <Stat label="Chillies (wrong answers)"><ChilliCount n={rep.chillies ?? 0} /></Stat>
          </div>
          <RewardFeed records={rep.recent} showName title={`${rep.studentName ?? 'Your child'}’s toffees and chillies`} />
          <WeeklyPanel name={rep.studentName ?? 'Your child'} records={rep.recent} />
          {(() => { const b = badgesOf(rep.recent, istDay(new Date().toISOString())); return <BadgesPanel badges={b.badges} streak={b.streak} name={rep.studentName ?? 'Student'} />; })()}
          {trend.length > 1 && (
            <section><h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-400">Last {trend.length} quizzes</h3>
              <div className="flex h-28 items-end gap-2" role="img" aria-label="Scores of the last quizzes">{trend.map((r) => <div key={r.id} title={`${r.pct}%`} className="flex-1 rounded-t-lg bg-cyan-400/70" style={{ height: `${Math.max(r.pct, 4)}%` }} />)}</div></section>
          )}
          {rep.weak.length > 0 && <section className="rounded-2xl border border-amber-300/30 bg-amber-400/10 p-4"><h3 className="font-extrabold text-amber-200">Needs a little more practice</h3><p className="mt-1 text-sm text-slate-200">{rep.weak.map((w) => `${w.concept} (${w.pct}% right)`).join(' · ')}</p></section>}
          <section><h3 className="mb-3 text-lg font-extrabold">Quiz sessions</h3><div className="space-y-2">{rep.recent.map((r) => <SessionCard key={r.id} r={r} />)}</div></section>
        </div>
      )}
    </Shell>
  );
}
