'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { currentStudentId } from '@/lib/ai-guru/motion-class/interactive/progress';
import { dailyFive, dailyStreak, istToday, reminderIcs } from '@/lib/ai-guru/public/daily';
import { QuizRun } from './QuizRun';

const KEY = 'ai-guru:daily:v1';
const load = (): string[] => { try { const a = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a.filter((x) => typeof x === 'string').slice(-400) : []; } catch { return []; } };

/** Five questions, five minutes, one streak. Same questions for everyone today, so friends can compare. */
export function DailyChallenge() {
  const today = useMemo(() => istToday(), []);
  const qs = useMemo(() => dailyFive(today), [today]);
  const [done, setDone] = useState<string[]>([]);
  const [result, setResult] = useState<{ right: number; seconds: number } | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => { setDone(load()); setReady(true); currentStudentId(); }, []);
  const finish = useCallback((right: number, seconds: number) => {
    setResult({ right, seconds });
    setDone((d) => { const n = d.includes(today) ? d : [...d, today]; try { localStorage.setItem(KEY, JSON.stringify(n)); } catch { /* private mode: the streak simply is not kept */ } return n; });
  }, [today]);
  const streak = dailyStreak(done, today);
  const already = done.includes(today) && !result;
  const link = typeof window === 'undefined' ? '' : `${window.location.origin}/ai-guru/learn/daily`;
  const ics = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([reminderIcs(link)], { type: 'text/calendar' })); a.download = 'ai-guru-daily.ics'; a.click(); };
  const text = result ? `🍬 I got ${result.right}/5 in ${result.seconds}s on today's AI Guru five-minute challenge${streak > 1 ? ` — 🔥 ${streak}-day streak` : ''}! Can you beat me? ${link}` : '';
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4"><span className="text-3xl">🔥</span><div><p className="font-extrabold text-amber-200">{ready ? `${streak}-day streak` : '…'}</p><p className="text-xs text-slate-300">Do the challenge every day to keep it alive. Today: {today}.</p></div>
        <button onClick={ics} className="ml-auto rounded-lg border border-white/15 px-3 py-2 text-xs font-bold hover:bg-white/5">Remind me every day (5 pm)</button></div>
      {already && <p role="status" className="rounded-xl border border-emerald-400/40 bg-emerald-400/10 p-3 text-sm text-emerald-200">You have done today’s challenge. Practise it again below, or come back tomorrow.</p>}
      <QuizRun questions={qs} onDone={finish} />
      {result && <section role="status" className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 p-4"><p className="text-lg font-extrabold">{result.right}/5 in {result.seconds} seconds{streak > 1 ? ` · 🔥 ${streak} days` : ''}</p><div className="mt-2 flex flex-wrap gap-2"><a className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-extrabold text-white" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(text)}`}>Challenge a friend on WhatsApp</a><a className="rounded-lg border border-white/15 px-3 py-2 text-xs font-bold" href="/ai-guru/student/signup">Make a free account to keep your toffees</a></div></section>}
    </div>
  );
}
