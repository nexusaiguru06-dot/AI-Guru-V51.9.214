'use client';
/** V51.9.193 — a student takes their teacher's exam: one go, a time limit (kept by the server), the score, and the right answers once the exam closes. */
import { useCallback, useEffect, useRef, useState } from 'react';

interface Q { id: string; q: string; options: string[] }
interface ExamView { id: string; title: string; subject: string; teacherName: string; minutes?: number; closes?: string; questions: Q[] }

export default function ExamPage() {
  const [e, setE] = useState<ExamView | null>(null);
  const [err, setErr] = useState('');
  const [ans, setAns] = useState<number[]>([]);
  const [result, setResult] = useState<{ score: number; total: number; right?: number[]; answers?: number[]; late?: boolean; answersOn?: string } | null>(null);
  const [left, setLeft] = useState(0);
  const sent = useRef(false);
  const id = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('id') ?? '' : '';
  useEffect(() => {
    if (!id) return;
    void fetch(`/api/ai-guru/student-portal/exams?id=${encodeURIComponent(id)}`, { cache: 'no-store' }).then(async (r) => {
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) { window.location.href = '/ai-guru/student'; return; }
      if (!j.ok) { setErr(j.error ?? 'Could not open the exam.'); return; }
      setE(j.exam); setAns(j.exam.questions.map(() => -1));
      if (j.done) setResult({ score: j.done.score, total: j.done.total, right: j.done.right, answers: j.done.answers, late: j.done.late, answersOn: j.done.answersOn });
      else if (j.secondsLeft > 0) setLeft(j.secondsLeft); // V51.9.195: the server's clock (reopening does not restart it)
      else setErr('Your time for this exam is over. Hand it in now.');
    });
  }, [id]);
  const submit = useCallback(async () => {
    if (!e || sent.current) return; sent.current = true;
    const r = await fetch('/api/ai-guru/student-portal/exams', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: e.id, answers: ans }) }).then((x) => x.json()).catch(() => ({ ok: false, error: 'Could not reach the server' }));
    if (r.ok) setResult({ score: r.score, total: r.total, right: r.right, answers: ans, late: r.late, answersOn: r.answersOn }); else { setErr(r.error); sent.current = false; }
  }, [e, ans]);
  useEffect(() => { if (!left || result) return; const t = setTimeout(() => { if (left <= 1) void submit(); else setLeft(left - 1); }, 1000); return () => clearTimeout(t); }, [left, result, submit]);
  const mine = result?.answers ?? ans;
  return (
    <main className="min-h-screen bg-[#06101c] px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-2xl space-y-4">
        <a href="/ai-guru/student" className="text-xs text-slate-400">← My account</a>
        {err && <p role="alert" className="rounded-xl border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">{err}</p>}
        {e && <>
          <header className="flex flex-wrap items-end gap-2"><div><h1 className="text-2xl font-extrabold">{e.title}</h1><p className="text-sm text-slate-400">{e.subject} · {e.teacherName} · {e.questions.length} questions</p></div>
            {!result && left > 0 && <span className={`ml-auto rounded-full px-3 py-1 font-mono text-lg font-bold ${left < 60 ? 'bg-rose-500/20 text-rose-200' : 'bg-white/10'}`} data-exam-timer>{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</span>}</header>
          {result && <p className="rounded-2xl border border-emerald-300/40 bg-emerald-400/10 p-4 text-center text-lg" data-exam-score>{result.score === result.total ? '🎉 ' : ''}You scored <b className="text-3xl text-emerald-200">{result.score}/{result.total}</b>
            {result.late && <span className="mt-1 block text-sm text-amber-200">This was handed in after the time limit, so the answers were not counted.</span>}
            {!result.right && result.answersOn && <span className="mt-1 block text-sm text-slate-300">The right answers are shown here after the exam closes on {result.answersOn}.</span>}</p>}
          <ol className="space-y-3">{e.questions.map((q, i) => (
            <li key={q.id} className="rounded-2xl border border-white/10 bg-white/[.04] p-3">
              <p className="font-bold">{i + 1}. {q.q}</p>
              <div className="mt-2 grid gap-1.5">{q.options.map((o, k) => {
                const chosen = mine[i] === k, right = !!result?.right && result.right[i] === k;
                return <label key={k} className={`flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm ${right ? 'border-emerald-300 bg-emerald-400/15' : chosen && result ? 'border-rose-300 bg-rose-400/10' : chosen ? 'border-violet-300 bg-violet-400/15' : 'border-white/10'}`}>
                  <input type="radio" name={q.id} disabled={!!result} checked={chosen} onChange={() => setAns(ans.map((a, n) => (n === i ? k : a)))} />{o}{right ? ' ✓' : ''}</label>;
              })}</div>
            </li>))}</ol>
          {!result && <button className="w-full rounded-xl bg-violet-400 py-3 font-extrabold text-[#12052a]" onClick={() => { if (ans.includes(-1) && !window.confirm('Some questions have no answer. Hand it in anyway?')) return; void submit(); }} data-exam-submit>Hand it in</button>}
        </>}
      </div>
    </main>
  );
}
