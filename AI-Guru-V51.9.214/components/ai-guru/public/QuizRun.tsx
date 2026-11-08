'use client';
/** A timed run of public questions: toffee for each right answer (times `bonus`), chilli for each wrong one, then onDone(right, seconds). */
import { useEffect, useRef, useState } from 'react';
import { currentStudentId } from '@/lib/ai-guru/motion-class/interactive/progress';
import { addReward } from '@/lib/ai-guru/quiz/rewards';
import type { Q } from '@/lib/ai-guru/public/lessons';
import { Chilli } from '@/components/ai-guru/quiz/Chilli';
import { RewardCounters } from '@/components/ai-guru/quiz/RewardCounters';
import { Toffee } from '@/components/ai-guru/quiz/Toffee';

export function QuizRun({ questions, bonus = 1, onDone }: { questions: Array<Q & { lesson?: string }>; bonus?: number; onDone?: (right: number, seconds: number) => void }) {
  const [picked, setPicked] = useState<Array<number | null>>(() => questions.map(() => null));
  const [id, setId] = useState('');
  const t0 = useRef(0);
  const fired = useRef(false);
  useEffect(() => { setId(currentStudentId()); t0.current = Date.now(); }, []);
  const right = picked.filter((p, i) => p === questions[i].answer).length;
  const done = picked.every((p) => p !== null);
  useEffect(() => { if (done && !fired.current) { fired.current = true; onDone?.(right, Math.max(3, Math.round((Date.now() - t0.current) / 1000))); } }, [done, right, onDone]);
  const pick = (qi: number, oi: number) => {
    if (picked[qi] !== null) return;
    setPicked((p) => p.map((v, i) => (i === qi ? oi : v)));
    if (id) addReward(id, oi === questions[qi].answer ? { toffees: bonus } : { chillies: 1 });
  };
  return (
    <section aria-label="Questions" className="space-y-4">
      <RewardCounters />
      {questions.map((q, qi) => {
        const chosen = picked[qi];
        return (
          <div key={qi} className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
            {q.lesson && <p className="text-xs font-bold uppercase tracking-wider text-cyan-300">{q.lesson}</p>}
            <p className="font-extrabold">{qi + 1}. {q.q.en}{q.q.ml !== q.q.en && <span className="block text-sm font-normal text-slate-300">{q.q.ml}</span>}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {q.options.map((o, oi) => {
                const state = chosen === null ? 'idle' : oi === q.answer ? 'right' : oi === chosen ? 'wrong' : 'dim';
                const cls = { idle: 'border-white/15 bg-white/5 hover:border-cyan-400', right: 'border-emerald-400 bg-emerald-500/20', wrong: 'border-rose-400 bg-rose-500/15', dim: 'border-white/10 opacity-50' }[state];
                return <button key={oi} disabled={chosen !== null} onClick={() => pick(qi, oi)} className={`flex min-h-[48px] items-center gap-3 rounded-xl border px-3 py-2 text-left font-semibold ${cls}`}><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10 text-sm">{'ABCD'[oi]}</span>{o.en}</button>;
              })}
            </div>
            {chosen !== null && <p role="status" className={`mt-3 flex items-start gap-2 text-sm ${chosen === q.answer ? 'text-emerald-300' : 'text-rose-300'}`}>{chosen === q.answer ? <Toffee size={26} /> : <Chilli size={26} />}<span>{q.why.en}<span className="block text-slate-300">{q.why.ml}</span></span></p>}
          </div>);
      })}
    </section>
  );
}
