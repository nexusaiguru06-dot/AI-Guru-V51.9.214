'use client';
import { useEffect, useState } from 'react';
import { fetchIfSignedIn } from '@/lib/ai-guru/net/session-hint';
import { JoinClassBox } from './JoinClassBox';

interface Mine { class: { name: string; teacher?: string; kind: string; size: number; mine: { rank: number; points: number } | null; top: Array<{ short: string; points: number; rank: number; you: boolean }> } | null; school: { name: string; rank: number; of: number; members: number } | null }

/** Student dashboard: my class's weekly star-point board (first name + initial only) and my school's rank. */
export function MyClassPanel() {
  const [d, setD] = useState<Mine | null>(null);
  const [joined, setJoined] = useState('');
  const load = () => fetchIfSignedIn(['student'], '/api/ai-guru/student-portal/class', { cache: 'no-store' }).then((r) => r.json()).then((j) => j.ok && setD(j)).catch(() => {});
  useEffect(() => { void load(); }, []);
  // V51.9.182 (newcomer review): no class yet → the way to join one (it used to show nothing at all)
  const join = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('join') ?? '' : '';
  if (d && !d.class) return <section id="my-class" className="mt-5 space-y-3" aria-label="My class"><JoinClassBox initialCode={join} onJoined={(j) => { setJoined(`✓ You joined ${j.className}${j.teacher ? ` with ${j.teacher}` : ''}.`); void load(); }} />{d.school && <p className="text-sm text-slate-300">🏫 {d.school.name} is <b className="text-cyan-300">#{d.school.rank}</b> of {d.school.of} schools this week ({d.school.members} students).</p>}</section>;
  if (!d || (!d.class && !d.school)) return null;
  return (
    <section id="my-class" className="mt-5 rounded-2xl border border-white/10 bg-white/[.04] p-4" aria-label="My class">
      {joined && <p role="status" className="mb-3 rounded-xl border border-emerald-300/40 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100" data-joined>{joined}</p>}
      {d.class && <>
        <h2 className="text-lg font-extrabold">⭐ {d.class.name}{d.class.teacher ? <span className="font-medium text-slate-300"> · {d.class.teacher}</span> : null} · this week</h2>
        <p className="text-xs text-slate-400">Star points come from effort and improvement, not only top marks. {d.class.mine ? <>You are <b className="text-amber-300">#{d.class.mine.rank}</b> of {d.class.size} with {d.class.mine.points} points.</> : null}</p>
        <ol className="mt-2 space-y-1">
          {d.class.top.map((r) => <li key={r.short + r.rank} className={`flex justify-between rounded-lg px-3 py-1.5 text-sm ${r.you ? 'bg-amber-300/15 font-extrabold text-amber-200' : 'bg-black/20'}`}><span>#{r.rank} {r.short}{r.you ? ' (you)' : ''}</span><span>{r.points} ⭐</span></li>)}
        </ol>
      </>}
      {d.school && <p className="mt-3 text-sm text-slate-300">🏫 {d.school.name} is <b className="text-cyan-300">#{d.school.rank}</b> of {d.school.of} schools this week ({d.school.members} students).</p>}
    </section>
  );
}
