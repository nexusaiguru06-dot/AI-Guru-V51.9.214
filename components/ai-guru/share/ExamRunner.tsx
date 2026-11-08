'use client';
import { useState } from 'react';

export interface ExamQ { q: string; options: string[]; answer?: number }
export interface ExamItem { id: string; title: string; body: string; minutes?: number; open?: boolean; questions?: ExamQ[]; attempt?: { score: number; total: number; answers: number[] } | null }

/** One exam: the questions, hand in once, then the mark and the right answers. Used on the Teachers Notes page and inside the regular class. */
export function ExamRunner({ item, onDone }: { item: ExamItem; onDone?: (updated: ExamItem) => void }) {
  const [ans, setAns] = useState<number[]>([]); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const [it, setIt] = useState(item);
  const submit = async () => {
    setErr('');
    const a = (it.questions ?? []).map((_, i) => ans[i] ?? -1);
    if (a.some((x) => x < 0) && !window.confirm('Some questions are not answered. Hand in anyway?')) return;
    setBusy(true);
    const r = await fetch('/api/ai-guru/student-portal/class-content', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: it.id, answers: a }) });
    const j = await r.json().catch(() => ({})); setBusy(false);
    if (!j.ok) return setErr(j.error || 'Could not hand in');
    setIt(j.item); onDone?.(j.item);
  };
  if (!it.attempt && !it.open) return <p className="mt-2 text-xs text-slate-400">This exam is not open now.</p>;
  return (
    <div className="mt-2 space-y-3 text-sm">
      {it.body && <p className="whitespace-pre-line text-slate-200">{it.body}</p>}
      {it.attempt && <p className="rounded-lg bg-amber-300/10 px-3 py-2 font-extrabold text-amber-200">Your mark: {it.attempt.score}/{it.attempt.total}</p>}
      {it.minutes && !it.attempt ? <p className="text-xs text-slate-400">Suggested time: {it.minutes} minutes. You can hand in once.</p> : null}
      {(it.questions ?? []).map((q, i) => (
        <fieldset key={i} className="rounded-lg border border-white/10 p-2"><legend className="px-1 text-xs font-bold text-slate-300">{i + 1}. {q.q}</legend>
          {q.options.map((o, k) => {
            const mine = it.attempt ? it.attempt.answers[i] === k : ans[i] === k;
            const right = it.attempt && q.answer === k;
            return <label key={k} className={`mt-1 flex items-center gap-2 rounded px-2 py-1 ${right ? 'bg-emerald-400/15 text-emerald-200' : mine && it.attempt ? 'bg-rose-400/15 text-rose-200' : ''}`}><input type="radio" name={`${it.id}-${i}`} disabled={!!it.attempt} checked={mine} onChange={() => setAns((a) => { const c = [...a]; c[i] = k; return c; })} />{o}{right ? ' ✓' : ''}</label>;
          })}
        </fieldset>
      ))}
      {err && <p role="alert" className="text-rose-300">{err}</p>}
      {!it.attempt && <button disabled={busy} className="rounded-lg bg-cyan-400 px-4 py-2 text-xs font-extrabold text-[#04121f] disabled:opacity-50" onClick={() => void submit()}>Hand in</button>}
    </div>
  );
}
