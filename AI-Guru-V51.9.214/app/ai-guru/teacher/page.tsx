'use client';
import { useEffect, useState } from 'react';
import { RewardFeed, SessionCard, Shell, Stat, TeacherNav, ChilliCount, ToffeeCount, tierColour, when } from '@/components/ai-guru/quiz/ReportBits';
import type { SessionRecord } from '@/lib/ai-guru/quiz/records';

interface Row { studentId: string; code: string; name: string; sessions: number; toffees: number; chillies: number; pct: number; last: string; weak: { concept: string; pct: number; asked: number }[] }

/** Teacher portal, first version: quiz results of every student. (Planning tools come with the full portal.) */
export default function TeacherPage() {
  const [data, setData] = useState<{ students: Row[]; recent: SessionRecord[] } | null>(null);
  const [err, setErr] = useState('');
  const load = () => fetch('/api/ai-guru/progress?role=teacher', { cache: 'no-store' }).then((r) => r.json()).then(setData).catch(() => setErr('Could not load results.'));
  useEffect(() => { load(); const id = setInterval(load, 20000); return () => clearInterval(id); }, []);
  const classAvg = data?.students.length ? Math.round(data.students.reduce((s, x) => s + x.pct, 0) / data.students.length) : 0;
  return (
    <Shell title="Teacher portal" sub="Quiz results of your students">
      <TeacherNav current="results" />
      {err && <p className="text-rose-300">{err}</p>}
      {!data && !err && <p className="text-slate-400">Loading…</p>}
      {data && (
        <div className="space-y-8">
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Students">{data.students.length}</Stat>
            <Stat label="Class average"><span className={tierColour(classAvg)}>{classAvg}%</span></Stat>
            <Stat label="Toffees given"><ToffeeCount n={data.students.reduce((s, x) => s + x.toffees, 0)} /></Stat>
            <Stat label="Chillies given"><ChilliCount n={data.students.reduce((s, x) => s + (x.chillies ?? 0), 0)} /></Stat>
          </div>
          <section>
            <h2 className="mb-3 text-lg font-extrabold">Students</h2>
            {data.students.length === 0 ? <p className="text-slate-400">No quiz has been taken yet.</p> : (
              <div className="overflow-x-auto rounded-2xl border border-white/10">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-white/5 text-xs uppercase tracking-wider text-slate-400"><tr><th className="p-3">Student</th><th>Code</th><th>Quizzes</th><th>Score</th><th>Toffees</th><th>Chillies</th><th>Needs help with</th><th>Last</th></tr></thead>
                  <tbody>{data.students.map((s) => (
                    <tr key={s.studentId} className="border-t border-white/10">
                      <td className="p-3 font-bold">{s.name}</td><td className="font-mono text-xs text-slate-400">{s.code}</td><td>{s.sessions}</td>
                      <td className={`font-extrabold ${tierColour(s.pct)}`}>{s.pct}%</td><td className="text-amber-300">{s.toffees}</td><td className="text-rose-300">{s.chillies ?? 0}</td>
                      <td className="text-xs text-slate-300">{s.weak.length ? s.weak.map((w) => `${w.concept} (${w.pct}%)`).join(', ') : '—'}</td><td className="text-xs text-slate-400">{when(s.last)}</td>
                    </tr>))}</tbody>
                </table>
              </div>
            )}
          </section>
          {/* V51.9.117: each toffee and chilli as it is earned, in class or in a quiz */}
          <RewardFeed records={data.recent} showName title="Toffees and chillies (live)" />
          <section>
            <h2 className="mb-3 text-lg font-extrabold">Latest sessions</h2>
            <div className="space-y-2">{data.recent.map((r) => <SessionCard key={r.id} r={r} showName />)}</div>
          </section>
        </div>
      )}
    </Shell>
  );
}
