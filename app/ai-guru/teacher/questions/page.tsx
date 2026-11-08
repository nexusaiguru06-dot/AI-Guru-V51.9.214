'use client';
import { useEffect, useMemo, useState } from 'react';
import { QuestionEditor } from '@/components/ai-guru/teacher/QuestionEditor';
import { Shell, Stat, TeacherNav, ChilliCount, ToffeeCount, tierColour, when } from '@/components/ai-guru/quiz/ReportBits';
import { Toffee } from '@/components/ai-guru/quiz/Toffee';
import { Chilli } from '@/components/ai-guru/quiz/Chilli';
import { chilliesOf } from '@/lib/ai-guru/quiz/records';
import type { SessionRecord } from '@/lib/ai-guru/quiz/records';
import type { QuestionSet } from '@/lib/ai-guru/quiz/sets';

/** Teacher portal · questions: make quizzes for your students and see the toffees every student has earned. */
export default function QuestionsPage() {
  const [sets, setSets] = useState<QuestionSet[] | null>(null);
  const [records, setRecords] = useState<SessionRecord[]>([]);
  const [edit, setEdit] = useState<QuestionSet | 'new' | null>(null);
  const [tab, setTab] = useState<'sets' | 'toffees'>('sets');
  const [err, setErr] = useState('');

  const load = async () => {
    try {
      const [a, b] = await Promise.all([fetch('/api/ai-guru/question-sets', { cache: 'no-store' }).then((r) => r.json()), fetch('/api/ai-guru/progress?role=teacher&all=1', { cache: 'no-store' }).then((r) => r.json())]);
      setSets(a.sets ?? []); setRecords(b.records ?? []); setErr('');
    } catch { setErr('Could not load. Is the server running?'); }
  };
  useEffect(() => { void load(); const id = setInterval(load, 30000); return () => clearInterval(id); }, []);

  const bySet = useMemo(() => {
    const m = new Map<string, SessionRecord[]>();
    for (const r of records) if (r.setId) m.set(r.setId, [...(m.get(r.setId) ?? []), r]);
    return m;
  }, [records]);

  const students = useMemo(() => {
    const m = new Map<string, { name: string; code: string; toffees: number; chillies: number; mine: number; own: number; quizzes: number; pct: number; last: string }>();
    const sorted = [...records].sort((a, b) => a.at.localeCompare(b.at));
    const sums = new Map<string, number>();
    for (const r of sorted) {
      const o = m.get(r.studentId) ?? { name: r.studentName, code: r.code, toffees: 0, chillies: 0, mine: 0, own: 0, quizzes: 0, pct: 0, last: r.at };
      o.name = r.studentName; o.toffees += r.toffees; o.chillies += chilliesOf(r); if (r.setId) o.mine += r.toffees; else o.own += r.toffees; o.quizzes++; o.last = r.at;
      sums.set(r.studentId, (sums.get(r.studentId) ?? 0) + r.pct); o.pct = Math.round(sums.get(r.studentId)! / o.quizzes);
      m.set(r.studentId, o);
    }
    return [...m.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.toffees - a.toffees);
  }, [records]);

  const remove = async (s: QuestionSet) => { if (!confirm(`Delete “${s.name}”? Students’ past results stay in the reports.`)) return; await fetch(`/api/ai-guru/question-sets?id=${encodeURIComponent(s.id)}`, { method: 'DELETE' }); void load(); };
  const toggle = async (s: QuestionSet) => { await fetch('/api/ai-guru/question-sets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ set: { ...s, active: !s.active } }) }); void load(); };

  return (
    <Shell title="Teacher portal · Questions" sub="Make quizzes for your students and see their toffees">
      <TeacherNav current="questions" />
      {err && <p role="alert" className="mb-4 text-rose-300">{err}</p>}
      {edit ? (
        <QuestionEditor initial={edit === 'new' ? null : edit} onCancel={() => setEdit(null)} onSaved={() => { setEdit(null); void load(); }} />
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-center gap-2">
            {([['sets', 'My quizzes'], ['toffees', 'Toffees by student']] as const).map(([id, l]) => <button key={id} onClick={() => setTab(id)} aria-pressed={tab === id} className={`rounded-full px-4 py-2 text-sm font-extrabold ${tab === id ? 'bg-violet-300 text-[#14102a]' : 'border border-white/15 hover:bg-white/5'}`}>{l}</button>)}
            {tab === 'sets' && <button onClick={() => setEdit('new')} className="ml-auto rounded-xl bg-cyan-400 px-5 py-2.5 text-sm font-extrabold text-[#04121f]">+ New quiz</button>}
          </div>

          {tab === 'sets' && (sets === null ? <p className="text-slate-400">Loading…</p> : sets.length === 0 ? <p className="text-slate-300">You have not made a quiz yet. Press “+ New quiz”: write your own questions, or let the AI draft some for you to check.</p> : (
            <div className="space-y-4">{sets.map((s) => {
              const rs = bySet.get(s.id) ?? []; const who = new Set(rs.map((r) => r.studentId)).size;
              const avg = rs.length ? Math.round(rs.reduce((x, r) => x + r.pct, 0) / rs.length) : null;
              return (
                <article key={s.id} className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-extrabold">{s.name}</h3>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${s.active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-slate-400'}`}>{s.active ? 'Students can take it' : 'Hidden'}</span>
                    <span className="text-xs text-slate-400">{s.items.length} questions{s.grade ? ` · class ${s.grade}` : ''}</span>
                    <span className="ml-auto flex gap-3 text-sm"><button onClick={() => setEdit(s)} className="text-cyan-300 hover:underline">Edit</button><button onClick={() => toggle(s)} className="text-slate-300 hover:underline">{s.active ? 'Hide' : 'Show'}</button><button onClick={() => remove(s)} className="text-rose-300 hover:underline">Delete</button></span>
                  </div>
                  {rs.length === 0 ? <p className="mt-2 text-sm text-slate-500">Nobody has taken it yet.</p> : (
                    <details className="mt-3"><summary className="cursor-pointer text-sm text-slate-300">{who} student{who === 1 ? '' : 's'} · {rs.length} attempt{rs.length === 1 ? '' : 's'} · average <b className={avg !== null ? tierColour(avg) : ''}>{avg}%</b> · <Toffee size={22} className="inline" /> {rs.reduce((x, r) => x + r.toffees, 0)} toffees</summary>
                      <table className="mt-3 w-full text-left text-sm"><thead className="text-xs uppercase tracking-wider text-slate-400"><tr><th className="py-1">Student</th><th>When</th><th>Score</th><th>Toffees</th></tr></thead>
                        <tbody>{[...rs].sort((a, b) => b.at.localeCompare(a.at)).map((r) => <tr key={r.id} className="border-t border-white/10"><td className="py-1.5 font-bold">{r.studentName}</td><td className="text-xs text-slate-400">{when(r.at)}</td><td className={`font-extrabold ${tierColour(r.pct)}`}>{r.correct}/{r.total} · {r.pct}%</td><td className="text-amber-300">{r.toffees}</td></tr>)}</tbody></table>
                    </details>)}
                </article>);
            })}</div>))}

          {tab === 'toffees' && (
            <div className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-4"><Stat label="Students">{students.length}</Stat><Stat label="Toffees given"><ToffeeCount n={students.reduce((s, x) => s + x.toffees, 0)} /></Stat><Stat label="Chillies given"><ChilliCount n={students.reduce((s, x) => s + x.chillies, 0)} /></Stat><Stat label="Quizzes taken">{records.length}</Stat></div>
              {students.length === 0 ? <p className="text-slate-400">No toffees yet.</p> : (
                <div className="overflow-x-auto rounded-2xl border border-white/10"><table className="w-full min-w-[620px] text-left text-sm">
                  <thead className="bg-white/5 text-xs uppercase tracking-wider text-slate-400"><tr><th className="p-3">#</th><th>Student</th><th>Toffees</th><th>Chillies</th><th>From your quizzes</th><th>From surprise quizzes</th><th>Quizzes</th><th>Average</th><th>Last</th></tr></thead>
                  <tbody>{students.map((s, i) => <tr key={s.id} className="border-t border-white/10"><td className="p-3 text-slate-500">{i + 1}</td><td className="font-bold">{s.name} <span className="font-mono text-xs font-normal text-slate-500">{s.code}</span></td><td><span className="inline-flex items-center gap-1 font-extrabold text-amber-300"><Toffee size={24} />{s.toffees}</span></td><td><span className="inline-flex items-center gap-1 font-extrabold text-rose-300"><Chilli size={24} />{s.chillies}</span></td><td>{s.mine}</td><td>{s.own}</td><td>{s.quizzes}</td><td className={`font-extrabold ${tierColour(s.pct)}`}>{s.pct}%</td><td className="text-xs text-slate-400">{when(s.last)}</td></tr>)}</tbody></table></div>)}
            </div>)}
        </>
      )}
    </Shell>
  );
}
