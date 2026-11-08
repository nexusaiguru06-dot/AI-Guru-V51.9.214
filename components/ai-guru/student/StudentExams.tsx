'use client';
/** V51.9.193 — "📝 Exams from your teachers" on My account (students of a contracted school). */
import { useEffect, useState } from 'react';
import { fetchIfSignedIn } from '@/lib/ai-guru/net/session-hint';

interface Row { id: string; title: string; subject: string; teacherName: string; opens: string; closes: string; minutes: number; questions: number; state: 'open' | 'soon' | 'done' | 'closed'; score?: number; total?: number }

export function StudentExams() {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => { void fetchIfSignedIn(['student'], '/api/ai-guru/student-portal/exams', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => j?.ok && setRows(j.exams)).catch(() => undefined); }, []);
  if (!rows || !rows.length) return null;
  return (
    <section className="space-y-2 rounded-2xl border border-violet-300/30 bg-violet-400/5 p-4" data-student-exams>
      <h2 className="text-lg font-extrabold">📝 Exams from your teachers </h2>
      <ul className="space-y-2">{rows.map((e) => (
        <li key={e.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm" data-exam-row={e.state}>
          <span className="min-w-0 flex-1"><b>{e.title}</b><span className="block text-xs text-slate-400">{e.subject} · {e.teacherName} · {e.questions} questions · {e.minutes} min · {e.state === 'soon' ? `opens ${e.opens}` : `until ${e.closes}`}</span></span>
          {e.state === 'open' && <a href={`/ai-guru/student/exam?id=${encodeURIComponent(e.id)}`} className="rounded-lg bg-violet-400 px-3 py-1.5 font-extrabold text-[#12052a]">Start</a>}
          {e.state === 'done' && <a href={`/ai-guru/student/exam?id=${encodeURIComponent(e.id)}`} className="font-bold text-emerald-300">{e.score}/{e.total} ✓</a>}
          {e.state === 'soon' && <span className="text-xs text-slate-400">soon</span>}
        </li>))}</ul>
    </section>
  );
}
