'use client';
/** The 3-question quiz on a public lesson. Right answers earn toffees, wrong ones chillies, exactly like the classroom; the counters stay on this device until the visitor makes an account. */
import { useEffect, useState } from 'react';
import { currentStudentId } from '@/lib/ai-guru/motion-class/interactive/progress';
import { addReward } from '@/lib/ai-guru/quiz/rewards';
import type { Q } from '@/lib/ai-guru/public/lessons';
import { Chilli } from '@/components/ai-guru/quiz/Chilli';
import { RewardCounters } from '@/components/ai-guru/quiz/RewardCounters';
import { Toffee } from '@/components/ai-guru/quiz/Toffee';

export function SampleQuiz({ quiz }: { quiz: Q[] }) {
  const [picked, setPicked] = useState<Array<number | null>>(() => quiz.map(() => null));
  const [id, setId] = useState('');
  useEffect(() => { setId(currentStudentId()); }, []);
  const right = picked.filter((p, i) => p === quiz[i].answer).length;
  const done = picked.every((p) => p !== null);
  const pick = (qi: number, oi: number) => {
    if (picked[qi] !== null) return;
    setPicked((p) => p.map((v, i) => (i === qi ? oi : v)));
    if (id) addReward(id, oi === quiz[qi].answer ? { toffees: 1 } : { chillies: 1 });
  };
  return (
    <section aria-label="Try the quiz" className="space-y-5">
      <RewardCounters />
      {quiz.map((q, qi) => {
        const chosen = picked[qi];
        return (
          <div key={qi} className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
            <p className="font-extrabold">{qi + 1}. {q.q.en}{q.q.ml !== q.q.en && <span className="block text-sm font-normal text-slate-300">{q.q.ml}</span>}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {q.options.map((o, oi) => {
                const state = chosen === null ? 'idle' : oi === q.answer ? 'right' : oi === chosen ? 'wrong' : 'dim';
                const cls = { idle: 'border-white/15 bg-white/5 hover:border-cyan-400', right: 'border-emerald-400 bg-emerald-500/20', wrong: 'border-rose-400 bg-rose-500/15', dim: 'border-white/10 opacity-50' }[state];
                return <button key={oi} disabled={chosen !== null} onClick={() => pick(qi, oi)} className={`flex min-h-[48px] items-center gap-3 rounded-xl border px-3 py-2 text-left font-semibold ${cls}`}><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-extrabold">{'ABCD'[oi]}</span><span>{o.en}{o.ml !== o.en && <span className="block text-xs font-normal text-slate-300">{o.ml}</span>}</span></button>;
              })}
            </div>
            {chosen !== null && <p role="status" className={`mt-3 flex items-start gap-2 text-sm ${chosen === q.answer ? 'text-emerald-300' : 'text-rose-300'}`}>{chosen === q.answer ? <Toffee size={30} /> : <Chilli size={30} />}<span>{chosen === q.answer ? 'Right! +1 toffee. ' : 'Not this time, +1 chilli. '}{q.why.en}<span className="block text-slate-300">{q.why.ml}</span></span></p>}
          </div>);
      })}
      {done && <p role="status" className="rounded-2xl border border-amber-300/40 bg-amber-400/10 p-4 text-center font-extrabold text-amber-200">You got {right} of {quiz.length} right. Make a free account to keep your toffees and take more quizzes.</p>}
    </section>
  );
}
