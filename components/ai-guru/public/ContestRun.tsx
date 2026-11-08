'use client';
import { useCallback, useEffect, useState } from 'react';
import { activeContests, contestYear, nextContest, type Contest } from '@/lib/ai-guru/public/contests';
import { istToday } from '@/lib/ai-guru/public/daily';
import { svgToPng, winnersCardSvg } from '@/lib/ai-guru/share/scorecard';
import { QuizRun } from './QuizRun';

interface Board { entries: number; top: Array<{ rank: number; short: string; school: string; correct: number; seconds: number; you: boolean }>; mine: { rank: number } | null }
const post = async (b: unknown) => { const r = await fetch('/api/ai-guru/contest', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }); return { ok: r.ok, j: await r.json().catch(() => ({})) }; };

function One({ c }: { c: Contest }) {
  const year = contestYear(istToday());
  const [board, setBoard] = useState<Board | null>(null);
  const [msg, setMsg] = useState('');
  const [started, setStarted] = useState(false);
  const load = useCallback(async () => { try { const r = await fetch(`/api/ai-guru/contest?contest=${c.id}&year=${year}`, { cache: 'no-store' }); const j = await r.json(); if (j.ok) setBoard(j); } catch { /* offline */ } }, [c.id, year]);
  useEffect(() => { void load(); }, [load]);
  const done = useCallback(async (right: number, seconds: number) => {
    const r = await post({ contest: c.id, correct: right, seconds });
    setMsg(r.ok ? `You got ${right}/${c.questions.length} in ${seconds}s. ${r.j.rank ? `You are #${r.j.rank} of ${r.j.entries} so far.` : ''}` : r.j.error || 'Could not save');
    if (r.j.error === 'Sign in to enter the contest') setMsg(`You got ${right}/${c.questions.length}. Sign in to put your score on the board.`);
    void load();
  }, [c.id, c.questions.length, load]);
  const share = async () => {
    if (!board?.top.length) return;
    const svg = winnersCardSvg({ title: c.title.en, emoji: c.emoji, lang: 'en', link: `${window.location.origin}/ai-guru/learn/contest`, winners: board.top.slice(0, 3).map((t) => ({ short: t.short, correct: t.correct, total: c.questions.length, seconds: t.seconds })) });
    const png = await svgToPng(svg, 1080, 1350); const a = document.createElement('a'); a.href = URL.createObjectURL(png); a.download = `${c.id}-winners.png`; a.click();
  };
  return (
    <section className="space-y-4 rounded-3xl border border-amber-300/30 bg-amber-300/[.06] p-5">
      <h2 className="text-2xl font-extrabold">{c.emoji} {c.title.en} <span className="text-base font-normal text-slate-300">· {c.title.ml}</span></h2>
      <p className="text-slate-200">{c.blurb.en}</p><p className="text-sm text-slate-300">{c.blurb.ml}</p>
      <p className="text-sm font-bold text-amber-200">🍬 ×{c.bonus} toffees for every right answer while this contest is open. Most right wins; ties go to the fastest.</p>
      {!started ? <button className="rounded-lg bg-amber-300 px-5 py-3 font-extrabold text-black" onClick={() => setStarted(true)}>Start the quiz</button> : <QuizRun questions={c.questions} bonus={c.bonus} onDone={done} />}
      {msg && <p role="status" className="rounded-xl bg-cyan-400/10 p-3 text-sm font-bold text-cyan-200">{msg}</p>}
      {board && <div><h3 className="font-extrabold">Leaderboard ({board.entries} entered)</h3>{board.top.length ? <ol className="mt-2 space-y-1">{board.top.map((t) => <li key={t.rank + t.short} className={`flex justify-between rounded-lg px-3 py-1.5 text-sm ${t.you ? 'bg-amber-300/20 font-extrabold' : 'bg-black/20'}`}><span>#{t.rank} {t.short}{t.school ? <span className="text-slate-400"> · {t.school}</span> : null}</span><span>{t.correct}/{c.questions.length} · {t.seconds}s</span></li>)}</ol> : <p className="text-sm text-slate-400">Nobody has entered yet. Be the first!</p>}
        {board.top.length > 0 && <button onClick={share} className="mt-3 rounded-lg border border-white/15 px-3 py-2 text-xs font-bold hover:bg-white/5">Download winners’ card</button>}</div>}
    </section>
  );
}

/** Contest page body: every contest open today, or when the next one opens. */
export function ContestRun() {
  const [today, setToday] = useState('');
  useEffect(() => setToday(istToday()), []);
  if (!today) return null;
  const open = activeContests(today), next = nextContest(today);
  return (
    <div className="space-y-6">
      {open.map((c) => <One key={c.id} c={c} />)}
      {!open.length && <p className="rounded-2xl border border-white/10 bg-white/[.04] p-5">No contest is open today.{next ? <> The next one is <b>{next.contest.emoji} {next.contest.title.en}</b>, in {next.inDays} days.</> : null} Meanwhile, try the <a className="text-cyan-300 underline" href="/ai-guru/learn/daily">daily challenge</a>.</p>}
      {open.length > 0 && next && <p className="text-sm text-slate-400">Next: {next.contest.emoji} {next.contest.title.en} in {next.inDays} days.</p>}
    </div>
  );
}
