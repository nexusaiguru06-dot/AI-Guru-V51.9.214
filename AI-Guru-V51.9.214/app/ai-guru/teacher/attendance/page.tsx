'use client';
import { useEffect, useMemo, useState } from 'react';
import { SessionCard, Shell, Stat, TeacherNav, ChilliCount, ToffeeCount, tierColour } from '@/components/ai-guru/quiz/ReportBits';
import { buildRegister, lastDates, localDate, registerCsv, type AttendanceSession } from '@/lib/ai-guru/attendance/register';
import type { SessionRecord } from '@/lib/ai-guru/quiz/records';

const hm = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—');
const mins = (s: number) => (s < 60 ? `${Math.round(s)} s` : s < 3600 ? `${Math.round(s / 60)} min` : `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min`);
const niceDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

/** Teacher portal · attendance register: who came, entry and exit time, time in class, quiz scores and toffees. */
export default function AttendancePage() {
  const [sessions, setSessions] = useState<AttendanceSession[] | null>(null);
  const [quizzes, setQuizzes] = useState<SessionRecord[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [date, setDate] = useState(() => localDate(new Date().toISOString()));
  const [days, setDays] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [a, p] = await Promise.all([fetch('/api/ai-guru/attendance', { cache: 'no-store' }).then((r) => r.json()), fetch('/api/ai-guru/progress?role=teacher&all=1', { cache: 'no-store' }).then((r) => r.json())]);
        setSessions(a.sessions ?? []); setQuizzes(p.records ?? []); setNow(Date.now()); setErr('');
      } catch { setErr('Could not load the register. Is the server running?'); }
    };
    void load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  const names = useMemo(() => {
    const m = new Map<string, { at: string; name: string }>();
    const see = (id: string, at: string, name: string) => { if (name && !name.startsWith('Student') && (!m.get(id) || m.get(id)!.at < at)) m.set(id, { at, name }); };
    for (const s of sessions ?? []) see(s.studentId, s.lastSeenAt, s.studentName);
    for (const q of quizzes) see(q.studentId, q.at, q.studentName);
    return m;
  }, [sessions, quizzes]);
  const nameOf = (id: string) => names.get(id)?.name ?? '';

  const dates = useMemo(() => lastDates(date, days), [date, days]);
  const rows = useMemo(() => buildRegister(sessions ?? [], quizzes, dates, now, nameOf), [sessions, quizzes, dates, now, names]); // eslint-disable-line react-hooks/exhaustive-deps
  const known = useMemo(() => { const m = new Map<string, string>(); for (const s of sessions ?? []) m.set(s.studentId, nameOf(s.studentId) || s.studentName || `Student ${s.studentId.replace(/[^a-z0-9]/gi, '').slice(-6).toUpperCase()}`); return m; }, [sessions, names]); // eslint-disable-line react-hooks/exhaustive-deps
  const today = rows.filter((r) => r.date === date);
  const absent = days === 1 ? [...known.entries()].filter(([id]) => !today.some((r) => r.studentId === id && r.visits > 0)) : [];
  const present = today.filter((r) => r.visits > 0);
  const avg = present.length ? present.reduce((s, r) => s + r.seconds, 0) / present.length : 0;

  const download = () => {
    const url = URL.createObjectURL(new Blob([registerCsv(rows)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `attendance-${dates[dates.length - 1]}-to-${date}.csv`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  return (
    <Shell title="Teacher portal · Attendance" sub="Who came to class, when they entered and left, and how they did">
      <TeacherNav current="attendance" />
      {err && <p role="alert" className="mb-4 text-rose-300">{err}</p>}
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <label className="text-sm font-bold">Date<input type="date" value={date} max={localDate(new Date().toISOString())} onChange={(e) => e.target.value && setDate(e.target.value)} className="mt-1 block rounded-xl border border-white/15 bg-[#0b1426] px-3 py-2 font-normal" /></label>
        <div className="flex gap-1" role="group" aria-label="Range">{([[1, 'One day'], [7, '7 days'], [30, '30 days']] as const).map(([n, l]) => <button key={n} onClick={() => setDays(n)} aria-pressed={days === n} className={`rounded-full px-4 py-2 text-sm font-extrabold ${days === n ? 'bg-cyan-400 text-[#04121f]' : 'border border-white/15 hover:bg-white/5'}`}>{l}</button>)}</div>
        <button onClick={download} disabled={!rows.length} className="ml-auto rounded-xl border border-cyan-300/40 px-4 py-2 text-sm font-bold text-cyan-200 disabled:opacity-40">⬇ Download for Excel</button>
      </div>

      {sessions === null && !err ? <p className="text-slate-400">Loading…</p> : (
        <div className="space-y-8">
          <div className="grid gap-3 sm:grid-cols-5">
            <Stat label="Present">{present.length}</Stat>
            <Stat label="In class now">{today.filter((r) => r.inClassNow).length}</Stat>
            <Stat label="Average time">{mins(avg)}</Stat>
            <Stat label="Toffees given"><ToffeeCount n={today.reduce((s, r) => s + r.toffees, 0)} /></Stat>
            <Stat label="Chillies given"><ChilliCount n={today.reduce((s, r) => s + r.chillies, 0)} /></Stat>
          </div>

          {rows.length === 0 ? <p className="text-slate-400">No one came in {days === 1 ? 'on this day' : 'these days'}.</p> : (
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="bg-white/5 text-xs uppercase tracking-wider text-slate-400"><tr><th className="p-3">Date</th><th>Student</th><th>Entered</th><th>Left</th><th>In class</th><th>Visits</th><th>Quizzes</th><th>Score</th><th>Toffees</th><th>Chillies</th></tr></thead>
                <tbody>{rows.map((r) => {
                  const k = `${r.date}|${r.studentId}`; const on = open === k;
                  return [
                    <tr key={k} onClick={() => r.quizzes.length && setOpen(on ? null : k)} className={`border-t border-white/10 ${r.quizzes.length ? 'cursor-pointer hover:bg-white/[.03]' : ''}`}>
                      <td className="p-3 text-slate-400">{niceDate(r.date)}</td><td className="font-bold">{r.name} <span className="font-mono text-xs font-normal text-slate-500">{r.code}</span></td>
                      <td>{r.visits ? hm(r.firstIn) : <span className="text-slate-500">quiz only</span>}</td>
                      <td>{r.inClassNow ? <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-bold text-emerald-300">in class</span> : r.visits ? hm(r.lastOut) : '—'}</td>
                      <td>{r.visits ? mins(r.seconds) : '—'}</td><td>{r.visits || '—'}</td><td>{r.quizzes.length || '—'}</td>
                      <td className={`font-extrabold ${r.pct === null ? '' : tierColour(r.pct)}`}>{r.pct === null ? '—' : `${r.pct}%`}</td><td className="font-bold text-amber-300">{r.toffees || '—'}</td><td className="font-bold text-rose-300">{r.chillies || '—'}</td>
                    </tr>,
                    on && <tr key={`${k}-d`} className="bg-black/20"><td colSpan={10} className="space-y-2 p-3">{r.quizzes.map((q) => <SessionCard key={q.id} r={q} />)}</td></tr>,
                  ];
                })}</tbody>
              </table>
            </div>
          )}
          {days === 1 && absent.length > 0 && (
            <section><h2 className="mb-2 text-lg font-extrabold">Not in class this day <span className="text-sm font-normal text-slate-400">({absent.length}, students seen earlier)</span></h2>
              <div className="flex flex-wrap gap-2">{absent.map(([id, n]) => <span key={id} className="rounded-full border border-white/15 px-3 py-1 text-sm text-slate-300">{n}</span>)}</div></section>
          )}
          <p className="text-xs text-slate-500">Time in class counts only while the classroom page is open and in view. A student whose page closes without notice is shown as left at the last minute it was seen. Students appear by the name they type before their first quiz; until then by a code.</p>
        </div>
      )}
    </Shell>
  );
}
